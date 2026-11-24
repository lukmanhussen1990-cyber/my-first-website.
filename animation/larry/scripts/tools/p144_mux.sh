#!/bin/bash
# Assemble a 144p preview (or any partial set of frames) with the mix and captions; missing frames hold the last one.
# Usage: bash p144_mux.sh <episode_dir> <frames_dir> <work_dir_with_mix.wav> <out.mp4>
EPD=$(cd "$1" && pwd); FR=$2; W=$3; OUT=$4
A=$(mktemp -d)
i=0; last=""
for sh in $(python3 -c "import sys; sys.path.insert(0,'$EPD'); import cuts; print(' '.join(cuts.SHOT_NAMES))"); do
  n=$(python3 -c "import sys; sys.path.insert(0,'$EPD'); import cuts; print(cuts.frames_of('$sh'))")
  for f in $(seq 1 $n); do
    src=$(printf "$FR/$sh/f_%04d.png" $f); [ -f "$src" ] && last=$src || src=$last
    i=$((i+1)); [ -n "$src" ] && ln -s "$src" $(printf "$A/frame_%05d.png" $i)
  done
done
python3 $EPD/captions.py $A/c.ass > /dev/null
cd $A && ffmpeg -hide_banner -loglevel error -y -framerate 24 -i $A/frame_%05d.png -i $W/mix.wav \
  -vf "scale=288:512:flags=lanczos,subtitles=c.ass:fontsdir=/opt/fonts" -c:v libx264 -preset veryfast -crf 26 \
  -pix_fmt yuv420p -r 24 -c:a aac -b:a 96k -shortest -movflags +faststart "$OUT" && echo "MUXED $i frames -> $OUT"
