#!/usr/bin/env bash
# Render the 3D (no sound, no subtitles) in chunks and join them:
#   tools/render_chunks.sh                    -> render/clean.mp4 (full size, SPP samples per frame)
#   SCALE=0.5 SPP=1 tools/render_chunks.sh    -> build/preview_clean.mp4 (a quick preview)
# Each chunk of CHUNK frames is rendered in parts of PART frames, each in a fresh
# browser; finished parts and chunks are kept, so an interrupted render (a restart)
# picks up where it stopped, losing at most one part. One job at a time: the software
# GPU already uses every core.
set -euo pipefail
cd "$(dirname "$0")/.."
SPP=${SPP:-2}
SCALE=${SCALE:-1}
CHUNK=${CHUNK:-250}
PART=${PART:-125}
FRAMES=$(node -e "import('./src/timeline.js').then(m => console.log(Math.round(m.DURATION * m.FPS)))")
TAG=$(echo "s${SCALE}_p${SPP}" | tr . _)
DIR=build/chunks_$TAG
mkdir -p "$DIR" render
frames_in() { ffprobe -v error -count_frames -select_streams v -show_entries stream=nb_read_frames -of csv=p=0 "$1" 2>/dev/null || true; }

todo=0
for ((f = 0; f < FRAMES; f += CHUNK)); do
  e=$((f + CHUNK < FRAMES ? f + CHUNK : FRAMES))
  [ "$(frames_in "$(printf "%s/c_%04d.mp4" "$DIR" "$f")")" = "$((e - f))" ] || todo=$((todo + 1))
done
echo "rendering $todo chunk(s) of $FRAMES frames into $DIR"
for ((f = 0; f < FRAMES; f += CHUNK)); do
  e=$((f + CHUNK < FRAMES ? f + CHUNK : FRAMES))
  out=$(printf "%s/c_%04d.mp4" "$DIR" "$f")
  [ "$(frames_in "$out")" = "$((e - f))" ] && continue
  : > "$out.parts"
  for ((p = f; p < e; p += PART)); do
    pe=$((p + PART < e ? p + PART : e))
    part=$(printf "%s/c_%04d.part_%04d.mp4" "$DIR" "$f" "$p")
    echo "file '$(basename "$part")'" >> "$out.parts"
    [ "$(frames_in "$part")" = "$((pe - p))" ] && continue
    node render.mjs video "$p" "$pe" "$part" --spp "$SPP" --scale "$SCALE" > "$part.log" 2>&1 || { echo "part $p-$pe failed, see $part.log" >&2; exit 1; }
  done
  ffmpeg -v error -y -f concat -safe 0 -i "$out.parts" -c copy "$out"
  [ "$(frames_in "$out")" = "$((e - f))" ] || { echo "chunk $f-$e did not join" >&2; exit 1; }
  # one log per chunk (the parts' logs, in order), then the parts go
  cat $(printf "%s/c_%04d.part_*.mp4.log" "$DIR" "$f") > "$out.log"
  rm -f "$out.parts" $(printf "%s/c_%04d.part_*" "$DIR" "$f")
done

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
