#!/usr/bin/env bash
# Swap in a new narrator voice and re-export the reel WITHOUT re-rendering the 3D:
#
#   ELEVENLABS_API_KEY=xxxx ./revoice.sh      ElevenLabs (or put ELEVENLABS_API_KEY=xxxx in .env)
#   ./revoice.sh my_new_take.mp3              a new recording of the whole script (all ten
#                                             lines in order, a short pause between lines)
#   ENGINE=kokoro ./revoice.sh                a local voice instead (kokoro, piper, espeak)
#
# 1. makes one file per line in assets/vo/ (ElevenLabs: voices.narrator.elevenlabs in
#    script.json - voice ID, model, settings - with exact word timings from the API;
#    a recording: cut at the pauses, word timings from speech recognition matched onto
#    the script's own words)
# 2. rebuilds the mix (each line drops into its slot; a line longer than its slot is
#    sped up a little and reported) and the one-word subtitles from the new timings
# 3. exports tornado-shelter.mp4 from the kept 3D render (render/clean.mp4)
# The previous voice files are kept in assets/vo/previous/. Nothing is overwritten
# unless every line was voiced, so a missing key or no credits leaves things as they were.
set -euo pipefail
cd "$(dirname "$0")"
PY=${PY:-/home/user/reel-venv/bin/python}
ENGINE=${ENGINE:-elevenlabs}
REC=${1:-}

[ -f render/clean.mp4 ] || { echo "render/clean.mp4 is missing: run ./make_reel.sh once to render the 3D" >&2; exit 1; }
if [ -z "$REC" ] && [ "$ENGINE" = elevenlabs ]; then
  key="${ELEVENLABS_API_KEY:-}"
  for f in .env ../.env; do
    [ -n "$key" ] || [ ! -f "$f" ] || key=$(sed -n 's/^[[:space:]]*\(export[[:space:]]\+\)\?ELEVENLABS_API_KEY[[:space:]]*=[[:space:]]*["'"'"']\?\([^"'"'"'[:space:]#]*\).*/\2/p' "$f" | head -1)
  done
  [ -n "$key" ] || { echo "no ELEVENLABS_API_KEY: export it or add ELEVENLABS_API_KEY=... to .env" >&2; exit 1; }
fi

mkdir -p assets/vo/previous
cp assets/vo/*.wav assets/vo/*.words.json assets/vo/manifest.json assets/vo/previous/ 2>/dev/null || true
if [ -n "$REC" ]; then
  "$PY" tools/split_voiceover.py "$REC"
else
  "$PY" tools/voices.py --engine "$ENGINE"
fi
node tools/export_timeline.mjs
"$PY" tools/audio.py
"$PY" tools/captions.py
tools/export.sh
