#!/bin/bash
set -e
cd "$(dirname "$0")"
NAME=${1:-Couch-Crushers}
mkdir -p out
rm -f seg/list.txt
for a in $(seq 0 60 1740); do n=$(printf %04d $a)
  if [ -f seg/fix_s$n.mp4 ]; then echo "file 'fix_s$n.mp4'" >> seg/list.txt
  elif [ -f seg/s$n.mp4 ]; then echo "file 's$n.mp4'" >> seg/list.txt
  else echo "missing segment $n"; exit 1; fi
done
echo "fixed segments used: $(grep -c fix_ seg/list.txt)"
ffmpeg -y -v error -f concat -safe 0 -i seg/list.txt -c copy out/video_only.mp4
# two-pass loudnorm to -14 LUFS
J=$(ffmpeg -hide_banner -nostats -i mix_raw.wav -af loudnorm=I=-14:TP=-1.0:LRA=11:print_format=json -f null - 2>&1 | sed -n '/^{/,/^}/p')
g(){ echo "$J" | python3 -c "import sys,json;print(json.load(sys.stdin)['$1'])"; }
ffmpeg -y -v error -i mix_raw.wav -af "loudnorm=I=-14:TP=-1.0:LRA=11:measured_I=$(g input_i):measured_TP=$(g input_tp):measured_LRA=$(g input_lra):measured_thresh=$(g input_thresh):offset=$(g target_offset):linear=true,aresample=48000" -c:a pcm_s16le out/mix.wav
ffmpeg -y -v error -i out/video_only.mp4 -i out/mix.wav -map 0:v -map 1:a -c:v libx264 -preset slow -crf 16 -profile:v high -pix_fmt yuv420p -r 30 -c:a aac -b:a 192k -movflags +faststart -shortest out/$NAME.mp4
echo "== $NAME.mp4"; ffprobe -v error -show_entries format=duration,size:stream=codec_name,width,height,r_frame_rate -of compact out/$NAME.mp4
echo "== frozen spans (should be empty):"; ffmpeg -nostats -i out/$NAME.mp4 -vf freezedetect=n=0.0008:d=0.6 -map 0:v -f null - 2>&1 | grep -E "freeze_(start|duration)" || true
echo "== black spans (should be empty):"; ffmpeg -nostats -i out/$NAME.mp4 -vf blackdetect=d=0.1:pix_th=0.05 -f null - 2>&1 | grep black_start || true
echo "== loudness:"; ffmpeg -nostats -i out/$NAME.mp4 -map 0:a -af ebur128 -f null - 2>&1 | grep -E "^\s+I:" | tail -1
ffmpeg -y -v error -i out/$NAME.mp4 -vf "fps=2,scale=162:-1,tile=12x10" -frames:v 1 out/qa_sheet.jpg
echo done
