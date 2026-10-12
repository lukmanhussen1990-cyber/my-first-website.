# Giant spider model (`geometry.horror.giant_spider`)

This file is the authority for the geometry numbers. **It supersedes `docs/DESIGN.md` §4**
(leg lengths, hip positions, body pivots, cube list and visible bounds). DESIGN.md §4 is
left untouched and still describes the older 240/290/50 stilt legs.

Generator: `tools/gen_geometry.py` (writes
`packs/GiantSpiderHunter_RP/models/entity/giant_spider.geo.json` and runs `verify()`).
Units are model px at giant scale 1.0 (16 px = 1 block). +Y is up, the ground is y = 0,
forward is −Z and +X is the spider's LEFT. The giant is shown at `giant_scale` 1.4 by default.

## 1. Hard constraints (checked by `verify()`)

* Format 1.12.0, identifier `geometry.horror.giant_spider`, texture 256 × 256.
* Exactly 39 bones: `root > body > {torso > {head > fang_l, fang_r}, abdomen}` and
  `hip_xn > femur_xn > tibia_xn > foot_xn` (x = l/r, n = 1..4), the hips being children of `body`.
* Bind pose: every leg segment straight along ±X, with zero rotation on every bone.
  Locators `foot_tip_xn` sit on the foot bone at the leg tip.
* Every cube has 6 per-face UVs, each on a painted region of `gen_texture.layout()`, at
  0.9–6 px per texel.
* At most 120 cubes (`MAX_CUBES`). The current count is **93**.
* Visible bounds: width 96, height 72, offset [0, 34, 0] (blocks). The standing leg span
  is 575 px = 36 blocks at scale 1, so these bounds cover `giant_scale` 2.5.

## 2. Leg constants (identical in `gen_geometry.py` and `gen_client_anim.py`)

```
HIP_X  = 34            HIP_Y = 206            HIP_Z = [-34, -16, 2, 20]   (pair 1..4)
K      = [1.08, 1.00, 0.96, 1.04]             (per-pair length factor)
L1_BASE, L2_BASE, L3_BASE = 160, 220, 200     (femur / tibia / metatarsus + tarsus + claw)
NEUTRAL_R_BASE = R_BASE = 270                  (neutral foot radius from the hip, x k)
NEUTRAL_A = [52, 20, -16, -48]                 (deg from the lateral axis toward forward)
FOOT_TILT = 8                                  (anim: metatarsus 8 deg outward from vertical)
```

Bone pivots: hip = femur = (±34, 206, z_n). The tibia pivot (the knee) is L1·k further
out, the foot pivot (the tibia/metatarsus joint) is (L1 + L2)·k out, and `foot_tip` is
(L1 + L2 + L3)·k out, all along ±X at y 206.

Standing pose (k = 1, from the anim IK):

| joint | value |
|---|---|
| femur elevation | 60.5° |
| knee | y 345, 79 px out from the hip |
| tibia | −42° (descending outward) |
| tibia/metatarsus joint | y 198, 242 px out |
| metatarsus | 82° from horizontal, splayed 8° out |

* Knee height / hip height = 1.68. Joint height / hip height = 0.96 (references:
  1.45–1.76 and 0.76–1.03).
* At the extremes of the walk stance the reach stays ≤ 342 px, against an IK limit
  (`dmax`) of 409, so the legs never clamp.

## 3. Leg cubes (8 per leg, 64 in total)

The x ranges are measured outward from the bone's own pivot. All cubes are axis-aligned
in the bind pose except the claw.

| bone | cube | x range | cross-section (Y × Z) | regions (long faces / ends) |
|---|---|---|---|---|
| femur | coxa collar | −12 … 28 | 46 × 46 | `coxa_side`(m) / `coxa_end` |
| femur | femur beam | 20 … L1+12 | 38 × 36 (pair 1: 40 × 38) | `fem_side`(m) N/S, `fem_top`(m) U, `fem_under`(m) D / `fem_end` |
| femur | knee block | L1−23 … L1+23 | 46 × 46 | `knee` N/S/U/D / `knee_cap` E/W |
| tibia | tibia beam | −14 … L2+10 | 26 × 26 | `tib_side`(m) N/S/U, `tib_under`(m) D / `tib_end` |
| tibia | joint block | L2−16 … L2+16 | 32 × 32 | `ankle_side` / `ankle_end` |
| foot | metatarsus | −6 … 0.82·L3 | 20 × 20 | `met_side`(m) N/S/U, `met_under`(m) D / `met_end` |
| foot | tarsus | 0.82·L3−3 … 0.95·L3 | 14 × 14 | `tar_side`(m) / `tar_end` |
| foot | claw | 0.95·L3−2 … L3 | 9 × 9, rotated z = 14°·sign about its root (hooked inward) | `claw_side`(m) / `claw_end` |

Thickness ratio femur : tibia : metatarsus = 38 : 26 : 20 = 1 : 0.68 : 0.53, as in the
thumbnail reference. The femur has no dorsal or ventral planks; the reference femurs are
plain beams.

**UV orientation.** "(m)" marks a mirrored region: `<name>_f` is its horizontal flip.
`limb_region()` picks `<name>` or `<name>_f` per face so that the **distal end (toward
the foot) is always at high U**, on the left and right legs and on the north and south
faces. The texture painter can therefore place joint bands by U fraction:

| segment | tan bands (U fraction) |
|---|---|
| femur | 0.13–0.21 and 0.59–0.70 |
| tibia | 0.20–0.27 and 0.76–0.83 |
| metatarsus | 0.19–0.27 and 0.86–0.93 |

**Posed orientation.**

* Femur, knee and coxa rotate with the femur bone (about 60° up).
* The knee block, being axis-aligned in the bind pose, reads as a big angular knuckle at
  each M peak.
* When the metatarsus hangs, its bind `up` face (+Y) points outward, away from the body,
  and its `down` face points toward the body. The same holds for the tibia.

## 4. Body (torso, head, fangs, abdomen) with BODY_SCALE 1.15

The body parts are designed at the original size (the numbers in `torso_cubes()`,
`head_cubes()`, `fang_cubes()` and `abdomen_cubes()`). `build()` then applies
`p' = (0, 208, 0) + (p − (0, 208, 0))·1.15`, rounded to 0.05, to:

* every bone pivot, cube origin and cube pivot of `torso`, `head`, `fang_l`, `fang_r`
  and `abdomen`;
* every cube size, which is multiplied by 1.15.

`root`, `body` and the legs are not scaled. `expected_pivots()` restates the same formula.

| bone | pivot (after scaling) |
|---|---|
| torso | (0, 208, 0) |
| head | (0, 212.6, −57.5) |
| fang_l / fang_r | (±13.8, 178.1, −85.1) |
| abdomen | (0, 214.9, 43.7), every cube rotated X −14° (`ABDOMEN_HANG`) about it |

Cube list (sizes before → after ×1.15):

* **torso (5)**
  * thorax block 80 × 46 × 88 → **92 × 53 × 101**;
  * lower taper 56 × 16 × 70;
  * carapace shield 90 × 10 × 74 → **104 wide**;
  * thoracic ridge 22 × 7 × 54;
  * sternum keel 36 × 12 × 52, lowest point y 152.8.
* **head (8)**
  * head block 54 × 48 × 30 → 62 × 55 × 35;
  * eye mound 34 × 12 × 18, carrying the posterior eye row;
  * two anterior-median-eye lens cubes, 7 × 7 × 4 at x ±3…±10, y 216…223, z −81…−77.
    They stand 3 px out of the head front, and their whole front face glows;
  * two pedipalps of two cubes each: a 38 px segment held forward-down at 40°, then a
    30 px hanging segment.
* **fang_l / fang_r (3 each)**
  * chelicera 18 × 34 × 24 (py−26…py+8), leaning forward 8°;
  * fang base 9 × 16 × 9 (py−46…py−30), pivot py−32, rotated (14, 0, ±16);
  * hooked tip 6 × 14 × 6 (py−58…py−44), pivot py−46, rotated (26, 0, ±30), offset 2 px
    inward. The two tips end about 2 px apart at the midline instead of crossing.
  * Lowest fang point: y 111.4.
* **abdomen (10)**
  * petiole 28 × 22 × 16;
  * front block 66 × 56 × 24;
  * main bulb 100 × 62 × 104 → **115 × 71 × 120**;
  * rounding slab 110 × 46 × 80 (`ac(-55,55,194,240,78,158)`), which makes the abdomen
    read oval from the front, back and top;
  * belly 80 × 32 × 90 (y 156…188);
  * keel 48 × 16 × 60 (y 142…158);
  * rear taper 70 × 66 × 26;
  * dorsal plate 66 × 7 × 76;
  * paired spinnerets 9 × 12 × 20.
  * Lowest abdomen point: y 103.4 (it was 74 with the old −28° hang).

The eye layout lives in `gen_texture.py`:

* `EYES`: the ALE on `head_front`;
* `AME_SOCKETS`: dark rings behind the lens cubes, at texels (8, 6, 5, 5) and
  (14, 6, 5, 5) of the 27 × 24 `head_front`;
* `EYES_MOUND`: the PME and PLE on `mound_front`;
* `eye_bump`: fully glowing.

`eye_texels()` covers all of them for verify (40 glowing texels).

## 5. Texture regions used by the geometry

`gen_texture.REGIONS` defines every region below. `docs/VISUAL_PLAN.md` T3 is the naming
contract.

* **Legs:** `coxa_side`(m) 16×18, `coxa_end` 18×18, `fem_side`(m) 64×15, `fem_top`(m) and
  `fem_under`(m) 64×14, `fem_end` 14×15, `knee` and `knee_cap` 18×18, `tib_side`(m) and
  `tib_under`(m) 96×10, `tib_end` 10×10, `ankle_side` and `ankle_end` 13×13, `met_side`(m)
  and `met_under`(m) 70×8, `met_end` 8×8, `tar_side`(m) 12×6, `tar_end` 6×6,
  `claw_side`(m) 6×4, `claw_end` 4×4.
* **Body:**
  * thorax: `tor_*`, `tor2_*`, `cara_*`, `ridge_*`, `stern_*`;
  * head: `head_front` 27×24, `head_side`, `head_top`, `head_under`, `mound_front` 17×6,
    `mound_side`, `mound_top`, `eye_bump` 4×4, `bump_side`;
  * palps and fangs: `palp_long`, `palp_vert`, `palp_end`, `chel_front`, `chel_side`,
    `chel_end`, `fang_*`, `fangtip_*`;
  * abdomen: `petiole`, `abd_*`, `abd1_*`, `abd3_side`, `belly_*`, `keel_*`, `abd_plate*`,
    `spin_side`, `spin_end`, `spin_top`.

## 6. Verification

```
python3 tools/gen_texture.py
python3 tools/gen_geometry.py        # must end "-> OK"
python3 tools/gen_client_anim.py
python3 tools/validate.py            # 0 errors
node tools/viewer/render.mjs --rp packs/GiantSpiderHunter_RP --entity horror:giant_spider \
  --scenario tools/viewer/scenarios/standing.json --camera low_front --frames 1 \
  --width 960 --height 540 --out /tmp/x.png --report /tmp/feet.json   # all foot_tip y = 0
```
