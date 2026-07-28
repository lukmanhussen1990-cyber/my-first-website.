# Clawd study animation

A 10-second, 1080x1080, 30 FPS pixel-art loop of Clawd studying at a desk.

`clawd_study.mp4` is the rendered output. Everything is generated from source —
no external assets, fonts, or audio samples.

## Regenerating

```
pip install numpy pillow imageio-ffmpeg
python3 audio.py                 # writes audio.wav
python3 render.py clawd_study.mp4
python3 render.py --preview      # dump key frames as PNGs instead
```

## How it works

The scene is drawn on a 216x216 pixel grid and upscaled 5x with nearest-neighbour
sampling, so every drawn pixel stays a crisp square block. Clawd's proportions come
straight from the reference art: a 20x20-unit body, side arm nubs spanning 25-50%
of the body height, two 3x3-unit square eyes, and four legs with a wider middle gap.

`font.py` is a hand-built 3x5 bitmap font used for the headband and the closing line.

Timing is chosen so the loop is seamless: rain streaks, dust drift, breathing, the
beat-locked nod and the camera push/pull all complete a whole number of cycles in
300 frames, and the audio has a 40 ms wrap crossfade at the loop point.
