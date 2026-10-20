#!/usr/bin/env bash
# Full build of the reel: timeline -> sound -> captions -> frames -> MP4.
#   SPP=8 JOBS=2 ./make_reel.sh
# Needs: node + playwright (Chromium), ffmpeg with libass/libx264, and a
# python with numpy scipy soundfile pillow (PY=/path/to/python).
set -euo pipefail
cd "$(dirname "$0")"
PY=${PY:-python3}
SPP=${SPP:-8}
JOBS=${JOBS:-2}
OUT=${OUT:-secret-tunnel.mp4}

node tools/export_timeline.mjs
"$PY" tools/audio.py
"$PY" tools/captions.py

FRAMES=$(node -e "import('./src/timeline.js').then(m => console.log(Math.round(m.DURATION * m.FPS)))")
: > build/parts.txt
pids=()
for ((j = 0; j < JOBS; j++)); do
  f0=$((FRAMES * j / JOBS)); f1=$((FRAMES * (j + 1) / JOBS))
  node render.mjs video "$f0" "$f1" "build/part$j.mp4" --spp "$SPP" > "build/part$j.log" 2>&1 &
  pids+=($!)
  echo "file 'part$j.mp4'" >> build/parts.txt
done
for p in "${pids[@]}"; do wait "$p"; done

ffmpeg -v error -y -f concat -safe 0 -i build/parts.txt -c copy build/video.mp4
ffmpeg -v error -y -i build/video.mp4 -i build/mix.wav \
  -vf "ass=build/captions.ass:fontsdir=assets" \
  -map 0:v -map 1:a -c:v libx264 -preset slow -crf 17 -profile:v high -level 4.1 -pix_fmt yuv420p \
  -r 24 -g 48 -c:a aac -b:a 192k -ar 48000 -movflags +faststart -shortest "$OUT"
echo "done -> $OUT"
