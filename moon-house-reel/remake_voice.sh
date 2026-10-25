#!/usr/bin/env bash
# ONE COMMAND: re-make the narration with ElevenLabs and re-export the video with the
# new voice and re-timed subtitles. The 3D render (output/moon_house_clean.mp4) is reused.
#
#   ELEVENLABS_API_KEY=sk_... ./remake_voice.sh                 # or put the key in .env
#   ./remake_voice.sh --voice-id <id> --model eleven_multilingual_v2 --speed 1.05
#   ./remake_voice.sh --from-files ~/Downloads/moon_voice       # line_01.mp3 ... line_07.mp3 made in the ElevenLabs app
set -euo pipefail
cd "$(dirname "$0")"
if [ ! -x .venv/bin/python ]; then
  python3 -m venv .venv
  .venv/bin/pip install -q -r requirements.txt
fi
.venv/bin/python audio/tts_elevenlabs.py "$@"
./make_video.sh
