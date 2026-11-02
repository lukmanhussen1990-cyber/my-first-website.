#!/bin/bash
# Full build: voiceover timeline -> music/SFX mix -> parallel frame render -> MP4.
#   ./build.sh            final 1080x1920 @30fps  -> out/sewer_reel.mp4
#   ./build.sh preview    540x960 @15fps quick preview -> out/sewer_reel_preview.mp4
set -e
cd "$(dirname "$0")"
MODE=${1:-final}; JOBS=${JOBS:-3}; TOTAL=1800
if [ "$MODE" = preview ]; then ARGS="--scale=0.5 --step=2"; NAME=sewer_reel_preview; else ARGS="--scale=1"; NAME=sewer_reel; fi
python3 audio/timeline.py > /dev/null
python3 audio/mix.py
CH=$(( (TOTAL + JOBS - 1) / JOBS )); CH=$(( (CH + 1) / 2 * 2 ))   # even-sized chunks (keeps --step=2 aligned)
rm -f out/${NAME}_part*.mp4 out/${NAME}_list.txt
for ((i = 0; i < JOBS; i++)); do
  s=$((i * CH)); e=$(((i + 1) * CH)); [ $e -gt $TOTAL ] && e=$TOTAL
  node render.mjs $ARGS --start=$s --end=$e --out=out/${NAME}_part$i.mp4 > out/${NAME}_part$i.log 2>&1 &
  echo "file '${NAME}_part$i.mp4'" >> out/${NAME}_list.txt
done
wait
ffmpeg -v error -y -f concat -safe 0 -i out/${NAME}_list.txt -c copy out/${NAME}_video.mp4
ffmpeg -v error -y -i out/${NAME}_video.mp4 -i out/mix.wav -map 0:v -map 1:a -c:v copy -c:a aac -b:a 192k -shortest -movflags +faststart out/${NAME}.mp4
ffprobe -v error -show_entries format=duration:stream=codec_name,width,height,r_frame_rate -of compact out/${NAME}.mp4
