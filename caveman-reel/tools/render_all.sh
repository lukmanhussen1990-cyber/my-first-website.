#!/bin/bash
# Full 1080x1920 render in 3 parallel, resumable jobs.  usage: bash tools/render_all.sh
cd "$(dirname "$0")/.." && mkdir -p frames/full logs
node tools/render.mjs --out frames/full --range 0-527 --scale 1 --jpg --skip-existing > logs/j1.log 2>&1 &
node tools/render.mjs --out frames/full --range 528-1055 --scale 1 --jpg --skip-existing > logs/j2.log 2>&1 &
node tools/render.mjs --out frames/full --range 1056-1583 --scale 1 --jpg --skip-existing > logs/j3.log 2>&1 &
wait
echo "frames on disk: $(ls frames/full | wc -l) / 1584"
