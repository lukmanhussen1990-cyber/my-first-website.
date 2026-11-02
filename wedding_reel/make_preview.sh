#!/bin/bash
# Quick half-size preview (540x960) from the small scene pictures in build/preview/ (no clips), real audio + captions.
set -euo pipefail
cd "$(dirname "$0")"
OUT=${OUT:-preview.mp4}
IMAGES_DIR=build/preview NO_CLIPS=1 JOBS=${JOBS:-4} python3 render.py --preview 0.5
N=$(python3 -c "import json;print(len(json.load(open('shots.json'))['shots']))")
DUR=$(python3 -c "import json;print(json.load(open('shots.json'))['duration'])")
: > build/concat.txt
for i in $(seq 1 $N); do echo "file 'seg_$(printf %02d $i).mp4'" >> build/concat.txt; done
ffmpeg -v error -y -f concat -safe 0 -i build/concat.txt -i audio/mix_final.wav -t "$DUR" \
  -vf "subtitles=audio/captions.ass:fontsdir=fonts" -c:v libx264 -preset fast -crf 24 -pix_fmt yuv420p -r 30 \
  -c:a aac -b:a 128k -movflags +faststart "$OUT"
ls -la "$OUT"
