# EMBERLEAP

An original 16-bit-style side-scrolling platformer in **one self-contained HTML file**.

Open `index.html` in any modern browser. That's it — no build step, no server, no installs.

## What it is

Play as **Pip**, a plucky forest sprite, across 8 stages in 4 worlds, ending in a
three-phase boss fight against the Cinder Warden.

- **Fully offline.** No libraries, frameworks, external images, fonts, or network calls.
- **Everything is generated at runtime.** Every sprite, tile and background is drawn
  procedurally to canvas. All music and sound effects are synthesised with the Web Audio API.
- **Desktop + Android.** Keyboard, gamepad and multi-touch controls; the on-screen pad's
  size and opacity are adjustable.
- **Saves progress** to `localStorage` (unlocked levels, best scores, settings).

## Controls

| Action | Desktop |
|---|---|
| Move | Arrow keys / WASD |
| Jump | Space / Z — *hold for a higher jump* |
| Run, throw embers | Shift / X |
| Crouch, enter tunnels | Down |
| Climb | Up, on vines |
| Pause | P / Esc |

On mobile, rotate to landscape and use the translucent on-screen pad (multi-touch).

## Worlds

| | | |
|---|---|---|
| **1 · Green Valley** | 1-1 Sunny Hollow | 1-2 Hollowroot Caves |
| **2 · Sunset Ridge** | 2-1 Emberlight Bluffs | 2-2 The Long Climb |
| **3 · Misty Forest** | 3-1 Whisperwood | 3-2 Driftwater Run |
| **4 · Ember Fortress** | 4-1 Cinder Keep | 4-2 The Cinder Warden |

## Power-ups

**Growth Orb** (take an extra hit) · **Ember Bloom** (throw bouncing embers) ·
**Sky Feather** (glide) · **Star Pulse** (invincibility) · **Shield Bubble** (blocks one hit)

## Notes

All characters, enemies, music, artwork and level designs are original.

Settings → **Reset Save** clears all progress (with confirmation).
