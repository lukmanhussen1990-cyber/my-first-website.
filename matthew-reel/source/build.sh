#!/bin/bash
# full build: audio -> 4 parallel video chunks -> concat -> mux (H.264 CRF 18, AAC 192k, +faststart)
# usage: ./build.sh OUTDIR   (all outputs, incl. intermediate WAVs, go to OUTDIR)
set -e
cd "$(dirname "$0")"
OUT=${1:-out}
mkdir -p "$OUT"
python3 audio.py "$OUT"
python3 master_audio.py "$OUT"
rm -f "$OUT"/chunk_*.mp4
for k in 0 1 2 3; do
  python3 render.py chunk $k 4 "$OUT/chunk_$k.mp4" > "$OUT/chunk_$k.log" 2>&1 &
done
wait
for k in 0 1 2 3; do echo "file 'chunk_$k.mp4'"; done > "$OUT/chunks.txt"
ffmpeg -v error -y -f concat -safe 0 -i "$OUT/chunks.txt" -c copy "$OUT/video_noaudio.mp4"
ffmpeg -v error -y -i "$OUT/video_noaudio.mp4" -i "$OUT/mix_final.wav" -map 0:v:0 -map 1:a:0 -c:v copy \
  -c:a aac -b:a 192k -ar 48000 -ac 2 -movflags +faststart -shortest "$OUT/matthew_reel_GraceInMotion.mp4"
ffprobe -v error -show_entries format=duration:stream=codec_name,width,height,r_frame_rate,pix_fmt,sample_rate,bit_rate \
  -of compact "$OUT/matthew_reel_GraceInMotion.mp4"
