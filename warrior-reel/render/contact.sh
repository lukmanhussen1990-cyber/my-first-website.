#!/usr/bin/env bash
# Contact sheet of film frames: render/contact.sh "t1,t2,..." out/previews/film/sheet.png [cols] [w] [h]
set -euo pipefail
cd "$(dirname "$0")/.."
TIMES=$1; OUT=$2; COLS=${3:-6}; W=${4:-360}; H=${5:-640}
DIR=$(mktemp -d out/previews/.contact.XXXX)
node render/shoot.mjs --q "entry=film" --times "$TIMES" --out "$DIR/f" --w "$W" --h "$H" >/dev/null
N=$(ls "$DIR"/f_t*.png | wc -l)
ROWS=$(( (N + COLS - 1) / COLS ))
i=0
for t in $(ls "$DIR"/f_t*.png | sed -E 's#.*/f_t([0-9.]+)\.png#\1#' | sort -g); do
  f="$DIR/f_t$t.png"
  ffmpeg -v error -y -i "$f" -vf "drawtext=fontfile=assets/fonts/Silkscreen-Regular.ttf:text='$t':x=8:y=8:fontsize=22:fontcolor=white:box=1:boxcolor=black@0.6" "$DIR/l_$(printf %03d $i).png"
  i=$((i+1))
done
mkdir -p "$(dirname "$OUT")"
ffmpeg -v error -y -framerate 1 -i "$DIR/l_%03d.png" -vf "tile=${COLS}x${ROWS}:padding=4:color=black" -frames:v 1 "$OUT"
rm -rf "$DIR"
echo "wrote $OUT ($N frames)"
