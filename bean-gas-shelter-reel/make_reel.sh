#!/usr/bin/env bash
# Full build of the reel: timeline -> sound -> subtitles -> 3D frames -> MP4.
#   ./make_reel.sh                      final quality (SPP=2 samples per frame, full size)
#   SCALE=0.5 SPP=1 ./make_reel.sh      a quick half-size preview (build/preview.mp4)
# The voices are not remade here (they are files in assets/vo: tools/split_voiceover.py
# cut them from the supplied recording; tools/voices.py and revoice.sh remake them).
# The silent, subtitle-free render is kept as render/clean.mp4, so new voices or
# subtitles can be exported later without re-rendering the 3D (revoice.sh).
# Needs: node + playwright (Chromium), ffmpeg with libass/libx264, and a python with
# numpy scipy soundfile (PY=/path/to/python).
set -euo pipefail
cd "$(dirname "$0")"
PY=${PY:-/home/user/reel-venv/bin/python}
SCALE=${SCALE:-1}

node tools/export_timeline.mjs
"$PY" tools/audio.py
"$PY" tools/captions.py
tools/render_chunks.sh
if [ "$SCALE" = 1 ]; then
  tools/export.sh
else
  IN=build/preview_clean.mp4 OUT=build/preview.mp4 tools/export.sh
fi
