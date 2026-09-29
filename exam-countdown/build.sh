#!/usr/bin/env bash
# Builds a signed, aligned APK without Gradle.
#   aapt2 (compile+link) -> javac -> R8 (shrink, dex) -> zipalign -> apksigner
# Tools are located via $TOOLS_DIR (see tools/fetch-tools.sh).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
TOOLS="${TOOLS_DIR:-$ROOT/.tools}"
AAPT2="$TOOLS/bin/aapt2"
FRAMEWORK_RES="$TOOLS/bin/android-framework.apk"     # framework resources for `aapt2 link -I`
ANDROID_JAR="$TOOLS/dl/android-all-15.jar"           # compile classpath (API 35)
KOTLIN_STDLIB="$TOOLS/dl/kotlin-stdlib-2.1.21.jar"
R8_JAR="$TOOLS/dl/r8.jar"

SRC="$ROOT/app/src/main"
BUILD="$ROOT/build"
OUT_DIR="${OUT_DIR:-$ROOT/build/out}"
KEYSTORE="${KEYSTORE:-$TOOLS/exam-countdown.keystore}"
KS_PASS="${KS_PASS:-examcountdown}"
KEY_ALIAS="${KEY_ALIAS:-examcountdown}"

VERSION_CODE="${VERSION_CODE:-5}"
VERSION_NAME="${VERSION_NAME:-2.0.0}"
MIN_SDK=26
TARGET_SDK=35
APK_NAME="${APK_NAME:-Imran-Exam-Countdown-v${VERSION_NAME}.apk}"

# Extra classpath entries (e.g. test doubles) are not used for the release build.
rm -rf "$BUILD/gen" "$BUILD/classes" "$BUILD/dex" "$BUILD/res.zip" "$BUILD/base.apk"
mkdir -p "$BUILD/gen" "$BUILD/classes" "$BUILD/dex" "$OUT_DIR"

echo "==> [1/6] aapt2 compile"
"$AAPT2" compile --dir "$SRC/res" -o "$BUILD/res.zip"

echo "==> [2/6] aapt2 link"
"$AAPT2" link \
  -I "$FRAMEWORK_RES" \
  --manifest "$SRC/AndroidManifest.xml" \
  --min-sdk-version "$MIN_SDK" --target-sdk-version "$TARGET_SDK" \
  --version-code "$VERSION_CODE" --version-name "$VERSION_NAME" \
  --java "$BUILD/gen" \
  --proguard "$BUILD/aapt-rules.pro" \
  --auto-add-overlay \
  -o "$BUILD/base.apk" \
  "$BUILD/res.zip"

echo "==> [3/6] javac"
find "$SRC/java" "$BUILD/gen" -name '*.java' > "$BUILD/sources.txt"
javac -nowarn -encoding UTF-8 --release 17 \
  -Xlint:-options -XDsuppressNotes \
  -cp "$ANDROID_JAR:$KOTLIN_STDLIB" \
  -d "$BUILD/classes" @"$BUILD/sources.txt" 2> >(grep -v '^Picked up' >&2)

echo "==> [4/6] R8 (shrink + dex)"
( cd "$BUILD/classes" && jar cf "$BUILD/app-classes.jar" . )
java -cp "$R8_JAR" com.android.tools.r8.R8 \
  --release --min-api "$MIN_SDK" \
  --lib "$ANDROID_JAR" \
  --pg-conf "$BUILD/aapt-rules.pro" \
  --pg-conf "$ROOT/app/proguard-rules.pro" \
  --output "$BUILD/dex" \
  "$BUILD/app-classes.jar" "$KOTLIN_STDLIB" 2> >(grep -v '^Picked up' >&2)

echo "==> [5/6] package + zipalign"
cp "$BUILD/base.apk" "$BUILD/unsigned.apk"
( cd "$BUILD/dex" && zip -q -X -u ../unsigned.apk classes*.dex )
rm -f "$BUILD/aligned.apk"
zipalign -f -p 4 "$BUILD/unsigned.apk" "$BUILD/aligned.apk"

echo "==> [6/6] sign (v1+v2+v3)"
if [ ! -f "$KEYSTORE" ]; then
  echo "    generating keystore $KEYSTORE"
  keytool -genkeypair -keystore "$KEYSTORE" -storepass "$KS_PASS" -keypass "$KS_PASS" \
    -alias "$KEY_ALIAS" -keyalg RSA -keysize 2048 -validity 36500 \
    -dname "CN=Imran Exam Countdown, O=Imran, C=IN" 2> >(grep -v '^Picked up' >&2)
fi
apksigner sign --ks "$KEYSTORE" --ks-pass "pass:$KS_PASS" --key-pass "pass:$KS_PASS" \
  --ks-key-alias "$KEY_ALIAS" --min-sdk-version "$MIN_SDK" \
  --out "$OUT_DIR/$APK_NAME" "$BUILD/aligned.apk" 2> >(grep -v '^Picked up' >&2)
rm -f "$OUT_DIR/$APK_NAME.idsig"

apksigner verify --verbose --print-certs "$OUT_DIR/$APK_NAME" 2> >(grep -v '^Picked up' >&2) | head -12
ls -l "$OUT_DIR/$APK_NAME"
echo "OK  $OUT_DIR/$APK_NAME"
