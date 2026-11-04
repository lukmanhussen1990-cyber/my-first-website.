#!/bin/bash
# Build the reel: POV text -> sound effects -> song + sfx mix -> shots (parallel) -> final.mp4 (CRF 16, AAC 192k)
#   ./make_reel.sh                 full build -> final.mp4
#   SKIP_AUDIO=1 ./make_reel.sh    reuse audio/captions.ass + audio/mix_final.wav
#   SKIP_RENDER=1 ./make_reel.sh   reuse build/seg_*.mp4 (re-mux only)
#   JOBS=4 (parallel shot renders), OUT=final.mp4
set -euo pipefail
cd "$(dirname "$0")"
OUT=${OUT:-final.mp4}
JOBS=${JOBS:-4}
mkdir -p build

if [ -z "${SKIP_AUDIO:-}" ]; then
  python3 make_text.py
  python3 make_sfx.py | tail -1
  python3 mix_reel.py | tail -2
fi

if [ -z "${SKIP_RENDER:-}" ]; then
  JOBS=$JOBS python3 render.py
fi

N=$(python3 -c "import json;print(len(json.load(open('shots.json'))['shots']))")
DUR=$(python3 -c "import json;print(json.load(open('shots.json'))['duration'])")
: > build/concat.txt
for i in $(seq -w 1 $N); do
  [ ${#i} -lt 2 ] && i="0$i"
  echo "file 'seg_$(printf %02d $((10#$i))).mp4'" >> build/concat.txt
done
ffmpeg -v error -y -f concat -safe 0 -i build/concat.txt -i audio/mix_final.wav -t "$DUR" \
  -vf "subtitles=audio/captions.ass:fontsdir=fonts" \
  -c:v libx264 -preset slow -crf 16 -pix_fmt yuv420p -profile:v high -level 4.2 -r 30 \
  -c:a aac -b:a 192k -ar 48000 -movflags +faststart "$OUT"
echo "wrote $OUT"
ffprobe -v error -show_entries format=duration,size:stream=codec_name,width,height,r_frame_rate -of compact "$OUT"
ffmpeg -hide_banner -i "$OUT" -af ebur128=peak=true -f null - 2>&1 | grep -A12 "Summary" | grep -E "I:|Peak:" || true
