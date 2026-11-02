#!/usr/bin/env python3
"""Check that captions match the voice: compares each caption's start with the
measured speech onset in audio/voice_track.wav, and checks that every stretch
of speech has a caption on screen."""
import json
import wave
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parent.parent
SR = 44100
HOP = 0.01

with wave.open(str(ROOT / "audio" / "voice_track.wav")) as w:
    x = np.frombuffer(w.readframes(w.getnframes()), np.int16).astype(np.float32) / 32768
n = int(HOP * SR)
db = 20 * np.log10(np.sqrt(np.mean(x[:len(x) // n * n].reshape(-1, n) ** 2, axis=1)) + 1e-9)
speech = db > np.percentile(db[db > -80], 95) - 30
tl = json.loads((ROOT / "scene" / "timeline.json").read_text())
caps = tl["captions"]

print(f"{'caption':30s} {'shown':>13s}  onset  offset")
worst = 0.0
prev_e = -1
for c in caps:
    if abs(c["s"] - prev_e) < 0.02:  # continues a sentence: compare with the nearest gap between words
        a = int((c["s"] - 0.2) / HOP); b = int((c["s"] + 0.2) / HOP)
        onset = (a + int(np.argmin(db[a:b]))) * HOP; kind = "word gap"
    else:                             # starts a sentence: compare with the speech onset
        a = int(max(0, c["s"] - 0.3) / HOP); b = int((c["s"] + 0.6) / HOP)
        idx = np.where(speech[a:b])[0]
        onset = (a + idx[0]) * HOP if len(idx) else float("nan"); kind = "onset"
    off = onset - c["s"]
    worst = max(worst, abs(off)) if off == off else worst
    print(f"{c['text'][:30]:30s} {c['s']:6.2f}-{c['e']:5.2f}  {onset:5.2f}  {off:+.2f}s  ({kind})")
    prev_e = c["e"]

covered = np.zeros(len(speech), bool)
for c in caps:
    covered[int(c["s"] / HOP):int(c["e"] / HOP)] = True
uncovered = np.where(speech & ~covered)[0]
print(f"\nworst caption-start offset: {worst:.2f}s")
print(f"speech frames without a caption: {len(uncovered)} ({len(uncovered) * HOP:.2f}s of {speech.sum() * HOP:.1f}s speech)")
