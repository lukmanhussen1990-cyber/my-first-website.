#!/usr/bin/env bash
# ./make.sh preview [--w 270 --h 480]  -> ../golden_toilet_reel_preview.mp4  (quick, low quality)
# ./make.sh full                       -> ../golden_toilet_reel.mp4          (1080x1920, 30fps)
# Timing comes from your voiceover: transcribe.py (once, local faster-whisper) -> align.py -> timeline.py
set -euo pipefail
cd "$(dirname "$0")"
MODE="${1:-preview}"
python3 align.py
python3 timeline.py
python3 sfx.py
python3 mix.py
if [ "$MODE" = "full" ]; then
  node render.js --full --out build/video_full.mp4
  ffmpeg -v error -y -i build/video_full.mp4 -i build/mix.wav -map 0:v -map 1:a -c:v copy -c:a aac -b:a 192k -movflags +faststart ../golden_toilet_reel.mp4
  echo "-> $(cd .. && pwd)/golden_toilet_reel.mp4"
else
  node render.js --preview --out build/video_preview.mp4 "${@:2}"
  ffmpeg -v error -y -i build/video_preview.mp4 -i build/mix.wav -map 0:v -map 1:a -c:v copy -c:a aac -b:a 128k -movflags +faststart ../golden_toilet_reel_preview.mp4
  echo "-> $(cd .. && pwd)/golden_toilet_reel_preview.mp4"
fi
