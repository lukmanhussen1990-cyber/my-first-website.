#!/usr/bin/env bash
# ./build.sh preview  -> tank_office_reel_preview.mp4 (270x480, quick)
# ./build.sh final    -> ../tank_office_reel.mp4     (1080x1920, 30fps)
# Never calls ElevenLabs: it only reuses the line files saved in audio/lines/.
set -euo pipefail
cd "$(dirname "$0")"
MODE="${1:-final}"
# lines generated without timestamps get a local alignment (no API calls)
if ls audio/lines/L*.mp3 >/dev/null 2>&1; then python3 tools/align_local.py; fi
python3 tools/build_timeline.py
node tools/render.js --dump scene/shots.json
python3 tools/mix.py
N=$(python3 -c "import json;print(json.load(open('scene/shots.json'))['events']['frames']-1)")
if [ "$MODE" = preview ]; then
  rm -rf frames_preview
  node tools/render.js --frames 0-$N --scale 0.25 --workers 4 --out frames_preview
  ffmpeg -y -v error -framerate 30 -i frames_preview/f_%05d.jpg -i audio/final_mix.wav -map 0:v -map 1:a \
    -c:v libx264 -preset medium -crf 27 -pix_fmt yuv420p -c:a aac -b:a 96k -shortest -movflags +faststart ../tank_office_reel_preview.mp4
  ffprobe -v error -show_entries format=duration:stream=width,height -of compact ../tank_office_reel_preview.mp4
else
  rm -rf frames
  node tools/render.js --frames 0-$N --workers "${WORKERS:-4}" --out frames
  ffmpeg -y -v error -framerate 30 -i frames/f_%05d.jpg -i audio/final_mix.wav -map 0:v -map 1:a \
    -c:v libx264 -preset slow -crf 18 -pix_fmt yuv420p -r 30 -af "loudnorm=I=-14:TP=-1.5:LRA=11" \
    -c:a aac -b:a 192k -ar 44100 -shortest -movflags +faststart ../tank_office_reel.mp4
  [ -f tools/check_sync.py ] && python3 tools/check_sync.py | tail -3
  ffprobe -v error -show_entries format=duration:stream=codec_name,width,height,r_frame_rate -of compact ../tank_office_reel.mp4
fi
