#!/bin/bash
# usage: src/export.sh framesDir out.mp4 width height crf
set -e
python3 src/audio.py out/sfx_music.wav; python3 src/captions.py out/captions.ass
ffmpeg -v error -y -framerate 30 -i "$1/f%04d.jpg" -i assets/voiceover.mp3 -i out/sfx_music.wav -filter_complex "[0:v]scale=$3:$4:flags=lanczos,ass=out/captions.ass:fontsdir=assets/fonts,fade=t=out:st=20.4:d=0.6,format=yuv420p[v];[1:a]volume=1.6,apad[vo];[2:a]volume=0.8[bg];[vo][bg]amix=inputs=2:duration=shortest:normalize=0,afade=t=out:st=20.3:d=0.7[a]" -map "[v]" -map "[a]" -t 21 -r 30 -c:v libx264 -crf $5 -preset slow -c:a aac -b:a 160k -movflags +faststart "$2"
