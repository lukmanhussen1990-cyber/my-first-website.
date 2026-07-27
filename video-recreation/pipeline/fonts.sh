#!/usr/bin/env bash
# Inter (used for the ending word). Liberation Sans / DejaVu come from the distro.
set -euo pipefail
W="${1:?usage: fonts.sh <workdir>}"
mkdir -p "$W/fonts"
if [ ! -d "$W/fonts/inter" ]; then
  curl -sSL --max-time 120 -o "$W/fonts/inter.zip" \
    https://github.com/rsms/inter/releases/download/v4.0/Inter-4.0.zip
  unzip -o -q "$W/fonts/inter.zip" -d "$W/fonts/inter"
fi
