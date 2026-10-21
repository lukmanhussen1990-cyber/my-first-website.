#!/usr/bin/env bash
# Renders all 1500 frames (50 s @ 30 fps) in parallel segments, then joins them.
# Resumable: finished segments are skipped. WORKERS / SEG can be overridden.
set -euo pipefail
cd "$(dirname "$0")"
OUT="$(cd .. && pwd)/output/segments"; mkdir -p "$OUT"
WORKERS=${WORKERS:-3}; SEG=${SEG:-50}; TOTAL=${TOTAL:-1500}; CRF=${CRF:-12}
export OUT SEG CRF
seq 0 "$SEG" $((TOTAL - 1)) | xargs -P "$WORKERS" -I{} bash -c '
  f={}; n=$(printf %04d "$f"); o="$OUT/seg_$n.mp4"
  if [ ! -f "$o" ]; then node render.mjs video --from "$f" --to $((f + SEG)) --crf "$CRF" --out "$o" > "$OUT/log_$n.txt" 2>&1 && echo "segment $n done"; fi'
ls "$OUT"/seg_*.mp4 | sort | sed "s/^/file '/; s/\$/'/" > "$OUT/list.txt"
ffmpeg -y -loglevel error -f concat -safe 0 -i "$OUT/list.txt" -c copy ../output/video_master.mp4
echo "joined -> output/video_master.mp4"
# lighter copy used by export (and small enough to keep in git)
ffmpeg -y -loglevel error -i ../output/video_master.mp4 -c:v libx264 -preset slow -crf 15 -tune animation -pix_fmt yuv420p \
  -color_primaries bt709 -color_trc bt709 -colorspace bt709 -movflags +faststart ../output/video_clean.mp4
echo "wrote output/video_clean.mp4"
