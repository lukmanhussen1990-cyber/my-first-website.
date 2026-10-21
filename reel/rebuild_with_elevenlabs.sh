#!/usr/bin/env bash
# Re-make the voices with ElevenLabs and re-export the video with the new voices and new
# subtitle timing. The 3D render is NOT redone: it reuses out/plate.mp4.
#
#   ELEVENLABS_API_KEY=sk_... ./rebuild_with_elevenlabs.sh
#   (or put ELEVENLABS_API_KEY=... in reel/.env)
set -euo pipefail
cd "$(dirname "$0")"
ENGINE="${1:-elevenlabs}"   # pass "auto" to fall back to local voices if ElevenLabs fails

if [ ! -f out/plate.mp4 ]; then
  echo "out/plate.mp4 is missing: render the 3D first (see README)." >&2
  exit 1
fi

python3 tools/make_voices.py --engine "$ENGINE"   # voices/*.wav + voices/timings.json
python3 tools/place_voices.py                     # out/voice_placement.json (fits each line in its scene)
python3 tools/make_subtitles.py                   # out/subtitles.ass (word-by-word, synced)
python3 tools/make_audio.py                       # out/mix.wav (music + effects ducked under voices)
python3 tools/export.py                           # out/great_wall_subway_reel.mp4
echo "Done: out/great_wall_subway_reel.mp4"
