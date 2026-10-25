#!/usr/bin/env bash
# One-command rebuild of the whole reel: voice -> cues -> audio -> frames -> mp4 (+ cover, storyboard, QC)
#   bash scripts/build.sh            full pipeline
#   SKIP_VOICE=1 bash scripts/build.sh   keep build/voice.wav + timings.json (e.g. after dropping in assets/voice.wav once)
set -euo pipefail
cd "$(dirname "$0")/.."
[ -d node_modules/three ] || npm install
python3 -c "import edge_tts, soundfile, pyloudnorm, scipy" 2>/dev/null || pip install -q edge-tts soundfile pyloudnorm scipy faster-whisper
if [ -z "${SKIP_VOICE:-}" ]; then python3 scripts/tts.py; fi
node scripts/cues.cjs
python3 scripts/audio.py
rm -rf build/frames
node scripts/render.cjs --out out/final_reel.mp4 --keep
node scripts/storyboard.cjs out/storyboard.jpg
for p in 1 2 3; do node scripts/snap.cjs "sheet&page=$p" "build/sheet_$p.png"; done
python3 scripts/qc.py
