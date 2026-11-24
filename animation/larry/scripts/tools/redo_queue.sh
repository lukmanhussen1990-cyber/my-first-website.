#!/bin/bash
# Re-render fixed shots into <work>/<ep>/frames_fix while the main render runs: shots listed in frames_fix/queue.txt
# (one per line, the file may grow while it runs) are claimed by atomic mkdir locks, so two workers can share it.
# Start one worker per free Blender slot (max 2 Blender processes in total!). Afterwards swap each frames_fix/<shot> into
# frames/, DELETE frames720/<shot> (upscale.py skips outputs newer than their source), re-upscale and re-assemble.
# Usage: LARRY_WORK=~/larry_work MODE=fast bash redo_queue.sh <episode_dir> <worker-name>
EPD=$(cd "$1" && pwd); EP=$(basename $EPD)
FX=${LARRY_WORK:-$HOME/larry_work}/$EP/frames_fix; mkdir -p $FX/locks; touch $FX/queue.txt
B=${B:-/opt/blender-4.5.16-linux-x64/blender}
cd /tmp
while true; do
  claimed=""
  for sh in $(cat $FX/queue.txt); do mkdir $FX/locks/$sh 2>/dev/null && { claimed=$sh; break; }; done
  [ -z "$claimed" ] && break
  echo "$2 START $claimed"
  xvfb-run -a -s "-screen 0 1280x1024x24" $B -b --python $EPD/render_shot.py -- $claimed $FX ${MODE:-fast} 2 > $FX/$claimed.log 2>&1
  grep -q SHOT_DONE $FX/$claimed.log && echo "$2 DONE $claimed" || echo "$2 FAIL $claimed"
done
echo "$2 QUEUE_EMPTY"
