# TWO MOMS — a code-rendered vertical horror reel

A 1080×1920 / 30 fps / ~64 s horror reel made entirely with code: Three.js for the picture,
ElevenLabs for the voices, numpy for the sound design and ffmpeg for mixing and encoding.

**Output:** `final/two_moms.mp4` (H.264 High, yuv420p, CRF 18, AAC 192 kbps, `+faststart`, about −14 LUFS).
Watermark: `@midnightcompile`.

## Quick start

```bash
npm install                      # three + puppeteer
export ELEVENLABS_API_KEY=...    # only needed for voice lines that are not cached yet
npm run build                    # voice -> sfx -> timeline -> render -> mix -> final/two_moms.mp4
```

Requirements: Node 18+, Python 3 with numpy, ffmpeg 6+, and a Chrome/Chromium for Puppeteer.
Set `CHROME_PATH` to use a system Chrome. Without a GPU the render falls back to SwiftShader
automatically (`--use-gl=angle`, then `--use-angle=swiftshader`).

| step | command | what it does |
|---|---|---|
| voice | `npm run voice` | ElevenLabs `text-to-speech/{voice}/with-timestamps`, one file per line, cached in `audio/vo/` |
| list voices | `node scripts/voice.mjs --list` | lists your voices and suggests a narrator and a Mom |
| sfx | `npm run sfx` | ElevenLabs Sound Effects if a key is set (`scripts/sfx-eleven.mjs`), else numpy synthesis (`scripts/sfx.py`) |
| timeline | `npm run timeline` | scene lengths = voice length + 0.4 s, from the real audio → `build/timeline.json` |
| scene 6 test | `npm run test-scene6` | 5 s test render + 3 PNG stills in `frames/` |
| render | `npm run render` | deterministic headless render → `build/video.mp4` |
| mix | `npm run mix` | stems → sidechain ducking → loudnorm −14 LUFS → mux → `final/two_moms.mp4` |

## How it works

- **`src/story.js`** is the single source of truth for every line, caption, red word, bubble, scare
  time, choice card and phone text. Change text there and re-run: only changed lines are re-voiced.
- **Voice cache** (`audio/vo/`): `raw/<id>.mp3` is what ElevenLabs returned, `<id>.wav` is the
  silence-trimmed take, and `<id>.json` holds the cache key (text + voice + model + settings) and
  per-word timings. Caption pop-ins, speech-bubble word reveals and the A/B highlights on the
  choice card all follow these timings.
- **Deterministic render:** `window.renderFrame(t)` is a pure function of time. All noise is
  seeded and no wall clock is used. Puppeteer steps 1/30 s at a time, and the page POSTs raw
  RGBA frames straight into ffmpeg's stdin.
- **The frozen shadow (scene 6):** the kitchen key light casts Mom's real shadow onto the tiled
  wall in every kitchen shot. When the stirring stops, an invisible copy of Mom (`colorWrite = false`)
  frozen in the stirring pose takes over shadow casting, and the real Mom stops casting. She then
  raises her arm (and later turns around), but the shadow on the wall never moves.
- **Post** (EffectComposer): depth of field from the depth buffer → bloom (stove, bulbs, TV) →
  ACES tone mapping → film pass (grain, vignette, chromatic aberration that spikes on the scares
  in scenes 6, 8 and 9). Camera shake on the same scares.
- **The twist (scene 11):** the TV switches to a live render-target "security feed" from a
  camera in the kitchen ceiling, with an IR light that only exists for that pass. A third Mom
  stands right behind the sofa on a render layer that only the feed camera can see.
- **Overlay:** captions, bubbles, the frosted phone notification, the choice card and the
  watermark are drawn on a 2D canvas over the WebGL frame. Everything stays inside the
  Instagram safe zone (y 300–1400, at least 160 px from the right edge).

## Tweaks

- **Voices:** set `ELEVENLABS_VOICE_ID` / `ELEVENLABS_MOM_ID`, or edit `VOICES` in `scripts/config.mjs`.
  Voice settings (stability 0.4, similarity 0.8, style 0.3) live in `ELEVEN.settings`. A changed
  setting changes the cache key, so the next build re-voices the lines.
- **Speed and pacing:** `SCENE_PADDING`, `LINE_GAP`, scene `preroll` and the fixed `duration` of
  the caption-only scenes are in `src/story.js`. Camera moves are per scene in `Director.shot()`
  (`src/director.js`).
- **Colors and mood:** palette and red (`RED`) in `src/story.js`. Light colours and intensities
  plus the fear curve are in `Director.update()`. Grain, vignette and CA strength are on the film
  pass uniforms in the same function.
- **Text:** caption size and position are in `src/ui.js` (`CAPTION_SIZE`, `cy`).
- **Sound:** levels and automation are in `scripts/stems.py`. The door-Mom muffling is
  `DOOR_FILTER` (ffmpeg `lowpass`/`highpass`/`aecho`). Ducking and loudness are in
  `scripts/mix.mjs`.
