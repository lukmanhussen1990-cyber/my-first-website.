#!/usr/bin/env bash
# Build the reel from a voiceover.
#   ./make_reel.sh voice/my_voiceover.mp3 preview   -> police_station_reel_PREVIEW.mp4 (540x960)
#   ./make_reel.sh voice/my_voiceover.mp3 final     -> police_station_reel.mp4 (1080x1920)
#   ./make_reel.sh "" preview                       -> estimated timing, no voice
set -euo pipefail
cd "$(dirname "$0")"
VOICE="${1:-}"
MODE="${2:-preview}"
WORKERS="${WORKERS:-4}"
[ -d node_modules ] || npm install --silent

if [ "${SKIP_ALIGN:-0}" != "1" ]; then
  if [ -n "$VOICE" ]; then python3 tools/align.py --voice "$VOICE"; else python3 tools/align.py --estimate; fi
fi
DUR=$(python3 -c "import json;print(json.load(open('build/timeline.json'))['duration'])")

node tools/render.js sfx --out build/sfx_events.json
if [ -n "$VOICE" ]; then
  python3 tools/sfx.py build/timeline.json build/sfx_events.json build/sfx.wav --voice "$VOICE"
else
  python3 tools/sfx.py build/timeline.json build/sfx_events.json build/sfx.wav
fi

if [ "$MODE" = "final" ]; then
  W=1080; H=1920; Q=0.95; FR=build/frames_final; OUT=police_station_reel.mp4; CRF=16; PRESET=slow
else
  W=540; H=960; Q=0.85; FR=build/frames_preview; OUT=police_station_reel_PREVIEW.mp4; CRF=24; PRESET=veryfast
fi
rm -rf "$FR"
node tools/render.js frames --w $W --h $H --fps 30 --workers "$WORKERS" --quality $Q --out "$FR"

# audio: the voice untouched as the main sound, effects quietly underneath
if [ -n "$VOICE" ]; then
  ffmpeg -v error -y -i "$VOICE" -i build/sfx.wav -filter_complex \
    "[0:a]aresample=48000,aformat=channel_layouts=stereo[v];[1:a]aformat=channel_layouts=stereo[s];[v][s]amix=inputs=2:duration=first:normalize=0[a]" \
    -map "[a]" -t "$DUR" -c:a pcm_s16le build/mix.wav
else
  cp build/sfx.wav build/mix.wav
fi

ffmpeg -v error -y -framerate 30 -i "$FR/f_%05d.jpg" -i build/mix.wav \
  -c:v libx264 -preset $PRESET -crf $CRF -pix_fmt yuv420p -r 30 \
  -c:a aac -b:a 192k -t "$DUR" -movflags +faststart "$OUT"
echo "wrote $OUT ($(ffprobe -v error -show_entries format=duration -of csv=p=0 "$OUT")s, voice ${DUR}s)"
