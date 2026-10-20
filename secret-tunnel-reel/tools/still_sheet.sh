#!/usr/bin/env bash
# Contact sheet from rendered stills (no video): renders START..END at RATE fps
# at half resolution and tiles them with timestamps.
#   tools/still_sheet.sh START END out.jpg [rate] [cols]
set -euo pipefail
cd "$(dirname "$0")/.."
a=$1; b=$2; out=$3; rate=${4:-4}; cols=${5:-8}
dir=build/sheet_$$
times=$(python3 -c "import sys; a,b,r=float('$a'),float('$b'),float('$rate'); n=int(round((b-a)*r)); print(','.join(f'{a+i/r:.3f}' for i in range(n+1)))")
node render.mjs stills "$times" --spp 1 --scale 0.5 --out "$dir" --prefix s > /dev/null
for f in "$dir"/s*.png; do
  t=$(basename "$f" .png | sed 's/^s0*//')
  convert "$f" -resize 180x320 -fill white -undercolor '#0008' -pointsize 16 -annotate +4+16 "$t" "$f"
done
montage "$dir"/s*.png -tile "${cols}x" -geometry +2+2 -background '#111' "$out"
rm -rf "$dir"
echo "$out"
