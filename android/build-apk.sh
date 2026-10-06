#!/usr/bin/env bash
# ArrowGO! by ImranO - build a signed, installable APK from the web files, without Gradle.
#
#   android/build-apk.sh [--allow-placeholder]
#
# Pipeline: stage web files -> aapt2 compile/link -> javac -> d8 -> add classes.dex
#           -> zipalign -> apksigner sign (v1+v2+v3) -> apksigner verify -> dist/ArrowGO.apk
#
# Environment (all optional):
#   ANDROID_HOME / ANDROID_SDK_ROOT  Android SDK (default /opt/android-sdk)
#   JAVA_HOME                        JDK 11+ (default: javac/keytool on PATH)
#   ARROWGO_KEYSTORE                 keystore to sign with (default android/arrowgo-release.keystore,
#                                    generated on first run; a custom one must already exist)
#   ARROWGO_KS_ALIAS                 key alias (default arrowgo)
#   ARROWGO_KS_PASS                  keystore password (default arrowgo-imrano)
#   ARROWGO_KEY_PASS                 key password (default: same as ARROWGO_KS_PASS)
#
# Runnable from any directory (bash 3.2+, Linux or macOS). Intermediate files go to android/build/
# (gitignored). Rebuilding with the same inputs, key and tools gives a byte-identical APK.

set -euo pipefail

usage() {
    cat <<'EOF'
Usage: android/build-apk.sh [--allow-placeholder]

Builds dist/ArrowGO.apk (signed, zipaligned) from the web files in the repository root.

  --allow-placeholder  if index.html, app.js or levels.js is missing, build anyway with a
                       small generated test page instead of failing. Such a build is written
                       to android/build/ArrowGO-placeholder.apk only; dist/ArrowGO.apk is
                       left untouched. For testing the pipeline; never ship it.
  -h, --help           show this help
EOF
}

ALLOW_PLACEHOLDER=0
for arg in "$@"; do
    case "$arg" in
        --allow-placeholder) ALLOW_PLACEHOLDER=1 ;;
        -h|--help) usage; exit 0 ;;
        *) echo "error: unknown option: $arg" >&2; usage >&2; exit 2 ;;
    esac
done

die()  { echo "error: $*" >&2; exit 1; }
warn() { echo "warning: $*" >&2; }
step() { printf '\n==> %s\n' "$*"; }

# ----------------------------------------------------------------------------------------------
# Paths
# ----------------------------------------------------------------------------------------------
ANDROID_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$ANDROID_DIR/.." && pwd)"
BUILD_DIR="$ANDROID_DIR/build"
MANIFEST="$ANDROID_DIR/AndroidManifest.xml"
RES_DIR="$ANDROID_DIR/res"
SRC_DIR="$ANDROID_DIR/src"
DIST_DIR="$REPO_ROOT/dist"
OUT_APK="$DIST_DIR/ArrowGO.apk"

[ -f "$MANIFEST" ] || die "missing $MANIFEST"
[ -d "$RES_DIR" ]  || die "missing $RES_DIR"
[ -d "$SRC_DIR" ]  || die "missing $SRC_DIR"

# ----------------------------------------------------------------------------------------------
# Tools
# ----------------------------------------------------------------------------------------------
SDK="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-/opt/android-sdk}}"
BUILD_TOOLS_VERSION="34.0.0"
PLATFORM="android-34"
BT="$SDK/build-tools/$BUILD_TOOLS_VERSION"
ANDROID_JAR="$SDK/platforms/$PLATFORM/android.jar"

[ -d "$SDK" ] || die "Android SDK not found at $SDK (set ANDROID_HOME)"
for tool in aapt2 d8 zipalign apksigner; do
    [ -x "$BT/$tool" ] || die "missing $BT/$tool - install it with: sdkmanager \"build-tools;$BUILD_TOOLS_VERSION\""
done
[ -f "$ANDROID_JAR" ] || die "missing $ANDROID_JAR - install it with: sdkmanager \"platforms;$PLATFORM\""

if [ -n "${JAVA_HOME:-}" ] && [ -x "$JAVA_HOME/bin/javac" ]; then
    JAVAC="$JAVA_HOME/bin/javac"
    KEYTOOL="$JAVA_HOME/bin/keytool"
    export PATH="$JAVA_HOME/bin:$PATH" # d8/apksigner wrappers run "java"
else
    JAVAC="$(command -v javac || true)"
    KEYTOOL="$(command -v keytool || true)"
fi
[ -n "$JAVAC" ] && [ -x "$JAVAC" ] || die "javac not found (install a JDK 11+ or set JAVA_HOME)"
[ -n "$KEYTOOL" ] && [ -x "$KEYTOOL" ] || die "keytool not found (install a JDK 11+ or set JAVA_HOME)"
command -v java >/dev/null 2>&1 || die "java not found on PATH (needed by d8 and apksigner)"
if ! command -v zip >/dev/null 2>&1 && ! command -v python3 >/dev/null 2>&1; then
    die "need either 'zip' or 'python3' to add classes.dex to the APK"
fi
if command -v sha256sum >/dev/null 2>&1; then
    sha256_of() { sha256sum "$1" | cut -d ' ' -f 1; }
elif command -v shasum >/dev/null 2>&1; then
    sha256_of() { shasum -a 256 "$1" | cut -d ' ' -f 1; }
else
    sha256_of() { echo "(sha256sum/shasum not found)"; }
fi

# ----------------------------------------------------------------------------------------------
# Version info: AndroidManifest.xml is the single source of truth
# ----------------------------------------------------------------------------------------------
manifest_attr() {
    sed -n "s/.*android:$1=\"\\([^\"]*\\)\".*/\\1/p" "$MANIFEST" | head -n 1
}
PACKAGE="$(sed -n 's/.*package="\([^"]*\)".*/\1/p' "$MANIFEST" | head -n 1)"
VERSION_CODE="$(manifest_attr versionCode)"
VERSION_NAME="$(manifest_attr versionName)"
MIN_SDK="$(manifest_attr minSdkVersion)"
TARGET_SDK="$(manifest_attr targetSdkVersion)"
[ -n "$PACKAGE" ] && [ -n "$VERSION_CODE" ] && [ -n "$VERSION_NAME" ] && [ -n "$MIN_SDK" ] && [ -n "$TARGET_SDK" ] \
    || die "could not read package/versionCode/versionName/minSdkVersion/targetSdkVersion from $MANIFEST"

echo "ArrowGO! APK build: $PACKAGE $VERSION_NAME (code $VERSION_CODE), minSdk $MIN_SDK, targetSdk $TARGET_SDK"
echo "SDK: $SDK (build-tools $BUILD_TOOLS_VERSION, $PLATFORM)"

# ----------------------------------------------------------------------------------------------
# 1. Stage the web files into build/assets/www
# ----------------------------------------------------------------------------------------------
step "Staging web files"
rm -rf "$BUILD_DIR"
WWW="$BUILD_DIR/assets/www"
mkdir -p "$WWW"

# Exactly what the game needs at runtime (docs/ARCHITECTURE.md). fonts/ holds the self-hosted
# Nunito font that styles.css and index.html reference.
WEB_FILES=(index.html styles.css app.js levels.js sw.js manifest.json)
WEB_DIRS=(icons fonts)
REQUIRED_FILES=(index.html app.js levels.js)
# Never requested inside the app: og-image.png is only the link-preview image named by an
# og:image <meta> tag (about a quarter of the APK's size).
EXCLUDE_FROM_APK=(icons/og-image.png)

missing=()
for f in "${REQUIRED_FILES[@]}"; do
    [ -f "$REPO_ROOT/$f" ] || missing+=("$f")
done
if [ "${#missing[@]}" -gt 0 ] && [ "$ALLOW_PLACEHOLDER" -ne 1 ]; then
    die "missing required web file(s) in $REPO_ROOT: ${missing[*]}
       Write them first, or pass --allow-placeholder to test the pipeline with a dummy page."
fi

for f in "${WEB_FILES[@]}"; do
    if [ -f "$REPO_ROOT/$f" ]; then
        cp "$REPO_ROOT/$f" "$WWW/$f"
        echo "  www/$f"
    elif [ "$ALLOW_PLACEHOLDER" -ne 1 ] || [[ ! " ${REQUIRED_FILES[*]} " == *" $f "* ]]; then
        warn "optional web file $f not found, skipped"
    fi
done
for d in "${WEB_DIRS[@]}"; do
    if [ -d "$REPO_ROOT/$d" ]; then
        cp -RL "$REPO_ROOT/$d" "$WWW/$d"
        # No hidden files or docs in the APK.
        find "$WWW/$d" -depth -mindepth 1 \( -name '.*' -o -name '*.md' \) -exec rm -rf {} +
        for x in "${EXCLUDE_FROM_APK[@]}"; do
            case "$x" in "$d"/*) rm -f "$WWW/$x" ;; esac
        done
        echo "  www/$d/ ($(find "$WWW/$d" -type f | wc -l | tr -d ' ') files)"
    else
        warn "web directory $d/ not found, skipped"
    fi
done

PLACEHOLDER=0
if [ "${#missing[@]}" -gt 0 ]; then
    PLACEHOLDER=1
    warn "PLACEHOLDER BUILD: missing ${missing[*]}; www/index.html replaced by a generated test page"
    cat > "$WWW/index.html" <<'EOF'
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
<title>ArrowGO! (placeholder build)</title>
<style>
  html,body{margin:0;height:100%;background:#F5EBD8;color:#3B2A20;font:16px/1.4 system-ui,sans-serif;
    -webkit-user-select:none;user-select:none;-webkit-tap-highlight-color:transparent}
  main{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;
    min-height:100%;padding:24px;box-sizing:border-box;text-align:center}
  img{width:120px;height:120px}
  button{font:inherit;padding:10px 18px;border:0;border-radius:14px;background:#FF7A5C;color:#fff;min-width:220px}
  #log{font-size:13px;opacity:.75;white-space:pre-line}
</style>
</head>
<body>
<main>
  <img src="icons/logo.svg" alt="">
  <h1>ArrowGO!</h1>
  <p>Placeholder build: the game files were not available when this APK was built.</p>
  <p id="ver"></p>
  <button id="vib">AndroidBridge.vibrate(40)</button>
  <button id="dark">setSystemBars('#1E1B3A', false)</button>
  <button id="light">setSystemBars('#F5EBD8', true)</button>
  <button id="exit">AndroidBridge.exitApp()</button>
  <div id="log"></div>
</main>
<script>
(function () {
  var B = window.AndroidBridge, log = document.getElementById('log');
  function say(t) { log.textContent = t + '\n' + log.textContent; }
  document.getElementById('ver').textContent = B ? 'App version ' + B.getAppVersion() : 'No AndroidBridge (browser)';
  document.getElementById('vib').onclick = function () { B && B.vibrate(40); say('vibrate'); };
  document.getElementById('dark').onclick = function () { B && B.setSystemBars('#1E1B3A', false); document.body.style.background = '#1E1B3A'; say('dark bars'); };
  document.getElementById('light').onclick = function () { B && B.setSystemBars('#F5EBD8', true); document.body.style.background = '#F5EBD8'; say('light bars'); };
  document.getElementById('exit').onclick = function () { B && B.exitApp(); };
  var backs = 0;
  window.ArrowGO = {
    handleBack: function () { backs++; say('back #' + backs + (backs % 2 ? ' handled' : ' -> close')); return backs % 2 === 1; },
    onPause: function () { say('onPause'); },
    onResume: function () { say('onResume'); }
  };
})();
</script>
</body>
</html>
EOF
    echo "  www/index.html (generated placeholder)"
fi

# ----------------------------------------------------------------------------------------------
# 2. Resources + manifest + assets -> unsigned APK
# ----------------------------------------------------------------------------------------------
step "aapt2 compile"
mkdir -p "$BUILD_DIR/gen" "$BUILD_DIR/classes" "$BUILD_DIR/dex"
"$BT/aapt2" compile --dir "$RES_DIR" -o "$BUILD_DIR/compiled-res.zip"

step "aapt2 link"
"$BT/aapt2" link \
    -o "$BUILD_DIR/unsigned.apk" \
    -I "$ANDROID_JAR" \
    --manifest "$MANIFEST" \
    -A "$BUILD_DIR/assets" \
    --min-sdk-version "$MIN_SDK" \
    --target-sdk-version "$TARGET_SDK" \
    --version-code "$VERSION_CODE" \
    --version-name "$VERSION_NAME" \
    --java "$BUILD_DIR/gen" \
    "$BUILD_DIR/compiled-res.zip"

# ----------------------------------------------------------------------------------------------
# 3. Java -> classes -> classes.dex
# ----------------------------------------------------------------------------------------------
step "javac (--release 11)"
# (Plain read loops rather than mapfile, which bash 3.2 on macOS does not have.)
SOURCES=()
while IFS= read -r -d '' f; do SOURCES+=("$f"); done \
    < <(find "$SRC_DIR" "$BUILD_DIR/gen" -name '*.java' -print0 | LC_ALL=C sort -z)
[ "${#SOURCES[@]}" -gt 0 ] || die "no Java sources found"
# -parameters: JDK 21 javac writes nameless MethodParameters entries for the synthetic
# constructor parameters of anonymous classes, which crash d8 8.2 (NPE); naming them avoids it.
"$JAVAC" --release 11 -parameters -encoding UTF-8 -Xlint:all \
    -classpath "$ANDROID_JAR" -d "$BUILD_DIR/classes" "${SOURCES[@]}"

step "d8 (--min-api $MIN_SDK)"
CLASSES=()
while IFS= read -r -d '' f; do CLASSES+=("$f"); done \
    < <(find "$BUILD_DIR/classes" -name '*.class' -print0 | LC_ALL=C sort -z)
"$BT/d8" --release --min-api "$MIN_SDK" --lib "$ANDROID_JAR" \
    --output "$BUILD_DIR/dex" "${CLASSES[@]}"
[ -f "$BUILD_DIR/dex/classes.dex" ] || die "d8 did not produce classes.dex"

step "Adding classes.dex"
cp "$BUILD_DIR/unsigned.apk" "$BUILD_DIR/unaligned.apk"
# Same fixed entry time as aapt2 uses (1980-01-01), so rebuilding unchanged sources gives a
# byte-identical APK instead of a new binary diff in dist/ every time.
touch -t 198001010000 "$BUILD_DIR/dex/classes.dex"
if command -v zip >/dev/null 2>&1; then
    zip -q -j -X "$BUILD_DIR/unaligned.apk" "$BUILD_DIR/dex/classes.dex"
else
    python3 - "$BUILD_DIR/unaligned.apk" "$BUILD_DIR/dex/classes.dex" <<'EOF'
import sys, zipfile
with zipfile.ZipFile(sys.argv[1], "a", zipfile.ZIP_DEFLATED) as z:
    z.write(sys.argv[2], "classes.dex")
EOF
fi

# ----------------------------------------------------------------------------------------------
# 4. zipalign + sign
# ----------------------------------------------------------------------------------------------
step "zipalign"
"$BT/zipalign" -p -f 4 "$BUILD_DIR/unaligned.apk" "$BUILD_DIR/aligned.apk"

step "Signing"
DEFAULT_KEYSTORE="$ANDROID_DIR/arrowgo-release.keystore"
KEYSTORE="${ARROWGO_KEYSTORE:-$DEFAULT_KEYSTORE}"
KS_ALIAS="${ARROWGO_KS_ALIAS:-arrowgo}"
export ARROWGO_KS_PASS="${ARROWGO_KS_PASS:-arrowgo-imrano}"
export ARROWGO_KEY_PASS="${ARROWGO_KEY_PASS:-$ARROWGO_KS_PASS}"

if [ ! -f "$KEYSTORE" ]; then
    if [ -n "${ARROWGO_KEYSTORE:-}" ]; then
        die "ARROWGO_KEYSTORE points to $KEYSTORE, which does not exist"
    fi
    echo "Generating development keystore $KEYSTORE (alias $KS_ALIAS)"
    "$KEYTOOL" -genkeypair -noprompt \
        -keystore "$KEYSTORE" -storetype PKCS12 \
        -alias "$KS_ALIAS" -keyalg RSA -keysize 2048 -validity 10000 \
        -dname "CN=ImranO, O=ImranO Games, C=US" \
        -storepass:env ARROWGO_KS_PASS -keypass:env ARROWGO_KS_PASS
fi
echo "Keystore: $KEYSTORE (alias $KS_ALIAS)"

SIGNED_APK="$BUILD_DIR/ArrowGO-signed.apk"
"$BT/apksigner" sign \
    --ks "$KEYSTORE" --ks-key-alias "$KS_ALIAS" \
    --ks-pass env:ARROWGO_KS_PASS --key-pass env:ARROWGO_KEY_PASS \
    --v1-signing-enabled true --v2-signing-enabled true --v3-signing-enabled true \
    --out "$SIGNED_APK" "$BUILD_DIR/aligned.apk"

step "Verifying"
# --min-sdk-version 21 makes apksigner also check the v1 (JAR) signature, which it skips by
# default for minSdk >= 24 even though it is present.
"$BT/apksigner" verify --verbose --min-sdk-version 21 "$SIGNED_APK" | grep -E '^(Verifies|Verified using v[123] )' || true
"$BT/apksigner" verify "$SIGNED_APK" || die "apksigner verify failed"
"$BT/zipalign" -c -p 4 "$SIGNED_APK" || die "zipalign check failed"

# ----------------------------------------------------------------------------------------------
# 5. Output
# ----------------------------------------------------------------------------------------------
if [ "$PLACEHOLDER" -eq 1 ]; then
    # A pipeline test must never replace the real, committed release APK.
    OUT_APK="$BUILD_DIR/ArrowGO-placeholder.apk"
else
    mkdir -p "$DIST_DIR"
fi
cp "$SIGNED_APK" "$OUT_APK"
SIZE_BYTES="$(wc -c < "$OUT_APK" | tr -d ' ')"
SHA256="$(sha256_of "$OUT_APK")"

step "Done"
echo "APK:     $OUT_APK"
echo "Size:    $SIZE_BYTES bytes ($(awk -v b="$SIZE_BYTES" 'BEGIN { printf "%.1f KiB", b / 1024 }'))"
echo "SHA-256: $SHA256"
"$BT/aapt2" dump badging "$OUT_APK" 2>/dev/null | head -n 1 || true
if [ "$PLACEHOLDER" -eq 1 ]; then
    echo
    echo "*** PLACEHOLDER BUILD (missing: ${missing[*]}) - for pipeline testing only, do not ship. ***"
    echo "*** Written to $OUT_APK; dist/ArrowGO.apk was not changed. ***"
fi
