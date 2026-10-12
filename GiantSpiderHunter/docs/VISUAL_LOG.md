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
