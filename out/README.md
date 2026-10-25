# GRACE IN MOTION · HONEST QUESTIONS · "THE SKY"

A 1080×1920, 30 fps, ~74 s vertical reel. It is built as a deterministic Three.js low-poly world with flat 2D cartoon characters, word-by-word serif captions, Scripture cards, and a procedural soundtrack.

## Deliverables (this folder)

| File | What |
|---|---|
| `final_reel.mp4` | The reel: H.264 CRF 18 yuv420p, AAC 192k, `+faststart`, −14 LUFS / −1 dBTP |
| `cover.jpg` | Cover: the hook question set large over the dusk city-sky shot |
| `caption.txt` | Instagram caption + 10 hashtags |
| `ref_style_notes.md` | Breakdown of the reference reel's style (pacing, palette, captions, overlays…) |
| `characters.png` | Character sheet: the full cast and the acting library |
| `storyboard.jpg` | One frame per scene (S1–S19) |
| `qc_report.md`, `qc_contact.jpg` | QC results and a contact sheet every 2 s |

## One-command re-render

```bash
bash tools/build_all.sh              # narration → cue sheet → soundtrack → frames → MP4 → stills → QC
SKIP_TTS=1 bash tools/build_all.sh   # keep the current narration and timings
```

First-time setup (from the repo root):

```bash
npm install                                   # three.js + fonts (@fontsource)
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
bash tools/fetch_models.sh                    # Kokoro TTS voice model (only needed for TTS)
```

Requirements: Node 18+, Python 3.11+, ffmpeg, and Playwright's Chromium (`require('playwright')`). Rendering uses software WebGL (SwiftShader) at ~0.9 s/frame, so the full reel takes ~35 min on 4 CPU cores. A GPU machine is much faster.

Useful single steps:

```bash
node tools/render.mjs --preview      # first 6 s → build/preview_silent.mp4
node tools/render.mjs --at 12.5,30   # single frames → build/stills/
node tools/render.mjs --range 40,50  # a time range → build/range.mp4
node tools/render.mjs --stills       # one frame per scene
node tools/render.mjs --safezone     # checks every text box against the IG safe zone
```

## Swapping in your own logo and voice

- **Logo:** drop your square/round profile image at `assets/grace-in-motion-pfp.png` and re-render. The top bar, comment avatar and outro pick it up automatically. Until then a placeholder mark (`assets/logo-placeholder.svg`) is used, because the logo file wasn't attached.
- **Your own voice:** save it as `build/voice_override.wav` (read `script/script.json` in order) and run `bash tools/build_all.sh`. Word timings are then estimated from the script and stretched to your recording's length. Give each sentence a short pause, as the script's `gap` values do.
- **Script edits:** everything spoken and shown lives in `script/script.json`. `*WORD*` marks a red highlight word. Scene lengths follow the voice automatically.

## Notes on how this was made

- **Voice:** the brief asked for edge-tts (`en-US-AndrewMultilingualNeural`, −8 %). This cloud environment's network policy blocks `speech.platform.bing.com`, so the narration uses the open **Kokoro-82M** neural TTS (Apache-2.0, runs locally), voice `am_michael`, at 0.92 speed (−8 %). Per-word timings come straight from the model's phoneme durations, so captions are exact to the audio. To use edge-tts on your own machine, generate `voice.wav` there and use the override above.
- **Determinism:** `index.html` exposes `window.renderAt(t)`. All motion is a pure function of `t`, with seeded PRNG and noise only, and no wall-clock time or CSS animation. `tools/render.mjs` drives headless Chromium frame by frame and pipes JPEGs to ffmpeg.
- **Look:** flat-shaded Lambert materials, VSM soft shadows, linear fog matched to a gradient sky, and the dissolve compositor in `src/post.js`. The compositor does per-shot grade, depth-of-field on close-ups, bloom, FXAA, vignette and film grain.
- **Characters:** `src/chars.js` draws each figure part by part (head, hair, torso, upper/lower arms, legs, feet) on a canvas every frame. It uses forward kinematics with 2-bone IK, a union outline (`#2b1d14`), dot eyes with brows, blinks and mouths for key emotions. Each figure stands on a camera-facing card in the 3D world with a soft contact shadow. Feet are snapped to the ground.
- **Soundtrack (`tools/audio.py`):** a procedural pad (suspended → D minor for S3–S11 → D major from S12) with a bell arpeggio once grace enters. It has 22 synthesized SFX types driven by the renderer's cue sheet, music ducked −8 dB under the voice, and mastering to −14 LUFS / −1 dBTP true peak. Everything is generated, with no samples, so it's royalty-free.
- **Scripture** is KJV, word for word: Jeremiah 29:13 and John 20:29. Label pills: *MOUNT SINAI · EXODUS 20*, *THEY STOOD AFAR OFF · EXODUS 20:18*, plus *THE CALF, AND THE DANCING · EXODUS 32:19* and *BEHOLD MY HANDS · JOHN 20:27* (both quoted from the KJV).

## Project layout

```
index.html           page + overlay CSS (captions, pills, cards, end screen, outro)
script/script.json   narration, highlight words, Scripture card keys
src/reel.js          timeline + the 15 shots (S1–S19), camera moves, SFX cue sheet
src/env.js           worlds: city, Sinai/camp/calf, bedroom, upper room, end screen; light pillar, birds, motes
src/chars.js         2D character rig;  src/poses.js acting library;  src/cast.js the cast
src/post.js          compositor;  src/overlay.js DOM overlays;  src/util.js PRNG/easing
tools/               tts.py, audio.py, render.mjs, qc.py, contact.py, build_all.sh, fetch_models.sh
```
