#!/usr/bin/env python3
"""Word timings for the subtitles.

Every subtitle word comes from script.json (so spelling always matches the
script). Only the *timing* comes from the audio, best source first:
  1. ElevenLabs voices: the character timestamps saved by voices_elevenlabs.py
     (voices/<id>.alignment.json).
  2. Local Kokoro voices: the model's own phoneme durations
     (voices/<id>.timing.json, written by voices_local.py).
  3. Any other audio you drop into voices/ (e.g. downloaded by hand):
     faster-whisper word timestamps, matched letter-by-letter to the script.

Usage:  python3 tools/align_words.py        -> writes build/words.json
"""
import difflib
import json
import os
import re
import sys

import numpy as np
import soundfile as sf

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WHISPER_DIR = os.environ.get("WHISPER_MODEL", "/opt/tts/fw-small.en")


def letters(s):
    return re.sub(r"[^a-z0-9]", "", s.lower())


def display_tokens(text):
    """Script words as they appear on screen (spelling untouched)."""
    return text.split()


def align_tokens(text, timed_chars):
    """Map script words onto a stream of (letter, start, end) tuples.

    timed_chars come from the audio (whisper words or ElevenLabs characters);
    they may be spelled slightly differently, so we align letters with difflib
    and give each script word the time of its first/last matched letter.
    """
    tokens = display_tokens(text)
    script_chars, owner = [], []
    for i, tok in enumerate(tokens):
        for ch in letters(tok):
            script_chars.append(ch)
            owner.append(i)
    audio_chars = "".join(c for c, _, _ in timed_chars)
    sm = difflib.SequenceMatcher(None, "".join(script_chars), audio_chars, autojunk=False)
    starts = [None] * len(tokens)
    ends = [None] * len(tokens)
    for a, b, n in sm.get_matching_blocks():
        for k in range(n):
            w = owner[a + k]
            _, t0, t1 = timed_chars[b + k]
            if starts[w] is None or t0 < starts[w]:
                starts[w] = t0
            if ends[w] is None or t1 > ends[w]:
                ends[w] = t1
    # Fill any unmatched word by interpolating between neighbours.
    known = [i for i in range(len(tokens)) if starts[i] is not None]
    if not known:
        raise RuntimeError("could not align any words for: " + text)
    for i in range(len(tokens)):
        if starts[i] is None:
            prev = max([k for k in known if k < i], default=None)
            nxt = min([k for k in known if k > i], default=None)
            if prev is None:
                starts[i] = ends[i] = starts[nxt]
            elif nxt is None:
                starts[i] = ends[i] = ends[prev]
            else:
                f = (i - prev) / (nxt - prev)
                starts[i] = ends[i] = ends[prev] + f * (starts[nxt] - ends[prev])
    return [{"word": tok, "start": round(float(s), 3), "end": round(float(e), 3)}
            for tok, s, e in zip(tokens, starts, ends)]


def onset_refine(words, path):
    """Nudge each word start to the nearest rise in loudness (within 80 ms)."""
    audio, sr = sf.read(path, dtype="float32")
    if audio.ndim > 1:
        audio = audio.mean(axis=1)
    hop = int(sr * 0.005)
    env = np.sqrt(np.convolve(audio ** 2, np.ones(hop * 4) / (hop * 4), mode="same")[::hop] + 1e-10)
    db = 20 * np.log10(env)
    rise = np.diff(db, prepend=db[0])
    for i, w in enumerate(words):
        c = int(w["start"] / 0.005)
        lo, hi = max(0, c - 16), min(len(rise) - 1, c + 16)
        if hi <= lo:
            continue
        j = lo + int(np.argmax(rise[lo:hi]))
        if rise[j] > 1.5:
            t = j * 0.005
            prev_end = words[i - 1]["end"] if i else 0.0
            if t >= prev_end - 0.12:
                w["start"] = round(t, 3)
    return words


def whisper_chars(path, prompt):
    from faster_whisper import WhisperModel
    global _MODEL
    from scipy.signal import resample_poly
    if "_MODEL" not in globals():
        _MODEL = WhisperModel(WHISPER_DIR, device="cpu", compute_type="int8")
    audio, sr = sf.read(path, dtype="float32")
    if audio.ndim > 1:
        audio = audio.mean(axis=1)
    g = np.gcd(sr, 16000)
    audio16 = resample_poly(audio, 16000 // g, sr // g).astype(np.float32)
    # Half a second of silence on both sides helps whisper place the first/last word.
    pad = np.zeros(8000, dtype=np.float32)
    segments, _ = _MODEL.transcribe(np.concatenate([pad, audio16, pad]), language="en",
                                    word_timestamps=True, beam_size=5,
                                    initial_prompt=prompt, vad_filter=False)
    timed, heard = [], []
    for seg in segments:
        for w in seg.words:
            heard.append(w.word.strip())
            ls = letters(w.word)
            ws, we = w.start - 0.5, w.end - 0.5  # remove the padding added above
            for k, ch in enumerate(ls):
                t0 = ws + (we - ws) * k / max(1, len(ls))
                t1 = ws + (we - ws) * (k + 1) / max(1, len(ls))
                timed.append((ch, t0, t1))
    return timed, " ".join(heard)


def elevenlabs_chars(alignment):
    timed = []
    for ch, t0, t1 in zip(alignment["characters"], alignment["character_start_times_seconds"],
                          alignment["character_end_times_seconds"]):
        ls = letters(ch)
        if ls:
            timed.append((ls, t0, t1))
    return timed


def main():
    script = json.load(open(os.path.join(ROOT, "script.json")))
    out = {"source": {}, "lines": {}}
    for line in script["lines"]:
        wav = os.path.join(ROOT, "voices", f"{line['id']}.wav")
        align_path = os.path.join(ROOT, "voices", f"{line['id']}.alignment.json")
        timing_path = os.path.join(ROOT, "voices", f"{line['id']}.timing.json")
        if os.path.exists(align_path):
            words = align_tokens(line["text"], elevenlabs_chars(json.load(open(align_path))))
            out["source"][line["id"]] = "elevenlabs-timestamps"
            heard = "(elevenlabs alignment)"
        elif os.path.exists(timing_path):
            words = json.load(open(timing_path))["words"]
            assert [w["word"] for w in words] == display_tokens(line["text"]), f"{timing_path} is stale"
            out["source"][line["id"]] = "tts-phoneme-durations"
            heard = "(local TTS timing)"
        else:
            timed, heard = whisper_chars(wav, line["text"])
            words = onset_refine(align_tokens(line["text"], timed), wav)
            out["source"][line["id"]] = "faster-whisper"
        dur = sf.info(wav).duration
        out["lines"][line["id"]] = {"duration": round(dur, 3), "words": words}
        print(f"{line['id']} ({dur:.2f}s) heard: {heard}")
        print("    " + "  ".join(f"{w['word']}@{w['start']:.2f}" for w in words))
    os.makedirs(os.path.join(ROOT, "build"), exist_ok=True)
    json.dump(out, open(os.path.join(ROOT, "build", "words.json"), "w"), indent=1)


if __name__ == "__main__":
    sys.exit(main())
