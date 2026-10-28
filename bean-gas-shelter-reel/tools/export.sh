#!/usr/bin/env bash
# Final export, no 3D rendering: the silent, subtitle-free render (render/clean.mp4)
# + the mix (build/mix.wav) + the subtitles burned in (build/captions.ass)
# -> bean-gas-shelter.mp4 (H.264 High, yuv420p, 1080x1920, 30 fps, AAC 128k 48 kHz),
# kept under MAXMB megabytes (19, so it stays under 20 MB however MB is counted):
# a two-pass encode at the bitrate that fits, slower preset for the most quality per bit.
#   tools/export.sh                  (IN=..., MIX=..., ASS=..., OUT=..., MAXMB=... to override)
set -euo pipefail
cd "$(dirname "$0")/.."
IN=${IN:-render/clean.mp4}
MIX=${MIX:-build/mix.wav}
ASS=${ASS:-build/captions.ass}
OUT=${OUT:-bean-gas-shelter.mp4}
MAXMB=${MAXMB:-19}
for f in "$IN" "$MIX" "$ASS"; do
  [ -f "$f" ] || { echo "missing $f (run ./make_reel.sh once to render the video)" >&2; exit 1; }
done
VF="ass=$ASS:fontsdir=assets/fonts,format=yuv420p"
X264=(-c:v libx264 -preset slower -profile:v high -level 4.2 -pix_fmt yuv420p -r 30 -g 60)
AAC=(-c:a aac -b:a 128k -ar 48000 -ac 2)
dur=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$IN")
log=build/x264_2pass
for margin in 0.97 0.93 0.89; do
  kbps=$(awk -v mb="$MAXMB" -v d="$dur" -v m="$margin" 'BEGIN { printf "%d", (mb * 8000 / d - 128) * m }')
  echo "two-pass at ${kbps} kb/s to fit ${MAXMB} MB"
  ffmpeg -v error -y -i "$IN" -vf "$VF" -map 0:v:0 "${X264[@]}" -b:v "${kbps}k" -pass 1 -passlogfile "$log" -an -f null /dev/null
  ffmpeg -v error -y -i "$IN" -i "$MIX" -vf "$VF" -map 0:v:0 -map 1:a:0 "${X264[@]}" -b:v "${kbps}k" -maxrate "$((kbps * 2))k" -bufsize "$((kbps * 4))k" \
    -pass 2 -passlogfile "$log" "${AAC[@]}" -movflags +faststart -shortest "$OUT"
  rm -f "$log"*
  [ "$(stat -c %s "$OUT")" -le $((MAXMB * 1000000)) ] && break
done
echo "done -> $OUT ($(stat -c %s "$OUT") bytes)"
