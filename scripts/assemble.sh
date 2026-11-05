#!/usr/bin/env bash
# Join the rendered parts (+ re-rendered patches) and add the mixed audio.
# Output: out/final.mp4 (1080x1920, 30 fps, H.264 + AAC), length = voiceover + 1 s.
#
#   part1    = frames    0-1085   (patch_s04 replaces frames 420-463)
#   part2    = frames 1086-2171
#   part3a   = frames 2172-2713   (patch_s13 replaces frames 2289-2342)
#   part3b   = frames 2714-3256
set -euo pipefail
cd "$(dirname "$0")/.."
P=out/parts
ffmpeg -hide_banner -loglevel error -y \
  -i $P/part1.mp4 -i $P/patch_s04.mp4 -i $P/part1.mp4 -i $P/part2.mp4 \
  -i $P/part3a.mp4 -i $P/patch_s13.mp4 -i $P/part3a.mp4 -i $P/part3b.mp4 \
  -i public/audio/mix.wav \
  -filter_complex "\
[0:v]trim=start_frame=0:end_frame=420,setpts=PTS-STARTPTS[a];\
[1:v]setpts=PTS-STARTPTS[b];\
[2:v]trim=start_frame=464,setpts=PTS-STARTPTS[c];\
[3:v]setpts=PTS-STARTPTS[d];\
[4:v]trim=start_frame=0:end_frame=117,setpts=PTS-STARTPTS[e];\
[5:v]setpts=PTS-STARTPTS[f];\
[6:v]trim=start_frame=171,setpts=PTS-STARTPTS[g];\
[7:v]setpts=PTS-STARTPTS[h];\
[a][b][c][d][e][f][g][h]concat=n=8:v=1:a=0,fps=30[v]" \
  -map "[v]" -map 8:a -c:v libx264 -preset slow -crf 17 -pix_fmt yuv420p -r 30 -c:a aac -b:a 192k -ar 44100 -movflags +faststart -shortest out/final.mp4
ffprobe -v error -count_frames -show_entries stream=codec_name,width,height,nb_read_frames,r_frame_rate:format=duration -of compact out/final.mp4
