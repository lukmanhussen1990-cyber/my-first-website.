#!/usr/bin/env bash
# Package src/ into a single installable LuxuryTechHouse.mcaddon.
#
# A .mcaddon is a plain zip with each pack folder at the archive root, so the
# two manifests have to sit one level down and nothing may be nested deeper.
set -euo pipefail

root="$(cd "$(dirname "$0")" && pwd)"
out="$root/dist/LuxuryTechHouse.mcaddon"

# The oldest game this add-on must still import on. Minecraft refuses a pack
# outright when min_engine_version is above the running game, so raising this
# is what turns a working add-on into "failed to import" with no other clue.
TARGET="${TARGET:-1.21.0}"

# Every JSON has to parse or the pack loads with pieces silently missing.
while IFS= read -r file; do
  python3 -c "import json,sys; json.load(open(sys.argv[1]))" "$file" \
    || { echo "invalid JSON: $file" >&2; exit 1; }
done < <(find "$root/src" -name '*.json')

python3 - "$root" "$TARGET" <<'PY' || exit 1
import json, pathlib, sys

root, target = pathlib.Path(sys.argv[1]), tuple(int(n) for n in sys.argv[2].split("."))
bad = False

for manifest in sorted(root.glob("src/*/manifest.json")):
    got = tuple(json.load(open(manifest))["header"]["min_engine_version"])
    if got > target:
        print(f"{manifest}: min_engine_version {got} is above the {target} target", file=sys.stderr)
        bad = True

# Item schemas track the game version too: the minecraft:icon "textures" map
# does not exist in the 1.21.0 schema, where the key is a plain "texture".
for item in sorted(root.glob("src/*/items/*.json")):
    data = json.load(open(item))
    version = tuple(int(n) for n in data["format_version"].split("."))
    icon = data["minecraft:item"]["components"].get("minecraft:icon")
    if version > target:
        print(f"{item}: format_version {version} is above the {target} target", file=sys.stderr)
        bad = True
    if version <= (1, 21, 0) and isinstance(icon, dict) and "textures" in icon:
        print(f"{item}: minecraft:icon uses a 'textures' map, which format_version "
              f"{version} cannot parse - use {{'texture': ...}}", file=sys.stderr)
        bad = True

sys.exit(1 if bad else 0)
PY

mkdir -p "$root/dist"
rm -f "$out"
cd "$root/src"
zip -r -X -q "$out" luxury_tech_house_bp luxury_tech_house_rp
echo "built $out"
