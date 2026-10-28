#!/usr/bin/env bash
# Builds the reel end to end:
#   narration alignment -> frame render -> synthesized sound mix -> MP4 + cover.
set -euo pipefail
cd "$(dirname "$0")"
WORK=${WORK:-/tmp/qissa-build}
mkdir -p "$WORK" output

ffmpeg -v error -y -i audio/voiceover.mp3 -ac 1 -ar 16000 -sample_fmt s16 "$WORK/vo16k.wav"
python3 align.py "$WORK/vo16k.wav" > "$WORK/alignment.txt"
node export_events.js

rm -rf "$WORK/frames"
node render.js frames --out "$WORK/frames" --workers "${WORKERS:-4}"

python3 audio/sfx.py audio/voiceover.mp3 "$WORK/mix_raw.wav"
python3 audio/loudnorm.py "$WORK/mix_raw.wav" "$WORK/mix.wav" -14

ffmpeg -v error -y -framerate 30 -i "$WORK/frames/f_%05d.jpg" -i "$WORK/mix.wav" \
  -c:v libx264 -preset slow -crf 18 -pix_fmt yuv420p -profile:v high -level 4.2 -r 30 \
  -c:a aac -b:a 192k -ar 48000 -shortest -movflags +faststart \
  output/qissa_three_men_in_the_cave.mp4
node render.js cover --out output/cover.png
echo "done: output/qissa_three_men_in_the_cave.mp4, output/cover.png"
