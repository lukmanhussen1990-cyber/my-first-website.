# Signs before the Last Day: a 60 s Instagram Reel made 100% with code

Every picture is drawn with the HTML canvas and every sound is synthesised with numpy.
No AI image, video or voice tools, no stock images, no downloaded sounds.

| File | What it is |
| --- | --- |
| `output/signs-before-the-last-day.mp4` | The Reel: 1080x1920, 30 fps, 1800 frames = 60.0 s, H.264 High@4.1 (CRF 18, yuv420p, BT.709) + AAC 192 kbps 48 kHz, faststart |
| `output/cover.png` | Cover image (title scene, frame 0) |
| `output/caption.txt` | Instagram caption with 10 hashtags |
| `output/stills/` | Check stills at 2, 6, 15, 30, 42, 52 and 58 s |
| `output/audio.m4a` | The soundtrack on its own (used by the browser preview) |
| `reel.html` | The renderer: `render(t)` draws the exact frame for time `t`, plus the preview player |
| `render_frames.mjs` | Headless Chromium (Playwright): frames, stills, cover and the audio cue sheet |
| `make_audio.py`, `audio_dsp.py` | The soundtrack in Python + numpy (48 kHz, mastered to -14 LUFS / -1 dBTP) |
| `build.sh` | The whole pipeline in one command |
| `fonts/` | Patrick Hand, Cormorant Garamond, Amiri (all SIL Open Font License, licences included) |

## Watch it in the browser (preview mode)

Open `reel.html` in Chrome, Edge or Firefox. You get a Play button, a scrub bar, a frame counter,
"fast (half-res)" for smoother playback on slow machines, and a PNG button that saves the current
frame. Keys: Space = play/pause, Left/Right = one frame, Shift+Left/Right = one second.
After a build, the preview plays the real soundtrack (`output/audio.m4a`) in sync.

URL options: `reel.html?t=30` opens at 30 s, `reel.html?page=Other%20Name` changes the page name.

## Build the video yourself

Requirements: Node 18+, Python 3 with numpy, ffmpeg (with libx264), and Chromium for Playwright.

```bash
npm install                      # installs playwright 1.56.1
npx playwright install chromium  # only if you don't already have it
./build.sh                       # about 5-10 minutes on 4 cores
```

`PAGE="Other Name" ./build.sh` renders the same Reel with another page name (default: NOOR TOON).

What `build.sh` does:

1. **Cue sheet.** `reel.html` exports every sound moment: each typed letter, each tower rise,
   coin landing, decoration, light and so on. They come from the same code that animates
   the picture, so the sound is frame-accurate.
2. **Audio.** `make_audio.py` builds a 48 kHz WAV: the drone bed (55 Hz + 82 Hz sines with a slow
   "breathing" volume, plus quiet filtered air noise), a whoosh at each scene change, a soft tick for
   each typed letter, and one effect per scene. It is then mastered to -14 LUFS integrated with true
   peaks at -1.3 dBTP. Measured on the finished MP4 (AAC): -14.1 LUFS, true peak -1.0 dBTP.
3. **Frames.** Headless Chromium waits for `document.fonts.ready`, then for every frame `i` calls
   `render(i / 30)` and saves `build/frames/f_0000.png ... f_1799.png` (4 parallel workers).
4. **Encode.** `ffmpeg ... -c:v libx264 -preset slow -crf 18 -pix_fmt yuv420p -c:a aac -b:a 192k -movflags +faststart`.
5. **Cover + stills.** The cover is frame 0 of the title scene; the title is visible from the first frame.

Everything random uses a seeded generator, so every build produces the same frames.

## How it is put together

- Each scene draws a dark background in its own colour, a big soft glow behind the object, a floor,
  table or horizon line, floating dust and one object doing one movement. The camera pushes in
  slowly from 1.00 to 1.04.
- On top of that come a painterly paper texture, a soft vignette, light film grain, and a 0.4 s fade
  from and to black at every scene edge (except frame 0, which shows the title).
- Text: the page name is Cormorant Garamond Italic 30 px at 55% opacity, y = 90. The main line is
  Patrick Hand 64 px in #F3E6C4 with a typewriter reveal: one letter every 0.035 s, each fading in
  over 0.12 s, starting 0.7 s into the scene. The source is Cormorant Garamond 24 px capitals with
  4 px letter-spacing at 45% opacity. "ﷺ" is drawn with the Amiri font, the only one of the three
  that contains that glyph.
- Safe zones: all text sits between y = 70 and y = 1400, so it stays out of the bottom 380 px. Lines
  wrap at 800 px (less than the 900 px maximum) so that centred text also stays out of the right 140 px.

## Notes on a few choices

- **Scene 12, second line.** It fades in 1.5 s after the main line has finished typing; the source
  follows it. Typing a line that long would not finish before the scene ends.
- **55 s.** There is no whoosh at 55 s. The swell cuts to true silence at that moment (reverb tails
  included), and then only soft air plays while the ending text types.
- **Levels.** The bed sits at -27 dBFS RMS and the letter ticks at about -36 dBFS peak in the mix. The
  final master is then raised as a whole to -14 LUFS, so those relative levels are kept.

## Sources shown in the video

Sahih al-Bukhari 50, 59, 1036, 4635, 7119 · Sahih Muslim 157, 2703, 2901 · Sunan Abi Dawud 449
