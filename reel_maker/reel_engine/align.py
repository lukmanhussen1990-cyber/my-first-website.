"""Word-level timestamps for the finished voice.wav.

Two independent sources are computed for every script word:
  * whisper  — faster-whisper `word_timestamps=True` on the final voice.wav
  * model    — Kokoro's own predicted phoneme durations, shifted by the decoder
               latency (3 duration frames = 75 ms, the same correction Kokoro's
               reference pipeline applies to its timestamps)

Measured on this voiceover, model timing lands within ~±30 ms of the audible
word onsets, while whisper-base drifts by up to ~0.5 s around pauses (it
absorbs the silence before a word into that word). `timing="model"` therefore
drives captions and scene starts, and whisper verifies that every word is
actually heard. Set `timing="whisper"` in the config to use whisper instead.
"""
from __future__ import annotations

import difflib
import re

import numpy as np

MODEL_LATENCY = 0.075
_NUM = {"30": "thirty", "1": "one", "2": "two", "3": "three"}


def norm(word: str) -> str:
    w = re.sub(r"[^a-z0-9']", "", word.lower().replace("’", "'"))
    return _NUM.get(w, w)


def whisper_words(audio_16k: np.ndarray, model_dir: str):
    from faster_whisper import WhisperModel
    model = WhisperModel(model_dir, device="cpu", compute_type="int8")
    segments, _ = model.transcribe(audio_16k, language="en", word_timestamps=True, beam_size=5,
                                   condition_on_previous_text=False)
    return [{"word": w.word.strip(), "start": float(w.start), "end": float(w.end), "p": float(w.probability)}
            for s in segments for w in s.words]


def align(script_words: list[dict], heard: list[dict], sentence_spans: list[tuple[float, float]],
          timing: str = "model", max_drift: float = 0.12):
    """script_words: [{text, sentence, start, end}] with raw model timings.
    Returns (words with final start/end, report)."""
    merged = []
    for h in heard:  # whisper splits hyphenated words: "t" + "-shirt"
        if merged and h["word"].startswith("-"):
            merged[-1] = dict(merged[-1], word=merged[-1]["word"] + h["word"], end=h["end"])
        else:
            merged.append(h)
    heard = merged
    a = [norm(w["text"]) for w in script_words]
    b = [norm(w["word"]) for w in heard]
    match = {}
    for blk in difflib.SequenceMatcher(a=a, b=b, autojunk=False).get_matching_blocks():
        for k in range(blk.size):
            match[blk.a + k] = blk.b + k

    out, drifts, not_heard, overruled = [], [], [], []
    for i, w in enumerate(script_words):
        s0, s1 = sentence_spans[w["sentence"]]
        ms = min(max(w["start"] - MODEL_LATENCY, s0), s1)
        me = min(max(w["end"] - MODEL_LATENCY, ms + 0.05), s1)
        w = dict(w, model_start=round(ms, 3), model_end=round(me, 3), start=ms, end=me, source="model")
        j = match.get(i)
        if j is None:
            not_heard.append(w["text"])
        else:
            hs, he = heard[j]["start"], heard[j]["end"]
            w.update(whisper_start=hs, whisper_end=he, whisper_p=heard[j]["p"])
            drifts.append(hs - ms)
            if timing == "whisper":
                if abs(hs - ms) <= max_drift and abs(he - me) <= max_drift:
                    w.update(start=hs, end=he, source="whisper")
                else:
                    overruled.append(w["text"])
        out.append(w)

    for k in range(1, len(out)):  # monotonic, non-overlapping
        if out[k]["start"] < out[k - 1]["end"]:
            out[k - 1]["end"] = max(out[k - 1]["start"] + 0.03, out[k]["start"])
    d = np.abs(np.array(drifts)) if drifts else np.array([0.0])
    report = {
        "timing_source": timing,
        "words": len(out),
        "heard_by_whisper": len(drifts),
        "not_heard": not_heard,
        "whisper_vs_model_start_drift_s": {"median": round(float(np.median(d)), 3),
                                           "p90": round(float(np.percentile(d, 90)), 3),
                                           "max": round(float(d.max()), 3)},
        "whisper_overruled_by_model": overruled,
    }
    return out, report
