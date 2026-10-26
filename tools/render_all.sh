#!/usr/bin/env bash
# Full pipeline: 3D scene segments -> text layer -> audio -> final MP4s + stems.
set -euo pipefail
cd "$(dirname "$0")/.."
WORKERS=${WORKERS:-2}
python3 tools/build_timeline.py
node tools/render.js --scenes all --workers "$WORKERS"
node tools/render.js --overlay
python3 tools/sfx.py
python3 tools/build_audio.py
python3 tools/finalize.py final
# stems as 24-bit PCM
for s in voice sfx music; do
  ffmpeg -y -v error -i final/stems/$s.wav -c:a pcm_s24le final/stems/$s.tmp.wav && mv final/stems/$s.tmp.wav final/stems/$s.wav
done
echo "done: final/man_in_the_ice.mp4"
