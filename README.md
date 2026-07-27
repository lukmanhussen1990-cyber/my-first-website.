# IMRAN — butterfly title animation

A 5-second cinematic intro in which dozens of colourful butterflies fly in from
every direction, swirl through spiral flight paths and assemble the name
**IMRAN**, one letter at a time.

| | |
|---|---|
| Output | `video/imran-butterflies.mp4` |
| Format | 1920×1080 (16:9), 30 fps, 5.00 s, H.264, no audio |

## What's in the animation

- Dark, dreamy background: layered nebula wash, drifting glowing particles and
  soft god rays.
- ~310 butterflies in blue, purple, orange, gold and white. Wings beat as a
  foreshortened 3D flap — fast in flight, calm once perched — and fast movement
  is smeared with true shutter-sampled motion blur.
- Letters assemble sequentially (I → M → R → A → N); each letterform ignites
  with a coloured glow as its butterflies land.
- At 3.66 s: a cinematic flash, sparkle burst, three expanding energy waves and
  a camera punch-in.
- Epilogue: the name pulses gently, a dozen butterflies lift off again and
  orbit the finished wordmark, over a slow continuous push-in.

## Files

- `index.html` — the animation itself. Open it in a browser and it plays on a
  loop. Self-contained: one canvas, no dependencies, no external assets.
- `tools/render.mjs` — renders `index.html` frame by frame in headless Chromium
  and encodes the MP4.

## Re-rendering the video

```sh
cd tools
npm install
npm run render        # -> video/imran-butterflies.mp4
```

Every visual is a pure function of time, so frame *N* is identical whether it is
played live or captured offline — the capture is deterministic and repeatable.
