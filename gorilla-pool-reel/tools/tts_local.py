#!/usr/bin/env python3
"""Local fallback narrator (Kokoro-82M via kokoro-onnx). Writes voice/lineNN.wav.

Used when ElevenLabs is unavailable. Model files are downloaded once into
~/.cache/gorilla-reel/ (about 350 MB).
"""
import json, os, sys, urllib.request
from pathlib import Path
import numpy as np
import soundfile as sf

ROOT = Path(__file__).resolve().parent.parent
CACHE = Path(os.environ.get("GORILLA_REEL_CACHE", Path.home() / ".cache" / "gorilla-reel"))
BASE = "https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/"
VOICE = os.environ.get("KOKORO_VOICE", "af_heart")
SPEED = float(os.environ.get("KOKORO_SPEED", "1.1"))


def fetch(name):
    CACHE.mkdir(parents=True, exist_ok=True)
    p = CACHE / name
    if not p.exists():
        print("downloading", name)
        urllib.request.urlretrieve(BASE + name, p)
    return p


def main():
    from kokoro_onnx import Kokoro
    script = json.loads((ROOT / "script" / "voiceover.json").read_text())
    tts = Kokoro(str(fetch("kokoro-v1.0.onnx")), str(fetch("voices-v1.0.bin")))
    out = ROOT / "voice"
    out.mkdir(exist_ok=True)
    only = set(sys.argv[1:])
    for line in script["lines"]:
        if only and line["id"] not in only:
            continue
        samples, sr = tts.create(line["text"], voice=VOICE, speed=SPEED, lang="en-us")
        samples = np.asarray(samples, dtype=np.float32)
        # trim leading/trailing silence, keep 40 ms padding
        thr = 0.01 * np.max(np.abs(samples))
        idx = np.where(np.abs(samples) > thr)[0]
        a, b = max(0, idx[0] - int(0.04 * sr)), min(len(samples), idx[-1] + int(0.08 * sr))
        samples = samples[a:b]
        samples *= 0.89 / max(1e-6, np.max(np.abs(samples)))
        sf.write(out / f"{line['id']}.wav", samples, sr, subtype="PCM_16")
        print(f"{line['id']}: {len(samples)/sr:.2f}s  {line['text']}")
    (out / "SOURCE.txt").write_text(f"local Kokoro-82M voice '{VOICE}' speed {SPEED}\n")


if __name__ == "__main__":
    main()
