#!/usr/bin/env bash
# Swap assets/index.html inside an existing APK, zipalign it and sign it with the school key.
#
#   BUILD_TOOLS=/path/to/build-tools/37.0.0 KS_PASS='secret' \
#   ./android/rebuild_apk.sh <input.apk> <index.html> <output.apk>
set -euo pipefail

IN_APK="${1:?input apk}"; HTML="${2:?index.html}"; OUT_APK="${3:?output apk}"
BT="${BUILD_TOOLS:?set BUILD_TOOLS to your Android build-tools folder}"
KS_PASS="${KS_PASS:?set KS_PASS to the keystore password}"
HERE="$(cd "$(dirname "$0")" && pwd)"
KS="$HERE/keystore/alameen-release.jks"
WORK="$(mktemp -d)"; trap 'rm -rf "$WORK"' EXIT

mkdir -p "$WORK/assets"
cp "$IN_APK" "$WORK/unsigned.apk"
cp "$HTML" "$WORK/assets/index.html"
( cd "$WORK" && zip -q -X unsigned.apk assets/index.html )        # replaces the entry inside the apk
zip -q -d "$WORK/unsigned.apk" 'META-INF/*.SF' 'META-INF/*.RSA' 'META-INF/*.MF' 2>/dev/null || true

"$BT/zipalign" -p -f 4 "$WORK/unsigned.apk" "$WORK/aligned.apk"
"$BT/apksigner" sign --ks "$KS" --ks-key-alias alameen --ks-pass "pass:$KS_PASS" --key-pass "pass:$KS_PASS" \
  --v2-signing-enabled true --v3-signing-enabled true --out "$OUT_APK" "$WORK/aligned.apk"
"$BT/apksigner" verify --verbose "$OUT_APK" | head -4
echo "Built: $OUT_APK"
