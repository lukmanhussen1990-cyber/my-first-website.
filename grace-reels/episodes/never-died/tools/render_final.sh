#!/bin/bash
# Final render in resumable chunks (a restart only loses the chunk in progress), then join the
# chunks without re-encoding and add the final mix as AAC 48 kHz.
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p out/chunks
N=2201
SIZE=440
i=0
for start in $(seq 0 $SIZE $((N - 1))); do
	end=$((start + SIZE - 1))
	[ $end -ge $N ] && end=$((N - 1))
	f=out/chunks/chunk_$(printf %02d $i).mp4
	if [ ! -s "$f" ]; then
		echo "$(date +%T) rendering frames $start-$end -> $f"
		npx remotion render Reel "$f.part.mp4" --frames=$start-$end --gl=swangle --codec=h264 --crf=18 --pixel-format=yuv420p --muted --concurrency=4 --log=error
		mv "$f.part.mp4" "$f"
	fi
	i=$((i + 1))
done
(cd out/chunks && ls chunk_*.mp4 | grep -v part | sed "s/.*/file '&'/" > list.txt)
ffmpeg -y -v error -f concat -safe 0 -i out/chunks/list.txt -c copy out/chunks/video.mp4
ffmpeg -y -v error -i out/chunks/video.mp4 -i audio/final_mix.wav -map 0:v -map 1:a -c:v copy -c:a aac -b:a 256k -ar 48000 -shortest -movflags +faststart out/reel_never-died.mp4
echo "$(date +%T) done: out/reel_never-died.mp4"
