#!/usr/bin/env bash
# Final export, no 3D rendering: the silent, subtitle-free render (render/clean.mp4)
# + the mix (build/mix.wav) + the subtitles burned in (build/captions.ass)
# -> tornado-shelter.mp4 (H.264 High, yuv420p, 1080x1920, 30 fps, AAC 192k 48 kHz).
#   tools/export.sh                  (IN=..., MIX=..., ASS=..., OUT=... to override)
# Quality first (crf 19); if that file is bigger than MAXMB (95 MB: it has to fit in
# git), it is re-encoded in two passes at the bitrate that fits.
set -euo pipefail
cd "$(dirname "$0")/.."
IN=${IN:-render/clean.mp4}
MIX=${MIX:-build/mix.wav}
ASS=${ASS:-build/captions.ass}
OUT=${OUT:-tornado-shelter.mp4}
MAXMB=${MAXMB:-95}
for f in "$IN" "$MIX" "$ASS"; do
  [ -f "$f" ] || { echo "missing $f (run ./make_reel.sh once to render the video)" >&2; exit 1; }
done
VF="ass=$ASS:fontsdir=assets/fonts,format=yuv420p"
X264=(-c:v libx264 -preset slow -profile:v high -level 4.2 -pix_fmt yuv420p -r 30 -g 60)
AAC=(-c:a aac -b:a 192k -ar 48000 -ac 2)
ffmpeg -v error -y -i "$IN" -i "$MIX" -vf "$VF" -map 0:v:0 -map 1:a:0 "${X264[@]}" -crf 19 "${AAC[@]}" -movflags +faststart -shortest "$OUT"
size=$(stat -c %s "$OUT")
if [ "$size" -gt $((MAXMB * 1000000)) ]; then
  dur=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$OUT")
  kbps=$(awk -v mb="$MAXMB" -v d="$dur" 'BEGIN { printf "%d", (mb * 8000 / d - 192) * 0.975 }')
  echo "crf 19 gives $((size / 1000000)) MB: two-pass at ${kbps} kb/s to fit ${MAXMB} MB"
  log=build/x264_2pass
  ffmpeg -v error -y -i "$IN" -vf "$VF" -map 0:v:0 "${X264[@]}" -b:v "${kbps}k" -pass 1 -passlogfile "$log" -an -f null /dev/null
  ffmpeg -v error -y -i "$IN" -i "$MIX" -vf "$VF" -map 0:v:0 -map 1:a:0 "${X264[@]}" -b:v "${kbps}k" -maxrate "$((kbps * 2))k" -bufsize "$((kbps * 4))k" \
    -pass 2 -passlogfile "$log" "${AAC[@]}" -movflags +faststart -shortest "$OUT"
  rm -f "$log"*
fi
echo "done -> $OUT ($(($(stat -c %s "$OUT") / 1000000)) MB)"
