#!/bin/bash
# encode.sh <frames_dir> <audio_wav> <out_mp4>
# Untagged BT.601 round trip like the source (decoded with the same default matrix), 30 fps.
set -e
ffmpeg -hide_banner -loglevel error -y -framerate 30 -i "$1/f%04d.png" -i "$2" \
  -map 0:v -map 1:a -c:v libx264 -preset slow -crf 14 -profile:v high -pix_fmt yuv420p \
  -x264-params "keyint=60:min-keyint=30" -c:a aac -b:a 192k -ar 44100 -ac 2 \
  -movflags +faststart "$3"
ffprobe -v error -show_entries stream=codec_name,width,height,r_frame_rate,nb_frames,duration -of compact "$3"
