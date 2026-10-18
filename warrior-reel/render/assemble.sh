#!/usr/bin/env bash
# Final assembly: rendered picture + burned-in subtitles/title/end card + final audio mix -> Reels-ready MP4.
#   render/assemble.sh [raw_video] [mix_wav] [ass] [out]
set -euo pipefail
cd "$(dirname "$0")/.."
RAW=${1:-out/video/film_raw.mp4}
MIX=${2:-out/audio/mix.wav}
ASS=${3:-out/subs/film.ass}
OUT=${4:-out/video/the_warrior_who_couldnt_forgive.mp4}
mkdir -p "$(dirname "$OUT")"
ffmpeg -y -v warning -i "$RAW" -i "$MIX" \
  -vf "ass=${ASS}:fontsdir=assets/fonts" \
  -map 0:v:0 -map 1:a:0 \
  -c:v libx264 -preset slow -crf 17 -profile:v high -level 4.2 -pix_fmt yuv420p -r 30 \
  -x264-params "keyint=60:min-keyint=30" \
  -c:a aac -b:a 192k -ar 48000 -ac 2 \
  -movflags +faststart -shortest "$OUT"
ffprobe -v error -show_entries format=duration,size:stream=codec_name,width,height,r_frame_rate,sample_rate -of compact "$OUT"
