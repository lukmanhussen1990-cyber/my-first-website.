# my-first-website.

## DEEP DIVER — retro 2D underwater sub shooter

An endless side-scrolling arcade game in a **single HTML file**. No libraries, no
images, no audio files — every sprite is drawn with the Canvas 2D API and every
sound effect is synthesised with the Web Audio API, so it runs offline.

**Play it:** open [`index.html`](index.html) in any browser (desktop or mobile).

### Controls

| Action | Desktop | Mobile |
| --- | --- | --- |
| Move up | `W` / `↑` | touch the left half of the screen |
| Move down | `S` / `↓` | touch the right half of the screen |
| Fire | `Space` (the sub also auto-fires) | `FIRE` button |
| Pause | `P` / `Esc` | `II` button |
| Mute | `M` | pause menu |

### What's in it

- **9 enemy species** — small fish, large fish, jellyfish, pufferfish, barracuda,
  electric eel, shark, angler fish and squid, each with its own health, speed,
  score value and movement pattern.
- **6 hazards** — rocks, coral, sea mines, shipwreck debris, giant clams and
  seaweed walls. Mines and clams can be shot; the rest must be dodged.
- **6 weapons** — torpedo, double, triple, spread, rapid and laser.
- **9 power-ups** — health, shield, damage boost, speed boost, coin magnet,
  score multiplier, enemy freeze, extra life and weapon upgrades.
- **4 bosses** on rotation — Megalodon, the Kraken, Moon Terror and the Iron
  Leviathan — each with three attack phases and a health bar.
- Procedurally generated endless ocean with parallax scenery, particle effects,
  screen shake, camera smoothing, and a high score saved to `localStorage`.

### Implementation notes

The source is organised into commented sections (config, audio, input, pooling,
effects, actors, bosses, world, game, boot). Every spawned entity comes from an
object pool and physics runs on a fixed 1/60 s timestep, so the game holds a
steady 60 FPS with a flat memory profile on mobile.
