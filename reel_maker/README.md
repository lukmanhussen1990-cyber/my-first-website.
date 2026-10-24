# Stickman reel maker

Hand-drawn stickman Instagram Reels in the style of the reference video
(see `STYLE_NOTES.md`). Output of this project: **`30_days_no_reels.mp4`**:
1080x1920, 30 fps, H.264 + AAC, 35.3 s, watermark `@psych.sketches`.

Everything is generated locally: voice (Kokoro TTS), word timestamps (whisper
+ the TTS model's own phoneme timings), drawings, captions, music and sound
effects.

## Make your next video
Edit the config blocks at the top of `make_reel.py`, then run it:

1. `SCRIPT` — the sentences (narrated exactly) and the pause after each.
2. `CAPTION_KEYWORDS` — words shown in yellow with the drawn underline.
3. `VOICE` — Kokoro voice and speed; `WATERMARK` — your handle.
4. `SCENES` — one `scene("line", ...)` per beat. It starts when that line is
   spoken. Inside it:
   - `actor`, `act`, `walk`, `motion` drive the stickmen (poses, faces, movement).
   - `add`, `tween`, `remove`, `label` handle props.
   - Times are given as `"@word"`, `"@word+0.3"`, `"end-0.2"`, or seconds.

   Available poses, faces and props are listed above the plan.

```bash
python make_reel.py                          # voice -> timestamps -> audio -> video
python make_reel.py preview --scenes 1 5 10  # stills + side-by-side with the reference in build/previews/
python make_reel.py preview --at 12.5        # a still at any time
```
Voice and timestamps are cached in `build/` and only regenerated when the
script or voice settings change. A full render takes ~15 s on 4 cores.

## Setup (once)
- System: `ffmpeg` and `espeak-ng`.
  - macOS: `brew install ffmpeg espeak-ng`
  - Ubuntu/Debian: `sudo apt install ffmpeg espeak-ng`
  - Windows: install ffmpeg plus the espeak-ng `.msi` from its GitHub releases.
- Python: `pip install -r requirements.txt`
- Models: `python setup_models.py`. This downloads Kokoro-82M v1.0 (ONNX) and
  the voices into `models/`. faster-whisper downloads its own model on first
  run. For the best homograph pronunciation, also run
  `python -m spacy download en_core_web_sm`.

## Notes
- **Voice.** Kokoro-82M (the same weights as `pip install kokoro`) runs through
  onnxruntime, so it works on any Python version without PyTorch.
  `voice_tests/` holds the four candidates (am_michael, am_adam, am_fenrir,
  bm_george). am_michael was the closest match to the reference narrator: deep,
  calm, and best understood by whisper.
- **Timing.** whisper transcribes the finished `voice.wav` and must hear every
  word. Caption and scene timing come from Kokoro's own phoneme durations,
  which measured within about ±30 ms of the audio here. whisper-base drifted up
  to 0.55 s around pauses. Switch with `WHISPER["timing"]`.
- **Captions.** `CAPTION_HIGHLIGHT = "keyword"` gives one yellow key word per
  chunk. `"active"` instead gives the reference's behaviour, where yellow
  follows the spoken word.
- **Licences.** Kalam font: SIL OFL (`assets/fonts/Kalam-OFL.txt`).
  Kokoro: Apache-2.0. whisper: MIT.
