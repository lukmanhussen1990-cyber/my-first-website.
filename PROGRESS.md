# Backrooms Horror — Progress Log

Start time: Mon Oct  5 06:25:30 UTC 2026 (see START_TIME.txt)
Target: work until at least 10:55:30 UTC (4h 30m).

## Design decisions
- **Single file**: everything lives in `index.html`. Three.js is loaded from a CDN with a dynamic
  `import()` (jsDelivr first, unpkg as fallback) so the page works from `file://` with no build step.
- **Custom shaders instead of Three.js lights**: dozens of fluorescent fixtures can't be real
  `PointLight`s at 60 FPS. Light from fixtures is *baked per vertex* (with 2D wall occlusion so light
  doesn't leak through walls), but each vertex remembers its 4 strongest fixtures so flicker,
  broken lights and "lights going out" events still animate in the shader. The flashlight is a
  per-pixel spotlight in the same shader.
- **World grid**: cells of 2.4 m, walls live on cell edges. The world is split into 8x8-cell chunks.
  Chunk interiors come from a seeded spanning-tree maze (so every chunk is internally connected)
  with extra walls knocked out; chunk borders come from a hash of the border's coordinates (both
  neighbours agree) and always have at least one opening, so the endless maze is fully connected.
- **Gamma-space render target**: shaders output display-referred colour into an 8-bit target and
  a final post-processing pass adds grain/vignette/etc. This avoids needing float render targets
  (better phone compatibility); grain hides banding.

## Log
- **[06:34 UTC] Feature 1 — First-person controls: DONE.** Pointer-lock mouse look (yaw/pitch, clamped),
  WASD/arrow movement with smoothed acceleration, Shift to run (forward only), C toggles crouch
  (smooth eye-height change), head bob + footstep events, circle-vs-box wall collision with sub-steps.
  Tested headless: movement, running, wall collision and crouch all verified.
