# Grace In Motion — "Boss Charger" reel

Instagram reel (1080x1920, 60fps, H.264 + AAC) built 100% in code:
low-poly flat-shaded 3D (three.js) rendered frame-by-frame in headless Chromium,
2D overlay for captions / comic words / watermark, procedural SFX in numpy, ffmpeg encode.

- `web/` — the scene: `rig.js` (characters, FK/IK, face rig, shock hair, x-ray), `sets.js` (office, desk,
  corner office + skyline, flashback), `shots.js` (timeline: every frame is a pure function of t),
  `overlay.js` (captions, comic text, title card), `post.js` (tone map, swirl, flash, x-ray, grain, vignette).
- `words.json` — word timings from faster-whisper; `web/data.json` — per-frame voice loudness for lip sync.
- `audio.py` — synthesizes all SFX, ducks them under `voiceover.mp3`, writes `build/mix_raw.wav`.

Rebuild:
```
npm i three@0.160.0 playwright      # three.module.js is already vendored in web/
node render.cjs build/frames 3       # resumable, interleaved workers
python3 audio.py
python3 finish.py                    # -> grace_boss_charger_1080p.mp4 (+ QA in build/)
node stills.cjs build/stills 20,500,900   # quick still frames for checking
```
