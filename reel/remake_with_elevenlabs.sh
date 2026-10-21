#!/usr/bin/env bash
# Re-make the voiceover with ElevenLabs and re-export the reel (new voices + new subtitle timing).
# The 3D video is NOT re-rendered: build/render/video_nosubs.mp4 is reused.
#   ELEVENLABS_API_KEY=sk_... ./remake_with_elevenlabs.sh        (or put the key in reel/.env)
set -euo pipefail
cd "$(dirname "$0")"
PY=.venv/bin/python; [ -x "$PY" ] || PY=python3
if ! "$PY" voice/make_voices_elevenlabs.py "$@"; then
  echo
  echo "ElevenLabs voice generation failed (see message above). Nothing was re-exported."
  echo "To export with the local Piper voices instead:  $PY export.py --voices local"
  exit 1
fi
"$PY" export.py --voices elevenlabs
echo "Done: output/treasure_reel.mp4 (ElevenLabs voices)"
