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
