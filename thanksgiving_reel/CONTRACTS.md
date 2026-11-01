# Thanksgiving reel — build contracts (read this first)

Instagram Reel, 9:16, 1080x1920, 30 fps, 50.0 s: **"You pooped your pants at Thanksgiving dinner."**
Goofy story told by a calm, deadpan narrator. Low-poly blocky 3D made only with code (three.js r160),
PS1/Roblox look: faceted flat-shaded shapes, small noisy pixel textures (NearestFilter), simple faces
with dot eyes, **soft realistic warm lighting** with soft shadows. Short shots (1–3 s), hard cuts,
punch-in zooms, small screen shakes, green wavy stink lines, sweat drops.

Reference look: the airplane-toilet reel the user loves. Contact sheets (2 frames/s) are at
`/tmp/ref/sheet0.png` … `sheet4.png` — open them with the Read tool and copy that look: faceted
low-poly people with realistic-ish proportions (not chibi), rectangular/dot black eyes, simple brows and
mouth, pixel-noisy textures on clothes/walls/carpet, soft warm light, shallow staging, close-ups.

## Files and owners (never edit a file you don't own)

| file | owner | what |
|---|---|---|
| `web/lib.js`, `web/layout.js`, `web/plan.js`, `web/main.js`, `render.mjs` | lead | shared toolkit, coordinates, shot plan, engine |
| `web/set.js` | set agent | dining room, furniture, food, props, lights |
| `web/characters.js` | characters agent | the 7 people, faces, poses, holding props |
| `web/fx.js`, `web/xray.js` | fx agent | stink lines, sweat, rumble rings, haze, x-ray scene |
| `web/shots_a.js` … `shots_f.js` | shot agents | a: s01–s05, b: s06–s10, c: s11–s15, d: s16–s19, e: s20–s23, f: s24–s29 |
| `make_sfx.py`, `mix.py` | audio agent | code-made sound effects + final mix at -14 LUFS |
| `make_captions.py` | captions agent | 2–4 word captions (ASS, Pixelify Sans, centre) |

If you need a change in a file you don't own, write it in your final report instead.
Do not `git commit` or push. Do not run full-video renders (the lead does that).

## Hard rules (the user rejected glitches before)

1. **Deterministic.** Never use `Math.random()`, `Date`, `performance.now()`. Use `rng(seed)`, `hash1`, `noise1`
   from lib.js. Every visual must be a pure function of time `t` (frames render out of order, in parallel).
2. **No z-fighting / flicker.** Never put two visible surfaces in the same plane. Decals/overlays (rug, runner,
   leaves, photos, napkins, gravy pool, labels) sit ≥ 3 mm above/in front of their surface and/or use
   `mat(..., {polygonOffset: 1})`. No overlapping coplanar box faces (e.g. a door frame flush with a wall).
3. **No interpenetration.** No body part, hand, head or prop goes through walls, table, chairs, plates,
   food or other people. Seated legs go *under* the tablecloth edge (cloth bottom is at y = 0.66).
4. **Camera never inside anything** and never closer than ~8 cm to a surface. Keep cameras inside the room box,
   below the chandelier (y < 1.9 within 0.6 m of the table centre), out of furniture volumes.
5. **Hands really touch what they hold** (grip contract below). **Faces face the camera in close-ups.**
6. Every shot must clearly show what the voice says at that moment (see `web/plan.js`).
7. **Captions are burned in the centre of the frame later** (white, ~110 px tall band at y≈50%). In close-ups,
   frame faces so eyes and mouth sit in the upper 20–45 % of the frame (not behind the caption band).

## Coordinates (`web/layout.js` is the single source of truth)

Meters, +Y up. Table centred at origin, long axis X: x ∈ [-1.3, 1.3], z ∈ [-0.55, 0.55], top surface y = 0.76,
cloth hangs to y = 0.66. Back wall (window, autumn tree outside) at z = -2.4, front wall (family photos over a
sideboard) at z = +2.6, side walls x = ±3.0, ceiling 2.7.

Seats (`SEATS`): back side facing +Z: **grandma** (-0.85), **you** (0), **cousinA** (+0.85);
front side facing -Z: **mom** (-0.85), **uncle** (0, chair 3 cm further back), **dad** (+0.85);
**cousinB** at the +X head (x = 1.72) facing -X. Chair seat height 0.46. Plates at `SEATS[x].plate`.
Serving dishes at `DISHES`. Grandma's standing spot `GRANDMA_STAND`, her chair slides to `GRANDMA_CHAIR_PULLED`.

## Engine (`web/main.js`)

Per frame at time t:
```
set.reset(t,ctx); cast.reset(t,ctx); fx.reset(t,ctx); xray.reset(t,ctx)   // defaults incl. story continuity
shots[ctx.shot.id].update(ctx)                                           // shot overrides
camera applied
set.commit(ctx); cast.commit(ctx); fx.commit(ctx); xray.commit(ctx)       // write params to meshes
render ctx.scene (default world.scene; x-ray shots use world.xray.scene) + post overlay
```
`ctx = { t, lt (time in shot), dur, u (0..1 in shot), shot (plan entry), W (world), THREE, camera, cam, post, line(i), word(i), ev(name) }`
- `ctx.cam.set({pos:[x,y,z], target:[x,y,z], fov, roll})`, `ctx.cam.shake(ampMeters, freqHz)`, `ctx.cam.punch(k)` (k>1 zooms in),
  `ctx.cam.handheld(radians)` (default 0.0025 drift; set 0 for locked shots).
- `ctx.post.vignette`, `ctx.post.dim` (0..1), `ctx.post.flash` (0..1) + `ctx.post.flashColor`.
- `ctx.line(i)` → voice line i (1-based) `{start,end,text,who}`; `ctx.word(i)` → aligned word i (0-based) `{w,s,e,line}`.
- `W` = `{scene, camera, renderer, set, cast, fx, xray}`.

## set.js → `buildSet(world)` returns
```
{ group, colliders: [{name, box: THREE.Box3 (world AABB), allow?: [characterName]}],
  props: {...}, anchors: {...}, state: {...}, reset(t, ctx), commit(ctx) }
```
- `colliders`: table top slab (y 0.66–0.765 over the table area), every chair seat + backrest, walls, sideboard,
  hutch, serving dishes. Used by the glitch audit (`node render.mjs audit`).
- `props` (all are children of a group at the world origin, so local transform == world transform; shots may set
  `.position/.quaternion/.visible` after reset):
  `chairs.{grandma,you,…}`, `yourPlate`, `turkey`, `turkeySlice` (the slice Grandma serves), `servingFork`,
  `potatoesBowl`, `bigSpoon` (+ child `spoonPotato`), `gravyBoat`, `yourFork`, `yourGlass`, `candles[]`,
  `thirdPlate`, `pie`, `rolls`, `beans`, `corn`, `cranberry`, and every diner's plate/fork/glass under `places.<name>`.
- **Grip contract** (holdable props: servingFork, bigSpoon, gravyBoat, yourFork, thirdPlate, family forks):
  `prop.userData.grip = { pos: [x,y,z], axis: [x,y,z], up: [x,y,z] }` in the prop's local space:
  `pos` = point the fist closes around, `axis` = handle direction pointing toward the working end
  (tines / bowl / spout), `up` = side the back of the hand faces. Two-hand props (thirdPlate) use
  `userData.grips = { L: {...}, R: {...} }`.
- `state` (reset every frame from t, shots may override before commit):
  `plate: {turkey: bool, potatoes: bool, gravy: 0..1}` (YOU's plate food), `forkFood: null|'turkey'|'potato'`,
  `spoonPotato: bool`, `gravyPour: 0..1` (stream from the boat spout to the plate), `glassRipple: 0..1`,
  `rattle: 0..1` (glasses/plates/cutlery jiggle), `candleFlicker: 0..1`, `chairOffset: {name: [dx,dz]}`,
  `thirdPlate: 'hidden'|'held'|'placed'`, `lightDim: 0..1`.
- **Continuity defaults in `reset(t)`**: turkey slice on YOU's plate from t ≥ 11.90; potatoes from 24.15;
  gravy grows 25.05→25.85 and stays; Grandma's chair pulled back for t ≥ 9.72; third plate placed (stacked on
  YOU's plate, raised so nothing intersects) from 45.80. YOU's fork rests at his place until a shot holds it.

## characters.js → `buildCast(world)` returns
```
{ characters: [Character], you, grandma, uncle, mom, dad, cousinA, cousinB,
  reset(t, ctx), commit(ctx), helpers }
```
- Character: `{ name, root, head, headRadius, p, headPos(), eyePos(), mouthPos(), bellyPos(), chestPos(), handPos('L'|'R'), seatPos() }`
  (`head` = THREE.Object3D pivot at the head centre, local +Z = where the face looks, +Y = up; fx attach sweat to it.)
  (positions are world `THREE.Vector3`, valid after commit; before commit use the seat-based estimates).
- `p` (reset every frame): `pos:[x,z]`, `rotY`, `sit` 0..1, `lean`, `leanSide`, `torsoYaw`, `headYaw`, `headPitch`,
  `headRoll`, `lookAt: [x,y,z]|null` (head + pupils aim there, within neck limits), `eyes:
  'open'|'wide'|'closed'|'happy'|'squint'|'stare'`, `pupils:[dx,dy]`, `brows: 'neutral'|'worried'|'angry'|'raised'|'sad'`,
  `mouth: 'neutral'|'smile'|'grin'|'open'|'laugh'|'o'|'grimace'|'tight'|'frown'|'chew'`, `talk` 0..1 (lip-sync open
  amount), `handL/handR: [x,y,z]|null` (palm target), `handPoseL/R: 'relaxed'|'flat'|'grip'|'point'|'fist'`,
  `gripL/gripR: prop | {prop, which:'L'|'R'} | null` (hand goes to the prop's grip and wraps it),
  `bounce` 0..1 (laugh bounce), `bellyWobble` 0..1, `legBounce` 0..1, `visible`.
- `reset(t)`: everyone seated at their seat with idle life (breathing, blinking from `hash1`, family eating and
  chatting loops with different phases). YOU sits still. **Continuity**: Grandma stands at `GRANDMA_STAND` for
  t ≥ 9.72 (her chair is pulled back by the set). From 40.38 everyone stops eating and looks at YOU.
- `helpers`: `eat(ch, phase, opts)`, `laugh(ch, t, amount)`, `talk(ch, t, intensity)`, `chew(ch, t)` — set p fields.
- Every mesh has a `name` (e.g. `you.forearmR`) for the audit.

## fx.js → `buildFX(world)` returns
```
{ reset(t,ctx), commit(ctx), stink(opts), sweat(opts), rumble(opts), haze(opts), glint(opts), steam(opts), impact(opts), lines(opts) }
```
Emitters are called by shots between reset and commit, every frame they should show:
- `stink({at:[x,y,z], amount:0..1, spread, height, seed, t})` green wavy stink lines rising (billboarded, pixel look).
- `sweat({ch, side:'L'|'R', t0, t})` drop pops on the forehead/temple at t0 and slides down (attached to head).
- `rumble({at, amount, t})` wavy rings/lines pulsing out from a belly. `haze({at, radius, amount})` faint green cloud.
- `glint({at, t})` glasses sparkle. `steam({at, amount, t})` white steam from hot food. `impact({at, t0, t})` small
  puff/motion lines when something lands. `lines({at, dir, t})` small action lines.

## xray.js → `buildXray(world)` returns
```
{ scene, reset(t,ctx), commit(ctx), anchors: {stomach, colon, mouth, exit}, state: {
  foodDrop: 0..1, splash: 0..1, zap: 0..1, alert: 0..1, squeeze: 0..1, flow: number (blob travel), glow: 0..1 } }
```
Separate THREE.Scene (own lights + dark blue background) with YOU's seated body as translucent x-ray shell and
cartoon organs. Shots s20–s22 set `ctx.scene = W.xray.scene` and aim the camera at its anchors.

## shots_*.js → `export const shots = { s01: { update(ctx) {...} }, ... }`

## Testing (always look at your renders with the Read tool)
```
cd /home/user/my-first-website./thanksgiving_reel
SCALE=0.5 node render.mjs view /tmp/<you>/ 3.0 '{"pos":[1.8,1.6,2.2],"target":[0,0.9,0],"fov":45}' name   # any camera at time t
SCALE=0.5 node render.mjs times /tmp/<you>/ 4.5 10.2                                                     # frames as the shots frame them
node render.mjs audit /tmp/<you>/audit.json 0.25                                                          # automatic glitch audit
USE=set,characters SCALE=0.5 node render.mjs view ...    # load only these real modules, stubs for the rest
```
Stubs live in `web/stubs/`. A module that throws falls back to its stub (error printed as `page: error [log] …`):
always check the output for `page errors: 0`. Use one render process at a time (4 CPUs are shared by several agents).
Target ≤ 1.5 s per full-size frame; keep the whole world under ~400k triangles; one shadow-casting light.
