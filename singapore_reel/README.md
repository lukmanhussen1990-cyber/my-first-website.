# "You pooped in the street in Singapore" — Instagram Reel

9:16, 1080x1920, 30 fps, 46 s. Low-poly 3D made only with code (three.js r160, rendered frame by frame in
headless Chromium), the user's own voiceover (`audio/voiceover.mp3`, used as-is, no generated voice),
code-made sound effects, Pixelify Sans captions.

**Output:** `final.mp4`.

## Build

```bash
npm install                      # three@0.160.0 (Playwright + Chromium must be available)
pip install numpy scipy soundfile fonttools faster-whisper pocketsphinx
JOBS=3 ./make_reel.sh            # full reel -> final.mp4  (PREVIEW=15 for the first 15 s)
```

`make_reel.sh` runs: `align_words.py` (word timings) → `make_captions.py` (captions) → `make_sfx.py` + `mix.py`
(sound, -14 LUFS) → `render.mjs frames` in parallel chunks → ffmpeg (H.264 + AAC, captions burned in by libass).

## Files

| | |
|---|---|
| `audio/voiceover.mp3` | the user's voiceover (the only voice in the reel) |
| `audio/voiceover.words.json`, `vo_lines.json` | speech-to-text word times; start/end of each of the 26 lines, measured from the silences |
| `script.json` | the 26 lines as spoken in the audio |
| `align_words.py`, `make_captions.py` → `audio/captions.ass` | 2–4 word captions, centred, synced to the voice |
| `make_sfx.py` → `audio/sfx/*.wav`, `audio/sfx_cues.json` | every sound effect synthesised with numpy, and where it plays |
| `mix.py` → `audio/mix_final.wav` | voice + effects, effects always under the voice and ducked while it speaks, -14 LUFS |
| `prompts.md` | image/clip prompts for the same 29 shots (if you want to redo it with AI images) |
| `web/layout.js` | street, spots of every character, toilet room, airport, duration |
| `web/plan.js` | the 29 shots: time range, what the voice says, sync events (also used by the sound) |
| `web/set.js` (+ `set_util.js`) | mirror-clean street, skyline, cars and bus, props, receipt ribbon, public toilet, airport + plane, sky |
| `web/characters.js` (+ `char_geo.js`, `char_tex.js`) | YOU, the officer, the man, the lady, the kid, 5 extras |
| `web/fx.js` | stink lines, sweat, sparkles, impacts, speed lines |
| `web/shots_a.js`, `shots_b.js`, `shots_c.js`, `shotlib.js` | the shots (camera, poses, effects per frame) |
| `web/main.js`, `render.mjs` | engine (every frame is a pure function of time) and the headless renderer |

## Checks

- `node render.mjs audit out.json 0.1` — glitch audit every 0.1 s (camera inside or too close to anything,
  people inside buildings).
- `mix.py` prints the loudness (target -14 LUFS, true peak ≤ -1.5 dBTP) and how loud each effect is
  compared with the voice (all effects are below the voice).
