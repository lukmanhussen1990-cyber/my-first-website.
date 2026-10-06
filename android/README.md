# ArrowGO! Android app

A thin Android shell around the ArrowGO! web game: one `Activity` with a full-window `WebView`.
It is built without Gradle or AndroidX, using only the Android SDK command-line tools.
`build-apk.sh` turns the web files in the repository root into a signed, installable
`dist/ArrowGO.apk`.

```
android/
  AndroidManifest.xml                 package com.imrano.arrowgo, versionCode/versionName, minSdk 24, targetSdk 34
  build-apk.sh                        the whole build (no Gradle)
  arrowgo-release.keystore            development / sideload signing key (see "Signing")
  res/values*/                        strings, colours, theme (cream window, system bars, Android 12+ splash)
  res/mipmap-*/, res/drawable/        launcher icons (adaptive on Android 8+)
  src/com/imrano/arrowgo/MainActivity.java
  build/                              intermediate output (gitignored, recreated on every build)
```

## Building

Requirements:

- Android SDK with `build-tools;34.0.0` and `platforms;android-34`. The script looks in
  `$ANDROID_HOME`, then `$ANDROID_SDK_ROOT`, then `/opt/android-sdk`.
- JDK 11 or newer. The script uses `$JAVA_HOME` if set, otherwise `javac`/`keytool` from `PATH`.
- `zip`, or `python3` as a fallback.

```sh
android/build-apk.sh                     # run it from any directory
android/build-apk.sh --allow-placeholder # pipeline test when the game files are not written yet
```

Steps:

1. Copy `index.html`, `styles.css`, `app.js`, `levels.js`, `sw.js`, `manifest.json`, `icons/` and
   `fonts/` into `build/assets/www/`. No other files go into the APK. The build stops if
   `index.html`, `app.js` or `levels.js` is missing. With `--allow-placeholder` it builds anyway
   with a generated bridge test page instead. That test page is written only to `build/`.
2. `aapt2 compile` the resources, then `aapt2 link` them with the manifest and the staged assets
   into `build/unsigned.apk`. This step also generates `R.java`.
3. Compile `MainActivity.java` and `R.java` with `javac --release 11 -parameters` against
   `android.jar`. `-parameters` works around a d8 8.2 crash on the parameter metadata that JDK 21
   writes for anonymous classes.
4. `d8 --release --min-api 24` → `classes.dex`, added to the APK.
5. `zipalign -p -f 4`, then sign with `apksigner sign` (v1 + v2 + v3).
6. Check the result with `apksigner verify` and `zipalign -c`, then copy it to `dist/ArrowGO.apk`.
   The script prints the APK's size and SHA-256.

The version comes from `AndroidManifest.xml` (`android:versionCode` / `android:versionName`).
To release a new version, bump both there. `AndroidBridge.getAppVersion()` reads `versionName`
at runtime.

Install on a device with `adb install -r dist/ArrowGO.apk`. You can also copy the APK to the phone
and open it there, after allowing installs from unknown sources.

Useful checks:

```sh
BT=/opt/android-sdk/build-tools/34.0.0
$BT/aapt2 dump badging dist/ArrowGO.apk
$BT/apksigner verify --verbose --print-certs dist/ArrowGO.apk
$BT/zipalign -c -v 4 dist/ArrowGO.apk
adb logcat -s ArrowGO       # page console messages and shell warnings
```

## Signing

`android/arrowgo-release.keystore` is committed on purpose. It is a **development / sideload
key**: everyone who builds from this repository produces APKs signed with the same certificate,
so an installed copy can be updated with `adb install -r` or by opening a newer APK. Its password
is public, so treat it as non-secret.

- Store type: PKCS12
- Alias: `arrowgo`
- Password: `arrowgo-imrano`
- Key: RSA 2048, valid for 10000 days, `CN=ImranO, O=ImranO Games, C=US`

If that file is missing, `build-apk.sh` generates a new key with `keytool`. A new key has a
different certificate, so devices with the old build must uninstall it before installing the
new one.

**For Google Play (or any store), use your own private upload key** and keep it out of the
repository:

```sh
keytool -genkeypair -keystore ~/keys/arrowgo-upload.jks -alias upload \
        -keyalg RSA -keysize 2048 -validity 10000 -dname "CN=ImranO, O=ImranO Games, C=US"

ARROWGO_KEYSTORE=~/keys/arrowgo-upload.jks ARROWGO_KS_ALIAS=upload \
ARROWGO_KS_PASS='...' ARROWGO_KEY_PASS='...' android/build-apk.sh
```

| variable           | default                            | meaning                                  |
|--------------------|------------------------------------|------------------------------------------|
| `ARROWGO_KEYSTORE` | `android/arrowgo-release.keystore` | keystore file; a custom one must exist   |
| `ARROWGO_KS_ALIAS` | `arrowgo`                          | key alias                                |
| `ARROWGO_KS_PASS`  | `arrowgo-imrano`                   | keystore password                        |
| `ARROWGO_KEY_PASS` | same as `ARROWGO_KS_PASS`          | key password                             |

Passwords reach `keytool` and `apksigner` through environment variables (`env:`), never through
command-line arguments. Play now expects an App Bundle (`.aab`). This APK is suited to
sideloading and to stores that accept APKs. Moving to Play would mean adding an AAB build
(`bundletool`), which is not covered here.

## How the shell works

**Serving the game.** The web files live in `assets/www/`. `MainActivity` loads
`https://appassets.androidplatform.net/index.html`. Its `shouldInterceptRequest` answers every
request for that host from `assets/www/<path>`; `/` (and any path ending in `/`) serves
`index.html`. Each response carries:

- the correct MIME type: `text/javascript` for `.js`/`.mjs`, `application/manifest+json` for
  `.webmanifest`, `font/woff2`, `image/svg+xml`, and so on, with UTF-8 for text types;
- `Cache-Control: no-cache` and `Access-Control-Allow-Origin: *`.

A missing file gets a real 404, and `..` path segments are rejected. Because the page runs on a
normal secure `https://` origin, `localStorage` (`arrowgo.v1`) persists and fetch/CORS behave as on
the web. The game makes no network requests. The `INTERNET` permission is there only because
WebView will not start `https://` loads without it. Cleartext traffic is disabled, and so are
file and content access.

**Links.** The `appassets` host stays inside the app. Any other `http(s)` link (and `mailto:`,
`tel:`, `market:`…) opens in the external app via `ACTION_VIEW`. Other schemes are blocked.

**`window.AndroidBridge`** (see `docs/ARCHITECTURE.md`):

| call                                    | what it does                                                              |
|-----------------------------------------|---------------------------------------------------------------------------|
| `AndroidBridge.vibrate(ms)`             | haptic pulse, clamped to 1..1000 ms. Uses `VibratorManager` on API 31+ and `VibrationEffect` on 26+. Never throws. `vibrate()` with no argument gives a 20 ms tick. |
| `AndroidBridge.setSystemBars(hex, darkIcons)` | colours the status and navigation bars. Accepts `#rgb`, `#rrggbb`, `#rrggbbaa` or `rgb()`. `darkIcons=true` gives dark icons, for light colours. Invalid colours are ignored. On API 24-25 a light colour keeps a black navigation bar, because those versions cannot draw dark navigation icons. With one argument, the icon style is picked from the colour's brightness. |
| `AndroidBridge.exitApp()`               | closes the activity.                                                      |
| `AndroidBridge.getAppVersion()`         | `versionName` from the manifest, e.g. `"1.0.0"`.                          |

Inside the APK, `window.AndroidBridge` exists from the first script on, so the page can detect it.
The User-Agent also ends in `ArrowGOApp/<version>`.

**Back button.** The activity evaluates `window.ArrowGO.handleBack()`.

- `true` means the page handled it, for example by closing a sheet or going back a screen.
- Anything else closes the app, including when `handleBack` is missing or throws.

While it waits for the answer, further back presses are ignored. If the page has not answered
after 1.5 s, the next back press closes the app, so a stuck page can never trap the user.

**Lifecycle.**

- `onPause`: calls `window.ArrowGO.onPause()` if present, then `webView.onPause()`. WebView then
  also fires `visibilitychange`, so the page may see both; its handlers should be idempotent.
- `onResume`: calls `webView.onResume()`, then `window.ArrowGO.onResume()`.
- `onDestroy`: destroys the WebView.
- WebView state is saved and restored with the activity.
- `configChanges` covers rotation, screen size, density, UI mode, fonts, locale and similar
  changes, so the WebView is never recreated.
- If the WebView renderer crashes or is killed (API 26+), the page is reloaded instead of the app
  crashing.

**Look and feel.**

- The window background, status bar, navigation bar (API 27+) and Android 12+ splash screen are
  all brand cream `#F5EBD8`, with dark icons. There is no white flash at start-up. The splash
  shows the adaptive launcher icon.
- The page recolours the bars per theme through `setSystemBars`.
- The status bar stays visible, so the display cutout always sits inside it.
- The app is locked to portrait. Long-press selection, context menus, long-press haptics,
  overscroll glow, zoom and font scaling are turned off; text zoom is fixed at 100%.
- WebView force-dark and algorithmic darkening are disabled, because the game has its own themes.
- Page `console.*` output goes to logcat under the tag `ArrowGO`.

**API levels.** `minSdk` is 24. Every call to a newer API is behind a `Build.VERSION.SDK_INT`
check and lives in a nested `ApiNN` helper class. Android lint (`NewApi`) passes, including when
those helpers are declared `@RequiresApi`.
