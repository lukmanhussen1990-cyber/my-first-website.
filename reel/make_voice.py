"""Generate the Hindi voiceover line by line with exact word timestamps.

Uses Piper (offline neural TTS) with phoneme alignments, so every word's
start/end comes straight from the synthesiser rather than from ASR.

usage: python3 make_voice.py [voice] [length_scale]
"""
import json
import sys
import wave

import numpy as np
from piper import PiperVoice, SynthesisConfig

from script_data import LINES

VOICE = sys.argv[1] if len(sys.argv) > 1 else "pratham"
LENGTH_SCALE = float(sys.argv[2]) if len(sys.argv) > 2 else 1.05  # ~"-5%" rate

LEAD_IN = 0.30         # silence before the first word
PAUSE_ELLIPSIS = 0.35  # extra pause at "…" inside a line
PAUSE_LINE = 0.45      # pause between script lines
TAIL = 0.25            # silence after the last word

PUNCT = set(",.!?;:…।\"'-—")
MODEL = f"models/vits-piper-hi_IN-{VOICE}-medium/hi_IN-{VOICE}-medium.onnx"


def split_segments(hi_words, dev_words):
    """Split a line into segments after every word ending in an ellipsis."""
    segs, cur = [], []
    for h, d in zip(hi_words, dev_words):
        cur.append((h, d))
        if h.rstrip("\"'").endswith("…"):
            segs.append(cur)
            cur = []
    if cur:
        segs.append(cur)
    return segs


def synth_segment(voice, text, cfg):
    """Return (int16 audio, sample_rate, [(start_s, end_s), ...] per spoken word)."""
    chunks = list(voice.synthesize(text, cfg, include_alignments=True))
    sr = chunks[0].sample_rate
    audio, words, offset = [], [], 0
    for ch in chunks:
        pos = offset
        cur = None  # [start, end] of the word being read
        for al in ch.phoneme_alignments:
            p, n = al.phoneme, int(al.num_samples)
            if p in ("^", "$", "_") or p == " ":
                if p == " " and cur:
                    words.append(cur)
                    cur = None
            elif p in PUNCT:
                pass  # punctuation duration is pause, not part of the word
            else:
                if cur is None:
                    cur = [pos, pos + n]
                else:
                    cur[1] = pos + n
            pos += n
        if cur:
            words.append(cur)
        audio.append(ch.audio_int16_array)
        offset += len(ch.audio_int16_array)
    audio = np.concatenate(audio)
    return audio, sr, [(s / sr, e / sr) for s, e in words]


def energy_bounds(audio, sr, thresh=0.015):
    x = np.abs(audio.astype(np.float32) / 32768)
    win = int(sr * 0.01)
    env = np.convolve(x, np.ones(win) / win, mode="same")
    idx = np.where(env > thresh)[0]
    return (idx[0] / sr, idx[-1] / sr) if len(idx) else (0, len(audio) / sr)


def main():
    voice = PiperVoice.load(MODEL, include_alignments=True)
    cfg = SynthesisConfig(length_scale=LENGTH_SCALE)
    sr = voice.config.sample_rate

    pieces = [np.zeros(int(LEAD_IN * sr), np.int16)]
    t = LEAD_IN
    out_lines, warnings = [], []

    for li, (hi_en, dev, imgs) in enumerate(LINES, 1):
        hi_words, dev_words = hi_en.split(), dev.split()
        segs = split_segments(hi_words, dev_words)
        line_words = []
        for si, seg in enumerate(segs):
            text = " ".join(d for _, d in seg)
            audio, sr, wtimes = synth_segment(voice, text, cfg)
            if len(wtimes) != len(seg):
                # Fall back to spreading words by character count over the speech span.
                warnings.append(f"line {li} seg {si}: {len(wtimes)} timed words for {len(seg)} tokens")
                s0, s1 = energy_bounds(audio, sr)
                lens = np.array([len(d) for _, d in seg], float)
                edges = s0 + np.concatenate([[0], np.cumsum(lens)]) / lens.sum() * (s1 - s0)
                wtimes = list(zip(edges[:-1], edges[1:]))
            # Trim leading/trailing silence around the spoken words.
            e0, e1 = energy_bounds(audio, sr)
            start = max(0.0, min(wtimes[0][0], e0) - 0.03)
            end = min(len(audio) / sr, max(wtimes[-1][1], e1) + 0.06)
            clip = audio[int(start * sr):int(end * sr)]
            for (h, d), (ws, we) in zip(seg, wtimes):
                line_words.append({"w": h, "dev": d,
                                   "start": round(t + ws - start, 3),
                                   "end": round(t + we - start, 3)})
            pieces.append(clip)
            t += len(clip) / sr
            if si < len(segs) - 1:
                pieces.append(np.zeros(int(PAUSE_ELLIPSIS * sr), np.int16))
                t += PAUSE_ELLIPSIS
        out_lines.append({"line": li, "text": hi_en, "images": imgs,
                          "start": line_words[0]["start"], "end": line_words[-1]["end"],
                          "words": line_words})
        gap = PAUSE_LINE if li < len(LINES) else TAIL
        pieces.append(np.zeros(int(gap * sr), np.int16))
        t += gap

    audio = np.concatenate(pieces)
    with wave.open(f"build/voice_{VOICE}.wav", "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(sr)
        w.writeframes(audio.tobytes())
    meta = {"voice": VOICE, "length_scale": LENGTH_SCALE, "sample_rate": sr,
            "duration": round(len(audio) / sr, 3), "lines": out_lines}
    with open(f"build/timings_{VOICE}.json", "w") as f:
        json.dump(meta, f, ensure_ascii=False, indent=1)
    print(f"{VOICE}: {meta['duration']:.2f}s, {sum(len(l['words']) for l in out_lines)} words")
    for w in warnings:
        print("WARN", w)


if __name__ == "__main__":
    main()
