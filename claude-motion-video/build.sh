#!/usr/bin/env bash
# Builds out/claude-promo.mp4 from scratch: artifact cards -> frames -> sound design -> mux.
set -euo pipefail
cd "$(dirname "$0")"
export NODE_PATH="${NODE_PATH:-$(npm root -g)}"

[ -f src/vendor/three.module.js ] || { npm install --no-audit --no-fund && cp node_modules/three/build/three.module.js src/vendor/; }

node render/render-assets.cjs
node render/render-video.cjs --cues --from=0 --to=33 --workers="${WORKERS:-4}" --out=out/video.mp4
python3 render/audio.py out/cues.json out/audio.wav
ffmpeg -v error -y -i out/video.mp4 -i out/audio.wav -map 0:v -map 1:a -c:v copy -c:a aac -b:a 192k -shortest -movflags +faststart out/claude-promo.mp4
echo "done -> out/claude-promo.mp4"
