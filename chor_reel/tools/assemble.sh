#!/usr/bin/env bash
# Final assembly: lossless FFV1 render chunks -> H.264 1080x1920 30 fps + the ORIGINAL audio stream copied bit-exactly.
# usage: assemble.sh <scratch dir with render/chunk_*.mkv> <original animation mp4> <output mp4>
set -euo pipefail
SCR="$1"; ORIG="$2"; OUT="$3"
LIST="$SCR/render/chunks.txt"
: > "$LIST"
for c in "$SCR"/render/chunk_*.mkv; do echo "file '$c'" >> "$LIST"; done
ffmpeg -v error -y -f concat -safe 0 -i "$LIST" -i "$ORIG" \
  -map 0:v:0 -map 1:a:0 \
  -vf "scale=out_color_matrix=bt709:out_range=tv,format=yuv420p" \
  -c:v libx264 -preset slow -crf 18 -maxrate 7500k -bufsize 15000k -profile:v high -level 4.2 -r 30 -g 60 -keyint_min 30 \
  -color_range tv -colorspace bt709 -color_primaries bt709 -color_trc bt709 \
  -c:a copy \
  -metadata:s:v:0 handler_name=VideoHandler -metadata:s:a:0 handler_name=SoundHandler \
  -movflags +faststart "$OUT"
echo "wrote $OUT"
