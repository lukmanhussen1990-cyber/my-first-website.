# Bean gas shelter reel

A vertical Instagram Reel (1080x1920, 30 fps, 60.5 s), made only with code: a goofy
survival build told like a serious documentary. A worker's little brother has just
eaten three cans of beans, and a giant gas cloud is coming. The worker builds an
underground gas shelter in the backyard, step by step, using real air-safety science:
heavier-than-air gas, an airtight door with rubber seals, a tall intake pipe, a carbon
filter and positive pressure. It has the supplied voiceover, one-word subtitles, a
countdown timer, sound effects and music, and it ends with a twist.

- **3D**: three.js rendered frame by frame in headless Chromium (no screen
  recording). Every frame is supersampled (jittered anti-aliasing and motion blur),
  then a filmic tone map (AgX), bloom and a colour grade are applied. Everything is
  built in code:
  - procedural PBR materials: soil strata, grass, the wooden fence and porch, concrete,
    rubber, galvanised, painted and corrugated steel;
  - the sunny sky with drifting clouds, soft shadows and occluded sky light;
  - the gas, a raymarched volume of billowing 3D noise, lit by the sun with
    self-shadowing;
  - the faceless "ghost mannequin" people and the dog.
- **Sound**: every effect and the music are synthesised in `tools/audio.py`. They are
  placed on the animation's own event times, so they stay in sync. The music builds
  to 0:00 and cuts to silence just before the dog's "pfft".
- **Subtitles**: one word at a time, with the timing taken from the voice. They are
  burned in by libass (`tools/captions.py`).

## Files

| | |
|---|---|
| `bean-gas-shelter.mp4` | the reel: H.264 High, yuv420p, 1080x1920, 30 fps, AAC 48 kHz stereo, under 20 MB |
| `script.json` | the voiceover script (eight lines) and the voice settings for each engine |
| `assets/vo/n1.wav ... n8.wav` | one audio file per voice line, plus `<id>.words.json` (word timings) and `manifest.json` |
| `assets/vo/source/voiceover.mp3` | the supplied recording the lines were cut from |
| `src/` | the 3D scene: `timeline.js` (every beat, the countdown and the camera), `world.js` (layout, the dig, the gas), `main.js` (renderer), `gas.js` (the gas volume), `sky.js`, `env.js`, `shelter.js`, `people.js`, `rig.js`, `fx.js`, `overlay.js` (timer, yellow labels, measuring lines, arrows), `materials.js` |
| `render.mjs` | the frame renderer (stills or video chunks) |
| `tools/` | voices, voiceover splitter, sound, subtitles, export, QA sheet |

## Swapping the voice later

The 3D render is kept as `render/clean.mp4` (silent, no subtitles). A new voice only
rebuilds the sound and the subtitles and re-exports, so it takes a few minutes. The 3D
is not rendered again.

- **A new recording** of the whole script: all eight lines in order, with a short
  pause between lines. Run `./revoice.sh my_take.mp3`. The script cuts the recording
  at the pauses and gets the word timings by matching speech recognition onto the
  script.
- **ElevenLabs**: put `ELEVENLABS_API_KEY=your-key` in `.env` (or export it) and run
  `./revoice.sh`. It uses the voice in `script.json` → `voices.narrator.elevenlabs`
  ("Dean - steady American", a calm, deep, documentary-style male voice). If the key is
  missing or the account has no credits, the script stops and changes nothing.
- **A local voice** (no account needed): `ENGINE=kokoro ./revoice.sh`. You can also
  use `piper` or `espeak`.

Each line starts in the same slot as before. A longer take is sped up slightly, at
most 1.12x, and the script reports it. Line 7 is split: "Time's up." plays on its own
at 0:00, and the rest follows after the blast.

## Re-rendering everything

```bash
./make_reel.sh                    # full quality, about 4-5 h on 4 CPU cores (software GPU)
SCALE=0.5 SPP=1 ./make_reel.sh    # quick half-size preview -> build/preview.mp4
```

The render runs in chunks of 250 frames. Finished chunks are kept, so an interrupted
render picks up where it stopped. To check a few moments without a video, run
`tools/qa_sheet.sh "3,27.5,55" out.jpg`. It renders stills at those times, burns the
subtitles in and tiles them into one image.

Requirements:

- node with playwright (Chromium)
- ffmpeg with libass and libx264
- python 3 with numpy, scipy, soundfile and Pillow (and faster-whisper, only for local
  voices or recordings)
