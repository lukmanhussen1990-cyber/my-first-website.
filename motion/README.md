# Logo motion graphic (40 s)

`logo-motion-40s.mp4`: a 1920×1080, 60 fps H.264 + AAC reveal of the logo.
Everything is generated procedurally from the logo's exact vector geometry.

| Time | Beat |
|---|---|
| 0–2 s | Darkness, drifting dust, light gathers at the central node |
| 2 s | Ignition: a point of light flares with an anamorphic streak and a ring |
| 2.3–7.5 s | Light beams draw the mark's skeleton outward from the node |
| 7.4–14.6 s | Data pulses run the skeleton, construction guides (42.5° / 45°) draw in, the outline is laser-traced |
| 14.6–17 s | Energy build-up: particles spiral inward, a riser, a brief breath |
| 17 s | Impact: the solid mark slams in with a flash, shockwave, sparks and god rays |
| 17–23 s | The mark settles with volumetric light through its counters and a glint sweep |
| 23–33 s | The mark gains depth: camera orbit, a 360° spin, a glossy floor reflection |
| 33–40 s | Hero lockup, final glint and sting, fade to black |

## Rebuild

```bash
pip install numpy opencv-python-headless scipy pillow
python3 render.py --out build/video.mp4        # picture (about 8 min on 4 cores)
python3 audio.py build/audio.wav               # soundtrack
ffmpeg -i build/video.mp4 -i build/audio.wav -c:v copy -c:a aac -b:a 256k \
       -shortest -movflags +faststart logo-motion-40s.mp4
```

`python3 render.py --stills 3 12 17.1 35` renders preview frames into `build/stills/`.
Timings live in `timeline.py`, which both the picture and the sound read.
