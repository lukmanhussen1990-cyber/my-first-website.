#!/usr/bin/env bash
# One command: re-make both voices with ElevenLabs, then re-export the reel with
# the new voices and new subtitle timing. The 3D picture is NOT re-rendered
# (it reuses out/clean_video.mp4).
#
#   export ELEVENLABS_API_KEY=...      (or put ELEVENLABS_API_KEY=... in a .env file)
#   ./remake_with_elevenlabs.sh                 # eleven_multilingual_v2
#   ./remake_with_elevenlabs.sh eleven_v3       # v3, uses the [audio tags] in script.json
#
# Needs: python3 with numpy scipy soundfile pillow, and ffmpeg (with libass).
set -euo pipefail
cd "$(dirname "$0")"
PY="${PYTHON:-python3}"
MODEL="${1:-eleven_multilingual_v2}"

echo "1/5 voices (ElevenLabs, $MODEL)"
"$PY" tools/voices_elevenlabs.py --model "$MODEL"
echo "2/5 word timing"
"$PY" tools/align_words.py
echo "3/5 music, sound effects and mix"
"$PY" tools/mix_audio.py
echo "4/5 subtitles"
"$PY" tools/subtitles.py
echo "5/5 export"
"$PY" tools/export_final.py
