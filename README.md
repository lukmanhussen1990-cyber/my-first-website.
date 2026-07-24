# 🦖 Dino Runner

A polished, offline-style endless runner inspired by Chrome's dino game — built with plain HTML, CSS, and Canvas. No frameworks, no assets, no build step.

**▶️ Play it live:** https://claude.ai/code/artifact/7805c40f-c173-40b1-b282-e1d2df79ae5e

## Features
- Smooth fixed-timestep physics with a retina-aware canvas
- Jump **and** duck — dodge cacti on the ground and pterodactyls in the air
- Progressive difficulty: speed ramps up and birds appear more often
- Animated day/night cycle with sun, moon, twinkling stars, and clouds
- Score + persistent local high score, milestone chimes, and a "New Best" celebration
- WebAudio sound effects (mutable) and a light/dark theme toggle
- Full controls: keyboard (`Space`/`↑` jump, `↓` duck, `P` pause, `M` mute), touch buttons, and tap-to-jump

## Run locally
Just open `index.html` in a browser, or serve the folder:

```bash
python3 -m http.server
```

## Files
| File | Purpose |
|------|---------|
| `index.html` | Page structure and HUD |
| `style.css` | Theme, layout, responsive + touch controls |
| `game.js` | Game engine: loop, physics, rendering, input, audio |
