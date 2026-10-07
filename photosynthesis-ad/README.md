# Powered by Sunlight — a 25-second photosynthesis ad

**Created by IMRAN**

`output/powered-by-sunlight.mp4`: 1920×1080 (16:9), 30 fps, exactly 25.000 s, H.264 + AAC 48 kHz stereo, −16 LUFS.

| Time | Scene | On-screen text |
|---|---|---|
| 0–3 s | A golden dot grows into a sun; one curved ray reaches toward a leaf, which turns to the light | Can sunlight become food? |
| 3–7 s | The camera follows the ray; green soaks through the leaf and its veins draw themselves | It starts with a leaf. |
| 7–11 s | The stem grows into a plant with roots; water rises from the soil, CO₂ drifts into the leaf | Water + carbon dioxide |
| 11–16 s | Dive through a lens into a chloroplast: light pulses, water + CO₂ → sugar, O₂ released | Sunlight powers the process. |
| 16–21 s | Pull back: new leaves unfold, sugar travels the stem, O₂ bubbles rise, a garden draws in | Food for growth. Oxygen for the air. |
| 21–25 s | The garden's outlines flow into a leaf-and-sun emblem; end card holds still from 22–25 s | PHOTOSYNTHESIS / Powered by sunlight. / Created by IMRAN |

## How it is made

Everything is generated from code: no stock footage, samples or AI video.

- **Animation** (`src/`): a deterministic Canvas 2D renderer (`renderFrame(t)`) with a world-space camera, hand-wobbled ink paths that draw themselves, offset colour fills, morphs, and a **separate text layer** canvas, so all typography is real type with exact spelling. Fonts are Fraunces and DM Sans (SIL OFL, licences in `src/fonts/`).
- **Voiceover** (`tools/vo.py`): Kokoro-82M neural TTS (Apache-2.0), voice `af_heart`, one clip per phrase placed on the timeline.
- **Music & sound design** (`tools/audio.py`): an original 120 BPM piece in F major (marimba, celesta, plucked bass, pad, shaker), synthesised in NumPy. It resolves on F major at 22 s. Effects (pen strokes, droplets, rustles, bubbles, chimes) are triggered from the animation's cue list, and the music ducks under the voice.

## Rebuild

```bash
# frames (Playwright + Chromium)
node tools/capture.cjs cues  build/cues.json
node tools/capture.cjs frames build/frames            # 750 PNGs
node tools/capture.cjs text   build/text              # optional: text layer only, transparent PNGs
# voice + audio (Python: kokoro-onnx, numpy, scipy, soundfile)
python tools/vo.py <kokoro_dir> build/vo
python tools/audio.py build/cues.json build/vo build/mix.wav
# encode
ffmpeg -framerate 30 -i build/frames/f%05d.png -i build/mix.wav -c:v libx264 -crf 16 -pix_fmt yuv420p \
  -c:a aac -b:a 256k -af loudnorm=I=-16:TP=-1.5 -t 25 -movflags +faststart output/powered-by-sunlight.mp4
```

Preview in a browser: serve `src/` over HTTP and open `index.html?play`.
