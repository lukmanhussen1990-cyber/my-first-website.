#!/bin/bash
# 144p motion preview of a whole episode (every frame, 1 sample), 2 Blender workers.
# Usage: LARRY_WORK=~/larry_work MODE=fast bash p144_all.sh <episode_dir> <out_dir>
EPD=$(cd "$1" && pwd); OUT=$2; mkdir -p $OUT/logs
HERE=$(cd "$(dirname "$0")" && pwd)
SHOTS=$(python3 -c "import sys; sys.path.insert(0,'$EPD'); import cuts; print(' '.join(cuts.SHOT_NAMES))")
export EPD OUT HERE
one() { cd /tmp; xvfb-run -a -s "-screen 0 1280x1024x24" /opt/bpy45/bin/python /opt/bpy45/prelude.py $HERE/p144.py -- $EPD $1 $OUT > $OUT/logs/$1.log 2>&1; grep -q P144_DONE $OUT/logs/$1.log && echo "OK $1" || echo "FAIL $1"; }
export -f one
echo $SHOTS | tr ' ' '\n' | xargs -P 2 -I{} bash -c 'one {}'
echo P144_ALL_DONE
