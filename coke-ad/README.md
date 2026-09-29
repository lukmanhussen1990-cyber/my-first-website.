# "Feel the Fizz": 40-second Coca-Cola spec ad (fan-made)

This is a photoreal CG product film made entirely from code. There is no stock footage, no downloaded textures or HDRIs, and no samples.

- **Deliverable:** `coca-cola-spec-ad-40s.mp4` is 1920x1080, 24 fps, 40.0 s, H.264 High with AAC stereo.
- **Disclaimer:** this is a fan-made spec ad. It is not affiliated with or endorsed by The Coca-Cola Company. The wordmark is typeset from the OFL font *Great Vibes*, not the official logo artwork. The tagline is original.

## Shots

| # | Time | Shot |
|---|------|------|
| 01 | 0:00–0:04 | Reveal: a strip light sweeps across the frosted contour bottle, and the red glow rises |
| 02 | 0:04–0:08 | Close-up glide across the condensation and white script; one drop runs down, wiping the frost |
| 03 | 0:08–0:12 | Slow-motion cap pop at 0:09.0, with a CO2 vapor wisp, spray and neck bubbles |
| 04 | 0:12–0:19 | Pour: a gravity-parabola cola stream over ice, with the level rising at constant volumetric flow and foam building |
| 05 | 0:19–0:24 | Fizz close-up: backlit ice, bubble streams and jumping droplets. Super: "ICE COLD." |
| 06 | 0:24–0:29 | Slow-motion ice drop, impact at 0:25.0: crown splash, ripples and a bubble trail |
| 07 | 0:29–0:35 | Hero: open bottle and full glass on wet black, camera arc, light sweep. Super: "THE TASTE YOU KNOW." |
| 08 | 0:35–0:40 | End card: bottle on Coca-Cola red, script wordmark wipe-on, "FEEL THE FIZZ.", disclaimer |

## Pipeline

1. **Scene library.** `lib/cokelib.py` uses Blender 4.5 (the `bpy` Python module) with Cycles and OpenImageDenoise. It builds everything procedurally:
   - the contour bottle (lathe profile with vertical flutes, real wall thickness, white script label, crown cap)
   - condensation (a haze map, wiped drip runs, and thousands of refracting droplets)
   - cola with volume absorption, so thick areas read near-black and thin ones glow ruby
   - ice cubes carved out of the liquid with boolean cutters, so the ice stays clear
   - bubble swarms and foam
   - studio rigs with strip softboxes, light linking and the AgX view transform
2. **Shots.** `shots/shotNN_*.py` build each shot with analytic, frame-driven animation, so any frame renders on its own.
3. **Render driver.** `render_shot.py NN` renders frames and resumes from where it stopped. `runner.sh` is a queue for rendering shots back to back.
4. **Soundtrack.** `audio/make_audio.py` synthesizes the music and sound design: a 120 BPM pop track, a CO2 pop and hiss, the pour, Minnaert-bubble fizz, ice clinks, the plunk and splash, and a glass ting. It is normalized to -14 LUFS.
5. **Finishing.** `post/composite.py` does the final pass:
   - Lanczos upscale to 1080p and a per-shot grade
   - bloom with warm halation, subtle chromatic aberration, vignette and film grain
   - animated typography, fades and the flash cut
   - H.264 encode with the soundtrack muxed in

```bash
pip install bpy==4.5.* "numpy<2" scipy pillow opencv-python-headless   # plus ffmpeg on PATH
for s in 01 02 03 04 05 06 07 08; do python3 render_shot.py $s; done  # hours on a 4-core CPU
python3 audio/make_audio.py
python3 post/composite.py --out coca-cola-spec-ad-40s.mp4
```

Renders, the audio and test stills go to a scratch directory (`COKE_SCRATCH`, see `lib/cokelib.py`), not into git. `BRIEF.md` has the original creative brief and timing sheet.
