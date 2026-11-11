#!/usr/bin/env bash
# Rebuild the reel from scratch: soundtrack -> frames -> final MP4.
# Requires: python3 with skia-python, numpy, scipy, pillow; ffmpeg.
set -euo pipefail
cd "$(dirname "$0")/src"
python3 audio.py ../out/mix.wav
python3 render.py --out ../out/grace_gym_spotter_1080p.mp4
