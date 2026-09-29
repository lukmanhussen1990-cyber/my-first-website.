# "Feel the Fizz": 40-second Coca-Cola spec ad (fan-made concept)

This is a photoreal CG product film, made fully procedurally in Blender (Cycles) with Python,
plus synthesized audio and a Python/ffmpeg finishing pass.
It is a **fan-made spec ad**. The end card carries a small disclaimer:
"Fan-made spec ad. Not affiliated with or endorsed by The Coca-Cola Company."
Do not reproduce any real Coca-Cola slogans ("Taste the Feeling", "Open Happiness", "Real Magic",
"The Real Thing", "Share a Coke"). The wordmark is typeset from an OFL script font; the official logo artwork is not copied.

## Look & feel (the reference is premium beverage product cinematography)
- Deep, saturated Coca-Cola red (#E4002B / linear ~ (0.78, 0.0, 0.024)) and near-black, glossy wet surfaces.
- Icy highlights: crisp strip-softbox reflections running down the glass, sparkling condensation beads.
- The cola reads almost black in the body, glowing ruby/amber where it is backlit and thin (edges, neck, pour stream, bubbles).
- Slow, deliberate camera moves, shallow depth of field on macro shots, slow motion on action beats.
- Realism checklist: correct real-world scale (meters), physically plausible IOR (glass 1.5, water/cola 1.33, ice 1.31),
  thin-glass wall thickness, meniscus, imperfections (micro-roughness, fingerprints-free but not CG-perfect),
  motion blur on fast action, AgX view transform, subtle lens effects added in post.

## Technical spec
- 24 fps, exactly 960 frames = 40.0 s.
- Render resolution 1280x720 (Cycles CPU, OIDN denoise). The finishing pass upscales to **1920x1080**, grades, and adds bloom, vignette and film grain.
- Final deliverable: H.264 High, yuv420p, 1920x1080, 24 fps, AAC 48 kHz stereo 256 kbps, `+faststart`, target < 60 MB.
- The machine is a 4-core CPU, and every frame is expensive. Budget: **average <= ~12 s/frame at 1280x720** at final settings.
  Use deterministic, analytic animation (keyframes, drivers, or `frame_change_pre` handlers computed from the frame number)
  instead of physics caches, so any frame can be rendered independently and out of order.
- Scale: 1 Blender unit = 1 m. The contour bottle is ~0.196 m tall.

## Paths
- Repo project dir: `/home/user/my-first-website./coke-ad/` (scripts and final MP4 only; keep renders out of git)
- Scratch (renders, tests, build outputs): `/tmp/claude-0/-home-user-my-first-website-/0735c37f-ff6b-57d4-b08a-d20fb3844685/scratchpad/` (below: `$S`)
  - `$S/renders/shotNN/0001.png ...` final shot frames (16-bit PNG, local frame numbers starting at 1)
  - `$S/tests/<name>/` test stills
  - `$S/build/` audio.wav, overlays, final encodes
- Fonts (OFL): `coke-ad/assets/fonts/` (DancingScript-Bold.otf, great-vibes, pinyon-script, montserrat-*, oswald-*, playfair-*, Lato-*)
- Blender: `python3` with `import bpy` (official bpy 4.5.14 LTS module, Cycles has OIDN and Embree). Also `/usr/bin/blender` (4.0, no OIDN, don't use for final).
- Python libraries: numpy, scipy, pillow, fonttools. ffmpeg 6.1 is at /usr/bin/ffmpeg. There is NO internet (no HDRIs or texture downloads); everything is procedural.

## Music & timing (120 BPM: 1 beat = 0.5 s = 12 frames; 1 bar = 2 s = 48 frames)
All cuts land on whole seconds (on the beat).

| Shot | Name | Global frames | Time | Content | Key sync |
|---|---|---|---|---|---|
| 01 | reveal | 0–95 (96) | 0:00–0:04 | Darkness. A strip light slowly sweeps across a frosted, condensation-beaded contour bottle, revealing its silhouette and flutes as glints. Slow push-in. Deep red glow rises in the background. | ambient swell, fizz crackle hint |
| 02 | macro | 96–191 (96) | 0:04–0:08 | Extreme macro, shallow DOF, camera glides across the bottle's beaded surface past the white script lettering. One big droplet slides down, merging others. | soft music intro |
| 03 | pop | 192–287 (96) | 0:08–0:12 | Close-up bottle neck & red crown cap. At local frame 25 (global 216 = 0:09.0) the cap pops off, spinning up and away in slow motion; cold vapor wisp curls out of the neck. | **POP + hiss at 0:09.0**, music drop |
| 04 | pour | 288–455 (168) | 0:12–0:19 | Bottle tilts, pouring a ruby-backlit cola stream into a glass of ice; level rises, ice lifts/bobs, bubbles and a foam head form. | pour + ice crackle + fizz |
| 05 | fizz | 456–575 (120) | 0:19–0:24 | Macro inside the glass: streams of bubbles rising past ice cubes, backlit amber-red; slow upward camera. Super: "ICE COLD." | fizz texture |
| 06 | icedrop | 576–695 (120) | 0:24–0:29 | Super slow motion: an ice cube drops into the full glass; at local frame 25 (global 600 = 0:25.0) it hits, throwing a crown of cola droplets. | **PLUNK/splash at 0:25.0** |
| 07 | hero | 696–839 (144) | 0:29–0:35 | Hero: bottle + filled glass on a black wet reflective surface, red backdrop glow, camera slowly arcs; light sweep glint across the bottle. Super: "THE TASTE YOU KNOW." | music peak |
| 08 | endcard | 840–959 (120) | 0:35–0:40 | Coca-Cola red background, hero bottle (3D plate), animated white script wordmark "Coca-Cola" and tagline "Feel the Fizz." Small disclaimer at the bottom. | final hit at 0:35.0, resolve, tail out |

Super timings (global seconds): "ICE COLD." 19.5–23.6; "THE TASTE YOU KNOW." 29.8–34.6; end card wordmark in at 35.3, tagline at 36.2,
disclaimer 36.5–40.0. Fade to black over the last 12 frames (39.5–40.0).

## Module contract
- `coke-ad/lib/cokelib.py`: shared scene/asset library (render setup, studio lighting, contour bottle, cap, cola, glass tumbler, ice, bubbles, condensation, camera helpers). Documented in `coke-ad/lib/API.md`.
- `coke-ad/shots/shotNN_<name>.py`: each defines `SHOT = {"id": "NN", "name": ..., "frames": N}` and `build()`, which builds the whole scene
  (starting from `cokelib.reset_scene()`) with `scene.frame_start = 1`, `scene.frame_end = N`. Running the file directly with `--test` renders stills to `$S/tests/shotNN/`.
- `coke-ad/render_shot.py NN [--start a --end b] [--res WxH] [--samples n]`: imports the shot module, builds once, and renders frames to `$S/renders/shotNN/####.png`, skipping existing ones.
- `coke-ad/audio/make_audio.py` writes `$S/build/audio.wav` (48 kHz, stereo, exactly 40.000 s).
- `coke-ad/post/composite.py` reads the shot frames, then grades, upscales, adds titles/end card/lens effects, muxes the audio and writes the final MP4.
