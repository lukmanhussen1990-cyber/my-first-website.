# Imran's page

A bio / profile app in a dark-glass style (inspired by guns.lol / crax.lol), plus an Android app that shows it full-screen.
**The whole page is ONE file: `website/index.html`** (HTML + CSS + JavaScript, no frameworks, icons are inline SVG).
Your pictures, videos and songs stay in the `assets` folder next to it, they are not embedded.

```
website/                ← the website
  index.html            ← open this; all settings are in CONFIG at the top
  assets/
    avatar.jpg          ← profile picture (the "old photo")
    avatar.mp4          ← profile clip (takes turns with the picture)
    background.mp4      ← background video
    *.mp3               ← songs for the music player
    frame.png           ← the wings + crown frame around the picture on Home (transparent)
    theme-glass.jpg, theme-noir.jpg   ← preview pictures on the Themes screen
    intro/              ← the three picture layers of the opening intro (logo)
android/                ← Android Studio project (Kotlin, full-screen WebView)
  icon/icon-source.png  ← the app icon picture
  tools/make_icons.sh   ← turns a picture into every icon size the app needs
  tools/make_intro_layers.sh ← cuts the icon artwork into the intro's picture layers
  tools/update_offline_fonts.py ← bundles the Google Fonts into the app (offline use)
  tools/make_frame.py   ← turns the frame artwork into assets/frame.png (background removed)
  tools/find_beats.py   ← finds a song's tempo + first beat (for the glow that pulses on the beat)
.github/workflows/      ← GitHub builds the APK for you
```

## The screens

| screen | what is there |
| --- | --- |
| **Home** | the song pill on top, your picture inside an animated wings + crown frame, **Imran** (handwritten) + crown, status (tap it: Online / Idle / Do Not Disturb), "Hello, World!" typing, your social icons, the views counter (tap it for numbers), and the music card (progress, shuffle, previous, play/pause, next, like) |
| **Profile** | tap your name on Home (or the card in Settings). Bigger picture + pencil (edit your bio), @imran, Online badge, typed bio, Followers / Following / Posts, and About Me / Interests / Badges / Activity pop-ups. The ⋮ menu: edit, copy @imran, share |
| **Music player** | tap the song pill, the music card or the **Music** tab. Big spinning cover, progress, shuffle, previous, play/pause, next, repeat, a moving waveform and a volume slider. **Swipe left / right** to change the song, the ⌄ arrow closes it |
| **Social** | one big row per link (Discord, GitHub, Telegram, Roblox, YouTube, TikTok) and the "Better Things Ahead." card |
| **Stats** | Total Views, Followers, Following, Posts and the Weekly Activity chart (touch it to read a day) |
| **Themes** | Dark Academia, Cyberpunk, Midnight, Red Noir, Glass. Tap one and the whole app changes colour; it is remembered |
| **Settings** | volume, background brightness, "Soft blur", "Floating particles", Account, Appearance (opens Themes), Notifications, Privacy & Security, Language, Help & Support, About, Log Out (just a message) |
| **Secret terminal** | tap your picture **7 times fast** |

Extras: a **floating mini player** (cover, song, previous, pause, next) appears on every screen except Home while music is on;
every button squeezes and ripples when you touch it and important actions show a small "✓" message;
the background video slowly zooms and a few soft particles float over it.

On a computer the app sits in a **phone-shaped frame** (rounded corners, thin bright edge, status bar with the clock);
on a phone it fills the whole screen.

## Change your page

Open `website/index.html` and edit the `CONFIG` block at the very top:

| setting | what it does |
| --- | --- |
| `name`, `handle` | your name (typed on Home, page title, **app name**) and `@handle` |
| `avatarImage`, `avatarVideo`, `background` | your picture / clip / background video (files in `website/assets`) |
| `frame` | the wings + crown frame on Home (`"assets/frame.png"`); `""` = no frame, a plain glowing ring instead |
| `songs` | the playlist: `title`, `artist` (`""` = "Unknown Artist"), `file`, `cover` (`""` = use the profile picture), `bpm` + `beat` (the song's tempo and first beat, so the frame glows on the beat; leave them out and it pulses at a steady pace) |
| `nameFont`, `textFont`, `quoteFont` | any font name from [fonts.google.com](https://fonts.google.com) |
| `status`, `bio`, `profileBio`, `quotes`, `enterText` | the texts |
| `stats`, `weekly` | Followers / Following / Posts and the 7 numbers of the Weekly Activity chart (Mon … Sun) |
| `about`, `joined`, `interests` | the Profile pop-ups |
| `links`, `linkNotes` | your links (`""` hides one) and the small text under each name on the Social screen. **The links are still placeholders, put your own** |
| `startViews` | where the views counter starts |
| `avatarVideoFirst`, `avatarImageSeconds` | picture ↔ clip timing |
| `volume`, `brightness`, `theme` | starting values (the visitor's own choice is remembered) |
| `intro`, `introSound`, `introImages` | the cinematic opening, its sounds and its picture layers |
| `lite` | `"auto"` (default): phones get light effects so nothing lags. `true` / `false` forces one or the other |
| `adaptive` | `true` (default): if a device still can't keep up, the page switches off more effects by itself |

To swap a photo, clip or song, put the new file in `website/assets/` with the same name (or put its new name in `CONFIG`).

To look at the website, open `website/index.html` in a browser.
To put it online, upload the `website` folder (with `assets`) to any static host (GitHub Pages, Netlify, Cloudflare Pages…).

## The wings + crown frame (Home)

`assets/frame.png` is your frame artwork with its background removed. The page uses that ONE picture several times,
each copy cut out with `clip-path`: the **left wing**, the **right wing**, the **ring** (with the swirls under it) and the **crown**.
Your picture / clip sits exactly inside the ring's empty circle, the wings go behind your name, the text stays on top.

* the wings flap slowly (6°, 3 s), turning where they meet the ring, left and right like a mirror
* the red / gold glow around the ring pulses slowly (2.5 s); **while music plays it pulses on the beat of the song**
* the crown floats a few pixels and a shine sweeps across it every 4 s
* a thin line of light runs round the ring
* gold sparkles twinkle around the wings and small feathers drift down and fade (one small canvas)
* everything stops while the app is in the background, on very slow phones, and for people who turned animations off

To use a different frame picture: `python3 android/tools/make_frame.py your-art.png website/assets/frame.png /tmp/preview`
(the circle position inside the picture is measured for the current art; a new one needs its own numbers).
For a new song: `python3 android/tools/find_beats.py website/assets/new-song.mp3` and copy `bpm` and `beat` into its line in `CONFIG.songs`.

## The opening intro and the animations

* **Intro** (about 2.6 s): the blood moon and the figure fade in, a blade slashes across, **IMRAN** slams in with a flash and a shake,
  **BADASS** swipes in, embers drift up, then the "Click here to see me" screen types itself.
  **Tap anywhere during the intro to skip it and go straight in.** In a normal web browser the sounds only start after your first tap
  (browsers don't allow sound before that); in the app they play right away.
* **When the page appears** (after the tap): a white flash, a red slash across the screen and a short shake, with a boom.
* **When the song changes**: the cover flies in with a ring, the card bumps, the background blinks like a beat,
  the progress line glides back to the start and the song pill wipes in with the new title.
* To change the logo, replace the artwork in `android/icon/icon-source.png` and run `bash android/tools/make_intro_layers.sh`
  (needs ImageMagick), or just send me the picture.

## Why it is smooth on phones

A live blur behind the cards, glowing filters and animated shadows are very heavy for a phone that is also playing a video, so on phones
the page uses plain dark glass (no blur), animates only with `transform` / `opacity`, keeps the particles tiny, does not animate
anything that is hidden (for example the music player while it is closed) and starts after the background video is running.
In **Settings** you can turn "Soft blur" (prettier glass) and "Floating particles" on or off yourself.
If a device is still too slow, the page notices and turns more effects off by itself.
On a computer you get the full blur. (`lite` in the CONFIG switches this.)

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
* portrait only, status bar hidden, the screen stays on while the app is open
* the **back button works inside the app**: it closes a pop-up, then leaves a screen, then returns to Home,
  and only on Home does it close the app
* music and videos pause when you leave the app and continue when you come back
* social links open in their own apps (Discord, YouTube, TikTok…) or the browser
* the fonts are bundled in the app, so it also looks right offline.
  If you change `nameFont` / `textFont` / `quoteFont`, run `python3 android/tools/update_offline_fonts.py`
  to bundle the new fonts too (otherwise they just need internet).

## Credits

Icons: [Lucide](https://lucide.dev) (ISC) and [Simple Icons](https://simpleicons.org) (CC0), inlined in `index.html`.
Fonts: Inter, Pacifico and Courier Prime from Google Fonts (SIL Open Font License).
