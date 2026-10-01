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

# wait_text FILE TEXT [SECONDS]: dumps the screen until TEXT (or content description) appears.
wait_text() {
  local f=$1 t=$2 n=${3:-20}
  for i in $(seq 1 "$n"); do
    ui_dump "$f"
    grep -qF -- "$t" "$f" && return 0
    sleep 1
  done
  return 1
}

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

# Taps the first text field on screen (used when a placeholder isn't exposed as text).
tap_edit() {
  local xy
  xy=$(python3 - "$1" <<'PY'
import re, sys
xml = open(sys.argv[1], encoding="utf-8").read()
for node in re.findall(r"<node [^>]*>", xml):
    if 'class="android.widget.EditText"' in node:
        b = re.search(r'bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"', node)
        x1, y1, x2, y2 = map(int, b.groups())
        print((x1 + x2) // 2, (y1 + y2) // 2)
        break
PY
)
  [ -n "$xy" ] && adb shell input tap $xy
}

hide_keyboard() {
  adb shell dumpsys input_method | grep -q "mInputShown=true" && adb shell input keyevent 4
  sleep 1
}

tap_desc() {
  local xy
  xy=$(python3 - "$1" "$2" <<'PY'
import re, sys, html
xml, wanted = open(sys.argv[1], encoding="utf-8").read(), sys.argv[2]
for node in re.findall(r"<node [^>]*>", xml):
    t = re.search(r' content-desc="([^"]*)"', node)
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

# ---------------------------------------------------------------------------------------------
# Release build smoke test: the shrunk (R8) APK installs, onboards, starts and discards a run,
# and makes a real Claude API request with a deliberately invalid key, which must come back as
# "rejected" (proving the Anthropic SDK still serialises and parses requests after shrinking).
RELEASE_APK=dist/app-release.apk
REL=com.runova.app
if [ -f "$RELEASE_APK" ]; then
  echo "== release build smoke test"
  adb install -r -g "$RELEASE_APK" > /dev/null
  adb logcat -c
  adb shell am start -n "$REL/com.runova.app.ui.MainActivity" > /dev/null
  rel_ok=1
  if wait_text "$OUT/r1.xml" "GET STARTED" 30; then
    adb exec-out screencap -p > "$OUT/20-release-onboarding.png"
    tap_text "$OUT/r1.xml" "GET STARTED"
    if wait_text "$OUT/r2.xml" "About you" 15; then
      tap_text "$OUT/r2.xml" "e.g. Imran" || tap_edit "$OUT/r2.xml"
      sleep 1; adb shell input text "Sam"; hide_keyboard
    fi
    ui_dump "$OUT/r2.xml"; tap_text "$OUT/r2.xml" "CONTINUE"
    wait_text "$OUT/r3.xml" "Daily goals" 15 && tap_text "$OUT/r3.xml" "CONTINUE"
    if wait_text "$OUT/r4.xml" "Permissions" 15; then
      tap_text "$OUT/r4.xml" "LET'S RUN" || tap_text "$OUT/r4.xml" "Continue" || tap_text "$OUT/r4.xml" "Skip for now"
    fi
    if wait_text "$OUT/r5.xml" "START RUN" 20; then
      echo "PASS: release build onboarding reaches Home"
      adb exec-out screencap -p > "$OUT/21-release-home.png"
      tap_text "$OUT/r5.xml" "START RUN"
      if wait_text "$OUT/r6.xml" "Kilometers" 20; then
        sleep 6
        adb exec-out screencap -p > "$OUT/22-release-running.png"
        ui_dump "$OUT/r6.xml"; tap_desc "$OUT/r6.xml" "Finish run"
        if wait_text "$OUT/r7.xml" "Discard run" 10; then
          tap_text "$OUT/r7.xml" "Discard run"
          wait_text "$OUT/r8.xml" "START RUN" 15 && echo "PASS: release build starts and discards a run" || { echo "FAIL: release build did not return Home after discarding"; rel_ok=0; }
        else
          echo "FAIL: release build finish sheet missing"; rel_ok=0
        fi
      else
        echo "FAIL: release build run screen missing"; rel_ok=0
      fi
      # Claude through the shrunk SDK: Profile > Units & Settings > AI Coach
      ui_dump "$OUT/r9.xml"; tap_text "$OUT/r9.xml" "Profile"
      if wait_text "$OUT/r10.xml" "Units &amp; Settings" 15; then
        tap_text "$OUT/r10.xml" "Units & Settings"
        sleep 2
        for i in 1 2 3 4 5 6; do
          ui_dump "$OUT/r11.xml"
          grep -qF "sk-ant-" "$OUT/r11.xml" && break
          adb shell input swipe 540 1900 540 700 250; sleep 1
        done
        tap_text "$OUT/r11.xml" "sk-ant-…" || tap_edit "$OUT/r11.xml"
        sleep 1; adb shell input text "sk-ant-api03-ci-invalid-key-000000000000000000000000"; hide_keyboard
        ui_dump "$OUT/r12.xml"; tap_text "$OUT/r12.xml" "Save key"
        verdict=""
        for i in $(seq 1 45); do
          sleep 1; ui_dump "$OUT/r13.xml"
          if grep -q "was rejected" "$OUT/r13.xml"; then verdict=rejected; break; fi
          if grep -q "reach Anthropic" "$OUT/r13.xml"; then verdict=offline; break; fi
          if grep -q "Connection test failed" "$OUT/r13.xml"; then verdict=failed; break; fi
        done
        adb exec-out screencap -p > "$OUT/23-release-claude-check.png"
        case "$verdict" in
          rejected) echo "PASS: release build reached the Claude API through the shrunk SDK (invalid key rejected as expected)";;
          offline) echo "SKIP: emulator could not reach api.anthropic.com";;
          *) echo "FAIL: release build Claude check ended with '${verdict:-no result}'"; grep -o 'Connection test failed[^"]*' "$OUT/r13.xml" | head -2; rel_ok=0;;
        esac
      else
        echo "FAIL: release build settings not reachable"; rel_ok=0
      fi
    else
      echo "FAIL: release build onboarding did not reach Home"; rel_ok=0
    fi
  else
    echo "FAIL: release build did not show onboarding"; rel_ok=0
  fi
  adb logcat -d > "$OUT/logcat-release.txt" 2>/dev/null || true
  if grep -q "FATAL EXCEPTION" "$OUT/logcat-release.txt"; then
    echo "FAIL: release build crashed"; grep -A 30 "FATAL EXCEPTION" "$OUT/logcat-release.txt" | head -60; rel_ok=0
  fi
  [ "$rel_ok" = 1 ] || status=1
else
  echo "SKIP: no release APK to smoke test"
fi

adb logcat -d -t 400 '*:E' > "$OUT/logcat-errors.txt" 2>/dev/null || true
grep -E "FATAL EXCEPTION|AndroidRuntime" -A 25 "$OUT/logcat-errors.txt" | head -80 || true
exit $status
