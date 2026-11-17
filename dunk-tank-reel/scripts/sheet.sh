#!/bin/bash
# usage: sheet.sh MODE OUT.png SHOT [SHOT...]  -> one row per shot (up to 8 frames each)
MODE=$1; OUT=$2; shift 2
TMP=$(mktemp -d)
i=0
for S in "$@"; do
  D=/opt/work/renders/$MODE/$S
  files=($(ls $D/*.png | sort))
  n=${#files[@]}
  sel=()
  for k in 0 1 2 3 4 5 6 7; do idx=$(( k * (n-1) / 7 )); sel+=("${files[$idx]}"); done
  args=""; for f in "${sel[@]}"; do args="$args -i $f"; done
  ffmpeg -v error -y $args -filter_complex "$(for k in 0 1 2 3 4 5 6 7; do echo -n "[$k]scale=180:320,drawtext=text='$S $(basename ${sel[$k]} .png)':x=3:y=3:fontsize=13:fontcolor=yellow:box=1:boxcolor=black[v$k];"; done)[v0][v1][v2][v3][v4][v5][v6][v7]hstack=8" $TMP/row_$i.png
  i=$((i+1))
done
ffmpeg -v error -y $(for k in $(seq 0 $((i-1))); do echo -n "-i $TMP/row_$k.png "; done) -filter_complex "vstack=$i" $OUT 2>/dev/null || cp $TMP/row_0.png $OUT
rm -rf $TMP
echo "sheet $OUT"
