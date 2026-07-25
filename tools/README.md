# tools

How the animation was built. Both scripts want `pillow`, `numpy`, `scipy`
and `imageio-ffmpeg`, and expect to be run from this directory.

* `build_layers.py` — cuts `assets/scp-3143-original.jpg` into the six layers
  in `assets/layers/`. It flood-fills the drawing's flat colour regions,
  groups them into head / hand / sleeve / coat, absorbs the ink outlines
  around each group, then paints out the holes the moving parts leave behind.
* `motion.py` — the pose model (head, hand, blink, smoke cycle). `app.js`
  carries the same numbers, which is why the page and the video match.
* `render_video.py` — analyses the track for beats, composites every frame
  and pipes it through ffmpeg to `murphy-law.mp4`.
  `FPS=30 DUR=10 START=45 OUT=clip.mp4 python3 render_video.py` renders an excerpt.
