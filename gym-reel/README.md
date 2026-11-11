# Gas's Gym — 2D low-poly reel (100% code)

A 30-second vertical Instagram reel (1080×1920, 60 fps, H.264 High + AAC 320k) built entirely in code:
2D vector low-poly art drawn with **skia-python**, frame by frame, encoded with **ffmpeg**. No Blender, no 3D software,
no stock art, no sound samples.

**Final file:** `out/grace_gym_spotter_1080p.mp4`

## How it works

| Step | File | What it does |
|---|---|---|
| Transcription | `assets/audio/words.json` | faster-whisper `medium.en` word timestamps of the voiceover (opening grunts captioned as "NNGH!") |
| Timing | `src/timing.py`, `src/cues.py` | caption chunks (1–3 words) + every cut, beat and SFX hit derived from real word times |
| Engine | `src/engine.py` | polygons → Delaunay facets with per-vertex heights → each facet lit from its true 3D normal (gem look), rim light, glow, shadows, vignette, paper grain, outlined text |
| Rigs | `src/rig.py` | cut-out characters: expressive heads (eyes, blinks, big brows, lip-synced mouth, sweat, veins, tears, tomato-red), bodies, hands, side-view runners |
| Props / FX | `src/props.py` | gym set, bending barbell + plates, lamps, mirrors, toxic cloud system, shockwaves, lightning, sparks, confetti, exit door, sign letters |
| Scenes | `src/scenes.py` | the 10 scenes with camera moves, parallax, shake, captions, comic words, watermark |
| Audio | `src/audio.py` | every SFX synthesised in numpy (creaks, breathing, heartbeat, the fart + echoes, thunder clap, chant, record scratch, chime…), side-chain ducked under the voice, −14 LUFS |
| Render | `src/render.py` | parallel frame rendering, motion blur on fast moves, lossless chunks → final encode |
| QA | `src/preview.py`, `src/qa_motion.py` | contact sheets of stills; scan for pops / frozen frames |

## Rebuild

```bash
pip install skia-python numpy scipy pillow faster-whisper
./build.sh            # soundtrack -> frames -> out/grace_gym_spotter_1080p.mp4
```

Preview stills: `cd src && python preview.py /tmp/sheet.png 0.5 4.5 13.6 18.7 25.9 29.8`
