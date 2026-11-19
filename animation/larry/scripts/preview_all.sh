#!/bin/bash
# Render 3 preview stills for each shot (or the given shots) and log errors.
B=/opt/blender-4.5.16-linux-x64/blender
S=${LARRY_WORK:-$HOME/larry_work}
OUT=$S/preview
mkdir -p $OUT
SHOTS="$@"
[ -z "$SHOTS" ] && SHOTS=$(seq -f "sh%02g" 1 31)
cd /tmp
for sh in $SHOTS; do
  xvfb-run -a -s "-screen 0 1280x1024x24" $B -b --python /home/user/my-sec-wsb/animation/larry/scripts/render_shot.py -- $sh $OUT preview 4 > $OUT/$sh.log 2>&1
  if grep -q SHOT_DONE $OUT/$sh.log; then echo "OK $sh $(grep SHOT_DONE $OUT/$sh.log | sed 's/.*secs=//')s"; else echo "FAIL $sh"; grep -B2 -A12 Traceback $OUT/$sh.log | head -30; fi
done
