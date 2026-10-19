#!/usr/bin/env bash
# Contact sheet of a video time range (4 frames per second) for quick motion review.
#   tools/review_sheet.sh video.mp4 START END out.jpg [cols]
set -euo pipefail
v=$1; a=$2; b=$3; out=$4; cols=${5:-8}
dir=$(mktemp -d)
ffmpeg -v error -copyts -ss "$a" -t "$(echo "$b - $a" | bc)" -i "$v" \
  -vf "fps=4,scale=180:-2,drawtext=fontfile=$(dirname "$0")/../assets/Fredoka-Bold.ttf:text='%{pts\:hms}':x=4:y=4:fontsize=16:fontcolor=white:box=1:boxcolor=black@0.5" \
  "$dir/f_%03d.png"
montage "$dir"/f_*.png -tile "${cols}x" -geometry +2+2 -background '#111' "$out"
rm -rf "$dir"
