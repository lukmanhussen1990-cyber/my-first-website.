#!/bin/bash
# Full pipeline: render frames (resumable), then export final.mp4 (1080x1920) and a 144p copy.
cd "$(dirname "$0")/.."
F=out/frames720
for i in 0 1 2; do node src/render.mjs $F 720 1280 $((i*210)) $(((i+1)*210)) > out/render_$i.log 2>&1 & done; wait
[ "$(ls $F/*.jpg | wc -l)" = "630" ] || { echo "frames missing" ; exit 1; }
src/export.sh $F out/final.mp4 1080 1920 18 && src/export.sh $F out/final_144p.mp4 144 256 20 && touch out/DONE
