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
- **[06:56 UTC] Feature 5 — Monster: DONE.** A 2.7 m gaunt, hunched figure built from lathe-tapered limbs with
  very long arms and finger claws, near-black jittering skin shader (lit by the CPU-sampled fixture light at its
  position and by the flashlight), faint glowing eyes, procedural walk/chase animation and head twitches.
  AI states: wander (drifts towards the player's area) -> investigate (hears footsteps: run 21 m, walk 6.5 m,
  crouch 1.8 m; walls muffle x1.5) -> chase (vision: FOV ~130 deg, range scales with how lit the player is,
  flashlight makes you visible, crouching shrinks it; wall line-of-sight) -> search (after losing sight for a few
  seconds it searches around the last known position) -> wander. A* pathfinding on the cell grid (~0.2 ms/query),
  stuck detection, and a director that relocates it out of sight if it drifts > 62 m away. Spatial heavy footsteps,
  breathing/growl loop, chase screech, nearby lights stutter. Catch -> 3D lunge + violently shaking procedural 2D
  face (canvas) + distorted scream -> game over screen. Tested headless: sees, chases, catches, game over shown.
- **[06:59 UTC] Feature 6 — Stamina + flashlight: DONE.** Stamina drains in ~6.5 s of sprinting, regenerates after a
  short rest (faster standing still); hitting zero makes you exhausted (no sprint until 35%) with panting sounds.
  F toggles a per-pixel spotlight (offset to the right hand, lags slightly behind the view, reflector rings) whose
  battery lasts ~110 s and stutters below 20%; it also makes you much easier for the monster to see. Spare batteries
  spawn deterministically in ~38% of chunks (+50% charge, remembered once collected so they don't respawn), with a
  pulsing glint sprite so they can be spotted in the dark. HUD: notes counter, stamina bar, battery gauge, messages.
- **[07:02 UTC] Feature 7 — Notes + exit: DONE.** 5 handwritten pages are pinned to walls (or dropped on the floor)
  26-74 m from the start in different directions. Each one has a spatial radio-static beacon (crackling noise + warbling
  tone) so players can follow the sound, and a glint. Picking one up plays a paper rustle and shows the page text
  (lore that also teaches the mechanics). A director moves the nearest page closer if the player wanders > 105 m from
  all of them. After 5 pages, an EXIT door (metal door + glowing green EXIT sign + low hum beacon) appears on a wall
  46-66 m away; touching it wins. HUD shows NOTES x / 5. Tested: all 5 collected, exit spawned, win triggered.
- **[07:04 UTC] Feature 8 — Horror effects: DONE.** The scene now renders into an (optionally MSAA) render target
  at a quality-dependent resolution scale and a full-screen post shader adds: animated film grain (stronger in
  shadows), dark screen edges, faint scanlines, slight warm/sickly grade, and — scaled by danger — chromatic
  aberration, lens warp, desaturation, VHS tracking-glitch bands and whole-view brightness dips. Camera shake
  grows with danger (stronger while being chased) plus impulse kicks; the vignette pulses with each heartbeat and
  tightens when exhausted. Lights near the monster stutter (stronger during a chase). Exponential fog tinted by
  local light hides distant rooms. Built-in-material textures switched to raw colour space so sprites/sign match.
- **[07:11 UTC] Feature 9 — Menus: DONE.** Title screen over a live "attract mode" view of the Backrooms (slowly
  panning camera, flickering lights), with New Game / Continue / Level 2 / Settings / How to play. Esc (or losing
  pointer lock / tab focus) pauses: audio context suspended, Resume / Settings / Save & quit. Settings: mouse speed,
  invert Y, field of view, volume, graphics quality (Low 60% res / Medium 85% / High 100% + 4x MSAA) and head bob;
  saved to localStorage and applied live. Game over (time survived, notes) and win screens (time, next level / play
  again / menu). Keyboard focus styling on buttons. Ignores Chrome's pointer-lock mouse spikes.
- **[07:15 UTC] Feature 10 — Level 2 "The Flooded Halls": DONE.** Reached via "Descend to Level 2" after escaping
  (or from the menu once unlocked). New look: grimy green ceramic tile walls/floor (canvas), greyer ceiling, cold
  green-white light at 85% brightness, much denser darkness (lower dark-zone threshold, 8% random dead fixtures, 2x
  flicker/dying), dense teal fog, more corridors and halls. 30 cm of murky water: a transparent shader plane with
  scrolling ripple normals, wake rings around the player's legs, Fresnel, flashlight glare and *fake reflections of
  the ceiling fixtures* (reflected ray traced to the ceiling plane and looked up in a live 64x64 light-state texture
  that the CPU refreshes every other frame, so flicker and outages show in the water too). Walls are soaked below the
  waterline with a scummy tide mark. Wading is slower (run 4.7 m/s) and louder (splashes heard 26 m running / 9 m
  walking); the monster is faster (chase 5.0 m/s) and splashes when it walks. Batteries and floor pages float.
  Water ambience: lapping + random spatial drips. Separate set of 5 level-2 notes.
- **[07:16 UTC] Feature 11 — Saving: DONE.** localStorage `backrooms.save.v1`: best time per level (win screen shows
  "NEW BEST!"), unlocked levels (Level 2 button appears on the menu after the first escape), escape/death counters
  shown on the title screen, and the current run (level, world seed, position, facing, time, notes taken, note/exit
  positions, collected batteries, flashlight charge). The run autosaves every 10 s, on pause, on quit and on page
  unload; "CONTINUE (LEVEL x, n/5, m:ss)" rebuilds the identical world from the seed. Dying or winning clears the run.
  Settings are saved separately. Tested: quit -> reload page -> continue restored seed/notes/time; win stored best time.
- **[07:18 UTC] Feature 12 — Phone support: DONE.** Touch mode is detected (coarse pointer, or switches on at the first
  real touch). A floating joystick appears wherever the left thumb lands (analog movement), dragging anywhere on the
  right side looks around, and round buttons give RUN (hold), CROUCH (toggle), LIGHT (toggle) and pause. No pointer
  lock on touch (tries fullscreen instead), tap the note to put it away, battery gauge moves to the top so it doesn't
  clash with the buttons, Low graphics by default. Tested in an emulated 844x390 phone with multi-touch CDP events.

## All 12 list features are complete (at ~55 min). Remaining time goes to the "if time is left" list.
- **[07:26 UTC] Extra — Bug-fix pass 1.** Built a fast headless soak test (a bot plays 4 simulated minutes per level
  through a new `simulate(dt)` step with a per-subsystem profiler). Found & fixed: a 2.5 s hitch when the jump-scare
  face canvas was generated at the moment of the catch (now pre-generated after start); monster "last seen" logic
  (it now keeps sensing your position for 1.2 s after losing sight, then searches there); the remaining update steps
  no longer run in the same frame after you are caught; the monster was too passive against a moving player, so a
  "hunt" timer now periodically sends it to investigate near you (more often as you collect notes); drag-to-look
  fallback when pointer lock is refused; removed dead constants.
- **[07:26 UTC] Extra — Scare director: DONE.** Every ~28-58 s (faster with more notes, paused during chases) one of:
  *lights going out one by one* (a darkness front sweeps from ~24 m ahead towards you with a relay clunk per fixture,
  holds 2.5-4.5 s with a distant groan, and sometimes draws the monster), *double doors slamming shut* in a doorway
  ahead (loud slam, camera kick, they block the way for 9 s then creak open; the monster walks through them),
  *footsteps creeping up behind you* (stop the instant you turn around, sometimes ending with a whisper), a *phantom*
  silhouette at the end of a corridor that vanishes in a light stutter when you look at it, and close *whispers*.
  Picking up a note plays a dissonant string stinger and brings the next scare forward.
- **[07:27 UTC] Extra — More room types: DONE.** Two new chunk styles join rooms / tight corridors / huge empty halls /
  pillar rooms: *office blocks* (a grid of small 2x2-cell rooms joined by single doorways — spanning tree over rooms
  plus 12% extra doors) and *long walls* (recursive division: long straight walls with one or two gaps, giving long
  sightlines). Level 2 favours halls, corridors and long walls. Connectivity re-verified (0 unreachable cells in a
  121x121 area for both levels).
- **[07:29 UTC] Extra — Performance pass.** Measured in-browser: ~100 draw calls / ~110k triangles on screen,
  ~0.1-0.5 ms average CPU simulation per frame. Chunk baking now yields after every wall face / floor cell: worst single
  step went from ~10 ms to 1.9 ms (p99 0.9 ms) with a 2.5 ms/frame streaming budget, so walking into new areas no longer
  hitches. HUD DOM writes are cached (only touched when a value changes). Added renderer stats to the debug hook.
- **[07:30 UTC] Extra — Bloom + dust.** Quarter-resolution bloom (bright-pass + 2x separable Gaussian blur, off on Low)
  makes the fluorescent panels glow through the haze. 700 dust motes drift in a box that wraps around the camera; they
  are faint in room light and sparkle inside the flashlight beam.
- **[07:32 UTC] Extra — Monster behaviour + music.** New "spotted" beat: when it first sees you it freezes, snaps its
  head towards you with arms rising and screeches for ~0.75 s (0.45 s on level 2) before charging — a moment to react.
  While wandering it sometimes stops for a few seconds and slowly scans with its head; while hunting/searching its head
  tracks you. A low pulsing chase ostinato (with a dissonant hit every 8 beats) plays while it hunts you, and the
  ambient drone swells with danger. Soak test re-run clean.
- **[07:35 UTC] Extra — Transitions & QoL.** Runs fade in from black; touching the EXIT bursts the door open with
  rushing air and a rising chord, the screen whites out, then the win screen appears. Game-over screen shows a random
  survival tip. New Brightness setting (gamma in the post pass) for dark monitors. Level naming unified: Level 1 —
  The Lobby, Level 2 — The Flooded Halls.
- **[07:38 UTC] Extra — Signal meter, decals.** HUD "STATIC" meter (4 bars, crackles) shows how close the nearest
  page — or the exit hum — is, so the hunt also works without headphones. Walls get procedural decals from a canvas
  atlas (power outlets near the floor, light switches, vent grilles near the ceiling) and some dark ceiling cells get
  air-vent grilles; decals use the same baked-light shader (polygon offset, no z-fighting). Low quality uses cheaper
  equal-power audio panning instead of HRTF.
- **[07:38 UTC] Extra — Journal + level-2 creature tint.** The pause screen lists every page collected so far (scrollable
  journal). On level 2 the creature's skin takes a wet, greenish-black tint.
