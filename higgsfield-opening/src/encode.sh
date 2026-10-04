#!/bin/bash
# Renders all frames, synthesises audio, and muxes the final MP4.
set -euo pipefail
cd "$(dirname "$0")"
FPS=60; DUR=6.0; OUT=${1:-higgsfield-opening.mp4}
rm -rf frames; node render.js anim.html frames $FPS $DUR 1920 1080
node audio.js
ffmpeg -v error -y -framerate $FPS -i frames/f%05d.png -i audio.wav \
  -c:v libx264 -preset slow -crf 17 -pix_fmt yuv420p -profile:v high -level 4.2 \
  -colorspace bt709 -color_primaries bt709 -color_trc bt709 \
  -c:a aac -b:a 192k -ar 48000 -shortest -movflags +faststart "$OUT"
ffprobe -v error -show_entries format=duration,size:stream=codec_name,width,height,r_frame_rate,pix_fmt,sample_rate,channels -of default=nw=1 "$OUT"
