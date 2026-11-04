#!/bin/bash
# Full-quality build: 3D clips (4 groups in parallel) -> 2D effects -> final.mp4 (H.264 CRF 16, AAC 192k)
set -euo pipefail
cd "$(dirname "$0")"
start=$(date +%s)
mkdir -p build
pids=()
while read -r g; do
  [ -z "$g" ] && continue
  (NO_STILLS=1 node render_scene.mjs $g > "build/full_${g// /_}.log" 2>&1) & pids+=($!)
done < build/groups.txt
for p in "${pids[@]}"; do wait "$p"; done
echo "3D clips done $(( $(date +%s) - start ))s"
JOBS=4 python3 render.py > build/render_full.log 2>&1
echo "2D effects done $(( $(date +%s) - start ))s"
SKIP_AUDIO=1 SKIP_RENDER=1 ./make_reel.sh
cp final.mp4 ../balls_double_reel.mp4
echo "ALL DONE $(( $(date +%s) - start ))s"
