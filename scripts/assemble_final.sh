#!/usr/bin/env bash
# Join the two rendered halves, splice in re-rendered fix segments (if any), add the mixed soundtrack,
# and write out/final.mp4.
#   out/tmp/part1.mp4      frames 0-1715
#   out/tmp/part2.mp4      frames 1716-3720
#   out/tmp/fix_s07.mp4    frames 511-615   (scene 7 re-render: camera started inside the back wall)
#   out/tmp/fix_s26.mp4    frames 2782-2840 (scene 26 re-render: camera started inside a tree)
set -euo pipefail
cd "$(dirname "$0")/.."
python3 scripts/mix_audio.py out/tmp/audio.m4a
printf "file '%s'\nfile '%s'\n" "$PWD/out/tmp/part1.mp4" "$PWD/out/tmp/part2.mp4" > out/tmp/parts.txt
ffmpeg -v error -y -f concat -safe 0 -i out/tmp/parts.txt -c copy out/tmp/video.mp4

VIDEO=out/tmp/video.mp4
if [ -f out/tmp/fix_s07.mp4 ] && [ -f out/tmp/fix_s26.mp4 ]; then
	ffmpeg -v error -y -i out/tmp/video.mp4 -i out/tmp/fix_s07.mp4 -i out/tmp/fix_s26.mp4 -filter_complex "\
[0:v]split=3[m0][m1][m2];\
[m0]trim=start_frame=0:end_frame=511,setpts=PTS-STARTPTS[a];\
[1:v]setpts=PTS-STARTPTS[b];\
[m1]trim=start_frame=616:end_frame=2782,setpts=PTS-STARTPTS[c];\
[2:v]setpts=PTS-STARTPTS[d];\
[m2]trim=start_frame=2841,setpts=PTS-STARTPTS[e];\
[a][b][c][d][e]concat=n=5:v=1:a=0,fps=30[v]" \
		-map "[v]" -c:v libx264 -crf 16 -preset medium -pix_fmt yuv420p -r 30 out/tmp/video_fixed.mp4
	VIDEO=out/tmp/video_fixed.mp4
fi

ffmpeg -v error -y -i "$VIDEO" -i out/tmp/audio.m4a -map 0:v:0 -map 1:a:0 -c:v copy -c:a copy -movflags +faststart out/final.mp4
ffprobe -v error -count_frames -show_entries stream=codec_name,width,height,r_frame_rate,nb_read_frames,duration -of default=nw=1 out/final.mp4
ls -la out/final.mp4
