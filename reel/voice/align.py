#!/usr/bin/env python3
"""Word timings for the voice lines (used for one-word-at-a-time subtitles).

    .venv/bin/python voice/align.py --engine local [--force] [--only n1] [--model small.en]
    .venv/bin/python voice/align.py --engine local --check     # verify only

Output: voices/<engine>/<id>.words.json = [{"word","start","end"}, ...] in seconds
relative to that line's wav, containing EXACTLY script.json's whitespace tokens
(punctuation attached) in order.

Method: faster-whisper (CPU int8, word_timestamps=True) -> difflib alignment of
normalized recognized words onto the script words; unmatched script words are
interpolated by character count between matched neighbours; everything is
clamped monotonic and inside the wav. The first word is snapped to the measured
speech onset, the last word end to the measured speech offset.
"""
from __future__ import annotations

import argparse
import difflib
import json
import re
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
import common as C  # noqa: E402

WHISPER_DIR = C.BUILD / "models" / "whisper"
_MODEL = None


def norm(w: str) -> str:
    return re.sub(r"[^a-z0-9]", "", w.lower())


def get_model(name: str):
    global _MODEL
    if _MODEL is None:
        from faster_whisper import WhisperModel
        WHISPER_DIR.mkdir(parents=True, exist_ok=True)
        _MODEL = WhisperModel(name, device="cpu", compute_type="int8",
                              download_root=str(WHISPER_DIR), cpu_threads=4)
    return _MODEL


def recognize(wav: Path, text: str, model_name: str) -> list[dict]:
    m = get_model(model_name)
    audio = C.read_audio(wav, sr=16000).astype(np.float32)
    segs, _ = m.transcribe(audio, language="en", beam_size=5, word_timestamps=True,
                           vad_filter=False, condition_on_previous_text=False,
                           temperature=0.0, initial_prompt=text)
    out = []
    for s in segs:
        for w in (s.words or []):
            out.append({"w": w.word.strip(), "start": float(w.start), "end": float(w.end),
                        "p": float(w.probability)})
    return out


def speech_offset(x: np.ndarray, sr: int = C.SR, thresh_db: float = -35.0) -> float:
    hop = int(sr * 0.010)
    n = len(x) // hop
    rms = np.sqrt(np.mean(x[: n * hop].reshape(n, hop) ** 2, axis=1) + 1e-20)
    db = 20 * np.log10(rms)
    idx = np.where(db > db.max() + thresh_db)[0]
    return float((idx[-1] + 1) * hop / sr) if len(idx) else len(x) / sr


def map_words(script_toks: list[str], rec: list[dict], dur: float, onset: float,
              offset: float) -> tuple[list[dict], dict]:
    a = [norm(t) for t in script_toks]
    b = [norm(r["w"]) for r in rec]
    st = [None] * len(a)
    en = [None] * len(a)
    matched = 0
    sm = difflib.SequenceMatcher(a=a, b=b, autojunk=False)
    for tag, i1, i2, j1, j2 in sm.get_opcodes():
        if tag == "equal" or (tag == "replace" and (i2 - i1) == (j2 - j1)):
            for k in range(i2 - i1):
                st[i1 + k] = rec[j1 + k]["start"]
                en[i1 + k] = rec[j1 + k]["end"]
            if tag == "equal":
                matched += i2 - i1
        elif tag == "replace":
            # spread the recognized span over the script words by char count
            s0, e0 = rec[j1]["start"], rec[j2 - 1]["end"]
            lens = np.array([max(1, len(x)) for x in a[i1:i2]], float)
            edges = s0 + (e0 - s0) * np.concatenate([[0], np.cumsum(lens) / lens.sum()])
            for k in range(i2 - i1):
                st[i1 + k], en[i1 + k] = float(edges[k]), float(edges[k + 1])
        # 'delete' (script words not heard): interpolated below; 'insert': ignored

    # interpolate gaps between known neighbours (by character count)
    n = len(a)
    i = 0
    while i < n:
        if st[i] is not None:
            i += 1
            continue
        j = i
        while j < n and st[j] is None:
            j += 1
        left = en[i - 1] if i > 0 else onset
        right = st[j] if j < n else offset
        if right < left:
            right = left
        lens = np.array([max(1, len(x)) for x in a[i:j]], float)
        edges = left + (right - left) * np.concatenate([[0], np.cumsum(lens) / lens.sum()])
        for k in range(j - i):
            st[i + k], en[i + k] = float(edges[k]), float(edges[k + 1])
        i = j

    # snap edges to the measured speech envelope
    st[0] = onset if abs(st[0] - onset) < 0.4 or st[0] < onset else st[0]
    if en[-1] < offset - 0.05 or en[-1] > offset:
        en[-1] = max(st[-1] + 0.05, offset)

    # clamp monotonic + inside the wav
    words = []
    prev_start = 0.0
    for k, tok in enumerate(script_toks):
        s = min(max(st[k], prev_start, 0.0), dur)
        e = min(max(en[k], s + 0.02), dur)
        words.append({"word": tok, "start": round(s, 3), "end": round(e, 3)})
        prev_start = s
    # ends shouldn't overlap the next start
    for k in range(len(words) - 1):
        if words[k]["end"] > words[k + 1]["start"]:
            words[k]["end"] = max(words[k]["start"], words[k + 1]["start"])
    stats = {"script_words": n, "recognized": len(rec), "exact_matches": matched,
             "match_ratio": round(matched / max(1, n), 3),
             "mean_prob": round(float(np.mean([r["p"] for r in rec])) if rec else 0.0, 3),
             "recognized_text": " ".join(r["w"] for r in rec)}
    return words, stats


def align_line(engine: str, line: dict, model: str) -> dict:
    wav = C.wav_path(engine, line["id"])
    x = C.read_audio(wav)
    dur = len(x) / C.SR
    onset = C.speech_onset(x)
    offset = speech_offset(x)
    rec = recognize(wav, line["text"], model)
    words, stats = map_words(C.script_words(line["text"]), rec, dur, onset, offset)
    stats.update(duration=round(dur, 3), onset=round(onset, 3), offset=round(offset, 3))
    return {"words": words, "stats": stats}


def check(engine: str) -> int:
    bad = 0
    for line in C.load_script()["lines"]:
        wp, jp = C.wav_path(engine, line["id"]), C.words_path(engine, line["id"])
        if not (wp.exists() and jp.exists()):
            print(f"  {line['id']}: MISSING {wp.name if not wp.exists() else jp.name}")
            bad += 1
            continue
        x = C.read_audio(wp)
        words = json.loads(jp.read_text())
        probs = C.validate_words(words, line["text"], len(x) / C.SR, C.speech_onset(x))
        print(f"  {line['id']}: {'OK' if not probs else 'PROBLEM: ' + '; '.join(probs)}  "
              f"({len(words)} words, {len(x)/C.SR:.2f}s)")
        bad += bool(probs)
    return 1 if bad else 0


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--engine", default="local", choices=C.ENGINES)
    ap.add_argument("--model", default="small.en", help="faster-whisper model (small.en / base.en)")
    ap.add_argument("--only", default="")
    ap.add_argument("--force", action="store_true")
    ap.add_argument("--check", action="store_true")
    a = ap.parse_args()
    if a.check:
        return check(a.engine)
    only = set(filter(None, a.only.split(",")))
    report = {}
    print(f"== word alignment ({a.engine}, faster-whisper {a.model}) ==")
    for line in C.load_script()["lines"]:
        lid = line["id"]
        if only and lid not in only:
            continue
        jp = C.words_path(a.engine, lid)
        if jp.exists() and not a.force:
            print(f"  {lid}: words exist, keeping")
            continue
        if not C.wav_path(a.engine, lid).exists():
            print(f"  {lid}: no wav, skipping")
            continue
        try:
            r = align_line(a.engine, line, a.model)
        except Exception as e:
            if a.model != "base.en":
                print(f"  {lid}: {a.model} failed ({e!r}); retrying with base.en")
                global _MODEL
                _MODEL = None
                a.model = "base.en"
                r = align_line(a.engine, line, a.model)
            else:
                raise
        jp.write_text(json.dumps(r["words"], indent=1) + "\n")
        s = r["stats"]
        report[lid] = s
        print(f"  {lid}: match {s['exact_matches']}/{s['script_words']} "
              f"p={s['mean_prob']} onset={s['onset']} dur={s['duration']} | heard: {s['recognized_text']}")
    if report:
        rp = C.BUILD / f"align_report_{a.engine}.json"
        rp.parent.mkdir(parents=True, exist_ok=True)
        old = json.loads(rp.read_text()) if rp.exists() else {}
        old.update(report)
        rp.write_text(json.dumps(old, indent=1))
    print("== verify ==")
    return check(a.engine)


if __name__ == "__main__":
    sys.exit(main())
