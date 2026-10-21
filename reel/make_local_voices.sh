#!/usr/bin/env bash
# Re-make the local (Piper) voices + word timings and re-export the reel. No 3D re-render.
set -euo pipefail
cd "$(dirname "$0")"
PY=.venv/bin/python; [ -x "$PY" ] || PY=python3
"$PY" voice/make_voices_local.py --force
"$PY" export.py --voices local
