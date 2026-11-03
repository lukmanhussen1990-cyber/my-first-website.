#!/bin/bash
# render_par.sh <out.mp4> <w> <h> <fps> <workers> <crf> <audio.wav>
set -e
OUT=$1; W=$2; H=$3; FPS=$4; N=$5; CRF=$6; AUD=$7
PROJ=$(cd "$(dirname "$0")/../src" && pwd)
TMP=$(dirname $OUT)/parts_$(basename $OUT .mp4); rm -rf $TMP; mkdir -p $TMP
TOTAL=$(python3 -c "import json;print(round(json.load(open('$PROJ/timeline.json'))['duration']*$FPS))")
PER=$(( (TOTAL + N - 1) / N ))
pids=()
for i in $(seq 0 $((N-1))); do
  F0=$((i*PER)); F1=$(( (i+1)*PER )); [ $F1 -gt $TOTAL ] && F1=$TOTAL
  node $PROJ/render.js video $TMP/part_$i.mp4 $W $H $FPS $F0 $F1 $CRF > $TMP/log_$i.txt 2>&1 &
  pids+=($!)
done
for p in "${pids[@]}"; do wait $p || { echo "worker failed"; cat $TMP/log_*.txt | tail -20; exit 1; }; done
for i in $(seq 0 $((N-1))); do echo "file '$TMP/part_$i.mp4'"; done > $TMP/list.txt
ffmpeg -hide_banner -loglevel error -y -f concat -safe 0 -i $TMP/list.txt -i $AUD -map 0:v -map 1:a -c:v copy -c:a aac -b:a 192k -shortest -movflags +faststart $OUT
echo "frames=$TOTAL"; ffprobe -v error -show_entries format=duration -of csv=p=0 $OUT
