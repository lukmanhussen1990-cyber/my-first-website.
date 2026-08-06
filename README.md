# Alarm Handler

A native Android alarm clock, in Kotlin and Jetpack Compose, run by a small red
pixel creature. It sleeps while an alarm is pending, jumps when it rings, sulks
if you snooze too often, and celebrates when you finally get up.

Everything stays on the phone — no account, no server, no internet access.

<p align="center">
  <img src="app/src/main/res/drawable-nodpi/pixel_city_header.png" width="640" alt="The Alarm Handler mascot in front of a pixel city skyline">
</p>

---

## Install the APK

The build is committed so you can install it without opening Android Studio.

| Build | File | Size | Notes |
|---|---|---|---|
| **Release** (recommended) | [`dist/alarm-handler-1.0-release.apk`](dist/alarm-handler-1.0-release.apk) | ~2 MB | Signed, optimised |
| Debug | [`dist/alarm-handler-1.0-debug.apk`](dist/alarm-handler-1.0-debug.apk) | ~11 MB | Installs alongside the release build as *Alarm Handler (debug)* |

1. On your phone, open this repository on GitHub, tap the APK, then tap the
   **download** icon (raw file).
2. Open the downloaded file. Android will ask whether to allow installs from
   your browser or file manager — allow it, then tap **Install**.
3. Open **Alarm Handler** and work through the permission cards on the home
   screen (see below).

Requires **Android 8.0 (API 26) or newer**; built and targeted against
**Android 15 (API 35)**, so it follows the Android 14+ rules for foreground
services, exact alarms and full-screen intents.

---

## Permissions, and why each one is needed

The app runs with every one of these denied. Each is a step down in
reliability, not a wall, and the home screen shows a card explaining whatever
is currently limiting it.

| Permission | Why |
|---|---|
| `SCHEDULE_EXACT_ALARM` / `USE_EXACT_ALARM` | Ring at the exact minute. Without it Android may delay an alarm by several minutes. |
| `RECEIVE_BOOT_COMPLETED` | Re-arm every enabled alarm after a restart. Android forgets all scheduled alarms when the phone reboots. |
| `POST_NOTIFICATIONS` | The ringing alarm is delivered as a notification, which also carries the Snooze and Dismiss buttons. |
| `USE_FULL_SCREEN_INTENT` | Show the full alarm screen over the lock screen instead of a small banner. |
| `VIBRATE` | Vibrate while ringing. |
| `FOREGROUND_SERVICE` + `FOREGROUND_SERVICE_MEDIA_PLAYBACK` | Keep audio and vibration alive while the screen is off or the app is closed. Used **only** while an alarm is actually ringing. |
| `WAKE_LOCK` | Keep the CPU awake for the few minutes an alarm rings. |
| `REQUEST_IGNORE_BATTERY_OPTIMIZATIONS` | Offered from Settings so you can exclude the app from battery optimisation. Never requested silently. |
| `READ_MEDIA_AUDIO` | Only if you pick one of your own audio files as an alarm sound. |

### Allowing exact alarms

Android 12 and newer gate exact alarms behind a separate switch.

- In the app: **Settings → Permissions → Exact alarms → Fix this**, or tap
  **Fix this** on the home-screen card.
- Manually: **Android Settings → Apps → Alarm Handler → Alarm & reminders →
  Allow setting alarms and reminders**.

### Allowing full-screen alarms (Android 14+)

Android 14 revokes full-screen notifications for apps it does not recognise as
alarm or calling apps.

- In the app: **Settings → Permissions → Full-screen alarms → Fix this**.
- Manually: **Android Settings → Apps → Alarm Handler → Notifications →
  Manage full-screen notifications** (name varies by manufacturer).

Without it the alarm still rings and still shows a heads-up notification — it
just does not take over the lock screen.

### Disabling battery optimisation

This is the single most common cause of a late alarm on real phones.

- In the app: **Settings → Permissions → Ignoring battery optimisation →
  Fix this**, then choose **Allow**.
- Manually: **Android Settings → Apps → Alarm Handler → Battery →
  Unrestricted**.

Several manufacturers add a second, non-standard list on top of Android's own
(Samsung "Sleeping apps" / "Never sleeping apps", Xiaomi "Autostart", Huawei
"Protected apps", OnePlus/Oppo "Battery optimisation → Don't optimise"). If an
alarm is ever late, check that list too — Android's own settings cannot see it.

---

## Building from source

### Open in Android Studio

1. Android Studio **Ladybug (2024.2)** or newer, with **JDK 17+**.
2. **File → Open**, select this folder, and let Gradle sync.
3. Pick the `app` configuration and press **Run**.

The Android SDK path is read from `local.properties`, which is not committed —
Android Studio writes it for you on first sync. From the command line, either
let it use `$ANDROID_HOME` or create the file yourself:

```properties
sdk.dir=/path/to/Android/Sdk
```

### From the command line

```bash
./gradlew assembleDebug          # app/build/outputs/apk/debug/app-debug.apk
./gradlew testDebugUnitTest      # scheduling unit tests
./gradlew lintDebug              # Android lint
```

### Generating a release APK

A signing key is already committed (`alarm-handler.keystore`, configured by
`keystore.properties`) so the release build works out of the box:

```bash
./gradlew assembleRelease
# -> app/build/outputs/apk/release/app-release.apk
```

> **This key is for personal sideloading only.** Its password is in the
> repository, so anyone can sign an update with it. Before publishing anywhere,
> generate your own and never commit it:
>
> ```bash
> keytool -genkeypair -v -keystore my-release.keystore \
>     -alias myalias -keyalg RSA -keysize 2048 -validity 10000
> ```
>
> then point `keystore.properties` at it and add both files to `.gitignore`.
> If `keystore.properties` is missing the release build simply comes out
> unsigned rather than failing.

---

## What it does

**Alarms**
Unlimited alarms · 12/24-hour with AM/PM · repeat on any days or one-time ·
custom name · enable/disable · edit, duplicate (swipe right), delete
(swipe left, with undo) · time remaining until the next alarm · list sorted by
next ring.

**Sound and feel**
Five tones built into the app, any device ringtone, any audio file, or silent ·
per-alarm volume · vibration toggle · gradual volume ramp · snooze of 5/10/15/
20/30 minutes · optional maximum snooze count.

**Dismiss challenges**
Simple tap · hold for three seconds · a maths question · catch the hopping
mascot · repeat a flashing pattern · shake the phone. Every alarm can also set
a safety time after which a plain **Dismiss** button always appears, so a
challenge can never trap you.

**Screens**
Home · Add/Edit alarm · Sound picker · Dismiss challenge picker · Settings ·
Alarm history · About.

**Settings**
Light/dark/system theme · pixel-art style (on by default) · 12/24-hour clock ·
default snooze, sound, vibration and gradual volume · week start · how long an
unanswered alarm rings · **test alarm in five seconds** · backup and restore to
a JSON file you choose · reset settings.

**Accessibility**
48dp minimum tap targets · content descriptions throughout · swipe actions also
exposed as screen-reader actions · every status spelled out in words as well as
colour (`[x]`, `[ ]`, `On`/`Off`, `[OK]`/`[!]`) · all text in `sp` so it scales
with the system font size · **reduced motion** switch that stops every bounce,
shake and flash while leaving the app fully usable.

---

## How the alarms actually work

The reliability rules are worth stating, because most alarm-app bugs live here.

- **`setAlarmClock()`** is used for every alarm. It is the only scheduling call
  Android treats as a real user-facing alarm: exempt from Doze and app-standby
  buckets, and it shows the alarm icon in the status bar. If the user has
  revoked exact alarms the app falls back to `setAndAllowWhileIdle()` and says
  so on screen, rather than failing silently.
- **No duplicates, ever.** Each alarm owns exactly two pending intents — one
  for its regular occurrence, one for a pending snooze — keyed by both request
  code *and* intent data (extras are ignored when Android compares pending
  intents, a classic source of duplicate alarms). Every write cancels before it
  schedules, so re-arming twice is harmless.
- **Re-armed on everything that wipes alarms**: boot, locked boot, app update,
  clock change, time-zone change, date change, and every cold start of the app
  (a force-stopped app loses its alarms and gets no broadcast).
- **A repeating alarm schedules its next occurrence the moment it fires**, so
  tomorrow exists even if today is never dismissed. One-time alarms switch
  themselves off when the ring ends.
- **A foreground service runs only while an alarm is actually ringing**, typed
  `mediaPlayback`, holding a wake lock so audio and vibration survive the screen
  going off.
- **DST and time zones** are handled by `java.time`: an alarm set for a time
  that does not exist on a spring-forward morning rolls forward to a real
  instant instead of being skipped.
- **The device's alarm stream volume is never modified.** Per-alarm volume and
  the gradual ramp are applied inside the player, so nothing needs restoring if
  the process is killed mid-ring.

The maths behind all of this lives in
[`AlarmSchedule.kt`](app/src/main/java/com/alarmhandler/app/alarm/AlarmSchedule.kt),
deliberately free of Android types, and is covered by
[`AlarmScheduleTest.kt`](app/src/test/java/com/alarmhandler/app/alarm/AlarmScheduleTest.kt).

---

## The artwork

Both supplied images are in the repository at their original resolution
(`tools/source/`) and are used as the app's official assets.

The mascot was decoded back to its **native 12×8 pixel grid**, which is what
lets every derived asset be produced by pure nearest-neighbour scaling — app
icon, adaptive icon, themed monochrome icon, splash icon and notification icon
are all generated from that grid at exact integer multiples, so nothing is ever
blurred or stretched.

On screen the mascot is *drawn* from the same grid on a Compose canvas rather
than scaled from a bitmap. Every cell lands on a whole number of device pixels
at any size, so it stays crisp on every screen, and its reactions — sleeping,
jumping, annoyed, celebrating, waving, sitting — only move or hide cells that
already exist. The character is never redrawn.

The wide city image had its JPEG artefacts snapped back to a flat palette, and
a tall variant with extended sky is used behind the ringing screen. Both are
rendered with `FilterQuality.None`.

Everything is regenerated by:

```bash
python3 tools/gen_assets.py     # needs Pillow
```

which also synthesises the five built-in alarm tones, so the app ships no
third-party audio.

---

## Project layout

```
app/src/main/java/com/alarmhandler/app/
  alarm/      AlarmScheduler, AlarmReceiver, BootReceiver, AlarmService,
              AlarmPlayer, NotificationHelper, AlarmSchedule (pure logic)
  data/
    db/       Room database, DAOs, converters
    model/    Alarm, DismissChallenge, AlarmSound
    prefs/    DataStore-backed settings
    repo/     AlarmRepository (the only place alarms are written), History
    backup/   JSON export and import
  ui/
    theme/    Palette, typography, pixel style switches
    components/ Mascot renderer, blocky buttons/cards, permission cards
    home/ edit/ sound/ challenge/ settings/ history/ about/ ring/
  util/       Time formatting, permission checks, shake detection
tools/        Asset generation script and the two source images
```

---

## Testing notes

Automated: 15 unit tests cover one-time and repeating schedules, snooze
precedence, weekday skipping, the exactly-now boundary, DST gaps, sorting, and
input clamping (`./gradlew testDebugUnitTest`).

Manual, on a device — worth walking through once after installing:

1. **One-time alarm** — set for two minutes ahead, lock the phone, wait.
2. **Repeating alarm** — set for weekdays; check the home card shows the right
   next day.
3. **Snooze** — snooze once and confirm it returns after the chosen minutes;
   snooze twice and the mascot turns annoyed.
4. **Challenges** — try each of the six, and let the safety timer expire to
   confirm the plain Dismiss button appears.
5. **Locked screen** — the alarm should wake the display and appear over the
   lock screen (needs the full-screen permission).
6. **App closed** — swipe the app away from Recents, then let an alarm fire.
7. **Reboot** — restart the phone and check the alarm list still shows the
   right countdown.
8. **Permission denial** — deny notifications and exact alarms; the app should
   keep working and explain what is degraded.
9. **Dark mode** and **font size** — switch both in Android settings.
10. **Rotation** — the app supports landscape and adapts its spacing.
