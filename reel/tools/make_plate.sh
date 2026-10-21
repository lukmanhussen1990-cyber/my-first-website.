#!/usr/bin/env bash
# Join the lossless render segments into the subtitle-free "clean plate" (H.264, 1080x1920, 30 fps).
set -euo pipefail
cd "$(dirname "$0")/.."
ls build/seg/seg_*.mkv | sed "s#^#file '$(pwd)/#; s#\$#'#" > build/seg/list.txt
mkdir -p output
ffmpeg -y -loglevel error -f concat -safe 0 -i build/seg/list.txt -c:v libx264 -preset slow -crf "${CRF:-15}" -tune film \
  -pix_fmt yuv420p -r 30 -movflags +faststart output/clean_plate_no_subs.mp4
ffprobe -v error -show_entries stream=width,height,r_frame_rate,nb_frames -show_entries format=duration,size -of compact output/clean_plate_no_subs.mp4
