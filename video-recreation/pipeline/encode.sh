#!/usr/bin/env bash
# 254 frames @ 30fps + the reference AAC stream copied through untouched,
# so audio sync is identical to the source by construction.
set -euo pipefail
W="${1:?usage: encode.sh <workdir>}"
FF="$(python3 -c 'import imageio_ffmpeg; print(imageio_ffmpeg.get_ffmpeg_exe())')"
"$FF" -y -framerate 30 -i "$W/out/%04d.png" -i "$W/original_audio.m4a" \
  -map 0:v -map 1:a \
  -c:v libx264 -profile:v high -pix_fmt yuv420p -crf 17 -preset slow \
  -colorspace bt709 -color_primaries bt709 -color_trc bt709 \
  -c:a copy -movflags +faststart "$W/claude-opus5-imran.mp4"
