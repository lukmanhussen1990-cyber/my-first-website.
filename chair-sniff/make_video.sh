#!/usr/bin/env bash
# Full pipeline: voiceover.mp3 -> final.mp4   (see README.md)
#   ./make_video.sh                 # everything (re-uses downloaded assets / built characters)
#   STEPS="timing scene render encode" ./make_video.sh   # e.g. after changing the voiceover
set -euo pipefail
cd "$(dirname "$0")"
PY=${PY:-.venv/bin/python}
ASSETS=${ASSETS:-assets}
SAMPLES=${SAMPLES:-4}            # EEVEE samples per pixel (4 = what final.mp4 used)
JOBS=${JOBS:-2}                  # parallel Blender render processes sharing the frame range
STEPS=${STEPS:-"assets transcribe timing characters scene render encode"}
DUR=$(ffprobe -v error -show_entries format=duration -of csv=p=0 voiceover.mp3)
mkdir -p build captions
for step in $STEPS; do
  echo "== $step"
  case $step in
    assets)     $PY scripts/fetch_assets.py "$ASSETS" ;;
    transcribe) HF_HUB_DISABLE_XET=1 $PY scripts/transcribe.py voiceover.mp3 build/words.json medium.en ;;
    timing)     $PY scripts/make_timing.py build/words.json script.txt "$DUR" ;;
    characters) $PY scripts/build_characters.py "$ASSETS/mh/data" build/characters.blend ;;
    scene)      $PY scripts/build_scene.py "$ASSETS" build/characters.blend build/timing.json chair_sniff.blend ;;
    render)     rm -rf build/frames; for j in $(seq "$JOBS"); do $PY scripts/render.py chair_sniff.blend build/frames "$SAMPLES" & sleep 20; done; wait ;;
    encode)     scripts/encode.sh build/frames ;;
  esac
done
