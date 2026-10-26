#!/usr/bin/env bash
# Rebuild FILE No. 04 (DENGUE: WHY THE SECOND TIME IS WORSE) from its sources. Run from reel-studio/.
# Needs: the 6 PNGs in images/, the ElevenLabs MP3s in audio/elevenlabs_raw/ (part1–part5).
set -e
P=projects/dengue-second-time
A=$P/audio/elevenlabs_raw
MODELS=${MODELS:-$HOME/.cache/reel-models}          # faster-whisper + rembg models
export U2NET_HOME=$MODELS/u2net

# 1. voice -> scene clips (the [OPTIONAL] scenes S09 and S19 were cut and never recorded)
python3 engine/tools/vo_split.py $P/vo_script.json $P/build/vo_el \
  --part $A/part1.mp3:S01,S02,S03,S04,S05 --part $A/part2.mp3:S06,S07,S08 \
  --part $A/part3.mp3:S10,S11,S12,S13 --part $A/part4.mp3:S14,S15 \
  --part $A/part5.mp3:S16,S17,S18,S20 \
  --transcripts $P/build/vo_el/transcripts_chunked --models-dir $MODELS --max-pause 0.34 --keep-pause 0.30

# 2. images -> cut-outs (the cooler had a white background: AI cut-out) and the X-ray mosquito
python3 engine/tools/prep_images.py $P

# 3. preview, then final
node engine/render.mjs --project dengue-second-time --vo vo_el --video build/preview.mp4 --scale 0.33334 --crf 25 --preset veryfast
node engine/render.mjs --project dengue-second-time --vo vo_el --video build/final_video.mp4 --workers 3 --crf 18

# 4. mix (-14 LUFS, warm music from S17), reel_final.mp4, reel_no_music.mp4, cover.jpg (S01: THE 2ND TIME IS WORSE)
python3 engine/tools/finish.py $P --vo vo_el --cover-time 8.62
