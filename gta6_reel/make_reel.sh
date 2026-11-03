#!/usr/bin/env bash
# Build the GTA 6 reel from the voiceover.
#   ./make_reel.sh preview   -> gta6_poop_reel_PREVIEW_144p.mp4 (144x256)
#   ./make_reel.sh final     -> gta6_poop_reel.mp4 (1080x1920)
#   ./make_reel.sh check     -> per-frame censor check (build/censor_check.json)
set -euo pipefail
cd "$(dirname "$0")"
MODE="${1:-preview}"
VOICE="${VOICE:-voice/my_voiceover.mp3}"
WORKERS="${WORKERS:-4}"
[ -d node_modules ] || npm install --silent

if [ "${SKIP_ALIGN:-0}" != "1" ]; then python3 tools/align.py --voice "$VOICE"; fi
python3 tools/check_sync.py build/timeline.json "$VOICE"
DUR=$(python3 -c "import json;print(json.load(open('build/timeline.json'))['duration'])")

if [ "$MODE" = "check" ]; then
  node tools/render.js check --w "${CW:-540}" --h "${CH:-960}" --workers "$WORKERS" --out build/censor_check.json
  exit 0
fi

node tools/render.js sfx --out build/sfx_events.json
python3 tools/sfx.py build/timeline.json build/sfx_events.json build/sfx.wav --voice "$VOICE"

if [ "$MODE" = "final" ]; then
  W=1080; H=1920; Q=0.95; FR=build/frames_final; OUT=gta6_poop_reel.mp4; CRF=16; PRESET=slow
else
  W=144; H=256; Q=0.85; FR=build/frames_144; OUT=gta6_poop_reel_PREVIEW_144p.mp4; CRF=26; PRESET=veryfast
fi
if [ "${SKIP_FRAMES:-0}" != "1" ]; then
  rm -rf "$FR"
  node tools/render.js frames --w $W --h $H --fps 30 --workers "$WORKERS" --quality $Q --out "$FR"
fi

# the voice untouched (mono copied to both channels at unity gain), effects quietly underneath
ffmpeg -v error -y -i "$VOICE" -i build/sfx.wav -filter_complex \
  "[0:a]aresample=48000,pan=stereo|c0=c0|c1=c0[v];[1:a]aformat=channel_layouts=stereo[s];[v][s]amix=inputs=2:duration=first:normalize=0[a]" \
  -map "[a]" -t "$DUR" -c:a pcm_s16le build/mix.wav
ffmpeg -v error -y -framerate 30 -i "$FR/f_%05d.jpg" -i build/mix.wav \
  -c:v libx264 -preset $PRESET -crf $CRF -pix_fmt yuv420p -r 30 \
  -c:a aac -b:a 192k -t "$DUR" -movflags +faststart "$OUT"
echo "wrote $OUT ($(ffprobe -v error -show_entries format=duration -of csv=p=0 "$OUT")s, voice ${DUR}s)"
