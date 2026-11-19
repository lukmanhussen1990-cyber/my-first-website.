#!/bin/bash
# render every missing final frame with two workers (odd/even); retry a worker that dies
cd /opt/work
run() {
  for a in 1 2 3; do
    SAMPLES=6 LP_NUM_THREADS=2 /opt/venv_bpy/bin/python elev/render_final_elev.py -- $1 1320 2 /opt/work/elev/frames >> /opt/work/elev/f$1.log 2>&1 && break
    echo "worker $1 exited ($?) attempt $a $(date -u +%H:%M)"
  done
}
run 1 & run 2 & wait
echo "DONE $(ls /opt/work/elev/frames | wc -l) frames $(date -u +%H:%M)"
