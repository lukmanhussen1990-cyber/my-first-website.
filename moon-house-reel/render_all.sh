#!/usr/bin/env bash
# Full build from scratch: local voice (Piper) -> render all 3D frames -> final video.
# The frame render takes ~1.5-2 h on 4 CPU cores (software WebGL, every frame rendered).
set -euo pipefail
cd "$(dirname "$0")"
[ -d node_modules/three ] || npm install
if [ ! -x .venv/bin/python ]; then python3 -m venv .venv; .venv/bin/pip install -q -r requirements.txt; fi
.venv/bin/python audio/tts_piper.py
node render/render.js --out build/frames --frames 0:1650 --workers 2 --resume
rm -f output/moon_house_clean.mp4 build/music.wav build/sfx.wav
./make_video.sh
