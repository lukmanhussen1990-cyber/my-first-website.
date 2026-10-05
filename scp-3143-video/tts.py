"""Generate narration clips with Kokoro TTS.

Reads narration.json, writes one trimmed WAV per line to build/voice/ and a
manifest (build/voice.json) with each clip's duration so the renderer can
time every scene to the narration.
"""
import json
import os
import sys

import numpy as np
import soundfile as sf
from kokoro_onnx import Kokoro

HERE = os.path.dirname(os.path.abspath(__file__))
BUILD = os.path.join(HERE, "build")
VOICE_DIR = os.path.join(BUILD, "voice")
MODELS = os.environ.get("KOKORO_DIR", os.path.join(HERE, "assets", "models"))


def trim(samples, sr, thresh=0.01, pad=0.04):
    """Strip leading/trailing silence, keeping a small pad."""
    idx = np.where(np.abs(samples) > thresh)[0]
    if len(idx) == 0:
        return samples
    p = int(pad * sr)
    return samples[max(0, idx[0] - p): min(len(samples), idx[-1] + p)]


def main():
    with open(os.path.join(HERE, "narration.json")) as f:
        script = json.load(f)
    os.makedirs(VOICE_DIR, exist_ok=True)
    kokoro = Kokoro(os.path.join(MODELS, "kokoro-v1.0.onnx"),
                    os.path.join(MODELS, "voices-v1.0.bin"))
    voice, speed = script["voice"], script.get("speed", 1.0)
    only = set(sys.argv[1:])  # optional: regenerate selected scene ids only

    manifest = {}
    old = os.path.join(BUILD, "voice.json")
    if only and os.path.exists(old):
        with open(old) as f:
            manifest = json.load(f)

    for scene in script["scenes"]:
        if only and scene["id"] not in only:
            continue
        for i, line in enumerate(scene["lines"]):
            key = f"{scene['id']}_{i}"
            samples, sr = kokoro.create(line.get("say", line["text"]),
                                        voice=voice, speed=speed, lang="en-us")
            samples = trim(np.asarray(samples, dtype=np.float32), sr)
            path = os.path.join(VOICE_DIR, key + ".wav")
            sf.write(path, samples, sr)
            manifest[key] = {"file": os.path.relpath(path, BUILD),
                             "duration": round(len(samples) / sr, 3), "sr": sr}
            print(f"{key:14s} {manifest[key]['duration']:6.2f}s  {line['text'][:60]}")

    with open(old, "w") as f:
        json.dump(manifest, f, indent=1)
    total = sum(v["duration"] for v in manifest.values())
    print(f"total speech: {total:.1f}s")


if __name__ == "__main__":
    main()
