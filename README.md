# Crossy Road

An endless hop-across-the-traffic arcade game, built from scratch with plain
HTML, CSS and JavaScript. No frameworks, no build step, no image or audio
assets — the world is rendered box by box on a 2D canvas and every sound is
synthesised with the WebAudio API.

**Play it:** open `index.html` in a browser, or open the single-file build at
`dist/crossy-road.html` (one 87 KB file, works offline and straight off
`file://`).

## Controls

| Action | Keyboard | Touch |
| --- | --- | --- |
| Hop forward / back / left / right | `W A S D` or arrow keys | Swipe, tap the screen, or use the on-screen pad |
| Pause | `Esc` or `P` | Pause button |
| Restart | `Space` / `Enter` | Play again |
| Mute | `M` | Speaker button |

## The game

- **Roads** — cars, taxis, police cars, buses and trucks, in lanes that run
  both ways and get faster the further you go.
- **Rivers** — ride the logs, hop the lily pads, don't fall in. The current
  carries you, and the banks are fatal.
- **Railways** — a signal blinks and a horn sounds about a second before the
  train comes through at 25 units a second.
- **The eagle** — dawdle for eight seconds, or let the camera leave you
  behind, and it comes for you. A circling shadow warns you first.
- **Coins** collected on the way, plus a bonus for distance, unlock five more
  characters: a duckling, a frog, an alley cat, a penguin and a robot.

Best score, coins and unlocks persist in `localStorage`.

## How it works

| File | Role |
| --- | --- |
| `js/render.js` | The projection. A rotated axonometric camera (9° yaw, 54° elevation) with painter's-algorithm sorting — no z-buffer, so composite models batch their boxes and sort them along the true view axis before drawing. |
| `js/models.js` | Every prop: vehicles, trains, logs, lily pads, trees, coins, the eagle, and the ground of each row type. |
| `js/characters.js` | The six playable characters — one voxel skeleton, parameterised, rotated to face the hop direction. |
| `js/world.js` | Endless terrain. Rows are generated in *groups* (a 1–4 lane highway, a 1–3 lane river, a rail yard, a meadow) from a seeded PRNG, with rules that keep it fair: never a fully blocked row, never a river with nothing to stand on, never more than six hazard rows in a row. |
| `js/player.js` | Grid-based hopping with input buffering, log riding, and the death animations. |
| `js/game.js` | Loop, camera, collisions, particles, scoring. |
| `js/ui.js`, `js/main.js` | Menus and the character shop; input and bootstrap. |

Traffic is simulated by recycling: a vehicle that leaves the world re-enters
behind the tail of its lane with a fresh gap, so a lane holds a constant
number of objects however long you play, and rows far behind the camera are
pruned.

## Building the single file

```sh
node build.js              # → dist/crossy-road.html
node build.js --fragment   # → dist/fragment.html (no document shell)
```
