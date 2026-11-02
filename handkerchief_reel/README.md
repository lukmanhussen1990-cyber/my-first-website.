# "You're homeless" — handkerchief reel

Instagram Reel, 9:16, 1080x1920, 30 fps, 73.7 s, 41 shots (about 1.8 s each, like the last reels).
Goofy start (bush, limo, rich lady, "Shut up."), then a sweet love-story timeline (DAY 1, MONTH 3, YEAR 1,
50 YEARS LATER). Same look as the last reels: low-poly PS1 / Roblox 3D, white Pixelify Sans captions in the
centre (57.5 % height), stink lines, sweat drops, sparkles and floating hearts added in the edit.

## Status

1. Voiceover: done — the user's own recording (`audio/voiceover_src.mp3`), nothing regenerated.
2. Shot plan + prompts: done — `prompts.md` (character sheets + 41 ChatGPT prompts + 6 Kling prompts).
3. Sound: done — 23 new ElevenLabs effects + reused beds/effects + code-made ones, mixed at -14 LUFS.
4. Video tool: done and tested (placeholder cards until the images exist).
5. Waiting for the user's images (`images/shot_01.png` ...) and Kling clips (`clips/shot_04.mp4` ...).
6. Then: tune `edit.py` to the real pictures and build `final.mp4`.

## Build

```bash
python3 make_sfx.py && python3 mix.py          # sound -> audio/mix_final.wav
python3 render.py sheet                        # one frame per shot -> build/sheet.jpg (quick check)
python3 render.py frames                       # all frames (4 processes, ~2 min)
python3 render.py encode                       # frames + sound + captions -> final.mp4
SCALE=0.5 python3 render.py frames && SCALE=0.5 python3 render.py encode build/preview.mp4   # fast preview
```

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
