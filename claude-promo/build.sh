#!/usr/bin/env bash
# Rebuilds claude-promo.mp4 from source:
#   1. renders 600 frames of src/ad.html with headless Chromium (Playwright)
#   2. synthesises the soundtrack from the animation's cue times
#   3. encodes H.264 + AAC
# Needs: node + playwright (with Chromium), python3 + numpy, ffmpeg.
set -euo pipefail
cd "$(dirname "$0")"

WORK="${WORK:-$(mktemp -d)}"
FPS="${FPS:-60}"
echo "working in $WORK"

node src/render.js --out "$WORK/frames" --fps "$FPS" --workers "${WORKERS:-4}"
node src/render.js --cues "$WORK/cues.json"
python3 src/music.py "$WORK/cues.json" "$WORK/soundtrack.wav"

# A light static dither keeps the soft gradients from banding once they are 8-bit 4:2:0.
ffmpeg -y -hide_banner -loglevel error \
  -framerate "$FPS" -i "$WORK/frames/%05d.png" -i "$WORK/soundtrack.wav" \
  -vf "noise=alls=2:allf=u,scale=out_color_matrix=bt709:out_range=tv,format=yuv420p" \
  -c:v libx264 -preset slow -crf 16 -tune grain -aq-mode 3 -profile:v high -level 4.2 -g 120 \
  -colorspace bt709 -color_primaries bt709 -color_trc bt709 -color_range tv \
  -c:a aac -b:a 192k -ar 48000 -movflags +faststart -shortest \
  claude-promo.mp4

ffmpeg -y -hide_banner -loglevel error -sseof -0.05 -i claude-promo.mp4 -frames:v 1 -q:v 3 poster.jpg
echo "wrote claude-promo.mp4 and poster.jpg"
