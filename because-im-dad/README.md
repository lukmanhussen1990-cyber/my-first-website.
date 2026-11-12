# Because I'm Dad... (construction worker)

A 21-second, square (1080×1080) animated short in the "Because I'm Dad..." style:
a construction-worker dad keeps taping his worn-out boots so his kids can have
what they want, until they smash their piggy bank to buy him new ones.

Everything is drawn in code (SVG) and rendered frame by frame with Playwright.

## Files

- `index.html`: open it in a browser to preview with a play/scrub bar
- `lib.js`, `chars.js`, `props.js`, `scenes.js`, `main.js`: drawing engine, characters, props, the 14 shots, timeline
- `render.js`: renders the MP4
- `still.js`: renders single frames for checking (`node still.js out/ t=4.6 t=16.8`)

## Render

```bash
node render.js because-im-dad.mp4 music.wav 1.5   # 1.5 = 1080x1080, 1 = 720x720
```

`music.wav` is not committed. Drop any 21.4 s track in its place. The cuts follow a
128 BPM beat grid that starts at 0.35 s, so if you swap the song, edit `CUTS` in `scenes.js`.

## Quick edits

- Caption: `CAPTION` in `main.js`
- Channel watermark (top-left): `CHANNEL` in `main.js`
- Names on the tags: the `label(...)` calls in `scenes.js`
