# my-first-website.

## Newton and the Apple

A short animation: Isaac Newton sits reading beneath an apple tree at golden
hour, an apple works loose, falls, strikes his head, and the idea arrives.

**Output:** `build/newton_apple.mp4` — 1920×1080, 30 fps, 9 seconds, H.264.

### Rendering it

Everything is drawn procedurally with Pillow — there are no image assets. The
script renders each frame at 2× supersampling, downsamples with Lanczos, adds
a warm grade plus film grain, and encodes with ffmpeg.

```sh
pip install pillow numpy imageio-ffmpeg
python3 render_newton.py
```

Frames land in `build/frames/`, the encoded video in `build/newton_apple.mp4`.

To iterate on a single moment without rendering the whole thing:

```sh
python3 render_newton.py --peeks 20,88,255      # stills to build/peek_NNNN.png
```

### How it is put together

| Part | Where |
| --- | --- |
| Sky, sun bloom, clouds, hills, meadow | `build_sky` … `build_meadow` |
| Tree trunk, limbs, leaf canopy | `build_tree`, `build_canopy` |
| Newton: body, arms, legs, hands, head | `draw_body`, `draw_near_arm`, `draw_head` |
| Apple shading and the fall | `draw_apple`, `simulate_bounce` |
| Impact stars, rings, flash | `draw_impact` |
| Every pose value for a given time | `state_at` |

Static layers (background, canopy, grass, vignette) are built once and reused
across all 270 frames; only the figure, apple and effects are redrawn.

### Timing

Key beats live as constants at the top of the script:

- `T_STRESS` 1.55 s — the stem starts to give, the apple trembles
- `T_DROP` 2.30 s — it lets go
- `T_FALL` 0.55 s — free fall, distance growing with the square of time
- `T_HIT` 2.85 s — impact, head jolt, wig lag, stars
- `T_IDEA` 6.30 s — the realisation, and the law fades in

The motion is built to read as weight rather than as keyframes: the head is
driven down on impact and springs back with a decaying oscillation, the wig
follows a beat later, breathing and blinks run underneath the whole shot.
