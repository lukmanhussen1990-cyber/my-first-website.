# The Backrooms — a 3D horror game in one HTML file

Endless yellow office rooms, damp carpet, buzzing fluorescent lights… and something tall that hunts you.

## How to run
- **Just open `index.html` in a modern browser** (Chrome, Edge, Firefox, Safari — desktop or phone).
  No install, no build, no server. Three.js is loaded from a CDN, so you need an internet connection.
- Click **NEW GAME**. Headphones are strongly recommended (sounds are positional).
- If your browser blocks things on `file://`, you can also serve the folder:
  `npx serve .` or `python3 -m http.server`, then open the printed address.

## Controls
| Action | Keyboard / mouse | Phone / tablet |
|---|---|---|
| Move | W A S D / arrow keys | left-thumb joystick (appears where you touch) |
| Look | mouse (click the game to lock the pointer) | drag on the right side |
| Run | hold Shift | hold RUN |
| Crouch | C (toggle) | CROUCH |
| Flashlight | F | LIGHT |
| Hold breath | hold Space | hold BREATH |
| Put a note away | E / Enter | tap the note |
| Pause | Esc (or P) | II button |

Gamepads work too: left stick move, right stick look, RT run, RB hold breath, A crouch, X flashlight, Start pause.

## Goal
Find the **5 notes** pinned around the maze — they crackle with radio static, and the **STATIC** meter under
the notes counter shows how close the nearest one is. Then find the **EXIT** door (it hums) to escape.
Escape Level 1 to unlock **Level 2 (The Flooded Halls)** and **Endless** mode (pages never stop; how many can you
grab before it gets you?), then escape Level 2 to unlock **Level 3 (Lights Out)**.

## Survival tips
- It **hears** running from ~20 m, walking from ~6 m, crouching barely at all (water makes everything louder).
- It **sees** you better in light and when your flashlight is on. Crouching in the dark makes you hard to spot.
- When the lights start to stutter and the screen glitches, it is close.
- If it spots you: break line of sight, get into the dark, crouch, and hold your breath when it is right there.
- Stamina and flashlight battery are limited; spare batteries lie on the floor.

## Features
See `PROGRESS.md` for the full build log. Highlights:
- Endless, deterministic, always-connected maze streamed in chunks; 6 room types (rooms, tight corridors,
  huge tall-ceiling halls, pillar rooms, office blocks, long walls).
- Procedural canvas textures (wallpaper, carpet, ceiling tiles, tiles, decals) and fully procedural
  Web Audio sound (fluorescent buzz, footsteps, distant noises, heartbeat, creature, music).
- Custom shaders: baked per-vertex fixture lighting with wall occlusion that still flickers/dies at runtime,
  flashlight, fog, water with fake reflections, bloom, film grain, vignette, chromatic aberration, VHS glitches.
- A hunting creature with sight/hearing, A* pathfinding, chase/search states and a jump scare.
- Scripted scares: lights going out one by one, slamming doors, footsteps behind you, phantoms, whispers.
- Menus, pause, settings (difficulty incl. an Explore mode with no creature, mouse speed, invert Y, FOV, brightness, volume, graphics quality, head
  bob, captions, reduce flashing), save/continue, best times, three levels + endless mode, phone touch controls, gamepad.
