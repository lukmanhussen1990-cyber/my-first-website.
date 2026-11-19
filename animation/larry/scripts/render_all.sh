#!/bin/bash
# Full-quality render of shots (default: all) with N parallel Blender workers.
# Usage: render_all.sh [workers] [samples] [shot ...]
B=/opt/blender-4.5.16-linux-x64/blender
S=${LARRY_WORK:-$HOME/larry_work}
OUT=$S/frames
W=${1:-2}; SPP=${2:-6}; shift 2 2>/dev/null
SHOTS="$@"
[ -z "$SHOTS" ] && SHOTS=$(seq -f "sh%02g" 1 31)
mkdir -p $OUT/logs
export B S OUT SPP
render_one() {
  sh=$1
  rm -rf "$OUT/$sh"
  cd /tmp && xvfb-run -a -s "-screen 0 1280x1024x24" $B -b --python /home/user/my-sec-wsb/animation/larry/scripts/render_shot.py -- $sh $OUT full $SPP > $OUT/logs/$sh.log 2>&1
  if grep -q SHOT_DONE $OUT/logs/$sh.log; then echo "OK $sh $(grep SHOT_DONE $OUT/logs/$sh.log | sed 's/.*frames=//')"; else echo "FAIL $sh"; fi
}
export -f render_one
echo $SHOTS | tr ' ' '\n' | xargs -P $W -I{} bash -c 'render_one {}'
