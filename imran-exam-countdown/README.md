# Imran’s Exam Countdown

An offline Android app that counts down to each paper of the Class VIII Half-Yearly
Examination 2026–2027 at Al-Ameen Academy, Badarpur, for Imran Hussain (Class VIII Blue,
Roll 47, Hall 24).

**Download:** [`dist/Imran-Exam-Countdown.apk`](dist/Imran-Exam-Countdown.apk) (version 1.3.0), with its
SHA-256 in [`dist/Imran-Exam-Countdown.apk.sha256`](dist/Imran-Exam-Countdown.apk.sha256).

- Release-signed with the app’s own key (the same key as 1.2.0), v2 and v3 APK signatures.
- Android 8.0 or newer (minSdk 26), targets Android 15 (API 35).
- About 2.5 MB. No internet permission, no account, no ads.

## What’s new in 1.3.0

- **Opening (2.3 s).** It starts on deep forest green, the same colour as Android’s launch
  screen, so there is no flash and no second splash. Two fine gold arcs sweep up round the school
  emblem from the bottom and join at the top into a complete border; the emblem fades in and
  scales up gently from 92 %, settling on a soft spring; one restrained highlight passes across
  it; “Al-Ameen Academy” and “Badarpur · Estd. 1994” settle in underneath, letter by letter. Then
  the emblem glides into its place in Home’s header while the green gives way to the cream
  background and Home’s greeting, countdown and controls rise in. The emblem is only faded, scaled
  and moved, never spun or recoloured, and there are no particles or loading bars. Home is built
  underneath from the first frame; tap or press Back to skip. **Settings → Appearance** has
  *Opening animation* (on/off) and *Replay opening*.
- **Tapping your avatar.** It squeezes briefly and springs back, a thin gold ripple runs round its
  border, and it expands into the profile screen as a shared element (always round, never
  stretched); the controls fade in once it has settled. Closing reverses the whole thing.
- **Profile frames.** *Default* (the original gold border), *Gold Orbit* (a bright gold point with
  a short fading trail going round a fine border), *Emerald Wave* (two soft green waves travelling
  round), *Twin Comets* (a green and a gold trail orbiting opposite each other), *Gold Shimmer* (a
  metallic gold border with an occasional sweep of light) and *No Frame*. The previews use your own
  photo; tapping one previews it on the large avatar at once, **Apply** keeps it, **Cancel** goes
  back, **Reset to Default** restores the original, and the saved frame has a check. The choice is
  remembered and shown on Home, Settings and the profile screen. *Animate frame* keeps a chosen
  border still. Frames are drawn only in a thin band outside the photo: the photo itself never
  moves, changes size or gets covered.
- **Everyday polish.** Countdown digits slide vertically, and only the digits that change (each
  has a fixed-width slot, so nothing shifts sideways). Tab changes take 240 ms and the bottom
  bar’s pill slides smoothly (280 ms). Buttons squeeze gently when pressed, checklist ticks draw
  themselves in, the focus-timer line moves smoothly, and sheets and dialogs fade and scale in and
  out. Ordinary interactions take 150–300 ms; the profile transition a little longer.
- **Performance.** Continuous effects (drifting light, pulses, moving frames) run only on the
  screen you are looking at, pause in the background and in Battery Saver, and never pile up
  when you switch tabs. The screen isn’t rebuilt each second; only changed text is updated.

Motion still follows **Settings → Reduce motion** (and Android’s “Remove animations”): with reduced
motion there is no opening at launch (a replay shows a still picture that simply fades), frames
stay still, and screens change with simple fades.

### Updating

- **From 1.2.0:** install over it. 1.3.0 is signed with the same key, so everything is kept:
  profile, photo, choices, checklist ticks, focus history and settings. The frame starts as Default.
- **From 1.1.0 (one time only):** 1.2.0 and later are signed with a new release key, because the
  1.1.0 key didn’t survive the machine it was built on. Android only installs an update over an app
  signed with the same key, so uninstall the old app first, then install. Exam progress comes back
  by itself (it’s worked out from the dates); the name, photo, MIL/elective choices and checklist
  ticks need setting again.

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

- **Home:** “Hey, Imran” with your framed photo, a countdown whose digits slide as they change
  (days, hours, minutes, seconds), the next subject, date, start time and hall, a friendly message,
  and an exam-season progress bar.
- **Exam time:** when a paper starts, a live banner appears and the countdown moves to the following
  exam. After the final exam: confetti and “You did it, Imran! 🎉”.
- **Timetable:** animated vertical timeline with completed, today, live and upcoming states.
- **Study:** a 25-minute focus timer with pause, resume, reset and a 5-minute break, plus editable
  revision checklists for every subject.
- **Profile:** photo (choose, crop, replace, remove), display name and profile frame.
- **Settings:** profile, MIL and elective, per-exam date/time/duration edits, reminders (one day and
  one hour before), focus alerts, theme, opening animation and replay, reduced motion, and reset.
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
  ui/       theme, motion (Fx.kt: springs and easing), custom views (opening, sliding digits,
            framed avatar, drifting light, confetti, timeline…) and screens
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

`tools/run-tests.sh` runs the unit and Robolectric tests (JDK 17 or newer). Among them:
`OpeningTest` (green start, the arcs joining, the emblem never rotated, landing exactly on the
header, replay and disable), `ProfileTransitionTest` (ripple, shared-element flight, reverse on
close, rapid taps), `ProfileFramesTest` (each frame leaves the photo’s pixels untouched, the six
differ, animated ones move only when allowed, Apply/Cancel/Reset/Save and restarts),
`MotionLifecycleTest` (effects pause in the background, no loops pile up, only changed digits
slide) and `LayoutTest` (small screens, large text, dark mode, landscape, navigation bars). With
`SCREENSHOT_DIR=/some/dir` it also renders every screen to PNG, and `MotionFramesTest` records the
animations frame by frame (opening, profile transition, each frame style, countdown, tab
changes…) into `/some/dir/frames/<name>/`:

```
SCREENSHOT_DIR=/tmp/shots tools/run-tests.sh --tests '*MotionFramesTest*'
```

Tests that check timing pause Robolectric’s choreographer and step time one frame at a time
(`frames()` in `TestUi.kt`), so animations play at their real speed.

## Fonts

Source Serif 4 (The Source Serif 4 Project Authors) and Source Sans 3 (Adobe), under the SIL Open
Font License 1.1 (`docs/OFL-SourceSerif4.txt`, `docs/OFL-SourceSans3.txt`).
