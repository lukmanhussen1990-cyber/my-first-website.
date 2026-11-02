#!/bin/bash
# quick low-res preview: PV_TO=<last frame> ./preview.sh  -> preview.mp4 (540x960, voice + captions, no sound effects)
set -euo pipefail
cd "$(dirname "$0")"
TO=${PV_TO:-1037}; JOBS=${JOBS:-3}; OUTDIR=build/pv
mkdir -p $OUTDIR
PER=$(( (TO + 1 + JOBS - 1) / JOBS ))
pids=()
for ((j=0; j<JOBS; j++)); do
  from=$((j*PER)); to=$(((j+1)*PER-1)); (( to > TO )) && to=$TO
  SCALE=0.5 SKIP_EXISTING=${SKIP_EXISTING:-0} node render.mjs frames $OUTDIR $from $to > build/pv_$j.log 2>&1 &
  pids+=($!)
done
for p in "${pids[@]}"; do wait $p || echo "job failed"; done
DUR=$(python3 -c "print(($TO+1)/30)")
ffmpeg -v error -y -framerate 30 -i $OUTDIR/f_%05d.jpg -i audio/voiceover.wav -t "$DUR" \
  -vf "subtitles=audio/captions.ass:fontsdir=fonts" -c:v libx264 -preset veryfast -crf 24 -pix_fmt yuv420p \
  -c:a aac -b:a 128k -movflags +faststart preview.mp4
echo "wrote preview.mp4 ($DUR s)"
