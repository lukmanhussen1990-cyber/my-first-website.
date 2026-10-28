#!/bin/sh
# Two-pass H.264 at ~1.8 Mb/s + 128 kb/s AAC, still 1080x1920 -> stays under 20 MB for an ~80 s reel.
set -e
IN=${1:-out/reel_the-corners.mp4}
OUT=${2:-out/reel_the-corners_under20MB.mp4}
LOG=$(mktemp -d)/x264
ffmpeg -v error -y -i "$IN" -c:v libx264 -preset slow -b:v 1800k -maxrate 2600k -bufsize 3600k -pix_fmt yuv420p -profile:v high -pass 1 -passlogfile "$LOG" -an -f mp4 /dev/null
ffmpeg -v error -y -i "$IN" -c:v libx264 -preset slow -b:v 1800k -maxrate 2600k -bufsize 3600k -pix_fmt yuv420p -profile:v high -pass 2 -passlogfile "$LOG" \
  -c:a aac -b:a 128k -ar 48000 -movflags +faststart "$OUT"
ls -la "$OUT"
