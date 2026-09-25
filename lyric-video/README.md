# Hand-painted lyric video

A 36-second, silent, 720×1280 (30 fps) lyric video in which everything is
painted by code. Backgrounds, drawings and letters are all procedural brush
strokes: rough black outlines, uneven dry-brush paint, speckles and a line
"boil" that redraws every 3 frames. No footage, images, fonts, AI assets or
music are used. The lettering uses a single-stroke font written in
`lyric_video.py`.

The 720×540 illustration panel sits vertically centred, with black above and
below.

## Generate the video

```bash
pip install -r requirements.txt && python lyric_video.py
```

This writes `lyric_video.mp4` (H.264, yuv420p, BT.709, no audio track) in
about 20 seconds on 4 cores. `imageio-ffmpeg` supplies an ffmpeg binary. To
use your own, set `FFMPEG=/path/to/ffmpeg`.

Options:

| flag | what it does |
|------|--------------|
| `--out FILE.mp4` | output path |
| `--still 12.5` | render just the frame at 12.5 s as a PNG |
| `--sheet` | render a contact sheet PNG with one frame per scene |
| `--jobs N` | number of worker processes |

## Editing lyrics and timings

All text and timing lives in the `SCENES` list at the top of
`lyric_video.py`. Replace the `[LINE n]` / `[CREDIT]` placeholders with your
words. Each block word-wraps and scales itself to fit its box.

```python
{   "start": 10.0, "art": "skyline", "bg": "peach",
    "text": [
        {"text": "[LINE 8]",  "box": (18, 18, 440, 80), "highlight": "cream", "align": "left"},
        {"text": "[LINE 9]",  "box": (18, 104, 330, 62), "at": 0.9, "highlight": "cream"},
        {"text": "[LINE 10]", "box": (20, 426, 680, 104), "at": 2.0, "style": "paint", "ink": "cream"},
    ],
},
```

* `start`: the scene's hard-cut time in seconds. It runs until the next scene.
* `at` / `until`: when a block pops on and off, in seconds after the cut.
* `draw`: letter the block on stroke by stroke over this many seconds.
* `draw_on: (start, dur)` on a scene: the illustration draws itself on.
* `style`: `marker` (ink on a highlight blob), `paint`, or `outline`.
* Colours are names from `PALETTE`: cream, peach, pink, red, slate, blue,
  plus light and dark variants.
* `box` is `(x, y, width, height)` in panel pixels (720×540).

Current timeline: rearview mirror (0 s) → ID card (4.2 s) → big word
(8.4 s) → skyline (10 s) → two people at sunset (14.4 s) → paper plane
(19 s) → cardboard box (23.2 s) → sleepy face (27.6 s) → credit (33.6 s).

The illustrations are the functions under `# --- illustrations` in the
script, built from `A.shape`, `A.stroke`, `A.fill` and similar helpers. Add a
new one with `@art("name")` and refer to it from a scene.
