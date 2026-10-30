#!/usr/bin/env bash
# Render the final reel, cover and the under-20MB version, then check them.
set -euo pipefail
cd "$(dirname "$0")/../.."
OUT=episodes/adam-silent/out
npx remotion render src/index.ts AdamSilent $OUT/reel_adam-silent.mp4 --codec=h264 --crf=18 --pixel-format=yuv420p --audio-codec=aac --audio-bitrate=192k --concurrency=4 --gl=swangle --log=warn
npx remotion still src/index.ts Cover $OUT/cover_adam-silent.png --gl=swangle --log=warn
# under 20 MB: two-pass H.264 at ~1.9 Mb/s + 128 kb/s AAC, still 1080x1920
cd $OUT
ffmpeg -v error -y -i reel_adam-silent.mp4 -c:v libx264 -b:v 1900k -preset slow -pix_fmt yuv420p -pass 1 -passlogfile /tmp/x264pass -an -f mp4 /dev/null
ffmpeg -v error -y -i reel_adam-silent.mp4 -c:v libx264 -b:v 1900k -preset slow -pix_fmt yuv420p -pass 2 -passlogfile /tmp/x264pass -c:a aac -b:a 128k -ar 48000 -movflags +faststart reel_adam-silent_under20MB.mp4
for f in reel_adam-silent.mp4 reel_adam-silent_under20MB.mp4; do
  echo "== $f $(du -h $f | cut -f1)"
  ffprobe -v error -show_entries stream=codec_name,width,height,r_frame_rate,pix_fmt,sample_rate:format=duration -of compact=p=0 $f
  ffmpeg -hide_banner -i $f -af ebur128=peak=true -f null - 2>&1 | grep -E "^\s+(I|Peak):"
done
echo FINALIZE_DONE
