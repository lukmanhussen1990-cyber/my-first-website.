# Giant Spider Hunter: visual plan (lead designer, v1)

This is the team's single source of truth for the "look like the references" pass. Execute the
sections **in priority order** (P1 before P2). Numbers are model px at giant scale 1.0 unless
stated otherwise (16 px = 1 block; the giant is shown at scale 1.4).

Before/after evidence (all under `/tmp/claude-0/work/team/lead/`):

* `target_sheet.png`: columns are current, prototype H (this plan) and reference. Rows are
  low_front vs thumbnail, front vs hero, and side vs video frame.
* `cmp_F.png`, `cmp_G.png` and `cmp_H.png` show the prototype from every camera.
  `cmp_small.png` compares the small form at 0.075 and 0.03.
* The working prototype is in `proto/`, a throw-away copy of `/tmp/claude-0/variants/detail`
  with the new leg code. Its `proto/tools/gen_geometry.py::leg_bones()` is a good starting
  point for the builder. Constants are in `proto/H.json`. Do NOT copy the proto texture: it is
  only a palette test.

---------------------------------------------------------------------------------------------

## 0. Diagnosis (measured, not guessed)

Pixel measurements are taken from `ref_giant_hero.png`, `ref_giant_walk.jpg` frames 1 and 3,
`ref_thumbnail.jpg` and `ref_video1_sheet.jpg`. In the table, h = hip/body-centre height
(206 px).

| quantity | references | current model | plan (prototype H) |
|---|---|---|---|
| leg read | **3 visible segments**: femur rises steeply, tibia descends outward, long near-vertical metatarsus | 2 segments: femur up, then a vertical stilt (`L3` = 50 is invisible) | 3 segments |
| knee height / h | 1.45 (walk1) to 1.76 (hero) | 1.64 | 1.68 (337–362 px) |
| tibia→metatarsus joint height / h | 0.76–1.03 | 0.24 (ankle near the ground) | **0.96** (190–214 px) |
| femur elevation | 60–75° | 31–38° | 58–64° |
| tibia angle | 30–45° below horizontal | 87–90° (vertical) | 38–44° |
| metatarsus | 75–85° from horizontal, splayed out | n/a | 82° (8° outward tilt) |
| foot span / h | 2.2–2.4 (front views) | 2.25 | 2.8 (575 px); a compromise to keep the tibia slope |
| thickness femur : tibia : metatarsus | 1 : 0.67 : 0.49 (thumbnail) | 1 : 0.63→0.53 : 0.37 | 1 : 0.68 : 0.53 (38 / 26 / 20) |
| body lowest point / h | ≈0.55–0.75 | 0.60 | 0.50 (abdomen tip) / 0.74 (thorax) |
| colour (sunlit leg, shader) | #6a5b56–#76635b median, tan bands #82756b→#a08c7a; under the blue sky tint it is warm taupe-brown | #715c57 mauve-grey, busy specks, seams and rings | base #7d6250 warm brown, clean grain, tan bands |
| small form | ≈0.5–0.7 block across beside a 1-block birch | 2.2 blocks across (`small_scale` 0.075) | 1.1 blocks at 0.03 |

The biggest visual gap is the leg structure (row 1). The fix needs no extra bones: the existing
`foot_xn` bone becomes a long metatarsus, and the 2-bone IK keeps solving femur and tibia. With
the new constants the reference "Π / M" arch appears from every camera (see `target_sheet.png`).

---------------------------------------------------------------------------------------------

## 1. GEOMETRY (`tools/gen_geometry.py`, model builder)

Hard constraints are unchanged: the same 39 bones and hierarchy, bind pose straight along ±X
with zero bone rotation, locators at the tips, format 1.12.0, per-face UVs, ≤ 120 cubes
(target **93–96**).

### G1 (P1). Leg constants: must be identical in `gen_geometry.py` and `gen_client_anim.py`

```
HIP_X  = 34                       # was 30 (body is 15 % wider)
HIP_Y  = 206                      # unchanged
HIP_Z  = [-34, -16, 2, 20]        # was [-30,-14,2,18]
K      = [1.08, 1.00, 0.96, 1.04] # unchanged
L1_BASE, L2_BASE, L3_BASE = 160.0, 220.0, 200.0   # was 240/290/50: femur / tibia / metatarsus+tarsus+claw
NEUTRAL_R_BASE = R_BASE = 270.0   # was 215
NEUTRAL_A = [52, 20, -16, -48]    # unchanged (keeps the script's terrain sampler angles)
FOOT_TILT = 8.0                   # (anim) metatarsus 8° outward from vertical, was 12
```

Update `expected_pivots()` (the 240/290/50, x 30 and z list are hard-coded there) and the
`verify()` visible-bounds check. The resulting standing pose (k = 1) has the femur at 60°, the
knee at y 345 and u 79, the tibia at −42°, the ankle at y 198 and u 242, and the metatarsus at
82°. At the extremes of the walk stance, d stays ≤ 342 against a dmax of 409, so there is no
IK clamping.

### G2 (P1). Leg cubes: 8 per leg, 64 in total

Thickness constants are in px. Pair 1 is +2 on the femur only.

```
COXA = 46        FEMUR_W = 36 (pair1 38)   FEMUR_H = 38 (pair1 40)   KNEE = 46
TIB  = 26        ANKLE_J = 32              MET = 20                  TARSUS = 14   CLAW = 9
CLAW_HOOK = 14°  (adopted from variants/detail)
```

The x ranges are measured outward from each bone's pivot (`limb(sign, a, b, base_x, …)`).

| bone | cube | x range | cross-section | faces (regions) |
|---|---|---|---|---|
| femur | coxa collar | −12 … 28 | 46 × 46 | coxa_side(+_f) / coxa_end |
| femur | femur beam | 20 … L1+12 | W × H above | fem_side, fem_top, fem_under (+_f) / fem_end |
| femur | knee block | L1−23 … L1+23 | 46 × 46 | knee (N/S/U/D), knee_cap (E/W) |
| tibia | tibia beam | −14 … L2+10 | 26 × 26 | tib_side (N/S/U), tib_under (D) (+_f) / tib_end |
| tibia | ankle joint block | L2−16 … L2+16 | 32 × 32 | ankle_side / ankle_end |
| foot | metatarsus | −6 … 0.82·L3 | 20 × 20 | met_side (N/S/U), met_under (D) (+_f) / met_end |
| foot | tarsus | 0.82·L3−3 … 0.95·L3 | 14 × 14 | tar_side (+_f) / tar_end |
| foot | claw (hooked) | 0.95·L3−2 … L3 | 9 × 9, rotation z = CLAW_HOOK·sign about its root | claw_side (+_f) / claw_end |

Remove the femur dorsal and ventral planks (`crest_*` and `fkeel_*`). The reference femurs are
plain beams, and the planks cost 16 cubes without being visible at distance. Do not adopt the
tibia spike or the tilted patella from variants/detail.

### G3 (P1). Body: adopt the variants/detail body, scaled by 1.15

Port these cubes from `/tmp/claude-0/variants/detail/tools/gen_geometry.py`:

* `torso_cubes()`, unchanged.
* `head_cubes()`: the head block, eye mound, two anterior-median-eye (AME) lens cubes and the
  pedipalps.
* `fang_cubes()`: chelicera plus a two-part fang.
* `abdomen_cubes()`: the petiole, front block, main bulb, belly, keel, rear taper, dorsal
  plate and the **pair** of spinnerets.

Then apply the following changes before scaling:

1. **Drop the two abdomen segment rings** (`band` cubes). Replace them with **one rounding
   slab** through the bulb, `ac(-55, 55, 194, 240, 78, 158, abd_end/abd_side/abd_top/abd_under)`.
   It is wider and shorter than the bulb, so the abdomen reads oval from the front and back.
2. Make the belly shallower: `ac(-40, 40, 156, 188, 74, 164, …)` (was 144..188). Make the keel
   `ac(-24, 24, 142, 158, 90, 150, …)` (was 124..146).
3. `ABDOMEN_HANG = -14.0` (was −28). The abdomen then sits behind the body instead of hanging
   to canopy height. The lowest point rises from 74 to 103 px.
4. Shorten the chelicera and fangs, which currently hang to y 95 like a beard:
   * chelicera height 46 → **34** (`py-26 … py+8`);
   * fang base 24 → **16** (`py-46 … py-30`), pivot at `py-32`;
   * hooked tip 18 → **14** (`py-58 … py-44`), pivot at `py-46`.

   The target is a fang tip no lower than y ≈ 110 after scaling (it is 95 in the prototype).
5. Shorten the pedipalp hanging segment from 42 to 30 (`ey-28 … ey+2`).
6. Shrink the AME lens cubes from 9 × 9 × 5 to **7 × 7 × 4** (x ±3 … ±10, y 216 … 223,
   z −81 … −77). The current eyes read as cartoon.
7. Scale. Add `BODY_SCALE = 1.15`. In `build()`, apply `p' = c + (p − c)·1.15` with
   c = BODY_PIVOT (0, 208, 0) to every cube origin, cube pivot and bone pivot, and multiply
   every size by 1.15. Do this for the torso, head, fang_l, fang_r and abdomen, but not root,
   body or the legs. Round to 0.05.
   * The bone pivots become head (0, 212.6, −57.5), fang_l/r (±13.8, 178.1, −85.1) and
     abdomen (0, 214.9, 43.7).
   * `expected_pivots()` must apply the same function.
   * Visible results: thorax 92 × 53 × 101, carapace 104 wide, abdomen bulb 115 × 71 × 120,
     head 62 × 55 × 35.

Cube count: legs 64 + torso 5 + head 8 + fangs 6 + abdomen 10 = **93**.

### G4 (P2). Bounds and checks

`VB_WIDTH, VB_HEIGHT, VB_OFFSET = 96, 72, [0, 34, 0]`. The span is 575 px (36 blocks), which
covers giant_scale 2.5. Keep `MAX_CUBES = 120` in verify, as variants/detail does.

### G5 (P2). Documentation

Record the new constants in `docs/MODEL.md`. Do not edit `docs/DESIGN.md` §4, which belongs to
the orchestrator; say there that MODEL.md supersedes it.

---------------------------------------------------------------------------------------------

## 2. TEXTURE (`tools/gen_texture.py`, texture painter)

Goal: **clean stripped-wood beams**. Smooth warm brown with soft lengthwise grain, a light tan
band near each end of every segment, thin darker edges, and no specks, plank seams, knots or
end-grain rings. All realism comes from colour, value and baked light (there are no shaders).
The atlas stays 256 × 256 RGBA. Alpha is 255 everywhere except glowing eye texels (alpha 3).

### T1 (P1). Palette, replacing the mauve-grey

| token | hex | use |
|---|---|---|
| WOOD_M | `#7d6250` | leg base |
| WOOD_D | `#6e5442` | dark grain stripe |
| WOOD_L | `#8f735c` | light grain stripe |
| STREAK | `#654c3c` | rare long dark streak |
| EDGE | `#4a3628` | 1-texel outline on every long edge and end column |
| TAN | `#b8997a` | joint band |
| TAN_EDGE | `#8a6c55` | 1-texel border on both sides of each band |
| END_FACE | `#5e4636`, centre `#6a503e` | E/W end faces (flat, no rings) |
| KNEE | `#735a48`, cap `#6a503e` | knee and ankle blocks |
| CHIT_M / D / L | `#5c4636` / `#4e3a2e` / `#6b5240` | cephalothorax, head |
| ABD_M / D / L | `#584233` / `#4a372c` / `#674e3d` | abdomen; folium chevrons in `#4a372c` |
| UNDER_D / L | `#82664f` / `#957660` | sternum, abdomen underside and every `*_under` region |
| FANG | `#2c2022`, tip `#6e2a20` | unchanged |
| EYES | `#a60202`, highlight `#ff0e0e`, socket `#1a0e0a` | DESIGN colours, alpha 3 |

Check the hue: R−G ≈ 25–30 and G−B ≈ 15–20. The current texture has G−B ≈ 5, which is why it
looks mauve.

### T2 (P1). Beam painter: one function for every long leg face

For a face of `w` × `h` texels with the distal end at high U, compute:

1. **Grain.** Each texel row V takes a tone from a smooth 1-D noise across rows: 3–4 stripes,
   each 1–3 texels high, mixing WOOD_D, WOOD_M and WOOD_L. Along U, modulate by a slow noise
   (period ≥ 16 texels, ±4 %). Add at most 3 STREAKs per face (1 texel high, 6–20 long, 8 %
   darker). There is no per-texel random speckle.
2. **Baked light.** Multiply the top 25 % of rows by 1.06 and the bottom 25 % by 0.92.
   `*_under` regions get ×1.18 overall, to counter Bedrock's dark bottom faces. Darken the
   first 8 % of U on the femur by ×0.85 (ambient occlusion at the body).
3. **Tan bands.** Bands are fractions of U; positions are computed so they sit just outside
   the joint blocks:
   * femur: 0.13–0.21 and 0.59–0.70;
   * tibia: 0.20–0.27 and 0.76–0.83;
   * metatarsus: 0.19–0.27 and 0.86–0.93;
   * tarsus and claw: no band.

   Each band is TAN with faint grain kept at 30 % contrast, plus a 1-texel TAN_EDGE line on
   each side. Between a band and its beam end, use base × 0.9.
4. **Edges.** Blend the first and last row and the first and last column 70 % toward EDGE.
5. **End faces.** END_FACE with a 1-texel EDGE border and a 2–4-texel lighter centre square.
6. **Knee and ankle blocks.** KNEE base with grain, an EDGE outline, and a 2-texel TAN band at
   25 % from one side. Caps (E/W) are flat `#6a503e` with an EDGE border.

Delete specks, `seams()`, `plank_rows`, knots, `end_grain` rings, light bevel highlights and
bristles from leg regions.

### T3 (P1). Regions for the new geometry

These cover ~2.4–2.8 px per texel on the k = 1 legs. Geometry verify allows 0.9–6. "(m)"
marks mirrored regions that also emit a `_f` copy.

| region | texels | covers (px) |
|---|---|---|
| coxa_side (m) | 16 × 18 | 40 × 46 |
| coxa_end | 18 × 18 | |
| fem_side (m) | 64 × 15 | 152 × 38 |
| fem_top (m), fem_under (m) | 64 × 14 | 152 × 36 |
| fem_end | 14 × 15 | |
| knee, knee_cap | 18 × 18 | 46³ |
| tib_side (m), tib_under (m) | 96 × 10 | 244 × 26 |
| tib_end | 10 × 10 | |
| ankle_side, ankle_end | 13 × 13 | 32³ |
| met_side (m), met_under (m) | 70 × 8 | 170 × 20 |
| met_end | 8 × 8 | |
| tar_side (m) | 12 × 6 | 29 × 14 |
| tar_end | 6 × 6 | |
| claw_side (m) | 6 × 4 | |
| claw_end | 4 × 4 | |

Region names are the contract with the builder. Agree on them by reading this table, not each
other's code. Remove regions nothing uses any more (crest_*, fkeel_*, tib1/tib2_*, foot_side,
band_*, spike_*). For the body, keep the variants/detail regions (coxa, mound, eye_bump,
palp_*, chel_*, spin_*) and resize them for ×1.15. Keep the head front at about 2 px per texel
so the eyes stay crisp.

### T4 (P2). Body surfaces

* Carapace: CHIT_M, a few straight plate seams (1 texel, CHIT_D), and faint radial striations
  from the fovea at 6 % contrast. EDGE outline, no light bevels.
* Abdomen: ABD_M with 3–4 forward-pointing chevrons in ABD_D (8 % contrast) on the dorsal
  plate. Side faces get a vertical gradient (×1.05 at the top, ×0.9 at the bottom).
* Undersides, sternum, belly, keel: UNDER_D–UNDER_L, with no busy plates.

### T5 (P2). Eyes

Use fewer, smaller eyes, which read as more real:

* AME lens cubes glow on their whole front face, with one highlight texel.
* ALE: 2 × 2 on the head front.
* PME and PLE: 2 × 2 on the mound front.
* Every other texel of the eye regions is socket or CHIT_D, at alpha 255.

Keep `eye_texels()` in sync for verify.

**Viewer caveat.** In the viewer, faces that point down get a dark green hemisphere tint
(`page.mjs` ground colour #4a5a3a), so the `low_front` view looks darker and greener than
Bedrock will. Judge colour on `three_quarter`, `side` and `top`. Judge silhouette on
`low_front` and `front`.

---------------------------------------------------------------------------------------------

## 3. MOTION (`tools/gen_client_anim.py`, animator)

### M1 (P1). Constants

Copy the G1 constants exactly: L1/L2/L3 = 160/220/200, R_BASE = 270, HIP_X = 34,
HIP_Z = [-34,-16,2,20] and FOOT_TILT = 8. `dmin` and `dmax` follow automatically.

### M2 (P1). Metatarsus swing tuck

With a long metatarsus, a fixed foot angle looks robotic. In the walk references the lifted
metatarsus swings inward under the knee. Per leg, before the IK:

```
t.tl = 8 - 22 * math.sin(t.w * 180) * v.move;          // deg, + = outward
t.au = math.sqrt(t.dx*t.dx + t.dz*t.dz) - L3 * math.sin(t.tl);
t.av = <terrain + lift + tremble> - v.hipy + L3 * math.cos(t.tl);
left : v.ft = t.t + (90 - t.tl);   right: v.ft = -t.t - (90 - t.tl);
```

These replace the constants `l3s`, `l3c` and `theta3`. The cost is +2 trig calls per leg.

### M3 (P1). Gait numbers

* `STRIDE_WALK, STRIDE_RUN = 140, 190`, `LIFT_WALK, LIFT_RUN = 70, 100`. The reference walk
  lifts the foot to about half the body height. Verified with this plan's constants: stance
  d ≤ 342 < dmax 409.
* Run body: `v.bob_px` run term −10 → **−14** px, with a bob of ±(3 + 4·run) unchanged.
* Abdomen: walk ±1.5° and run `-3 + sin(...)*2.5` (was −6 ± 5). The old −28° hang plus run
  −6 ± 5 tilts the abdomen to −39°, which looks broken in the run sheet.
* Torso run pitch 5 → 4°.

### M4 (P1). Make `python3 tools/gen_client_gait_report.py` pass

It currently fails on the existing model. The real bugs, in order:

1. **Growth.** After growing, feet are left 2.43 blocks off the ground ("settled |dy|"). The
   feet must land when `v.grow_w` → 0.
2. **Turn in place.** Feet stay 2.36 blocks in the air after the turn stops. The lift must
   decay with `v.move` and the swing must settle onto the stance.
3. **Small form.** Feet slip 0.56 blocks per stance (= 7.4 giant-equivalent) and lift only
   0.019 blocks. The gait is not tracking at small scale; check `v.move` and `t.use` scaling
   with `v.wpp`.
4. **Giant at 1.5–2 b/s.** No full stance happens inside the test window, because one half
   cycle is 140·1.4/16 = 12 blocks. Make the stride depend on speed:
   `S = 100 + 40·clamp(v.spd/(2·v.scale), 0, 1) + 50·v.run`. Target a step every 2.5–4 s at
   1.5 b/s and every ~1.5 s at 9 b/s. Only loosen the report's window if the motion looks
   right in `giant_walk.json` renders.

### M5 (P2). Attacks retuned for the long metatarsus (front pair; pair 2 joins attack_high)

* `attack_ground` (stab), 1.0 s total:
  * wind-up 0–0.35 s: femur +30°, tibia fold −25°, metatarsus fold +35° (tucked back), torso
    pitch −8° (rear up), body +12 px;
  * strike 0.35–0.50 s: femur −10°, tibia +20°, foot −15°, so the claw spears down about
    60 px ahead of the neutral foot;
  * recover 0.5–1.0 s.
* `attack_high`: the air-chase reference shows the legs arching over and around a flying
  player.
  * Pairs 1 and 2: femur +40°, hip yaw +20° forward, tibia −10°, metatarsus +50°, so the
    metatarsi hook inward and down like closing claws. Torso pitch −12°.
  * Peak at 0.45 s; close inward (hip yaw +30°) at 0.5 s; recover by 1.0 s.
* `death`: with the ankle at y ≈ 198 and the body dropping 150 px, the IK folds the legs up
  hard. Blend the foot tilt toward +40° with `v.dead_e` so the legs splay and curl instead of
  poking upward.

### M6 (P2). Stalk

The current −30 px crouch gives a femur near 86° and knees high above the body. That matches
the small stalker reference, so keep it. Add a slow (0.3 Hz) ±2° head yaw scan.

---------------------------------------------------------------------------------------------

## 4. Requests outside this team's files (relay via the orchestrator; do NOT edit BP)

* `packs/GiantSpiderHunter_BP/scripts/geometry.js` → `NEUTRAL_FEET_PX`. Use HIP_X 34,
  HIP_Z [-34,-16,2,20], `r = 270·k` and the same A. It is already out of sync today (22, 170
  and [-26,-12,2,14]), so terrain is sampled at the wrong points.
* `config.js smallScale` 0.075 → **0.03**. The reference stalker is about 0.5–0.7 block
  beside a 1-block birch; at 0.075 ours is 2.7 blocks across with the new legs.
  `tools/viewer/scenarios/small_stalker.json` already uses 0.03.

## 5. Variants/detail: adopt or reject

| part | decision |
|---|---|
| coxa collars | **adopt** |
| eye mound + AME lens cubes | **adopt** (lens 7 × 7 × 4) |
| pedipalps | **adopt** (shorter) |
| chelicera + two-part hooked fang | **adopt** (shorter, G3.4) |
| paired spinnerets | **adopt** |
| claw hook 14° | **adopt** |
| abdomen segment rings | reject; one rounding slab instead |
| tibia bristle spike | reject (reads as a stray stick; reference legs are clean) |
| tilted patella (KNEE_TILT) | reject (axis-aligned knee block reads right once posed) |
| femur dorsal and ventral planks | reject (also removed from the current model) |
| its texture (mauve, specks, seams) | reject; see T1/T2 |

## 6. Acceptance (every member checks before logging)

1. `gen_texture` → `gen_geometry` ("-> OK") → `gen_client_anim` → `validate.py` (0 errors).
2. `--report` on `standing.json`: all `foot_tip` y = 0. On `hunting_run.json`: the 4 stance
   feet at y ≈ 0 in every frame.
3. Renders at giant scale 1.4: `low_front`, `front`, `side`, `three_quarter`, `top` and
   `closeup`. Put them next to `target_sheet.png`: the 3-segment arch and the M from the front
   must be visible, knees at ~1.7 h and the second joint at ~h.
4. `gen_client_gait_report.py`: every M4 item passes.
5. Scenarios: `giant_walk.json` (2.5 b/s) for the walk sheet; `small_stalker.json` (scale
   0.03) for the small form.
