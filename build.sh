#!/usr/bin/env bash
# Package src/ into a single installable LuxuryTechHouse.mcaddon.
#
# A .mcaddon is a plain zip with each pack folder at the archive root, so the
# two manifests have to sit one level down and nothing may be nested deeper.
set -euo pipefail

root="$(cd "$(dirname "$0")" && pwd)"
out="$root/dist/LuxuryTechHouse.mcaddon"

# Every JSON has to parse or the pack loads with pieces silently missing.
while IFS= read -r file; do
  python3 -c "import json,sys; json.load(open(sys.argv[1]))" "$file" \
    || { echo "invalid JSON: $file" >&2; exit 1; }
done < <(find "$root/src" -name '*.json')

mkdir -p "$root/dist"
rm -f "$out"
cd "$root/src"
zip -r -X -q "$out" luxury_tech_house_bp luxury_tech_house_rp
echo "built $out"
