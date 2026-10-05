#!/usr/bin/env bash
# Installs the signed release APK on the connected emulator/device and runs
# the end-to-end bot (tool/device_bot.py). Usage: tool/device_test.sh <out_dir>
set -u
OUT=${1:-device_out}
APK=${APK:-release/BlockBlast.apk}
PKG=com.myapps.blockblast
mkdir -p "$OUT"

adb wait-for-device
{ echo "sdk=$(adb shell getprop ro.build.version.sdk)"; adb shell wm size; adb shell wm density; } | tee "$OUT/device.txt"

adb uninstall "$PKG" > /dev/null 2>&1 || true
adb install "$APK" 2>&1 | tee "$OUT/install.txt"
grep -q Success "$OUT/install.txt" || { echo "install failed"; exit 1; }
adb shell dumpsys package "$PKG" | grep -E "versionName|minSdk|targetSdk" | tee "$OUT/package.txt"

adb logcat -c
python3 tool/device_bot.py "$OUT"
status=$?

adb logcat -d > "$OUT/logcat.txt"
grep -E "BB_" "$OUT/logcat.txt" | tail -120
if grep -E "FATAL EXCEPTION|BB_ERROR" "$OUT/logcat.txt" > "$OUT/errors.txt"; then
  echo "Errors found in logcat:"; cat "$OUT/errors.txt"; status=1
fi
exit $status
