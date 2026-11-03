# "The strongest medicine" — doctor reel

Instagram Reel, 1080x1920, 30 fps, 56.53 s (the length of the user's voiceover), 48 shots. Final file:
`doctor_poop_reel.mp4` (repo root) = `doctor_reel/final.mp4`.

**Voice:** only the user's own recording (`audio/raw/my_voiceover.mp3`, 56.529 s). It is not changed: no speed
change, no pitch change, no cuts, no AI voice. `import_voiceover.py` only decodes it to `audio/voiceover.wav`.

**Word timing:** faster-whisper (free, runs locally, `medium.en`). No paid API. Whisper on the whole file drifted
after 28 s, so `import_voiceover.py` finds the 40 speech parts by loudness and `stt_words.py` transcribes each part
on its own. Every caption and every cut is placed on these word times. Check (see "Caption check" below): each
caption starts 8–41 ms before its word, about one frame or less.

**Reference look:** no `reference.mp4` was attached, so the exam-hall reel reference from the same series was
studied instead (low-poly faceted heads, pixel eyes, blocky hands, pixel textures, warm indoor light, white pixel
captions with a black outline in the centre, a new shot every 1–1.5 s, push-ins and punch-ins, sweat drops, green
stink lines). This reel: 48 shots, 0.4–2.1 s each, about 1.2 s on average.

## Story → shots (each cut is on a word)

| Voice | Shots |
|---|---|
| You're staying at your friend's house. | 1 sofa, huge belly, sweat |
| And you haven't pooped in five days. | 2 red X marks on the calendar, 3 the fifth big X |
| Your stomach is a balloon. | 4 YOU stands, t-shirt too small; 5 slow zoom, the belly wobbles |
| Your friend's mom thinks you're pregnant. | 6 the mom walks in (apron); 7 she gasps and touches the belly |
| You go to the doctor. He presses your stomach. | 8 the clinic; 9 the belly dents and bounces back |
| Hmm. Very serious. | 10 hand on chin; 11 ECU, the glasses shine |
| He gives you the strongest medicine. | 12 the medicine shelf; 13 glowing bottle with a skull, sparkles |
| Take one. ONLY ONE. | 14 one finger; 15 close-up, screen shake |
| You take three. | 16 three pills while the doctor writes |
| You sit in the waiting room. Nothing. One minute. Nothing. | 17 old man with a stick, lady with a magazine, kid in a cast; 18 smile; 19 the clock ticks; 20 thumbs up |
| Then… Your stomach starts talking. LOUD. | 21 the smile freezes; 22–24 rumble lines, sweat, screen shake |
| Everyone in the waiting room looks at you. | 25–28 reaction close-ups (old man, lady, kid, receptionist) |
| You run to the toilet. There's a line. Ten people. | 29 tiny fast steps, speed lines; 30–31 the line at the OCCUPIED door |
| You can't wait! PLEASE! IT'S AN EMERGENCY! | 32 giant sweat drops; 33–34 fists bang on the door, the sign shakes |
| The door opens. It's the doctor. | 35 slow door; 36 low angle, the doctor |
| Then… It happens. Right there. | 37 ECU eyes; 38 green cloud + flash + shake; 39 the cloud spreads over the line |
| On the doctor's new shoes. | 40 slow tilt down: the shiny shoes are not shiny any more, stink lines |
| Silence. The waiting room is empty in three seconds. | 41 everyone frozen; 42 everyone runs out; 43 empty room, a chair still spinning |
| Well… The medicine works! | 44–45 the doctor, blank face, stink lines from the shoes |
| Then he writes your bill. Treatment: $50. New shoes: $500. | 46 writing; 47 the bill: $50; 48 $500 circled in red, YOU smiling with a flat belly, fade out |

## Files

- `import_voiceover.py` — the voice (unchanged) + per-part word times → `audio/voiceover.wav`, `audio/vo_lines.json`,
  `audio/voiceover.words.json`. LOUD lines (BIG CAPS captions): "ONLY ONE.", "LOUD.", "PLEASE! IT'S AN EMERGENCY!".
- `plan.py` — 48 shots + 63 caption chunks (2–3 words) → `shots.json`; `align_words.py` + `make_captions.py` →
  `audio/captions.ass` (Pixelify Sans, white with a black outline, centred; loud lines bigger with a pop).
- `scene/` — every picture is made in code with three.js (no images): `cast.js` (the low-poly rig: YOU with the huge
  balloon belly, the mom, the doctor with grey hair, glasses, stethoscope and very shiny brown shoes, the old man,
  the lady, the kid with the cast, the receptionist), `sets.js` (living room, clinic, doctor's office, waiting room
  with the toilet door and the red OCCUPIED sign, calendar, medicine bottle, bill…), `shots.js` (the 48 animated
  shots). `render_scene.mjs` renders them with Playwright (headless Chromium) → `clips/shot_XX.mp4`, and saves where
  the forehead, belly, cloud, shoes… are on screen in every frame (`build/anchors/`), so the 2D effects follow them.
- `events.py` — key moments (shared by the sound and the effects). `fx.py` — per-shot camera moves (push-ins,
  punch-ins on words, small shake on the loud lines) and effects (blue sweat drops, green stink lines, green cloud,
  rumble lines, sparkles, speed lines, flash, fade out). `render.py` → `build/seg_XX.mp4`.
- `make_sfx.py` — 73 quiet code-made sounds (no recordings, no AI): tummy gurgles and rumbles, marker squeaks, belly
  boing, door chime, gulps, clock ticks, footsteps, fists on the door, door creak, heartbeat, the cloud "fwoomp",
  record scratch before "Silence.", crickets, stampede, spinning chair, pen scribble, ka-ching.
  `mix.py` — the voice is the main sound; every effect sits 13–30 dB under it and ducks while the voice speaks.
  Final: -14 LUFS, true peak -1.9 dBTP.
- `make_reel.sh` → `final.mp4`. `preview_lo.mp4` is the quick low-quality check (324x576).

## Build

```bash
pip install numpy scipy soundfile faster-whisper opencv-python-headless
npm install
python3 stt_words.py audio/raw/my_voiceover.mp3 && python3 import_voiceover.py && python3 plan.py
NO_STILLS=1 node render_scene.mjs           # 3D clips (CLIP_SCALE=0.3 CLIPS_OUT=build/clips_lo for a quick preview)
./make_reel.sh                              # captions -> sounds -> mix -> shots -> final.mp4
```

## Caption check

All 63 captions start between 8 and 41 ms before their first word (whisper word time), none overlap, and the video
is exactly as long as the voiceover (56.53 s).
