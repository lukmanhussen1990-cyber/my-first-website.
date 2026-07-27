#!/usr/bin/env python3
"""Synthesize the narration clips and emit their measured durations.

The animation timeline is built around the *real* length of each spoken line,
so this script runs first and writes build/narration.json for scene.html and
music.py to consume.
"""

import json
import os
import wave

from piper import PiperVoice, SynthesisConfig

VOICE = os.environ.get("PIPER_VOICE", "/tmp/piper_voices/en_US-lessac-high.onnx")
OUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "build", "vo")

# id, text, length_scale (>1 is slower / more deliberate)
LINES = [
    ("l1", "Imagine we have two objects.", 1.03),
    ("l2", "Now, we add two more.", 1.03),
    ("c1", "One.", 1.06),
    ("c2", "Two.", 1.06),
    ("c3", "Three.", 1.06),
    ("c4", "Four.", 1.06),
    ("l3a", "When two objects join two more objects, there are four objects altogether.", 0.99),
    ("l3b", "That is why two plus two equals four.", 1.0),
    ("l4", "Starting at two and moving forward two steps also brings us to four.", 0.99),
    ("l5", "Simple, visual, and always true: two plus two equals four.", 1.0),
]


def trim_silence(path, threshold=420, pad_ms=40):
    """Trim leading/trailing silence so clips can be placed on exact cues."""
    with wave.open(path, "rb") as w:
        params = w.getparams()
        frames = w.readframes(w.getnframes())

    import numpy as np

    data = np.frombuffer(frames, dtype=np.int16)
    loud = np.where(np.abs(data) > threshold)[0]
    if len(loud) == 0:
        return
    pad = int(params.framerate * pad_ms / 1000)
    start = max(0, loud[0] - pad)
    end = min(len(data), loud[-1] + pad)
    with wave.open(path, "wb") as w:
        w.setparams(params)
        w.writeframes(data[start:end].tobytes())


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    voice = PiperVoice.load(VOICE)

    manifest = {}
    for clip_id, text, length_scale in LINES:
        path = os.path.join(OUT_DIR, clip_id + ".wav")
        cfg = SynthesisConfig(length_scale=length_scale, noise_scale=0.667, noise_w_scale=0.8)
        with wave.open(path, "wb") as w:
            voice.synthesize_wav(text, w, syn_config=cfg)
        trim_silence(path)
        with wave.open(path, "rb") as w:
            duration = w.getnframes() / w.getframerate()
        manifest[clip_id] = {"text": text, "file": path, "duration": round(duration, 3)}
        print(f"{clip_id:5s} {duration:6.3f}s  {text}")

    out = os.path.join(os.path.dirname(OUT_DIR), "narration.json")
    with open(out, "w") as f:
        json.dump(manifest, f, indent=2)
    print("\ntotal speech:", round(sum(v["duration"] for v in manifest.values()), 2), "s")
    print("wrote", out)


if __name__ == "__main__":
    main()
