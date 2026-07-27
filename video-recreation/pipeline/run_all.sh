#!/usr/bin/env bash
# Recreate the reference clip with "sonnet 4.5+" -> "Opus 5+" and the ending
# scramble resolving to "Imran". Everything else comes from the original frames.
#
# Usage: ./run_all.sh /path/to/reference.mp4 [workdir]
set -euo pipefail

REF="${1:?usage: run_all.sh <reference.mp4> [workdir]}"
export WORKDIR="${2:-$(pwd)/work}"
HERE="$(cd "$(dirname "$0")" && pwd)"

FF="$(python3 -c 'import imageio_ffmpeg; print(imageio_ffmpeg.get_ffmpeg_exe())')"
mkdir -p "$WORKDIR/allframes" "$WORKDIR/out" "$WORKDIR/fonts"

echo "==> decoding frames + audio"
"$FF" -y -i "$REF" -vsync 0 "$WORKDIR/allframes/%04d.png"
"$FF" -y -i "$REF" -vn -c:a copy "$WORKDIR/original_audio.m4a"

echo "==> fetching Inter"
bash "$HERE/fonts.sh" "$WORKDIR"

echo "==> calibrating text models"
python3 "$HERE/calib.py"        # composer label: font, size, blur, gain
python3 "$HERE/calib_end3.py"   # ending word: font, size, blur, glow, gain

echo "==> tracking"
python3 "$HERE/track.py"        # full label, multi-scale
python3 "$HERE/track2.py"       # composer bottom-left corner (label off-frame)
python3 "$HERE/track3.py"       # "sonnet" alone (label clipped by frame edge)
python3 "$HERE/label_track.py"  # consolidate into one per-frame track

echo "==> compositing"
python3 "$HERE/composite_label.py"   # frames 48-179
python3 "$HERE/composite_end.py"     # frames 221-253

echo "==> encoding"
bash "$HERE/encode.sh" "$WORKDIR"
echo "done -> $WORKDIR/claude-opus5-imran.mp4"
