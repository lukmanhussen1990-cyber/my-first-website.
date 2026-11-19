#!/bin/bash
# Render 3 preview stills per Episode 2 shot (or the given shots) and show errors. Usage: ep2/preview_all.sh [sh01 ...]
B=${B:-/opt/blender-4.5.16-linux-x64/blender}
HERE=$(cd "$(dirname "$0")" && pwd)
S=${LARRY_WORK:-$HOME/larry_work}
OUT=$S/ep2/preview
mkdir -p $OUT
SHOTS="$@"
[ -z "$SHOTS" ] && SHOTS=$(python3 -c "import sys; sys.path.insert(0,'$HERE'); import cuts; print(' '.join(cuts.SHOT_NAMES))")
cd /tmp
for sh in $SHOTS; do
  xvfb-run -a -s "-screen 0 1280x1024x24" $B -b --python $HERE/render_shot.py -- $sh $OUT preview 4 > $OUT/$sh.log 2>&1
  if grep -q SHOT_DONE $OUT/$sh.log; then echo "OK $sh $(grep SHOT_DONE $OUT/$sh.log | sed 's/.*secs=//')s"; else echo "FAIL $sh"; grep -B2 -A12 Traceback $OUT/$sh.log | head -30; fi
done
