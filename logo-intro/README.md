# Sora animated opening logo

`sora-intro.mp4`: an 8-second 1920×1080, 60 fps H.264 intro with a synthesized soundtrack (AAC, about −14 LUFS).

## Timeline

| Time | Picture | Sound |
|---|---|---|
| 0.0 – 1.5 s | Fade in, fly through the starfield, sparks spiral into a glowing core | Air bed, rising riser |
| 1.5 s | Flash, shockwave rings, anamorphic streak, spark burst. The cloud pops out with squash and stretch | Sub drop, punch, cute "pop" |
| 2.0 – 2.3 s | Eyes open and the sparkles twinkle in | Two bell tings |
| 2.6 – 3.4 s | Cloud glides left into place. "Sora" rises in letter by letter, from blurred to sharp, while the eyes glance at it | Whoosh, four-note pluck arpeggio |
| 4.0 – 4.8 s | A light sweep passes across the logo, and a star glint flares on the cloud | Shimmer, glint ting |
| 5.45 s | The cloud blinks | Soft blip |
| 7.25 – 8.0 s | Fade to black | Pad fades out |

The last held frame matches the layout of the source image `sora-logo.jpg`.

## Re-rendering

```bash
pip install numpy scipy pillow imageio-ffmpeg
python3 make_intro.py                 # writes sora-intro.mp4 (about 2 min on 4 cores)
python3 make_intro.py --stills 1.6 4  # preview PNG frames at those times
```

- `extract.py` pulls the cloud, eyes, sparkles and letters out of the JPEG as signed distance fields. They stay sharp at any scale and can be animated separately.
- `make_intro.py` holds the animation timeline and renderer. Edit the `T_*` constants at the top to retime it.
- `sound.py` synthesizes the audio, locked to the same cue times.
