# Opus 5 — 20s animation ad

A 20-second, 1920×1080 / 60fps product ad rendered entirely from HTML + Canvas.

**Output:** `opus5-ad.mp4` (H.264, yuv420p, faststart — plays anywhere)

## How it works

`index.html` is not a normal web animation — it has no CSS keyframes and never reads the
wall clock. Everything is drawn by a single pure function, `window.seek(t)`, which paints
the exact state of the ad at time `t` (seconds). That makes every frame deterministic and
reproducible, so the video can be captured frame-by-frame with no dropped frames or timing
drift.

`render.js` drives it: Playwright/Chromium calls `seek(f / fps)`, screenshots the viewport,
and pipes the PNG straight into ffmpeg's stdin (`image2pipe`) — no intermediate frames are
ever written to disk.

## Storyboard

| Time | Scene |
|------|-------|
| 0.0–3.0s | ~1500 particles spiral in and form the Claude starburst; ignition flash + shockwave |
| 3.0–5.5s | The mark slides into the wordmark lockup; "Claude" wipes in beside it |
| 5.5–8.5s | The mark parks as a header mark; "OPUS 5" reveals letter-by-letter with motion blur |
| 8.5–13.5s | Three feature cards stagger in, each with its own live-animated icon |
| 13.5–16.8s | Full-bleed flowing light ribbons — "Built for the long horizon." |
| 16.8–20.0s | Final lockup: mark, OPUS 5, "by Claude", CTA, fade to black |

Continuity trick: the starburst is a *single element* for the whole 20 seconds. It travels
through one keyframe track — hero → wordmark slot → header mark → final lockup — so the ad
never cuts away from the brand.

## Assets

- Starburst + wordmark: [Claude AI symbol](https://commons.wikimedia.org/wiki/File:Claude_AI_symbol.svg)
  and [Claude AI logo](https://commons.wikimedia.org/wiki/File:Claude_AI_logo.svg) (Wikimedia Commons)
- Type: Fraunces (display), Inter (UI), JetBrains Mono (numerals) — self-hosted in `assets/fonts/`
- Palette: Claude rust `#D97757` / `#C15F3C` on warm near-black, cream `#F4F0E9`

## Re-rendering

```bash
pip install imageio-ffmpeg
npx http-server -p 8123 .          # canvas pixel sampling needs http://, not file://
FFMPEG=$(python3 -c "import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())") \
FPS=60 DUR=20 OUT=opus5-ad.mp4 node render.js
```

Preview single moments instead of the whole video:

```bash
PREVIEW="2.1,6.6,15.0" node render.js   # writes preview/t*.png
```
