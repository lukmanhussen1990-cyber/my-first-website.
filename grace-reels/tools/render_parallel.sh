#!/usr/bin/env bash
# Render a reel in N parallel parts (each part gets its own browser + software-GPU process),
# join them losslessly, then add the final mix as AAC 48 kHz. Usage:
#   tools/render_parallel.sh TheMountain out/reel_the-mountain.mp4 episodes/the-mountain/audio/final_mix.wav 2
set -euo pipefail
COMP="$1"; OUT="$2"; AUDIO="$3"; PARTS="${4:-2}"; GL="${GL:-swangle}"
TOTAL=$(npx remotion compositions src/index.ts 2>/dev/null | awk -v c="$COMP" '$1==c {print $4}')
[ -n "$TOTAL" ] || { echo "could not read duration of $COMP"; exit 1; }
mkdir -p out/parts
rm -f out/parts/${COMP}_*.mp4 out/parts/list.txt
pids=()
for ((p=0; p<PARTS; p++)); do
  A=$(( TOTAL * p / PARTS )); B=$(( TOTAL * (p + 1) / PARTS - 1 ))
  npx remotion render src/index.ts "$COMP" "out/parts/${COMP}_$p.mp4" --frames=$A-$B --muted \
    --codec=h264 --crf=18 --pixel-format=yuv420p --gl="$GL" --concurrency=1 --log=info > "out/parts/${COMP}_$p.log" 2>&1 &
  pids+=($!)
  echo "file '${COMP}_$p.mp4'" >> out/parts/list.txt
done
for pid in "${pids[@]}"; do wait "$pid"; done
ffmpeg -v error -y -f concat -safe 0 -i out/parts/list.txt -c copy out/parts/${COMP}_video.mp4
ffmpeg -v error -y -i out/parts/${COMP}_video.mp4 -i "$AUDIO" -map 0:v -map 1:a -c:v copy -c:a aac -b:a 320k -ar 48000 -af apad -shortest -movflags +faststart "$OUT"
echo "done: $OUT"
