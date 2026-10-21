#!/usr/bin/env bash
# Final export, no 3D rendering: the silent, subtitle-free render (render/clean.mp4)
# + the mix (build/mix.wav) + the subtitles burned in (build/captions.ass)
# -> report-card.mp4 (H.264 High, yuv420p, 1080x1920, 30 fps, AAC 192k 48 kHz).
#   tools/export.sh                  (IN=..., MIX=..., ASS=..., OUT=... to override)
set -euo pipefail
cd "$(dirname "$0")/.."
IN=${IN:-render/clean.mp4}
MIX=${MIX:-build/mix.wav}
ASS=${ASS:-build/captions.ass}
OUT=${OUT:-report-card.mp4}
for f in "$IN" "$MIX" "$ASS"; do
  [ -f "$f" ] || { echo "missing $f (run ./make_reel.sh once to render the video)" >&2; exit 1; }
done
ffmpeg -v error -y -i "$IN" -i "$MIX" \
  -vf "ass=$ASS:fontsdir=assets,format=yuv420p" \
  -map 0:v:0 -map 1:a:0 -c:v libx264 -preset slow -crf 19 -profile:v high -level 4.2 -pix_fmt yuv420p \
  -r 30 -g 60 -c:a aac -b:a 192k -ar 48000 -ac 2 -movflags +faststart -shortest "$OUT"
echo "done -> $OUT"
