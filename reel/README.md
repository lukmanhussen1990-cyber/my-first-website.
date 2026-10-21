# John's Shopping Cart Race Car (vertical reel)

A 56-second, 1080×1920, 30 fps 3D animated reel. Everything is made in code:

- **3D**: Three.js, rendered frame by frame in headless Chromium (no screen recording).
- **Voice**: the narration, one audio file per line.
- **Subtitles**: burned in, one word at a time, synced to the voice.
- **Sound effects**: all synthesized with NumPy. There is no music.

Final video: `output/shopping_cart_race_car.mp4` (H.264 + AAC, 1080×1920, 30 fps).

## Files

| Path | What it is |
| --- | --- |
| `script.json` | The voice script (7 lines), voice settings, scene timings, and where each sentence lands in the video |
| `voice/script.txt` | The same script as plain text |
| `voice/line01.wav` … `line07.wav` (+ `.mp3`) | One file per voice line |
| `voice/timings.json` | Per-word start/end times for each line (drives subtitle timing) |
| `audio/sfx.flac` | The synthesized sound-effects stem (no voice) |
| `audio/mix.wav` | Final mix: voice and ducked sound effects, at -14 LUFS |
| `audio/events.json`, `audio/tracks.json` | Animation event times and per-frame speeds used to time the sound effects |
| `output/scene_clean.mp4` | The 3D render only (no subtitles, no audio). The voice swap reuses it |
| `output/subtitles.ass` | Word-by-word subtitles and the `garden_reels` watermark |
| `scene/` | The Three.js scene: world, cart, characters, effects, timeline/camera, post-processing |
| `tools/render.mjs` | Frame-by-frame renderer |
| `tools/make_voice.py` | Makes the voice: ElevenLabs → local Kokoro → espeak-ng |
| `tools/sfx.py` | Synthesizes all the sound effects |
| `tools/assemble.py` | Mixes the audio, builds the subtitles, exports the MP4 (no 3D re-render) |
| `remake_voice.sh` | One command to swap in the ElevenLabs voice |

## Swapping in the ElevenLabs voice later

This first version uses a local neural voice (Kokoro `af_heart`), because the ElevenLabs account had 0 credits when it was made.

To switch to ElevenLabs:

```bash
cd reel
export ELEVENLABS_API_KEY=your_key_here   # or put ELEVENLABS_API_KEY=... in reel/.env
./remake_voice.sh
```

The command does three things:

1. Calls ElevenLabs once per line, using the `/with-timestamps` endpoint. That gives exact per-word timings, so the subtitles stay in sync.
2. Writes the new `voice/lineNN.wav`/`.mp3` and `voice/timings.json`. The old voice is only replaced once every line has succeeded.
3. Re-mixes the audio, rebuilds the word-by-word subtitles with the new timing, and re-exports `output/shopping_cart_race_car.mp4` from `output/scene_clean.mp4`. The 3D is not re-rendered.

The voice is set in `script.json → voice.elevenlabs_voice_id`. It is currently "Holden – Warm Midwest Narrator", and you can change the ID to any voice in your ElevenLabs library. If the new voice reads faster or slower, nothing breaks: each line is split at its sentence break and each half is placed at its moment in the video ("So you tighten the loose wheel" lands when the wrench appears, and so on).

Requirements: Python 3, `ffmpeg` with libass (most builds have it). The script creates `.venv` and installs `requirements.txt` on its first run. Running `./remake_voice.sh kokoro` uses the local voice instead.

## Re-rendering the 3D (only if you change the scene)

```bash
cd reel && npm install
node tools/render.mjs stills --times 3,10,18 --scale 0.5    # quick previews in render/stills
node tools/render.mjs events                                # re-export event times for the sound effects
node tools/render.mjs frames --from 0 --to 1680             # full render, resumable (~2 h on 4 CPU cores)
python3 tools/sfx.py && python3 tools/assemble.py
```

Font: Fredoka (SIL Open Font License, `fonts/OFL.txt`).
