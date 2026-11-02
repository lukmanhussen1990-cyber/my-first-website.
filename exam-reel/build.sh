#!/usr/bin/env bash
# Full build: timeline -> shot/event export -> audio mix -> frames -> exam_crush_reel.mp4
# Never calls ElevenLabs: it only reuses audio/*.mp3 + alignment saved by tools/voiceover.py.
set -euo pipefail
cd "$(dirname "$0")"
python3 tools/build_timeline.py
node tools/render.js --dump scene/shots.json
python3 tools/mix.py
rm -rf frames
node tools/render.js --frames 0-1349 --workers "${WORKERS:-4}" --out frames
ffmpeg -y -v error -framerate 30 -i frames/f_%05d.jpg -i audio/final_mix.wav \
  -map 0:v -map 1:a -c:v libx264 -preset slow -crf 18 -pix_fmt yuv420p -r 30 \
  -af "loudnorm=I=-14:TP=-1.5:LRA=11" -c:a aac -b:a 192k -ar 44100 -t 45 \
  -movflags +faststart ../exam_crush_reel.mp4
ffprobe -v error -show_entries format=duration:stream=codec_name,width,height,r_frame_rate -of compact ../exam_crush_reel.mp4
