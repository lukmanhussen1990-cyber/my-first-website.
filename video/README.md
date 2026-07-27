# 2 + 2 = 4 — animated explainer

A 30-second, 16:9 educational animation explaining why two plus two equals four.
Everything in it — picture, narration, music and sound design — is generated
from source in this directory. There are no stock assets and no external media.

**Output:** `2plus2.mp4` — 3840×2160, 30 fps, 30.00 s, H.264 + AAC stereo.

## The cut

| Time | Picture | Narration |
|------|---------|-----------|
| 0.0–2.0 | Dark space; blue and gold particles, drifting mathematical symbols. A glowing 2 materialises. | — |
| 2.0–4.3 | Two polished golden spheres float in beside it. | "Imagine we have two objects." |
| 4.3–6.3 | A second 2 enters from the right with two more spheres. | "Now, we add two more." |
| 6.3–7.6 | The two groups glide together, still reading as 2 \| 2. | — |
| 7.8–10.7 | Each sphere is counted with a synchronised highlight, ring and chime. | "One… Two… Three… Four." |
| 11.0–12.6 | The spheres settle into an even row; the equation assembles above them. | — |
| 11.6–18.8 | `2 + 2 = 4` holds and pulses. | "When two objects join two more objects… that is why two plus two equals four." |
| 19.3–24.5 | The equation parks above a number line; the marker starts at 2 and makes two glowing jumps. | "Starting at two and moving forward two steps also brings us to four." |
| 24.5–30.0 | Camera pushes in on the equation; golden energy wave, sparkle burst, musical resolution. | "Simple, visual, and always true: two plus two equals four." |

## Files

| File | Role |
|------|------|
| `timeline.json` | Single source of truth for every cue time. The animation, the score and the captions all read it. |
| `scene.html` | The animation. A deterministic canvas renderer — `renderFrame(n)` is a pure function of the frame index, so a render is exactly reproducible. |
| `narration.py` | Synthesises the voice-over with Piper TTS and measures each clip. |
| `music.py` | Synthesises the orchestral bed, chimes, whooshes, swell and impact with numpy, then mixes and ducks the narration over it. |
| `captions.py` | Emits `captions.srt` / `captions.vtt` from the same cue times. |
| `render.mjs` | Drives `scene.html` through Playwright and pipes frames into ffmpeg. |
| `fonts/` | Outfit (numerals) and Inter (background symbols), SIL Open Font License. |

## Building

```bash
python3 -m pip install piper-tts numpy imageio-ffmpeg
python3 -m piper.download_voices en_US-lessac-high --data-dir /tmp/piper_voices

cd video
python3 narration.py     # -> build/vo/*.wav + build/narration.json
python3 music.py         # -> build/audio.wav
python3 captions.py      # -> captions.srt / captions.vtt
node render.mjs          # -> build/2plus2.mp4   (4K, ~50 min)
```

Useful variants:

```bash
node render.mjs --width 1920 --height 1080 --out build/2plus2_1080p.mp4
node render.mjs --preview 85,300,500,700,830        # stills into build/preview/
```

## Notes on the rendering

* **Determinism.** No `Math.random` or wall-clock reads in the scene. Particle,
  symbol and sparkle fields are seeded with a small PRNG and their motion is a
  closed-form function of `t`, so any frame can be rendered independently and
  re-renders are bit-identical.
* **Resolution independence.** The scene is authored in a 1920×1080 design space
  and scaled to the output size, with glyph and sphere sprites baked at output
  resolution. Rendering at 1080p or 4K changes sharpness, not layout.
* **Glass numerals.** Each numeral is baked once into a sprite: a vertical gold
  gradient, a crown highlight, a cool blue counter-light and a soft diagonal
  sheen, composited with `source-atop`, plus two blurred bloom passes. Note that
  the numerals are deliberately *not* stroked — Outfit builds its digits from
  overlapping contours, so `strokeText` draws the internal seams as visible
  lines across the bars of `2` and `4`.
* **Legibility.** Background symbols are pushed out of the centre of frame and
  faded by distance from it, so nothing ever drifts across the equation.
