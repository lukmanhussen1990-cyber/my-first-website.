# Brushstroke Lyrics Video

A 27-second vertical lyric video (1080×1920, 30 fps) made entirely in code. There are
no images, fonts, or footage. Every letter, sky, silhouette and ray of light is painted
by a small procedural brush engine on an HTML canvas.

**The video file:** [`output/brushstroke-lyrics.mp4`](output/brushstroke-lyrics.mp4)
has **no audio track**. Drop your audio under it starting at 0:00. The timing matches
the reference clip word for word.

## Preview in the browser

Open `index.html` in any browser. Click the video or press Space to play, and use the
arrow keys to step frame by frame. **Load audio** plays your own track in sync so you
can check the timing. The audio is only used for the preview and is not added to the
video.

## Re-render the MP4

```bash
npm install          # installs Playwright (headless Chromium)
npm run render       # -> output/brushstroke-lyrics.mp4 (no audio)
```

You need `ffmpeg` on your PATH, or set `FFMPEG=/path/to/ffmpeg`. Other options:
`node render.js --frames out/` writes a PNG sequence, and `--workers 4` renders in parallel.

## Edit it

Everything you would normally change is in `js/timeline.js`:

- `phrases`: the words and the second each one starts being written
- `scenes`: when the three painted interludes appear
- `handle`: set it to e.g. `'@yourname'` to have it brush-lettered on the end card

| File | What it does |
| --- | --- |
| `js/brush.js` | Brush engine: tapered pressure, ragged edges, dry-brush bristle gaps, watercolour washes |
| `js/glyphs.js` | Hand-lettered single-stroke alphabet (a–z, 0–9, punctuation) |
| `js/lettering.js` | Lays out words with a natural wobble and times the write-on |
| `js/art.js` | The three painted scenes: sunset couple, moonlit profiles, touching hands |
| `js/renderer.js` | Composes each frame: paper, letterbox, scenes, lyrics, intro, end card |
| `render.js` | Steps the animation frame by frame in headless Chromium and encodes with ffmpeg |
