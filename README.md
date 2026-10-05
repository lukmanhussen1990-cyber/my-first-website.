# Imran's page

A bio / profile page in the style of guns.lol / crax.lol, plus an Android app that shows it full-screen.

```
website/                ← the website (everything in ONE file: index.html)
  index.html            ← open this; all settings are in CONFIG at the top
  avatar.jpg            ← profile picture
  avatar.mp4            ← profile video (takes turns with the picture)
  background.mp4        ← background video
  *.mp3                 ← songs for the music player
android/                ← Android Studio project (Kotlin, full-screen WebView)
  icon/icon-source.png  ← the app icon picture
  tools/make_icons.sh   ← turns a picture into every icon size the app needs
.github/workflows/      ← GitHub builds the APK for you
```

## Change your page

Open `website/index.html` and edit the `CONFIG` block at the very top:

| setting | what it does |
| --- | --- |
| `name` | your name on the card, the page title and the **app name** |
| `avatarImage`, `avatarVideo`, `background` | your picture / videos (files in the `website` folder) |
| `songs` | the playlist: `title`, `artist`, `file`, `cover` (`""` = use the profile picture) |
| `nameFont`, `textFont` | any font name from [fonts.google.com](https://fonts.google.com) |
| `status`, `bio`, `enterText` | the texts |
| `links` | your Discord / GitHub / Telegram / Roblox / YouTube / TikTok links (`""` hides the icon) |
| `startViews` | where the views counter starts |
| `avatarVideoFirst`, `avatarImageSeconds` | profile picture ↔ video timing |
| `volume`, `brightness` | starting positions of the two sliders |
| `lite` | `"auto"` (default): phones get light effects so nothing lags, computers get the full effects. `true` / `false` forces one or the other |
| `adaptive` | `true` (default): if a device still can't keep up, the page switches off more effects by itself |

To swap a photo, video or song, put the new file in `website/` with the same name
(or put its new name in `CONFIG`).

To look at the website, open `website/index.html` in a browser.
To put it online, upload the `website` folder to any static host (GitHub Pages, Netlify, Cloudflare Pages…).

## Why it is smooth on phones

A live blur behind the boxes, glowing filters on the moving lines and animated shadows are very heavy for a phone
that is also playing a video, so on phones the page uses a plain dark glass (no blur), draws the small moving lines
with `transform` only (no redrawing) and starts the intro only after the background video is running.
On a computer you still get the blur and the 3D tilt. (`lite` in the CONFIG switches this.)

## Change the app icon

Put your picture in `android/icon/` (square, at least 512 px) and run, on a computer with ImageMagick:

```
bash android/tools/make_icons.sh android/icon/icon-source.png
```

It writes the round / square / themed icon files and the colour behind them (the splash colour too). Or just send me the picture.

## Build the APK

### Option A: Android Studio

1. Install [Android Studio](https://developer.android.com/studio).
2. **File → Open…** and pick the **`android`** folder. Keep it next to the `website` folder,
   because the app copies `website/` into its assets when it builds.
3. Wait until the Gradle sync at the bottom finishes. The first time takes a few minutes.
4. **Build → Build App Bundle(s) / APK(s) → Build APK(s)**
   (newer versions: **Build → Generate App Bundles or APKs → Generate APKs**).
5. Click **locate** in the popup. The file is `android/app/build/outputs/apk/debug/app-debug.apk`.
6. Copy it to your phone and open it. Allow "Install unknown apps" if Android asks.
   Play Protect may say the app is unknown, because it's not from the Play Store: tap **Install anyway**.

### Option B: let GitHub build it (no PC needed)

Every time you change something in `website/` or `android/` on GitHub, the **Build APK** workflow runs:

* **Actions** tab → latest **Build APK** run → **Artifacts** → `apk` (a zip with the APK inside)
* on the `main` branch it is also published under **Releases**, where you can tap the `.apk` directly

Every build is signed with the same key (`android/app/debug.keystore`), so a new APK installs over the old one.

## What the app does

* shows `website/index.html` from the app's assets in a full-screen WebView (JavaScript + localStorage on,
  music allowed to start without an extra tap)
* portrait only, status bar hidden, the back button closes the app, the screen stays on while the app is open
* music and videos pause when you leave the app and continue when you come back
* social links open in their own apps (Discord, YouTube, TikTok…) or the browser
* the fonts and icons are bundled in the app, so it also looks right offline.
  If you change `nameFont`/`textFont`, run `python3 android/tools/update_offline_fonts.py`
  to bundle the new fonts too (otherwise they just need internet).
