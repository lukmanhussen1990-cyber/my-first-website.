#!/usr/bin/env bash
# Render every shot of the reel to build/<shot>.mkv (lossless), one after another.
# llvmpipe (software OpenGL) already uses every CPU core, so shots run sequentially.
set -euo pipefail
cd "$(dirname "$0")"
SHOTS="${*:-1A 2A 2B 3A 3B 4A 4B 5A 5B 6A 6B 6C}"
for s in $SHOTS; do
  echo "=== shot $s ($(date +%T))"
  xvfb-run -a -s "-screen 0 1280x1024x24" python3 render.py --shot "$s" --outdir build
done
echo "=== all shots done ($(date +%T))"
