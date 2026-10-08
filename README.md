# my-first-website.

## Leaf branch animation

`leaf-animation/` contains a hand-drawn style leaf branch (black ink, red veins and berries)
that draws itself on screen, unfurls its leaves, pops its berries and sways in a light breeze.

- `leaf-animation/leaf-animated.mp4` – the rendered clip (1920x1080, 60 fps, 9 s, H.264).
- `leaf-animation/leaf.html` – the animation itself. Open it in any browser and it plays on a loop;
  it is plain SVG + JavaScript, so it can be embedded in a page as-is.
- `leaf-animation/render.mjs` – renders the HTML to MP4 frame by frame with headless Chromium
  and ffmpeg.

Re-render the video:

```sh
cd leaf-animation
npm install          # installs playwright
npx playwright install chromium
npm run render       # writes leaf-animated.mp4
```
