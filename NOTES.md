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

## Later decisions (added during the run)
- **Combo**: fruit eaten within 4.2 s of the previous one raises a multiplier (×2…×4) applied to that fruit's points; the HUD chip drains and resets.
- **Snake skins** are independent of themes: "Auto" uses the theme's own skin; Viper / Coral / Rattler / King are always available.
- **Ambient sound** is a very quiet loop per theme (wind, water, synth hum). It starts after the first click/tap (browser rule) and obeys mute.
- **Grid size**: 24×15 on normal landscape screens; wider (up to 40 columns) when the window is much wider than tall; 13×(14…26) in portrait.
  The arrow pad sits at the right edge in landscape and under the board in portrait; the board leaves room for it.
- **Performance design**: the board (ground, frame, lighting) is painted once and copied 1:1 each frame; ambient effects (clouds, caustics, neon pulses,
  dark spotlight) run on a half-resolution overlay canvas at ~30 Hz; glows use cached soft sprites. A governor watches real frame times and sheds work in
  three steps: ambient effects + glow + blur → resolution cap 1.25× → 1×. Pixel budget for the canvas is 7.5 M device pixels.
- **Accessibility**: `prefers-reduced-motion` removes shake / hit-stop / confetti / title animation; every button is keyboard reachable with a visible focus ring.
- **Big screens**: cells grow up to 76 px and the HUD / cards / toast are zoomed (CSS `zoom`, 1× … 1.7×, from the window height) so they keep their proportion to the board on 1440p / 4K monitors.
- **Fruit variety** is cosmetic only (red / green / orange apples, same points). The golden fruit is always the metallic one.
- **Combo heat / golden gleam** are CSS-only edge glows (no canvas cost) and are switched off in lite mode and with reduced motion.
- The first snake option is called **Auto** (shorter than "Theme", fits 320 px phones).
- **Default theme** on a first visit is Forest (the most realistic board — the original brief was "realistic graphics"); the chips still list Classic first. The choice is remembered afterwards.
- **Turning round before the first move**: while the snake is waiting at the start, pressing the opposite direction flips it round instead of being ignored.
- **Not done on purpose**: online leaderboards or accounts (needs a server), background music (kept to quiet ambience), more themes than the five requested.
- The test hooks (`window.__viper`, `dbg.freeze`) stay in the file but do nothing unless called.

## Testing approach
- Headless Chromium (Playwright) from the sandbox: smoke test, scripted playthroughs, a logic fuzzer that
  checks invariants (no overlap, food never on snake, no 180° turns, collisions) and frame-time measurements.
- Screenshots are reviewed by eye after every visual change.
