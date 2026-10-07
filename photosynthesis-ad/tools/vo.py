"""Generate the voiceover clips with Kokoro-82M (ONNX), voice af_heart.

usage: python vo.py <kokoro_dir> <out_dir>
<kokoro_dir> must contain model.onnx and voices.npz (built from the
onnx-community/Kokoro-82M-v1.0-ONNX voice tensors).
Writes one WAV per phrase plus vo_timing.json (start time on the timeline).
"""
import json
import os
import sys

import numpy as np
import soundfile as sf
from kokoro_onnx import Kokoro

VOICE = "af_heart"

# (id, text, start time in seconds, speed)
LINES = [
    ("l1", "Can sunlight become food?", 0.50, 0.96),
    ("l2", "For a plant, it happens every day.", 3.30, 0.96),
    ("l3a", "Roots absorb water.", 7.25, 0.98),
    ("l3b", "Leaves take in carbon dioxide.", 8.75, 0.98),
    ("l4", "Using light energy, the plant makes sugar and releases oxygen.", 11.55, 1.0),
    ("l5a", "Food for growth.", 16.70, 0.96),
    ("l5b", "Oxygen for the air.", 18.00, 0.96),
    ("l6a", "Photosynthesis.", 21.30, 0.95),
    ("l6b", "Powered by sunlight.", 22.50, 0.95),
]


def main():
    kdir, out = sys.argv[1], sys.argv[2]
    os.makedirs(out, exist_ok=True)
    k = Kokoro(os.path.join(kdir, "model.onnx"), os.path.join(kdir, "voices.npz"))
    timing = []
    for lid, text, start, speed in LINES:
        audio, sr = k.create(text, voice=VOICE, speed=speed, lang="en-us")
        audio = np.asarray(audio, dtype=np.float32)
        # trim residual silence so the start time is the first sound
        thr = 0.01 * np.abs(audio).max()
        nz = np.flatnonzero(np.abs(audio) > thr)
        audio = audio[max(0, nz[0] - int(0.01 * sr)): nz[-1] + int(0.06 * sr)]
        fn = os.path.join(out, f"{lid}.wav")
        sf.write(fn, audio, sr)
        timing.append({"id": lid, "text": text, "start": start, "dur": round(len(audio) / sr, 3), "sr": sr})
        print(f"{lid:4s} {start:6.2f}s +{len(audio)/sr:.2f}s  {text}")
    with open(os.path.join(out, "vo_timing.json"), "w") as f:
        json.dump(timing, f, indent=1)


if __name__ == "__main__":
    main()
