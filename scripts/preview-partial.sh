#!/usr/bin/env bash
# preview-partial.sh <last_scene_id> -> final/preview_scenes_1-N.mp4 (finished segments + the mastered audio)
set -euo pipefail
cd "$(dirname "$0")/.."
N=$1
list=$(mktemp)
for i in $(seq 1 "$N"); do f="build/segments/scene_$(printf %02d "$i").mp4"; [ -f "$f" ] || { echo "missing $f"; exit 1; }; echo "file '$PWD/$f'" >> "$list"; done
out="final/preview_scenes_1-$N.mp4"
mkdir -p final
ffmpeg -y -loglevel error -f concat -safe 0 -i "$list" -i audio/mix/master.wav -map 0:v:0 -map 1:a:0 -c:v copy -c:a aac -b:a 192k -shortest -movflags +faststart "$out"
rm -f "$list"
echo "$out"
