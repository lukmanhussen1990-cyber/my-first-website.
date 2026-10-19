# What If You Fell Into Jupiter? — 45 s vertical reel

A 3D cartoon science-horror short (1080×1920, 9:16, 30 fps, 45.0 s, no voiceover),
generated entirely from code: GLSL shaders for the picture, PIL for on-screen text and
HUD, numpy/scipy synthesis for music and sound effects, ffmpeg for encoding.

**Finished video:** [`output/what-if-you-fell-into-jupiter.mp4`](output/what-if-you-fell-into-jupiter.mp4)

## Rebuild

Requirements: Python 3 with `numpy`, `scipy`, `Pillow`, `moderngl`; `ffmpeg`; `xvfb-run`
and Mesa (llvmpipe software OpenGL 4.3+ is enough, no GPU needed).

```bash
python3 audio.py                 # output/soundtrack.wav  (~40 s)
./render_all.sh                  # build/<shot>.mkv, lossless (~2 h on 4 CPU cores)
python3 overlays.py --compose    # captions + HUD + soundtrack -> output/*.mp4
```

Quick checks: `xvfb-run -a python3 render.py --small --preview 0,12.3,37` writes stills, and
`python3 overlays.py --still still.png 12.3` previews the overlays on one of them.

## How it is built

| File | Role |
|---|---|
| `timeline.py` | Single source of timing: shots, captions, gauges, lightning, warning beeps, hits |
| `render.py` | Cameras, astronaut animation and environment per shot; drives the GL passes; pipes frames to ffmpeg |
| `astro.py` | Astronaut rig: forward kinematics and body-language poses (flail, reach, brace, cower, limp...) |
| `shaders/space.frag` | Jupiter (banded, domain-warped clouds, Great Red Spot, storms, limb haze, aurora, night-side lightning, Io's shadow), stars, the cutaway |
| `shaders/atmo_*.frag` | Ray-marched cloud decks, lightning, helmet-lamp beam, glowing depths, particles |
| `shaders/astronaut.glsl` | The character: signed-distance-field suit, helmet and reflective visor, warning lights |
| `shaders/post.frag` | Bloom, ACES tone mapping, grading, zoom blur, heat shimmer, pressure squeeze, helmet POV, visor cracks, grain |
| `overlays.py` | Captions, pressure / temperature gauges, cutaway labels; final compositing and mux |
| `audio.py` | Score (D minor drones, braams, Shepard risers, taiko), wind, thunder synced to every flash, creaks, beeps, glass cracks |

Space shots render at 2160×3840 and are downsampled to 1080×1920; atmosphere shots march
the volume at 1080×1920 and composite the astronaut at 2160×3840.

## Scenes

| Time | Scene | Picture |
|---|---|---|
| 0–5 s | The terrifying fall | Tumbling toward Jupiter, exponential push-in past the Great Red Spot into the haze |
| 5–11 s | Entering the clouds | Third person through the bright ammonia-ice deck, then first-person POV plunging toward the next deck |
| 11–18 s | The crushing pressure | Visor close-up with warning lights, then a low angle through dark, stratified layers; pressure gauge |
| 18–26 s | The hellish deep atmosphere | Towering water-cloud storms revealed by lightning, glowing depths, heat shimmer; temperature gauge |
| 26–35 s | The point of no return | Pull-back to a tiny silhouette in dense, fluid-like depths; POV visor cracks; near-silence |
| 35–45 s | The final reveal | Jupiter in space, illustrative cutaway, a tiny silhouette disappearing into the cloud tops |

## Science notes

- Jupiter is mostly hydrogen and helium and has no ordinary solid surface. The film never
  shows a landing, a rocky floor or a cavern: the descent goes through cloud decks into ever
  denser, hotter gas and fluid-like depths.
- The cloud layering follows the standard picture of Jupiter's upper atmosphere: ammonia-ice
  clouds on top, ammonium hydrosulfide below, then water clouds where lightning forms.
- Pressure and temperature only ever *rise with depth*. The gauges have no numbers or units,
  and no caption states a depth, pressure or temperature.
- The Great Red Spot (a giant anticyclone) turns counter-clockwise, the planet rotates in the
  correct prograde direction, and Io's shadow falls on the cloud tops.
- Artistic licence: depth is heavily compressed for storytelling, rotation is sped up, and
  heat is shown as a glow from below. The cutaway is labelled *illustrative*; its layers are
  soft gradients so it doesn't imply that the interior is known in detail. Like most
  "what if" pieces, the film skips the heating from atmospheric entry.
