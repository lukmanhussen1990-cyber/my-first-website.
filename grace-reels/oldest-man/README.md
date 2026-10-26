# GRACE IN MOTION · Q.02 · THE OLDEST MAN

A 1080×1920, 30 fps, 84.4 s Instagram reel made entirely in code: 3D animation, text, voice, music and sound effects.
It uses no stock footage, no downloaded images or music, and no AI image or video tools.

**Story.** Methuselah, the oldest man who ever lived (969 years), died the year of the flood. If you add up the ages in
Genesis 5 (187 + 182 + 600), you land on 969. His father Enoch "walked with God", and some say his name can mean "when he
dies, it shall be sent". God waited as long as He could (1 Peter 3:20), and is still waiting today, not to punish you
but for you (2 Peter 3:9).

## Deliverables (`out/`)
| File | What |
|------|------|
| `final_reel.mp4` | The reel: 84.47 s, 1080×1920, 30 fps, 90.7 MB (H.264 CRF 19 capped at 9 Mb/s, yuv420p TV range, BT.709; AAC 192k; −14.0 LUFS, −1.0 dBTP) |
| `cover.jpg` | Cover: Methuselah with his lamp at night, a giant gold 969, the ark far away — "THE OLDEST MAN… AND THE FLOOD" |
| `caption.txt` | Instagram caption + 15 hashtags |
| `subtitles.srt`, `subtitles.vtt` | Timed subtitles for every spoken word (the reel also has them burned in) |
| `storyboard.jpg` | One frame per shot from the final render |
| `preview_6s.mp4` | The hook |
| `characters.png` | The paper-cut cast (rig v3) |
| `qc_contact.jpg` | QC contact sheet, one frame every 2 s |

The logo mark (`public/logo.svg`, used in the top-left watermark and on the end card) is a placeholder, because the
real logo file was never attached. Replace `public/logo.svg` (same name) and re-render to use your own.

## How it is built
```
script.json ──► voice/tts.py ──► voice/voice.wav + timeline.json (every word timed)
                                     │
                     src/plan.js  ◄──┘  shared timing plan (events + shots), imported by BOTH:
                       │      │
   audio/synth.mjs ◄───┘      └──► Remotion (src/index.jsx): 3D world + HTML overlay
   music + foley + mix                └─ plays public/final_mix.wav
```
- **Voice:** edge-tts `en-US-AndrewMultilingualNeural` (rate −5 %, pitch −3 Hz), one clip per sentence, word times from
  WordBoundary events. `voice/verify.py` (faster-whisper) matches 178/179 words.
- **Music + SFX:** `audio/synth.mjs` (pure Node): D minor → D major on "…but for you", near silence + one giant raindrop
  when the lamp dies, hammer taps on the time-lapse grid, the sky crack, rain; ducking under the voice; two-pass loudnorm.
- **3D:** Remotion 4 + `@remotion/three` + three.js r186; every frame is a pure function of the frame number.
  - Sets (`src/three/sets/`): `hill` (S1, S2, S8–S10, loop), `enoch` (S3), `family` (S5, S6), `ark` (S7, S11 time-lapse,
    S12 flood), `city` (S13), `cta` (S14). Cameras + anchors per set in `src/cams/`.
  - Characters (`src/three/rig.js`, `src/three/characters/`): SVG-drawn parts baked to atlases, cel shading against the
    real key light, ~5 px outline, side / ¾ / back views with paper-flip; presets in `characters/cast.js`.
  - Graphics: AO, god rays, height fog, AgX/ACES grade, DOF, tilt-shift, bloom, SMAA/FXAA, rain + puddles + wet ground,
    the oil lamp flame, gold numbers, the giant raindrop, storm decks and the lightning crack.
- **Overlay** (`src/overlay/`): watermark (logo + GRACE IN MOTION) top-left, "Q.02 · THE OLDEST MAN" top-right, word-timed
  italic captions (subtitles from the first word), hook title, math tracker 187 → 369 → 969, labels with leader lines,
  life-ribbon, Genesis 5 overlap timeline, verse cards (Genesis 5:24, 1 Peter 3:20, 2 Peter 3:9), CTA with comment box and
  hearts, end card + seamless loop.

## Run it
```bash
npm install
python3 voice/tts.py                   # voice/voice.wav + timeline.json
node audio/synth.mjs                   # audio/final_mix.wav (+ public/)
node render.mjs stills 0,150,600       # check frames -> build/stills/
CONC=4 node render.mjs frames 0-2533 build/frames_full   # whole reel as frames (~80 min on 4 CPU cores)
scripts/encode.sh build/frames_full out/final_reel.mp4   # encode + mux the final mix
node render.mjs cover 0                # cover still
python3 scripts/srt.py                 # out/subtitles.srt + .vtt
node scripts/proj.mjs <frame> <set> "x,y,z"   # composition helper: project set-local points to screen pixels
```
