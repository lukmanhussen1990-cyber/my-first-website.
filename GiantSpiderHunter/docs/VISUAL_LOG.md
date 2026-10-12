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
