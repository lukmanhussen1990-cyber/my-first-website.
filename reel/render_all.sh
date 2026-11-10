#!/bin/bash
# Renders the whole film in resumable chunks with a small core-pinned worker pool, then concatenates the lossless segments.
# usage: ./render_all.sh [workers=2] [chunk=60]
cd "$(dirname "$0")"; WORKERS=${1:-2}; CHUNK=${2:-60}; TOTAL=2152
mkdir -p out/seg out/log
i=0; for ((f=0; f<TOTAL; f+=CHUNK)); do
  e=$((f+CHUNK)); [ $e -gt $TOTAL ] && e=$TOTAL; n=$(printf "%03d" $i)
  if [ ! -f out/seg/seg_$n.done ]; then echo "$f:$e $n"; fi; i=$((i+1))
done | xargs -P $WORKERS --process-slot-var=SLOT -L 1 bash -c 'if [ "$W" -gt 1 ]; then PIN="taskset -c $((SLOT*2)),$((SLOT*2+1))"; fi; $PIN node render.mjs --range $0 --ss 1 --msaa 4 --out out/seg/seg_$1.mp4 > out/log/seg_$1.log 2>&1 && touch out/seg/seg_$1.done'
n=$(ls out/seg/seg_*.done 2>/dev/null | wc -l); want=$(( (TOTAL + CHUNK - 1) / CHUNK ))
if [ "$n" -ne "$want" ]; then echo "INCOMPLETE $n/$want"; exit 1; fi
ls out/seg/seg_*.mp4 | sort | sed "s|^|file '$PWD/|;s|$|'|" > out/seg/list.txt
ffmpeg -v error -y -f concat -safe 0 -i out/seg/list.txt -c copy out/video_lossless.mp4 && echo "ALL DONE"
