#!/usr/bin/env bash
# Usage: scripts/sheet.sh <dir-with-pngs> <out.png> [tileWidth]
set -e
dir="$1"; out="$2"; w="${3:-400}"
files=$(ls "$dir"/t*.png)
n=$(echo "$files" | wc -l)
inputs=""; filt=""; chain=""
i=0
for f in $files; do inputs="$inputs -i $f"; filt="$filt[$i]scale=$w:-1[v$i];"; chain="$chain[v$i]"; i=$((i+1)); done
ffmpeg -hide_banner -loglevel error -y $inputs -filter_complex "${filt}${chain}hstack=$n" "$out"
