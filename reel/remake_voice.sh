#!/usr/bin/env bash
# Re-make the narrator voice with ElevenLabs and re-export the final video with new subtitle timing.
# The 3D is NOT re-rendered (uses output/scene_clean.mp4).
#
#   export ELEVENLABS_API_KEY=...      (or put ELEVENLABS_API_KEY=... in reel/.env)
#   ./remake_voice.sh                  # ElevenLabs
#   ./remake_voice.sh kokoro           # local voice instead
set -euo pipefail
cd "$(dirname "$0")"
if [ ! -x .venv/bin/python ]; then
  python3 -m venv .venv
  .venv/bin/pip install -q -r requirements.txt
  if [ "${1:-elevenlabs}" != "elevenlabs" ]; then .venv/bin/pip install -q -r requirements-local-tts.txt; fi
fi
.venv/bin/python tools/make_voice.py --provider "${1:-elevenlabs}"
.venv/bin/python tools/assemble.py
echo "New video: $(pwd)/output/shopping_cart_race_car.mp4"
