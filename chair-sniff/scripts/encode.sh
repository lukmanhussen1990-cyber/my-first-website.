#!/usr/bin/env bash
# Step 5: frames + voiceover + burned-in captions -> final.mp4 (1080x1920, 30 fps, H.264 + AAC)
set -euo pipefail
cd "$(dirname "$0")/.."
FRAMES=${1:-build/frames}
ffmpeg -y -hide_banner -loglevel warning \
  -framerate 30 -start_number 1 -i "$FRAMES/f_%04d.jpg" \
  -i voiceover.mp3 \
  -vf "scale=1080:1920:flags=lanczos,subtitles=captions/captions.ass:fontsdir=fonts" \
  -c:v libx264 -preset slow -crf 18 -profile:v high -pix_fmt yuv420p -r 30 \
  -c:a aac -b:a 192k -ar 48000 \
  -map 0:v:0 -map 1:a:0 -shortest -movflags +faststart \
  final.mp4
ffprobe -v error -show_entries format=duration:stream=codec_name,width,height,r_frame_rate -of compact final.mp4
