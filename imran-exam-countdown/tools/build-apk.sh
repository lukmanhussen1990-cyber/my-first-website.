#!/usr/bin/env bash
# Builds a signed Imran-Exam-Countdown.apk from the command line, without the Android SDK
# or the Android Gradle Plugin (for machines that can't download them).
#
# Tools come from official sources and are checksum-verified:
#   aapt2, zipalign, apksigner, framework resources: Debian/Ubuntu packages built from AOSP
#     sudo apt-get install aapt zipalign apksigner android-framework-res
#   Kotlin compiler 2.1.21 ............ Maven Central (JetBrains)
#   Android 15 framework classes ...... Maven Central (Robolectric android-all, built from AOSP)
#   D8 dexer 8.7.18 ................... Google's R8 release repository
#
# Signing: set KEYSTORE, KEYSTORE_PASS, KEY_ALIAS and KEY_PASS for a release-signed APK.
# Without them the APK is signed with a local debug key and named *-debug.apk.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP="$ROOT/app"
OUT="${OUT_DIR:-$ROOT/build/offline}"
TOOLS="${TOOLCHAIN_DIR:-$HOME/.cache/imran-exam-countdown}"
DIST="${DIST_DIR:-$ROOT/dist}"

MAVEN="https://repo1.maven.org/maven2"
R8_REPO="https://storage.googleapis.com/r8-releases/raw"
KOTLIN=2.1.21
R8=8.7.18
ANDROID_ALL=15-robolectric-13954326
FRAMEWORK_RES=/usr/share/android-framework-res/framework-res.apk

log() { printf '\033[1;34m==>\033[0m %s\n' "$*"; }
die() { printf '\033[1;31merror:\033[0m %s\n' "$*" >&2; exit 1; }
need() { command -v "$1" >/dev/null 2>&1 || die "$1 not found. $2"; }

need java "Install JDK 17 or newer."
need javac "Install JDK 17 or newer."
need keytool "Install JDK 17 or newer."
need aapt2 "On Debian/Ubuntu: sudo apt-get install aapt"
need zipalign "On Debian/Ubuntu: sudo apt-get install zipalign"
need apksigner "On Debian/Ubuntu: sudo apt-get install apksigner"
need curl "Install curl."
need zip "Install zip."
need unzip "Install unzip."
need sha256sum "Install coreutils."
[ -f "$FRAMEWORK_RES" ] || die "Android framework resources missing. On Debian/Ubuntu: sudo apt-get install android-framework-res"

# fetch <url> <file> <sha256>
fetch() {
    local url=$1 file=$2 sum=$3
    mkdir -p "$TOOLS"
    if [ ! -f "$TOOLS/$file" ]; then
        log "Downloading $file"
        local attempt
        for attempt in 1 2 3 4 5; do
            if curl -fsSL -o "$TOOLS/$file.part" "$url"; then
                mv "$TOOLS/$file.part" "$TOOLS/$file"
                break
            fi
            sleep $((attempt * 4))
        done
        [ -f "$TOOLS/$file" ] || die "Could not download $url"
    fi
    echo "$sum  $TOOLS/$file" | sha256sum -c --quiet - || die "Checksum mismatch for $file (delete it and retry)"
}

log "Checking toolchain in $TOOLS"
fetch "$MAVEN/org/robolectric/android-all/$ANDROID_ALL/android-all-$ANDROID_ALL.jar" \
    "android-all-$ANDROID_ALL.jar" e17105f6c432357e6bb278a527f8e848d01fc56ccee01be77725bea23d871990
fetch "$R8_REPO/com/android/tools/r8/$R8/r8-$R8.jar" \
    "r8-$R8.jar" badba8e0fd96dc9f41f53a0686f20fc08f1172a9816461fec13b6635b7c883fa

KOTLIN_JARS=(
    "org/jetbrains/kotlin/kotlin-compiler-embeddable/$KOTLIN/kotlin-compiler-embeddable-$KOTLIN.jar 67a2e3673765f097725608cc7c843b0d8fdd94bd9af41327211361614aa57d49"
    "org/jetbrains/kotlin/kotlin-stdlib/$KOTLIN/kotlin-stdlib-$KOTLIN.jar 263bdc679e1f62012db7b091796279b6d71cf36f4797a98ff1ace05835f201c8"
    "org/jetbrains/kotlin/kotlin-script-runtime/$KOTLIN/kotlin-script-runtime-$KOTLIN.jar d8221f445854f30ac92c248d543609e0ecb5d85bb5ba34c043684b013cb5b897"
    "org/jetbrains/kotlin/kotlin-daemon-embeddable/$KOTLIN/kotlin-daemon-embeddable-$KOTLIN.jar 9401effd82de8606df3289308a275cc1d3573768665ca5edd09dc319c71715f4"
    "org/jetbrains/kotlin/kotlin-reflect/1.6.10/kotlin-reflect-1.6.10.jar 3277ac102ae17aad10a55abec75ff5696c8d109790396434b496e75087854203"
    "org/jetbrains/intellij/deps/trove4j/1.0.20200330/trove4j-1.0.20200330.jar c5fd725bffab51846bf3c77db1383c60aaaebfe1b7fe2f00d23fe1b7df0a439d"
    "org/jetbrains/kotlinx/kotlinx-coroutines-core-jvm/1.8.0/kotlinx-coroutines-core-jvm-1.8.0.jar 9860906a1937490bf5f3b06d2f0e10ef451e65b95b269f22daf68a3d1f5065c5"
    "org/jetbrains/annotations/13.0/annotations-13.0.jar ace2a10dc8e2d5fd34925ecac03e4988b2c0f851650c94b8cef49ba1bd111478"
)
KOTLINC_CP=""
for entry in "${KOTLIN_JARS[@]}"; do
    path=${entry% *}
    sum=${entry#* }
    fetch "$MAVEN/$path" "$(basename "$path")" "$sum"
    KOTLINC_CP="$KOTLINC_CP${KOTLINC_CP:+:}$TOOLS/$(basename "$path")"
done
STDLIB="$TOOLS/kotlin-stdlib-$KOTLIN.jar"

# Only the Android packages are needed to compile against; java.* comes from the JDK's
# Java 8 API (-Xjdk-release=1.8), which Android 8.0+ provides.
API_JAR="$TOOLS/android-35-api.jar"
if [ ! -f "$API_JAR" ]; then
    log "Extracting Android 15 API classes"
    tmp=$(mktemp -d)
    (cd "$tmp" && unzip -q "$TOOLS/android-all-$ANDROID_ALL.jar" 'android/*' 'com/android/*' 'dalvik/*' 'org/json/*' 'org/xmlpull/*' && zip -q -r -X "$API_JAR.part" .)
    mv "$API_JAR.part" "$API_JAR"
    rm -rf "$tmp"
fi

# One source of truth for ids and versions: app/build.gradle.kts.
gradle_value() {
    sed -nE "s/^[[:space:]]*$1[[:space:]]*=[[:space:]]*\"?([^\"]+)\"?[[:space:]]*$/\1/p" "$APP/build.gradle.kts" | head -1
}
APP_ID=$(gradle_value applicationId)
MIN_SDK=$(gradle_value minSdk)
TARGET_SDK=$(gradle_value targetSdk)
VERSION_CODE=$(gradle_value versionCode)
VERSION_NAME=$(gradle_value versionName)
[ -n "$APP_ID" ] && [ -n "$MIN_SDK" ] && [ -n "$VERSION_CODE" ] || die "Could not read app settings from app/build.gradle.kts"
log "Building $APP_ID $VERSION_NAME ($VERSION_CODE), minSdk $MIN_SDK, targetSdk $TARGET_SDK"

rm -rf "$OUT"
mkdir -p "$OUT/gen" "$OUT/classes" "$OUT/dex"

# The Gradle build takes the package from `namespace`; aapt2 needs it in the manifest.
sed "s|<manifest |<manifest package=\"$APP_ID\" |" "$APP/src/main/AndroidManifest.xml" > "$OUT/AndroidManifest.xml"

log "Compiling resources (aapt2)"
aapt2 compile --dir "$APP/src/main/res" -o "$OUT/res.zip"
aapt2 link -o "$OUT/base.apk" -I "$FRAMEWORK_RES" \
    --manifest "$OUT/AndroidManifest.xml" \
    --min-sdk-version "$MIN_SDK" --target-sdk-version "$TARGET_SDK" \
    --version-code "$VERSION_CODE" --version-name "$VERSION_NAME" \
    --java "$OUT/gen" "$OUT/res.zip"

log "Compiling R class"
javac --release 8 -nowarn -Xlint:-options -d "$OUT/classes" $(find "$OUT/gen" -name '*.java')

log "Compiling Kotlin"
java -Xmx3g -cp "$KOTLINC_CP" org.jetbrains.kotlin.cli.jvm.K2JVMCompiler \
    -Xjdk-release=1.8 -jvm-target 1.8 -no-reflect -no-stdlib -nowarn \
    -cp "$API_JAR:$OUT/classes:$STDLIB" \
    -d "$OUT/classes" \
    $(find "$APP/src/main/java" -name '*.kt')

log "Converting to dex (D8)"
(cd "$OUT/classes" && zip -q -r -X "$OUT/classes.jar" .)
java -Xmx2g -cp "$TOOLS/r8-$R8.jar" com.android.tools.r8.D8 \
    --release --min-api "$MIN_SDK" --lib "$API_JAR" \
    --output "$OUT/dex" "$OUT/classes.jar" "$STDLIB"

log "Packaging"
cp "$OUT/base.apk" "$OUT/unsigned.apk"
(cd "$OUT/dex" && zip -q -X "$OUT/unsigned.apk" classes*.dex)
zipalign -f -p 4 "$OUT/unsigned.apk" "$OUT/aligned.apk"

log "Signing"
if [ -n "${KEYSTORE:-}" ]; then
    : "${KEYSTORE_PASS:?set KEYSTORE_PASS}" "${KEY_ALIAS:?set KEY_ALIAS}"
    export KEY_PASS="${KEY_PASS:-$KEYSTORE_PASS}"
    APK_NAME="Imran-Exam-Countdown.apk"
    apksigner sign --ks "$KEYSTORE" --ks-pass env:KEYSTORE_PASS --ks-key-alias "$KEY_ALIAS" --key-pass env:KEY_PASS \
        --out "$OUT/$APK_NAME" "$OUT/aligned.apk"
else
    DEBUG_KS="$HOME/.android/debug.keystore"
    if [ ! -f "$DEBUG_KS" ]; then
        mkdir -p "$(dirname "$DEBUG_KS")"
        keytool -genkeypair -keystore "$DEBUG_KS" -storepass android -keypass android -alias androiddebugkey \
            -keyalg RSA -keysize 2048 -validity 10000 -dname "CN=Android Debug,O=Android,C=US" >/dev/null 2>&1
    fi
    APK_NAME="Imran-Exam-Countdown-debug.apk"
    apksigner sign --ks "$DEBUG_KS" --ks-pass pass:android --ks-key-alias androiddebugkey --key-pass pass:android \
        --out "$OUT/$APK_NAME" "$OUT/aligned.apk"
fi

log "Verifying"
apksigner verify --verbose "$OUT/$APK_NAME" | grep -E "^Verifies|v2 scheme|v3 scheme"
zipalign -c -p 4 "$OUT/$APK_NAME" || die "APK is not aligned"

mkdir -p "$DIST"
cp "$OUT/$APK_NAME" "$DIST/$APK_NAME"
(cd "$DIST" && sha256sum "$APK_NAME" > "$APK_NAME.sha256")
log "Done: $DIST/$APK_NAME ($(du -h "$DIST/$APK_NAME" | cut -f1))"
