#!/usr/bin/env bash
# Full build of the reel: timeline -> sound -> subtitles -> 3D frames -> MP4.
#   ./make_reel.sh                      final quality (SPP=3, full size)
#   SCALE=0.5 SPP=1 ./make_reel.sh      a quick half-size preview (build/preview.mp4)
# The voices are not remade here (they are files in assets/vo, see tools/voices.py
# and revoice.sh). The silent, subtitle-free render is kept as render/clean.mp4, so
# new voices or subtitles can be exported later without re-rendering the 3D.
# The 3D is rendered in chunks of CHUNK frames, each in a fresh browser (a long-running
# renderer slowly grows in memory), JOBS at a time; finished chunks are kept, so an
# interrupted build picks up where it stopped. Each job needs up to ~3 GB of memory.
# Needs: node + playwright (Chromium), ffmpeg with libass/libx264, and a python with
# numpy scipy soundfile pillow (PY=/path/to/python).
set -euo pipefail
cd "$(dirname "$0")"
PY=${PY:-/home/user/reel-venv/bin/python}
SPP=${SPP:-3}
SCALE=${SCALE:-1}
JOBS=${JOBS:-3}
CHUNK=${CHUNK:-100}

node tools/export_timeline.mjs
"$PY" tools/audio.py
"$PY" tools/captions.py

FRAMES=$(node -e "import('./src/timeline.js').then(m => console.log(Math.round(m.DURATION * m.FPS)))")
TAG=$(echo "s${SCALE}_p${SPP}" | tr . _)
DIR=build/chunks_$TAG
mkdir -p "$DIR" render
: > "$DIR/todo.txt"
for ((f = 0; f < FRAMES; f += CHUNK)); do
  e=$((f + CHUNK < FRAMES ? f + CHUNK : FRAMES))
  out=$(printf "%s/c_%04d.mp4" "$DIR" "$f")
  # keep a chunk only if it is complete
  if [ -f "$out" ] && [ "$(ffprobe -v error -count_frames -select_streams v -show_entries stream=nb_read_frames -of csv=p=0 "$out" 2>/dev/null)" = "$((e - f))" ]; then continue; fi
  echo "$f $e $out" >> "$DIR/todo.txt"
done
echo "rendering $(wc -l < "$DIR/todo.txt") chunk(s) of $FRAMES frames into $DIR"
xargs -P "$JOBS" -L 1 sh -c 'node render.mjs video $0 $1 $2 --spp '"$SPP"' --scale '"$SCALE"' > $2.log 2>&1 || { echo "chunk $0-$1 failed, see $2.log" >&2; exit 255; }' < "$DIR/todo.txt"

# join the chunks in order (decoded one by one, so they join cleanly)
inputs=() filter="" n=0
for ((f = 0; f < FRAMES; f += CHUNK)); do
  inputs+=(-i "$(printf "%s/c_%04d.mp4" "$DIR" "$f")")
  filter+="[$n:v]"
  n=$((n + 1))
done
if [ "$SCALE" = 1 ]; then
  ffmpeg -v error -y "${inputs[@]}" -filter_complex "${filter}concat=n=$n:v=1:a=0,format=yuv420p[v]" -map "[v]" \
    -c:v libx264 -preset slow -crf 19 -profile:v high -pix_fmt yuv420p -r 30 -movflags +faststart render/clean.mp4
  tools/export.sh
else
  # preview: scaled up to 1080x1920 so the subtitles burn in at their real size
  ffmpeg -v error -y "${inputs[@]}" -filter_complex "${filter}concat=n=$n:v=1:a=0,scale=1080:1920:flags=bicubic,format=yuv420p[v]" -map "[v]" \
    -c:v libx264 -preset veryfast -crf 20 -r 30 build/preview_clean.mp4
  IN=build/preview_clean.mp4 OUT=build/preview.mp4 tools/export.sh
fi
