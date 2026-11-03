#!/usr/bin/env bash
# Build the reel.   ./make.sh preview   -> ../sofa_divorce_reel_preview.mp4 (540x960, fast)
#                   ./make.sh full      -> ../sofa_divorce_reel.mp4         (1080x1920, 30fps)
# Voice files in audio/ are generated once by voice.py and only ever reused here.
set -euo pipefail
cd "$(dirname "$0")"
MODE="${1:-preview}"
python3 timeline.py
python3 sfx.py
python3 mix.py
if [ "$MODE" = "full" ]; then
  node render.js --full --out build/video_full.mp4
  ffmpeg -v error -y -i build/video_full.mp4 -i build/mix.wav -map 0:v -map 1:a -c:v copy -c:a aac -b:a 192k -movflags +faststart -shortest ../sofa_divorce_reel.mp4
  echo "-> $(cd .. && pwd)/sofa_divorce_reel.mp4"
else
  node render.js --preview --out build/video_preview.mp4 "${@:2}"
  ffmpeg -v error -y -i build/video_preview.mp4 -i build/mix.wav -map 0:v -map 1:a -c:v copy -c:a aac -b:a 128k -movflags +faststart -shortest ../sofa_divorce_reel_preview.mp4
  echo "-> $(cd .. && pwd)/sofa_divorce_reel_preview.mp4"
fi
