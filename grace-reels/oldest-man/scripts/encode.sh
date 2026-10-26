#!/usr/bin/env bash
# Delivery encode from a full frame render (JPEG frames from `node render.mjs frames 0-2533 dir`, optionally with
# re-rendered ranges spliced in): H.264 (x264 slow, CRF 19, capped at 9 Mb/s), yuv420p TV range, BT.709,
# AAC 192k from audio/final_mix.wav, +faststart. Kept under 100 MB (GitHub file limit).
# usage: scripts/encode.sh build/frames_full out/final_reel.mp4 [fixdir:A:B ...]
#   each fixdir holds element-A.jpeg .. element-B.jpeg that replace the same frames of the full render
set -euo pipefail
cd "$(dirname "$0")/.."
SRC=$1; OUT=$2; shift 2
TMP=build/_encode_frames; rm -rf "$TMP"; mkdir -p "$TMP"
for f in "$SRC"/element-*.jpeg; do ln -s "$(realpath "$f")" "$TMP/$(basename "$f")"; done
for seg in "$@"; do
  IFS=: read -r dir a b <<< "$seg"
  for i in $(seq "$a" "$b"); do n=$(printf %04d "$i"); ln -sf "$(realpath "build/$dir/element-$n.jpeg")" "$TMP/element-$n.jpeg"; done
done
N=$(ls "$TMP" | wc -l); DUR=$(python3 -c "print($N / 30)")
ffmpeg -v error -y -framerate 30 -start_number 0 -i "$TMP/element-%04d.jpeg" -i audio/final_mix.wav \
  -vf "scale=in_range=full:out_range=tv:out_color_matrix=bt709,format=yuv420p" -map 0:v -map 1:a \
  -c:v libx264 -preset slow -crf 19 -maxrate 9M -bufsize 18M -g 60 -color_range tv -colorspace bt709 -color_primaries bt709 -color_trc bt709 \
  -af apad -c:a aac -b:a 192k -movflags +faststart -t "$DUR" "$OUT"
ffprobe -v error -show_entries format=duration,size:stream=codec_name,pix_fmt,nb_frames -of default=nw=1 "$OUT"
