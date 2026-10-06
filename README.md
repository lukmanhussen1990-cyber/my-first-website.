# Viper — a realistic snake game

A polished, self-contained snake game in **one file**: open [`index.html`](index.html) in any modern browser
(desktop or phone). No build step, no libraries, no network requests — everything (graphics, textures, sounds) is generated in code.

## Play

| Action | Keys / touch |
| --- | --- |
| Steer | Arrow keys or `W` `A` `S` `D` · swipe · on-screen arrow pad |
| Pause / resume | `Space`, `P` or `Esc` · pause button |
| Sound on / off | `M` · speaker button |
| Fullscreen | `F` · expand button |
| Next theme (menus) | `T` |
| Frame-rate readout | `Shift` + `F` (or open the page with `#fps`) |

Eat fruit to grow. Hitting a wall, an obstacle or yourself ends the run. Fruit eaten within ~4 seconds of each other builds a
**combo** (×2 … ×4). A **golden fruit** appears every few apples for a short time and is worth five times as much.
The snake speeds up as you eat; the speed meter in the HUD shows how fast it is.

## Features

- **Five themes** — Classic (striped lawn), Neon (glowing grid), Forest (earth + stone wall), Ocean (caustics, fish, bubbles), Dark (tiles + roaming light).
  Each changes the board, frame, snake, food, obstacles, particles, UI colours and ambient sound.
- **Realistic snake** — one smooth, tapered body drawn from a spline with scale textures, pattern, lighting and a soft shadow;
  head with live eyes (pupils look where it is going), blinking, tongue flicks, jaws that open for fruit, a gulp when it bites,
  and a slithering wave. Pick a skin independently of the theme: Theme · Viper · Coral · Rattler · King.
- **Modes** — Easy / Normal / Hard · Walls or Wrap-around · optional Obstacles · optional Glow (neon bloom) · high score saved per combination.
- **Effects** — particles, "+10" pop-ups, shockwave rings, screen shake, hit-stop and a game over where the snake strobes and breaks into pieces;
  cross-fading screens, animated title and buttons (hover, press, ripple), confetti on a new best.
- **Phones** — swipe or on-screen arrows, safe-area aware, sharp on high-DPI screens (up to 3×), wider board in landscape, haptics on Android.
- **Sound** — synthesised effects (eat, golden, level-up, crash, UI clicks) and quiet per-theme ambience, all behind the mute button.
- **Smooth** — movement is interpolated between grid cells; the board is a pre-rendered image, ambient effects live on a half-resolution overlay,
  and a frame-rate governor sheds effects and resolution automatically on slow devices.

## For developers

The script is organised in labelled sections (search for the `════` banners): helpers and audio · layout · themes and scenes ·
skin textures · head sprite · rules and AI autopilot · spine geometry and rendering · particles, fruit and obstacles · frame renderer ·
UI, input and main loop.

- Game rules run on a grid; rendering interpolates between the previous and current cell of every segment (`G.prev` → `G.snake`, `G.t`).
- `window.__viper` exposes the game state to automated tests; `__viper.dbg.freeze` pauses the real-time loop so a test can step it by hand.
- Settings and best scores are kept in `localStorage` (keys start with `viper.`).

See [`NOTES.md`](NOTES.md) for design decisions and [`PROGRESS.md`](PROGRESS.md) for the build log.
