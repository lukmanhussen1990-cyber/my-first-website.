#!/usr/bin/env bash
# Render the whole film in scene-aligned lossless segments (skips segments that already exist).
set -e
cd "$(dirname "$0")/.."
mkdir -p build/seg
B=(0 198 402 606 804 1002 1212 1392 1590 1788 1980)
for i in $(seq 0 9); do
  out=build/seg/seg_$(printf %02d $i).mkv
  if [ -f "$out" ]; then echo "skip $out"; continue; fi
  node tools/render.mjs --frames ${B[$i]}:${B[$((i+1))]} --out "$out.tmp.mkv" && mv "$out.tmp.mkv" "$out"
done
echo ALL_DONE
