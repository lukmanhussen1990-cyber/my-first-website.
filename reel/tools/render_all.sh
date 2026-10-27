#!/bin/bash
# Render every frame of the timeline in parallel chunks, then mix audio and encode the MP4.
# usage: tools/render_all.sh <workdir> [jobs] [python]
set -e
WORK=${1:?workdir}; JOBS=${2:-3}; PY=${3:-python3}
cd "$(dirname "$0")/.."
mkdir -p "$WORK/frames"
TOTAL=$(node -e "const t=require('./assets/timeline.json'); console.log(Math.ceil(t.total*t.fps))")
PER=$(( (TOTAL + JOBS - 1) / JOBS ))
echo "rendering $TOTAL frames in $JOBS jobs"
pids=()
for ((j=0; j<JOBS; j++)); do
  from=$((j*PER)); to=$(( (j+1)*PER - 1 )); (( to >= TOTAL )) && to=$((TOTAL-1))
  node render.mjs frames "$WORK/frames" $from $to > "$WORK/render_$j.log" 2>&1 &
  pids+=($!)
done
for p in "${pids[@]}"; do wait $p; done
node render.mjs sfx "$WORK" > /dev/null
$PY -I tools/mix.py assets/timeline.json assets/audio/voice assets/audio/sfx assets/audio/music.wav "$WORK/sfx.json" "$WORK/mix.wav"
# loudness: two-pass loudnorm to -14 LUFS / -1.5 dBTP (Instagram-friendly)
STATS=$(ffmpeg -hide_banner -i "$WORK/mix.wav" -af loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json -f null - 2>&1 | sed -n '/^{/,/^}/p')
MI=$(echo "$STATS" | $PY -c "import sys,json; d=json.load(sys.stdin); print(d['input_i'])")
MTP=$(echo "$STATS" | $PY -c "import sys,json; d=json.load(sys.stdin); print(d['input_tp'])")
MLRA=$(echo "$STATS" | $PY -c "import sys,json; d=json.load(sys.stdin); print(d['input_lra'])")
MTH=$(echo "$STATS" | $PY -c "import sys,json; d=json.load(sys.stdin); print(d['input_thresh'])")
ffmpeg -v error -y -i "$WORK/mix.wav" -af "loudnorm=I=-14:TP=-1.5:LRA=11:measured_I=$MI:measured_TP=$MTP:measured_LRA=$MLRA:measured_thresh=$MTH:linear=true" -ar 48000 "$WORK/mix_norm.wav"
ffmpeg -v error -y -framerate 30 -i "$WORK/frames/f_%05d.jpg" -i "$WORK/mix_norm.wav" \
  -c:v libx264 -preset slow -crf 17 -pix_fmt yuv420p -profile:v high -level 4.2 -r 30 \
  -c:a aac -b:a 192k -ar 48000 -shortest -movflags +faststart "$WORK/reel.mp4"
echo "done: $WORK/reel.mp4"
