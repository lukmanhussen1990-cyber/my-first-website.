#!/bin/bash
# usage: preview.sh MODE STEP SHOT [SHOT...]   -> renders and builds a contact sheet per shot
MODE=$1; STEP=$2; shift 2
SCRIPTS=/home/user/my-first-website./dunk-tank-reel/scripts
for S in "$@"; do
  blender -b /opt/work/master.blend --python $SCRIPTS/render_shot.py -- $S $MODE - - /opt/work/renders $STEP 2>&1 | grep -E "SHOT_DONE|Traceback|Error:|error:|line [0-9]+" | grep -v EGL
done
