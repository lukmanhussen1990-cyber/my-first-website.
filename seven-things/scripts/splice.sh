#!/usr/bin/env bash
# Splice re-rendered frame ranges (JPEG frames from `node render.mjs frames A-B dir`) into the full
# Remotion render, then make the delivery encode: H.264 (x264 slow, CRF 18, capped), yuv420p TV range,
# BT.709, AAC 192k from audio/final_mix.wav, +faststart.
# usage: scripts/splice.sh build/final_reel_raw.mp4 out/final_reel.mp4 seg1:336:540 seg2:1778:2200 ...
set -euo pipefail
cd "$(dirname "$0")/.."
SRC=$1; OUT=$2; shift 2
FRAMES=$(ffprobe -v error -count_packets -select_streams v:0 -show_entries stream=nb_read_packets -of csv=p=0 "$SRC")
inputs=(-i "$SRC"); filt=""; parts=""; n=0; prev=0; k=1
nseg=$#
filt="[0:v]split=$((nseg + 1))$(for i in $(seq 0 $nseg); do printf '[s%d]' $i; done);"
for seg in "$@"; do
  IFS=: read -r dir a b <<< "$seg"
  inputs+=(-framerate 30 -start_number "$a" -i "build/$dir/element-%04d.jpeg")
  if [ "$a" -gt "$prev" ]; then filt+="[s$((k-1))]trim=start_frame=$prev:end_frame=$a,setpts=PTS-STARTPTS,format=yuvj420p,setsar=1[p$n];"; parts+="[p$n]"; n=$((n+1)); else filt+="[s$((k-1))]nullsink;"; fi
  filt+="[$k:v]setpts=PTS-STARTPTS,format=yuvj420p,setsar=1[p$n];"; parts+="[p$n]"; n=$((n+1))
  prev=$((b + 1)); k=$((k + 1))
done
if [ "$prev" -lt "$FRAMES" ]; then filt+="[s$((k-1))]trim=start_frame=$prev:end_frame=$FRAMES,setpts=PTS-STARTPTS,format=yuvj420p,setsar=1[p$n];"; parts+="[p$n]"; n=$((n+1)); else filt+="[s$((k-1))]nullsink;"; fi
filt+="${parts}concat=n=$n:v=1:a=0,scale=in_range=full:out_range=tv:out_color_matrix=bt709,format=yuv420p[v]"
ffmpeg -v error -y "${inputs[@]}" -i audio/final_mix.wav -filter_complex "$filt" -map "[v]" -map "$k:a" \
  -c:v libx264 -preset slow -crf 18 -maxrate 11M -bufsize 22M -g 60 -color_range tv -colorspace bt709 -color_primaries bt709 -color_trc bt709 \
  -c:a aac -b:a 192k -movflags +faststart -shortest "$OUT"
ffprobe -v error -show_entries format=duration,size:stream=codec_name,pix_fmt,nb_frames -of default=nw=1 "$OUT"
