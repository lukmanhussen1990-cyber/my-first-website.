#!/bin/bash
# Encode a STEP=2 preview frame folder (every 2nd frame) at 15 fps with a mix.
#   tools/encode_preview.sh <framesDir> <mix.wav> <out.mp4>
set -euo pipefail
FR=$1; AUD=$2; OUT=$3
SEQ=$(mktemp -d)
trap 'rm -rf "$SEQ"' EXIT
n=0
for f in $(ls "$FR" | sed -nE 's/^element-([0-9]+)\.jpeg$/\1/p' | sort -n); do
  ln -s "$(realpath "$FR/element-$f.jpeg")" "$SEQ/$(printf 'f_%05d.jpeg' $n)"
  n=$((n + 1))
done
ffmpeg -hide_banner -loglevel error -y -framerate 15 -i "$SEQ/f_%05d.jpeg" -i "$AUD" -map 0:v -map 1:a \
  -vf "scale=360:640:flags=lanczos,colorspace=space=bt709:ispace=bt470bg:primaries=bt709:iprimaries=bt709:trc=bt709:itrc=bt709:irange=pc:range=tv:format=yuv420p" \
  -c:v libx264 -preset veryfast -crf 23 -color_primaries bt709 -color_trc bt709 -colorspace bt709 -color_range tv \
  -c:a aac -b:a 160k -ar 48000 -shortest -movflags +faststart "$OUT"
echo "preview: $n frames -> $OUT"
