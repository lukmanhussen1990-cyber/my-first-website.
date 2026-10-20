#!/usr/bin/env bash
# Swap in new voices and re-export the reel WITHOUT re-rendering the 3D:
#   ELEVENLABS_API_KEY=xxxx ./revoice.sh       (or put ELEVENLABS_API_KEY=xxxx in .env)
# 1. remakes every line in script.json with ElevenLabs (voices.elevenlabs in
#    script.json: voice IDs, model, settings), with exact word timings from the API
# 2. rebuilds the mix (each line drops into its slot; a longer line is sped up a
#    little and reported) and the subtitles from the new word timings
# 3. exports snack-tunnel.mp4 from the kept render/clean.mp4
# The previous voice files are kept in assets/vo/previous/. Nothing is overwritten
# unless every line was voiced, so a missing key or no credits leaves things as they were.
#   ENGINE=kokoro ./revoice.sh   re-voices with a local engine instead
set -euo pipefail
cd "$(dirname "$0")"
PY=${PY:-/home/user/reel-venv/bin/python}
ENGINE=${ENGINE:-elevenlabs}

[ -f render/clean.mp4 ] || { echo "render/clean.mp4 is missing: run ./make_reel.sh once to render the 3D" >&2; exit 1; }
if [ "$ENGINE" = elevenlabs ]; then
  key="${ELEVENLABS_API_KEY:-}"
  for f in .env ../.env; do
    [ -n "$key" ] || [ ! -f "$f" ] || key=$(sed -n 's/^[[:space:]]*\(export[[:space:]]\+\)\?ELEVENLABS_API_KEY[[:space:]]*=[[:space:]]*["'"'"']\?\([^"'"'"'[:space:]#]*\).*/\2/p' "$f" | head -1)
  done
  [ -n "$key" ] || { echo "no ELEVENLABS_API_KEY: export it or add ELEVENLABS_API_KEY=... to .env" >&2; exit 1; }
fi

mkdir -p assets/vo/previous
cp assets/vo/*.wav assets/vo/*.words.json assets/vo/manifest.json assets/vo/previous/ 2>/dev/null || true
"$PY" tools/voices.py --engine "$ENGINE"
node tools/export_timeline.mjs
"$PY" tools/audio.py
"$PY" tools/captions.py
tools/export.sh
