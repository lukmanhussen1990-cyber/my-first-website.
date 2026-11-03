# "It all started with one poop" — mansion reel

Vertical funny reel, 1080x1920, 30 fps, 82.83 s (exactly the length of the user's voiceover), 70 shots.
Final file: `mansion_toilet_love_reel.mp4` (repo root) = `mansion_reel/final.mp4`. Quick check: `preview_144p.mp4`.

**Voice:** only the user's own recording (`audio/raw/my_voiceover.mp3`, 82.834 s), not changed in any way (no speed
or pitch change, no cuts, no AI voice). `import_voiceover.py` only decodes it to `audio/voiceover.wav`.

**Word timing:** faster-whisper (free, runs locally, `medium.en`), no paid API. `stt_parts.py` splits the recording
into its 52 speech parts (from the pauses) and transcribes each part on its own, so the word times don't drift.
Captions show every word exactly as it is said, nothing censored. Two unclear words were checked again:
"He gets down on one knee" (with the sentences around it whisper hears "he", and the word starts with a breathy
"h"), and a short "You:" before "I love you." (heard by both medium.en and small.en). Numbers are written the way
they are spoken ("DAY THREE HUNDRED SIXTY-FIVE"); the white label boxes show the digits ("DAY 365").

**Reference look** (the 25 s shower reel the user uploaded earlier; no `reference.mp4` was in the folder): smooth
low-poly mannequins with faceted heads and tall black rectangle eyes, blocky hands, bright clean pastel light;
bold uppercase captions with a thick black outline in the lower middle, each word turning yellow as it is said;
comic sound words; a new shot every ~1.2 s.

## Story → shots

1 park bench at night · 2 rumble + EMERGENCY · 3 "Bad." · 4–5 the park toilet: CLOSED · 6–7 café: customers only ·
8–9 the mansion (gate, fountain, sparkles) · 10 KNOCK KNOCK! · 11–13 the butler opens, looks, SLAM! ·
14 KNOCK KNOCK! louder · 15–16 the OWNER in his silk robe, light behind him · 17–18 "Please. I need to poop." on his
knees · 19–20 he looks, he smiles · 21–22 "Bathroom's upstairs": the golden stairs · 23–24 so happy: MWAH! ·
25 the owner's eyes pop into hearts, BA-DUM! · 26 the run up the stairs · 27 the GOLDEN toilet · 28 PLOP! (camera
looks away) · 29–30 the chandelier shakes · 31–32 coming down, he's still smiling (heart eyes) · 33–35 DAY 2 dinner
by candlelight · 36–38 DAY 30 the towel, the butler rolls his eyes · 39–41 DAY 60 asleep on the couch, Zzz ·
42–45 waking up cuddling, heart eyes · 46–47 DAY 100 moving in with one tiny bag · 48–52 DAY 200 Paris, "I love you" /
"I love you more" · 53–60 DAY 365: one knee, the toilet-paper ring with a diamond, yes · 61 the garden wedding
(flower arch, string lights, guests clapping, the butler crying) · 62–63 5 YEARS LATER, two kids · 64 the golden
toilet (and a tiny golden potty) · 65–68 every night on the same couch, still in love · 69–70 "it all started… with
one poop": zoom out from the golden toilet, fade out.

## Files

- `stt_parts.py`, `import_voiceover.py` — word times; `plan.py` — 70 shots + caption chunks → `shots.json`.
- `align_words.py` + `make_captions.py` → `audio/captions.ass`; `make_words.py` adds the comic words (KNOCK KNOCK!,
  SLAM!, MWAH!, BA-DUM!, PLOP!, Zzz, BLING!, CLAP CLAP!, RUMBLE!) and the white label boxes (EMERGENCY, DAY 2 … DAY 365,
  5 YEARS LATER). `events.py` keeps the shared key moments (words, sounds and camera hits line up).
- `scene/` — three.js (all code-made, no images): `cast.js` (the rig + the cast: homeless YOU with beard, beanie and
  torn jacket, later clean and in a white wedding suit; the OWNER with slicked-back hair, silk robe and gold watch,
  later in a black suit; the BUTLER; the two KIDS; the café owner; guests; kneeling poses), `char_tex.js` (faces with
  the heart eyes that pulse, the torn jacket and robe textures), `mansion.js` (night street + park toilet + café,
  the mansion with the golden gate and fountain, the marble hall with the golden stairs, chandelier and big couch,
  the candle-light dinner, the golden bathroom, Paris with the Eiffel Tower at sunset, the garden wedding),
  `shots.js` (the 70 animated shots). `render_scene.mjs` renders them with Playwright (headless Chromium).
- `fx.py` + `render.py` — camera moves and 2D effects (floating pink pixel hearts, a giant beating heart, sparkles,
  glow, sweat, tears, speed lines, rumble lines, shakes, fade out) → `build/seg_XX.mp4`.
- `make_sfx.py` — 81 quiet code-made sounds: stomach rumbles, knocks, door slam and creaks, the kiss "mwah",
  heartbeats, plop, chandelier tinkle, sparkles, wedding bells, clapping, kids' giggles, and soft romantic music
  (piano arpeggio + pad, C–Am–F–G) from the smile to the end. `mix.py`: the voice is the main sound, every effect is
  well under it and ducks while the voice speaks; -14 LUFS.

## Build

```bash
pip install numpy scipy soundfile faster-whisper opencv-python-headless
npm install
python3 stt_parts.py audio/raw/my_voiceover.mp3 && python3 import_voiceover.py && python3 plan.py
NO_STILLS=1 node render_scene.mjs        # 3D clips (CLIP_SCALE=0.13334 CLIPS_OUT=build/clips_lo for the 144p preview)
./make_reel.sh                           # captions -> words -> sounds -> mix -> shots -> final.mp4
```
