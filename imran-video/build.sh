#!/usr/bin/env bash
# Full build: render frames -> H.264, synthesize the soundtrack, mux into the final MP4.
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p out
DUR=$(python3 -c "import json;print(json.load(open('timeline.json'))['DURATION'])")
echo "duration: ${DUR}s"
node render.cjs --start 0 --end "$DUR" --fps 30 --video out/video_silent.mp4 --workers 3 --crf 14
python3 -I audio/score.py out/soundtrack.wav "$DUR"
ffmpeg -y -v error -i out/video_silent.mp4 -i out/soundtrack.wav \
  -c:v copy -c:a aac -b:a 192k -af "loudnorm=I=-15:TP=-1.0:LRA=9" -shortest -movflags +faststart \
  out/imran-i-got-you.mp4
ffprobe -v error -show_entries format=duration,size -of default=nw=1 out/imran-i-got-you.mp4
