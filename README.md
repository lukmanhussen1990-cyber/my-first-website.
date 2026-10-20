# THE TRAIN BERTH — a vertical horror reel made 100% with code

A 1080×1920 / 30 fps POV horror short set in an Indian sleeper-class coach at
night, rendered deterministically with **Three.js** in headless Chrome, voiced
with **ElevenLabs**, scored with synthesized sound design and mixed with
**ffmpeg**.

Output: `final/train_berth.mp4` (H.264 yuv420p CRF 18, AAC 192k, +faststart,
~64 s, −14 LUFS).

## Quick start

```bash
npm install                      # three + puppeteer (PUPPETEER_SKIP_DOWNLOAD=1 to use an existing Chrome)
python3 -m venv .venv && .venv/bin/pip install numpy scipy piper-tts onnx
export ELEVENLABS_API_KEY=...    # read from the environment only, never printed or committed
node scripts/build.js            # voice -> timeline -> sfx -> render -> mix -> mux
```

The renderer tries hardware WebGL (`--use-gl=angle`) and falls back to
SwiftShader. On a 4-core machine without a GPU a frame takes ~2.6 s, so the
full render is ~85 min; chunks land in `final/parts/` and finished chunks are
reused if a build is interrupted (delete them after changing the scene).

## Pipeline

| Step | Script | What it does |
|---|---|---|
| 1. Voice | `scripts/voice.js` | One ElevenLabs `text-to-speech/{voice}/with-timestamps` call per line (`eleven_multilingual_v2`, stability 0.4, similarity 0.8, style 0.3). Audio and character alignment are cached in `audio/vo/<scene>.{mp3,json}`; a line is only regenerated when its text, voice or model changes (or with `--force`). `--list` searches the voice library and scores candidates. |
| 2. Timeline | `scripts/timeline.js` | Scene length = voice line + 0.4 s. Captions, notification, bubble words and SFX cue on word timestamps. Writes `src/timeline.json`. |
| 3. Sound | `scripts/sfx.py` | Synthesizes the stems: train bed (clack-clack on the same rail-joint schedule as the camera bounce), horror drone, heartbeat from scene 6, phone buzz, distant horn, glass bangles, bass hits, bone cracks for the twist, and the dead silence before scene 10. |
| 4. Render | `scripts/render.js` | Static server + puppeteer. Steps `window.renderFrame(t)` in exact 1/30 s steps (no real-time clock), captures every frame and pipes PNGs into ffmpeg. Checks every caption/card box against the Instagram safe zone (y 300–1400, ≥160 px from the right edge). |
| 5. Mix + mux | `scripts/mix.js` | Voice bus (narrator centred, whisper panned to your left ear), bed/drone/heartbeat ducked under the voice with `sidechaincompress`, two-pass `loudnorm` to −14 LUFS / −1.5 dBTP, AAC 192k mux. |

Test render (scene 5, 5 s, 3 stills): `npm run test-render` → `frames/test_scene5.mp4`, `frames/still_*.png`.

## Scene code

- `src/story.json`: script, captions (with the one red word), SFX cues, voice settings.
- `src/world.js`: coach, rexine berths, rusty window bars, fans, curtains, alarm chain, moonlit trees outside, lights.
- `src/characters.js`: sleeping passengers, the woman (lying / descending / face / hand), your hand, the phone.
- `src/shots.js`: the shot list. Camera moves, eyelids, lights and the twist per scene, as a pure function of time.
- `src/post.js`: EffectComposer. Scene (MSAA) → depth of field → bloom → ACES → final pass (chromatic aberration on scares, grade, vignette, grain, eyelids with lashes, glass blur, UI).
- `src/ui.js`: captions (Anton, 150 ms pop-in), glass notification cards, whisper bubble, choice card, `midnightcompile` watermark.

## Voice status of this build

The ElevenLabs account ran out of credits during generation, so the committed
voice files are an **offline placeholder** (Piper TTS with phoneme-aligned word
timings; `"source": "offline-placeholder/..."` in each JSON, and the MP4's
comment tag says so). With a funded `ELEVENLABS_API_KEY`, `node scripts/build.js`
replaces every placeholder with ElevenLabs takes and re-times the reel from
their real lengths. The one ElevenLabs take that was generated (scene 12, voice
defaults) is kept in `audio/vo/takes/`.

## Tweaks

- **Voice:** set `ELEVENLABS_VOICE_ID` / `ELEVENLABS_WHISPER_ID`, or change the defaults and `voice_settings` in `src/story.json`. Editing a line's `text` re-times the reel.
- **Speed / length:** scenes follow the voice; change `padding` (0.4 s) in `src/story.json`, or the ellipses and wording of the lines.
- **Colours:** lamp, moon and ambient colours in `src/world.js`; grade in `src/post.js` (`grade()`, `lift`); caption red in `src/ui.js` (`RED`).
- **Scares:** scenes with `scare: true` get chromatic aberration and shake; strength in `src/shots.js` (`scareEnvelope`).
- **Quality vs time:** `?scale=` (3D layer resolution, default 0.75) and `?msaa=` in `src/main.js`.
