# NOTES — decisions & assumptions

Nobody can be asked questions during this long run, so every ambiguous call is written down here.

## Time box
- Started: 2026-10-06 14:10:46 UTC. Target end: about 18:10 UTC (4 hours).
- Work order follows the brief: bugs → graphics → effects → screens → themes → sound → score/pause →
  difficulty → mobile → new modes → cleanup → full re-test → then graphics polish loops until time is up.

## Deliverable
- The game stays **one self-contained file**: `index.html` (no external requests, no libraries, no web fonts).
- While developing, the source is kept as small parts outside the repo and assembled into `index.html` by a
  script; the repo only ever contains the finished single file (plus these two notes files).

## Assumptions / choices
- **Themes.** The first version's earthy realistic look becomes the **Forest** theme. **Classic** is a
  fresh green checkerboard lawn with a blue snake and red apples (the look most people picture for "classic snake").
  Neon, Ocean and Dark are new. Each theme owns: background + frame, snake skin, food style, obstacle style,
  UI accent colours and particle colours.
- **"Glow" option** is a global toggle (default on for Neon, off elsewhere) that adds a bloom around snake and food.
- **Fonts.** "Clean, modern font" is delivered with the system UI font stack (SF Pro / Segoe UI Variable / Roboto)
  styled with tight tracking and tabular numbers. Web fonts would break the "single offline file" rule.
- **Difficulty** changes start speed, speed ramp, top speed and obstacle count. High scores are stored
  separately per difficulty + mode, so scores stay comparable.
- **Wrap-around mode** removes the walls (snake re-enters on the opposite side). **Obstacle mode** adds
  static blocks (themed rocks/crystals/coral); the free space is always kept connected so a run can never be impossible at the start.
- **Game over** = flash, then the snake breaks into pieces + screen shake, then the result card fades in.
- **Mobile**: swipe always works; on-screen arrow buttons are shown by default on touch devices and can be toggled.
- Quality governor: if the real frame rate drops, expensive extras (glow, ambient particles) switch off automatically.
- Debug handle `window.__viper` is kept (small) because the automated tests drive the game through it.

## Testing approach
- Headless Chromium (Playwright) from the sandbox: smoke test, scripted playthroughs, a logic fuzzer that
  checks invariants (no overlap, food never on snake, no 180° turns, collisions) and frame-time measurements.
- Screenshots are reviewed by eye after every visual change.
