#!/usr/bin/env bash
# Burn the captions onto rendered stills (no video): renders each time and
# draws build/captions.ass over it at that moment.
#   tools/sub_still.sh "t1,t2,..." out_dir [scale]
set -euo pipefail
cd "$(dirname "$0")/.."
times=$1; out=$2; scale=${3:-0.5}
node render.mjs stills "$times" --spp 2 --scale "$scale" --out "$out" --prefix raw > /dev/null
for t in ${times//,/ }; do
  f=$(printf "%s/raw%06.2f.png" "$out" "$t")
  ffmpeg -v error -y -loop 1 -i "$f" -vf "setpts=PTS-STARTPTS+${t}/TB,ass=build/captions.ass:fontsdir=assets" -frames:v 1 "$out/sub_$(basename "$f" .png | sed 's/^raw//').png"
done
echo "$out"
