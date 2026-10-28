#!/bin/bash
# Cover image and the 10 check stills (full quality, 1080x1920).
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p out/stills
npx remotion still Cover out/cover_friend.png --gl=swangle --log=error
for item in 01_hook_kiss:45 02_rewind:164 03_towel:265 04_twelve_dots:419 05_judas_feet:494 06_coin_counter:678 07_scale:873 08_spinning_coin:927 09_friend:1335 10_feast:1800; do
	name=${item%%:*}
	frame=${item##*:}
	npx remotion still Reel "out/stills/$name.png" --frame=$frame --gl=swangle --log=error
done
echo done
