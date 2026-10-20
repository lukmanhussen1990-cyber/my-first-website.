#!/usr/bin/env bash
# Quality check without a video: render stills at the given times, burn the
# subtitles onto them (as the final export will) and tile them with time labels.
#   tools/qa_sheet.sh "3,12.5,20" out.jpg [scale=0.5] [spp=2] [cols=4]
set -euo pipefail
cd "$(dirname "$0")/.."
times=$1; out=$2; scale=${3:-0.5}; spp=${4:-2}; cols=${5:-4}
dir=build/qa_$$
node render.mjs stills "$times" --spp "$spp" --scale "$scale" --out "$dir" --prefix raw > /dev/null
for t in ${times//,/ }; do
  f=$(printf "%s/raw%06.2f.png" "$dir" "$t")
  ffmpeg -v error -y -loop 1 -i "$f" -vf "setpts=PTS-STARTPTS+${t}/TB,ass=build/captions.ass:fontsdir=assets" -frames:v 1 "$dir/sub_$(printf '%06.2f' "$t").png"
  convert "$dir/sub_$(printf '%06.2f' "$t").png" -resize 360x640 -fill white -undercolor '#000a' -pointsize 20 -annotate +6+22 " ${t}s " "$dir/sub_$(printf '%06.2f' "$t").png"
done
montage "$dir"/sub_*.png -tile "${cols}x" -geometry +3+3 -background '#111' -quality 86 "$out"
rm -rf "$dir"
echo "$out"
