#!/usr/bin/env bash
# Re-make the voices with ElevenLabs and re-export the video with the new voices and new
# subtitle timing. The 3D is NOT re-rendered (uses build/clean.mkv / build/chunks).
#
#   export ELEVENLABS_API_KEY=sk_...        (or put ELEVENLABS_API_KEY=... in roadster-reel/.env)
#   ./remake_with_elevenlabs.sh             (add --strict to stop instead of falling back to Piper)
set -euo pipefail
cd "$(dirname "$0")"
PY="${PYTHON:-python3}"
"$PY" tools/voices.py --engine elevenlabs "$@"   # voices/*.wav + voices/timings.json (word timestamps)
[ -f audio/music.wav ] || "$PY" tools/music.py   # music + sfx are cached stems
[ -f audio/sfx.wav ]   || "$PY" tools/sfx.py
"$PY" tools/mix.py                               # places lines, ducks music, -14 LUFS master
"$PY" tools/export.py                            # burns new word-by-word subtitles, encodes MP4
echo "Done: out/john_roadster_reel.mp4"
