#!/usr/bin/env bash
# Step 5: frames + voiceover (+ optional build/sfx.wav) + burned-in captions -> final.mp4
# (1080x1920, 30 fps, H.264 + AAC). The voice is untouched; effects are mixed under it.
set -euo pipefail
cd "$(dirname "$0")/.."
FRAMES=${1:-build/frames}
SFX=${SFX:-build/sfx.wav}
VIDEO="[0:v]scale=1080:1920:flags=lanczos,subtitles=captions/captions.ass:fontsdir=fonts[v]"
# keep the voice at its original level: a mono voiceover is copied to both channels (no -3 dB pan law)
if [ "$(ffprobe -v error -select_streams a:0 -show_entries stream=channels -of csv=p=0 voiceover.mp3)" = "1" ]; then
  VOICE="[1:a]aresample=48000,pan=stereo|c0=c0|c1=c0"
else
  VOICE="[1:a]aresample=48000,aformat=channel_layouts=stereo"
fi
if [ -f "$SFX" ]; then
  INPUTS=(-i voiceover.mp3 -i "$SFX")
  AUDIO="$VOICE[vo];[vo][2:a]amix=inputs=2:normalize=0:duration=first,alimiter=limit=0.97:level=false[a]"
else
  INPUTS=(-i voiceover.mp3)
  AUDIO="$VOICE[a]"
fi
ffmpeg -y -hide_banner -loglevel warning \
  -thread_queue_size 64 -framerate 30 -start_number 1 -i "$FRAMES/f_%04d.jpg" "${INPUTS[@]}" \
  -filter_complex "$VIDEO;$AUDIO" -map "[v]" -map "[a]" \
  -c:v libx264 -preset slow -crf 18 -profile:v high -pix_fmt yuv420p -r 30 \
  -c:a aac -b:a 192k -ar 48000 -shortest -movflags +faststart \
  final.mp4
ffprobe -v error -show_entries format=duration:stream=codec_name,width,height,r_frame_rate -of compact final.mp4
