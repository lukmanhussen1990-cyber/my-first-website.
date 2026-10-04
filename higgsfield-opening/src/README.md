# Higgsfield opening animation

`../higgsfield-opening.mp4` is a 6-second logo sting (1920x1080, 60 fps, H.264 + AAC).

Sequence: the Higgsfield mark draws itself on with a glowing tip, flashes with a shockwave
ring, slides into the lock-up while the wordmark letters cascade in, a light sweep crosses
the logo, it holds with a soft neon glow, then fades to black.

## Re-rendering

Requirements: Node 18+, Playwright with Chromium, ffmpeg.

```bash
npm i playwright && npx playwright install chromium   # once
./encode.sh ../higgsfield-opening.mp4
```

- `anim.html` – the animation. `window.seek(t)` positions every element for time `t`,
  so frames render deterministically. Open `anim.html#play` in a browser for a live preview.
- `render.js` – screenshots each frame with Playwright.
- `audio.js` – synthesises the riser, impact, shimmer and pad into `audio.wav`.
- `encode.sh` – renders frames, builds audio and muxes the MP4.
- `fonts/Manrope700.woff2` – wordmark font (OFL licensed).
