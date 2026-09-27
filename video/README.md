# Brushstroke Disc: silent motion piece

A 30-second, 16:9 (1920×1080, 60 fps) kinetic typography piece. The disc is made
entirely from procedural white brushstrokes. The file has **no audio track**.

- `dist/brushstroke-disc-1080p60.mp4`: the rendered video (H.264, video stream only)
- `index.html` + `motion.js`: the generative scene. Open `index.html` through any
  static server to watch it play live in the browser.
- `render.mjs`: offline renderer (headless Chromium via Playwright, then ffmpeg)

## How it works

Every frame is a pure function of time, `renderFrame(t)`, so the renderer can
split frames across several browser pages and the output is deterministic.

**Disc.** Seven stroke layers, about 500 slots in total: a rough outer rim, a data
area of concentric dry-brush arcs on groove tracks, two rotating reflection wedges,
a hub ring, a faint clamp area, a painted ring around the centre hole, and
burst-only smears. Each slot keeps regenerating strokes. A stroke draws itself in,
lives for a while, then leaves in one of five ways: it chases its own tail, retracts,
breaks apart into drifting pieces, smears around the circumference, or loses its
bristles one at a time. A stroke is a torn-edge ribbon plus separate bristles, and
each bristle varies in pressure, paint load and dry gaps. Radius, length,
thickness and rotation all follow noise. On top of that are radial and chord
scratches, orbiting paint fragments, and spray thrown off the rim.

**Motion.** A burst envelope with a fast attack and a long, calm decay drives spin,
radial displacement and jitter at every section change. Each word adds a small
extra kick.

**Type.** Archivo (semi-condensed) with Instrument Serif Italic for accent words.
There are six letter-level reveals: masked rise with stretch, tracking collapse,
sheared character slide, horizontal stretch-snap, slice scan, and bar print. The
seventh reveal is a dry brush that drags across the word and paints it in. The piece
also has hand-drawn pen marks. Sections leave through text-and-disc interactions:
letters break into ink particles that get pulled into the disc's orbit, brush rings
expand past the frame and erase the text, a dry-brush sweep wipes a block away,
and a slice shred. Two lines sit behind the disc.

**Print.** Paper mottling, dry-ink drop-outs, a misregistered second pass, film
grain, dust, hairline scratches and registration marks.

## Re-render

```sh
# needs Node, Playwright's Chromium and an ffmpeg binary
FFMPEG=/path/to/ffmpeg node render.mjs --fps 60 --crf 20 --out out/brushstroke-disc.mp4
node render.mjs --stills 3.2,12.6,20      # review frames to out/stills
node render.mjs --from 8 --to 10 --out out/clip.mp4
```

Fonts: Archivo and Instrument Serif, both under the SIL Open Font License (see `fonts/`).
