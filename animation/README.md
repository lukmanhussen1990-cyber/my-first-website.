# Summer-night loop

`summer_night_loop.mp4` is a 30-second seamless loop (936x1664, 9:16, 30 fps, H.264) animated from `source.png`.

The two characters are cut out with a matte, `character_matte.png`, and move as their own layer. The strip of background they uncover is rebuilt from the surrounding scenery. The original pixels are warped and relit, never regenerated or upscaled. Every motion completes a whole number of cycles in 30 s, so frame 900 is identical to frame 0.

- Girl: gently rocks and breathes. Her head tilts and nods while she looks up at the boy, and she blinks. Her long hair streams and ripples downwind, and her ribbon and top hair flutter.
- Boy: shifts his weight and breathes. His head tilts slightly and he blinks. His hair tufts, tie, shirt and hanging jacket move in the gusts.
- Wind: four gusts of different strength sweep right to left. They reach the tree first, then the boy, the girl and the meadow.
  - The grass leans, waves and flutters, and a moonlit sheen runs across it.
  - Branches sway and the leaves shiver.
  - Seed fluff, daisy petals and leaves blow past, speeding up in each gust.
- Sky and scenery: clouds drift slowly, stars twinkle, town lights flicker, fireflies wander and two faint shooting stars cross the sky.
- Camera: floats gently with depth parallax, and film grain moves over the frame.

Re-render:

```
pip install numpy scipy opencv-python-headless imageio-ffmpeg
python3 render_loop.py source.png character_matte.png summer_night_loop.mp4
```

`make_matte.py` rebuilds `character_matte.png` with the isnet-anime segmentation model. Instructions are in its docstring. You only need it if the source image changes.
