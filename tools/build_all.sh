#!/usr/bin/env bash
# One-command rebuild: narration -> SFX cue list -> soundtrack -> frames -> final MP4 + stills.
#   bash tools/build_all.sh            (full pipeline)
#   SKIP_TTS=1 bash tools/build_all.sh (keep the existing build/voice.wav + timings.json)
set -euo pipefail
cd "$(dirname "$0")/.."
PY=.venv/bin/python
mkdir -p build out

if [ -z "${SKIP_TTS:-}" ]; then
  echo "== 1/5 narration (Kokoro, or build/voice_override.wav if present)"
  $PY tools/tts.py
fi

echo "== 2/5 cue sheet + scene list (headless page boot)"
node tools/render.mjs --at 0 >/dev/null   # writes build/sfx_events.json + build/scenes.json

echo "== 3/5 soundtrack + mix (-14 LUFS / -1 dBTP)"
$PY tools/audio.py

echo "== 4/5 frames (deterministic renderAt(t) @ 30 fps)"
node tools/render.mjs

echo "== 5/5 mux + deliverables"
ffmpeg -v error -y -i build/video.mp4 -i build/mix.wav -map 0:v -map 1:a \
  -c:v copy -c:a aac -b:a 192k -ar 48000 -shortest -movflags +faststart out/final_reel.mp4
node tools/render.mjs --cover 3.4
node tools/render.mjs --sheet
node tools/render.mjs --stills
node tools/render.mjs --safezone
$PY tools/qc.py
echo "done -> out/final_reel.mp4"
