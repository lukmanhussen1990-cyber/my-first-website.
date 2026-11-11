#!/bin/bash
# Encode frames + mixed audio to the final 1080x1920 30fps MP4.   usage: bash tools/finish.sh [frames_dir]
cd "$(dirname "$0")/.."; D=${1:-frames/hd}
ffmpeg -v error -y -framerate 30 -start_number 0 -i "$D/f_%06d.jpg" -i audio/mix.wav \
  -vf "scale=1080:1920:flags=lanczos,unsharp=5:5:0.5:5:5:0.0" -r 30 -c:v libx264 -preset medium -crf 17 -pix_fmt yuv420p \
  -af "loudnorm=I=-14:TP=-1.5:LRA=11" -ar 48000 -c:a aac -b:a 192k -movflags +faststart -shortest caveman_toilet.mp4
ffprobe -v error -show_entries format=duration,size:stream=codec_name,width,height,r_frame_rate -of default=nw=1 caveman_toilet.mp4 | tr '\n' ' '; echo
