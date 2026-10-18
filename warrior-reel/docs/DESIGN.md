# The Warrior Who Couldn't Forgive — production design contract

A ~60 s vertical (1080×1920, 30 fps) animated reel rendered **procedurally** with Three.js r169 in
headless Chromium (SwiftShader, software WebGL2). Every frame is deterministic: `APP.renderAt(t)`.
No external 3D assets — every model is built in code from primitives/custom geometry.

## Style target (match the reference, but more polished)
Reference frames: `/tmp/claude-0/-home-user-my-first-website-/8e87b992-8f6b-5beb-bf81-e714aaa05691/scratchpad/ref/full_*.png`
(e.g. `full_8.png` knight close-up, `full_25.png` Jesus close-up, `full_2.png` wide, `full_14.png` castle, `full_63.png` end card).

* Low-poly / voxel-inspired fantasy game look: faceted terrain and rocks, **pixel-art textures with
  `NearestFilter`** (crisp texels, dithered colour), saturated lime-green grass, bright cyan river,
  autumn trees with yellow/olive/orange blocky leaf clusters, white misty horizon, distant castle.
* Characters are smoother/more detailed than the world (like the reference), with good materials:
  weathered metal (MeshStandardMaterial metalness ~0.85, roughness 0.3–0.5, pixel-noise colour map,
  `scene.environment` reflections), cloth (roughness ~0.9).
* NOT photoreal, NOT anime. Think "premium indie medieval game cutscene".
* Improve on the reference: richer lighting, soft shadows, rim light, reflections, particles, depth.

## Units, axes, layout (world space)
* 1 unit = 1 m, +Y up. Ground is y = 0 in the acting area (|x| < 4, -3 < z < 1.6) — keep it flat there.
* Characters in rest pose face **+Z**. A character's LEFT is +X, RIGHT is -X.
* The main "frontal" camera sits at +Z looking toward -Z. Screen-right = +X.
* **River**: flows along X, between z ≈ +1.7 and z ≈ +3.6 near the action (may meander further away);
  water surface y ≈ -0.12; banks slope down into it.
* **Knight's rock (seat)**: centred (-0.55, 0, -0.05); seat top at y ≈ 0.48; ~0.75 m wide, mossy, purple-grey.
* **Jesus's seat**: a lower, flatter rock centred (0.80, 0, 0.05), top y ≈ 0.44.
* **Big autumn tree** behind them at about (0.6, 0, -2.6); more trees scattered, none within 1.2 m of seats.
* **Castle** on a hill, far across the river in the +Z direction, around (14, 0, 75) (seen in reverse shots);
  a second smaller ruin/towers silhouette in the misty -Z background is welcome.
* **Sun**: direction from the scene toward the sun ≈ normalize(-0.55, elevation, 0.45) — i.e. front-left.
  Daytime elevation ≈ 0.95 (high, soft), golden ending elevation ≈ 0.22 (low, warm orange).
* Jesus walks in along the near bank from x ≈ +5.5 (z ≈ 0.6) toward his seat.
* Ending: both STAND on the near bank, knight at about (-0.45, 0, 0.55), Jesus at (0.35, 0, 0.6).

## Rig (src/core/rig.js — owned by the integrator, do not change its API)
`new Humanoid(dims)` creates bones (THREE.Bone) named in `BONE_NAMES`:
hips, spine, chest, neck, head, shoulder{L,R}, upperArm{L,R}, foreArm{L,R}, hand{L,R}, thigh{L,R}, shin{L,R}, foot{L,R}.
* Every limb bone extends along local **-Y** from its joint; local **+Z** = front of the limb in rest pose.
* hips→spine→chest→neck→head go **up** (+Y). Head pivot = base of skull/top of neck.
* `rig.d` holds dims (upperArm, foreArm, thigh, shin, ankle, shoulderW, ...). `rig.standHipY` = hip height standing.
* Attach rigid meshes as children of bones (modelled in bone-local space).
* For deforming cloth (robe, cape, skirt) you may build a `THREE.SkinnedMesh` in root-local rest-pose
  space with skinIndex = `BONE_NAMES.indexOf(bone)` and call `rig.bindSkin(mesh)` after adding it under `rig.root`.
* The integrator animates characters with FK poses, `armIK/legIK`, `lookAt`, and `setWorldQuat`.

## Character module API (what the integrator will call)
Each character module exports a builder returning an object:
```js
{
  rig,               // Humanoid
  root: rig.root,    // add to scene, integrator sets position/rotation
  update(t, state),  // per-frame secondary motion (cloth sway, blinks...). `state` is a free-form object.
  // character-specific extras documented in the module header
}
```
**Knight** (`src/characters/knight.js`, `buildKnight()`): also returns
* `sword` — a separate THREE.Group (added to the scene by the integrator, NOT parented to the hand).
  Sword local frame: origin at the centre of the grip; **+Y toward the blade tip**; cross-guard along local X;
  flat of the blade faces ±Z. Export constants `SWORD = { tipY, guardY, gripHalf, pommelY, length }`.
  Realistic arming sword: total ≈ 1.05 m, blade ≈ 0.80 m × 0.05 m, fuller groove, steel; guard ≈ 0.22 m;
  grip ≈ 0.17 m wrapped dark leather; round/wheel pommel.
* `GRIP_R` — `{ position: Vector3, quaternion: Quaternion }`: the sword's transform **in handR-local space**
  when the right fist holds the grip (the fist must visibly close around the grip; no gaps/intersections).
* `POMMEL_L` — the LEFT hand's transform **in sword-local space** when the left palm rests on top of the
  pommel (sword point-down, both hands stacked on the hilt).
* Helmet is closed (visor with eye-slit/breaths); there is no face. Dark cape from the shoulders.
* State hooks: `update(t, { grip: 0..1 })` (fist tension; 1 = squeezing hard in the hook close-up),
  `{ seated: true|false }` lets the cape drape over the rock vs hang straight.

**Jesus** (`src/characters/jesus.js`, `buildJesus()`): also returns
* `setMouth(open 0..1)` — visible mouth opening through the beard (driven by the voice envelope),
* `setBlink(0..1)`, `setEyes(yawDeg, pitchDeg)` (optional), `setExpression({smile:0..1, brow:-1..1})` (optional),
* robe must look right **standing, walking and seated** (`update(t, { seated, walkPhase })`).
* Cream-white robe, red sash (over one shoulder, diagonally to the opposite hip), shoulder-length brown
  hair (centre part), full brown beard, warm skin, kind eyes, sandals.

**World** (`src/world/environment.js`, `buildWorld(stage)`): returns
```js
{ update(t, { mood /*0 day .. 1 golden*/, wind }),  sun /*DirectionalLight*/, groundHeight(x,z),
  seats: { knight: Vector3 /*seat top centre*/, jesus: Vector3 },
  focusShadow(center /*Vector3*/, radius) /* re-fit the sun shadow frustum for the current shot */ }
```
It owns: sky (gradient + soft clouds), fog, lights (sun with shadows, hemisphere, optional rim/fill),
`scene.environment` env-map, terrain, river (animated flow, foam edges, stones), rocks incl. both seats,
trees, grass/flower tufts (InstancedMesh), distant hills + castle, floating particles (dust motes,
pollen, a few butterflies), god-rays/light shafts that fade in with `mood`.

## Performance budget (SwiftShader software rendering!)
* Whole scene < ~350k triangles, < ~600 draw calls. Use `InstancedMesh` / merged geometry.
* One shadow-casting directional light, shadow map ≤ 4096². No real-time reflections/refraction passes.
* Textures small (16–128 px pixel-art canvases). Avoid per-frame geometry rebuilds of big meshes.
* Target ≤ ~1.2 s per 1080×1920 frame for the full film scene.

## Determinism
No `Math.random()` at render time and no wall-clock: use `rng(seed)` / `noise1` from `src/core/util.js`
and the `t` argument only.

## Tools
* Preview stills: `node render/shoot.mjs --q "entry=test&scene=<module>&..." --times 0,1 --views "az=0;az=90" --out out/previews/<you>/name --w 540 --h 960`
  then look at the PNGs (Read tool). Test-scene modules live in `src/test/<name>.js` and export
  `async build(stage, params) → { duration, update(t) }`; `src/test/studio_lib.js` gives a lit studio +
  orbit camera (params tx,ty,tz,az,el,dist,fov). `src/test/studio.js` is a bare-rig example.
* Timeline (timing truth): `timeline/timeline.json` (cues with word timings, beats).

## File ownership
* Integrator: `src/core/*`, `src/boot.js`, `src/film.js`, `render/*.mjs`, `timeline/*`.
* Knight builder: `src/characters/knight.js` (+ helpers `src/characters/knight_*.js`), `src/test/knight.js`.
* Jesus builder: `src/characters/jesus.js` (+ `src/characters/jesus_*.js`), `src/test/jesus.js`.
* World builder: `src/world/*`, `src/test/world.js`.
* Audio: `audio/*.py`, outputs in `out/audio/`.
* Subtitles/titles: `render/subtitles.py`, outputs in `out/subs/`.
Do not edit files you don't own; if you need a core change, describe it in your final report.
