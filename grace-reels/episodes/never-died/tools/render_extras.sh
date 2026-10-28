#!/bin/bash
# Cover image, 10 check stills and the half-size animatic (after the final reel).
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p out/stills
npx remotion still Cover out/cover_never-died.png --gl=swangle --log=error
for item in 01_hook:27 02_enoch:210 03_walking:615 04_chariot:756 05_red_x:966 06_whirlwind:1170 07_cloak:1446 08_mountain:1668 09_promise_card:1884 10_end_card:2160; do
	name=${item%%:*}
	frame=${item##*:}
	npx remotion still Reel "out/stills/$name.png" --frame=$frame --gl=swangle --log=error
done
npx remotion render Animatic out/animatic_never-died.mp4 --gl=swangle --codec=h264 --crf=23 --pixel-format=yuv420p --audio-codec=aac --concurrency=4 --log=error
echo done
