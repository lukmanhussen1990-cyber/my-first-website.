#!/usr/bin/env bash
# Full pipeline: timeline -> frames (Three.js + Playwright) -> audio (numpy) -> MP4 (ffmpeg)
set -euo pipefail
cd "$(dirname "$0")"
FRAMES="${FRAMES:-build/frames}"; JOBS="${JOBS:-4}"
mkdir -p build "$FRAMES"
python3 build_timeline.py            # needs whisper_words.json (word timestamps of voiceover_src.mp3)
TOTAL=$(python3 -c "import json;t=json.load(open('build/timeline.json'));print(round(t['duration']*t['fps']))")
STEP=$(( (TOTAL + JOBS - 1) / JOBS ))
for i in $(seq 0 $((JOBS-1))); do node render.js --out "$FRAMES" --from $((i*STEP)) --to $(((i+1)*STEP)) & done; wait
python3 make_audio.py
ffmpeg -y -framerate 30 -i "$FRAMES/f_%05d.jpg" -i build/mix.wav \
  -vf "scale=in_range=pc:out_range=tv:out_color_matrix=bt709,format=yuv420p" -color_primaries bt709 -color_trc bt709 -colorspace bt709 \
  -c:v libx264 -preset medium -crf 17 -r 30 -c:a aac -b:a 192k -movflags +faststart -shortest poop_volcano_reel.mp4
ffmpeg -y -i poop_volcano_reel.mp4 -vf scale=144:256 -c:v libx264 -preset medium -crf 30 -c:a aac -b:a 48k -movflags +faststart poop_volcano_reel_144p.mp4
