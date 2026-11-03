#!/usr/bin/env bash
# Join the two rendered halves (no re-encode), add the mixed soundtrack, write out/final.mp4.
set -euo pipefail
cd "$(dirname "$0")/.."
python3 scripts/mix_audio.py out/tmp/audio.m4a
printf "file '%s'\nfile '%s'\n" "$PWD/out/tmp/part1.mp4" "$PWD/out/tmp/part2.mp4" > out/tmp/parts.txt
ffmpeg -v error -y -f concat -safe 0 -i out/tmp/parts.txt -c copy out/tmp/video.mp4
ffmpeg -v error -y -i out/tmp/video.mp4 -i out/tmp/audio.m4a -map 0:v:0 -map 1:a:0 -c:v copy -c:a copy -movflags +faststart -shortest out/final.mp4
ffprobe -v error -show_entries stream=codec_name,width,height,r_frame_rate,nb_frames,sample_rate,duration -of default=nw=1 out/final.mp4
ls -la out/final.mp4
