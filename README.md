# Touchline ⚽

A full football (soccer) game that runs in the browser. Eleven a side, real
pitch dimensions, real rules — offside, throw-ins, corners, goal kicks, fouls,
cards, penalties and shootouts — with team AI that presses, marks, holds a line
and plays passes into space.

No downloads, no accounts, no assets to fetch: everything is drawn on a canvas
and every sound is synthesised at runtime.

## Play it

**Easiest:** open `touchline-standalone.html` — one self-contained file, works
by double-clicking it, offline, on any modern browser.

Or open `index.html` (same game, loads `styles.css` + `dist/game.js`). Or serve
the folder and visit it:

```sh
python3 -m http.server 8000    # then open http://localhost:8000
```

## Controls

| | Player 1 | Player 2 |
|---|---|---|
| Move | `WASD` or arrow keys | arrow keys |
| Pass · switch player | `Space` | `.` |
| Shoot (hold to charge) · tackle | `F` / `J` | `/` |
| Through ball · slide tackle | `G` / `K` | `,` |
| Sprint | `Shift` | `Right Shift` |
| Pause | `Esc` or `P` | |

Gamepads work too (left stick, A = pass, B = shoot, Y = through ball,
RT = sprint), as do on-screen touch controls on phones and tablets, where the
pitch turns side-on to fit a portrait screen.

Some things worth knowing:

- Hold up or down as you release a shot to place it inside the frame; hold left
  or right to bend it around the keeper.
- Through balls lead the run — play them *before* the runner is clear, not
  after.
- Slide tackles inside your own box concede penalties. Stand up.
- Sprinting burns the stamina ring around your player, and tired legs are slow.

## Modes

- **Quick Match** — pick both sides, difficulty, half length and formations.
- **Cup Run** — an eight-team knockout. You play your ties, the rest of the
  bracket is simulated. Level after full time and it goes to penalties.
- **Two Players** — same keyboard, one each.

## How it is built

Plain ES modules, no framework and no runtime dependencies.

| File | What lives there |
|---|---|
| `src/constants.js` | Pitch, ball, player and match tunables — all in metres and seconds |
| `src/ball.js` | 3D ball physics: drag, bounce, curl from spin |
| `src/player.js` | Player movement, stamina, slides, keeper dives |
| `src/team.js` | Formation shape that shifts with the ball and the scoreline |
| `src/ai.js` | Pressing, marking, off-ball runs, and the on-ball decision (shoot / pass / dribble / clear) |
| `src/match.js` | Rules engine: restarts, offside, fouls and cards, goals, the clock |
| `src/usercontrol.js` | Human input → football: switching, charged shots, through balls, tackles |
| `src/shootout.js` | Penalty shootouts, reusing the match and its physics |
| `src/renderer.js` | Canvas rendering and the chase camera |
| `src/audio.js` | Web Audio synthesis: crowd, whistles, kicks, the roar |
| `src/ui.js`, `src/main.js` | Menus, HUD and the frame loop |

The simulation runs on a fixed 60 Hz timestep, decoupled from rendering, so
physics behaves identically whatever the display refresh rate.

### Building

`index.html` loads a bundle so it also works straight off the filesystem, where
browsers block ES module imports. After editing anything in `src/`:

```sh
npm install     # esbuild, the only dev dependency
npm run build   # regenerates dist/game.js and touchline-standalone.html
```
