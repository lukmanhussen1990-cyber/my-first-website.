# Stickman reel maker

Hand-drawn stickman Instagram Reels in the style of the reference video
(see `STYLE_NOTES.md`). Everything is generated locally: voice (Kokoro TTS),
word timestamps (whisper plus the TTS model's own phoneme timings), drawings,
captions, music and sound effects. Every video carries the `@psych.sketches`
watermark.

| video | config file | output |
|---|---|---|
| What 30 days without Reels does to your brain | `thirty_days_no_reels.py` | `30_days_no_reels.mp4` (35.3 s) |
| The Spotlight Effect | `spotlight_effect.py` | `spotlight_effect.mp4` (37.2 s) |

Each `*_caption.txt` holds a ready-to-paste post caption and hashtags.

## Make your next video
Each video is one file: config at the top, the same two-line `main` at the
bottom. Copy one (e.g. `spotlight_effect.py` → `my_next_video.py`) and edit:

1. **Script and captions**
   - `OUTPUT`: the file to write.
   - `SCRIPT`: the sentences (narrated exactly) and the pause after each.
   - `CAPTION_KEYWORDS`: words shown in yellow with the drawn underline.
   - `WATERMARK`: your handle on every frame.
2. **Voice**
   - `VOICE`: Kokoro voice and speed.
   - `PRONUNCIATIONS`: phonemes for words you want said differently.
3. **Scenes**
   - `SCENES`: one `scene("line", ...)` per beat. It starts when that line
     is spoken; put `CUT` first to cross-fade to a new set-up.
   - Characters: `actor`, `act`, `walk`, `motion`.
   - Props: `add`, `tween`, `remove`, `label`.
   - Effects: `camera` (zoom / pull-back) and `sfx`.
   - Times are `"@word"`, `"@word+0.3"`, `"@word.end"`, `"end-0.2"` or seconds.

   The lists of poses, faces, motions and props are written above each plan.
4. **Ending**: `FINALE` fades everything except a caption word, and optionally
   chosen actors and props.

```bash
python spotlight_effect.py voicetest                   # 4 candidate voices vs the reference narrator
python spotlight_effect.py                             # voice -> timestamps -> audio -> video
python spotlight_effect.py preview --scenes 1 8 10 12  # stills + side-by-side with reference frames
python spotlight_effect.py preview --at 12.5           # a still at any moment
```
Caches live in `build/<video>/`. Voice and timestamps are only regenerated
when the script or voice settings change. A full render takes about 20 s on
4 cores.

## Setup (once)
- **System:** `ffmpeg` and `espeak-ng`.
  - macOS: `brew install ffmpeg espeak-ng`
  - Ubuntu/Debian: `sudo apt install ffmpeg espeak-ng`
  - Windows: install ffmpeg, then the espeak-ng `.msi` from its GitHub releases.
- **Python:** `pip install -r requirements.txt`. Add `librosa` to get the pitch
  and timbre comparison in `voicetest`.
- **Models:** `python setup_models.py` downloads Kokoro-82M v1.0 (ONNX) and the
  voices into `models/`. faster-whisper downloads its own model on first run.
  For the best homograph pronunciation, also run
  `python -m spacy download en_core_web_sm`.

## Notes
- **Voice.** Kokoro-82M (the same weights as `pip install kokoro`) runs
  through onnxruntime, so it works on any Python version without PyTorch.
  On both scripts, am_michael was the closest of am_michael / am_adam /
  am_fenrir / bm_george to the reference narrator.
- **Timing.** whisper transcribes the finished `voice.wav` and must hear every
  word; it heard 86/86 words for the Spotlight video. Caption and scene timing
  come from Kokoro's own phoneme durations: measured, words light up on their
  exact frame (±1). whisper-base drifted up to 0.6 s around pauses. Switch
  with `WHISPER["timing"]`.
- **Captions.** `CAPTION_HIGHLIGHT = "keyword"` gives one yellow key word per
  chunk. `"active"` instead gives the reference's behaviour, where yellow
  follows the spoken word.
- **Licences.** Kalam font: SIL OFL (`assets/fonts/Kalam-OFL.txt`).
  Kokoro: Apache-2.0. whisper: MIT.
