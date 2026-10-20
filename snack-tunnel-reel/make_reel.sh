#!/usr/bin/env bash
# Full build of the reel: timeline -> sound -> subtitles -> 3D frames -> MP4.
#   ./make_reel.sh                    (SPP=5 JOBS=3 by default)
# The voices are not remade here (they are files in assets/vo, see tools/voices.py
# and revoice.sh). The silent, subtitle-free render is kept as render/clean.mp4, so
# new voices or subtitles can be exported later without re-rendering the 3D.
# Each render job needs about 3 GB of memory at full size; the session limit here is
# ~14 GB, so keep JOBS at 3 or less.
# Needs: node + playwright (Chromium), ffmpeg with libass/libx264, and a python with
# numpy scipy soundfile pillow (PY=/path/to/python).
set -euo pipefail
cd "$(dirname "$0")"
PY=${PY:-/home/user/reel-venv/bin/python}
SPP=${SPP:-5}
JOBS=${JOBS:-3}

node tools/export_timeline.mjs
"$PY" tools/audio.py
"$PY" tools/captions.py

FRAMES=$(node -e "import('./src/timeline.js').then(m => console.log(Math.round(m.DURATION * m.FPS)))")
mkdir -p build render
pids=()
inputs=()
for ((j = 0; j < JOBS; j++)); do
  f0=$((FRAMES * j / JOBS)); f1=$((FRAMES * (j + 1) / JOBS))
  node render.mjs video "$f0" "$f1" "build/part$j.mp4" --spp "$SPP" > "build/part$j.log" 2>&1 &
  pids+=($!)
  inputs+=(-i "build/part$j.mp4")
done
for p in "${pids[@]}"; do wait "$p"; done

# join the parts (decoded one by one, so parts encoded differently still join cleanly)
# into the master: silent, no subtitles, high quality
filter=""
for ((j = 0; j < JOBS; j++)); do filter+="[$j:v]"; done
ffmpeg -v error -y "${inputs[@]}" -filter_complex "${filter}concat=n=$JOBS:v=1:a=0,format=yuv420p[v]" -map "[v]" \
  -c:v libx264 -preset slow -crf 14 -profile:v high -pix_fmt yuv420p -r 30 -movflags +faststart render/clean.mp4
tools/export.sh
