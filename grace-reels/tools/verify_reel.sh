#!/usr/bin/env bash
# Check a finished reel: format, timing, loudness, black frames; and make review contact sheets.
#   tools/verify_reel.sh out/reel_the-mountain.mp4
set -euo pipefail
F="$1"
echo "== streams"
ffprobe -v error -show_entries stream=codec_name,profile,width,height,pix_fmt,r_frame_rate,nb_frames,sample_rate,channels,bit_rate -of default=nw=1 "$F"
echo "== container"
ffprobe -v error -show_entries format=duration,size,bit_rate -of default=nw=1 "$F"
echo "== loudness (EBU R128)"
ffmpeg -hide_banner -nostats -i "$F" -map 0:a -af ebur128=peak=true -f null - 2>&1 | grep -E "^\s+(I|LRA|Peak):" | tail -3
echo "== black frames (>= 0.1 s)"
ffmpeg -hide_banner -nostats -i "$F" -vf "blackdetect=d=0.1:pix_th=0.06" -an -f null - 2>&1 | grep -o "black_start.*" || echo "none"
echo "== contact sheets (one frame per second)"
D=$(dirname "$F")/stills/review
mkdir -p "$D"
rm -f "$D"/*.jpg
ffmpeg -v error -y -i "$F" -vf "fps=1,scale=270:-1,tile=10x2" "$D/sheet_%02d.jpg"
ls "$D"
