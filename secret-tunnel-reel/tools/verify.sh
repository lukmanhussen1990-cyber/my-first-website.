#!/usr/bin/env bash
# Check the delivered MP4 against the Instagram Reel spec we target.
#   tools/verify.sh secret-tunnel.mp4
set -uo pipefail
f=${1:-secret-tunnel.mp4}
fail=0
check() { if [ "$2" = "$3" ]; then echo "ok   $1: $2"; else echo "FAIL $1: got $2, want $3"; fail=1; fi; }
v() { ffprobe -v error -select_streams v:0 -show_entries "stream=$1" -of csv=p=0 "$f"; }
a() { ffprobe -v error -select_streams a:0 -show_entries "stream=$1" -of csv=p=0 "$f"; }
check "video codec" "$(v codec_name)" h264
check "size" "$(v width)x$(v height)" 1080x1920
check "frame rate" "$(v r_frame_rate)" 24/1
check "pixel format" "$(v pix_fmt)" yuv420p
check "audio codec" "$(a codec_name)" aac
check "audio rate" "$(a sample_rate)" 48000
dur=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$f")
awk -v d="$dur" 'BEGIN { if (d >= 50 && d <= 60) print "ok   duration: " d " s"; else { print "FAIL duration: " d; exit 1 } }' || fail=1
# moov atom before mdat (fast start for streaming)
python3 - "$f" <<'EOF' || fail=1
import struct, sys
with open(sys.argv[1], "rb") as fh:
    order = []
    while True:
        hdr = fh.read(8)
        if len(hdr) < 8:
            break
        size, kind = struct.unpack(">I4s", hdr)
        order.append(kind.decode())
        if size == 1:
            size = struct.unpack(">Q", fh.read(8))[0] - 8
        fh.seek(size - 8, 1)
ok = order.index("moov") < order.index("mdat")
print(("ok  " if ok else "FAIL") + " faststart: " + " ".join(order))
sys.exit(0 if ok else 1)
EOF
lufs=$(ffmpeg -hide_banner -nostats -i "$f" -af ebur128=peak=true -f null - 2>&1 | awk '/Integrated loudness/{getline; print $2}')
echo "info loudness: $lufs LUFS (target -14)"
echo "info size: $(du -h "$f" | cut -f1)"
exit $fail
