#!/bin/bash
# Cover image and the 10 check stills (full quality, 1080x1920).
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p out/stills
npx remotion still Cover out/cover_face-of-god.png --gl=swangle --log=error
for item in 01_storm_opening:30 02_montage_sea:294 03_kneel:405 04_cleft_light_river:717 05_light_trails:768 06_shining_face_walk:909 07_camp_step_back:1110 08_jesus_philip:1368 09_split_screen:1449 10_call_to_action:1812; do
	name=${item%%:*}
	frame=${item##*:}
	npx remotion still Reel "out/stills/$name.png" --frame=$frame --gl=swangle --log=error
done
echo done
