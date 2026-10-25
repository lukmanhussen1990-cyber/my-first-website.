#!/usr/bin/env bash
# Rebuild FILE No. 03 (WHY IS THERE NO CURE FOR CANCER?) from its sources. Run from reel-studio/.
# Needs: the 7 PNGs in images/, the ElevenLabs MP3s in audio/elevenlabs_raw/ (part1–part6).
set -e
P=projects/no-cure-for-cancer
A=$P/audio/elevenlabs_raw
MODELS=${MODELS:-$HOME/.cache/reel-models}          # faster-whisper + rembg models
export U2NET_HOME=$MODELS/u2net

# 1. voice -> scene clips (the [OPTIONAL] scenes S05, S12, S19 were cut and never recorded)
python3 engine/tools/vo_split.py $P/vo_script.json $P/build/vo_el \
  --part $A/part1.mp3:S01,S02,S03 --part $A/part2.mp3:S04,S06,S07 \
  --part $A/part3.mp3:S08,S09,S10,S11 --part $A/part4.mp3:S13,S14,S15,S16 \
  --part $A/part5.mp3:S17,S18 --part $A/part6.mp3:S20,S21,S22 \
  --transcripts $P/build/vo_el/transcripts_chunked --models-dir $MODELS --max-pause 0.34 --keep-pause 0.30

# 2. images -> cut-outs and the X-ray body
python3 engine/tools/prep_images.py $P

# 3. preview, then final
node engine/render.mjs --project no-cure-for-cancer --vo vo_el --video build/preview.mp4 --scale 0.33334 --crf 25 --preset veryfast
node engine/render.mjs --project no-cure-for-cancer --vo vo_el --video build/final_video.mp4 --workers 3 --crf 18

# 4. mix (-14 LUFS, warm music from S13), reel_final.mp4, reel_no_music.mp4, cover.jpg (S02: THE ENEMY IS YOU)
python3 engine/tools/finish.py $P --vo vo_el --cover-time 9.63
