#!/usr/bin/env bash
# Render the 3D (no sound, no subtitles) in chunks and join them:
#   tools/render_chunks.sh                    -> render/clean.mp4 (full size, SPP samples per frame)
#   SCALE=0.5 SPP=1 tools/render_chunks.sh    -> build/preview_clean.mp4 (a quick preview)
# Each chunk of CHUNK frames renders in a fresh browser; finished chunks are kept, so an
# interrupted render picks up where it stopped. One job at a time: the software GPU
# already uses every core, parallel jobs only slow each other down.
set -euo pipefail
cd "$(dirname "$0")/.."
SPP=${SPP:-2}
SCALE=${SCALE:-1}
JOBS=${JOBS:-1}
CHUNK=${CHUNK:-250}
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

# join the chunks in order
inputs=() filter="" n=0
for ((f = 0; f < FRAMES; f += CHUNK)); do
  inputs+=(-i "$(printf "%s/c_%04d.mp4" "$DIR" "$f")")
  filter+="[$n:v]"
  n=$((n + 1))
done
if [ "$SCALE" = 1 ]; then
  ffmpeg -v error -y "${inputs[@]}" -filter_complex "${filter}concat=n=$n:v=1:a=0,format=yuv420p[v]" -map "[v]" \
    -c:v libx264 -preset slow -crf 17 -profile:v high -pix_fmt yuv420p -r 30 -movflags +faststart render/clean.mp4
  echo "done -> render/clean.mp4"
else
  # preview: scaled up to 1080x1920 so the subtitles burn in at their real size
  ffmpeg -v error -y "${inputs[@]}" -filter_complex "${filter}concat=n=$n:v=1:a=0,scale=1080:1920:flags=bicubic,format=yuv420p[v]" -map "[v]" \
    -c:v libx264 -preset veryfast -crf 20 -r 30 build/preview_clean.mp4
  echo "done -> build/preview_clean.mp4"
fi
