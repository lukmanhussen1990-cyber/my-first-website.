# Gum Reel — "Caveman invents chewing gum"

A ~39 s vertical (1080×1920, 30 fps) Instagram reel made 100% in code:
Blender 5.2 (`bpy` module, Eevee) for the 3D, numpy for the character modelling,
sound effects and music, PIL for the cartoon effects and captions, ffmpeg for encoding.

The finished video is `../gum_reel.mp4`.

## How it is built

| Step | Script | What it does |
|---|---|---|
| 1 | `scripts/align.py` | Forced-aligns the known script against `voiceover.mp3` with PocketSphinx → `words.json` (word timings). |
| 2 | `scripts/char_geo.py`, `scripts/sdf.py`, `scripts/mesh_all.py` | Models the caveman as signed-distance fields (body, head, nose, hands, feet, beard, hair, brows, tunic) and meshes them with marching cubes. |
| 3 | `scripts/build_character.py` | Builds the rig (spine, neck, head, jaw, cheeks, brows, eyelids, eyes, clavicles, arms, index finger + grouped fingers, thumbs, legs, feet, toes, beard/hair/skirt follow-through bones, IK hand + foot targets), computes skin weights, eyes with iris, blinking lids, a shape-keyed mouth (smile, frown, O, pucker, grimace, wide), fur on beard/hair/brows/mustache and the leopard-spot tunic. |
| 4 | `scripts/build_world.py`, `scripts/build_props.py` | The garden (grass clumps, dirt, speckled boulders, stone slab tables, clay bowls, trees, pink flower bushes, hills, sky) and every story prop (wilting flowers, mint bush, birds, sap tree, flint, kitchen with fire/pot/honeycomb/“CHEW-MASTER 3000” sign, gum balls, snail, bubble, gum under the slab, explainer studio). |
| 5 | `scripts/anim.py`, `scripts/shots.py` | Animation engine (eased keys, overshoot/anticipation, auto-blink, breathing, chewing, spring follow-through) and the 35 camera shots, timed to the voice. |
| 6 | `scripts/render_shots.py` | Renders the shots with Eevee and exports 3D→2D anchors for the overlays. |
| 7 | `scripts/audio.py` | Synthesises every SFX + a bouncy background tune, ducks music under the voice, loudness-normalises to −14 LUFS. |
| 8 | `scripts/fx.py` | Cartoon FX (stink cloud, poop icon, sparkles, poof, breath, cough, Zzz, speed lines, ?, pop, dust, confetti, check), word-synced captions, watermark, H.264/AAC encode. |

`scripts/make_reel.sh` runs steps 6–8 end to end.

## Choices made along the way

- **Reference:** only one reference video was supplied, so it served as `ref1.mp4`; style notes are in `STYLE_NOTES.md`.
- **Word timings:** the Whisper model downloads were blocked in this environment, so the known script was force-aligned
  to the voiceover with PocketSphinx (bundled English model). Pauses were checked against the audio's silence gaps.
  Each scene starts on its first word; the video ends 0.8 s after the last word (38.97 s, 1,169 frames).
- **Rendering:** Blender 5.2 Eevee running on software OpenGL (no GPU). Frames are rendered at 810×1440 with
  6 samples, then upscaled to 1080×1920. Captions, effects and the watermark are drawn natively at 1080×1920.
- **Character:** modelled as smooth signed-distance shapes (no downloaded assets). Hair, beard, mustache and brows are
  particle fur over soft volumes, so they are never a flat block. Beard, hair and tunic hang on spring bones for follow-through.
- **Audio:** every sound is synthesised in numpy (tuba blaat, record scratch, thud, ding, crunches, drips, squish,
  scrape, rubbery squeaks, sad boing, poof, bubbling, gulp, slide whistle, coughs, pop, snap, crickets, inflate,
  whoosh, birds, falling whistle, party horn, fanfare). A bouncy C–F–G tune sits ducked under the voice, and the
  final mix is loudness-normalised to −14 LUFS with a −1.5 dBTP ceiling.

Paths inside the scripts point at the build workspace (`/home/user/work`). Adjust `ASSETS` and the input paths to rebuild elsewhere.
