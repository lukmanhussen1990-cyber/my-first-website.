# 9 Beautiful Names of Allah: a 60 s Instagram Reel made 100% with code

Every picture is drawn with the HTML canvas and every sound is synthesised with numpy.
No AI image, video or voice tools, no stock images, no downloaded sounds.

| File | What it is |
| --- | --- |
| `output/9-beautiful-names-of-allah.mp4` | The Reel: 1080x1920, 30 fps, 1800 frames = 60.0 s, H.264 High@4.1 (CRF 18, yuv420p, BT.709) + AAC 192 kbps 48 kHz, faststart |
| `output/cover.png` | Cover image (title scene, frame 0) |
| `output/caption.txt` | Instagram caption with 10 hashtags |
| `output/stills/` | Check stills at 2, 7, 18, 29, 40, 51 and 58 s |
| `output/audio.m4a` | The soundtrack on its own (used by the browser preview) |
| `reel.html` | The renderer: `render(t)` draws the exact frame for time `t`, plus the preview player |
| `render_frames.mjs` | Headless Chromium (Playwright): frames, stills, cover and the audio cue sheet |
| `make_audio.py`, `audio_dsp.py` | The soundtrack in Python + numpy (48 kHz, mastered to -14 LUFS / -1 dBTP) |
| `build.sh` | The whole pipeline in one command |
| `fonts/` | Patrick Hand, Cormorant Garamond, Amiri (all SIL Open Font License, licences included) |

## Watch it in the browser (preview mode)

Open `reel.html` in Chrome, Edge or Firefox. You get a Play button, a scrub bar, a frame counter,
"fast (half-res)" for smoother playback, and a PNG button that saves the current frame.
Keys: Space = play/pause, Left/Right = one frame, Shift+Left/Right = one second.
After a build, the preview plays the real soundtrack (`output/audio.m4a`) in sync.

URL options: `reel.html?t=30` opens at 30 s, `reel.html?page=Other%20Name` changes the page name.

## Build the video yourself

Requirements: Node 18+, Python 3 with numpy, ffmpeg (with libx264), and Chromium for Playwright.

```bash
npm install                      # installs playwright 1.56.1
npx playwright install chromium  # only if you don't already have it
./build.sh                       # about 5-10 minutes on 4 cores
```

`PAGE="Other Name" ./build.sh` renders the same Reel with another page name (default: NoorToon).
`SKIP_FRAMES=1 ./build.sh` reuses already rendered frames (e.g. after changing only the sound).

What `build.sh` does:

1. **Cue sheet.** `reel.html` exports every sound moment: each typed letter, each date landing,
   each ring of light, the pearl, the sprout, the glass cover and so on. They come from the same
   code that animates the picture, so the sound is frame-accurate.
2. **Audio.** `make_audio.py` builds a 48 kHz WAV: the drone bed (55 Hz + 82 Hz sines with a slow
   "breathing" volume, plus quiet filtered air noise), a whoosh at each scene change, a soft tick for
   each typed letter, and one effect per scene. It is mastered to -14 LUFS integrated with true
   peaks at -1.3 dBTP.
3. **Frames.** Headless Chromium waits for `document.fonts.ready`, then for every frame `i` calls
   `render(i / 30)` and saves `build/frames/f_0000.png ... f_1799.png` (4 parallel workers).
4. **Encode.** `ffmpeg ... -c:v libx264 -preset slow -crf 18 -pix_fmt yuv420p -c:a aac -b:a 192k -movflags +faststart`.
5. **Cover + stills.** The cover is frame 0 of the title scene; the title is visible from the first frame.

Everything random uses a seeded generator, so every build produces the same frames.

## Text layers (per Name scene)

| Layer | Style | When |
| --- | --- | --- |
| Page name | Cormorant Garamond Italic 30 px, cream, 55% opacity, y = 90 | always |
| Arabic Name | Amiri 120 px, gold #E8C27A with a gentle glow, centred around y = 1040-1050 | fades in and glows at 0.5 s |
| Name + meaning | Patrick Hand 56 px, cream #F3E6C4, y = 1185 | typewriter from 1.2 s (0.035 s per letter, 0.12 s fade) |
| Quran line | Patrick Hand 40 px, cream at 80%, from y = 1262, wraps to 2 lines | fades in at 2.6 s |
| Source | Cormorant Garamond 24 px capitals, 4 px letter-spacing, 45% opacity | fades in at 3.4 s |

- **Arabic shaping.** The Arabic is drawn as one string, right-to-left, with the Amiri font, so the
  browser's text shaper joins the letters and places the harakat. It is never drawn letter by letter
  and never with letter-spacing, either of which would break the joins.
- **Arabic position.** Each Name is placed so its lowest ink (for example the tail of ع) stays at
  least 12 px above the Name line. Some Names have tall marks and deep tails, so their centres sit
  at y = 1040-1050, and the Name and Quran lines sit slightly lower than 1170 / 1250.
- **Safe zones.** All text stays above y = 1400 (the bottom 380 px is free), and lines wrap at
  800 px or less, so centred text also stays out of the right 140 px.

## Sources shown in the video

Surah Hud 11:6 · Al-Baqarah 2:127, 2:186 · Ash-Shura 42:11 · Al-Mulk 67:14 · Az-Zumar 39:53 ·
An-Nur 24:35 · Yusuf 12:64 · Al-Buruj 85:14 · Al-A'raf 7:180
