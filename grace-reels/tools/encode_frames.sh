#!/bin/bash
# Encode a frame folder from tools/render_frames.mjs into the final reel:
# H.264 CRF 18, yuv420p, BT.709 (converted from the JPEG frames' full-range BT.601), AAC 48 kHz.
# The colorspace filter does the matrix + range change exactly; plain swscale shifts it by ~2 levels.
#   tools/encode_frames.sh <framesDir> <mix.wav> <out.mp4> [fps]
set -euo pipefail
FR=$1; AUD=$2; OUT=$3; FPS=${4:-30}
SEQ=$(mktemp -d)
trap 'rm -rf "$SEQ"' EXIT
# frames are named by frame number; link them as one gap-free sequence (and fail on a gap)
n=0
for f in $(ls "$FR" | sed -nE 's/^element-([0-9]+)\.jpeg$/\1/p' | sort -n); do
  if [ $((10#$f)) -ne $n ]; then echo "frame $n is missing" >&2; exit 1; fi
  ln -s "$(realpath "$FR/element-$f.jpeg")" "$SEQ/$(printf 'f_%05d.jpeg' $n)"
  n=$((n + 1))
done
echo "encoding $n frames"
ffmpeg -hide_banner -loglevel error -stats -y \
  -framerate "$FPS" -i "$SEQ/f_%05d.jpeg" -i "$AUD" \
  -map 0:v -map 1:a \
  -vf "colorspace=space=bt709:ispace=bt470bg:primaries=bt709:iprimaries=bt709:trc=bt709:itrc=bt709:irange=pc:range=tv:format=yuv420p" \
  -c:v libx264 -preset medium -crf 18 -profile:v high -g 60 \
  -color_primaries bt709 -color_trc bt709 -colorspace bt709 -color_range tv \
  -c:a aac -b:a 256k -ar 48000 -ac 2 \
  -movflags +faststart "$OUT"
