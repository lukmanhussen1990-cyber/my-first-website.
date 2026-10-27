# Cat reel renderer

Low-poly PS2-style Instagram Reel ("Your cat says MEOW only to you"), rendered frame-by-frame with Three.js in
headless Chromium and joined with ffmpeg. Nothing is screen-recorded, so motion stays smooth.

- `SCRIPT.md` — voiceover lines per part + what is on screen + fact-check sources
- `ASSETS.md` — GPT Image prompts, sound list, file names
- `src/` — `cat.js`, `human.js` (low-poly rigs with IK), `sets.js` (street + house), `overlay.js`
  (captions, chips, bubbles, stickers, FX), `textures.js` (procedural PS2 textures), `main.js` (page entry)
- `render.mjs` — headless driver: `node render.mjs stills <outDir> [names…]` / `node render.mjs frames <outDir> [from] [to]`
- `tools/transcribe.py` — word timestamps from the voiceover (faster-whisper) for caption sync

Setup: `npm install` (three@0.160.0); Playwright + Chromium must be available.
