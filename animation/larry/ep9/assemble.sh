#!/bin/bash
# Stitch Episode 9 shots, upscale to 1080x1920, grade, burn captions, mux the mix.
# Usage: ep9/assemble.sh <out.mp4> [draft|final] [captions|clean]
set -e
HERE=$(cd "$(dirname "$0")" && pwd)
S=${LARRY_WORK:-$HOME/larry_work}/ep9
OUTMP4=${1:-$S/larry_ep9_final.mp4}
MODE=${2:-final}
CAPS=${3:-captions}
FR=${FRAMES:-$S/frames}          # FRAMES=... assembles other frames (e.g. the storyboard animatic)
ALL=$S/all
rm -rf $ALL && mkdir -p $ALL
python3 -c "
from PIL import Image, ImageDraw
im=Image.new('RGB',(720,1280),(30,30,36)); d=ImageDraw.Draw(im); d.text((300,630),'RENDERING',fill=(200,200,200)); im.save('$S/placeholder.png')"
i=0; missing=0
for sh in $(python3 -c "import sys; sys.path.insert(0,'$HERE'); import cuts; print(' '.join(cuts.SHOT_NAMES))"); do
  n=$(python3 -c "import sys; sys.path.insert(0,'$HERE'); import cuts; print(cuts.frames_of('$sh'))")
  last=""
  for f in $(seq 1 $n); do
    src=$(printf "$FR/$sh/f_%04d.png" $f)
    if [ ! -f "$src" ]; then
      if [ -n "$last" ]; then src=$last; else src=$S/placeholder.png; missing=$((missing+1)); fi
    else last=$src; fi
    i=$((i+1))
    ln -s "$src" $(printf "$ALL/frame_%05d.png" $i)
  done
done
echo "frames: $i (placeholder frames: $missing)"
python3 $HERE/captions.py $S/captions.ass
cd $S
if [ "$MODE" = draft ]; then PRESET="-preset veryfast -crf 23"; else PRESET="-preset slow -crf 17"; fi
VF="scale=1080:1920:flags=lanczos,unsharp=5:5:0.35:5:5:0,eq=saturation=1.06:contrast=1.03"
[ "$CAPS" = captions ] && VF="$VF,subtitles=captions.ass:fontsdir=/opt/fonts"
nice -n 5 ffmpeg -hide_banner -loglevel error -y -framerate 24 -i $ALL/frame_%05d.png -i $S/mix.wav \
  -vf "$VF" -c:v libx264 $PRESET -pix_fmt yuv420p -r 24 -c:a aac -b:a 192k -ar 48000 -movflags +faststart -shortest "$OUTMP4"
ffprobe -v error -show_entries format=duration:stream=codec_name,width,height,r_frame_rate -of compact "$OUTMP4"
