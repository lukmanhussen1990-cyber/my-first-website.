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

### 14:35 — Task 1: bug fixes ✅
- Wrote a logic fuzzer (`tests/fuzz`, kept outside the repo): random key mashing, bursts, pauses, restarts; checks every frame
  for overlap, out-of-bounds, food/bonus on snake, 180° reversals, bad deaths, growth accounting, score going down.
  Result: 90 games / ~10k ticks / ~23k key presses → all invariants hold (the old rules were sound).
- Fixed UX edge cases: any legal key now starts the run (pressing the same direction used to do nothing),
  input queue 2→3 so quick U-turns are never dropped, keyboard mapped by physical key (WASD works on AZERTY too),
  400 ms lock after game over so panicky key mashing does not instantly restart, bonus-eaten counter added.
- Next: theme engine (Classic / Neon / Forest / Ocean / Dark): backgrounds, grid, glow, food + snake per theme.
