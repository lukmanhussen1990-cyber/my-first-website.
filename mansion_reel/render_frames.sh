#!/bin/bash
# render all video frames in parallel chunks (full size) -> build/frames/f_#####.jpg
set -euo pipefail
cd "$(dirname "$0")"
JOBS=${JOBS:-3}
TOTAL=$(node -e "import('./web/layout.js').then(m=>console.log(Math.round(m.DURATION*m.FPS)))" 2>/dev/null)
A=${FROM:-0}; B=${TO:-$((TOTAL-1))}; N=$((B - A + 1)); PER=$(( (N + JOBS - 1) / JOBS ))
mkdir -p build/frames
pids=()
for ((j=0; j<JOBS; j++)); do
  from=$((A + j*PER)); to=$((A + (j+1)*PER - 1)); (( to > B )) && to=$B; (( from > to )) && continue
  SKIP_EXISTING=${SKIP_EXISTING:-1} node render.mjs frames build/frames $from $to > build/render_$j.log 2>&1 &
  pids+=($!)
done
fail=0; for p in "${pids[@]}"; do wait $p || fail=1; done
grep -h "page errors" build/render_*.log
echo "frames: $(ls build/frames | wc -l) / $TOTAL  fail=$fail"
