#!/bin/bash
# usage: ./sheet.sh name "t1,t2,..." [extra args]  -> out/<name>.jpg contact sheet at half res
cd "$(dirname "$0")"; name=$1; times=$2; shift 2
rm -rf out/stills; node render.mjs --stills "$times" --ss 1 --scale 0.5 "$@" 2>&1 | grep -v -E "stills/|^$" | tail -8
n=$(ls out/stills/*.png | wc -l); cols=$(( n < 6 ? n : 6 )); rows=$(( (n + cols - 1) / cols ))
ffmpeg -v error -y -pattern_type glob -i 'out/stills/f_*.png' -vf "tile=${cols}x${rows}" -q:v 3 out/$name.jpg
