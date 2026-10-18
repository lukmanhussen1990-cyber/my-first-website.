#!/usr/bin/env bash
# Download the public-domain NASA source imagery into assets_raw/ (not committed).
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p assets_raw
cd assets_raw
get() { [ -s "$1" ] || curl -fsSL --retry 3 -o "$1" "$2"; }
get earth_day_jul.jpg   "https://eoimages.gsfc.nasa.gov/images/imagerecords/74000/74393/world.topo.200407.3x5400x2700.jpg"
get earth_night_3km.jpg "https://eoimages.gsfc.nasa.gov/images/imagerecords/144000/144898/BlackMarble_2016_3km.jpg"
get clouds_8192.tif     "https://eoimages.gsfc.nasa.gov/images/imagerecords/57000/57747/cloud_combined_8192.tif"
get earth_topology.png  "https://unpkg.com/three-globe@2.31.0/example/img/earth-topology.png"
get moon_color_4k.tif   "https://svs.gsfc.nasa.gov/vis/a000000/a004700/a004720/lroc_color_poles_4k.tif"
get moon_ldem_16.tif    "https://svs.gsfc.nasa.gov/vis/a000000/a004700/a004720/ldem_16_uint.tif"
echo "assets_raw ready"
