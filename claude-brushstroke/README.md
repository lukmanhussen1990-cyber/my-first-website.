# Claude brush-stroke animation

`claude-brushstroke.mp4` is a 10-second animation (1360x1080, 60 fps, H.264) that paints the
Claude illustration with a simulated bristle brush:

1. the starburst flicks out ray by ray and the wordmark is dry-brushed in,
2. the camera drops to the balloon, which is swirled on with a splash of paint droplets,
3. the string, the bow, four finger flicks and finally the long profile line are drawn stroke by stroke
   (the brush slows in curves and flicks off at the end) while the camera follows the brush,
4. the camera pulls back to the original framing and the balloon settles.

The last frame matches the original artwork (`source.jpg`). `poster.jpg` is that finished frame,
handy as a poster image because the first frame of the video is blank paper.

## Use it on a page

```html
<video src="claude-brushstroke/claude-brushstroke.mp4" poster="claude-brushstroke/poster.jpg"
       autoplay muted loop playsinline></video>
```

## Re-render or re-time it

`make_animation.py` rebuilds the video from `source.jpg`: it separates the orange paint and black ink,
skeletonises the line art into brush paths, then replays them with a bristle-brush model.

```bash
pip install numpy scipy scikit-image opencv-python-headless   # plus ffmpeg with libx264
python3 make_animation.py                       # -> claude-brushstroke.mp4 (about a minute on 4 cores)
python3 make_animation.py --stills 1.0 4.5 8.0  # PNG stills in ./stills for quick review
python3 make_animation.py --debug               # draw the brush paths over the artwork
```

Timing and camera moves are plain tables near the top of the script (`TL` for when each stroke is
painted, `CAM_KEYS` for the camera path). Output size and frame rate are `OUT_W`, `OUT_H` and `FPS`.
