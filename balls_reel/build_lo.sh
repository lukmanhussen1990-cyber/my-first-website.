#!/bin/bash
# Quick low-quality check: small 3D clips (4 groups in parallel) -> 2D effects at 30% -> build/check_lo.mp4
set -euo pipefail
cd "$(dirname "$0")"
start=$(date +%s)
pids=()
while read -r g; do
  [ -z "$g" ] && continue
  (NO_STILLS=1 CLIP_SCALE=0.25 CLIPS_OUT=build/clips_lo node render_scene.mjs $g > "build/lo_${g// /_}.log" 2>&1) & pids+=($!)
done < build/groups.txt
for p in "${pids[@]}"; do wait "$p"; done
echo "3D clips done $(( $(date +%s) - start ))s"
CLIPS_DIR=build/clips_lo JOBS=4 python3 render.py --preview 0.3 > build/render_lo.log 2>&1
echo "2D done $(( $(date +%s) - start ))s"
N=$(python3 -c "import json;print(len(json.load(open('shots.json'))['shots']))")
DUR=$(python3 -c "import json;print(json.load(open('shots.json'))['duration'])")
: > build/concat.txt
for i in $(seq 1 $N); do echo "file 'seg_$(printf %02d $i).mp4'" >> build/concat.txt; done
if [ -f audio/mix_final.wav ]; then IN=(-i audio/mix_final.wav); else IN=(-f lavfi -i anullsrc=r=48000:cl=stereo); fi
ffmpeg -v error -y -f concat -safe 0 -i build/concat.txt "${IN[@]}" -t "$DUR" -vf "subtitles=audio/captions.ass:fontsdir=fonts" \
  -c:v libx264 -preset fast -crf 22 -pix_fmt yuv420p -r 30 -c:a aac -b:a 128k -movflags +faststart build/check_lo.mp4
echo "ALL DONE $(( $(date +%s) - start ))s"
