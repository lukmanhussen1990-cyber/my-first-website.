#!/bin/bash
# Build the reel: captions -> sound -> 3D frames (parallel chunks) -> final.mp4
#   ./make_reel.sh                 full 44.4 s video  -> final.mp4
#   PREVIEW=12 ./make_reel.sh      first 12 s only    -> preview.mp4
#   JOBS=3 (parallel render processes), SKIP_AUDIO=1, SKIP_RENDER=1 (re-encode only), FROM/TO (frame range to re-render)
set -euo pipefail
cd "$(dirname "$0")"
JOBS=${JOBS:-3}
BUILD=${BUILD:-build}
mkdir -p "$BUILD/frames"
FPS=30
TOTAL=$(node -e "import('./web/layout.js').then(m=>console.log(Math.round(m.DURATION*m.FPS)))")
if [ -n "${PREVIEW:-}" ]; then TOTAL=$(( PREVIEW * FPS )); OUT=preview.mp4; else OUT=final.mp4; fi

if [ -z "${SKIP_AUDIO:-}" ]; then
  python3 -I make_captions.py > /dev/null
  python3 -I gen_plan_js.py > /dev/null
  python3 -I make_sfx.py > /dev/null
  python3 -I mix.py | grep -E "FINAL|master \(python\)"
fi

if [ -z "${SKIP_RENDER:-}" ]; then
  A=${FROM:-0}; B=${TO:-$((TOTAL-1))}; N=$((B - A + 1))
  PER=$(( (N + JOBS - 1) / JOBS ))
  echo "rendering frames $A..$B with $JOBS jobs"
  pids=()
  for ((j=0; j<JOBS; j++)); do
    from=$((A + j*PER)); to=$((A + (j+1)*PER - 1)); (( to > B )) && to=$B
    (( from > to )) && continue
    SKIP_EXISTING=${SKIP_EXISTING:-1} node render.mjs frames "$BUILD/frames" $from $to > "$BUILD/render_$j.log" 2>&1 &
    pids+=($!)
  done
  fail=0
  for p in "${pids[@]}"; do wait $p || fail=1; done
  grep -h "page errors\|pageerror" "$BUILD"/render_*.log || true
  [ $fail = 0 ] || { echo "a render job reported page errors"; exit 1; }
fi

DUR=$(python3 -c "print($TOTAL/$FPS)")
ffmpeg -v error -y -framerate $FPS -i "$BUILD/frames/f_%05d.jpg" -i audio/mix_final.wav \
  -t "$DUR" \
  -vf "subtitles=audio/captions.ass:fontsdir=fonts" \
  -c:v libx264 -preset slow -crf 17 -pix_fmt yuv420p -profile:v high -level 4.2 -r $FPS \
  -c:a aac -b:a 192k -ar 48000 -movflags +faststart "$OUT"
echo "wrote $OUT"
ffprobe -v error -show_entries format=duration:stream=codec_name,width,height,r_frame_rate -of compact "$OUT"
ffmpeg -hide_banner -i "$OUT" -af ebur128=peak=true -f null - 2>&1 | grep -A12 "Summary" | grep -E "I:|Peak:" || true
