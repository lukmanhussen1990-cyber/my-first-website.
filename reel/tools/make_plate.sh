#!/usr/bin/env bash
# Join the lossless render segments into the subtitle-free "clean plate".
#  - build/plate_master_crf15.mp4            high-quality H.264 master (local, large)
#  - output/clean_plate_no_subs.part1/2.mp4  HEVC copies split at 33.4 s (each < 100 MB, committed;
#                                            tools/export.py joins them automatically)
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p output
: > build/seg/list.txt; : > build/seg/list_p1.txt; : > build/seg/list_p2.txt
for i in 00 01 02 03 04 05 06 07 08 09; do
  echo "file '$(pwd)/build/seg/seg_$i.mkv'" >> build/seg/list.txt
  if [ "$i" \< "05" ]; then echo "file '$(pwd)/build/seg/seg_$i.mkv'" >> build/seg/list_p1.txt; else echo "file '$(pwd)/build/seg/seg_$i.mkv'" >> build/seg/list_p2.txt; fi
done
ffmpeg -y -loglevel error -f concat -safe 0 -i build/seg/list.txt -c:v libx264 -preset slow -crf 15 -tune film \
  -pix_fmt yuv420p -r 30 -movflags +faststart build/plate_master_crf15.mp4
for p in 1 2; do
  ffmpeg -y -loglevel error -f concat -safe 0 -i build/seg/list_p$p.txt -c:v libx265 -preset medium -crf 21 -pix_fmt yuv420p \
    -tag:v hvc1 -x265-params log-level=error -movflags +faststart output/clean_plate_no_subs.part$p.mp4
done
ls -la build/plate_master_crf15.mp4 output/clean_plate_no_subs.part*.mp4
