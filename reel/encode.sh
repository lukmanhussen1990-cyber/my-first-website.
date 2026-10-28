#!/usr/bin/env bash
# Join frames + sound into the final MP4 (H.264 + AAC), loudness-normalised.
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p out
# two-pass loudness normalisation to -14 LUFS for Instagram
stats=$(ffmpeg -hide_banner -i mix.wav -af loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json -f null - 2>&1 | sed -n '/^{/,/^}/p')
get() { echo "$stats" | python3 -c "import json,sys; print(json.load(sys.stdin)['$1'])"; }
ffmpeg -hide_banner -v error -y -framerate 30 -i frames/f_%05d.jpg -i mix.wav \
  -af "loudnorm=I=-14:TP=-1.5:LRA=11:measured_I=$(get input_i):measured_TP=$(get input_tp):measured_LRA=$(get input_lra):measured_thresh=$(get input_thresh):offset=$(get target_offset):linear=true,aresample=48000" \
  -c:v libx264 -preset slow -crf 18 -pix_fmt yuv420p -profile:v high -level 4.2 -tune film \
  -c:a aac -b:a 192k -ar 48000 -movflags +faststart -shortest out/reel.mp4
echo "built out/reel.mp4"
