#!/usr/bin/env bash
# Assemble the final reel from the rendered 3D (no re-render needed):
#   voice placement + music/SFX mix -> word-by-word subtitles -> H.264/AAC MP4.
# usage: ./make_video.sh
set -euo pipefail
cd "$(dirname "$0")"
PY=python3; [ -x .venv/bin/python ] && PY=.venv/bin/python
CLEAN=output/moon_house_clean.mp4          # the 3D render, no subtitles, no audio
OUT=output/moon_house_reel.mp4
mkdir -p build output

if [ ! -f "$CLEAN" ]; then
  echo "== encoding the rendered frames into $CLEAN"
  ffmpeg -v error -y -framerate 30 -i build/frames/f_%05d.png -frames:v 1650 \
    -c:v libx264 -preset slow -crf 15 -pix_fmt yuv420p -movflags +faststart "$CLEAN"
fi
if [ ! -f build/music.wav ] || [ ! -f build/sfx.wav ]; then
  echo "== synthesising music + sound effects"
  $PY audio/make_cues.py
  $PY audio/synth.py --cues audio/cues.json --out build
fi
echo "== placing the voice and mixing"
$PY audio/mix.py
echo "== subtitles"
$PY subs/make_ass.py
echo "== exporting $OUT"
ffmpeg -v error -y -i "$CLEAN" -i build/mix.wav \
  -vf "ass=build/subs.ass:fontsdir=assets/fonts" \
  -c:v libx264 -preset slow -crf 17 -profile:v high -level 4.1 -pix_fmt yuv420p -r 30 \
  -c:a aac -b:a 192k -ar 48000 -ac 2 -movflags +faststart -shortest "$OUT"
ffprobe -v error -show_entries stream=codec_name,width,height,r_frame_rate,sample_rate -show_entries format=duration -of compact "$OUT"
echo "done: $OUT"
