#!/usr/bin/env bash
# Packages the behaviour + resource pack into dist/AmusementPark.mcaddon
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
OUT="$ROOT/dist"
STAGE="$(mktemp -d)"
trap 'rm -rf "$STAGE"' EXIT

python3 "$ROOT/validate.py"

mkdir -p "$OUT"
cp -r "$ROOT/addon/behavior_packs/amusement_park_bp" "$STAGE/"
cp -r "$ROOT/addon/resource_packs/amusement_park_rp" "$STAGE/"

rm -f "$OUT/AmusementPark.mcaddon"
( cd "$STAGE" && zip -r -X -q "$OUT/AmusementPark.mcaddon" amusement_park_bp amusement_park_rp )

echo "built $OUT/AmusementPark.mcaddon ($(du -h "$OUT/AmusementPark.mcaddon" | cut -f1))"
