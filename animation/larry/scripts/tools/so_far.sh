#!/bin/bash
# "What's done so far": encode every fully rendered shot from the start (stops at the first incomplete one), full size,
# with the mix and captions. Never touches the running render.
# Usage: LARRY_WORK=~/larry_work bash so_far.sh <episode_dir> <out.mp4>
EPD=$(cd "$1" && pwd); OUT=$2; EP=$(basename $EPD)
W=${LARRY_WORK:-$HOME/larry_work}/$EP; A=$(mktemp -d); i=0
for sh in $(python3 -c "import sys; sys.path.insert(0,'$EPD'); import cuts; print(' '.join(cuts.SHOT_NAMES))"); do
  n=$(python3 -c "import sys; sys.path.insert(0,'$EPD'); import cuts; print(cuts.frames_of('$sh'))")
  c=$(ls $W/frames/$sh/f_*.png 2>/dev/null | wc -l); [ "$c" -lt "$n" ] && { echo "stop at $sh ($c/$n)"; break; }
  for f in $(seq 1 $n); do i=$((i+1)); ln -s $(printf "$W/frames/$sh/f_%04d.png" $f) $(printf "$A/frame_%05d.png" $i); done
done
python3 $EPD/captions.py $A/c.ass > /dev/null
T=$(python3 -c "print($i/24)")
cd $A && nice -n 10 ffmpeg -hide_banner -loglevel error -y -framerate 24 -i $A/frame_%05d.png -i $W/mix.wav -t $T \
  -vf "scale=1080:1920:flags=lanczos,unsharp=5:5:0.35:5:5:0,eq=saturation=1.06:contrast=1.03,subtitles=c.ass:fontsdir=/opt/fonts" \
  -c:v libx264 -preset veryfast -crf 21 -pix_fmt yuv420p -r 24 -c:a aac -b:a 192k -ar 48000 -movflags +faststart "$OUT" \
  && echo "SO_FAR $i frames ($T s) -> $OUT"
