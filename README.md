# NEON SURGE

A pseudo-3D endless runner — dodge trains, chain near-misses, never stop.
Written from scratch: no engine, no libraries, no asset files, no network calls.

## Play

**One file, zero setup:** open [`neon-surge.html`](neon-surge.html) in any browser.
Or serve the source tree and open `index.html`.

## Controls

| | |
|---|---|
| `←` `→` / `A` `D` / swipe | switch lane |
| `↑` / `W` / `Space` / tap | jump (buffered + coyote time) |
| `↓` / `S` / swipe down | roll — in the air it becomes a dive |
| `Shift` / `H` / double-tap | hoverboard (survives one crash) |
| `Esc` / `P` | pause · `M` mute |

Gamepads work too.

## What's in it

- **Renderer** — perspective projection and painter's-algorithm shaded boxes on a
  plain 2D canvas: distance fog, a day/night cycle, a real 3D skyline plus two
  parallax silhouette layers, rain, and lamp/neon glow via cached sprites.
- **Track** — eleven weighted pattern generators (convoys, slaloms, roll tunnels,
  ramps into coin arcs, telegraphed oncoming trains) that thicken with distance.
- **Moves** — lane changes with lean, jumping onto and running along train roofs,
  ramps, dives, and near-miss chains that feed the multiplier.
- **Power-ups** — magnet, jetpack, super sneakers, 2× score, and time warp
  (the world slows; your score doesn't).
- **Progression** — coins, six upgrade tracks, five runners with perks, rolling
  mission sets that permanently raise the base multiplier, and a second chance
  on death. Saved to `localStorage`.
- **Audio** — every sound is synthesised at runtime through WebAudio, including a
  step-sequenced synthwave loop whose tempo and layering track your speed.

## Layout

    index.html        markup + screens
    css/style.css     UI shell
    js/util.js        math, colour, RNG
    js/save.js        localStorage, fail-safe
    js/audio.js       procedural SFX + music sequencer
    js/input.js       keyboard, touch/swipe, gamepad
    js/render.js      projection, boxes, fog, sky, skyline
    js/particles.js   pooled 3D particles
    js/world.js       track generation + environment drawing
    js/player.js      runner physics + articulated character
    js/missions.js    rolling objectives
    js/ui.js          HUD, shop, menus
    js/game.js        loop, collisions, scoring
    js/main.js        boot
    build.js          inlines everything into neon-surge.html

Run `node build.js` after editing the source to refresh the single-file build.
