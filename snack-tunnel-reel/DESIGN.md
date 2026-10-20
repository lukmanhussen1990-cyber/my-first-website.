# Snack Tunnel reel: build design (for everyone working on it)

Vertical 9:16 reel, 1080x1920, 30 fps, 56 s. A 3D cutaway diorama at **night**: the
scene is cut open like a slice of cake at the plane **z = 0**; we look at it from
+z. Backyard on the left, a cozy two-story house on the right (cut open like a
dollhouse, we mainly see the ground-floor kitchen), the bottom half of the frame is
the cut-open ground (rich brown soil in layers, small stones, roots). A kid digs a
secret tunnel from the yard to the kitchen for midnight snacks; a dog sleeps in a
doghouse; Mom is waiting in the kitchen at the end.

**Look:** polished animated-movie look, not a basic render. Physically based
materials (MeshStandardMaterial) with procedural detail made in code (noise, bumps,
grain, small stones, roots, wood grain, tile grout). Soft shadows, ambient
occlusion and soft bounce come from the accumulation renderer (jittered moon and
sky lights, averaged sub-frames); bloom on lights; filmic AgX grade; soft vignette.
Deep blue starry sky with a soft moon; cool blue moonlight from the **top left**;
warm yellow lanterns in the tunnel; later a warm-white fridge light and a headlamp.
Characters (kid, Mom, dog): simple, cute, toy-like, round heads, big friendly eyes,
the same design in every scene. Things pop in and **snap into place with a small
bounce** (`U.popIn`), dirt chunks and dust puffs when digging, eased motion, never
robotic. Invisible things are glowing shapes (sound rings, a thought bubble, Zzz).

**No flicker, no jagged lines:** nothing finer than ~2 px at 1080x1920 in the shot
it appears in (texture detail and geometry), slow twinkles only, no strobing.

## Files and who owns them

| file | owner | what |
| --- | --- | --- |
| `src/main.js` | lead | engine, camera path, lights, tunnel surfaces, dig FX (dirt chunks, dust, pile, cave-in clumps), sound rings, thought bubble |
| `src/world.js`, `src/timeline.js` | lead | layout constants, dig field, beats (`T`), camera keys (`CAM`), VO slots |
| `src/materials.js` | lead + env | shared GLSL helpers, `patch()`, soil bake (`GLSL_SOIL`), dig-masked tunnel materials, lawn |
| `src/env.js` | env agent | sky (stars, moon), grass blades, yard dressing, doghouse (+ floor patch), house shell |
| `src/kitchen.js` | kitchen agent | floor slab + tiles + trapdoor, cabinets, fridge (+ light), shelf, snacks, pulley + basket, footprints |
| `src/props.js` | props agent | mine frames, lanterns (+ lights), rock, calendar, measuring tape, ladders |
| `src/characters.js` | characters agent | kid (+ shovel, spoon, tile cutter, headlamp), Mom, dog (+ Zzz) |
| `tools/*.py`, `*.sh`, `README.md` | audio agent | music, sound effects, mix, subtitles, export and revoice scripts |

Shared files (`main.js`, `materials.js`, `world.js`, `timeline.js`): **Edit tool
only**, small exact edits inside your own block, never rewrite them, keep them valid
after every edit. You may **add** `T` keys; do not change `VO`, `SCENES`, `CAM` or
other people's keys (ask the lead in your summary instead).

## Module API

Each module exports `build(ctx)` returning `{ update(t) }` (t in seconds; every
frame is a pure function of t, called several times per frame for motion blur).
`ctx = { THREE, scene, renderer, camera, envMap, SCALE, T, WD, MAT, G, U, add, mesh,
instanced, beginInst, setInst, endInst, moon, camAt }`
- `add(obj, cast, recv)` adds to the scene and sets shadow flags; `mesh(geom, mat)`
- `G` = geometry helpers (`placed`, `box`, `boxMM`, `mergeAll`, `lumpyBlob`, `rod`)
- `MAT` = materials (`patch`, `std`, `glow`, `col`, `GLSL_COMMON` ...); `U` = easing
  (`popIn`, `popOut`, `prog`, `smooth`, `easeOutBack`, `wobble`, `bump`, `monotone` ...)
- `camAt(t)` -> `{cx, row, s, cy}` (frame centre x, pixel row of y=0 at z=0, pixels per
  metre at z=0, camera height) if you need to know what is on screen.
Merge static geometry, use instancing for many copies, give each material a unique
`patch(... key)` so programs don't collide. Keep lights to the ones listed below.

## Layout (metres, `src/world.js` has the exact numbers)

- Lawn y = 0. Tunnel just behind the cut face: z from -1.4 (back wall) to 0; roof
  y = -1.3, floor y = -2.3. Entrance shaft x -4.55..-3.95 (dirt pile left of it at
  x -5.25). Main tunnel from the shaft to x 3.75.
- Doghouse x -1.6..-0.4, z -1.25..0 (cut open at z = 0, its floor at y 0.08). The
  wrong-turn shaft goes straight up into it at x -1.3..-0.7; a floorboard patch
  (`PATCH`) lifts on the kid's head (`dogPopHead(t)`).
- House x 0.6..5.6, back wall z -2.6, walls 0.22 thick. Concrete slab y -0.3..0.15,
  tiles on top to 0.18, wall footings down to -0.9. Kitchen ceiling 2.8, upper floor
  from 3.05, roof from 5.5 to the ridge at 7.3. Back door in the left wall
  (z -2.0..-1.1); kitchen window in the back wall x 0.95..1.95, y 1.1..2.1.
- Kitchen: counter + base cabinets x 2.3..4.4 along the back wall (h 0.92), open top
  shelf x 2.6..3.9 at y 2.2 on the back wall with two bags of chips and a cookie jar
  (no logos), fridge x 4.45..5.3 against the back wall (h 1.85), door hinged on its
  right edge, opening towards the camera.
- Trapdoor tile x 3.25..3.65, z -1.25..-0.85 (0.4 m tiles on a 0.4 grid). The
  kitchen up-shaft x 3.15..3.75 reaches the bottom of the slab. Pulley wheel at
  (3.45, 2.55, -1.05) on a little wooden arm reaching out from the shelf, straight
  over the trapdoor. Mom sits on the floor at (4.22, -1.28), by the fridge.
- Rock in the tunnel's back wall at (-1.72, -1.72, -1.22). Lanterns at x -2.95,
  0.55, 2.6. Mine frames at `FRAMES_A` (scene 2, one by one) and `FRAMES_B` (pop in
  just after the dig face passes them).

## Camera (timeline.js `CAM`) and the subtitle zone

Steady with slow eased pans that follow the tunnel and gentle push-ins on the funny
moments. Scene 1-3 medium shots of the yard + tunnel (~190-240 px/m), scene 4 push
in on the doghouse gag (420 px/m), pan to the house, scenes 5-6 under/in the kitchen
(260-310 px/m), scene 7 a wide shot (98 px/m) then a push-in on the kitchen (420+).
**Subtitles** are one big word at a time centred around row ~860 (of 1920), roughly
rows 770-950; keep faces and key action out of that band in the shot they happen in
(and out of the bottom 20 % and the right edge where Instagram's buttons are).

## Beats (seconds, `T` keys in `src/timeline.js`)

1. 0-7.6 Night yard; dog asleep in the doghouse (Zzz). Dirt chunks pop out of the
   lawn and the shaft goes straight down (`shaft0`, 6 scoops), then the tunnel digs
   sideways (`tunA0`-`tunA1`); dirt pile grows. The kid digs with a shovel, each
   swing on a scoop in `WD.SCOOP_T`. A glowing thought bubble with a snack pops at
   `dream`, deflates and pops on "Sort of." (`dreamPop`).
2. 7.6-15 Clumps fall from the roof (`cave0`-`cave1`, `WD.CAVES`), the kid ducks
   and shakes dirt off. Wooden frames (posts + beam) snap in one by one at
   `frames0 + i*frameGap`; a lantern hangs from a beam at `lantern` and warms the
   tunnel. The dig creeps on to x -1.85 (`tunA2`).
3. 15-22.5 The shovel hits the rock: loud **clang** (`clang`), spark; glowing sound
   rings spread through the soil to the doghouse (lead); the dog's eyes pop open
   (`dogEyes`), ears up (`dogEars`), looks around. The shovel poofs, a tiny spoon
   pops into the kid's hand (`spoonSwap`); slow spoon digging (`spoon0`-`spoon1`,
   tiny scoops `WD.SPOON_T`); a calendar on the tunnel wall flips pages fast
   (`cal0`-`cal1`, "three weeks").
4. 22.5-30.6 The kid digs straight up (`dogUp0`-`dogUp1`); the floor patch lifts
   and his head pops up **inside the doghouse**, face to face with the dog (`popUp`,
   push-in). The dog stares. The kid slowly sinks back (`sink0`-`sink1`), the patch
   drops back. Measuring tape stretches along the tunnel (`tape0`-`tape1`); twelve
   glowing footprints pop one by one on the kitchen floor from the back door to the
   trapdoor tile (`steps0 + i*stepGap`); the dog lies back down (`dogSleep2`). The
   tunnel digs on under the house (`tunB0`-`tunB1`); frames and lanterns follow.
5. 30.6-38 Up under the kitchen (`kitUp0`-`kitUp1`), the slab is solid: two taps
   (`tap1`, `tap2`). Glowing lines cut around one tile (`cut0`-`cut1`, the kid holds
   a buzzing tile cutter up to it), hinges snap on (`hinge1`, `hinge2`), the tile
   flips open as a trapdoor (`trapOpen`).
6. 38-45.2 The top shelf with the chips and the cookie jar glows (`shelfGlow`); a
   tiny wooden pulley snaps together part by part (`pulley0 + k*pulleyGap`: bracket,
   arm, wheel, rope, basket); one bag of chips and the cookie jar hop into the basket
   (`hopChips`, `hopJar`); the basket lowers them smoothly through the trapdoor into
   the tunnel (`lower0`-`lower1`); the kid takes them and munches (`munch`); the
   basket goes back up (`basketUp0`-`basketUp1`) and the kid pulls the trapdoor shut
   (`trapClose0`-`trapClose1`).
7. 45.2-56 Wide shot of the finished tunnel glowing under the yard and the house.
   Mom is already sitting in the dark kitchen (`momIn`, unseen); the second bag is
   gone from the shelf. The basket comes down again, empty, and lands on the closed
   trapdoor (`basket2_0`-`basket2_1`). Push-in. The kid, confused (`confused`),
   pushes the trapdoor open (the basket slides off) and peeks into the dark kitchen
   with his headlamp on (`peek0`-`peek1`). The fridge door swings open
   (`fridgeOpen`) and its light clicks on (`fridgeOn`): Mom on the floor in a cozy
   robe, eating the chips (`crunch1`, `crunch2`). She raises one eyebrow (`brow`).
   Music stops (`musicStop`). Mom: "Looking for these?" (52.75-53.86), lifting the
   bag on "these" (`these`). The kid smiles nervously (`nervous`) and slowly closes
   the trapdoor (`close0`-`close1`). Last crunch (`crunch3`).

## Hand-offs between modules

- `kitchen.js` exports `makeChipsBag()` and `makeCookieJar()` (build functions taking
  `ctx`, returning a Group) so the kid and Mom hold identical copies, plus
  `basketAt(t)` -> `{x, y, z}` and `trapAngle(t)` (radians, 0 = closed).
- Delivered snacks: kitchen shows them until `lower1 + 0.15`, then hides them; the
  kid holds his own copies from then on. Mom's bag: the second shelf bag is hidden
  from `momIn`; Mom holds her copy.
- The trapdoor motion is kitchen's; the kid's hands match it at `peek0`-`peek1`,
  `trapClose0`-`trapClose1` and `close0`-`close1`.
- The doghouse patch (env) and the kid's head (characters) both follow
  `WD.dogPopHead(t)`.
- Lights: props owns the lantern `PointLight`s, kitchen the fridge light, characters
  the headlamp. The lead owns moon / sky / hemisphere / fill (`main.js`).

## Checking your work

```
node render.mjs stills 3,12.5,20 --spp 2 --scale 0.5 --out build/<you>/a --prefix s   # quick looks
node render.mjs stills 23.6 --spp 4 --scale 1 --out build/<you>/final --prefix s      # final check
```
Look at the PNGs (crop/zoom with PIL from `/home/user/reel-venv/bin/python`). Never
render an MP4 and do not commit. Full-res spp 4 stills should stay under ~6-7 s each
with everything in; tell the lead if your part costs more.
