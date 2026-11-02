# "You just pooped in the forest" — bear reel

Instagram Reel, 9:16, 1080x1920, 30 fps, 44.4 s, 29 shots. Same style as the last reels (airplane toilet /
Thanksgiving / crush's house / keys): calm deadpan narrator telling the story to "YOU", low-poly PS1 / Roblox 3D
made only with code (three.js r160, rendered frame by frame in headless Chromium), white Pixelify Sans captions in
the centre (57.5 % height, like the last reels), green stink lines, fog, sweat drops and tears.

**Output:** `final.mp4`.

## Build

```bash
npm install                      # three@0.160 (Playwright + Chromium must be available)
pip install numpy scipy soundfile pyloudnorm fonttools faster-whisper pocketsphinx
JOBS=3 ./make_reel.sh            # captions -> sound -> frames (3 parallel jobs) -> final.mp4
PREVIEW=12 ./make_reel.sh        # first 12 s only -> preview.mp4
```

## Voice and sound

- Voiceover: ElevenLabs, voice **Nassim - Corporate Narration** (`repzAAjoKlgcT2oOAIWt`), model `eleven_v4`,
  tags `[calm] [deadpan]` (same as `thanksgiving_reel/script.json`). One take of the whole script, take B used;
  `make_voiceover.py` cuts it at the real silences and sets the pauses (0.90 s before "What you don't know:",
  1.05 s before the last line). `stt_words.py` checks every word with speech-to-text.
- Sound effects: 18 ElevenLabs sound effects (4 variations each, `audio/sfx_src/`, picks in `pick.json`) +
  code-made thud, heartbeat, whoosh, tube tap, itch "zip", tension drone, ding and the dramatic hit
  (`make_sfx.py`, helpers from the last reel in `sfx_lib.py`). Cue times come from the plan events (= measured
  word onsets). `mix.py`: voice + effects, effects ducked under the voice, -14 LUFS, true peak -1.9 dBTP.
- Captions: `make_captions.py` (2–4 words, each caption appears 10–40 ms before its word; word onsets from
  pocketsphinx alignment + energy snapping).

## Files

| | |
|---|---|
| `script.json`, `make_voiceover.py`, `stt_words.py` | voiceover (see above) |
| `plan.py` → `shots.json`, `prompts.md` | the 29-shot plan (also the ChatGPT/Kling prompts from step 2) |
| `gen_plan_js.py` → `web/plan.js` | the same plan for the renderer, with sync events |
| `web/layout.js` | where everything is (YOU's tree and bush, the bear's path, camp, map bear, sun) |
| `web/set.js` (+ `set_world.js`, `set_geo.js`, `set_tex.js`, `set_util.js`) | the forest at sunset: instanced pines, ground, river, sky, sun, god rays, props |
| `web/cast.js` (+ `char_geo.js`, `char_tex.js`) | YOU (red hoodie), faces incl. squeezed eyes, tongue, scream, puffed red cheeks |
| `web/animals.js` (+ `animal_bear.js`, `animal_geo.js`, `animal_tex.js`) | the bear (fur body on a spine, IK legs, full face rig), the map bear, the bloodhound, the squirrel, the birds |
| `web/fx.js` (+ `fx_parts.js`, `fx_shaders.js`) | stink lines, stink flow, map trail, haze, sweat, tears, crying tears, itch, swirl, leaves, splinters, dust, needles, glint, "x7" badge |
| `web/shots_a.js`, `shots_b.js`, `shots_c.js`, `shotlib.js` | the 29 shots (camera, poses, effects per frame) |
| `web/main.js`, `render.mjs` | engine (every frame is a pure function of time) and the headless renderer |
| `make_reel.sh` | the full build |

## Checks

- `node render.mjs shots out/ 0.5` — one frame per shot; `node render.mjs times out/ t1 t2 …` — any times.
- `node render.mjs probe x t` — camera / bear / YOU positions at time t; `node render.mjs nancheck x t` — broken geometry.
- `node render.mjs audit out.json 0.25` — camera inside things, characters inside trunks/tent.
