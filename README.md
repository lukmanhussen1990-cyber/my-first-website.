# NYXEN TX-1 — interactive 3D flashlight

A photoreal, fully procedural tactical flashlight built with React, TypeScript, Three.js, React Three Fiber and Drei.

**Quick look:** open [`nyxen-tx1-flashlight.html`](./nyxen-tx1-flashlight.html) in a browser. It is a single self-contained file that works offline.

## Controls

| Input | Action |
| --- | --- |
| Drag the torch | Aim it (with flick inertia) |
| Drag the background | Orbit the camera |
| Scroll / pinch | Zoom |
| Click the round switch on the head | Power on / off |
| Arrow keys (Shift = faster) | Aim |
| `+` / `−` | Zoom |
| `L` or `Space` | Power |
| `1` `2` `3` | Focused / Standard / Wide |
| `R` · `F` · `?` | Reset view · Full screen · Shortcuts |

## Highlights

- Procedural geometry: crease-aware lathe parts, real diamond knurling with worn peaks, cooling fins, crenellated bezel, parabolic reflector, 4-die LED under a dome, a switch that physically depresses, a titanium clip with Torx screws, and a laser-etched marking.
- PBR finishes: anodised aluminium, anisotropic turned aluminium, AR-coated glass with thin-film iridescence, and generated roughness/normal maps.
- Lighting: a SpotLight with a cookie texture for the hotspot, rings, tint shift and shadows. Intensity follows a photometric model (lumens → candela → throw). The beam itself is a custom analytic volumetric pass with Henyey–Greenstein scattering, drifting 3D haze and shadow-map light shafts. Dust motes, lens glare, bloom, AgX tone mapping and grain complete the image.
- UI: power switch, brightness (lumens), beam width (candela and throw), three modes, a battery that drains realistically and can be recharged, reset view, full screen, live-region announcements and keyboard support.
- Adaptive quality: DPR, MSAA, ray-march steps, shadow resolution and dust count step with measured frame rate (pin a tier with `?q=low|medium|high`).

## Develop

```bash
npm install
npm run dev           # dev server
npm run build         # multi-file production build → dist/
npm run build:single  # one self-contained HTML → nyxen-tx1-flashlight.html
```
