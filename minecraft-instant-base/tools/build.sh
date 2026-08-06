#!/usr/bin/env bash
# Builds dist/InstantBase.mcaddon (import this single file on Android/iOS)
# plus the separate .mcpack files, from the BP/ and RP/ folders.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DIST="$ROOT/dist"

python3 "$ROOT/tools/make_textures.py"

rm -rf "$DIST"
mkdir -p "$DIST"

cd "$ROOT"
zip -r -q -X "$DIST/InstantBase.mcaddon" BP RP -x '*.DS_Store'

cd "$ROOT/BP" && zip -r -q -X "$DIST/InstantBase_BP.mcpack" . -x '*.DS_Store'
cd "$ROOT/RP" && zip -r -q -X "$DIST/InstantBase_RP.mcpack" . -x '*.DS_Store'

echo "Built:"
ls -la "$DIST"
