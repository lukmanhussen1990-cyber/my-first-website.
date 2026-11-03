#!/bin/bash
# Full render of cat_laptop.blend in N parallel Blender processes (frames 1..FREEZE).
# usage: render_all.sh <out_dir> [n_procs] [last_frame]
OUT=$1; N=${2:-3}; LAST=${3:-721}
cd "$(dirname "$0")/.."
mkdir -p "$OUT/logs"
CH=$(( (LAST + N - 1) / N ))
for i in $(seq 0 $((N-1))); do
  A=$(( i*CH + 1 )); B=$(( (i+1)*CH )); [ $B -gt $LAST ] && B=$LAST
  nohup blender -b cat_laptop.blend --python scripts/render_frames.py -- "$OUT/frames" "$A-$B" 100 5 > "$OUT/logs/proc_$i.log" 2>&1 &
done
wait
echo ALL_DONE
