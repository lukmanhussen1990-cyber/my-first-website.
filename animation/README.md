# Summer-night loop

`summer_night_loop.mp4` is a 30-second seamless loop (936x1664, 9:16, 30 fps, H.264) animated from `source.png`.

It is a procedural cinemagraph: the original pixels are only gently warped and relit, never regenerated or upscaled. Every motion completes a whole number of cycles in 30 s, so frame 900 is identical to frame 0.

- Girl: blinks, breathes, tilts her head slightly; her hair and ribbon sway
- Boy: blinks, breathes; his hair, tie, shirt and jacket move
- Grass and flowers sway in a travelling breeze, and the tree leaves stir
- Clouds drift slowly, stars twinkle and town lights flicker
- Fireflies drift along closed paths, and two faint shooting stars cross the sky
- The camera floats with depth parallax, and film grain moves over the frame

Re-render:

```
pip install numpy opencv-python-headless imageio-ffmpeg
python3 render_loop.py source.png summer_night_loop.mp4
```
