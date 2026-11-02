#!/usr/bin/env python3
"""Build scene/timeline.json (+ audio/voice_track.wav when real audio exists).

With ElevenLabs alignment present (audio/*_alignment.json), every narrator
sentence is cut out of the single narrator file, the crush line is spliced in
after "Then she raises her hand.", and extra comedic pauses are added so the
whole thing lands on 45.0 s.  Word and caption times are derived from the
returned character timestamps (no extra API calls).

Without alignment, timings are *estimated* so a silent preview can be rendered.
"""
import json
import re
import subprocess
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
from voiceover import NARRATOR_LINES, CRUSH_LINES, TEXTS  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
AUDIO = ROOT / "audio"
SR = 44100
FPS = 30
DURATION = 45.0
INTRO = 0.30           # silence before the first word
ENDING_MIN = 6.6       # note-passing ending (no voice)
ENDING_BEAT = 0.55     # gap between the last line and the ending
BASE_GAP = 0.10

# extra pause weights after each segment (comedic beats)
PAUSE_W = {
    "S1": 0.5, "S2": 1.0, "S3": 0.3, "S4": 0.7, "S5": 0.35, "S6": 0.6,
    "S7": 0.6, "S8": 0.6, "S9": 0.3, "S10": 0.25, "S11": 0.35, "S12": 0.6,
    "S13": 0.4, "S14": 0.9, "S15": 1.0, "S16": 0.45, "C1": 0.7, "S17": 0.4,
    "S18": 0.8, "S19": 0.0,
}
FUNCTION_WORDS = {"in", "your", "the", "a", "at", "with", "of", "to", "her", "she", "you", "it", "but", "then", "no", "and"}


# --------------------------------------------------------------------------- alignment
def estimated_alignment(text):
    chars, st, en = [], [], []
    t = 0.0
    for ch in text:
        d = 0.066
        if ch in ".!?":
            d = 0.38
        elif ch == ",":
            d = 0.18
        elif ch == " ":
            d = 0.05
        chars.append(ch); st.append(t); en.append(t + d); t += d
    return {"characters": chars, "character_start_times_seconds": st,
            "character_end_times_seconds": en}, t + 0.3


def load_alignment(name):
    p = AUDIO / f"{name}_alignment.json"
    if not p.exists():
        return None
    a = json.loads(p.read_text())
    return a.get("alignment") or a.get("normalized_alignment")


def sentence_spans(full_text, lines, align):
    """Return per sentence: list of words with (start, end) in the source audio."""
    chars = align["characters"]
    st = align["character_start_times_seconds"]
    en = align["character_end_times_seconds"]
    joined = "".join(chars)
    out, cursor = [], 0
    for line in lines:
        i = joined.find(line, cursor)
        if i < 0:  # tolerate small normalisation differences
            i = joined.find(line.split()[0], cursor)
        if i < 0:
            raise SystemExit(f"could not locate sentence in alignment: {line!r}")
        words, pos = [], i
        for w in line.split():
            j = joined.find(w, pos)
            idx = [k for k in range(j, j + len(w)) if chars[k].isalnum() or chars[k] == "'"]
            words.append({"w": w, "s": st[idx[0]], "e": en[idx[-1]]})
            pos = j + len(w)
        out.append({"text": line, "s": words[0]["s"], "e": words[-1]["e"], "words": words})
        cursor = pos
    return out


# --------------------------------------------------------------------------- captions
def chunk_words(words):
    n = len(words)
    if n <= 4:
        return [words]
    best, best_cost = None, 1e9

    def parts(k):
        if k == 0:
            yield []
            return
        for size in (2, 3, 4):
            if size <= k:
                for rest in parts(k - size):
                    yield [size] + rest

    for p in parts(n):
        cost, i = 0.0, 0
        for size in p:
            cost += (size - 3) ** 2
            last = re.sub(r"[^a-z']", "", words[i + size - 1]["w"].lower())
            if last in FUNCTION_WORDS and i + size < n:
                cost += 3
            i += size
        cost += 0.5 * len(p) - 0.01 * p[0]
        if cost < best_cost:
            best, best_cost = p, cost
    res, i = [], 0
    for size in best:
        res.append(words[i:i + size]); i += size
    return res


def caption_text(ws):
    t = " ".join(w["w"] for w in ws)
    return re.sub(r"[.]+$", "", t)


# --------------------------------------------------------------------------- audio helpers
def decode(path):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", str(path), "-f", "s16le", "-ac", "1",
                          "-ar", str(SR), "-"], check=True, capture_output=True).stdout
    return np.frombuffer(raw, dtype=np.int16).astype(np.float32) / 32768.0


def fade(x, ms=8):
    n = min(len(x) // 2, int(SR * ms / 1000))
    if n > 0:
        r = np.linspace(0, 1, n, dtype=np.float32)
        x[:n] *= r; x[-n:] *= r[::-1]
    return x


# --------------------------------------------------------------------------- main
def main():
    nar_al, cr_al = load_alignment("narrator"), load_alignment("crush")
    real = nar_al is not None and cr_al is not None
    if real:
        nar_dur = len(decode(AUDIO / "narrator.mp3")) / SR
        cr_dur = len(decode(AUDIO / "crush.mp3")) / SR
    else:
        nar_al, nar_dur = estimated_alignment(TEXTS["narrator"])
        cr_al, cr_dur = estimated_alignment(TEXTS["crush"])

    nar = sentence_spans(TEXTS["narrator"], NARRATOR_LINES, nar_al)
    cru = sentence_spans(TEXTS["crush"], CRUSH_LINES, cr_al)

    # source cut windows
    def cuts(spans, total):
        res = []
        for i, sp in enumerate(spans):
            prev_e = spans[i - 1]["e"] if i else None
            next_s = spans[i + 1]["s"] if i + 1 < len(spans) else None
            cs = sp["s"] - 0.06 if prev_e is None else max(sp["s"] - 0.06, (prev_e + sp["s"]) / 2)
            ce = sp["e"] + 0.22 if next_s is None else min(sp["e"] + 0.14, (sp["e"] + next_s) / 2)
            res.append((max(0.0, cs), min(total, ce)))
        return res

    nar_c, cr_c = cuts(nar, nar_dur), cuts(cru, cr_dur)
    order = []  # (id, speaker, span, cut)
    for i, sp in enumerate(nar):
        order.append((f"S{i + 1}", "narrator", sp, nar_c[i]))
        if sp["text"].startswith("Then she raises her hand"):
            order.append(("C1", "crush", cru[0], cr_c[0]))
    # renumber narrator ids after the crush line stay S17.. (already sequential)

    # sentences the voice ran together (no pause in the source) stay glued: no gap inserted
    glued = {order[i][0] for i in range(len(order) - 1)
             if order[i][1] == order[i + 1][1] and order[i + 1][3][0] <= order[i][3][1] + 1e-3}
    speech = sum(c[1] - c[0] for _, _, _, c in order) + BASE_GAP * (len(order) - 1 - len(glued))
    target_end = DURATION - ENDING_MIN - ENDING_BEAT
    wsum = sum(PAUSE_W[o[0]] for o in order if o[0] not in glued)
    k = max(0.0, (target_end - INTRO - speech) / wsum)
    k = min(k, 1.9)

    segments, cursor = [], INTRO
    for sid, spk, sp, (cs, ce) in order:
        shift = cursor - cs
        words = [{"w": w["w"], "s": round(w["s"] + shift, 3), "e": round(w["e"] + shift, 3)} for w in sp["words"]]
        seg = {"id": sid, "speaker": spk, "text": sp["text"], "start": round(cursor, 3),
               "end": round(cursor + (ce - cs), 3), "words": words,
               "src": {"file": f"{spk}.mp3", "cut_s": round(cs, 4), "cut_e": round(ce, 4)}}
        if spk == "crush":  # vowel timings for mouth flaps
            chars = cr_al["characters"]
            vis = []
            for ci, ch in enumerate(chars):
                if ch.lower() in "aeiouy":
                    s = cr_al["character_start_times_seconds"][ci] + shift
                    e = cr_al["character_end_times_seconds"][ci] + shift
                    if cs <= s - shift <= ce:
                        vis.append([round(s, 3), round(max(e, s + 0.07), 3)])
            seg["visemes"] = vis
        segments.append(seg)
        cursor += (ce - cs) + (0.0 if sid in glued else BASE_GAP + k * PAUSE_W[sid])
    last_end = segments[-1]["end"]
    ending_start = round(min(last_end + ENDING_BEAT, DURATION - 5.4), 3)

    # captions
    captions = []
    for si, seg in enumerate(segments):
        nxt = segments[si + 1]["start"] if si + 1 < len(segments) else ending_start
        chunks = chunk_words(seg["words"])
        for ci, ch in enumerate(chunks):
            s = ch[0]["s"] - 0.04
            if ci + 1 < len(chunks):
                e = chunks[ci + 1][0]["s"] - 0.04
            else:
                e = min(ch[-1]["e"] + 0.45, nxt - 0.06)
            captions.append({"text": caption_text(ch), "s": round(s, 3), "e": round(e, 3),
                             "speaker": seg["speaker"]})

    tl = {"fps": FPS, "duration": DURATION, "mode": "elevenlabs" if real else "estimated",
          "pause_scale": round(k, 3), "segments": segments, "ending_start": ending_start,
          "captions": captions}
    (ROOT / "scene" / "timeline.json").write_text(json.dumps(tl, indent=1))
    print(f"mode={tl['mode']} pause_scale={k:.2f} last_line_end={last_end:.2f}s ending_start={ending_start:.2f}s")
    for seg in segments:
        print(f"  {seg['id']:>3} {seg['start']:6.2f}-{seg['end']:6.2f}  {seg['text']}")

    if real:
        track = np.zeros(int(SR * DURATION) + SR, dtype=np.float32)
        src = {"narrator": decode(AUDIO / "narrator.mp3"), "crush": decode(AUDIO / "crush.mp3")}
        gains = {}
        for name, x in src.items():
            rms = float(np.sqrt(np.mean(x[np.abs(x) > 0.01] ** 2)) + 1e-9)
            gains[name] = 0.16 / rms
        for seg in segments:
            x = src[seg["speaker"]][int(seg["src"]["cut_s"] * SR):int(seg["src"]["cut_e"] * SR)].copy()
            x = fade(x) * gains[seg["speaker"]]
            i = int(round(seg["start"] * SR))
            track[i:i + len(x)] += x
        track = track[:int(SR * DURATION)]
        peak = float(np.max(np.abs(track)))
        if peak > 0.95:
            track *= 0.95 / peak
        write_wav(AUDIO / "voice_track.wav", track)
        print("wrote audio/voice_track.wav")


def write_wav(path, x):
    import wave
    y = (np.clip(x, -1, 1) * 32767).astype(np.int16)
    with wave.open(str(path), "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes(y.tobytes())


if __name__ == "__main__":
    main()
