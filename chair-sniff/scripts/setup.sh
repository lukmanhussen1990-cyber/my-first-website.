#!/usr/bin/env bash
# One-time setup: Python venv with Blender-as-a-module (bpy 5.2), faster-whisper, and the MPFB2 add-on.
# Linux/macOS. Needs Python 3.13 (bpy 5.2 wheels are built for 3.13), git, ffmpeg (with libass + libx264).
# Headless Linux without a GPU also needs Mesa EGL:  sudo apt-get install -y libegl1 libegl-mesa0 libgl1-mesa-dri
set -euo pipefail
cd "$(dirname "$0")/.."
VENV=${VENV:-.venv}
python3.13 -m venv "$VENV" 2>/dev/null || python3 -m venv "$VENV"
"$VENV/bin/pip" install -q --upgrade pip
"$VENV/bin/pip" install -q "bpy==5.2.3" "faster-whisper>=1.2" numpy
# MPFB2 (MakeHuman for Blender) installed as a user extension so bpy can enable it
EXT=$("$VENV/bin/python" -c "import bpy, os; print(os.path.join(bpy.utils.resource_path('USER'), 'extensions', 'user_default'))")
mkdir -p "$EXT"
if [ ! -d "$EXT/mpfb" ]; then
  tmp=$(mktemp -d)
  git clone -q --depth 1 https://github.com/makehumancommunity/mpfb2 "$tmp/mpfb2"
  cp -r "$tmp/mpfb2/src/mpfb" "$EXT/mpfb"
  rm -rf "$tmp"
fi
echo "setup ok: $VENV, MPFB2 at $EXT/mpfb"
