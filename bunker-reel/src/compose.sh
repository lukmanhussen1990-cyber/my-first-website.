#!/usr/bin/env bash
# Final assembly: 1800 rendered frames -> 1080x1920 30fps H.264, burned-in
# one-word captions, mixed narration/SFX/music as AAC, 60.0 s exactly.
set -euo pipefail
S="$1"; OUT="$2"
R="$S/reel"
ffmpeg -v error -y -framerate 30 -i "$R/frames/%04d.png" -i "$S/audio/mix.wav" \
  -frames:v 1800 \
  -vf "scale=1080:1920:flags=lanczos,unsharp=5:5:0.45:5:5:0.0,subtitles=$S/audio/captions.ass,format=yuv420p" \
  -c:v libx264 -preset slow -crf 19 -profile:v high -level 4.1 -r 30 \
  -c:a aac -b:a 192k -ar 48000 -ac 2 -t 60 -movflags +faststart "$OUT"
ffprobe -v error -show_entries stream=codec_name,width,height,r_frame_rate,sample_rate,channels -show_entries format=duration,size -of compact "$OUT"
