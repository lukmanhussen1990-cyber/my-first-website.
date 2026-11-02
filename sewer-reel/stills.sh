#!/bin/bash
# usage: ./stills.sh name t1 t2 ...   -> out/name_sheet.png (contact sheet, 4 per row)
cd "$(dirname "$0")"
name=$1; shift
frames=$(for t in "$@"; do python3 -c "print(round($t*30))"; done | paste -sd,)
rm -f out/${name}_*.png
node render.mjs --stills=$frames --out=out/$name.png 2>&1 | grep -v "^still" | grep -iv "PCFSoftShadowMap"
n=$#; cols=$(( n < 4 ? n : 4 )); rows=$(( (n + cols - 1) / cols ))
ffmpeg -v error -y -pattern_type glob -i "out/${name}_[0-9]*.png" -vf "scale=360:640,tile=${cols}x${rows}:padding=6:color=white" out/${name}_sheet.png
