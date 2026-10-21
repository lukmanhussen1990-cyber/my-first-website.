#!/usr/bin/env bash
# Full pipeline from scratch (the 3D render takes a few hours on CPU).
#   ./make_all.sh            -> local voice (Kokoro), render, mix, subtitles, export
set -euo pipefail
cd "$(dirname "$0")"
(cd render && npm install --no-audit --no-fund && node tools/export_cues.mjs)
python3 tools/tts_local.py
python3 tools/align_words.py
python3 tools/build_audio.py
python3 tools/make_subtitles.py
./render/render_all.sh                 # renders every frame -> output/video_clean.mp4
python3 tools/export_video.py
