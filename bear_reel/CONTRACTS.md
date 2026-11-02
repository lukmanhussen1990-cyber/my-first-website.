# Bear reel — build contracts (read this first)

Instagram Reel, 9:16, 1080x1920, 30 fps, 44.37 s: **"You just pooped in the forest."** A calm deadpan narrator tells
the story to "YOU": he pooped behind a tree, no toilet paper, uses a giant itchy leaf, a giant bear comes, sniffs,
walks toward him... twist: bears smell ~7x better than a bloodhound, it smelled him from miles away... the bear
smells him, its eyes water, it pinches its nose and runs away crying, even the birds leave.
**Silly, never gross**: YOU is only ever seen from the waist up or hidden behind the tree / bush.

Made only with code: three.js r160 (`node_modules/three`), rendered frame by frame in headless Chromium
(SwiftShader). Same engine and look as the previous reel (`thanksgiving_reel`, a copy is at
`/tmp/claude-0/-home-user-my-first-website-/ae8d2d41-ba2d-5e9b-ba60-e67745c20b0e/scratchpad/tg/thanksgiving_reel/` —
read its `web/*.js` for reusable code: `char_geo.js`, `char_tex.js`, `fx.js`, `set_tex.js`, `set_util.js`).

## The look (copy the reference reels)
Reference contact sheets (look at them with the Read tool):
`/tmp/claude-0/-home-user-my-first-website-/ae8d2d41-ba2d-5e9b-ba60-e67745c20b0e/scratchpad/ref/sheet_video_small.jpg`,
`sheet_final1.jpg`, `sheet_final3.jpg`, `effects_exam.jpg` (stink lines, crying tears, green fog ending).
- **Low-poly blocky 3D, PS1 / Roblox style**: chunky faceted shapes with visible flat polygons (`flatShading`),
  small low-res noisy pixel textures with `NearestFilter` (use `lib.js`: `noisyCanvas`, `tex`, `mat`, `matNoisy`,
  `paint`, `noise2`). Simple faces with black dot / rectangle eyes. Realistic-ish proportions, not chibi.
- **Soft realistic lighting**: one low warm sunset sun (layout `SUN`) with soft shadows (PCFSoft), warm haze,
  hemisphere fill, ACES tone mapping. Saturated but natural colours. Cute and funny.
- Effects are cartoon overlays in 3D: green wavy stink lines with a darker green outline, blue-white tear drops,
  white sweat drops, green fog.

## Engine (`web/main.js`, owner: lead)
Per frame at time t (frames render out of order, in parallel processes):
```
set.reset(t,ctx); cast.reset(t,ctx); animals.reset(t,ctx); fx.reset(t,ctx)     // defaults + story continuity
shots[ctx.shot.id].update(ctx)       (or web/tests/<name>.js update(ctx) when ?test=<name>)
camera applied
set.commit(ctx); cast.commit(ctx); animals.commit(ctx); fx.commit(ctx)          // write params to meshes
render + post overlay
```
`ctx = { t, lt (time in shot), dur, u (0..1 in shot), shot (plan entry), W (world), THREE, camera, cam, post, line(i), word(i), ev(name) }`
- `ctx.cam.set({pos:[x,y,z], target:[x,y,z], fov, roll, near, far, up})`, `ctx.cam.shake(ampMeters, freqHz)`,
  `ctx.cam.punch(k)` (k>1 zooms in), `ctx.cam.handheld(radians)` (default 0.0025 drift; 0 = locked).
- `ctx.post`: `vignette`, `dim` (black), `flash` (+`flashColor`), `tint` 0..1 (+`tintColor`, default stink green),
  `grey` 0..1 (colours drained). All 0 by default.
- `W = {scene, camera, renderer, set, cast, animals, fx}`.

## Hard rules
1. **Deterministic.** Never use `Math.random()`, `Date`, `performance.now()`. Use `rng(seed)`, `hash1`, `noise1`
   from lib.js. Every visual is a pure function of time `t` (never accumulate state between frames).
2. **No z-fighting / flicker**: no two visible surfaces in the same plane; decals sit ≥ 3 mm above their surface
   and/or use `mat(..., {polygonOffset: 1})`.
3. **No interpenetration** of characters/props with each other or with trunks/ground (feet ON the ground).
4. Every mesh gets a `name` (`'bear.headMesh'`, `'set.hideTree'` …). Transparent / effect meshes set
   `userData.noAudit = true`.
5. **Performance**: ≤ 1.5 s per full-size frame in SwiftShader, one shadow-casting light (the sun, owned by set),
   instancing for repeated things (trees, grass, needles). Whole world well under ~600k triangles.
6. Own only your files (table below). If you need something in a file you don't own, write it in your report.
   Do not `git commit` or push. Use at most ONE render process at a time (4 CPUs shared by several agents).

## Files and owners
| file | owner |
|---|---|
| `web/main.js`, `web/lib.js`, `web/layout.js`, `web/plan.js`, `render.mjs`, `web/stubs/*` | lead |
| `web/set.js` (+ `web/set_*.js` helpers) | set agent |
| `web/cast.js` (+ `web/char_*.js`) — YOU | lead |
| `web/animals.js` (+ `web/animal_*.js` helpers) — bear, bloodhound, squirrel, birds, map bear | animals agent |
| `web/fx.js` (+ `web/fx_*.js`) | fx agent |
| `web/shots_a.js` (s01–s10), `shots_b.js` (s11–s20), `shots_c.js` (s21–s29) | shots |
| `web/tests/<yourname>.js` | whoever writes it (module previews) |

## Coordinates: `web/layout.js` is the single source of truth (read it)
Meters, +Y up, ground y = 0 in the play area. YOU stands at `YOU_SPOT` (facing +Z) right behind/next to the big
pine `HIDE_TREE` (trunk on his right = screen-left from the front camera), with `HIDE_BUSH` in front of him
(hides him from the waist down, top at y 1.08). The bear comes from the north (+Z) along `TRAIL`
(`BEAR_PATH.start → branch → enter → stop → near → close`, then runs away to `exit`). The camp + tent are
behind YOU (−Z). The sun is low in the west (+X, slightly +Z). Cutaway clearing `COMPARE` (bear + bloodhound
side by side, facing +Z). Map shot: very high top-down view, YOU's tree at the bottom, `MAP_BEAR` far north
(z 92) poking out of the trees, the river crossing at z≈50–60.

## set.js → `buildSet(world)` returns (owner: set agent)
```
{ group, colliders: [{name, box: THREE.Box3}], props: {...}, anchors: {...}, state: {...}, reset(t, ctx), commit(ctx) }
```
- **World**: big forest (layout `FOREST`, ≈1000+ pines, instanced), dense and darker along the trail sides beyond
  z≈12 (the "dark trees" the bear walks out of), open `TRAIL` strip (moss, grass tufts, pine needles, a few rocks,
  fallen logs), `CLEARINGS` with no trees, gentle hills outside the play area, the river (`RIVER`), sky dome with a
  sunset gradient (`SKY`) + a glowing low sun disc toward `SUN.dir`, warm fog, god rays (transparent additive
  planes through the trees, controlled by `state.rays`), ferns, round bushes, grass tufts.
- **props** (shots may set `.position/.quaternion/.visible` after reset; all props live in world space):
  `hideTree` (the big pine, thick trunk with bark texture and low branches), `hideBush` (round leafy bush; reacts to
  `state.bushShake`), `leafBush` + `giantLeaf` (a GIANT fuzzy leaf, ~0.46 m long, on the leaf bush at
  `GIANT_LEAF.stem`; Group origin = stem point; `userData.grip = {pos, axis, up}` local: where a hand grabs the leaf
  edge), `tpTube` (an EMPTY brown cardboard toilet-paper tube, 10 cm long, Ø 4.4 cm, hidden by default;
  `userData.grip`), `tent` (small orange dome tent with poles, guy lines, a door flap), `branch` (dry branch on the
  trail at `BRANCH.pos`, `userData.halves = [a, b]`, snaps with `state.branchSnap`), `foreBranch` (a pine branch
  near `FORE_BRANCH` for the s28 camera; `userData.path(u)` → world point on top of the branch, u 0..1, where the
  squirrel runs), `sun` (DirectionalLight, the only shadow caster), `hemi`, `fill` (DirectionalLight, no shadow).
- **state** (reset every frame; shots override before commit):
  `fog: {color, near, far}` (default warm haze), `shadow: {center:[x,y,z], radius}` (the sun's shadow box follows
  this; default around YOU's spot), `fill: {dir, intensity, color}` (soft frontal fill for faces, default low),
  `exposure` (tone mapping exposure, default 1), `sunIntensity` (×), `skyDark` 0..1 (cooler, darker, scarier),
  `rays` 0..1 (god rays opacity), `bushShake` 0..1 (hide bush wobble + leaves jiggle), `branchSnap` 0..1,
  `leafTorn` bool (giant leaf no longer attached; shots move `props.giantLeaf`), `wind` (tree sway amount).
- `colliders`: hide tree trunk, other trunks near the play area, tent, rocks, logs (AABBs) for the audit.

## cast.js → `buildCast(world)` returns (owner: lead) — YOU
`{ characters: [you], you, reset(t, ctx), commit(ctx), helpers }`. YOU = young guy, medium-brown skin, messy
spiky dark-brown hair, bright red hoodie, dark jeans. `you.head` = Object3D pivot at the head centre (+Z = face
direction), `you.headRadius`, `you.headPos()`, `eyePos()`, `mouthPos()`, `handPos('L'|'R')`. `you.p` fields:
`pos:[x,z]`, `rotY`, `crouch` 0..1, `lean`, `leanSide`, `headYaw/Pitch/Roll`, `lookAt`, `eyes`, `brows`, `mouth`,
`handL/handR` targets, `gripL/gripR` props, `cheeks` 0..1 (puffed), `red` 0..1 (face turns red), `blush` 0..1,
`tongue` 0..1, `visible`.

## animals.js → `buildAnimals(world)` returns (owner: animals agent)
```
{ characters: [bear, dog, squirrel], bear, dog, squirrel, birds, mapBear, reset(t, ctx), commit(ctx) }
```
Every animal: `{ name, root, head (Object3D pivot at head centre, local +Z = where the face looks, +Y up),
headRadius, p, headPos(), nosePos(), eyePos('L'|'R'), eyeLocal('L'|'R') (eye point in head-local space),
mouthPos(), pawPos('FL'|'FR'|'BL'|'BR') }` (world THREE.Vector3, valid after commit).
- **BEAR** — the star. Giant brown bear, **cute but scary**: big round low-poly head, round ears, small black dot
  eyes with a tiny white highlight, lighter tan muzzle, a **big wet shiny black nose** (glossy, low roughness,
  with a specular highlight), shaggy brown pixel-noise fur (darker back, a few chunky fur spikes on shoulders/
  back), chunky body, thick legs, paws with dark claws, short tail. Size: ~1.55 m at the shoulder on all fours,
  ~2.8 m long, ~3.6 m tall standing on hind legs. Rig: spine (2–3 segments), neck, head, jaw, 4 legs with 2-bone
  IK + paws on the ground, ears, eyelids, brows (dark fur blocks), tail. `bear.p` (reset each frame to defaults):
  `pos:[x,z]`, `rotY` (0 faces +Z; walking toward YOU = Math.PI), `visible`, `scale`,
  `gait: 'idle'|'walk'|'run'|'biped_run'`, `phase` (gait cycle phase, shots drive it from distance travelled),
  `stance` 0..1 (0 all fours → 1 standing on hind legs, front paws up), `sit` 0..1 (sitting back on its butt,
  upper body upright, front paws free), `pawLift: {leg:'FL'|'FR', amount}` (one front paw held up mid-step),
  `headYaw`, `headPitch`, `headRoll`, `lookAt:[x,y,z]|null`, `neck` 0..1 (stretch forward/down to lean over a
  bush), `eyes: 'open'|'wide'|'closed'|'squeeze'|'happy'`, `brows: 'neutral'|'sad'|'worried'|'angry'|'raised'`,
  `mouth: 'closed'|'open'|'growl'|'wail'|'tremble'|'pressed'`, `ears` 0..1 (perked), `sniff` 0..1 (nostrils
  flare + nose twitches up), `cheeksIn` 0..1 (cheeks sucked in during a big sniff), `cheeksPuff` 0..1, `tears`
  0..1 (shiny tear pools well up in the eyes), `green` 0..1 (face/snout tinted sick green), `pawL/pawR:
  [x,y,z]|null` (front paw IK target in world space — e.g. pinch the nose: the paw tip reaches `nosePos()`),
  `pinch` 0..1 (paw pinches the nose: the IK target is the nose, claws closed around it), `flail` 0..1 (front
  legs/arms waving up high while running upright), `tailWag`, `breath` (idle breathing is automatic).
- **BLOODHOUND** `dog`: reddish-tan, very long droopy ears, wrinkly droopy face, sad eyes, ~0.65 m at the
  shoulder. Sits (default `sit: 1`). `p`: `pos`, `rotY`, `visible` (hidden by default), `headYaw`, `headPitch`,
  `lookAt`, `eyes: 'open'|'sad'|'closed'`, `brows: 'neutral'|'sad'`, `mouth: 'closed'|'open'`, `ears` (swing,
  automatic from head motion).
- **SQUIRREL** `squirrel`: small red squirrel with a big bushy tail. `p`: `pos:[x,y,z]` (feet, world),
  `rotY`, `visible` (hidden by default), `run` (cycle phase), `jump` 0..1 (leap pose), `tail` 0..1 (curl).
- **BIRDS** `birds` (small dark low-poly birds, flapping wings, instanced): call every frame you want them:
  `birds.burst({t, t0, trees:[[x,z],...], count:60, height:[9,15], dir:[x,y,z], speed, seed})` — a big flock
  bursts out of the treetops all at once at t0 and flies up and away (wings flap fast, slightly chaotic, they
  spread out); `birds.flyOff({t, t0, from:[x,y,z], count:5, dir, seed})` — a few birds fly off a branch;
  `birds.perch({points:[[x,y,z],...], t})` — birds sitting (small hops, head turns). Hidden when not called.
- **MAP BEAR** `mapBear`: a giant version of the bear's head + shoulders + front paws (reuse the bear's geometry
  and materials, uniform scale `MAP_BEAR.scale`) poking up out of the canopy at `MAP_BEAR.pos`, nose pointing
  toward YOU (−Z). `p: {visible (default false), pos, scale, headPitch, sniff}`, `nosePos()`.

## fx.js → `buildFX(world)` returns (owner: fx agent)
`{ reset(t,ctx), commit(ctx), ...emitters }`. Emitters are called by shots between reset and commit on every
frame they should show; reset hides everything (no state kept between frames). Effects face the camera
(billboards) unless noted, pixel look (small canvas textures with NearestFilter), `userData.noAudit = true`.
- `stink({at:[x,y,z], amount 0..1, spread, height, count, seed, t, scale})` — **green wavy stink lines** rising
  and swaying (light green core + dark green outline, like the references), fading in/out at the top.
- `stinkFlow({from:[x,y,z], to:[x,y,z], progress 0..1, t, count, seed, width})` — wavy green lines streaming
  from `from` into `to` (sucked into a nose), shrinking as they arrive.
- `trail({points:[[x,y,z],...], progress 0..1, t, width})` — long green wavy stink trail for the map shot (lying
  flat above the canopy, readable from very high: width several meters), revealed from the first point up to
  `progress`, with a brighter wavy head; dark outline.
- `haze({at:[x,y,z], radius, amount, t, seed})` — soft green stink fog clouds (big soft billboards).
- `sweat({ch, side:'L'|'R', t0, t, size})` — white/light-blue drop pops on the forehead/temple at t0 and slides
  down (attached to `ch.head`, uses `ch.headRadius`). `sweatBurst({ch, t0, t, count})` — big drops fly off the
  head in all directions (panic).
- `tears({ch, t0, t, amount, side})` — tear drops / streams running down from the eyes (`ch.eyeLocal(side)`),
  shiny blue-white. `cryTears({ch, t, amount, dir})` — **big blue cartoon tear streams** shooting backward/out from
  both eyes while running (like the crying kid in the reference).
- `itch({at, t0, t, radius, count, seed})` — red zigzag itch squiggles popping around a point.
- `swirl({to:[x,y,z], t, amount, radius, seed})` — small white curly air lines spiralling into a point (sniffing).
- `leaves({at, t0, t, count, spread, seed})` — leaves burst off a bush and flutter down.
- `splinters({at, t0, t, count, seed})` — wood splinters + bark bits flying from the snapping branch.
- `dust({at, t0, t, amount, seed})` — dust puffs (running feet, heavy steps).
- `needles({at, t0, t, count, seed})` — pine needles / dirt kicked up by a heavy paw step.
- `glint({at, t, size})` — small shine (eye glints in the dark, wet nose sparkle).
- `badge({text:'x7', at:[x,y,z], t0, t, size})` — the **"x7" sign**: chunky pixel text (font `Pixelify Sans`,
  already loaded) in yellow/white with a dark outline on a small burst shape; pops in with overshoot at t0 and
  wobbles a little. Must stay sharp and readable at 1080x1920.

## shots → `export const shots = { s01: { update(ctx) {...} }, ... }` (see `web/plan.js` for every shot)

## Testing (always LOOK at your renders with the Read tool)
```
cd /home/user/my-first-website./bear_reel
SCALE=0.5 node render.mjs view <outDir> 3.0 '{"pos":[2.5,1.6,6],"target":[0,1.1,0],"fov":45}' name   # any camera at time t
TEST=<yourtest> SCALE=0.5 node render.mjs times <outDir> 1.0 2.0     # your web/tests/<yourtest>.js drives poses + camera
USE=set,animals SCALE=0.5 node render.mjs ...                         # load only these real modules (stubs for the rest)
node render.mjs audit <outFile> 0.25                                  # glitch audit
```
A module that throws falls back to its stub and prints `page: error [log] module X failed to load` — always
check the output ends with `page errors: 0` for your module. `web/tests/<name>.js` exports `update(ctx)`; it
replaces the shot for every frame, so set the camera (`ctx.cam.set`) and poses there.
Output dirs: use your own folder under
`/tmp/claude-0/-home-user-my-first-website-/ae8d2d41-ba2d-5e9b-ba60-e67745c20b0e/scratchpad/agents/<you>/`.
