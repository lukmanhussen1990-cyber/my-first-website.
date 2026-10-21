#!/usr/bin/env bash
# One command: re-make the narration with ElevenLabs and re-export the video
# (new voice + updated subtitle timing) WITHOUT re-rendering the 3D.
#
#   ELEVENLABS_API_KEY=sk_... ./swap_voice_elevenlabs.sh            # or put the key in reel/.env
#   ./swap_voice_elevenlabs.sh --voice-id <any ElevenLabs voice id>
#
# Needs: python3 and ffmpeg (with libass). No other installs.
set -euo pipefail
cd "$(dirname "$0")"
python3 voice/make_voice_elevenlabs.py "$@"
python3 tools/export.py
echo "Done -> output/john_powers_the_city.mp4"
