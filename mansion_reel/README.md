# "You're homeless." — mansion reel

Instagram Reel, 9:16, 1080x1920, 30 fps, 71.8 s, 44 shots. Same style as the last reels (airplane toilet / bear /
Thanksgiving): the story told to "YOU", low-poly PS1 / Roblox 3D made only with code (three.js r160, rendered frame by
frame in headless Chromium), white Pixelify Sans captions in the centre (57.5 % height), cartoon effects.

**Output:** `final.mp4`.

## Voice
- The user's own voiceover (`audio/voiceover_src.mp3`, uploaded as `flush_gay.mp3`), not regenerated.
  `make_voiceover.py` removes the generation glitches listed in `script.json` (`source_cuts`): a repeat of
  "He points down a hallway … You run.", an extra spoken "and sad.", and a repeat of the penguin part up to
  "He gives you your own bathroom." The user's pacing is kept (gaps evened to 0.30–0.55 s), with longer pauses before
  "What you don't know:" (1.0 s) and the last line (1.2 s).
- **"Welcome home." is missing from the upload.** It has a silent 1.0 s slot (69.09–70.09 s). To add it: put the clip
  in `audio/raw/`, set `"audio": {"file": "audio/raw/<clip>"}` on that line in `script.json`, then run
  `python3 make_voiceover.py && python3 make_captions.py && python3 mix.py` and re-encode (`SKIP_RENDER=1 ./make_reel.sh`).
- `stt_words.py` checks every word with speech-to-text (all 164 words match the script).

## Build
```bash
npm install                          # three@0.160 (Playwright + Chromium must be available)
pip install numpy scipy soundfile fonttools faster-whisper pocketsphinx
JOBS=3 ./make_reel.sh                # captions -> sound -> frames (3 parallel jobs) -> final.mp4
./preview.sh                         # quick low-res preview (PV_TO = last frame)
```

## Files
| | |
|---|---|
| `script.json`, `make_voiceover.py`, `stt_words.py` | voiceover (see above) |
| `plan.py` → `shots.json`, `gen_plan_js.py` → `web/plan.js` | the 44-shot plan with sync events (word onsets) |
| `make_captions.py` | captions (2–4 words, each appears 10–40 ms before its word) |
| `web/layout.js` | where everything is: street, mansion, gold hallway, bathrooms, zoo |
| `web/set.js` + `set_city.js`, `set_mansion.js`, `set_zoo.js`, `set_props.js`, `set_tex2.js` | the sets, sky, lights, doors, disco ball, the 30-button and the 1-button golden toilets |
| `web/cast.js` (+ `char_geo.js`, `char_tex.js`) | YOU (beanie + patched coat, wet, towel, spirit level; gold robe at the end), the rich guy (gold bathrobe), 3 shopkeepers |
| `web/animals.js` | Roy and Silo (chinstrap penguins), the egg + chick, pigeons |
| `web/fx.js` + `fx2.js` | sweat, laugh tears, glints, name badges + water jet, indoor rain, drips, music notes, disco beams/spots, hearts, glowing heart, question marks, steam, speed lines, dizzy stars, rumble lines |
| `web/shots_a.js` … `shots_d.js`, `shotlib.js` | the 44 shots |
| `make_sfx.py` (+ `sfx_lib.py`), `mix.py` | sound effects (ElevenLabs + code-made) and the mix (-14 LUFS, true peak -1.9 dBTP) |
| `make_reel.sh`, `render_frames.sh`, `render.mjs`, `web/main.js` | build + renderer |

## The fact
Roy and Silo were two male chinstrap penguins at the Central Park Zoo in New York. They paired up around 1998, and when
keepers gave them an egg from another pair they raised the chick, Tango (hatched in 2000).
