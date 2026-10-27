# Cat reel renderer

Low-poly PS2-style Instagram Reel ("Your cat says MEOW only to you"), 1080x1920 @ 30 fps. Every frame is rendered
by Three.js in headless Chromium and joined with ffmpeg; nothing is screen-recorded.

- `SCRIPT.md` — voiceover lines per part, what is on screen, fact-check sources
- `ASSETS.md` — optional GPT Image prompts / real sound recordings that can replace the code-made versions
- `src/` — `plan.js` (the shot list + pop-ups + sound cues, keyed to word timings), `main.js` (timeline engine,
  captions, compositing), `cat.js` / `human.js` (low-poly rigs), `sets.js` (street + house), `overlay.js`
  (captions, chips, bubbles, stickers, FX), `textures.js` (procedural PS2 textures)
- `render.mjs` — headless driver (`frames`, `times`, `sfx` modes)
- `tools/` — audio + build scripts (below)

## Build

```bash
npm install                                   # three@0.160.0 (Playwright + Chromium must be available)
pip install kokoro-onnx soundfile scipy numpy faster-whisper
# 1. voice (skip if you have your own recordings: drop part1.wav ... part10.wav into assets/audio/voice/)
python tools/make_voice.py kokoro-v1.0.onnx voices-v1.0.bin assets/audio/voice am_michael 1.0
# 2. word timings + timeline (part start times, caption words)
python tools/word_times.py assets/audio/voice
python tools/build_timeline.py assets/audio/voice assets/timeline.json
# 3. sound effects + music (synthesized)
python tools/make_sfx.py assets/audio/sfx
python tools/make_music.py assets/timeline.json assets/audio/music.wav
# 4. render frames in parallel, mix (-14 LUFS) and encode H.264 + AAC
tools/render_all.sh /tmp/reel-build 3
```

Kokoro model files: https://github.com/thewh1teagle/kokoro-onnx/releases (model-files-v1.0).
Swapping in your own voice only needs steps 2 and 4 — every cut, caption and sound cue re-times itself.
