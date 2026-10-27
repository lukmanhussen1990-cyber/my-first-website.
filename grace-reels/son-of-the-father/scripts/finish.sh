#!/usr/bin/env bash
# After the full frame render: encode the reel, QC it, cut the storyboard and the 6 s hook preview.
# usage: scripts/finish.sh [frames_dir]
set -euo pipefail
cd "$(dirname "$0")/.."
SRC=${1:-build/frames_full}
N=$(ls "$SRC"/element-*.jpeg | wc -l); echo "frames: $N"
scripts/encode.sh "$SRC" out/final_reel.mp4
ls -la out/final_reel.mp4
scripts/qc.sh out/final_reel.mp4
python3 scripts/storyboard.py out/final_reel.mp4 out/storyboard.jpg
ffmpeg -v error -y -i out/final_reel.mp4 -t 6 -c:v libx264 -preset slow -crf 20 -pix_fmt yuv420p -c:a aac -b:a 192k -movflags +faststart out/preview_6s.mp4
ls -la out/
