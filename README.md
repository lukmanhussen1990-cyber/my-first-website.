# 🍄 Super Mario — Canvas Platformer

A complete, self-contained Super Mario–style platformer built with **vanilla
JavaScript** and the **HTML5 Canvas API**. No images, no libraries, no build
step — every sprite is drawn with code and every sound is synthesized live with
the Web Audio API.

## ▶ Play

Just open `index.html` in any modern browser, or serve the folder:

```bash
# from the project directory
python3 -m http.server 8000
# then visit http://localhost:8000
```

Or enable **GitHub Pages** on this repo (Settings → Pages) and play it straight
from the web.

## 🎮 Controls

| Action | Keys |
| ------ | ---- |
| Move   | `←` `→` or `A` `D` |
| Jump   | `Space` / `↑` / `W` — hold for a higher jump |
| Run / Fireball | `Shift` (or `K` / `J`) |
| Pause  | `P` |
| Mute   | `M` |

On phones and tablets an on-screen **D-pad + A/B buttons** appear automatically.

## ✨ Features

- **Tight platforming physics** — acceleration, friction, variable-height
  jumps, coyote time and jump buffering for a responsive feel.
- **Power-ups** — 🍄 Super Mushroom (grow) and 🌸 Fire Flower (shoot bouncing
  fireballs). Take a hit while powered up and you shrink instead of dying.
- **Enemies** — Goombas you can stomp, and Koopa Troopas that retreat into
  kickable shells which ricochet and take out other enemies.
- **Interactive world** — `?` blocks with coins & power-ups, breakable bricks
  (only when big), pipes, bottomless pits, and a flagpole finish with a time
  bonus.
- **3 hand-designed levels** — World 1-1, 1-2 and 1-3, each longer and trickier.
- **Lives, score, coins & timer** with a classic arcade HUD. Collect 100 coins
  for a 1-UP.
- **Synthesized audio** — jump, coin, stomp, power-up, fireball and level-clear
  sound effects plus a looping chiptune soundtrack, all generated in-browser.
- **Responsive & mobile-friendly**, rendered at a crisp pixel-art scale.

## 🗂 Project structure

| File | Purpose |
| ---- | ------- |
| `index.html` | Page shell, menus/overlays, and touch controls |
| `style.css`  | Layout, title screen, and control styling |
| `game.js`    | The whole game engine — physics, entities, levels, audio, rendering |

## 🛠 How it works

The engine runs a **fixed-timestep loop** (60 Hz physics with a render pass on
every animation frame) for consistent behaviour across devices. Levels are
described compactly as feature placements over an auto-generated ground, then
compiled into a tile grid. Collision uses swept axis-aligned bounding boxes
resolved one axis at a time. Everything you see and hear is generated at
runtime — the repo ships zero binary assets.

Enjoy, and watch out for that first Goomba! 🐢
