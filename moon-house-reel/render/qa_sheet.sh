#!/usr/bin/env bash
# Build contact sheets from stills, marking the subtitle band (32-40% from top) and the bottom 20% UI zone.
# usage: render/qa_sheet.sh build/qa 7
dir=$1; cols=${2:-7}
mkdir -p "$dir/annot"
for f in "$dir"/still_*.png; do
  b=$(basename "$f" .png); t=${b#still_}
  ffmpeg -v error -y -i "$f" -vf "scale=360:640,drawbox=y=ih*0.32:h=ih*0.08:w=iw:h=ih*0.08:color=yellow@0.18:t=fill,drawbox=y=ih*0.8:w=iw:h=2:color=red@0.7:t=fill,drawtext=text='$t':x=6:y=6:fontsize=22:fontcolor=white:box=1:boxcolor=black@0.5" "$dir/annot/$b.png"
done
ls "$dir"/annot/still_*.png | sort -t_ -k2 -g > "$dir/list.txt"
n=$(wc -l < "$dir/list.txt"); i=0; sheet=0
while [ $i -lt $n ]; do
  files=$(sed -n "$((i+1)),$((i+cols))p" "$dir/list.txt")
  inputs=""; k=0; for f in $files; do inputs="$inputs -i $f"; k=$((k+1)); done
  if [ $k -gt 1 ]; then ffmpeg -v error -y $inputs -filter_complex "hstack=inputs=$k" "$dir/sheet_$sheet.jpg"; else cp $files "$dir/sheet_$sheet.jpg"; fi
  i=$((i+cols)); sheet=$((sheet+1))
done
ls "$dir"/sheet_*.jpg
