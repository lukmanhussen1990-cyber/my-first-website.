# "You're homeless" — handkerchief reel

Instagram Reel, 9:16, 1080x1920, 30 fps, 73.7 s, 41 shots (about 1.8 s each, like the last reels).
Goofy start (bush, limo, rich lady, "Shut up."), then a sweet love-story timeline (DAY 1, MONTH 3, YEAR 1,
50 YEARS LATER). Same look as the last reels: low-poly PS1 / Roblox 3D, white Pixelify Sans captions in the
centre (57.5 % height), stink lines, sweat drops, sparkles and floating hearts added in the edit.

## How it was made

The prompts for ChatGPT / Kling are in `prompts.md` (step 2). The user then asked me to build the reel myself,
so - like the bear and mansion reels - the whole video is rendered in 3D with code (three.js r160, frame by
frame in headless Chromium):

- `web/layout.js` - the 7 places (far apart along +X): rainy blue-hour street, the fun-fact void, the fancy
  restaurant, Paris (Eiffel Tower), the wedding garden, the porch house at sunset, the living-room wall.
- `web/set.js` - shows only the current shot's place; places: `set_street.js` (+ `set_city.js`,
  `set_street_props.js`: limo with gold rims + opening doors, hollow bush, cart, lamp, puddles),
  `set_rest.js` (+ `set_rest_void.js`: brain + stopwatch, `set_rest_room.js`: restaurant + framed handkerchief),
  `set_out.js` (+ `set_out_paris.js`, `set_out_eiffel.js`, `set_out_wp.js`: wedding + porch).
- `web/cast.js` - YOU (homeless / suit / groom / old), the lady (fur coat / bride / old), the bodyguard, the
  waiter, guests; `web/props_hk.js` - the animated silk handkerchief, its old twin, leaf, ticket, tissue, fly.
- `web/shots_a.js` .. `shots_d.js` - the 41 shots (camera, poses, faces, effects), timed to the word onsets.
- `add_labels.py` - DAY 1 / MONTH 3 / YEAR 1 / 50 YEARS LATER labels (added to the captions file).

## Build

```bash
SCALE=0.75 JOBS=4 ./make_reel.sh     # captions + labels, plan, sound, frames (4 jobs), final.mp4 (1080x1920)
PREVIEW=12 ./make_reel.sh            # first 12 s only -> preview.mp4
SCALE=0.5 node render.mjs shots out 0.6     # one frame per shot (quick check)
```

(`render.py` + `edit.py` are the image-based alternative for ChatGPT images; not used for the final.)

## Voice

- `make_voiceover.py` cuts the take into the 42 script lines at the real silences (STT check with
  `stt_words.py`, HINT=1: every word matches the script) and keeps the user's own pacing (gaps evened to
  0.30–0.55 s). Longer pauses for timing: 0.95 s after "Shut up." (the bodyguard's "boop"), 1.05 s before
  "What you don't know:", 0.80 s before "First date." and "Fifty years later.", 1.10 / 0.75 / 0.85 s before
  the last three lines. Output: `audio/voiceover.wav` (+ `.mp3`), `audio/vo_lines.json`.
- `make_captions.py`: 2–4 word captions, each appears 10–40 ms before its word (pocketsphinx alignment +
  energy snapping). Lines spoken with no break between them ("…someone's face / in about a tenth…") are
  split at the real gap, not inside a word. Output: `audio/captions.ass`, `audio/word_onsets.json`.

## Files

| | |
|---|---|
| `script.json` | the 42 lines + pauses |
| `make_voiceover.py`, `stt_words.py` | voiceover (see above) |
| `make_captions.py`, `fonts/` | burned-in captions |
| `plan.py` → `shots.json`, `prompts.md` | the 41-shot plan and the ChatGPT / Kling prompts |
| `edit.py` | per-shot camera (push-ins, pans, tilts, punch-ins on the beat, shake, sway) and effects |
| `render.py` | images / Kling clips → frames (camera + effects: stink lines, sweat, hearts, heart pop, sparkles, glow, tears, petals, fly, date labels, "0.1 SEC", speed lines, flashes) → `final.mp4` |
| `make_sfx.py`, `sfx_lib.py` | sound effects → `audio/sfx/`, cue list `audio/sfx_cues.json` (times = measured word starts) |
| `mix.py` | voice + effects (ducked under the voice) → `audio/mix_final.wav`, -14 LUFS, true peak < -1.5 dBTP |
| `audio/sfx_src/` | ElevenLabs takes (`sessions.json`, chosen takes in `pick.json`) + `reused/` sounds from the last reels |

## Sound

New ElevenLabs sound effects (4 takes each, picked from their spectrograms): limo pulling up, car door, door slam,
heel step in a puddle, heels walking, the bodyguard's gasp, paper crinkle, cart squeak, silk swish, steak chomp,
plate crash, the bodyguard's sobbing (ends with a trumpet nose-blow), wedding bells, porch-swing creak, fly, "boop",
heart pop, stopwatch ticking + click, fur swoosh, restaurant piano bed, Paris accordion bed, soft piano. Reused:
city street bed, heavenly choir, sparkle, love harp, time-lapse whoosh (mansion reel); bush rustle, leaf,
crickets, birds (bear reel). Code-made: heartbeat, whoosh, the "What you don't know" DUN, ding.
Beats: the city noise cuts out on "Shut up." and during the freeze (only single heartbeats), the choir sings
when the handkerchief comes out, the piano stops for "She never washed it." (just a fly) and comes back for the
last line.
