# The Kid Who Could Hear Everyone's Thoughts

A 1080x1920 (9:16), 30 fps vertical short (~111 s), made **100 % from code**:
Three.js geometry (blocky toy-style characters, a cozy primitive-built town), canvas-drawn faces,
thought bubbles and captions, procedural music and sound effects, rendered frame-by-frame in
headless Chromium and encoded with ffmpeg. No video editor, no downloaded models, no stock footage.

The narration is the creator's own recorded voiceover (`assets/voiceover.mp3`), used exactly as
recorded. Its Whisper word timestamps drive every shot cut and every caption.

## Build

```bash
npm install                 # three + playwright (uses an existing Chromium if present)
pip install faster-whisper numpy   # only needed to (re)compute word timestamps
./build.sh --preview        # first 10 s  -> out/preview.mp4
./build.sh                  # full video  -> out/final.mp4, out/thumbnail.png, out/captions.srt
```

`WORKERS=4 ./build.sh` sets how many Chromium pages render in parallel. The script prints the total
render time and the output path. Software WebGL (SwiftShader) is used, so no GPU is needed:
about 0.8 frames/s on 4 CPU cores, roughly 70 minutes for the full video.

Requirements: Node 18+, Python 3.10+ with numpy, ffmpeg, Chromium for Playwright
(`npx playwright install chromium` if none is installed).

## Pipeline (`build.sh`)

1. `audio/tts.py` - narration + word timestamps -> `audio/voice.wav`, `story/words.json`
   - uses `assets/voiceover.mp3` when present (Whisper word alignment, `WHISPER_MODEL=small` or a local path);
   - otherwise ElevenLabs `with-timestamps` TTS if `ELEVENLABS_API_KEY` is set;
   - otherwise offline `espeak-ng`.
2. `story/build_timeline.py` - `story/script.json` (narration + 83-shot list) + word timestamps ->
   `story/timeline.json`. Shot cuts snap to word starts, so shot lengths follow the narration.
3. `render/render.mjs --events` - dry-runs every shot to list thought-bubble pop times.
4. `audio/music.py` (soft piano + pad, I-V-vi-IV in C major at 70 BPM, building to the end)
   and `audio/sfx.py` (pops, whooshes, page flip, knocks, clicks, chime, crowd cheer).
5. ffmpeg mix: narration at 0 dB, music side-chain ducked ~18 dB under the voice, SFX at -8 dB.
6. `render/render.mjs` - Playwright loads `web/index.html`, calls `window.renderFrame(i)` for every
   frame (time is driven manually, never real-time) and saves `frames/%05d.png`; ffmpeg encodes
   H.264 + AAC.
7. `out/thumbnail.png` (Leo shocked + bubbles, "I HEAR THOUGHTS?!") and `out/captions.srt`.

## Source map

| File | What it does |
|---|---|
| `story/script.json` | Narration lines + shot list (single source of truth) |
| `story/timeline.json` | Generated shot times and caption words |
| `src/main.js` | Renderer, moods (day / sunset / dusk / night / sad / memory / dark), bloom, grading, FXAA, cast, props, `window.renderFrame` |
| `src/characters.js` | `makeCharacter({skin, shirt, pants, hair, accessory})`, chicken, dog |
| `src/faces.js` | `drawFace(ctx, expression)`: neutral, happy, big-smile, sad, crying, shocked, worried (+sweat), squint `> <`, sleepy `u u`, thinking, blush, teary-smile, teary, determined, dreamy, angry |
| `src/town.js` | `buildTown()`: street, houses with glowing windows, Mr. Walter's window room, square with fountain, bakery, lamp shop, clock tower, string-light poles, school, hallway, classroom, kitchen, calendar |
| `src/shots.js` | One function per shot: camera path (easeInOutCubic + push-in), poses, faces, bubbles, mood |
| `src/captions.js` | One word at a time, Poppins ExtraBold, white + black stroke + shadow, pop-in, yellow key words, auto-shift away from faces |
| `src/thoughtBubble.js` | Pop-in thought / speech bubbles |
| `render/render.mjs` | Headless renderer (`--preview`, `--frames a-b`, `--stills ids`, `--thumbnail`, `--events`) |
| `audio/*.py` | Narration, music, sound effects |

Font: Poppins ExtraBold (SIL Open Font License), embedded from `assets/fonts/`.
