#!/usr/bin/env bash
# Full pipeline: assets -> frames (headless Chromium/WebGL) -> soundtrack -> final Instagram-ready MP4.
#   ./build.sh            # everything at 1080x1920, 30 fps
#   JOBS=2 ./build.sh     # render segments in parallel browser instances
set -euo pipefail
cd "$(dirname "$0")"
JOBS="${JOBS:-2}"
OUT=out
FINAL=what-if-the-moon-disappeared.mp4

npm install --no-audit --no-fund
pip install --quiet numpy scipy pillow pyloudnorm
./tools/fetch_assets.sh
python3 tools/prepare_assets.py
mkdir -p public/fonts "$OUT"
cp node_modules/@fontsource/montserrat/files/montserrat-latin-{700,800,900}-normal.woff2 public/fonts/

# Render in time segments (each segment is independent: every frame is a pure function of time).
DUR=$(python3 -c "import json;print(json.load(open('src/events.json'))['duration'])")
python3 - "$DUR" "$JOBS" > "$OUT/segments.txt" <<'EOF'
import sys
dur, jobs = float(sys.argv[1]), int(sys.argv[2])
step = dur / jobs
for i in range(jobs):
    a = round(i * step * 30) / 30
    b = dur if i == jobs - 1 else round((i + 1) * step * 30) / 30
    print(f"{a:.4f} {b:.4f} {i}")
EOF
pids=()
while read -r a b i; do
  node render.mjs --from "$a" --to "$b" --out "$OUT/seg_$i.mkv" > "$OUT/seg_$i.log" 2>&1 &
  pids+=($!)
done < "$OUT/segments.txt"
for p in "${pids[@]}"; do wait "$p"; done
: > "$OUT/concat.txt"
while read -r a b i; do echo "file 'seg_$i.mkv'" >> "$OUT/concat.txt"; done < "$OUT/segments.txt"

python3 audio/make_audio.py "$OUT/soundtrack.wav"

ffmpeg -y -loglevel error -f concat -safe 0 -i "$OUT/concat.txt" -i "$OUT/soundtrack.wav" \
  -map 0:v -map 1:a -c:v libx264 -preset slow -crf 17 -maxrate 12M -bufsize 24M \
  -profile:v high -level 4.1 -pix_fmt yuv420p -r 30 -g 60 -movflags +faststart \
  -c:a aac -b:a 320k -ar 48000 -ac 2 -shortest "$FINAL"
ffprobe -v error -show_entries stream=codec_name,width,height,r_frame_rate:format=duration,size -of compact "$FINAL"
