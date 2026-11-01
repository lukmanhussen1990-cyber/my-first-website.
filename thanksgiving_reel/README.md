# "You pooped your pants at Thanksgiving dinner" — Instagram Reel

9:16, 1080x1920, 30 fps, 50 s. Low-poly 3D made only with code (three.js r160, rendered frame by frame in
headless Chromium), deadpan ElevenLabs voiceover, code-made sound effects, Pixelify Sans captions.

**Output:** `final.mp4` (full reel), `preview.mp4` (first 15 s, half size).

## Build

```bash
npm install                      # three@0.160.0 (Playwright + Chromium must be available)
pip install numpy scipy soundfile fonttools faster-whisper
JOBS=3 ./make_reel.sh            # full reel -> final.mp4  (PREVIEW=15 for the first 15 s)
```

`make_reel.sh` runs: `align_words.py` (word timings) → `make_captions.py` (captions) → `make_sfx.py` + `mix.py`
(sound, -14 LUFS) → `render.mjs frames` in parallel chunks → ffmpeg (H.264 + AAC, captions burned in by libass).

## Files

| | |
|---|---|
| `script.json` | the script, voices (ElevenLabs voice ids) and the takes used |
| `make_voiceover.py` | cuts the narrator take into lines at real silences and joins all voices with the pauses |
| `audio/raw/` | the ElevenLabs takes (narrator, Uncle, Grandma; 2 takes each) + speech-to-text word times |
| `audio/voiceover.mp3` / `.wav`, `vo_lines.json` | the joined voiceover and the exact start/end of every line |
| `align_words.py`, `make_captions.py` → `audio/captions.ass` | 2–4 word captions, centred, synced to the voice |
| `make_sfx.py` → `audio/sfx/*.wav`, `audio/sfx_cues.json` | every sound effect synthesised with numpy, and where it plays |
| `mix.py` → `audio/mix_final.wav` | voice + effects, effects ducked under the voice, loudness -14 LUFS |
| `web/layout.js` | all positions (room, table, seats, plates, dishes) |
| `web/plan.js` | the 29 shots: time range, what the voice says, sync events |
| `web/set.js` (+ `set_room.js`, `set_food.js`, `set_tex.js`, `set_util.js`) | dining room, food, props, lights |
| `web/characters.js` (+ `char_geo.js`, `char_tex.js`) | the 7 people: rig, faces, poses, holding props |
| `web/fx.js`, `web/xray.js` | stink lines, sweat, rumble rings, glint…, and the x-ray stomach scene |
| `web/shots_a.js` … `shots_f.js`, `shotlib.js` | the shots (camera, poses, effects per frame) |
| `web/main.js`, `render.mjs` | engine (every frame is a pure function of time) and the headless renderer |

## Checks

- `node render.mjs audit out.json 0.1` — automatic glitch audit every 0.1 s: camera inside / too close to anything,
  body parts inside the table, chairs, walls or dishes. The final build has zero issues.
- `node render.mjs shots out/` — one frame per shot for a visual check.
