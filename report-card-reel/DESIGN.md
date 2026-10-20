# The Buried Report Card: build design (for everyone working on it)

Vertical 9:16 reel, 1080x1920, 30 fps, 49.5 s, rendered frame by frame with three.js
in headless Chromium (SwiftShader). A 3D **cutaway diorama** at **golden-hour sunset**:
the ground is cut open like a slice of cake at the plane **z = 0**; we look at it from
+z. A kid tries to hide a bad report card (a white card with a big red "C", the only
text in the whole scene) by burying it in the backyard. Each problem gets a fix; it
ends with Dad finding it with a metal detector and raising one eyebrow.

**Look:** a polished animated-movie look, never a basic render. Physically based
materials (MeshStandardMaterial) with procedural detail made in code (noise, bumps,
grain, wood grain, fabric weave, brushed metal, paper fibre). Soft shadows, AO and
bounce come from the accumulation renderer (jittered sun and sky lights, averaged
sub-frames); bloom on bright things; filmic AgX grade with warm highlights; vignette.
Golden hour: a low warm sun from the **front left** (`SUN_DIR = (-0.6, 0.34, 0.72)`,
~20 degrees up) throws long soft shadows to the back right; a cool blue sky light;
rich warm colours. Scene 3 has a storm (`WD.storm(t)` 0..1): the sun goes, the light
turns grey and soft, rain falls; it clears for scene 4. Characters: cute, stylized,
toy-like 3D figures, round heads, big expressive eyes, the same design in every
scene. Things pop in and **snap into place with a small bounce** (`U.popIn`); smooth
eased motion, never robotic. Invisible things are soft glowing shapes.

**No flicker, no jagged lines:** nothing finer than ~2 px at 1080x1920 in the shot it
appears in (texture detail and geometry), fade patterns out before they alias (see
`aaF` in `src/ref/env_snack.js`), slow twinkles only, no strobing.

## Files and who owns them

| file | owner | what |
| --- | --- | --- |
| `src/main.js` | lead | engine, camera, lights, storm, soil cut face, the hole, dirt chunks + dust + piles + Dad's dust cloud, rain, water dots, worms, the lump, paw-reach line, suspicious outline, twinkle |
| `src/world.js`, `src/timeline.js`, `src/materials.js` | lead | layout, hole state, beats (`T`), camera (`CAM`), VO slots, shared GLSL |
| `src/env.js` | env agent | sky (sunset + storm clouds), grass blades, yard dressing, fence, trees, doghouse, the house (+ back door that opens) |
| `src/kid.js` | kid agent | the kid (+ the kid's shovel) and all the kid's acting |
| `src/family.js` | family agent | Dad (+ Dad's shovel, glasses, humming notes) and the dog, all their acting |
| `src/props.js` | props agent | report card, metal box, flowers, garden roller, metal detector (+ beep rings), ladder |
| `tools/*.py`, `*.sh`, `README.md` | audio agent | music, sound effects, mix, subtitles, export and revoice scripts |

`src/ref/` holds the previous reel's modules (`env_snack.js`, `characters_snack.js`):
copy and adapt anything useful (the grass, boards, shingles, the toy character rigs,
eyes, materials). They are not imported.

Shared files (`main.js`, `materials.js`, `world.js`, `timeline.js`): do **not** edit
them; if you need a new `T` key or a world constant, define it locally in your module
and say so in your summary (the lead will merge it).

## Module API

Each module exports `build(ctx)` returning `{ update(t) }` (t in seconds). **Every frame
is a pure function of t** (update is called several times per frame for motion blur,
and frames are rendered out of order in separate processes): no state carried between
calls, no randomness outside a seeded `U.mulberry32`.
`ctx = { THREE, scene, renderer, camera, envMap, stormEnv, envMats, SCALE, T, WD, MAT, G,
U, add, mesh, instanced, beginInst, setInst, endInst, sun, camAt, anchors, buried, FX }`
- `add(obj, cast, recv)` adds to the scene and sets shadow flags; `mesh(geom, mat)`
- `G` = geometry helpers (`placed`, `box`, `boxMM`, `mergeAll`, `lumpyBlob`, `rod`)
- `MAT` = materials (`patch(mat, {colorFn, roughFn, bumpFn, emissiveFn, extraFrag, key})`
  adds world-space procedural colour / roughness / bump to a standard material, `std`,
  `GLSL_COMMON` noise helpers ...); `U` = easing (`popIn`, `popOut`, `prog`, `smooth`,
  `easeOutBack`, `wobble`, `bump`, `monotone`, `mulberry32` ...)
- `instanced(geom, mat, cap)` + `beginInst / setInst(im, x,y,z, sx,sy,sz, rx,ry,rz) / endInst`
- `camAt(t)` -> `{cx, row, s, cy}`: frame centre x, pixel row of y = 0 at z = 0, pixels per
  metre at z = 0, camera height, if you need to know what is on screen.
- **Shiny materials** (metal, glass, glossy eyes): set `mat.envMap = ctx.envMap` and push
  the material to `ctx.envMats` (the engine swaps in `stormEnv` during the storm). Matte
  materials get no envMap (it would add unshadowed ambient light).
- `ctx.FX = { dirtMat, chunkGeo, puffMat, puffGeo, glowMat }` for consistent little dirt
  bits and dust puffs of your own (e.g. clapping dust off the hands).
- **No new lights** that cast shadows. Glows are emissive / additive materials. At most
  one small PointLight without shadows per module if it really matters.
- SwiftShader is a CPU renderer: merge static geometry (`G.mergeAll`), use instancing for
  repeats, keep segment counts sensible, give each patched material a unique `key`.

### Anchors (characters <-> props)

Character modules register `THREE.Object3D` anchors in `ctx.anchors` **at build time**,
parented inside their rigs, and keep them posed in `update(t)`. Module order each
frame: env, kid, family, props, so props reads anchors after the characters have
posed (call `anchor.updateWorldMatrix(true, false)` before reading `matrixWorld`).
Each anchor's local frame: origin at the grip point, +y along the forearm's pointing
direction out of the hand, +z out of the palm/front.
- kid.js: `kidHandR`, `kidHandL`, `kidHead`
- family.js: `dadHandR`, `dadHandL`, `dadHead`, `dogMouth` (between the teeth, +x along
  the jaw to the dog's right side, so a card held crosswise lies along x)
If an anchor is missing (module not written yet), props falls back to a sensible
world position so it still renders.

Props that the characters hold but props.js owns: the card, the box (when Dad holds
it), the detector. Characters own their shovels. Shared motion that both need comes
from `world.js`: `WD.rollerX(t)` (the kid pushes the roller handle), `WD.boxPos(t)`,
`WD.dadWalk(t)`, `WD.fillTop(t)` (the floor the kid stands on in the hole),
`WD.groundY(x, z, t)` (the lump), `WD.BEEPS`.

### Who holds the card when (props.js places it, the characters pose to match)

| from | to | the card is |
| --- | --- | --- |
| 0 | `shovelIn` | held up in front of the kid's chest in both hands, the C facing the camera (`kidHandL`; the right hand holds its right edge) |
| `shovelIn` | `cardDrop` | in the kid's left hand, low at the side (shovel in the right) |
| `cardDrop` | `dogGrab` | flicked into the shallow hole, lands (`cardLand`) upright-ish facing us, then buried |
| `dogGrab` | `snatch` | in the dog's mouth (`dogMouth`), held crosswise |
| `snatch` | `cardDown` | in the kid's left hand (digging one-handed with the right) |
| `cardDown` | `float0` | at the bottom of the deep hole, then buried under the refill |
| `float0` | `fish` | floats up through the mud and lies on the mud at the top |
| `fish` | `cardIn` | in the kid's right hand (shaken off; the kid's shovel is gone by now) |
| `cardIn` | `cardOut` | in the box |
| `cardOut` | end | in Dad's right hand, held up to read, angled so the camera sees the C |

The kid's shovel exists from `shovelIn` until `refill1` + 0.3 (then it poofs away). The
roller's handle grip is at (`WD.rollerX(t) + WD.ROLLER.grip.dx`, `WD.ROLLER.grip.y`,
`LANE`), the kid's hands on it ~0.12 m either side in z. The ladder is `WD.LADDER`.

## Layout (metres, `src/world.js` has the exact numbers)

- Lawn y = 0. The hole: centred at x = 0, half width 0.33 at the lawn (0.30 at the
  bottom), from z = -0.62 to the cut face at z = 0, so the cut opens it from the side.
  Shallow depth 0.42 (scene 1), deep 2.5 (scene 2). State: `WD.dugD(t)`,
  `WD.fillTop(t)` (depth of the loose dirt / mud surface; 0 = filled to the brim),
  `WD.mudK(t)`. The bare patch of fresh dirt on the lawn is x -0.36..0.36, z -0.65..0.03.
  **Nothing else may stand in it** (grass blades skip it: x -0.4..0.4, z -0.7..0.06).
- The action lane is z = `WD.LANE` (-0.31): the kid stands right of the hole at
  `KID_SPOT` (0.68), the dog digs from the left at `DOG_SPOT` (-0.66), Dad stands at
  `DAD_SPOT` (0.74). The kid's dirt pile is at `PILE` (1.2, -0.5), Dad's at `DAD_PILE`
  (-0.78, -0.55). Keep x -1.5..1.7, z -1.0..0 free of dressing.
- Doghouse at `DOGHOUSE` (-2.0, -1.6), 1.0 wide, 1.05 deep, door facing +z (the dog
  trots out of it towards the hole). `KID_WATCH` (-1.2, -0.62): where the kid stands in
  scene 7, next to the dog.
- The house: a **two-story beige house with blue shutters**, its back facade facing the
  yard at z = -6.0, x 1.8..8.4, ground floor at y 0.45 (low plinth), eaves 6.25, ridge
  8.6. Back door at x 3.15 (0.95 wide, 2.1 high) with a little porch and two steps;
  it opens at `T.door`, Dad walks out along `WD.DAD_PATH` to the flower bed.
- Things buried in the soil are drawn **flush with the cut face** (their front at
  z = +0.003) so the cutaway shows them, as in a cross-section illustration; props.js
  reports them in `ctx.buried` and the engine draws a soft contact shadow round them.

## Camera and the subtitle band

Mostly steady, slow eased pans, gentle push-ins on the funny moments (timeline.js
`CAM`). Medium shots put the lawn at pixel row ~690-740 with 200-270 px/m (the frame
is ~4-5 m wide); scene 6 pulls back to a wide shot (95 px/m, lawn at row 800, the whole
yard and house); scene 7 pushes in on Dad (300 px/m, lawn at row 1060).
**Subtitles** are one big word at a time centred around row ~860 (rows ~790-930): in
the medium shots that band is the soil 0.5-1.2 m deep, so faces, the card and key
action stay above the lawn or below ~1.3 m deep. Also keep the bottom 20 % and the
right edge free of important things (Instagram's buttons).

## Beats (seconds, `T` keys in `src/timeline.js`; VO words in brackets)

1. **0-6.8** Close on the kid holding the card (big red C facing us); the kid gulps
   (`gulp`); a shovel pops into the kid's right hand (`shovelIn`, ["dig"]); three scoops
   (`dig1`), dirt flies over the kid's right shoulder onto the pile; the kid flicks the card into
   the shallow hole (`cardDrop`, ["bury"]); it lands (`cardLand`); two scoops from the
   pile back in (`fill1`); pats it flat (`pat`); satisfied, leans on the shovel
   (`proud1`, ["nobody will ever find it"]). ["Sort of."] `dogPeek`: the dog's head
   pops out of the doghouse door, ears up, sniffing.
2. **6.8-13.9** The dog trots out (`dogGo`-`dogArrive`) to `DOG_SPOT`, sniffs (`sniff`),
   digs with its front paws (`dogDig0`-`dogDig1`, dirt sprays back), grabs the card in
   its mouth and lifts it proudly (`dogGrab`, ["right back up"]), tail wagging, muffled
   happy bark (`bark`). The kid snatches it back (`snatch`). The kid hops into the hole
   and digs down fast (`deep0`-`deep1`), standing on `-WD.fillTop(t)`, each scoop in
   `WD.DEEP_T` flinging dirt up and out; the dog lies at the rim and reaches a paw in
   but only gets to the glowing paw-reach line (`pawLine`, ["way below"]). At the
   bottom (2.5 m) the kid lays the card down (`cardDown`), a ladder pops in (`ladderIn`), the kid
   climbs out (`climb0`-`climb1`), the ladder pops away (`ladderOut`), and the kid pushes the
   whole pile back in (`refill0`-`refill1`).
3. **13.9-21.2** Dark clouds roll in (`storm0`-`storm1`), rain (`rain0`-`rain1`); the
   dog runs into the doghouse; the kid looks up, hunches. Water soaks down as glowing
   blue dots (`soak0`-`soak1`); the hole turns to mud (`mud0`-`mud1`, ["hole to mud"]);
   the card floats up through the mud (`float0`-`float1`, ["card floats up"]); the kid
   fishes it out and shakes it (`fish`). A shiny metal box snaps together piece by
   piece in the air over the hole (`box0` + i*`boxGap`, lid `boxLid`, ["seal"]), the card
   goes in (`cardIn`), the lid clicks shut (`click`, ["box"]), it sinks deep through the
   mud (`sink0`-`sink1`, `WD.boxPos`). The rain stops, the sun comes back (`storm2`-`storm3`),
   the mud dries into fresh dirt (`dry0`-`dry1`).
4. **21.2-26.1** The fresh dirt patch looks suspicious: a glowing outline pulses round it
   (`sus`), the kid scratches their head. Flowers pop up one by one with a bounce
   (`WD.flowerT(i)`, 8 of them, ["plant flowers on top"]), hiding it perfectly.
5. **26.1-31.4** A lump bulges up under the flowers (`lump0`-`lump1`, ["lump"],
   `WD.groundY`). The kid pushes a garden roller in from the right (`rollIn`), over the
   lump (`roll0`-`roll1`, `WD.rollerX`, ["roll the ground perfectly flat"]); the lump goes
   flat behind it; the flowers squish under it and spring back up; the roller pops
   away (`rollOut`); a twinkle on the perfect lawn (`sparkle`).
6. **31.4-36.4** The kid dusts off their hands (`dust0`, three claps, little puffs), hands
   on hips, big proud smile (`proud2`); the camera pulls back to the whole backyard at
   sunset (`wide0`-`wide1`); the kid strolls over to the dog by the doghouse
   (`kidWalk0`-`kidWalk1`) and stands at `KID_WATCH`.
7. **36.4-49.5** The back door opens (`door`); Dad steps out (`dadOut`) and walks the
   path to the flower bed (`WD.dadWalk(t)`, arrives `dadArrive`), sweeping a metal
   detector over the lawn, humming (little glowing music notes). It beeps (`WD.BEEPS`,
   from `beep0`, faster and faster, glowing rings from the coil) and squeals over the
   flowers (`beep1`). Detector away, shovel in: a cartoon flurry inside a big dust cloud
   (`dadDig0`-`dadDig1`, the engine draws the cloud, dirt and the hole); the flowers get
   tossed out onto the lawn. The dust clears: Dad holds the muddy box (`boxUp`), the lid
   creaks open (`creak0`-`creak1`), Dad pulls out the card (`cardOut`), reads it
   (`read`), raises **one eyebrow** (`brow`). The music stops (`musicStop`).
   Dad: "Hmm... a C in science?" (46.0-47.35; "Hmm..." 46.04, "a C" 46.31-46.41,
   "science?" 46.72). The kid, by the doghouse, gulps (`gulp2`); the dog tilts its head.

The kid is referred to as they/them throughout (as in the brief).
