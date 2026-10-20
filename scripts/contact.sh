#!/usr/bin/env bash
# contact.sh out.png img1 img2 ... (up to 9) -> 3x3 grid of 360x640 thumbnails with time labels
out="$1"; shift
args=(); n=0; filt=""
for f in "$@"; do args+=(-i "$f"); lbl=$(basename "$f" .png | sed 's/.*_//'); filt+="[$n:v]scale=360:640,drawtext=fontfile=assets/fonts/Inter-Variable.ttf:text='$lbl':x=8:y=8:fontsize=26:fontcolor=yellow:box=1:boxcolor=black@0.6[v$n];"; n=$((n+1)); done
while [ $n -lt 9 ]; do args+=(-f lavfi -i color=black:s=360x640:d=1); filt+="[$n:v]null[v$n];"; n=$((n+1)); done
filt+="[v0][v1][v2][v3][v4][v5][v6][v7][v8]xstack=inputs=9:layout=0_0|w0_0|w0+w1_0|0_h0|w0_h0|w0+w1_h0|0_h0+h3|w0_h0+h3|w0+w1_h0+h3[out]"
ffmpeg -y -loglevel error "${args[@]}" -filter_complex "$filt" -map "[out]" -frames:v 1 "$out"
