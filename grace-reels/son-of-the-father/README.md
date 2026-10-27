# GRACE IN MOTION · Q.03 · SON OF THE FATHER

A 1080×1920, 30 fps, 84 s Instagram reel made entirely in code: 3D animation, text, music and sound effects. The voice is
the creator's own recording. It uses no stock footage, no downloaded images or music, and no AI image or video tools.

**Story.** At Passover the governor released one prisoner. Pilate brought out two men: Jesus, who healed the sick and
raised the dead, and Barabbas, a rebel "who had committed murder in the insurrection" (Mark 15:7). The crowd shouted
"Barabbas." But notice his name: in Aramaic *Bar* means son and *Abba* means father, so Barabbas means "son of the
father". That day a guilty son of the father walked free, and the true Son of the Father died in his place
(1 Peter 3:18). You are Barabbas. So am I.

## Deliverables (`out/`)
| File | What |
|------|------|
| `final_reel.mp4` | The reel (H.264, yuv420p TV range, BT.709; AAC 192k; −14 LUFS, −1 dBTP), under 100 MB |
| `cover.jpg` | Cover: Jesus in gold light and Barabbas in chains under a cold spotlight, "BARABBAS = ???" glowing above them, "HIS NAME WILL SHOCK YOU" |
| `caption.txt` | Instagram caption + 15 hashtags (KJV quotes word for word) |
| `subtitles.srt`, `subtitles.vtt` | Timed subtitles for every spoken word (the reel also has them burned in) |
| `storyboard.jpg` | One frame per shot from the final render |
| `preview_6s.mp4` | The hook |
| `characters.png` | The paper-cut cast |
| `qc_contact.jpg` | QC contact sheet, one frame every 2 s |

The logo mark (`public/logo.svg`, top-left watermark and end card) is a placeholder, because the real logo file was never
attached. Replace `public/logo.svg` (same name) and re-render to use your own.

## How it is built
```
script.json + voice/input/P01..P18.mp3 (the creator's recordings)
        └─► voice/tts.py (user mode) ──► voice/voice.wav + timeline.json (every word timed by faster-whisper)
                                              │
                          src/plan.js  ◄──────┘  shared timing plan (events + shots), imported by BOTH:
                            │      │
        audio/synth.mjs ◄───┘      └──► Remotion (src/index.jsx): 3D world + HTML overlay
        music + foley + mix                 └─ plays public/final_mix.wav
```
- **Voice:** the 18 recorded parts are trimmed (energy gate), word-timed with faster-whisper and aligned to the script,
  with pauses between beats; `voice/verify.py` matches 177/177 words.
- **Music + SFX:** `audio/synth.mjs` (pure Node, no samples). D minor through the trial (low strings, low drums, a low
  brass hit on the reveal, an ostinato over Jerusalem, a dark Phrygian riot), a hard stop on the crowd's shout and 0.9 s
  of near silence, a mysterious drone as the name unlocks (a golden B-flat chord on "son of the FATHER"), the lift into
  D major on "the true SON of the Father", the biggest warm swell on 1 Peter 3:18 and the warmest bloom on "YOU are
  Barabbas". The crowd is wordless throughout (formant shouts with chant-like pulses), and drops "underwater" in the
  slow motion. Chains, the key, the lock breaking, the shackles hitting the stone, horn calls, torches, whispers,
  heartbeats, thunder and a city at night are all synthesized. Ducking under the voice; two-pass loudnorm.
- **3D:** Remotion 4 + `@remotion/three` + three.js r186; every frame is a pure function of the frame number.
  - Sets (`src/three/sets/`): `court` (Gabbatha before the palace, the city, the temple, the walls, the hill outside —
    S1–S5, S7–S10, S12–S14a, loop), `memory` (three glowing memories: the blind man sees, a child lifted up, Lazarus
    walks out — S5a–S5c), `riot` (the insurrection at night as shadows and running, no violence — S6), `modern` (a city
    street at night — S14b), `cta` (the open shackles on the stone — S15). Cameras + anchors per set in `src/cams/`.
  - The crowd: 12 rigged people in the front rows plus ~380 instanced paper cards (baked from the rig into an atlas:
    16 people × 2 views × 4 chant poses) in the court, on the roofs and in the streets.
  - Characters (`src/three/rig.js`, `src/three/characters/`): SVG-drawn parts baked to atlases, cel shading against the
    real key light, outline, side / ¾ / back views with paper-flip; presets in `src/three/characters/cast.js`.
    God the Father is only ever light; Jesus is a simple figure with no halo; the cross is seen far away only.
- **Overlay** (`src/overlay/`): watermark top-left, "Q.03 · SON OF THE FATHER" top-right, word-timed captions from the
  first word, the hook title "ONLY ONE WALKS FREE", labels with leader lines, the locked name card "BARABBAS = ???" that
  unlocks, splits into BAR | ABBA (SON / FATHER) and re-forms into SON OF THE FATHER in gold, verse cards (Matthew 27:21,
  Matthew 27:26 full-screen, 1 Peter 3:18), the comment-box CTA with hearts, end card + seamless loop.

## Run it
```bash
npm install
python3 voice/tts.py                   # voice/voice.wav + timeline.json (from voice/input/*.mp3)
node audio/synth.mjs                   # audio/final_mix.wav (+ public/)
node render.mjs stills 0,150,600       # check frames -> build/stills/
CONC=4 node render.mjs frames 0-2519 build/frames_full   # whole reel as frames
scripts/encode.sh build/frames_full out/final_reel.mp4   # encode + mux the final mix
node render.mjs cover                  # cover still
python3 scripts/srt.py                 # out/subtitles.srt + .vtt
node scripts/proj.mjs <frame> <set> "x,y,z"   # composition helper: project set-local points to screen pixels
```
