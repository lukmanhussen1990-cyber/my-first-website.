#!/usr/bin/env bash
# Full pipeline: assets -> render (2 parallel Blender processes) -> audio -> composite -> gum_reel.mp4
# usage: make_reel.sh RES SAMPLES STEP OUTDIR OUT_MP4 [SIZE]
set -euo pipefail
RES=${1:-810x1440}; SAMPLES=${2:-6}; STEP=${3:-1}; OUT=${4:-/home/user/work/frames/final}; MP4=${5:-/home/user/work/gum_reel.mp4}; SIZE=${6:-1080x1920}
PY=/home/user/work/venv/bin/python
S=/home/user/work/scripts
cd /home/user/work
$PY $S/export_events.py > /dev/null 2>&1
A=$(python3 -c "import json;d=json.load(open('events.json'));n=[s['name'] for s in sorted(d['shots'],key=lambda s:s['t0'])];print(','.join(n[:17]))")
B=$(python3 -c "import json;d=json.load(open('events.json'));n=[s['name'] for s in sorted(d['shots'],key=lambda s:s['t0'])];print(','.join(n[17:]))")
mkdir -p "$OUT"
$PY $S/render_shots.py --shots "$A" --mode eevee --res $RES --samples $SAMPLES --step $STEP --out "$OUT" --skip_existing > "$OUT/logA.txt" 2>&1 &
PA=$!
$PY $S/render_shots.py --shots "$B" --mode eevee --res $RES --samples $SAMPLES --step $STEP --out "$OUT" --skip_existing > "$OUT/logB.txt" 2>&1 &
PB=$!
wait $PA $PB
$PY $S/audio.py /home/user/work/test/mix.wav
$PY $S/fx.py --frames "$OUT" --out "$MP4" --audio /home/user/work/test/mix.wav --size $SIZE --step $STEP
echo DONE "$MP4"
