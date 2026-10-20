# Roadster Reel — "John jumps the traffic jam"

A 55.5-second vertical Instagram Reel (1080×1920, 30 fps, H.264 + AAC) made entirely with code:
3D animation (Three.js, rendered frame by frame in headless Chromium), synthesized music and
sound effects, text-to-speech voiceover and word-by-word burned-in subtitles.

## Deliverables

| File | What |
|------|------|
| `out/john_roadster_reel.mp4` | Final video (H.264 High, yuv420p, 1080×1920, 30 fps, AAC 48 kHz, −14 LUFS) |
| `out/clean_video_no_subtitles.mp4` | The rendered 3D without subtitles/audio (used to re-export without re-rendering) |
| `voices/line01_narrator.wav` … `voices/line07_john.wav` | One audio file per voice line |
| `voices/timings.json` | Word start/end times for every line |
| `script.json` / `script.md` | The script (machine-readable / human-readable) |
| `timeline.json` | Scene times, voice slots and sound-effect cue times shared by the 3D and the audio |

## Swapping in the ElevenLabs voices (no 3D re-render)

The first version uses a local TTS voice (Piper: `en_US-lessac-high` narrator, `en_US-ryan-high`
for John) because ElevenLabs wasn't usable when it was made: there was no API key in the
environment and the connected ElevenLabs account was out of credits. A full remake needs about
640 characters of credit (the whole script is 639 characters). To use ElevenLabs:

```bash
pip install -r requirements.txt                 # plus ffmpeg on PATH
export ELEVENLABS_API_KEY=sk_...                # or put ELEVENLABS_API_KEY=... in roadster-reel/.env
./remake_with_elevenlabs.sh
```

This one command re-creates every line with ElevenLabs (`/with-timestamps`, so subtitle timing
comes from ElevenLabs' own character timestamps), re-mixes the audio (music ducks under the
new voice, music still cuts right before John's line) and re-exports `out/john_roadster_reel.mp4`
with the new subtitle timing. If ElevenLabs fails (no key, error, no credits) it falls back to
Piper automatically; pass `--strict` to stop instead.

- Voices are set in `script.json` → `voices.narrator.elevenlabs` / `voices.john.elevenlabs`
  (defaults: premade voices "Jessica" for the narrator and "Will" for John, model
  `eleven_multilingual_v2`, narrator speed 1.08). Change `voice_id` to any voice in your account;
  if an id isn't found the script picks a voice by name.
- Each line keeps its start time from `timeline.json`. A longer ElevenLabs line is time-compressed
  (pitch preserved, at most 1.3×) only if it would run into the next line.
- John's mouth movement in the 3D was animated from the first (Piper) recording; with a new voice
  the lip flaps stay the same, which is fine for this short line.

## How it's built

```
render/          Three.js scene + renderer (runs in headless Chromium on Mesa llvmpipe)
  main.js        frame loop: N jittered, time-offset sub-frames per frame (motion blur + AA)
  post.js        HDR accumulation, mip-chain bloom, ACES filmic tone map, grading, vignette
  world.js       scene assembly; anim.js = all animation/camera/FX as pure functions of time
  roadster.js    the car (lofted from feature lines to match the reference), thrusters, fan
  john.js        John (eyes, lids, brows, goggles, hair, hoodie, IK arms, squish/foam/dizzy)
  city.js        diorama slab with soil layers, pipes and cables; roads; glass towers; props
  traffic.js     toy-car traffic jam (instanced) and the bus; carwash.js; fx.js; sky.js; tex.js
  render.mjs     driver: stills for QA, resumable chunked frame rendering -> ffmpeg
tools/
  voices.py      ElevenLabs (with timestamps) or Piper TTS -> voices/*.wav + word timings
  music.py       synthesized music (bar lines land on the bonk and the car-wash landing)
  sfx.py         synthesized sound effects placed from timeline.json + the 3D thrust curves
  mix.py         voice placement, ducking, -14 LUFS master
  subs.py        word-by-word subtitles (Fredoka Bold, outline + soft shadow, pop-in bounce)
  export.py      clean video + subtitles + audio -> final MP4
```

Full rebuild from scratch:

```bash
npm install                                      # three.js
node render/render.mjs frames --workers 2        # ~2 h on 4 CPU cores (software GL)
python tools/voices.py && python tools/music.py && python tools/sfx.py
python tools/mix.py && python tools/export.py
```

Quick look at any moment: `node render/render.mjs stills --times 7.0,25.5 --w 540 --h 960`.

Font: Fredoka (SIL Open Font License, `assets/fonts/OFL.txt`). No logos or brand marks appear in the video.
