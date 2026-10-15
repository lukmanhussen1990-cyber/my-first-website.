#!/usr/bin/env bash
# Builds Imran Typer (an Android app around ../index.html) without Gradle: aapt2 + javac + d8 + apksigner.
# Needs: an Android SDK with build-tools and platform android-35 (SDK=...), a JDK, Python 3 with Pillow, NumPy, SciPy.
# Usage: SDK=/path/to/sdk KEYSTORE=/path/to/key.jks KS_PASS=... ./build.sh   → build/ImranTyper.apk
set -euo pipefail
cd "$(dirname "$0")"
: "${SDK:?set SDK to the Android SDK folder}"
BT="${BT:-$(ls -d "$SDK"/build-tools/* "$SDK"/android-1* 2>/dev/null | head -1)}"
PLAT="${PLAT:-$(ls "$SDK"/platforms/android-35/android.jar "$SDK"/android-35/android.jar 2>/dev/null | head -1)}"
KEYSTORE="${KEYSTORE:-imran-typer.jks}"; KS_PASS="${KS_PASS:-imrantyper}"
rm -rf build; mkdir -p build/assets/fonts build/gen build/classes build/dex
# assets: the page (with the typewriter font bundled, so it works offline), the logo cut into its moving parts
python3 tools/make_assets.py build/assets
python3 tools/make_intro_layers.py build/assets >/dev/null
FONTS="https://fonts.gstatic.com/s/courierprime/v11"
curl -sSf -o build/assets/fonts/cp400.woff2 "$FONTS/u-450q2lgwslOqpF_6gQ8kELawFpWs39pvk.woff2"
curl -sSf -o build/assets/fonts/cp700.woff2 "$FONTS/u-4k0q2lgwslOqpF_6gQ8kELY7pMT-Dfq9PrNX0.woff2"
python3 - <<'PY'
import re
s = open('../index.html', encoding='utf-8').read()
face = ('<style>@font-face{font-family:"Courier Prime";font-weight:400;font-style:normal;font-display:block;src:url(fonts/cp400.woff2) format("woff2")}'
        '@font-face{font-family:"Courier Prime";font-weight:700;font-style:normal;font-display:block;src:url(fonts/cp700.woff2) format("woff2")}</style>')
s = re.sub(r'<link rel="preconnect"[^>]*>\s*', '', s)
s = re.sub(r'<link href="https://fonts.googleapis.com[^>]*>', face, s)
s = s.replace('<title>Frankenwriter</title>', '<title>Imran Typer</title>')
# black until the opening film's first frame, so the app never flashes up before it
s = s.replace('<body>', '<body><div id="introCover" style="position:fixed;inset:0;z-index:51;background:#000"></div>'
              '<script>setTimeout(function(){var c=document.getElementById("introCover");if(c)c.remove()},6000)</script>', 1)
open('build/assets/index.html', 'w', encoding='utf-8').write(s)
PY
"$BT/aapt2" compile --dir res -o build/res.zip
"$BT/aapt2" link -o build/base.apk -I "$PLAT" --manifest AndroidManifest.xml \
  --min-sdk-version 24 --target-sdk-version 34 --version-code 2 --version-name 1.1 \
  -A build/assets build/res.zip --java build/gen
javac -nowarn -source 8 -target 8 -bootclasspath "$PLAT" -cp "$PLAT" -d build/classes \
  $(find src build/gen -name '*.java') 2>&1 | grep -v "bootstrap class path\|^warning\|^1 warning\|^Note:" || true
"$BT/d8" --release --min-api 24 --lib "$PLAT" --output build/dex $(find build/classes -name '*.class')
cp build/base.apk build/unsigned.apk
(cd build/dex && zip -q ../unsigned.apk classes.dex)
"$BT/zipalign" -p -f 4 build/unsigned.apk build/aligned.apk
if [ ! -f "$KEYSTORE" ]; then
  keytool -genkeypair -keystore "$KEYSTORE" -alias imran -keyalg RSA -keysize 2048 -validity 10000 \
    -storepass "$KS_PASS" -keypass "$KS_PASS" -dname "CN=Imran Typer" 2>/dev/null
fi
"$BT/apksigner" sign --ks "$KEYSTORE" --ks-pass "pass:$KS_PASS" --ks-key-alias imran --out build/ImranTyper.apk build/aligned.apk
"$BT/apksigner" verify build/ImranTyper.apk && ls -la build/ImranTyper.apk
