# Video text replacement

`claude_imran_fable51.mp4` is the source clip with its baked-in on-screen text replaced.

## What changed

| | before | after |
|---|---|---|
| greeting | `Good morning, Elon` | `Good morning, Imran` |
| model chip | `Sonnet 4.6 Adapative` | `Fable 5.1 Adaptive` |

The `Adapative` → `Adaptive` spelling fix came for free, since that label was being
re-rendered anyway.

Everything else is untouched: same 345 frames at 30 fps (11.50 s), same 1276×718
framing, same animation, and the original audio stream is copied through rather than
re-encoded.

## How it works

The text is burned into the pixels under a moving camera, so it can't be edited
directly. The pipeline:

1. **Track** (`match.py`, `track_global.py`) — recover the camera's scale and
   translation per frame, expressed in the coordinates of reference frame 0144.
   Several small templates are matched independently each frame and the
   highest-scoring consistent group wins, which is what stops `Elon` from being
   confused with `morning` on the frames where it slides off the edge of the screen.

   Note that plain `TM_CCOEFF_NORMED` scores ~1.0 on flat regions, so naive
   multi-scale search locks onto black background; `ncc_floored` clamps the local
   image energy from below to prevent that.

2. **Clean the trajectory** (`traj.py`) — reject outliers, detect the two shot cuts
   (frames 89 and 106) and never interpolate across them. The greeting's entrance is a
   very fast push-in (scale 0.35 → 0.91 in four frames), so smoothing is applied only
   where the camera is moving slowly. `extend.py` plus `traj_extra.json` cover the
   fade-out tail, where the tracker loses confidence but the text is still legible.

3. **Calibrate** (`calib*.py`) — fit glyph size, width and softness by rendering the
   *original* strings with the replacement fonts and scoring them against the real
   pixels. A least-squares fit over-blurs here (blur hides the residual difference
   between our font and the original), so the final parameters match peak brightness
   and edge-gradient energy instead.

4. **Replace** (`render.py`, `process.py`) — per frame, measure how bright and how
   blurred the original text is, inpaint it away, then rasterise and composite the new
   string to match. Blur is fitted separately in x and y, plus a horizontal box kernel,
   because the whip transition around frames 132–137 smears the frame horizontally and
   an isotropic Gaussian cannot represent that.

Fonts are Source Serif Pro (greeting) and Source Sans Pro (chip) — the closest
available stand-ins for the originals, horizontally condensed to match the source's
proportions.

## Reproducing

Needs `opencv-python-headless`, `numpy`, `pillow`, `font-source-serif-pro`,
`font-source-sans-pro`, and ffmpeg. Explode the source to `all/%04d.png`, then:

```sh
python3 track_global.py     # ~5 min, writes global.json (included, so this is optional)
python3 process.py          # writes out/%04d.png
ffmpeg -framerate 30 -i out/%04d.png -i SOURCE.mp4 \
       -map 0:v -map 1:a -c:v libx264 -preset slow -crf 17 -pix_fmt yuv420p \
       -c:a copy -shortest claude_imran_fable51.mp4
```

`check_match.py` reports how closely the replacement matches the original's brightness
and sharpness; `preview.py <frames>` renders before/after comparisons.

## Known limitation

On frame 172 the greeting has faded to roughly 4% contrast on its way to black, and
can no longer be localised reliably, so it is left untouched — a residual ghost of the
old text is technically present there for that single frame (1/30 s). It is not
perceptible at normal playback brightness. Frames 64–171 are all replaced.
