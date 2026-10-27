# Tornado shelter reel

A vertical Instagram Reel (1080x1920, 30 fps, 81.5 s), made only with code: a realistic
3D explainer of a worker building an underground tornado shelter step by step while a
huge tornado comes closer. It has a voiceover, one-word subtitles, sound effects and
music.

- **3D**: three.js rendered frame by frame in headless Chromium (no screen
  recording). Every frame is supersampled (jittered anti-aliasing and motion blur),
  then a filmic tone map, bloom and a colour grade are applied. Everything is built in
  code: the procedural PBR materials (soil strata with roots, stones and cracks;
  concrete with aggregate and rebar in the cut; galvanised and painted steel;
  corrugated metal; wood), the raymarched cumulus sky with the storm deck, the
  tornado funnel with its debris, and the faceless "ghost mannequin" people.
- **Sound**: every effect, the wind, the tornado's roar and the music are synthesised
  in `tools/audio.py`. They are placed on the animation's own event times, so they
  stay in sync.
- **Subtitles**: one word at a time, with the timing taken from the voice. They are
  burned in by libass (`tools/captions.py`).

## Files

| | |
|---|---|
| `tornado-shelter.mp4` | the reel: H.264 High, yuv420p, 1080x1920, 30 fps, AAC 48 kHz stereo |
| `script.json` | the voiceover script (ten lines) and the voice settings for each engine |
| `assets/vo/n1.wav ... n10.wav` | one audio file per voice line, plus `<id>.words.json` (word timings) and `manifest.json` |
| `assets/vo/source/voiceover.mp3` | the supplied recording the lines were cut from |
| `src/` | the 3D scene: `timeline.js` (every beat and the camera), `world.js` (layout, weather, the tornado's path), `main.js` (renderer), `sky.js`, `env.js`, `shelter.js`, `people.js`, `rig.js`, `fx.js`, `overlay.js` (yellow labels, measuring lines, arrows), `materials.js` |
| `render.mjs` | the frame renderer (stills or video chunks) |
| `tools/` | voices, voiceover splitter, sound, subtitles, export, QA sheet |

## Swapping in the ElevenLabs voice later

The 3D render is kept as `render/clean.mp4` (silent, no subtitles). A new voice only
rebuilds the sound and the subtitles and re-exports, so it takes about two minutes.
The 3D is not rendered again:

```bash
cd tornado-shelter-reel
echo "ELEVENLABS_API_KEY=your-key" > .env     # or: export ELEVENLABS_API_KEY=your-key
./revoice.sh
```

`revoice.sh` does five things:

1. It voices all ten lines with ElevenLabs. It uses the voice in
   `script.json` → `voices.narrator.elevenlabs`: "Dean - steady American" (a calm,
   deep, documentary-style male voice) on `eleven_multilingual_v2`. To use a different
   voice, change the `voice_id` there.
2. It saves each line as its own file, with exact word timings from the API, in
   `assets/vo/`. The previous files are kept in `assets/vo/previous/`.
3. It rebuilds the mix. Each line starts in the same slot as before. A longer take is
   sped up slightly, at most 1.12x, and the script reports it.
4. It rebuilds the subtitles from the new word timings.
5. It exports `tornado-shelter.mp4`.

If the key is missing or the account has no credits, the script stops and changes
nothing.

Other ways to swap the voice:

- **A new recording** of the whole script: all ten lines in order, with a short pause
  between lines. Run `./revoice.sh my_take.mp3`. The script cuts the recording at the
  pauses and gets the word timings by matching speech recognition onto the script.
- **A local voice** (no account needed): `ENGINE=kokoro ./revoice.sh`. You can also use
  `piper` or `espeak`.

## Re-rendering everything

```bash
./make_reel.sh                    # full quality, about 4 h on 4 CPU cores (software GPU)
SCALE=0.5 SPP=1 ./make_reel.sh    # quick half-size preview -> build/preview.mp4
```

The render runs in chunks of 250 frames. Finished chunks are kept, so an interrupted
render picks up where it stopped. To check a few moments without a video, run
`tools/qa_sheet.sh "3,27.5,66" out.jpg`. It renders stills at those times, burns the
subtitles in and tiles them into one image.

Requirements:

- node with playwright (Chromium)
- ffmpeg with libass and libx264
- python 3 with numpy, scipy, soundfile and Pillow (and faster-whisper, only for local
  voices or recordings)
