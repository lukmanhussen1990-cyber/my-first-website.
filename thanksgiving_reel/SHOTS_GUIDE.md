# Shot direction guide (for the shot agents)

Read CONTRACTS.md first. Each shot is `update(ctx)` in your `web/shots_X.js`; it runs after every module's
`reset(t)` (story continuity defaults are already applied) and before `commit`. Only override what the shot needs.

## The look (copy the reference airplane reel, /tmp/ref/sheet*.png)
- Deadpan documentary: mostly calm, slightly slow push-ins (2–6 % over the shot), locked or gently drifting
  camera (`ctx.cam.handheld(0.002)`), then sudden **punch-in zooms** (`ctx.cam.punch(1.15..1.35)` stepped on a beat,
  not eased slowly) and **small shakes** (`ctx.cam.shake(0.004..0.015)`) on the comedic beats.
- Short shots, hard cuts. Every shot must read in 0.5 s on a phone: one clear subject, uncluttered frame.
- Eye-level or slightly high angles for people; low angle for the chair/stink shot; top-down-ish for plates.
- Close-ups: face fills ~40–60 % of the frame width, eyes in the upper 20–45 % of the frame, face turned to camera
  (use `p.lookAt = camera position` or a point just beside it). Captions sit at y≈50 % – never cover eyes/mouth.

## Useful positions (world, meters)
- YOU seated: head ≈ (0, 1.17, -0.93), chest ≈ (0, 0.98, -0.95), belly ≈ (0, 0.82, -0.86), seat ≈ (0, 0.46, -0.95),
  plate (0, 0.77, -0.33). Uncle seated: head ≈ (0, 1.25, 0.95). Grandma standing (t ≥ 9.72): ≈ GRANDMA_STAND,
  head ≈ (-0.56, 1.45, -0.86). Use the characters' getters after a first commit if you need exact values:
  `W.cast.you.headPos()` etc. (they are valid for the previous frame / seat estimates in reset).
- Good camera spots: across the table facing YOU (x≈0.05–0.3, y≈1.15–1.3, z≈0.15–0.5, looking at his head);
  behind YOU's right shoulder (x≈0.35, y≈1.35, z≈-1.35) for over-shoulder; high corners for wides
  (e.g. (2.4, 2.1, 2.1) → (0, 0.8, 0)); side of YOU at belly/seat height in the gap between YOU's and
  cousinA's chairs (x≈0.42–0.5, z≈-0.7…-1.2). Never put the camera inside chairs, people, the table or above y=1.9
  near the chandelier. Check with `node render.mjs audit`.
- Tall candles stand at layout `DISHES.candles`. If one blocks a close-up, hide it for that shot only
  (`W.set.props.candles[i].visible = false`) or move the camera; never let it cover a face.

## Story continuity (already handled by module resets – do not fight it)
- YOU's plate: empty until 11.90, turkey after, + potatoes from 24.15, + gravy 25.05→25.85, third plate from 45.80.
- Grandma seated until 9.72, then standing beside YOU (her chair pulled back) for the rest of the video.
- From 40.38 everyone stops eating and stares at YOU.
- YOU wears the same expression baseline: nervous, rigid. Getting worse over time (more sweat, more stink).
- Stink lines: start at s01 (squeak 1.30) faint, grow through the video; strongest s18/s23; present (medium) at the end.

## Verify every shot before you finish
1. `SCALE=0.5 node render.mjs times /tmp/agents/<you>/ <t0+0.05> <mid> <t1-0.05>` for each shot (plus beat moments)
   and LOOK at each frame: is the subject clear, does it show exactly what the voice says, any glitch?
2. `node render.mjs audit /tmp/agents/<you>/audit.json 0.1` then filter to your shots' time ranges: fix every issue
   (camera too close / inside, body parts inside furniture).
3. Check continuity at your first and last frame against the neighbouring shots (positions, plate food, who stands).
4. Faces in close-ups face the camera; hands holding things really touch them; nothing pokes through anything.
