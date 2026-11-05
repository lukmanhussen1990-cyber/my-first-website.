#!/usr/bin/env bash
# One command, end to end:  ./build.sh            -> out/final.mp4 (+ out/thumbnail.png, out/captions.srt)
#                           ./build.sh --preview  -> out/preview.mp4 (first 10 seconds)
set -euo pipefail
cd "$(dirname "$0")"
START=$(date +%s)
PREVIEW=0
[[ "${1:-}" == "--preview" ]] && PREVIEW=1
WORKERS="${WORKERS:-4}"
mkdir -p out frames

echo "== 1. narration + word timestamps"
python3 audio/tts.py

echo "== 2. timeline (shot lengths follow the narration)"
python3 story/build_timeline.py

echo "== 3. sound-effect events (bubble pops) from the shots"
node render/render.mjs --events

echo "== 4. music + sfx"
python3 audio/music.py
python3 audio/sfx.py

echo "== 5. mix (narration 0 dB, music ducked under the voice, sfx -8 dB)"
ffmpeg -nostdin -loglevel error -y -i audio/voice.wav -i audio/music.wav -i audio/sfx.wav -filter_complex \
  "[0:a]asplit=2[v][vsc];[1:a]volume=0dB[m0];[m0][vsc]sidechaincompress=threshold=0.02:ratio=5:attack=15:release=450[m];[2:a]volume=-8dB[s];[v][m][s]amix=inputs=3:normalize=0:duration=longest[a]" \
  -map "[a]" -ac 1 -ar 44100 -c:a pcm_s16le audio/mix.wav

echo "== 6. render frames (headless Chromium + Three.js)"
rm -f frames/*.png
if [[ $PREVIEW == 1 ]]; then
  node render/render.mjs --preview --workers "$WORKERS"
  OUT=out/preview.mp4
  ffmpeg -nostdin -loglevel error -y -framerate 30 -i frames/%05d.png -i audio/mix.wav -t 10 \
    -c:v libx264 -pix_fmt yuv420p -crf 18 -c:a aac -b:a 192k -shortest -movflags +faststart "$OUT"
else
  node render/render.mjs --workers "$WORKERS"
  OUT=out/final.mp4
  ffmpeg -nostdin -loglevel error -y -framerate 30 -i frames/%05d.png -i audio/mix.wav \
    -c:v libx264 -pix_fmt yuv420p -crf 18 -c:a aac -b:a 192k -shortest -movflags +faststart "$OUT"
  echo "== 7. thumbnail + captions.srt"
  node render/render.mjs --thumbnail
  python3 story/make_srt.py
  echo "== 8. quality checks"
  python3 render/verify.py
fi

END=$(date +%s)
echo "total render time: $(( (END - START) / 60 )) min $(( (END - START) % 60 )) s"
echo "output: $(cd "$(dirname "$OUT")" && pwd)/$(basename "$OUT")"
