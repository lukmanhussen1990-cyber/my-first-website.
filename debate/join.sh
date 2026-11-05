#!/usr/bin/env bash
# Joins the 10 debate turns into one MP3, with a short pause between speakers.
# Put the clips in this folder as 01.mp3 ... 10.mp3 (in script order), then run:
#   bash join.sh
set -euo pipefail
cd "$(dirname "$0")"

ffmpeg -y -loglevel error -f lavfi -i anullsrc=r=44100:cl=mono -t 0.7 -q:a 2 gap.mp3

list=$(mktemp)
for i in $(seq -w 1 10); do
  ffmpeg -y -loglevel error -i "$i.mp3" -ar 44100 -ac 1 -q:a 2 "norm_$i.mp3"
  echo "file '$PWD/norm_$i.mp3'" >> "$list"
  [ "$i" != "10" ] && echo "file '$PWD/gap.mp3'" >> "$list"
done

ffmpeg -y -loglevel error -f concat -safe 0 -i "$list" -af loudnorm -q:a 2 debate_siren_vs_evan_zhao.mp3
rm -f norm_*.mp3 gap.mp3 "$list"
echo "Done: debate_siren_vs_evan_zhao.mp3 ($(ffprobe -v error -show_entries format=duration -of csv=p=0 debate_siren_vs_evan_zhao.mp3)s)"
