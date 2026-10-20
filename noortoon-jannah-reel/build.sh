#!/usr/bin/env bash
# Builds the whole reel from code:
#   1. Playwright/Chromium renders render(i/30) for all 1350 frames -> build/frames/*.png
#      (+ the audio cue sheet, the cover image and the check stills)
#   2. numpy synthesizes the sound track from the cue sheet        -> build/audio.wav
#   3. ffmpeg joins frames + audio                                  -> output/NoorToon_How_BIG_is_Jannah.mp4
set -euo pipefail
cd "$(dirname "$0")"

OUT=output/NoorToon_How_BIG_is_Jannah.mp4
mkdir -p build output

echo "== 1/3 frames, cover, stills, cue sheet"
node render_frames.mjs --frames --cover --stills

echo "== 2/3 audio"
python3 make_audio.py build/cues.json build/audio.wav

echo "== 3/3 encode"
ffmpeg -y -hide_banner -loglevel warning -stats \
  -framerate 30 -i build/frames/frame_%05d.png \
  -i build/audio.wav \
  -map 0:v:0 -map 1:a:0 \
  -vf "scale=out_color_matrix=bt709:out_range=tv,format=yuv420p" \
  -c:v libx264 -preset slow -crf 18 -pix_fmt yuv420p -r 30 \
  -colorspace bt709 -color_primaries bt709 -color_trc bt709 -color_range tv \
  -c:a aac -b:a 192k -ar 48000 \
  -t 45 -movflags +faststart \
  "$OUT"

# small MP3 copy of the sound track for the browser preview (index.html plays it in sync; MP3 plays in every browser)
ffmpeg -y -hide_banner -loglevel error -i build/audio.wav -c:a libmp3lame -b:a 192k output/audio.mp3

# one contact sheet of the ten check stills (1.5, 5, 10, 14, 19, 23, 28, 33, 37, 43 s)
ffmpeg -y -hide_banner -loglevel error -pattern_type glob -i 'build/stills/still_*.png' \
  -vf "scale=360:-1,tile=5x2:padding=12:margin=12:color=0x0b0a10" -frames:v 1 -q:v 3 output/check_stills.jpg

echo "== done"
ffprobe -v error -show_entries format=duration,size,bit_rate:stream=codec_name,width,height,r_frame_rate,sample_rate,channels,bit_rate \
  -of default=noprint_wrappers=1 "$OUT"
