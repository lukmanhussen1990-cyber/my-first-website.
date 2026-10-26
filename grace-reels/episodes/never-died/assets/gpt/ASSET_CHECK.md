# GPT Image check (Phase 3)

**Received: 7 of 35 images.** The user can't make more, so everything else is built in code.

| # | File | Check |
|---|---|---|
| 1 | char_elijah_turnaround.png | OK. Side, three-quarter and back views; matches the character bible |
| 2 | char_elijah_parts.png | OK. 11 rig pieces (head, hair, beard, torso, 2 upper arms, 2 forearms, 2 legs, cloak) |
| 3 | char_elijah_poses.png | OK. Walk, point, look up, rise (no cloak), kneel, bend |
| 4 | char_elisha_turnaround.png | OK |
| 6 | char_elisha_poses.png | OK. Walk, talk, cry out, reach up, kneel, pick up |
| 7 | char_enoch_turnaround.png | OK |
| 8 | char_enoch_parts.png | OK. 10 rig pieces (head, beard, robe torso, sash, 2 upper arms, 2 forearms, 2 legs) |

- **Background:** all 7 have real transparency. The dark glow seen in chat previews is hidden color
  under fully transparent pixels.
- **Edges:** clean at 2× on bright and dark backgrounds, with no halo or fringe.
- **Style:** all 7 match each other (dark-brown outline, flat color with one shadow tone, side-view
  faces with one eye, mitten or fist hands). No text, no extra fingers.
- **Resolution:** figures are 600–1000 px tall.

## Auto-fixes (tools/process_gpt_images.py)

- Alpha: interiors came in at 250–254 and were lifted to 255; an alpha≈3 haze around figures was removed.
- Edge colors bled into transparent pixels, so scaled textures never show a dark fringe.
- Each sheet was cut into 42 named, trimmed sprites in `public/sprites/<character>/` with
  `sprites.json` (size, source box, foot point). Near and far limbs are told apart by brightness.

## Missing images and their code-built replacements

| Missing | Built in code instead |
|---|---|
| All backgrounds (Enoch hill, Jordan, storm, mountain, sunrise, near kit) | Procedural low-poly 3D diorama in Three.js, the same look as the reference world |
| Chariot, horses of fire, flames, embers | SDF fire shaders: rigged horse with a gallop cycle, chariot with spinning wheels, paper-cut flame bands, seeded sparks |
| Whirlwind 1–3, storm clouds | Twisting cylinder layers with streak shaders, plus spiral dust particles |
| Light beam, footprints | Shader beam with gold dust; vector sandal prints |
| Cloak | Taken from the Elijah parts sheet, with a falling wave warp |
| Myth picture | Elijah's pointing pose in the code-built chariot, aged and framed in code |
| Elisha parts | Cut from his side view (arm and feet separated, robe inpainted) |
| Enoch poses | Done with his parts rig |
| Moses, Jesus | Recolored from Enoch's side and three-quarter views (Moses: white hair, long beard, red-brown robe, staff; Jesus: white robe, shining featureless face, no halo, glow in code) |
| Peter, James, John | Backlit silhouettes from Elisha's poses, with different hair shapes |
