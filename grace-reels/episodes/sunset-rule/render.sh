#!/bin/bash
# Build The Sunset Rule end to end (run from anywhere).
#   ./render.sh preview   -> out/animatic_sunset-rule.mp4 (540x960)
#   ./render.sh final     -> out/reel_sunset-rule.mp4 + cover + checks
# The final render keeps its frames in out/frames_sunset-rule and only renders the ones
# that are missing, so it picks up where it stopped. Delete that folder after changing a scene.
set -euo pipefail
cd "$(dirname "$0")/../.."
MODE=${1:-final}
EP=episodes/sunset-rule
mkdir -p out
node $EP/audio/build_audio.mjs
mux() { ffmpeg -hide_banner -loglevel error -y -i "$1" -i $EP/audio/final_mix.wav -map 0:v -map 1:a -c:v copy -c:a aac -b:a 256k -ar 48000 -movflags +faststart "$2"; }
if [ "$MODE" = preview ]; then
  npx remotion render src/index.ts SunsetRule out/animatic_silent.mp4 --scale=0.5 --concurrency=2 --muted
  mux out/animatic_silent.mp4 out/animatic_sunset-rule.mp4
else
  node tools/render_frames.mjs SunsetRule out/frames_sunset-rule 2
  tools/encode_frames.sh out/frames_sunset-rule $EP/audio/final_mix.wav out/reel_sunset-rule.mp4
  npx remotion still src/index.ts SunsetRuleCover out/cover_sunset-rule.png
  cp $EP/caption_sunset-rule.txt out/
  ffprobe -v error -show_entries stream=codec_name,width,height,r_frame_rate,pix_fmt,sample_rate -show_entries format=duration -of default=nw=1 out/reel_sunset-rule.mp4
  ffmpeg -hide_banner -nostats -i out/reel_sunset-rule.mp4 -af ebur128 -f null - 2>&1 | grep -A3 Summary | grep "I:"
fi
