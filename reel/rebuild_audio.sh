#!/usr/bin/env bash
# Rebuild everything except the 3D render with the current voice files (no new speech):
# placement, subtitles, music + effects mix and the final MP4.
set -euo pipefail
cd "$(dirname "$0")"
[ -f out/plate.mp4 ] || { echo "out/plate.mp4 is missing: render the 3D first (see README)." >&2; exit 1; }
python3 tools/place_voices.py
python3 tools/make_subtitles.py
python3 tools/make_audio.py
python3 tools/export.py
