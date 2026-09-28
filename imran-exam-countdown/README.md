# Imran’s Exam Countdown

An offline Android app that counts down to each paper of the Class VIII Half-Yearly
Examination 2026–2027 at Al-Ameen Academy, Badarpur, for Imran Hussain (Class VIII Blue,
Roll 47, Hall 24).

**Download:** [`dist/Imran-Exam-Countdown.apk`](dist/Imran-Exam-Countdown.apk) (version 1.2.0), with its
SHA-256 in [`dist/Imran-Exam-Countdown.apk.sha256`](dist/Imran-Exam-Countdown.apk.sha256).

- Release-signed with the app’s own key (not a debug key), v2 and v3 APK signatures.
- Android 8.0 or newer (minSdk 26), targets Android 15 (API 35).
- About 1 MB. No internet permission, no account, no ads.

## What’s new in 1.2.0: motion

Every animation was redesigned, in the school’s green, ivory and gold:

- **Opening:** a spotlight blooms, a green and a gold ring trace round the emblem from opposite
  sides led by glowing comets, 60 watch-bezel ticks light up, the emblem springs in with a gold
  shockwave and a burst of sparks, light rays turn behind it, the school’s name gathers in letter by
  letter over a gold rule, then the emblem glides into the header as the screen opens like an iris.
  (The emblem itself is only faded, scaled and moved, never rotated or recoloured.)
- **Countdown:** the figures sit on little drums that turn like a mechanical counter — blurred
  while fast, landing on a spring, turning right to left like a carry. Minutes, hours and days
  flash gold as they tick over, and on Home’s entrance every drum spins like a slot machine.
- **Home:** soft green and gold light drifts behind the page with rising gold dust (with a gentle
  parallax); the progress line has a glowing head and a light running along it; the exam-progress
  bars fill one by one with a glint; the “It’s exam time!” card pings like radar and catches the light.
- **Celebration:** confetti cannons, three fireworks and falling glitter, with pieces tumbling in 3D.
  Marking an exam finished, completing a focus session and ticking off a task each get a small burst.
- **Everywhere:** tabs slide along the direction of travel (the old one recedes and blurs), the
  bottom bar’s pill travels like a drop of liquid, content rises in on springs, switches squash and
  ripple, buttons bounce back when released, and the timetable’s rails draw themselves in.

Motion still follows **Settings → Reduce motion** (and Android’s “Remove animations”): with
reduced motion everything appears instantly. Continuous effects — the drifting light, pulses and
shimmer — pause in Battery Saver and whenever their screen isn’t visible.

### Updating from 1.1.0 (one time only)

1.2.0 is signed with a new release key: the 1.1.0 key didn’t survive the machine it was built
on. Android only installs an update over an app signed with the same key, so this one time:
**uninstall the old app, then install 1.2.0.** Exam progress comes back by itself (it’s worked out
from the dates); the name, photo, MIL/elective choices and checklist ticks need setting again.
Keep the new key file safe (outside this public repository) and future updates will install over
this version normally.

## Install on an Android phone

1. Copy `Imran-Exam-Countdown.apk` to the phone, or download it on the phone.
2. Open the file from Files or Downloads. Android asks you to allow installs from that app
   (for example “Files” or “Chrome”). Tap **Settings**, switch on **Allow from this source**,
   then go back.
3. Tap **Install**, then **Open**.
4. The first run is a short setup: choose **Bengali or Hindi** for MIL and your **elective**,
   then decide whether to switch on reminders. Android asks for notification permission only if
   you switch reminders on.

If Play Protect warns about an app from an unknown developer, choose **More details → Install anyway**.
That warning appears for any app that isn’t from the Play Store.

## The timetable

All papers start at **12:30 PM India time (Asia/Kolkata)**. Only dates with a Class VIII exam
are included.

| Date | Day | Paper |
| --- | --- | --- |
| 28 Sep 2026 | Monday | MIL (Bengali / Hindi) |
| 30 Sep 2026 | Wednesday | English-I |
| 3 Oct 2026 | Saturday | Social Science |
| 5 Oct 2026 | Monday | General Science |
| 7 Oct 2026 | Wednesday | General Mathematics |
| 8 Oct 2026 | Thursday | English-II |
| 10 Oct 2026 | Saturday | Moral Science |
| 12 Oct 2026 | Monday | Elective (Advanced Mathematics / Computer Science / Arabic) |

The timetable gives the Class VIII session as 12:30 PM – 3:30 PM and notes three hours for core
subjects and one and a half hours for non-core subjects, without saying which subjects are core.
So the app never invents an end time. Each exam’s duration starts as **Not confirmed** and can be
set in Settings. Until then, a started exam shows **“It’s exam time!”** until you tap **Mark as
finished** or the day ends.

## Features

- **Home:** “Hey, Imran”, a countdown on rolling drums (days, hours, minutes, seconds), the next
  subject, date, start time and hall, a friendly message, and an exam-season progress bar.
- **Exam time:** when a paper starts, a live banner appears and the countdown moves to the following
  exam. After the final exam: confetti and “You did it, Imran! 🎉”.
- **Timetable:** animated vertical timeline with completed, today, live and upcoming states.
- **Study:** a 25-minute focus timer with pause, resume, reset and a 5-minute break, plus editable
  revision checklists for every subject.
- **Settings:** profile, MIL and elective, per-exam date/time/duration edits, reminders (one day and
  one hour before), focus alerts, reduced motion, and reset.
- Countdowns and the timer are always recalculated from timestamps, so they stay correct after the
  app is closed, backgrounded or the phone restarts.
- Animations respect Android’s “Remove animations” setting (or the in-app Reduce motion switch), and
  continuous effects pause in Battery Saver and whenever their screen isn’t visible.

See the rest of this file (below) for how it was built and tested.

## Source code

A standard Android Studio project: Kotlin, no third-party libraries, plain Android framework views.

```
app/src/main/java/com/imran/examcountdown/
  core/     timetable, countdown and season logic, focus timer, reminder planning (no Android code)
  data/     SharedPreferences storage and the clock
  notify/   notifications, alarms, boot/time-change receivers
  ui/       theme, motion (Fx.kt: springs, easing, blur), custom views (intro, drum digits, drifting
            light, confetti and fireworks, timeline…) and screens
app/src/test/  unit and Robolectric tests
tools/build-apk.sh   command-line build used to produce dist/Imran-Exam-Countdown.apk
tools/run-tests.sh   runs the tests without the Android Gradle Plugin
```

### Build with Android Studio

Open this folder (`imran-exam-countdown/`) in Android Studio and run the `app` configuration.
It uses Android Gradle Plugin 8.7.3, Kotlin 2.1.21 and Gradle 8.11.1.

A build from Android Studio is signed with your own debug key, so it can’t install over the release
APK. Uninstall first, or sign with the release key (see `app/build.gradle.kts`).

### Build from the command line (no Android SDK needed)

```
sudo apt-get install aapt zipalign apksigner android-framework-res   # Debian/Ubuntu
KEYSTORE=/path/release.jks KEYSTORE_PASS=... KEY_ALIAS=imran-exam-countdown tools/build-apk.sh
```

Without the `KEYSTORE…` variables the script signs with a local debug key and writes
`dist/Imran-Exam-Countdown-debug.apk`.

### Tests, screenshots and motion frames

`tools/run-tests.sh` runs the unit and Robolectric tests (JDK 17 or newer). With
`SCREENSHOT_DIR=/some/dir` it also renders every screen to PNG, and `MotionFramesTest` records the
animations frame by frame (intro, countdown, celebration, tab changes, switches…) into
`/some/dir/frames/<name>/`:

```
SCREENSHOT_DIR=/tmp/shots tools/run-tests.sh --tests '*MotionFramesTest*'
```

Tests that check timing pause Robolectric’s choreographer and step time one frame at a time
(`frames()` in `TestUi.kt`), so animations play at their real speed.

## Fonts

Source Serif 4 (The Source Serif 4 Project Authors) and Source Sans 3 (Adobe), under the SIL Open
Font License 1.1 (`docs/OFL-SourceSerif4.txt`, `docs/OFL-SourceSans3.txt`).
