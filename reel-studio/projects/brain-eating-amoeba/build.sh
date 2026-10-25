#!/usr/bin/env bash
# Rebuild FILE No. 02 (THE BRAIN-EATING AMOEBA) from its sources. Run from reel-studio/.
# Needs: the 9 PNGs in images/, the ElevenLabs MP3s in audio/elevenlabs_raw/.
set -e
P=projects/brain-eating-amoeba
A=$P/audio/elevenlabs_raw
MODELS=${MODELS:-$HOME/.cache/reel-models}          # faster-whisper + rembg models
export U2NET_HOME=$MODELS/u2net

# 1. voice -> scene clips (part 1 uses the re-recorded "सोचो": part1_socho.flac)
python3 engine/tools/vo_split.py $P/vo_script.json $P/build/vo_el \
  --part $A/part1_socho.flac:S01,S02,S03,S04 --part $A/part2.mp3:S06,S07 \
  --part $A/part3.mp3:S08,S09,S10,S11 --part $A/part4.mp3:S12,S13,S14 \
  --part $A/part5.mp3:S16,S17,S18,S19 --part $A/part6.mp3:S20,S21,S23 \
  --transcripts $P/build/vo_el/transcripts_chunked --models-dir $MODELS --max-pause 0.34 --keep-pause 0.30

# 2. images -> cutouts, vignette plates, X-ray head
python3 engine/tools/prep_images.py $P

# 3. preview, then final
node engine/render.mjs --project brain-eating-amoeba --vo vo_el --video build/preview.mp4 --scale 0.33334 --crf 25 --preset veryfast
node engine/render.mjs --project brain-eating-amoeba --vo vo_el --video build/final_video.mp4 --workers 3 --crf 18

# 4. mix (-14 LUFS, warm music from S20), reel_final.mp4, reel_no_music.mp4, cover.jpg
python3 engine/tools/finish.py $P --vo vo_el --cover-time 8.9
