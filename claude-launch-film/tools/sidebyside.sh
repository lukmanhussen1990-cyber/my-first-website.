#!/bin/bash
# sidebyside.sh <ref_mp4> <new_mp4> <out_mp4> : stacked reference (top) vs recreation (bottom), 1280x1440
set -e
ffmpeg -hide_banner -loglevel error -y -i "$1" -i "$2" -filter_complex \
 "[0:v]scale=1280:720,drawtext=text='Reference':x=20:y=20:fontsize=28:fontcolor=white:box=1:boxcolor=black@0.5[a];[1:v]scale=1280:720,drawtext=text='Claude recreation':x=20:y=20:fontsize=28:fontcolor=white:box=1:boxcolor=black@0.5[b];[a][b]vstack=inputs=2[v]" \
 -map "[v]" -map 1:a -c:v libx264 -preset medium -crf 20 -pix_fmt yuv420p -c:a aac -b:a 160k "$3"
