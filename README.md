# Imran's page

A bio / profile app in a dark-glass style (inspired by guns.lol / crax.lol), plus an Android app that shows it full-screen.
**The whole page is ONE file: `website/index.html`** (HTML + CSS + JavaScript, no frameworks, icons are inline SVG).
Your pictures, videos and songs stay in the `assets` folder next to it, they are not embedded.

```
website/                ← the website
  index.html            ← open this; all settings are in CONFIG at the top
  assets/
    avatar.jpg          ← your main picture (Settings card, song covers)
    avatar.mp4, avatar-crown.mp4, avatar-*.jpg   ← the profile pictures and clips that show one by one on Home / Profile
    background.mp4      ← background video
    *.mp3               ← songs for the music player
    frame.png           ← the wings + crown frame around the picture on Home (transparent)
    frame2.png          ← the wings + crown frame on the Settings card; its crown is also in the popup messages (transparent)
    theme-glass.jpg, theme-noir.jpg   ← preview pictures on the Themes screen
    intro/              ← the three picture layers of the opening intro (logo)
android/                ← Android Studio project (Kotlin, full-screen WebView)
  icon/icon-source.png  ← the app icon picture
  tools/make_icons.sh   ← turns a picture into every icon size the app needs
  tools/make_intro_layers.sh ← cuts the icon artwork into the intro's picture layers
  tools/update_offline_fonts.py ← bundles the Google Fonts into the app (offline use)
  tools/make_frame.py   ← turns the frame artwork into assets/frame.png (background removed)
  tools/make_frame2.py  ← turns the second frame artwork into assets/frame2.png (checker pattern removed)
  tools/find_beats.py   ← finds a song's tempo + first beat (for the glow that pulses on the beat)
.github/workflows/      ← GitHub builds the APK for you
```

## The screens

| screen | what is there |
| --- | --- |
| **Home** | the song pill on top, your pictures and clips (one by one) inside an animated wings + crown frame, **Imran** (handwritten) + crown, status (tap it: Online / Idle / Do Not Disturb), "Hello, World!" typing, your social icons, the views counter (tap it for numbers), and the music card (progress, shuffle, previous, play/pause, next, like) |
| **Profile** | tap your name on Home (or the card in Settings). Bigger picture + pencil (edit your bio), @imran, Online badge, typed bio, Followers / Following / Posts, and About Me / Interests / Badges / Activity pop-ups. The ⋮ menu: edit, copy @imran, share |
| **Music player** ("Now Playing") | tap the song pill, the music card or the **Music** tab. Dark red smoke, a spinning round cover inside a progress ring (the white dot shows how far the song is) and a glowing red ring, a small glass side panel (volume, •••, equalizer), title + red ★, progress, shuffle / previous / play / next / repeat, a waveform you can tap to jump, and a volume slider. **Swipe the cover left / right** to change the song, the ⌄ arrow closes it (see below) |
| **Social** | one big row per link (Discord, GitHub, Telegram, Roblox, YouTube, TikTok) and the "Better Things Ahead." card |
| **Stats** | Total Views, Followers, Following, Posts and the Weekly Activity chart (touch it to read a day) |
| **Themes** | Dark Academia, Cyberpunk, Midnight, Red Noir, Glass. Tap one and the whole app changes colour; it is remembered |
| **Settings** | your card (picture inside the second wings + crown frame, name + crown, @handle, status dot; tap it for your profile), volume, background brightness, "Soft blur", "Floating particles", Account, Appearance (opens Themes), Notifications, Privacy & Security, Language, Help & Support, About, Log Out (just a message) |
| **Secret terminal** | tap your picture **7 times fast** |

Extras: a **floating mini player** (cover, song, previous, pause, next) appears on every screen except Home while music is on;
every button squeezes and ripples when you touch it and important actions show a **glowing popup** at the top (see below);
the background video slowly zooms and a few soft particles float over it.

On a computer the app sits in a **phone-shaped frame** (rounded corners, thin bright edge, status bar with the clock);
on a phone it fills the whole screen.

## Change your page

Open `website/index.html` and edit the `CONFIG` block at the very top:

| setting | what it does |
| --- | --- |
| `name`, `handle` | your name (typed on Home, page title, **app name**) and `@handle` |
| `avatarImage`, `background` | your main picture (Settings card, song covers) and the background video (files in `website/assets`) |
| `avatarMedia` | the profile pictures and clips on Home / Profile, in order: they show one by one, each fading in over the last |
| `frame` | the wings + crown frame on Home (`"assets/frame.png"`); `""` = no frame, a plain glowing ring instead |
| `frame2` | the wings + crown frame on the Settings card (`"assets/frame2.png"`), its crown is also in the popups; `""` = a plain ring |
| `songs` | the playlist: `title`, `artist` (`""` = "Unknown Artist"), `file`, `cover` (`""` = use the profile picture), `bpm` + `beat` (the song's tempo and first beat, so the frame glows on the beat; leave them out and it pulses at a steady pace) |
| `nameFont`, `textFont`, `quoteFont` | any font name from [fonts.google.com](https://fonts.google.com) |
| `status`, `bio`, `profileBio`, `quotes`, `enterText` | the texts |
| `stats`, `weekly` | Followers / Following / Posts and the 7 numbers of the Weekly Activity chart (Mon … Sun) |
| `about`, `joined`, `interests` | the Profile pop-ups |
| `links`, `linkNotes` | your links (`""` hides one) and the small text under each name on the Social screen. **The links are still placeholders, put your own** |
| `startViews` | where the views counter starts |
| `avatarImageSeconds` | how long each picture in `avatarMedia` stays (a clip always plays to its end) |
| `volume`, `brightness`, `theme` | starting values (the visitor's own choice is remembered) |
| `intro`, `introSound`, `introImages` | the cinematic opening, its sounds and its picture layers |
| `lite` | `"auto"` (default): phones get light effects so nothing lags. `true` / `false` forces one or the other |
| `adaptive` | `true` (default): if a device still can't keep up, the page switches off more effects by itself |

To swap a photo, clip or song, put the new file in `website/assets/` with the same name (or put its new name in `CONFIG`).
To add a picture or clip to your profile picture, put it in `website/assets/` and add its name to `avatarMedia`.

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
* gold sparkles twinkle around the wings and small feathers drift down and fade (one small canvas; off with "Floating particles")
* everything stops while the app is in the background, on very slow phones, and for people who turned animations off

To use a different frame picture: `python3 android/tools/make_frame.py your-art.png website/assets/frame.png /tmp/preview`
(the circle position inside the picture is measured for the current art; a new one needs its own numbers).
For a new song: `python3 android/tools/find_beats.py website/assets/new-song.mp3` and copy `bpm` and `beat` into its line in `CONFIG.songs`.

## The popup messages

Every message (status changed, theme changed, song liked, copied, …) is a glowing pill at the top, above everything:
black glass with a diagonal reflection, a thick glowing red border with a gold line and gold sparkles on it,
a round medallion on the left with a spinning red-gold ring and light orbiting round it, and the title in two colours.

* it slides down with a little bounce, the crown drops into its circle and then floats, a shine sweeps across once
* the title's letters fade in one by one, then the important word lights up
  (your status in its own colour: **Online** green, **Idle** yellow, **Do Not Disturb** red)
* it hides by itself after 3 s; the ✕ closes it early (it spins when you press it)
* the status popup shows the crown from `frame2.png`; the other messages show a matching gold icon

## The Settings card (second wings + crown frame)

`assets/frame2.png` is used like the Home frame: one picture, cut with `clip-path` into the left wing, the right wing,
the ring and the crown. Your picture sits exactly inside its empty circle. The wings flap (6°, 3 s), the crown floats with a shine
every 4 s, the ring's red-gold glow pulses, a thin line of light runs round the ring and gold sparkles twinkle around it.
Tap the card: it grows a little with a flash of light, then your profile opens.
The animations only run while Settings is on screen, stop in the background, and the sparkles go off with "Floating particles".

## The Now Playing player

* **Opens** sliding up with a fade (the side panel slides in from the left), **closes** sliding down.
* **The cover** turns slowly while the song plays and comes smoothly to a stop when you pause. The thin ring around it is the
  progress: the pink part and the white dot move round as the song plays. The thick red ring glows stronger on the loud parts.
* **The waveform** moves with the music; the played part is red, the rest grey, with a faded mirror underneath.
  Tap or drag on it to jump to that part of the song.
* **★** likes / unlikes the song (with a little burst of red sparkles). **Shuffle** and **repeat** turn red when they are on.
* **•••** opens a small menu: Like, Song info, Sleep timer (15 / 30 / 60 min; the music fades out and stops).
* **Equalizer** (the sliders icon): Bass, Mid and Treble. It needs the page to come from a web address (the app or a web server);
  opened as a plain file it says so, and the music plays as before.
* **Volume**: the side slider, the bottom slider and the one in Settings always show the same volume.
  In the app this is the phone's music volume, and the **volume buttons** show the app's own red volume panel
  (instead of the phone's pop-up, which used to cover the player).
* The music-reactive parts use the Web Audio API. If it can't read the music, they move on the song's beat instead,
  and if Web Audio ever goes quiet the song switches back to plain playback on its own: the music never goes silent.
* Everything stops moving when the player is closed or the app is in the background.

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
  music allowed to start without an extra tap). Since 1.6 it opens it as `https://appassets.androidplatform.net/assets/index.html`
  (with `WebViewAssetLoader`: a made-up secure address, nothing goes to the internet) instead of `file://`, so Web Audio can read
  the music; songs and videos are served in pieces (Range requests), so you can jump anywhere in a song.
  The first time after updating from 1.5 or older, `android/app/src/main/assets/move.html` brings your saved settings,
  likes and views along to the new address (once)
* the volume buttons change the phone's music volume without the phone's volume pop-up; the page shows its own red panel
* portrait only, status bar hidden, the screen stays on while the app is open
* the page always ends just above the 3-button navigation bar (or fills the screen with gesture navigation),
  and on short screens Home squeezes a little so the whole music card is always above the bottom bar
* the **back button works inside the app**: it closes the music player or a pop-up, then leaves a screen, then returns to Home,
  and only on Home does it close the app
* music and videos pause when you leave the app and continue when you come back
* social links open in their own apps (Discord, YouTube, TikTok…) or the browser
* the fonts are bundled in the app, so it also looks right offline.
  If you change `nameFont` / `textFont` / `quoteFont`, run `python3 android/tools/update_offline_fonts.py`
  to bundle the new fonts too (otherwise they just need internet).

## Credits

Icons: [Lucide](https://lucide.dev) (ISC) and [Simple Icons](https://simpleicons.org) (CC0), inlined in `index.html`.
Fonts: Inter, Pacifico and Courier Prime from Google Fonts (SIL Open Font License).
Songs, pictures and clips: your own files in `website/assets`.
