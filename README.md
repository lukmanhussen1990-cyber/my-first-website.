# NIGHT SHIFT

A 64-second vertical (1080×1920, 30 fps) 3D horror reel made 100% with code:
Three.js for the picture, a neural voice for the narration, numpy for the sound design,
ffmpeg for the mix. Output: `final/night_shift.mp4`.

> *She only moves when you look away.*

## Run it

```bash
npm install                      # three + puppeteer (uses the system Chromium if present)
pip install numpy scipy soundfile kokoro   # sound design + local voice fallback
npm run build                    # voice -> timeline -> sfx -> render -> mix -> final/night_shift.mp4
```

Steps can also be run one by one:

| step | command | output |
| --- | --- | --- |
| voice lines (cached) | `npm run voice` | `audio/vo/<line>.wav` + `.json` word timestamps, `preview_all_lines.mp3` |
| timeline | `npm run timeline` | `src/timeline.json` (scene lengths from the real voice lengths) |
| sound design | `npm run sfx` | `audio/mix/sfx.wav` |
| test render | `npm run test-render` | `frames/test_scene3.mp4`, `frames/test_scene10.mp4`, 3 PNG stills each |
| full render | `npm run render` | `frames/video.mp4` (H.264 CRF 18, yuv420p) |
| mix + mux | `npm run mix` | `final/night_shift.mp4` (AAC 192k, -14 LUFS, +faststart) |

Quick looks: `node scripts/render.mjs --stills 14,50.5 --scale 0.5`.

## Voice

- With `ELEVENLABS_API_KEY` set, `scripts/voice.mjs` uses ElevenLabs
  `/v1/text-to-speech/{voice}/with-timestamps` (`eleven_multilingual_v2`, stability 0.4,
  similarity 0.8, style 0.3), one file per line. Voices: `ELEVENLABS_VOICE_ID` /
  `ELEVENLABS_WHISPER_ID`, else the ids in `src/story.json`, else the best match from your voice list.
- Without a key it falls back to the local Kokoro-82M model (also with word timestamps).
- Every line is cached by a hash of engine + voice + settings + text, so re-renders never
  spend credits twice. Change a line and only that line is regenerated.
- After changing the voice, run `npm run build` again: the timeline, captions and cues all
  follow the new lengths automatically.

## How it works

- `src/main.js` exposes `window.renderFrame(t)`. Time only ever comes from `t`
  (fixed 1/30 s steps), so every frame is deterministic and can be rendered in any order.
- `scripts/render.mjs` drives headless Chromium (ANGLE, falling back to SwiftShader),
  reads raw pixels and pipes them straight into ffmpeg. `--workers N` splits the film
  across several browsers.
- `src/director.js` stages every shot: cameras, characters, light flicker, scares.
- Her dance (`src/world/dance.js`) is smooth procedural motion sampled at **12 fps**
  while everything else runs at 30 fps.
- Reflections: one planar mirror for the wet floor + street, one for the steel fridge door
  (`src/world/reflect.js`).
- Post: depth of field, bloom, teal-shadow grade, ACES, vignette, grain, chromatic
  aberration + shake only on the three scares (`src/post.js`).
- Captions, whisper bubble and choice card: `src/overlay.js`, kept inside the Instagram
  safe zone (y 300–1400, ≥160 px from the right edge).

## Tweak it

- **Lines, captions, red words, scene beats, pacing:** `src/story.json`
  (`targetDuration`, per-scene `lead`/`tail`, caption `red`).
- **Voices:** `voices` in `src/story.json`, or the env vars above.
- **Colors / grade:** `PAL` in `src/world/textures.js`, grade in `FINAL_FRAG` (`src/post.js`).
- **Dance:** speed/amplitude in `src/world/dance.js`, her frame rate is `DANCE_FPS`.
- **Sound levels:** gain curves at the bottom of `scripts/sfx.py`.
