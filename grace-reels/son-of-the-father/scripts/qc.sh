#!/usr/bin/env bash
# QC for the final render: contact sheet every 2 s, loudness / true peak, duration, streams.
set -euo pipefail
cd "$(dirname "$0")/.."
IN=${1:-out/final_reel.mp4}
ffmpeg -v error -y -i "$IN" -vf "fps=0.5,scale=216:384,tile=8x6:padding=4:color=0x141414" -frames:v 1 out/qc_contact.jpg
echo "contact sheet -> out/qc_contact.jpg"
ffprobe -v error -show_entries format=duration:stream=codec_name,width,height,r_frame_rate,pix_fmt,sample_rate,channels,bit_rate -of default=nw=1 "$IN"
ffmpeg -nostats -i "$IN" -af ebur128=peak=true -f null - 2>&1 | grep -A12 "Summary:" | grep -E "I:|LRA:|Peak:"
