# my-first-website.

An animated explainer: **Photosynthesis — how sunlight becomes food.**

Open `index.html` in any browser. Everything is drawn live in SVG + `<canvas>` —
no images, no libraries, no build step.

## What you see

- **The scene** — sun, clouds, hills and a swaying plant with roots, stem and leaves.
- **Molecules that actually move** — photons stream from the sun into the leaves,
  CO₂ drifts in from the air and slips into the stomata on the leaf's underside,
  water rises from the roots up the stem, oxygen bubbles out of the leaf, and
  glucose travels back down to feed the plant.
- **A chloroplast zoom** — grana (thylakoid stacks) catching light, water being
  split, ATP and NADPH carrying energy to the Calvin cycle, and glucose popping out.
- **Correct stoichiometry** — the plant only builds a sugar once 6 CO₂ + 6 H₂O
  have arrived with enough light energy, and then exactly 6 O₂ are released.
  The live tally and the equation tiles react to real events in the animation.
- **A six-step narration** that cycles through sunlight → water → CO₂ →
  light reactions → Calvin cycle → food for the plant, highlighting the matching
  part of the scene.

## Controls

| Control | What it does |
| --- | --- |
| Play / Pause | Freezes both the canvas particles and every CSS animation |
| 0.5× / 1× / 2× | Speed of the whole simulation |
| Night | Sun sets, stars come out, light reactions stop — roots keep drinking |
| Labels | Show or hide the flow arrows and captions |
| `Space` / `N` | Play–pause / day–night from the keyboard |

Responsive down to phone width, and it respects `prefers-reduced-motion`
(the animation starts paused).
