#!/bin/bash
# renders 60-frame segments in parallel; skips segments already on disk
cd "$(dirname "$0")"
mkdir -p seg logs
JOBS=${JOBS:-3}
for a in $(seq 0 60 1740); do
  b=$((a+60)); out=seg/s$(printf %04d $a).mp4
  [ -f "$out" ] || echo "$a $b $out"
done | xargs -P $JOBS -L 1 bash -c 'node render.mjs seg $0 $1 $2 > logs/$(basename $2).log 2>&1 || echo FAIL $2'
echo "segments on disk: $(ls seg/s*.mp4 2>/dev/null | grep -v part | wc -l) / 30"
