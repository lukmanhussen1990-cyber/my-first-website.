# Imran's Exam Countdown (v1.4.0)

Android app (`com.imran.examcountdown`, minSdk 26) for Al-Ameen Academy's Class VIII half-yearly exams.
The original app was supplied only as an APK, so the source in `app/` was **recovered by decompiling it**
and repaired against the original bytecode.

## What's new in 1.4.0
- **Home-screen widget**: next exam with days left, then a live ticking timer inside the last 24 hours.
- **Launcher shortcuts** (long-press the icon): Focus timer, Timetable.
- **New app icon**: gold-ringed emblem on deep-forest gradient, plus a themed (monochrome) icon for Android 13+.
- **Bug fixes** (all were decompiler-level regressions found by comparing against the original bytecode, plus two
  original quirks): exam-progress percentage no longer shows 0%, checklist mini-rings and the celebration
  fireworks use the right fractions, countdown labels are consistently upper-case (DAY / HOURS / MIN / SEC), and
  the "NEXT EXAM · MIL / ELECTIVE" hint is shown again.
- Smaller and faster to start (APK 2.5 MB -> 2.0 MB; dex shrunk).

## Install
`releases/Imran-Exam-Countdown-v1.4.0.apk`. It is signed with a **new** key, so the previous version must be
uninstalled first (this clears its saved profile, photo, checklists and settings).

## Build (no Gradle)
`tools/fetch-tools.sh` is not included; the toolchain is `aapt2` (from apktool), `javac`, R8, `zipalign`, `apksigner`.
`./build.sh` produces a signed APK in `build/out/`; `tools/check.sh` is a 6-second compile check;
`tools/apicheck.sh` lists framework APIs newer than minSdk 26.

## Screenshot / smoke tests
`harness/shots.sh` runs the real app headlessly under Robolectric (native graphics) and writes PNGs to
`build/shots/` (`AppShotTest`, `WidgetShotTest`). `harness/androidx-test-stubs` replaces two androidx artifacts
that are only published on Google Maven.
