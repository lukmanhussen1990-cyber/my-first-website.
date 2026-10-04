# SHADOW BLADE: OLD CITY

A retro 2D stealth-action platformer in the spirit of 2007–2010 Nokia / J2ME mobile games, in **one self-contained HTML file** (`index.html`) — no images, fonts, audio files, libraries or network. All pixel art is generated procedurally on a canvas, and all sound effects and chiptune music are synthesised with the Web Audio API.

Open `index.html` in a browser (desktop or Android Chrome).

## Controls (Nokia keypad)

| Key | Action |
|-----|--------|
| 4 / 6 | Left / right |
| 2 | Jump, climb ladders, climb ledges |
| 8 | Crouch (sneak), drop through planks, climb down |
| 5 | Attack / interact (pull levers) / silent takedown from behind |
| 0 | Stealth action: hide in hay/barrels, takedown, throw a pebble to lure guards |
| * | Block (tap just before a hit to parry); `*` + 4/6 = dodge roll |
| # | Pause |
| 1 / 3 / 7 / 9 | Diagonals (jump-left, jump-right, crouch-left, crouch-right) |

Keyboard: arrows or WASD, Space, J = 5, K/X = 0, C/Shift = `*`, P/Esc = pause, numpad digits also work.
Touch: big translucent on-screen buttons (multi-touch), or switch on the fake phone frame and use its keypad. Fullscreen / phone-frame / sound toggles are in the top-right corner.

## Features

- Fake candy-bar phone frame with a clickable keypad, 240x320 virtual screen, crisp pixel scaling, optional LCD grid
- Guards with vision cones, light/shadow detection, suspicion meter, noise and body reactions, shouted alerts, pathfinding (ladders, drops), search and return-to-patrol
- Sword combos, block/parry, dodge roll, ledge grab, ladders, hiding, air/ledge/hidden takedowns, traps, levers/doors, moving and crumbling platforms, secrets, checkpoints
- Bosses (messenger duel, Warden and Vizier logic included in the engine)
- Adaptive chiptune music (calmer when unseen, urgent when hunted), progress saved in `localStorage`

## Status

Missions 1 (The Old Market) and 2 (Rooftop Pursuit) are playable. The engine already contains the systems for the remaining missions (fortress, prison, palace, Warden and Vizier bosses), but those levels are not built yet.
