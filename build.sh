#!/usr/bin/env bash
# Packs SecretBunker_BP + SecretBunker_RP into SecretBunker.mcaddon.
#
# The two pack folders MUST sit at the root of the zip. Burying them one
# level deeper is the classic reason Minecraft imports a file and then
# shows nothing in the pack list.
set -euo pipefail
cd "$(dirname "$0")"

python3 tools/validate_build.py SecretBunker_BP

rm -f SecretBunker.mcaddon
zip -r -X -q SecretBunker.mcaddon SecretBunker_BP SecretBunker_RP \
  -x '*.DS_Store' '*/.git/*'

echo
echo "Built SecretBunker.mcaddon"
unzip -l SecretBunker.mcaddon
