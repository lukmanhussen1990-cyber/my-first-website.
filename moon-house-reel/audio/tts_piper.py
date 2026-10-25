"""Local fallback narrator: Piper TTS with exact word timings.

Usage:  python audio/tts_piper.py [--voice en_US-ryan-high] [--speed 1.08]

Writes voice/line_XX.wav (48 kHz mono) and voice/timings.json.
Word times come from Piper's own phoneme alignments, so they match the audio
sample-for-sample; they are mapped back onto the exact words of the script.
"""
import argparse
import difflib
import os
import subprocess
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import (ROOT, SR, VOICE_DIR, display_words, load_script, norm,  # noqa: E402
                    save_timings, write_wav)

VOICE_URL = "https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/{spk}/{q}/{name}.onnx"
SKIP = set("ˈˌ^$_ ,.!?;:-—'\"()")


def ensure_voice(name):
    d = os.path.join(ROOT, "tools", "piper_voices")
    os.makedirs(d, exist_ok=True)
    path = os.path.join(d, name + ".onnx")
    if not os.path.exists(path):
        _, spk, q = name.split("-")
        url = VOICE_URL.format(spk=spk, q=q, name=name)
        for suffix in ("", ".json"):
            subprocess.run(["curl", "-sSL", "-o", path + suffix, url + suffix], check=True)
    return path


def phone_stream(chunks, pause):
    """Concatenate sentence chunks; return audio and [(phoneme_char, t0, t1)]."""
    audio, stream, t = [], [], 0.0
    sr = chunks[0].sample_rate
    for i, c in enumerate(chunks):
        if i > 0:
            gap = np.zeros(int(pause * sr), dtype=np.float32)
            audio.append(gap)
            t += len(gap) / sr
        pos = 0
        for a in c.phoneme_alignments:
            dur = int(a.num_samples)
            for ch in a.phoneme:
                if ch not in SKIP:
                    stream.append((ch, t + pos / sr, t + (pos + dur) / sr))
            pos += dur
        audio.append(c.audio_float_array.astype(np.float32))
        t += len(c.audio_float_array) / sr
    return np.concatenate(audio), sr, stream


def map_words(voice, words, stream):
    """Align the script words to the phoneme stream (handles espeak merging words)."""
    wchars, owner = [], []
    for wi, w in enumerate(words):
        ph = "".join("".join(s) for s in voice.phonemize(w))
        for ch in ph:
            if ch not in SKIP:
                wchars.append(ch)
                owner.append(wi)
    schars = [s[0] for s in stream]
    sm = difflib.SequenceMatcher(None, wchars, schars, autojunk=False)
    hit = {}
    for tag, i1, i2, j1, j2 in sm.get_opcodes():
        if tag in ("equal", "replace"):
            n = min(i2 - i1, j2 - j1)
            for k in range(n):
                hit.setdefault(owner[i1 + k], []).append(j1 + k)
    out = []
    for wi, w in enumerate(words):
        js = hit.get(wi)
        if js:
            out.append([stream[min(js)][1], stream[max(js)][2]])
        else:
            out.append(None)
    # fill any unmatched word by interpolating between neighbours
    for wi in range(len(out)):
        if out[wi] is None:
            prev_end = out[wi - 1][1] if wi > 0 and out[wi - 1] else stream[0][1]
            nxt = next((o for o in out[wi + 1:] if o), None)
            nxt_start = nxt[0] if nxt else stream[-1][2]
            out[wi] = [prev_end, max(prev_end + 0.05, nxt_start)]
    return [{"text": w, "start": round(a, 3), "end": round(b, 3)} for w, (a, b) in zip(words, out)]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--voice", default="en_US-ryan-high")
    ap.add_argument("--speed", type=float, default=1.08, help=">1 = faster")
    ap.add_argument("--pause", type=float, default=0.32, help="pause between sentences (s)")
    args = ap.parse_args()

    from piper import PiperVoice, SynthesisConfig
    voice = PiperVoice.load(ensure_voice(args.voice), include_alignments=True)
    cfg = SynthesisConfig(length_scale=1.0 / args.speed, noise_scale=0.6, noise_w_scale=0.75)
    os.makedirs(VOICE_DIR, exist_ok=True)
    lines = []
    for ln in load_script()["lines"]:
        chunks = list(voice.synthesize(ln["text"], cfg, include_alignments=True))
        audio, sr, stream = phone_stream(chunks, args.pause)
        words = map_words(voice, display_words(ln["text"]), stream)
        # resample to 48 kHz with ffmpeg (soxr) for the mix
        raw = subprocess.run(
            ["ffmpeg", "-v", "error", "-f", "f32le", "-ar", str(sr), "-ac", "1", "-i", "-",
             "-af", "aresample=resampler=soxr", "-ar", str(SR), "-f", "f32le", "-"],
            input=audio.tobytes(), capture_output=True, check=True).stdout
        a48 = np.frombuffer(raw, dtype=np.float32)
        lead = 0.05
        a48 = np.concatenate([np.zeros(int(lead * SR), np.float32), a48, np.zeros(int(0.12 * SR), np.float32)])
        for w in words:
            w["start"] = round(w["start"] + lead, 3)
            w["end"] = round(w["end"] + lead, 3)
        peak = np.max(np.abs(a48)) or 1.0
        a48 = a48 / peak * 0.89
        path = os.path.join(VOICE_DIR, ln["id"] + ".wav")
        write_wav(path, a48)
        dur = len(a48) / SR
        lines.append({"id": ln["id"], "scene": ln["scene"], "text": ln["text"],
                      "file": os.path.relpath(path, ROOT), "duration": round(dur, 3), "words": words})
        print(f"{ln['id']}: {dur:.2f}s  " + " ".join(f"{w['text']}@{w['start']:.2f}" for w in words))
    save_timings("piper:" + args.voice, lines)


if __name__ == "__main__":
    main()
