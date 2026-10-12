# Visual log

Append-only. Each entry: role, what changed, evidence (image paths), open issues.

## Lead designer: plan v1 (2026-10-12)

* **Wrote** `docs/VISUAL_PLAN.md`. Its sections are GEOMETRY G1–G5, TEXTURE T1–T5, MOTION
  M1–M6, out-of-team requests, adopt/reject for variants/detail, and acceptance checks.
* **Did not edit any generator.**
* **Added scenarios** `tools/viewer/scenarios/small_stalker.json` (stalking, small_scale 0.03)
  and `giant_walk.json` (hunting at 2.5 b/s).
* **Main finding.** The references show 3-segment legs: a steep femur (60–75°), a tibia
  descending at 30–45°, and a long near-vertical metatarsus whose joint sits at about the body
  height. The current model has a vertical stilt tibia and an invisible 50 px foot.
  * Fix: L1/L2/L3 = 160/220/200, R = 270, FOOT_TILT 8, HIP_X 34, HIP_Z [-34,-16,2,20].
  * Body: the variants/detail body ×1.15, abdomen hang −14°.
  * Prototype evidence: `/tmp/claude-0/work/team/lead/target_sheet.png` (current | plan |
    reference) and `cmp_H.png`.
  * Prototype code: `/tmp/claude-0/work/team/lead/proto/` (`run.sh`, `H.json`).
* **Gait report.** `gen_client_gait_report.py` currently FAILS on the existing model: growth
  leaves feet off the ground (2.43 b), turn-in-place leaves feet up (2.36 b), and the small
  form slips. These are listed as M4.
* **For the orchestrator to relay** (BP files are not ours):
  * `geometry.js NEUTRAL_FEET_PX` is already out of sync with the client (HIP_X 22, R 170).
  * Recommend `smallScale` 0.03 instead of 0.075.

## Model builder: G1–G5 done (2026-10-12)

* **G1 leg constants**, set in `gen_geometry.py` and the constants block of `gen_client_anim.py`:
  * HIP_X 34, HIP_Z [-34,-16,2,20], L 160/220/200, R 270, FOOT_TILT 8.
  * `expected_pivots()` and the bounds check now use them.
  * Standing (k = 1): femur 60.5°, knee y 345, tibia −42°, ankle y 198, metatarsus 82°.
  * Every `foot_tip` y = 0 standing (`standing.json`) and stalking (`small_stalker.json`).
  * The 4 stance feet are at y = 0 in all 8 frames of `hunting_run.json` and all 4 of
    `giant_walk.json`.
* **G2 legs:** 8 cubes per leg (coxa, femur beam, knee 46, tibia 26, joint 32, metatarsus
  20, tarsus 14, claw 9 hooked 14°). The crest/fkeel planks and the tibia spike are gone.
* **G3 body:** ported from variants/detail with the plan's edits:
  * one rounding slab instead of the rings;
  * belly 156..188, keel 142..158, hang −14°;
  * chelicera 34, fang 16 + 14;
  * palp hanging segment 30, AME lens 7×7×4.
* **G3 scale:** BODY_SCALE 1.15 applied to the torso, head, fangs and abdomen. Pivots:
  head (0,212.6,−57.5), fangs (±13.8,178.1,−85.1), abdomen (0,214.9,43.7).
  * Measured lows: abdomen 103.4, fang tip 111.4, sternum 152.8.
  * **93 cubes.**
* **Fixes found while iterating:**
  * The hooked fang tips crossed the midline and interpenetrated. Tip offset 5 → 2 and
    z 38° → 30°, so the tips now end 2 px apart.
  * The eye-mound back face was over-stretched on `mound_side` (6.5 px/texel). It now
    uses `mound_top`.
  * AME_SOCKETS realigned to the new lens texels: (8,6,5,5) and (14,6,5,5) on `head_front`.
* **G4:** visible bounds 96/72/[0,34,0], `MAX_CUBES` 120.
* **G5:** `docs/MODEL.md` written; it states that it supersedes DESIGN.md §4. DESIGN.md
  itself is not edited.
* **gen_texture.py (for the painter):**
  * REGIONS now follow the T3 table: coxa_*, fem_*, knee*, tib_side/tib_under/tib_end,
    ankle_*, met_*, tar_*, claw_*.
  * Dead regions removed: crest, fkeel, tib1/tib2, foot, jaw, band, spike, spinner.
  * Body regions from detail added: mound_*, eye_bump, bump_side, palp_*, chel_*, spin_*.
  * The detail painters were ported for them, together with EYES / EYES_MOUND /
    EYE_REGIONS (40 glowing texels).
  * **The leg regions still use the OLD painter styles** (tib_upper, tib_lower, foot,
    coxa: mauve with specks). T1/T2 must replace them.
  * Distal end = high U on every mirrored leg region (`limb_region`), so the band U
    fractions of T2.3 apply directly.
* **Checks:**
  * gen_geometry "-> OK" (px/texel 1.15–5.17); validate.py 0 errors.
  * The gait report has the same pass/fail set as the lead's baseline (no regression);
    the M4 items are still open for the animator.
* **Evidence** (`/tmp/claude-0/work/team/builder/`):
  * `final_vs_target.png`: prototype H | build | reference;
  * `final_*.png`: 7 cameras;
  * `it2_run_side.png` and `it3_walk.png`: run and walk sheets;
  * `it3_a.png`: head and back views;
  * `it3_s.png`: small form.
* **Open for others:**
  * Texture T1–T5. The model is still mauve, and the knee and joint blocks need the T2.6 band.
  * Animator: the run abdomen pitch (M3). The front-pair tibia is still at −42°, while
    the thumbnail shows a near-horizontal "Π" lintel. If wanted, that is a pose choice
    (no geometry change needed).

## Texture painter: T1–T5 done (2026-10-12)

* **Rewrote `tools/gen_texture.py`** with new painters and palette. The infrastructure is
  kept: REGIONS, `layout()`, `build()`, `eye_texels()`, the region names and the `_f`
  mirroring. The old duplicate painter definitions are gone.
* **T1 palette:** exactly the plan's hex values, with one addition, a dim lateral eye
  `EYE_LAT` #710101. Measured region medians:
  * fem_side #785d4b, tib_side #755b4a, met_side #7b614f: R−G 26, G−B 17–18 (the old
    texture had G−B ≈ 5);
  * carapace #5a4435, abdomen #554032, undersides #8a6d56.
* **T2: one `p_beam()` for every long leg face**, with the distal end at high U.
  * `grain()`: smooth row tone, plus 3–4 stripes (1–3 texels, each fading along U, with
    an occasional 1-row step), plus 1–3 dark hairlines.
  * Low-frequency weathering mottle, and per-row fibre dashes at about ±4 %. These read
    as wood fibre up close and vanish at distance. There is no per-texel speckle.
  * At most 3 streaks; the slow U drift is ±4 %.
  * Light: top quarter ×1.06 and bottom quarter ×0.92. `*_under` ×1.18 for the wood but
    only ×1.06 for the bands, so the bands do not turn peach. The femur ramps 0.85→1
    over the first 15 % of U.
  * Edges: 70 % toward EDGE.
* **T2 tan bands** at the plan's U fractions (fem, tib, met; none on the tarsus or claw).
  Each is TAN with the grain kept at 30 %, with 1-texel TAN_EDGE borders and base ×0.9
  out to the beam end.
  * End faces: flat, with a lighter centre.
  * Knee and ankle blocks: KNEE grain, EDGE outline and a 2-texel tan band at 25 %.
  * Caps: flat #6a503e with an EDGE border.
  * Coxa: AO toward the body and a TAN_EDGE rim.
* **T3:**
  * Leg regions exactly as in the table.
  * Body regions enlarged from ~3.2 to ~2.6 px/texel, the same texel size as the legs.
    Head front and mound front stay at 2.3. The atlas is now 55 % used.
  * Found and documented (MODEL.md §5): on up faces, HIGH V = front. The carapace and
    abdomen painters flip with `front_high_v()`.
* **T4 body:**
  * Carapace: dome light, median groove, a straight cervical V, and radial grooves at
    6 % aimed at the 4 coxae per side (from HIP_Z).
  * Abdomen: dorsal plate with 4 forward-pointing chevrons at 8 % and a heart mark at
    the front; walls with a ×1.05→×0.9 gradient.
  * Undersides: plain UNDER.
  * The chelicerae were lifted to CHIT_M, and the spinneret holes softened.
* **T5 eyes:**
  * AME lenses: the whole face glows, with one highlight texel.
  * PME: 2×2 with a highlight. ALE and PLE: 2×2 in the dimmer `EYE_LAT`, no highlight.
  * Sockets: tight CHIT_D.
  * The cluster now reads as two bright median pairs instead of a grid of 8 red squares.
    There are still 40 glowing texels, and `eye_texels()` is unchanged in form.
* **gen_geometry.py: no change** (no region renames, no cube changes).
* **Checks:**
  * gen_texture: alpha {3: 40, 255: rest}. gen_geometry "-> OK" (px/texel 1.15–4.78).
  * gen_client_anim ran; validate.py 0 errors (only the 2 old pack_icon warnings).
  * standing `--report`: all `foot_tip` y = 0.
* **Iterations** (`/tmp/claude-0/work/team/painter/`):
  * it1: palette and beam painter; found the up-face V flip.
  * it2: no-shadow colour check.
  * it3: under-band fix, head and chelicera lift.
  * it4: eye kinds.
  * it5: fibre and hairlines, after matching close-up crops against
    `ref_thumb_detail.png`. The luminance std was already equal (23.6 vs 23.5); only the
    fine frequency was missing.
  * it6: far-shot check.
  * it7: carapace grooves, run sheet, small form, knee close-up.
* **Evidence** (`/tmp/claude-0/work/team/painter/`):
  * `final_before_after_ref.png`: columns old | new | reference; rows low_front, front,
    close-up.
  * `it6_vsref.png`: render vs reference, low_front / front / side.
  * `it7_knee_cmp.png`: reference knee vs ours.
  * `it5_grain_cmp.png`, `it7_run.png` (hunting_run), `it7_small.png` (stalker 0.03),
    `final_sheet.png` (6 cameras).
* **Viewer caveat (for whoever judges colour):** the viewer's sun comes from +Z, behind
  the spider, and the legs cast shadows on the body. The head front therefore renders
  ~40 % of its texture value (#251c16), while Bedrock gives N/S faces ~80 % and entities
  do not self-shadow. Judge body colour with `--no-shadows`, or on the back, side and top
  cameras.
* **Open:**
  * All 8 legs share one set of leg regions. Leg variants would fit in the free 45 % of
    the atlas, but need a geometry face-mapping change; I judged it low value because
    the bands sit at the same fractions anyway.
  * The eye glow colours follow DESIGN (#a60202 / #ff0e0e). Only their arrangement was
    changed.
