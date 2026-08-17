#!/bin/sh
# Full clean rebuild of Lost Island: Abandoned.
set -e
cd "$(dirname "$0")/.."
python3 tools/gen_textures.py
python3 tools/gen_items.py
python3 tools/gen_blocks.py
python3 tools/gen_entities.py
python3 tools/gen_support.py
python3 tools/gen_terrain.py
python3 tools/gen_locations.py
python3 tools/gen_functions.py
python3 tools/gen_lang.py
python3 tools/validate.py
python3 tools/package.py
