#!/usr/bin/env bash
# Full pipeline: render frames (headless Chromium + Three.js) -> mix audio -> encode MP4.
#   WORKERS=3 SCALE=1 bash tools/build.sh
set -euo pipefail
cd "$(dirname "$0")/.."
OUT=${OUT:-build}
WORKERS=${WORKERS:-3}
SCALE=${SCALE:-1}
mkdir -p "$OUT"
[ -d node_modules ] || npm install --no-audit --no-fund
node tools/render.mjs --out "$OUT/frames" --range 0:900 --workers "$WORKERS" --scale "$SCALE" --skip-existing
python3 tools/sfx.py assets/voiceover.mp3 "$OUT/mix.wav"
# Two-pass 10 Mbps: the per-pixel film grain is nearly incompressible, so a
# quality-based (CRF) encode balloons to ~250 MB for 30 s.
FINAL=${FINAL:-tooth_fairy_short.mp4}
ffmpeg -hide_banner -loglevel error -y -framerate 30 -i "$OUT/frames/f%05d.jpg" \
  -c:v libx264 -preset slow -b:v 10M -maxrate 14M -bufsize 20M -pix_fmt yuv420p -profile:v high \
  -pass 1 -passlogfile "$OUT/x264pass" -an -f mp4 /dev/null
ffmpeg -hide_banner -loglevel error -y -framerate 30 -i "$OUT/frames/f%05d.jpg" -i "$OUT/mix.wav" \
  -map 0:v -map 1:a -c:v libx264 -preset slow -b:v 10M -maxrate 14M -bufsize 20M -pix_fmt yuv420p -profile:v high \
  -pass 2 -passlogfile "$OUT/x264pass" -c:a aac -b:a 192k -ar 48000 -t 30 -movflags +faststart "$FINAL"
echo "wrote $FINAL"
