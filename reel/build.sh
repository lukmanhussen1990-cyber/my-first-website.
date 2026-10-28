#!/usr/bin/env bash
# Full pipeline: timeline -> frames (Playwright) -> sound -> MP4 + cover.
set -euo pipefail
cd "$(dirname "$0")"
python3 plan.py > /dev/null            # timeline.json, js/timeline.js, vo_edit.wav
python3 make_lnum.py > /dev/null       # lining-figure copy of Cormorant Garamond
rm -rf frames && node render.js all 4  # frames/f_XXXXX.jpg
node render.js cover 8.9               # out/cover.png
python3 audio.py                       # mix.wav
./encode.sh
