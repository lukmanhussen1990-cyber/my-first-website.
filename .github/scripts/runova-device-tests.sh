#!/bin/bash
# On-device checks for RUNOVA, run inside the Android emulator by the CI workflow:
#  1. the instrumented flows (onboarding, tabs, denied location, a full GPS run, restart)
#  2. a real crash check: the last flow leaves a run recording, the app is killed, and the
#     relaunch must offer to recover that run, which is then saved from the dialog.
set -u
cd "$(dirname "$0")/../../runova"
PKG=com.runova.app.debug
OUT=app/build/device
mkdir -p "$OUT"
status=0

ui_dump() { adb shell uiautomator dump /sdcard/window.xml > /dev/null 2>&1; adb pull /sdcard/window.xml "$1" > /dev/null 2>&1; }

tap_text() {
  local xy
  xy=$(python3 - "$1" "$2" <<'PY'
import re, sys, html
xml, wanted = open(sys.argv[1], encoding="utf-8").read(), sys.argv[2]
for node in re.findall(r"<node [^>]*>", xml):
    t = re.search(r' text="([^"]*)"', node)
    b = re.search(r'bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"', node)
    if t and b and html.unescape(t.group(1)) == wanted:
        x1, y1, x2, y2 = map(int, b.groups())
        print((x1 + x2) // 2, (y1 + y2) // 2)
        break
PY
)
  [ -n "$xy" ] && adb shell input tap $xy
}

./gradlew :app:connectedDebugAndroidTest -Pandroid.injected.androidTest.leaveApksInstalledAfterRun=true || status=1
adb pull "/sdcard/Android/data/$PKG/files/screens/." "$OUT/" > /dev/null 2>&1 || true

echo "== crash recovery"
adb shell am force-stop "$PKG"
adb shell am start -n "$PKG/com.runova.app.ui.MainActivity" > /dev/null
sleep 1.5
adb exec-out screencap -p > "$OUT/00-splash.png"
found=0
for i in $(seq 1 20); do
  sleep 1
  ui_dump "$OUT/recovery.xml"
  if grep -q "Unfinished run found" "$OUT/recovery.xml"; then found=1; break; fi
done
if [ "$found" = 1 ]; then
  echo "PASS: the relaunch after killing the app mid-run offers to recover the run"
  adb exec-out screencap -p > "$OUT/13-recovery.png"
  tap_text "$OUT/recovery.xml" "Finish & save"
  saved=0
  for i in $(seq 1 20); do
    sleep 1
    ui_dump "$OUT/after-recovery.xml"
    if grep -q "VIEW DETAILS" "$OUT/after-recovery.xml"; then saved=1; break; fi
  done
  if [ "$saved" = 1 ]; then
    sleep 4
    adb exec-out screencap -p > "$OUT/14-recovered-run-saved.png"
    echo "PASS: the recovered run was saved and its summary shown"
  else
    echo "FAIL: saving the recovered run did not show the run summary"
    status=1
  fi
else
  echo "FAIL: no recovery dialog after killing the app mid-run"
  adb exec-out screencap -p > "$OUT/13-recovery-missing.png"
  status=1
fi

adb logcat -d -t 400 '*:E' > "$OUT/logcat-errors.txt" 2>/dev/null || true
grep -E "FATAL EXCEPTION|AndroidRuntime" -A 25 "$OUT/logcat-errors.txt" | head -80 || true
exit $status
