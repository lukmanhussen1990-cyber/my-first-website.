#!/bin/bash
# Motion check: render every 3rd frame of each shot at 20% / 1 sample. Usage: ep10/motion_all.sh [sh01 ...]
B=${B:-/opt/blender-4.5.16-linux-x64/blender}
HERE=$(cd "$(dirname "$0")" && pwd)
S=${LARRY_WORK:-$HOME/larry_work}
OUT=$S/ep10/motion
mkdir -p $OUT
SHOTS="$@"
[ -z "$SHOTS" ] && SHOTS=$(python3 -c "import sys; sys.path.insert(0,'$HERE'); import cuts; print(' '.join(cuts.SHOT_NAMES))")
export B OUT HERE
one() {
  sh=$1; cd /tmp
  xvfb-run -a -s "-screen 0 1280x1024x24" $B -b --python $HERE/render_shot.py -- $sh $OUT motion 1 > $OUT/$sh.log 2>&1
  if grep -q SHOT_DONE $OUT/$sh.log; then echo "OK $sh $(grep SHOT_DONE $OUT/$sh.log | sed 's/.*secs=//')s"; else echo "FAIL $sh"; grep -B2 -A12 Traceback $OUT/$sh.log | head -30; fi
}
export -f one
echo $SHOTS | tr ' ' '\n' | xargs -P ${W:-1} -I{} bash -c 'one {}'
