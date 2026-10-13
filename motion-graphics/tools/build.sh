#!/usr/bin/env bash
# Builds the film: picture (headless Chromium) + sound (numpy/scipy) -> MP4.
#
#   tools/build.sh [output.mp4]
#
# Env: FPS (default 60), WORKERS (parallel render pages, default 4), CRF (default 16)
set -euo pipefail
cd "$(dirname "$0")/.."
OUT=${1:-how-ai-writes.mp4}
FPS=${FPS:-60}
# WORKDIR keeps intermediate files (frames, cues, mix) for inspection; otherwise a temp dir is used.
if [[ -n "${WORKDIR:-}" ]]; then WORK=$WORKDIR; mkdir -p "$WORK"; else WORK=$(mktemp -d); trap 'rm -rf "$WORK"' EXIT; fi

echo "== cue sheet"
node tools/render.mjs cues "$WORK/cues.json"
echo "== sound"
python3 tools/audio.py "$WORK/cues.json" "$WORK/mix.wav"
echo "== picture"
node tools/render.mjs frames "$WORK/frames" "$FPS" "${WORKERS:-4}"

echo "== loudness"
# Gain to -14 LUFS integrated, then a limiter keeps peaks low enough that the AAC encode stays under -1 dBTP.
GAIN=$(ffmpeg -hide_banner -nostats -i "$WORK/mix.wav" -af loudnorm=I=-14:TP=-1:print_format=json -f null - 2>&1 |
  python3 -c 'import sys,json; s=sys.stdin.read(); j=json.loads(s[s.rindex("{"):s.rindex("}")+1]); print(round(-14.0-float(j["input_i"]),2))')
echo "gain ${GAIN} dB"

echo "== encode"
# The background carries a ±1 LSB dither against banding; these x264 settings keep it
# (no deadzone, psy-rd, adaptive quant biased to dark flat areas) and use a long GOP since
# the dither pattern is static from frame to frame.
ffmpeg -hide_banner -loglevel warning -nostats -y \
  -thread_queue_size 64 -framerate "$FPS" -i "$WORK/frames/f%05d.png" -i "$WORK/mix.wav" \
  -filter_complex "[0:v]scale=out_color_matrix=bt709:out_range=tv:flags=accurate_rnd+full_chroma_int,format=yuv420p[v];[1:a]volume=${GAIN}dB,alimiter=limit=0.79:attack=4:release=60:level=disabled[a]" \
  -map "[v]" -map "[a]" \
  -c:v libx264 -preset slow -crf "${CRF:-16}" -profile:v high -level 4.2 \
  -x264-params aq-mode=3:aq-strength=1.0:deadzone-inter=6:deadzone-intra=6:psy-rd=1.0,0.15:keyint=600:min-keyint=60 \
  -colorspace bt709 -color_primaries bt709 -color_trc bt709 -color_range tv \
  -c:a aac -b:a 256k -ar 48000 \
  -movflags +faststart \
  -metadata title="One Token at a Time" \
  -metadata comment="How a language model writes. Every frame drawn in code, every sound synthesized from scratch." \
  "$OUT"
echo "== done: $OUT"
