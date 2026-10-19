#!/usr/bin/env bash
# Full build: cue sheet -> audio -> 1800 PNG frames -> MP4 (+ cover, check stills, preview audio)
#
#   ./build.sh                       page name NOOR TOON (the default in reel.html)
#   PAGE="Other Name" ./build.sh     any other page name
#   WORKERS=8 ./build.sh             more parallel Chromium workers on a bigger machine
#   SKIP_FRAMES=1 ./build.sh         reuse build/frames (e.g. after changing only the sound)
set -euo pipefail
cd "$(dirname "$0")"

WORKERS="${WORKERS:-4}"
PAGE_ARGS=()
if [ -n "${PAGE:-}" ]; then PAGE_ARGS=(--page "$PAGE"); fi
OUT=output/signs-before-the-last-day.mp4
mkdir -p build output/stills

echo "1/5  cue sheet (all sound timings come from reel.html)"
node render_frames.mjs --cues build/cues.json ${PAGE_ARGS[@]+"${PAGE_ARGS[@]}"}

echo "2/5  audio (numpy)"
python3 make_audio.py build/cues.json build/audio.wav

echo "3/5  frames: render(i / 30) for i = 0..1799"
if [ -n "${SKIP_FRAMES:-}" ] && [ "$(ls build/frames 2>/dev/null | wc -l)" -eq 1800 ]; then
  echo "     reusing build/frames"
else
  rm -rf build/frames
  node render_frames.mjs --frames build/frames --workers "$WORKERS" ${PAGE_ARGS[@]+"${PAGE_ARGS[@]}"}
fi

echo "4/5  encode H.264 + AAC"
ffmpeg -y -loglevel error -stats -framerate 30 -i build/frames/f_%04d.png -i build/audio.wav \
  -map 0:v:0 -map 1:a:0 \
  -vf "scale=out_color_matrix=bt709:out_range=tv,format=yuv420p" \
  -c:v libx264 -preset slow -crf 18 -pix_fmt yuv420p -profile:v high -level:v 4.1 -r 30 \
  -colorspace bt709 -color_primaries bt709 -color_trc bt709 -color_range tv \
  -c:a aac -b:a 192k -ar 48000 -ac 2 \
  -movflags +faststart -t 60 "$OUT"
ffmpeg -y -loglevel error -i build/audio.wav -c:a aac -b:a 192k output/audio.m4a   # sound for the browser preview

echo "5/5  cover + check stills (2, 6, 15, 30, 42, 52, 58 s)"
node render_frames.mjs --cover output/cover.png --cover-time 0 --stills 2,6,15,30,42,52,58 --out build/stills ${PAGE_ARGS[@]+"${PAGE_ARGS[@]}"}
for f in build/stills/*.png; do
  ffmpeg -y -loglevel error -i "$f" -q:v 3 "output/stills/$(basename "${f%.png}").jpg"
done

echo
ffprobe -v error -show_entries format=duration,size:stream=codec_name,width,height,r_frame_rate,nb_frames,sample_rate,bit_rate \
  -of default=noprint_wrappers=1 "$OUT"
ffmpeg -hide_banner -nostats -i "$OUT" -af ebur128=peak=true:framelog=quiet -f null - 2>&1 | grep -E "^ +(I|Peak):" | sed 's/^ */  /'
echo "done -> $OUT"
