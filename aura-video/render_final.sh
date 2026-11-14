#!/usr/bin/env bash
# Renders the final video in resumable chunks, then adds the audio track.
set -e
cd "$(dirname "$0")"
i=0
for range in 0-449 450-899 900-1349; do
  if [ ! -f out/parts/part_$i.mp4 ]; then
    npx remotion render AuraVideo out/parts/tmp_$i.mp4 --frames=$range --muted --concurrency=3 --crf=16 --log=error
    mv out/parts/tmp_$i.mp4 out/parts/part_$i.mp4
    echo "chunk $i done $(date +%T)"
  fi
  i=$((i+1))
done
[ -f out/parts/audio.wav ] || npx remotion render AuraVideo out/parts/audio.wav --codec=wav --log=error
printf "file 'part_0.mp4'\nfile 'part_1.mp4'\nfile 'part_2.mp4'\n" > out/parts/list.txt
ffmpeg -v error -y -f concat -safe 0 -i out/parts/list.txt -i out/parts/audio.wav -map 0:v -map 1:a -c:v copy -c:a aac -b:a 256k -movflags +faststart out/aura_final_1080x1920.mp4
echo "FINAL DONE $(date +%T)"
