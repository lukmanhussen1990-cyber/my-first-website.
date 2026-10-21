#!/usr/bin/env bash
# Re-make the voices with ElevenLabs and re-export the video with the new voices
# and new subtitle timing. The 3D is NOT re-rendered (it reuses the clean video).
#
#   export ELEVENLABS_API_KEY=...        (or put it in scarecrow-reel/.env)
#   ./remake_with_elevenlabs.sh
#
# Options are passed to make_voices.py, e.g.  --only line07   (just the kid line)
set -euo pipefail
cd "$(dirname "$0")"
PY="${PYTHON:-python3}"
[ -x ../.venv/bin/python ] && PY=../.venv/bin/python
if ! "$PY" -c "import numpy, scipy, PIL" 2>/dev/null; then
  echo "Installing Python packages (numpy scipy pillow) ..."; "$PY" -m pip install -q numpy scipy pillow
fi
"$PY" tools/make_voices.py --engine elevenlabs "$@"
"$PY" tools/compose.py
echo "Done: out/scarecrow_reel.mp4"
