#!/usr/bin/env python3
"""Word times of the user's own recording with faster-whisper (free, runs locally, no paid API).

Whisper on a whole 80 s file can drift, so the recording is first split into its speech parts (found from the
pauses: 5 ms loudness frames, a pause = at least 0.22 s below the silence level), then every part is transcribed on
its own with word timestamps. Nothing in the audio is changed.
Usage:  python3 stt_parts.py audio/raw/my_voiceover.mp3
Writes: audio/raw/my_voiceover.parts.json  {"parts": [[start, end], ...], "words": [{"w", "s", "e", "p", "part"}]}
"""
import json
import subprocess
import sys

import numpy as np
from faster_whisper import WhisperModel

SR = 16000
path = sys.argv[1]
x = np.frombuffer(subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-ac", "1", "-ar", str(SR), "-f", "f32le", "-"],
                                 capture_output=True, check=True).stdout, np.float32).copy()
hop = int(0.005 * SR)
nf = len(x) // hop
db = 20 * np.log10(np.sqrt(np.mean(x[:nf * hop].reshape(nf, hop) ** 2, axis=1)) + 1e-9)
db = np.convolve(db, np.ones(5) / 5, mode="same")
thr = np.percentile(db, 95) - 36
on = db > thr
# close short gaps (< 0.22 s), drop tiny blips (< 0.08 s)
parts, i = [], 0
while i < nf:
    if on[i]:
        j = i
        while j < nf and (on[j] or (j + 44 < nf and on[j:j + 44].any())):
            j += 1
        if (j - i) * 0.005 >= 0.08:
            parts.append([round(max(0, i * 0.005 - 0.04), 3), round(min(len(x) / SR, j * 0.005 + 0.06), 3)])
        i = j
    else:
        i += 1
print(f"{len(parts)} speech parts, threshold {thr:.1f} dBFS")
model = WhisperModel("medium.en", device="cpu", compute_type="int8")
words = []
for k, (a, b) in enumerate(parts):
    pad = 0.25
    a0 = max(0.0, a - pad)
    seg = x[int(a0 * SR):int((b + pad) * SR)]
    segs, _ = model.transcribe(seg, language="en", word_timestamps=True, beam_size=5, vad_filter=False,
                               condition_on_previous_text=False)
    ws = [w for s in segs for w in (s.words or [])]
    for w in ws:
        words.append({"w": w.word.strip(), "s": round(a0 + w.start, 3), "e": round(a0 + w.end, 3),
                      "p": round(w.probability, 3), "part": k})
    print(f"{k:2d} {a:6.2f}-{b:6.2f}  " + " ".join(w.word.strip() for w in ws), flush=True)
json.dump({"parts": parts, "words": words}, open(path.rsplit(".", 1)[0] + ".parts.json", "w"), indent=0)
