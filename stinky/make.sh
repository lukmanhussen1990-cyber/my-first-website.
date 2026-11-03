#!/usr/bin/env bash
# ./make.sh preview [--w 270 --h 480]  -> ../stinky_date_reel_preview.mp4   (quick, low quality)
# ./make.sh full                       -> ../stinky_date_reel.mp4           (1080x1920, 30fps)
set -euo pipefail
cd "$(dirname "$0")"
MODE="${1:-preview}"
python3 timeline.py
python3 sfx.py
python3 music.py
python3 mix.py
if [ "$MODE" = "full" ]; then
  node render.js --full --out build/video_full.mp4
  ffmpeg -v error -y -i build/video_full.mp4 -i build/mix.wav -map 0:v -map 1:a -c:v copy -c:a aac -b:a 192k -movflags +faststart -shortest ../stinky_date_reel.mp4
  echo "-> $(cd .. && pwd)/stinky_date_reel.mp4"
else
  node render.js --preview --out build/video_preview.mp4 "${@:2}"
  ffmpeg -v error -y -i build/video_preview.mp4 -i build/mix.wav -map 0:v -map 1:a -c:v copy -c:a aac -b:a 128k -movflags +faststart -shortest ../stinky_date_reel_preview.mp4
  echo "-> $(cd .. && pwd)/stinky_date_reel_preview.mp4"
fi
