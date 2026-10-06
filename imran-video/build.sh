#!/usr/bin/env bash
# Full build: render frames -> H.264, prepare soundtracks, mux the final MP4s.
#   SRC=/path/to/original_video.mp4 ./build.sh
# Main output uses the user's original audio (aligned excerpt); an alternate uses the synthesized score.
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p out
DUR=$(python3 -c "import json;print(json.load(open('timeline.json'))['DURATION'])")
echo "duration: ${DUR}s"
node render.cjs --start 0 --end "$DUR" --fps 30 --video out/video_silent.mp4 --workers 3 --crf 14

mux() { # $1 audio wav, $2 output mp4
  ffmpeg -y -v error -i out/video_silent.mp4 -i "$1" \
    -map 0:v -map 1:a -c:v copy -c:a aac -b:a 192k -ar 48000 -af "loudnorm=I=-15:TP=-1.0:LRA=11" \
    -t "$DUR" -movflags +faststart "$2"
  ffprobe -v error -show_entries format=duration,size -of default=nw=1 "$2"
}

if [ -n "${SRC:-}" ]; then
  python3 -I audio/original_cut.py "$SRC" out/soundtrack_original.wav "$DUR"
  mux out/soundtrack_original.wav out/imran-i-got-you.mp4
fi
if [ -f audio/score.py ]; then
  python3 -I audio/score.py out/soundtrack.wav "$DUR"
  mux out/soundtrack.wav out/imran-i-got-you_custom-sound.mp4
fi
