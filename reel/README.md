# "Hidden Treasure" — vertical 3D animated reel (made entirely with code)

`output/treasure_reel.mp4` — 1080x1920, 30 fps, 50.5 s, H.264 + AAC, burned-in word-by-word subtitles.

## How it is made

| part | tool | files |
|------|------|-------|
| 3D animation | Three.js rendered frame-by-frame in headless Chromium (software GL), every frame computed from time `t` | `scene/` |
| look | PBR materials with procedural GLSL soil (strata, pebbles, roots), ~220k swaying grass blades, soft shadows, GTAO ambient occlusion, HDR bloom on the gold, ACES filmic tone mapping, grade + vignette, 4x MSAA | `scene/lib/materials.js`, `scene/main.js` |
| story / animation | one pure function of time: poses (2-bone IK), props, hole states, particles, camera | `scene/lib/story.js` |
| voices | Piper TTS (local) or ElevenLabs; word timings via faster-whisper alignment / ElevenLabs timestamps | `voice/`, `voices/`, `script.json` |
| music + SFX | synthesized in numpy (no samples) | `audio/` |
| subtitles | ASS, Fredoka Bold, one word at a time with a pop | `subs/make_subs.py` |
| mix + export | ducking, -14 LUFS, ffmpeg | `export.py` |

Shared timing (scenes, voice anchors, music stop, SFX cues) lives in `timeline.json`.

## Rebuild

```bash
npm install                     # three + playwright-core
python3 -m venv .venv && .venv/bin/pip install numpy scipy soundfile pillow piper-tts faster-whisper
xvfb-run -a node tools/render.mjs --stills 2.7,12.0,24.0   # check frames -> build/stills/
xvfb-run -a node tools/render.mjs --video                  # all frames -> build/render/video_nosubs.mp4 (resumable chunks)
.venv/bin/python audio/make_sfx.py
.venv/bin/python export.py      # music, mix, subtitles, final mp4
```

Swap in ElevenLabs voices later: see [VOICES.md](VOICES.md) (`./remake_with_elevenlabs.sh`).
