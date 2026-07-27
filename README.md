# my-first-website.

## VOID PROTOCOL — a 3D shooter in one HTML file

Open `index.html` in any modern browser and play. No install, no build step, no
internet connection required.

Everything is generated in code at load time — wall textures, enemy sprites,
weapons, and all sound effects. There are no images, no audio files and no
libraries, so the whole game is a single self-contained file.

### Controls

| Input | Action |
| --- | --- |
| `W` `A` `S` `D` | move |
| mouse | aim (click once to lock the cursor) |
| left click | fire |
| `R` | reload |
| `1` `2` `3` / scroll | switch weapon |
| `Shift` | sprint |
| `Space` | dash (brief invulnerability) |
| `Esc` / `P` | pause |

On phones and tablets an on-screen stick, fire, reload and swap buttons appear
automatically; drag anywhere on the right side of the screen to look around.

### The game

Survive endless waves in a procedurally generated complex — a new layout every
run. Each wave sends more hostiles, and tougher ones start appearing as you go.

- **Grunt** — fast melee drone that rushes you.
- **Turret** — floating unit that fires energy bolts and backs away when you close in.
- **Brute** — heavy, slow, and takes a lot of killing. Shows up from wave 4.

Three weapons: the Pulse Pistol you start with, plus a Scatter Gun and Ripper
SMG found in the level. Pick up green diamonds for health and yellow ones for
ammo. Clearing a wave awards a bonus.

### How it works

The renderer is a classic DDA raycaster drawn to a 2D canvas: one vertical
texture strip per screen column, with a depth buffer so billboarded sprites are
correctly occluded by walls. Rendering happens at a reduced internal resolution
and is scaled up, which keeps it at 60 fps while giving it a crisp retro look.
