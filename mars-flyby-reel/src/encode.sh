#!/bin/bash
# Two-pass H.264 (high profile, BT.709) + AAC 48 kHz stereo, exactly 45.0 s / 1350 frames.
set -e
FR=$1; AUD=$2; OUT=$3; TMP=$(dirname "$OUT")/x264pass
VF="scale=out_color_matrix=bt709:out_range=tv,format=yuv420p"
X="keyint=60:min-keyint=30:bframes=3:ref=4:aq-mode=3:psy-rd=1.0,0.15"
ffmpeg -hide_banner -loglevel warning -y -framerate 30 -i "$FR/f%04d.png" -vf "$VF" -c:v libx264 -preset slow \
  -profile:v high -level 4.2 -b:v 16M -maxrate 20M -bufsize 32M -x264-params "$X" -pass 1 -passlogfile "$TMP" \
  -an -frames:v 1350 -f null /dev/null
ffmpeg -hide_banner -loglevel warning -y -framerate 30 -i "$FR/f%04d.png" -i "$AUD" -vf "$VF" -c:v libx264 \
  -preset slow -profile:v high -level 4.2 -b:v 16M -maxrate 20M -bufsize 32M -x264-params "$X" -pass 2 \
  -passlogfile "$TMP" -colorspace bt709 -color_primaries bt709 -color_trc bt709 -color_range tv \
  -c:a aac -b:a 256k -ar 48000 -ac 2 -frames:v 1350 -t 45.0 -movflags +faststart \
  -metadata title="What If Mars Appeared in Earth's Sky?" "$OUT"
rm -f "$TMP"*
