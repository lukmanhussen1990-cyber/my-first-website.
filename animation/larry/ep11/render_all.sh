#!/bin/bash
# Full-quality render of Episode 11 shots with N parallel Blender workers (max 2: RAM).
# Usage: ep11/render_all.sh [workers] [samples] [shot ...]
B=${B:-/opt/blender-4.5.16-linux-x64/blender}
HERE=$(cd "$(dirname "$0")" && pwd)
S=${LARRY_WORK:-$HOME/larry_work}
OUT=$S/ep11/frames
W=${1:-2}; SPP=${2:-4}; shift 2 2>/dev/null
SHOTS="$@"
[ -z "$SHOTS" ] && SHOTS=$(python3 -c "import sys; sys.path.insert(0,'$HERE'); import cuts; print(' '.join(cuts.SHOT_NAMES))")
mkdir -p $OUT/logs
export B S OUT SPP HERE
render_one() {
  sh=$1
  rm -rf "$OUT/$sh"
  cd /tmp && xvfb-run -a -s "-screen 0 1280x1024x24" $B -b --python $HERE/render_shot.py -- $sh $OUT full $SPP > $OUT/logs/$sh.log 2>&1
  if grep -q SHOT_DONE $OUT/logs/$sh.log; then echo "OK $sh $(grep SHOT_DONE $OUT/logs/$sh.log | sed 's/.*frames=//')"; else echo "FAIL $sh"; fi
}
export -f render_one
echo $SHOTS | tr ' ' '\n' | xargs -P $W -I{} bash -c 'render_one {}'
