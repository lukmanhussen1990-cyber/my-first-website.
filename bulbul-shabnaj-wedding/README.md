# Bulbul & Shabnaj — wedding film

`bulbul_shabnaj_wedding.mp4` (1920×1080, 30 fps, 43.3 s) is a wedding motion-graphics film, made entirely from
scratch. There is no stock footage, no photographs and no samples: every picture is drawn in code, and every
sound is synthesised. It is built to play on a loop: it opens from the dark and closes back into it.

## The story

The bulbul (the nightingale) singing to the rose is the classic love story of the region's poetry. Here it writes
the couple's names.

| Time | Frames | What happens |
|---|---|---|
| 0–3.3 s | 1–100 | A starry night sky fades in, a crescent moon rises, a shooting star crosses. |
| 3.3–6.6 s | 100–200 | A gold Mughal arch draws itself: pillars, a cusped arch, its rectangular frame, beads, a finial and arabesques. |
| 6.6–13.3 s | 200–400 | The camera passes through the arch into a moonlit garden. A rose stem grows, a bud forms and blooms petal by petal, and dew gathers on the petals. A red-whiskered bulbul flies in and lands beside it. |
| 13.3–16.6 s | 400–500 | The bulbul sings to the rose; gold sparks of song rise from its beak. |
| 16.6–23.3 s | 500–700 | Its song rises as a ribbon of light, becomes a pen, and writes **Bulbul & Shabnaj** in gold script. Then *are getting married* appears. |
| 23.3–33.3 s | 700–1000 | Sky lanterns rise and rose petals drift down. A second bulbul arrives; the two face each other and sing, and their song gathers into a heart of light. |
| 33.3–40 s | 1000–1200 | A B & S monogram forms under the arch; light runs along the gold. |
| 40–43.3 s | 1200–1300 | The two bulbuls fly away together toward the moon, and the night closes. |

## Sound

The score is original, in D major at 72 bpm. One bar is exactly 100 frames, so the music and the picture share
the same grid. Each instrument is modelled on the physics of the real one:

- a harp sweep as the arch draws (the harmonics of a plucked string)
- santoor-like hammered strings (two slightly detuned Karplus-Strong strings per note) and a bass line
- a soft felt piano for the melody while the names are written
- a string section for the finale, played through modelled wooden violin bodies
- a string pad, a frame drum and manjira

A synthesised bulbul song is timed to the bird's beak, including the duet. Its trills vary note by note, like a
real bird's. There are wing flutters, fairy-dust glints, shimmers of light, the dew and the pen writing. Everything
is mixed with a synthetic hall reverb and mastered to −14 LUFS, −1 dBTP.

Each bar of the mix was checked with an audio classifier trained on AudioSet. Anything it heard as a synthesizer, a
ringtone, a doorbell or video-game music was reworked until the score read as real instruments and birdsong.

## How it is made

- `scenes/film/index.html` draws any frame `f` as a pure function of the frame number, using HTML, SVG and
  Canvas. `render.py` renders it with headless Chromium.
- `shared/arch.js`: the Mughal arch, its frame and arabesques, inked on with stroke animation.
- `shared/rose.js`: a 3-D rose. Each petal is a curved surface placed by ring and angle, lit by the moon and a warm
  fill, and drawn back to front with soft shadows. The rose opens from a bud, and the dew rides on the petals.
- `shared/bird.js`: the bulbul (crest, white cheek, red whisker, red vent), with perched, singing and flying poses.
- `shared/garden.js`: the rose bush (stem, thorns, trifoliate leaves, sepals) and the branch the birds use.
- `shared/names.js`: the names written by a light pen, the ampersand, the divider and the monogram.
- `shared/fx.js`: the sky lanterns, falling petals and fireflies.
- `tools/sky_plate.py`: the procedural night sky (gradient, a milky band, nebula and star dust).
- `tools/music.py`: the score, the bird song and the sound design, mixed and mastered.
- `tools/finish.py`: bloom on the lights, vignette and film grain, then the H.264/AAC encode.

Fonts (both SIL Open Font License, licences in `shared/fonts/`): Great Vibes for the names and Cormorant Garamond
Italic for the ampersand and *are getting married*.

## Rebuild

It needs Python 3 with numpy, scipy, opencv-python, soundfile and playwright, plus Chromium and ffmpeg. The Chromium
path is set at the top of `render.py`.

```
python3 tools/sky_plate.py                          # plates/sky.png
python3 render.py film 1 1300 --workers 8           # out/film/f0001.png .. f1300.png
python3 tools/music.py audio/score.wav              # the score, mastered
python3 tools/finish.py out/film audio/score.wav bulbul_shabnaj_wedding.mp4 --crf 17
```
