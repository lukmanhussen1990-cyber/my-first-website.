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
- **[06:38 UTC] Feature 2 — Endless maze: DONE.** Deterministic `World` class: 8x8-cell chunks with 4 styles
  (rooms, tight corridors, huge halls, pillar rooms). Kruskal spanning tree per chunk + hash-based shared
  borders with guaranteed openings. Chunks within radius 2 are built (1 per frame, nearest first), chunks
  beyond radius 3 are disposed. Walls are merged into runs per grid line (no z-fighting at joins).
  Tested: BFS over a 161x161-cell area found 0 unreachable cells; 25 chunks build in ~135 ms.
- **[06:45 UTC] Feature 3 — Backrooms look: DONE.** Canvas textures: striped yellow wallpaper with chevron motif and
  paper grain, damp mustard carpet with fibres/speckles, 2x2 mineral-fibre ceiling tiles with T-bar grid, prismatic
  light-panel diffuser, plus a tileable noise texture used by the shaders for world-space carpet damp patches, wall
  grime streaks / water damage and ceiling water stains (so tiling isn't visible). Lighting: every fixture is baked
  per vertex with 2D wall/pillar occlusion + ambient occlusion near walls; the 4 strongest fixtures per vertex stay
  dynamic so flickering / dying / broken lights animate in the vertex shader (CPU mirror for gameplay). Dark zones
  come from a value-noise field where ~90% of fixtures are broken. Exponential fog tinted by the local light level.
  Chunk building is time-sliced with a generator (3 ms/frame budget, ~15 ms per chunk total).
- **[06:48 UTC] Feature 4 — Sound: DONE.** Procedural Web Audio engine: compressor-protected master bus, generated
  convolution reverb, brown-noise room tone + beating low drone, fluorescent buzz (120 Hz hum + ballast whine + sizzle)
  whose level follows the CPU-computed brightness of nearby fixtures, electrical zaps when a nearby light flickers,
  carpet footsteps (noise burst + thump; louder/brighter when running, near-silent crouching) and water splashes for
  level 2, 8 kinds of spatialised (HRTF) distant noises (thuds, creaks, footsteps, whispers, door slams, knocking,
  groans, crackles) every 9-25 s, and a lub-dub heartbeat whose rate/volume follow `game.danger`.
  Verified with an AnalyserNode that every sound produces signal without clipping.
