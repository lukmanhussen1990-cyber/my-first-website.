#!/bin/bash
# Final encode: H.264 High (CRF 14, 60 fps, BT.709) + AAC 320k, two-pass loudnorm to -14 LUFS / -1 dBTP.
set -e
cd "$(dirname "$0")/.."
OUT=${1:-grace_roach_hotel_1080p.mp4}
DUR=$(node -e "import('./src/timeline.mjs').then(m=>console.log((m.FRAMES/60).toFixed(6)))")
M=$(ffmpeg -hide_banner -i build/mix.wav -af loudnorm=I=-14:TP=-1.0:LRA=11:print_format=json -f null - 2>&1 | sed -n '/^{/,/^}/p')
mi=$(echo "$M" | python3 -c "import json,sys;d=json.load(sys.stdin);print(d['input_i'])")
mtp=$(echo "$M" | python3 -c "import json,sys;d=json.load(sys.stdin);print(d['input_tp'])")
mlra=$(echo "$M" | python3 -c "import json,sys;d=json.load(sys.stdin);print(d['input_lra'])")
mth=$(echo "$M" | python3 -c "import json,sys;d=json.load(sys.stdin);print(d['input_thresh'])")
off=$(echo "$M" | python3 -c "import json,sys;d=json.load(sys.stdin);print(d['target_offset'])")
ffmpeg -v error -y -i build/video_noaudio.mkv -i build/mix.wav -map 0:v:0 -map 1:a:0 \
  -c:v libx264 -preset slow -crf 14 -profile:v high -level:v 4.2 -pix_fmt yuv420p -r 60 -g 120 -bf 2 \
  -x264-params "aq-mode=3:deblock=-1,-1" \
  -colorspace bt709 -color_primaries bt709 -color_trc bt709 -color_range tv \
  -af "loudnorm=I=-14:TP=-1.0:LRA=11:measured_I=$mi:measured_TP=$mtp:measured_LRA=$mlra:measured_thresh=$mth:offset=$off:linear=true,aresample=48000" \
  -c:a aac -b:a 320k -ar 48000 -ac 2 -t "$DUR" -movflags +faststart "$OUT"
echo "wrote $OUT"
