# Bedrock bone rotation conventions (verified)

Status: **VERIFIED** by forward kinematics with the viewer's Blockbench-exact import
conventions against the vanilla files of `bedrock-samples` tag `v1.21.0.26-preview`, and by
rendered images in `tools/viewer/proof/` (re-generate with `node tools/viewer/proof.mjs`).
The numbers below are printed by `proof.mjs` (file `proof/conventions_fk.json`).

All coordinates are **Bedrock JSON model space** (what you write in `.geo.json` /
`.animation.json`): units = pixels (16 px = 1 block), **+Y up, front = −Z** (head end),
**+X = the model's LEFT side** (vanilla zombie `leftArm` pivot is at x = +5; spider legs
`leg1/3/5/7` are at +X). Angles are the numbers you put in `rotation` (degrees).

## The sign table (what the animation agent needs)

| Bone extends along | Channel | Sign | Effect on the bone tip | FK proof (tip of a 10 px bone, rotation 30°) |
|---|---|---|---|---|
| **+X** (left leg) | rotation **Z** | **positive** | tip goes **DOWN** | (10,0,0) → (8.660, **−5.000**, 0) |
| **+X** (left leg) | rotation Z | negative | tip goes UP | |
| **−X** (right leg) | rotation **Z** | **negative** | tip goes **DOWN** | z = +30: (−10,0,0) → (−8.660, **+5.000**, 0) (up) |
| **+X** (left leg) | rotation **Y** | **positive** | tip swings **FORWARD (−Z)** | (10,0,0) → (8.660, 0, **−5.000**) |
| **−X** (right leg) | rotation **Y** | **negative** | tip swings **FORWARD (−Z)** | y = +30: (−10,0,0) → (−8.660, 0, **+5.000**) (backward) |
| **−Z** (forward, e.g. head/fang/neck) | rotation **X** | **positive** | tip pitches **DOWN** | (0,0,−10) → (0, **−5.000**, −8.660) |
| −Z | rotation Y | positive | tip swings toward −X (model's right) | (0,0,−10) → (−5.000, 0, −8.660) |
| −Y (hanging limb, zombie arm) | rotation X | **−90** | limb points **FORWARD (−Z)** | zombie hand (−6,12,0) → (−6, 22, −10) |

Summary in words:

* **Z rotation: positive lowers a +X (left) limb and raises a −X (right) limb.**
  (= right-hand rule about −Z.)
* **Y rotation: positive swings a +X (left) limb forward and a −X (right) limb backward.**
  (= ordinary right-hand rule about +Y.)
* **X rotation: positive pitches a forward-pointing (−Z) limb down; −90 lifts a hanging
  (−Y) limb to point forward.** (= right-hand rule about −X.)

This is exactly the expectation written in `docs/DESIGN.md` §3 — **confirmed, no changes**.
In particular the IK mapping in DESIGN §8 is correct: for left legs `hip y = yaw`,
`femur z = −α` (α = elevation, positive = knee up), `tibia z = −(θ2−α)`,
`foot z = −(θ3−θ2)`; right legs negate every one of those values (y and z).

## Order of rotations inside ONE bone

Bedrock (and Blockbench, three.js Euler order `'ZYX'` after the X mirror) applies a single
bone's rotation as **X first, then Y, then Z, all about the PARENT's axes** (extrinsic X→Y→Z;
matrix `M = Rz · Ry · Rx` in JSON space where `Rz(+)` turns +X toward −Y, `Ry(+)` turns +X toward
−Z and `Rx(+)` turns −Z toward −Y).
Consequence: if one bone gets both Y (yaw) and Z (elevation), the Z elevation is about the
parent's fixed Z axis, NOT about the yawed leg's own axis — e.g. rotation `[0,30,30]` on a
+X bone puts the tip at (7.500, −4.330, −5.000) instead of the "yaw then elevate in the leg's
plane" point (7.500, −5.000, −4.330). **Use separate bones** (hip = yaw only, femur/tibia/foot =
Z only, children of the hip) — the design's hierarchy does exactly this. A child bone's
rotation is applied in its parent's (already yawed) frame, so femur/tibia/foot Z rotations
bend the leg inside the yawed vertical plane.

## Closed-form FK for the leg chain (verified numerically against the renderer)

Leg of segment lengths L1 (femur), L2 (tibia), L3 (foot), hip pivot H, bind pose straight
along ±X. Bedrock values: hip `y = Y`, femur `z = Zf`, tibia `z = Zt`, foot `z = Zp`.

* Left leg (+X): elevations (positive = up) `e1 = −Zf`, `e2 = e1 − Zt`, `e3 = e2 − Zp`.
* Right leg (−X): `e1 = +Zf`, `e2 = e1 + Zt`, `e3 = e2 + Zp`.
* Reach `u = L1·cos e1 + L2·cos e2 + L3·cos e3`, height `v = L1·sin e1 + L2·sin e2 + L3·sin e3`.
* Tip (JSON px) relative to H:
  left `( u·cos Y, v, −u·sin Y )`, right `( −u·cos Y, v, +u·sin Y )`.

## Animation channel conventions

* `rotation` values from animations are **added** to the bone's geometry `rotation`
  (bind pose); `this` = the channel's value before this animation (bind + earlier animations).
  The vanilla spider uses `"45.0 - this"` to set an absolute angle.
* `position` values are added to the bone's pivot offset in JSON axes (+X = left, +Y up,
  +Z = back). Blockbench/three.js negate X internally; you never do.
* `scale` multiplies about the bone pivot.

## Vanilla cross-checks (rendered)

* `proof/vanilla_spider_default_pose_*.png` — `geometry.spider.v1.8` + `spider.tga` with
  `animation.spider.default_leg_pose` (+ `walk` sheet): all eight legs angle **down** from the
  body (pivot y = 9 → tips at y ≈ 1.4–1.5 px, i.e. on the ground) and splay forward
  (leg6/leg7 tips z ≈ −11.6) / backward (leg0/leg1 tips z ≈ +12.6), exactly like in game.
* `proof/vanilla_zombie_arms_forward_*.png` — `geometry.zombie.v1.8` + `zombie.png`,
  `rightArm`/`leftArm` rotation x = −90: both arms point **forward**, to the face side
  (hand at z = −10 while the face plane is z = −4).
* `proof/axis_test_*.png` — synthetic +X / −X / −Z bones with ±30° on each axis (red = +X
  bone, blue = −X bone, green = −Z bone; light ground grid; camera labels).
