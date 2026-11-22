#!/bin/bash
# Linear loudness normalisation to -14 LUFS with a brickwall limiter (keeps the mix balance).
IN=$1; OUT=$2
I=$(ffmpeg -hide_banner -i "$IN" -af ebur128 -f null - 2>&1 | grep -A2 "Integrated loudness" | grep -oE -- "I: +-?[0-9.]+" | grep -oE -- "-?[0-9.]+")
G=$(python3 -c "print(round(-14.0 - ($I), 2))")
ffmpeg -hide_banner -loglevel error -y -i "$IN" -af "volume=${G}dB,alimiter=limit=0.89:level=disabled" -ar 48000 "$OUT"
echo "input I=$I LUFS, gain ${G} dB -> $OUT"
