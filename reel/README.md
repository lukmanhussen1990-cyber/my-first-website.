# "Stop for 1 day" — Instagram Reel

A vertical cartoon explainer (1080x1920, 30 fps, H.264 + AAC) drawn entirely in
code: every frame is made with Pillow + numpy and piped into ffmpeg.

- `out/reel.mp4` — the finished video
- `assets/voiceover.mp3` — the voiceover; the scenes are timed to it
- `data/words_asr.json` — word timings of the voiceover (from `align.py`)

## Re-render

```
pip install pillow numpy
python3 render.py --handle @yourhandle      # -> out/reel.mp4, ~4 min on 4 cores
python3 render.py --sheet 1.0 5.4 13.9      # quick contact sheet of single frames
```

Needs ffmpeg and the Inter font (`/usr/share/fonts/opentype/inter/`).

## How it fits together

| file | what it does |
| --- | --- |
| `timeline.py` | scene cut times, caption chunks (`*word*` = yellow), lip-sync, bounce, blinks |
| `scenes.py` | the 8 scenes, circle-wipe transitions, captions + watermark overlay |
| `character.py` | the bean guy: expressions, blinking, IK arms, crown |
| `props.py` | clock, mirror, wave, hourglass, phone + lock, bed, meter, calendar, heart... |
| `gfx.py` | tiny vector layer over Pillow (transforms, shapes, text), 2x supersampled |
| `audio.py` | lo-fi loop synthesized in numpy; ducked mix, loudness-normalized to -14 LUFS |
| `align.py` | word timestamps for a new voiceover (Parakeet-TDT via sherpa-onnx) |
| `verify.py` | checks the MP4: captions vs. the words heard, loudness, edge clipping |

## Swapping the voiceover

1. Replace `assets/voiceover.mp3`.
2. `python3 align.py <parakeet model dir>` to refresh `data/words_asr.json`.
3. Move the scene start times in `timeline.SCENES` into the new pauses, and
   the per-scene animation times in `scenes.py` to the new word times
   (`python3 timeline.py` prints every caption with its start/end).
