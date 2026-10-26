# GRACE IN MOTION · Q.01 · SEVEN THINGS

A 1080×1920, 30 fps, ~85 s Instagram reel made entirely in code: 3D animation, text, voice, music and sound effects.
It uses no stock footage, no downloaded images or music, and no AI video tools.

**Story.** Proverbs 6:16–19 counts down seven things God hates. #7, sowing discord among brethren, is the surprise.
The reel then turns to grace with Romans 5:8 and 1 John 1:9, and ends on hope.

## Deliverables (`out/`)
| File | What |
|------|------|
| `final_reel.mp4` | The reel: 84.93 s, H.264 (x264 slow, CRF 18, capped at 11 Mb/s), yuv420p TV range, BT.709, AAC 192 kbps stereo, `+faststart`. Audio is −14 LUFS, −1.2 dBTP |
| `cover.jpg` | Cover: the cracked stone 7 in the desert, with "GOD HATES 7 THINGS" and "#7 SURPRISES EVERYONE" |
| `caption.txt` | Instagram caption and hashtags |
| `characters.png` | The paper-cut cast |
| `storyboard.jpg` | One frame per shot, taken from the final render |
| `preview_6s.mp4` | The first 6 s (the hook) |
| `qc_contact.jpg` | QC contact sheet, one frame every 2 s |
| `ideas_used.md` | Idea log (Q.01 used; next is Q.02) |

The end-card logo is a placeholder (`public/logo.svg`) because the real logo file was never attached.
To use your own logo, replace that file (or point `EndCard` in `src/overlay/cards.jsx` at a PNG in `public/`) and re-render frames 2454–2547 with `scripts/splice.sh`.

## How it is built
```
script.json ──► voice/tts.py ──► voice/voice.wav + timeline.json (every word timed)
                                     │
                     src/plan.js  ◄──┘  shared timing plan (events + shots), imported by BOTH:
                       │      │
   audio/synth.mjs ◄───┘      └──► Remotion (src/index.jsx): 3D world + HTML overlay
   music + SFX + mix                └─ plays only public/final_mix.wav
   → audio/final_mix.wav (-14 LUFS, -1 dBTP)
```

- **Voice.** No `ELEVENLABS_API_KEY` was set, so the voice is edge-tts `en-US-AndrewMultilingualNeural`, a calm, warm male storyteller.
  - Settings: rate −5 %, pitch −3 Hz, one clip per sentence.
  - Pauses come from `script.json`: 0.3 s between sentences, 0.25 s after each "Number X:", 1.0 s before "He that soweth discord", and 0.7 s before the good news.
  - Word timings come from the TTS WordBoundary events. faster-whisper (`voice/verify.py`) matched 189/189 words.
  - KJV "yea" is spelled "yay" for the TTS so it is spoken /jeɪ/. The screen still shows "yea".
  - To use your own recording, put it at `input/voice.mp3`. A Whisper-based aligner then replaces the TTS timings.
- **Music and SFX.** `audio/synth.mjs` is a small pure-Node synth (48 kHz) with pads, felt piano, drone, a soft ~80 BPM pulse and a long reverb.
  - It plays D minor through the countdown and resolves to D major at the good news.
  - At #7 the music drops to near silence, a heartbeat plays, and a hard hit lands on the reveal.
  - Every SFX is placed on frame-exact event times from `src/plan.js`.
  - Music ducks smoothly about 8 dB under the voice. Loudness uses two-pass ffmpeg loudnorm to −14 LUFS and −1 dBTP.
- **3D.** Remotion 4 with `@remotion/three` (React Three Fiber) and three.js r186.
  - Every frame is a pure function of the frame number: seeded random, no `Date.now` or `Math.random`.
  - One scene holds all the sets: desert, scroll room, street, market, field, bench and "mind", road, city gate, village and hill. Only the active set is visible.
  - `src/lib/director.js` holds the camera (`cameraShot`) and the blocking (who stands where, when). The HTML overlay uses the same camera to project its labels, so leader lines stay glued to the 3D world.
  - Characters are paper-cut rigs (`src/three/rig.js`): flat parts on real pivots, thin outlines, blinks, expressions and paper-flip turns.
    - Secondary motion (robe hem, head-wrap tail, beard) follows the character's speed and acceleration.
    - Walk, run, sit, point (with anticipation), whisper and other poses are included.
  - Shadow puppets are silhouette copies of a rig, drawn once per pixel with a stencil.
- **Light and polish** (`src/three/post.js`):
  - ACES filmic tone mapping, fog per set, sky dome with sun disk, stars and moon.
  - Sun shadows use a 2048 map with PCF and a blur radius. three r186 removed `PCFSoftShadowMap`, so this is the supported way to get soft shadows.
  - Depth of field and rack focus come from the depth buffer, with tilt-shift.
  - Two-level bloom, haze, grade, subtle chromatic aberration, vignette and film grain.
- **Motion blur.** Fast shots (the run, whip pans, the push into the man's head) are rendered as several sub-frame samples across a 180° shutter and averaged in HDR before post.
  - This is in-engine motion blur. `@remotion/motion-blur` would mount the whole WebGL scene several times per frame, so it was not used.
- **Transitions:** whip pan, dust wipe, light-flare wipe, push-through and match cut. The only crossfade is the slow warm dissolve into the good news (and the loop back to the start).
- **Overlay** (`src/overlay/`): fonts are Cormorant Garamond and Inter from npm `@fontsource`.
  - Header "Q.01 · SEVEN THINGS".
  - Word-timed captions: upcoming words are ghosted and keywords pop in gold.
  - Hook title, the 7-slot tracker, and world-anchored labels with leader lines.
  - NABOTH name tag that cracks, Romans 5:8 card, phone chat, comment row with hearts, and end card.
  - The logo is a placeholder (`public/logo.svg`). Drop the real logo in and point `EndCard` at it.

## Run it
```bash
npm install
npm run voice          # python3 voice/tts.py   -> voice/voice.wav + timeline.json
npm run audio          # node audio/synth.mjs   -> audio/final_mix.wav (+ public/)
node render.mjs stills 0,150,600   # check frames -> build/stills/
node render.mjs cover 150          # -> out/cover.jpg
node render.mjs full build/final_reel_raw.mp4      # whole reel (about 61 min on 4 CPU cores, no GPU)
node render.mjs frames 336-540 build/seg1          # re-render just a changed section as frames...
scripts/splice.sh build/final_reel_raw.mp4 out/final_reel.mp4 seg1:336:540   # ...splice it in + delivery encode
scripts/qc.sh out/final_reel.mp4                   # contact sheet, streams, loudness
```
Rendering uses the preinstalled headless Chromium with SwiftShader WebGL (`gl: 'swangle'`), so it runs on a CPU-only machine.
