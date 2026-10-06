# PROGRESS

Running log. Newest entries at the bottom. Start: 2026-10-06 14:10 UTC.

## Baseline (before this run)
- `index.html` v1: realistic textured snake (Catmull-Rom ribbon + scale textures), procedural earth/stone board,
  4 animal skins, apples + golden apple, particles, synthesised sound, swipe + keyboard, attract-mode autopilot.

## Plan
1. Bug fixes + logic fuzz test
2. Graphics overhaul (theme engine, backgrounds, grid, glow, fruit, fonts)
3. Effects (particles, pop-ups, break-apart death, shake, fades)
4. Screens (animated title, pause, game over, animated buttons)
5. Themes: Classic, Neon, Forest, Ocean, Dark
6. Sound + mute
7. Score / saved best / pause
8. Difficulty
9. Mobile (swipe, on-screen arrows, sharp on hi-DPI)
10. Golden food, obstacle mode, wrap-around mode, speed ramp
11. Code cleanup
12. Full re-test, 60 FPS check
13. Graphics polish loops until time is up

## Log

### 14:14 — Task 1: bug fixes ✅
- Wrote a logic fuzzer (`tests/fuzz`, kept outside the repo): random key mashing, bursts, pauses, restarts; checks every frame
  for overlap, out-of-bounds, food/bonus on snake, 180° reversals, bad deaths, growth accounting, score going down.
  Result: 90 games / ~10k ticks / ~23k key presses → all invariants hold (the old rules were sound).
- Fixed UX edge cases: any legal key now starts the run (pressing the same direction used to do nothing),
  input queue 2→3 so quick U-turns are never dropped, keyboard mapped by physical key (WASD works on AZERTY too),
  400 ms lock after game over so panicky key mashing does not instantly restart, bonus-eaten counter added.
- Next: theme engine (Classic / Neon / Forest / Ocean / Dark): backgrounds, grid, glow, food + snake per theme.

### 14:33 — Tasks 2-5 (first pass): theme engine, new screens, modes ✅
- **Theme engine**: five themes (Classic lawn, Neon grid, Forest earth, Ocean seabed, Dark tiles). Each has its own board + frame,
  snake skin (chevron / hex / zigzag / banded / pearl patterns), eye style, food (apple / glowing orb / pearl / faceted gem),
  obstacle style, particle colours and UI colours. Themes cross-fade when switched.
- **Backgrounds**: animated per theme — drifting cloud shadows (Classic), pulsing neon grid + scan band (Neon), dappled light (Forest),
  caustics + fish shadows + bubbles (Ocean), roaming spotlight (Dark). Light grid lines on Classic / Neon / Dark.
- **Glow option** (bloom around snake + food, rim light) as a toggle; default on for Neon.
- **Snake**: eyes are live — pupils look at the queued turn / nearby fruit; per-theme body thickness and eye size.
- **Screens**: animated title (letters drop in, snake swoosh with a crawling dot), theme chips, difficulty + mode segmented controls,
  toggles, pause card with stats, game-over card with count-up score + NEW BEST badge. Buttons: hover lift, press squash, ripple, click sound.
  Overlays cross-fade instead of popping.
- **Death**: white/red strobe → snake bursts into capsule pieces → shake + dust → card fades in.
- **Modes**: Easy/Normal/Hard (speed, ramp, obstacles, points), wrap-around (snake drawn across the edge via clipped copies),
  obstacle mode (themed rocks/crystals/coral/obsidian; placement guarantees connectivity and no dead ends), golden bonus apple (countdown ring),
  speed meter + "Speed up!" toast every 5 apples. Best score stored per difficulty + mode.
- **Mobile**: on-screen arrow pad (auto on touch devices, toggle in menu), swipe, DPR up to 3 on small screens, haptics.
- Tests: fuzzer re-run in default / wrap / obstacles / hard+wrap+obstacles → all invariants hold; UI playthrough passes.
- Next: review each theme closely and polish, mobile pass (portrait + landscape screenshots), HUD/score polish, code cleanup.

### 14:50 — Task 12 (part): performance pass ✅
- Measured with a forced raster flush (software rendering = worst case): a full frame cost 25-110 ms at 2828×1768 px.
- Found and fixed: 1-px mismatch between canvas and scene image made every frame a 5-million-pixel resample (now an exact 1:1 copy, ~2 ms);
  opaque canvas; pixel budget instead of a flat DPR cap; pixel-aligned clips; glows use cached soft sprites instead of huge gradients.
- Ambient background effects (cloud shadows, caustics, neon pulses, dark spotlight) moved onto their own half-resolution overlay canvas,
  redrawn at ~30 Hz and blended by the compositor (plus-lighter for additive themes). Main canvas now ~9-12 ms in software (30-segment snake),
  i.e. comfortably 60 FPS on anything with a GPU. A frame-rate governor still drops glow/ambient effects (then resolution) automatically if a device is slow.
- Veil behind menus is a CSS layer (no per-frame cost). Fullscreen button, reduced-motion support, HUD legibility strip added.
- Tests: fuzz (default, wrap+obstacles) still green.
- Next: snake glint + death pieces polish, theme-specific eat particles, landscape/resize tests, FPS overlay, cleanup.

### 15:00 — Polish batch ✅ (game feel, skins, audio, fixes)
- **Game feel**: hit-stop freeze on impact, head "chomp" when eating, travelling glint along the scales, shockwave ring on every bite,
  theme-specific bite bursts (crumbs / bubbles / neon streaks), apple shine sweep, ready-ring around the waiting snake, new-best confetti.
- **Combo**: fruit eaten within ~4 s multiplies points (×2…×4) with a draining chip in the HUD.
- **Snake picker** restored: "Theme" (the theme's own skin) or Viper / Coral / Rattler / King on any theme.
- **Ambient sound** per theme (water, wind, synth hum) — very quiet, follows the mute button.
- **Layout**: wide landscape screens get a wider grid (up to 40 columns) so phones in landscape use their full width; arrow pad sits at the side.
- **Bug found by the audio test**: the menu overlay covered the mute / fullscreen buttons → HUD buttons now sit above the cards.
- Full regression (`tests/all.sh`: lint, fuzz ×4 configs, UI playthrough, mobile portrait/landscape/rotation, audio graph, perf) all green.
- Next: FPS overlay for verification, README, code tidy-up, more visual polish (neon/dark head, death pieces), final summary.

### 15:30 — More polish ✅
- Gamepad (d-pad / stick / A / Start), Share button (Web Share or clipboard), metallic golden fruit, ocean ripples, menu card tilt,
  golden-fruit expiry burst, theme cross-fade keeps running while paused, favicon + meta, FPS overlay (Shift+F), governor in all states.
- Added behavioural UI test (22 checks: keys, pause, focus, settings persistence, arrow pad), soak test (10 long AI games incl. wrap + obstacles:
  lengths 59-122, no NaN geometry, bounded particles) and a gamepad test with a mocked controller.
- Next: final cleanups, full re-test, summary; keep looking for visual polish while time remains.

### 15:35 — Review pass + theme previews ✅
- Full code read-through of the script: merged the two copies of the "frame shading" code into one shared `frameShade()`, simplified the
  start/restart key logic (`canStart()`), one `totalLength()` used by HUD, pause card, result card and share text
  (the pause card used to show a length that was one lower than the HUD while a meal was still travelling down the body).
- A fruit that is still dropping in now passes over the snake instead of under it.
- **Theme picker**: the plain colour dots became mini board previews (frame, ground, snake in the theme's own colours, and its fruit) drawn as inline SVG.
- Full regression (lint, fuzz ×4, playthrough, mobile, landscape, audio, perf) and the UI test (22 checks) pass; 60 s chaos run: no errors.
- Next: more in-game visual polish (look at every theme with fresh eyes), then another full regression.

### 15:47 — Graphics round 2 ✅
- **Fruit variety**: apples now come in red / green / orange (matching bite crumbs); the golden fruit flashes the screen edge gold when eaten.
- **Combo heat**: from ×3 the screen edge glows in the theme colour (CSS only, pulses while the combo is alive).
- **Neon**: every bite sends a shockwave through the glowing grid. **Dark**: a bite flares the gem's warm light.
- **Forest**: ferns grow out of the stone wall at the corners and along the edges (baked into the board, with soft shadows).
- **Ocean**: swaying kelp in the four corners.
- Heads are a little wider and more distinct on every skin.
- Small phones (≤ 420 × 660): the theme / snake rows no longer clip — the first snake option is now "Auto".
- Next: more fresh-eyes review, full regression, summary.

### 15:52 — Big screens, first impression ✅
- **Big monitors**: cells up to 76 px; HUD, cards and toasts scale up (CSS zoom, 1×–1.7×) with the window height, ripples are zoom-proof.
- **First visit** now opens in the Forest theme (the realistic one); forest floor painted around the stone wall.
- Waiting snake turns round when the opposite key is pressed (it used to ignore it, which looked like a dead key).
- Tests: UI test now 23 checks (turn-round added), fuzz knows about the turn-round; full regression green on the build before this batch.
