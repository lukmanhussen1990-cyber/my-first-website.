# Imran’s Exam Countdown

An offline Android app that counts down to each paper of the Class VIII Half-Yearly
Examination 2026–2027 at Al-Ameen Academy, Badarpur, for Imran Hussain (Class VIII Blue,
Roll 47, Hall 24).

**Download:** [`dist/Imran-Exam-Countdown.apk`](dist/Imran-Exam-Countdown.apk), with its SHA-256 in
[`dist/Imran-Exam-Countdown.apk.sha256`](dist/Imran-Exam-Countdown.apk.sha256).

- Release-signed with the app’s own key (not a debug key), v2 and v3 APK signatures.
- Android 8.0 or newer (minSdk 26), targets Android 15 (API 35).
- About 1 MB. No internet permission, no account, no ads.

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

- **Home:** “Hey Imran 👋”, a glowing countdown ring with rolling days/hours/minutes/seconds, the next
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
- Animations respect Android’s “Remove animations” setting (or the in-app Reduce motion switch), and the
  floating particles pause in Battery Saver and whenever the Home screen isn’t visible.

See the rest of this file (below) for how it was built and tested.

## Source code

A standard Android Studio project: Kotlin, no third-party libraries, plain Android framework views.

```
app/src/main/java/com/imran/examcountdown/
  core/     timetable, countdown and season logic, focus timer, reminder planning (no Android code)
  data/     SharedPreferences storage and the clock
  notify/   notifications, alarms, boot/time-change receivers
  ui/       theme, custom views (countdown ring, rolling digits, particles, confetti, timeline…) and screens
app/src/test/  unit and Robolectric tests
tools/build-apk.sh   command-line build used to produce dist/Imran-Exam-Countdown.apk
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

## Fonts

Outfit by the Outfit Project Authors, under the SIL Open Font License 1.1
(`docs/OFL-Outfit.txt`).
