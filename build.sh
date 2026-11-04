#!/usr/bin/env bash
# build.sh — build the whole reel:  voice → plan → music/SFX → scene clips → out/final.mp4
#
#   ./build.sh            full build
#   ./build.sh 3 7        re-record only scenes 3 and 7, then re-assemble
#   ./build.sh --mix      keep the recorded scenes, only redo the audio mix + export
#
# Needs: python3 + playwright (pip install playwright), ffmpeg. Voice lines that already
# exist in audio/voice/ are reused, so ElevenLabs is only called for new/missing lines.
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p out

if ls audio/voice/scene*.mp3 >/dev/null 2>&1 && [ ! -f .env ] && [ -z "${ELEVENLABS_API_KEY:-}" ]; then
  echo "• voice: using existing audio/voice/*.mp3 (no ELEVENLABS_API_KEY set)"
else
  echo "• voice (ElevenLabs)"; python3 voice.py
fi

echo "• plan";   python3 render.py --plan
echo "• music + sfx"; python3 sfx.py
if [ "${1:-}" = "--mix" ]; then
  echo "• record scenes: skipped (--mix)"
else
  echo "• record scenes"; python3 render.py "$@"
fi

echo "• join scenes"
ffmpeg -y -loglevel error -f concat -safe 0 -i out/concat.txt -c copy out/video.mp4

echo "• mix voice + music + sfx"
mapfile -t MIX_INPUTS < out/mix_inputs.txt
ffmpeg -y -loglevel error "${MIX_INPUTS[@]}" -filter_complex "$(cat out/mix_filter.txt)" \
  -map "[mix]" -ar 48000 -c:a pcm_s16le out/mix.wav

# bring the whole mix to -14 LUFS (social-media loudness) with a true-peak safe limiter
LUFS=$(ffmpeg -nostats -hide_banner -i out/mix.wav -af ebur128=framelog=quiet -f null - 2>&1 \
  | python3 -c "import re,sys; print(re.findall(r'I:\s+(-?[\d.]+) LUFS', sys.stdin.read())[-1])")
GAIN=$(python3 -c "print(round(-14 - ($LUFS), 2))")
echo "  mix loudness ${LUFS} LUFS → gain ${GAIN} dB"

echo "• export out/final.mp4 (H.264 + AAC)"
ffmpeg -y -loglevel error -i out/video.mp4 -i out/mix.wav -map 0:v -map 1:a -c:v copy \
  -af "volume=${GAIN}dB,alimiter=limit=0.89:level=false" -c:a aac -b:a 192k -ar 48000 \
  -shortest -movflags +faststart out/final.mp4

python3 - <<'EOF'
import json, re
plan = json.load(open("scenes.json", encoding="utf-8"))
hook = re.sub(r"\*\*(.+?)\*\*", r"\1", plan.get("hook", ""))
open("out/caption.txt", "w", encoding="utf-8").write(f"{hook}\n\nA ya B? Comment karo 👇\n")
EOF

ffprobe -v error -show_entries format=duration:stream=codec_name,width,height,r_frame_rate -of compact out/final.mp4
echo "✔ $(pwd)/out/final.mp4"
echo "✔ $(pwd)/out/cover.png"
