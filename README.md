# Crossy Road — 3D Hopper 🐔

A self-contained, dependency-free clone of **Crossy Road**, built with pure HTML5 Canvas.
Hop your chicken across endless roads, rivers, and railways — dodge cars & trains,
ride logs across water, grab coins, and beat your high score.

## Play

Open **`index.html`** in any modern browser. That's it — no build step, no dependencies,
works offline.

## Controls

| Action | Keys |
|--------|------|
| Move forward | `↑` / `W` / tap / swipe up |
| Move back | `↓` / `S` / swipe down |
| Move left | `←` / `A` / swipe left |
| Move right | `→` / `D` / swipe right |

On phones an on-screen D-pad appears automatically.

## Features

- 2.5D chunky voxel graphics (front + top faced cubes), painter's-algorithm depth
- Four lane types: **grass** (trees & coins), **roads** (cars & trucks), **rivers**
  (floating logs — ride them or drown), and **railways** (trains with warning signals)
- Smooth hop animation, following camera, procedurally generated endless world
- Difficulty ramps up the further you go
- The eagle swoops if you idle too long
- Coins, high score (saved locally), WebAudio sound effects, mute toggle
- Fully responsive; touch, swipe, keyboard & mouse support
