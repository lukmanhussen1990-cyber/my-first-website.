# Al-Ameen Academy — Animated Opening Titles

A cinematic opening title sequence built around the Al-Ameen Academy crest
(Badarpur, Estd. 1994). Rendered to a 1080p60 MP4 with an original score.

## Download

**[⬇ al-ameen-academy-intro.mp4](video/al-ameen-academy-intro.mp4)** — 1920×1080, 60 fps, 10.6 s, H.264 + AAC, ~3 MB

| | |
|---|---|
| Resolution | 1920 × 1080 |
| Frame rate | 60 fps |
| Duration | 10.6 s |
| Video | H.264 High, CRF 18, yuv420p, faststart |
| Audio | AAC stereo, 192 kbps, 48 kHz |

## What's here

| Path | Description |
|---|---|
| `index.html` | Landing page — plays the video and offers the download |
| `intro.html` | The animation itself, rendered live in a canvas (no video file needed) |
| `video/al-ameen-academy-intro.mp4` | The exported film |
| `assets/logo-mark.png` | The crest, cut out of the source photo with a transparent background |
| `assets/logo.png` | 800 px version used by the animation |
| `assets/poster.jpg` | Video poster frame |
| `assets/fonts/` | Cinzel, Montserrat and Cormorant Garamond (subset woff2, SIL Open Font License) |
| `tools/audio.py` | Synthesises the score (`tools/score.wav`) |
| `tools/render.py` | Renders `intro.html` frame by frame and encodes the MP4 |

## Sequence

| Time | Beat |
|---|---|
| 0.0 s | Fade up from black — deep green field, drifting embers, light shafts |
| 0.35 s | A gold ring draws itself around the centre |
| 0.55 s | The crest rises out of a defocus, settling with a slight rotation |
| 1.95 s | It lands: bloom, shockwave rings and an anamorphic streak |
| 2.15 s | A specular sweep crosses the crest |
| 2.45 s | **AL-AMEEN ACADEMY** builds letter by letter in gold |
| 3.75 s | The rule and diamond open outward |
| 4.05 s | **BADARPUR · ESTD. 1994** |
| 4.75 s | Tagline settles in |
| 6.3 s | A shimmer travels through the wordmark |
| 8.9 s | The frame resolves and fades to black |

## Changing the wording

The three lines of copy are at the top of `intro.html`:

```js
const TITLE    = 'AL-AMEEN ACADEMY';
const SUBLEFT  = 'BADARPUR';
const SUBRIGHT = 'ESTD. 1994';
const TAGLINE  = 'Excellence in Education since 1994';
```

The tagline is placeholder wording — swap it for the school's own motto.

## Re-rendering

```bash
pip install playwright imageio-ffmpeg numpy
python tools/audio.py     # writes tools/score.wav
python tools/render.py    # writes video/al-ameen-academy-intro.mp4
```

`tools/render.py` drives headless Chromium, steps `window.render(t)` one frame
at a time at 60 fps and pipes the frames straight into ffmpeg, so the output is
deterministic — no real-time screen recording involved.
