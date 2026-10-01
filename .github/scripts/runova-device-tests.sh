#!/bin/bash
# On-device checks for RUNOVA, run inside the Android emulator by the CI workflow:
#  1. the instrumented flows (onboarding, tabs, denied location, a full GPS run, every screen
#     with six weeks of runs, restart)
#  2. a real crash check: the last flow leaves a run recording, the app is killed, and the
#     relaunch must offer to recover that run, which is then saved from the dialog
#  3. a smoke test of the shrunk release APK, including a real Claude API request
set -u
cd "$(dirname "$0")/../../runova"
PKG=com.runova.app.debug
OUT=app/build/device
mkdir -p "$OUT"
status=0

# The checks read and tap the live screen, so keep it on and keep the lock screen away.
wake() {
  adb shell input keyevent KEYCODE_WAKEUP > /dev/null 2>&1
  adb shell wm dismiss-keyguard > /dev/null 2>&1
  adb shell am broadcast -a android.intent.action.CLOSE_SYSTEM_DIALOGS > /dev/null 2>&1
}
adb shell svc power stayon true
adb shell settings put system screen_off_timeout 1800000
adb shell locksettings set-disabled true > /dev/null 2>&1 || true
# Slow CI emulators raise "… isn't responding" dialogs for their own apps (the launcher), which
# would cover the screenshots; error dialogs are for people, not for this run.
adb shell settings put global hide_error_dialogs 1
adb shell settings put secure anr_show_background 0
wake

ui_dump() {
  adb shell rm -f /sdcard/window.xml
  local msg
  msg=$(adb shell uiautomator dump /sdcard/window.xml 2>&1)
  case "$msg" in *ERROR*) echo "$msg" | tr -d '\r' >> "$OUT/uiautomator-errors.txt";; esac
  adb pull /sdcard/window.xml "$1" > /dev/null 2>&1 || : > "$1"
}

# wait_text FILE TEXT [SECONDS]: dumps the screen until TEXT (or a content description) appears.
wait_text() {
  local f=$1 t=$2 end=$((SECONDS + ${3:-20}))
  while [ "$SECONDS" -lt "$end" ]; do
    ui_dump "$f"
    grep -qF -- "$t" "$f" && return 0
    sleep 1
  done
  return 1
}

# What the device showed when a check failed.
diag() {
  echo "  -- diagnostics: $1"
  echo "  installed: $(adb shell pm list packages 2>/dev/null | grep -i runova | tr -d '\r' | tr '\n' ' ')"
  adb shell dumpsys power 2>/dev/null | grep -m1 'mWakefulness=' | tr -d '\r' | sed 's/^ */  /'
  adb shell dumpsys window 2>/dev/null | grep -E -m2 'mCurrentFocus|mFocusedApp' | tr -d '\r' | sed 's/^ */  /'
  if [ -s "$OUT/uiautomator-errors.txt" ]; then
    echo "  uiautomator errors:"; sort "$OUT/uiautomator-errors.txt" | uniq -c | head -3 | sed 's/^/    /'
  fi
  if [ -s "${2:-}" ]; then
    echo "  on screen:"; grep -o -E '(text|content-desc)="[^"]+"' "$2" | head -30 | sed 's/^/    /'
  else
    echo "  (no UI dump)"
  fi
  echo "  app log:"
  adb logcat -d -t 600 2>/dev/null | grep -E 'runova|AndroidRuntime|ActivityTaskManager' | tail -15 | tr -d '\r' | sed 's/^/    /'
}

# tap_node FILE ATTRIBUTE VALUE: taps the centre of the first node whose attribute equals VALUE.
tap_node() {
  local xy
  xy=$(python3 - "$1" "$2" "$3" <<'PY'
import re, sys, html
xml, attr, wanted = open(sys.argv[1], encoding="utf-8").read(), sys.argv[2], sys.argv[3]
for node in re.findall(r"<node [^>]*>", xml):
    t = re.search(r' %s="([^"]*)"' % attr, node)
    b = re.search(r'bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"', node)
    if t and b and html.unescape(t.group(1)) == wanted:
        x1, y1, x2, y2 = map(int, b.groups())
        print((x1 + x2) // 2, (y1 + y2) // 2)
        break
PY
)
  [ -n "$xy" ] && adb shell input tap $xy
}
tap_text() { tap_node "$1" text "$2"; }
tap_desc() { tap_node "$1" content-desc "$2"; }

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

shot() { adb exec-out screencap -p > "$OUT/$1.png"; }

echo "== instrumented flows"
./gradlew :app:connectedDebugAndroidTest -Pandroid.injected.androidTest.leaveApksInstalledAfterRun=true || status=1
adb pull "/sdcard/Android/data/$PKG/files/screens/." "$OUT/" > /dev/null 2>&1 || true

echo "== crash recovery"
wake
adb shell am force-stop "$PKG"
# The relaunch also captures the splash, with animations at normal speed for that one shot.
adb shell settings put global animator_duration_scale 1
adb shell am start -W -n "$PKG/com.runova.app.ui.MainActivity" 2>&1 | grep -E 'Status|LaunchState|TotalTime|Error' | tr -d '\r' | sed 's/^/  /'
# A burst through the splash; keep the most detailed frame (blank frames compress to almost nothing).
for i in 1 2 3 4 5 6; do sleep 0.3; shot "splash-$i"; done
mv "$(ls -S "$OUT"/splash-*.png | head -1)" "$OUT/00-splash.png"
rm -f "$OUT"/splash-*.png
adb shell settings put global animator_duration_scale 0
if wait_text "$OUT/recovery.xml" "Unfinished run found" 30; then
  echo "PASS: the relaunch after killing the app mid-run offers to recover the run"
  sleep 1
  shot 20-recovery
  tap_text "$OUT/recovery.xml" "Finish & save"
  if wait_text "$OUT/after-recovery.xml" "VIEW DETAILS" 20; then
    sleep 4
    shot 21-recovered-run-saved
    echo "PASS: the recovered run was saved and its summary shown"
  else
    echo "FAIL: saving the recovered run did not show the run summary"
    diag "after Finish & save" "$OUT/after-recovery.xml"
    shot 21-recovery-save-failed
    status=1
  fi
else
  echo "FAIL: no recovery dialog after killing the app mid-run"
  diag "relaunch after kill" "$OUT/recovery.xml"
  shot 20-recovery-missing
  status=1
fi

# ---------------------------------------------------------------------------------------------
# Release build smoke test: the shrunk (R8) APK installs, onboards, starts and discards a run,
# and makes a real Claude API request with a deliberately invalid key, which must come back as
# "rejected" (proving the Anthropic SDK still serialises and parses requests after shrinking).
RELEASE_APK=dist/app-release.apk
REL=com.runova.app
rel_fail() { echo "FAIL: $1"; diag "$1" "$2"; shot "39-release-failure"; rel_ok=0; }
if [ -f "$RELEASE_APK" ]; then
  echo "== release build smoke test"
  adb install -r -g "$RELEASE_APK" 2>&1 | tail -1 | tr -d '\r' | sed 's/^/  install: /'
  adb shell am force-stop "$PKG"
  wake
  adb logcat -c
  adb shell am start -W -n "$REL/com.runova.app.ui.MainActivity" 2>&1 | grep -E 'Status|LaunchState|Error' | tr -d '\r' | sed 's/^/  /'
  rel_ok=1
  if wait_text "$OUT/r1.xml" "GET STARTED" 45; then
    shot 30-release-onboarding
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
      sleep 2
      shot 31-release-home
      tap_text "$OUT/r5.xml" "START RUN"
      if wait_text "$OUT/r6.xml" "Kilometers" 20; then
        sleep 6
        shot 32-release-running
        ui_dump "$OUT/r6.xml"; tap_desc "$OUT/r6.xml" "Finish run"
        if wait_text "$OUT/r7.xml" "Discard run" 10; then
          tap_text "$OUT/r7.xml" "Discard run"
          if wait_text "$OUT/r8.xml" "START RUN" 15; then
            echo "PASS: release build starts and discards a run"
          else
            rel_fail "release build did not return Home after discarding" "$OUT/r8.xml"
          fi
        else
          rel_fail "release build finish sheet missing" "$OUT/r7.xml"
        fi
      else
        rel_fail "release build run screen missing" "$OUT/r6.xml"
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
        end=$((SECONDS + 60))
        while [ "$SECONDS" -lt "$end" ]; do
          sleep 1; ui_dump "$OUT/r13.xml"
          if grep -q "was rejected" "$OUT/r13.xml"; then verdict=rejected; break; fi
          if grep -q "reach Anthropic" "$OUT/r13.xml"; then verdict=offline; break; fi
          if grep -q "Connection test failed" "$OUT/r13.xml"; then verdict=failed; break; fi
        done
        shot 33-release-claude-check
        case "$verdict" in
          rejected) echo "PASS: release build reached the Claude API through the shrunk SDK (invalid key rejected as expected)";;
          offline) echo "SKIP: emulator could not reach api.anthropic.com";;
          *)
            rel_fail "release build Claude check ended with '${verdict:-no result}'" "$OUT/r13.xml"
            msg=$(grep -o 'Connection test failed[^"]*' "$OUT/r13.xml" | head -1)
            echo "  $msg"
            # Name the shrunk classes in the message with the R8 mapping of this build.
            if [ -n "$msg" ] && [ -f dist/mapping/mapping.txt ]; then
              for c in $(echo "$msg" | grep -o -E '[A-Za-z_$][A-Za-z0-9_$]*(\.[A-Za-z_$][A-Za-z0-9_$]*)+' | sort -u); do
                grep -F " -> $c:" dist/mapping/mapping.txt | grep -v '^ ' | sed 's/^/  R8 mapping: /'
              done
            fi;;
        esac
      else
        rel_fail "release build settings not reachable" "$OUT/r10.xml"
      fi
    else
      rel_fail "release build onboarding did not reach Home" "$OUT/r5.xml"
    fi
  else
    rel_fail "release build did not show onboarding" "$OUT/r1.xml"
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
