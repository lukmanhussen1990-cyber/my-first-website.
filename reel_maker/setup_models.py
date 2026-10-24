#!/usr/bin/env python3
"""Download the local models into models/ (run once on your computer).

Kokoro-82M v1.0 (Apache-2.0), ONNX export by onnx-community, plus voice files.
faster-whisper fetches its own model ("base") automatically on first run.
"""
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent
HF = "https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX/resolve/main"
VOICES = ["am_michael", "am_adam", "am_fenrir", "bm_george"] + sys.argv[1:]


def get(url, dest):
    dest.parent.mkdir(parents=True, exist_ok=True)
    if dest.exists():
        print("ok  ", dest.relative_to(ROOT))
        return
    print("get ", url)
    urllib.request.urlretrieve(url, dest)


get(f"{HF}/onnx/model.onnx", ROOT / "models/kokoro/model.onnx")
for v in VOICES:
    get(f"{HF}/voices/{v}.bin", ROOT / f"models/kokoro/voices/{v}.bin")
print("done. Optional for best pronunciation: python -m spacy download en_core_web_sm")
