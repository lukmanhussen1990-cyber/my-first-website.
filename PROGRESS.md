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
- **[07:39 UTC] Extra — Sound captions.** Optional setting: bracketed captions for distant noises, footsteps behind
  you, door slams, outages, the monster's screech and its heavy footsteps when it is close but unseen.
- **[07:41 UTC] Extra — Difficulty, loading beat, contact shadow.** Settings gain Difficulty (Easy / Normal / Hard
  scales the creature's speed x0.86/1/1.1, hearing x0.75/1/1.25, sight x0.8/1/1.15 and how often it hunts you).
  Starting a run now shows "ENTERING..." on black for a frame before the first chunks bake (pointer lock is still
  requested inside the click), so slow phones don't look frozen. The creature has a soft contact shadow.
- **[07:44 UTC] Extra — Tall halls.** On level 1 the "huge empty hall" chunks now have 4.8 m ceilings (other rooms 2.9 m).
  Border walls take the taller neighbour's height, soffit walls close the step where a tall hall meets a normal
  ceiling, tall pillars, fixtures hang at the hall ceiling and the baker compresses their vertical distance so halls
  stay as bright as rooms (CPU light sampling and scripted door headers follow the same heights). Soffit baking is
  time-sliced per cell. Connectivity unchanged (0 unreachable cells).
- **[07:45 UTC] Extra — Hold breath.** Space (or the BREATH touch button) holds your breath for up to ~6 s: the
  creature loses its close-range "sense" (it must actually see you) and its sight range drops 25%, all audio is
  muffled through a low-pass filter, and a thin blue bar shows remaining breath. Releasing makes an audible exhale
  (heard within 4.5 m); running out makes you gasp loudly (9 m). Breath refills in ~4 s. Verified in a scripted test.
- **[07:48 UTC] Extra — Bug-fix pass 2 (independent code review).** A reviewer agent read the whole file; fixed all
  11 findings: touchscreen laptops now switch back to mouse mode on a real mouse click (previously one touch killed
  mouse look); menu background no longer strobes after a death/outage (monster & outage uniforms, phantom, camera kick
  reset); water lapping and the danger drone stop outside gameplay; the jump-scare aberration no longer sticks to the
  game-over screen; the creature can't catch you through a wall; distant sounds are safe without Web Audio; dying
  clears the Continue slot immediately; the delayed "find the EXIT" message can't leak into the next run; GLSL
  smoothstep with reversed edges replaced; water light-texture lookups were half a cell off and lagged a frame when
  crossing cells; whispers no longer cut off; C can't toggle crouch while paused; double-clicking New Game can't start
  two runs. All regression tests pass.
- **[07:56 UTC] Extra — Balance via play-testing bots.** Wrote a pathfinding bot that plays complete runs (A* to each
  page, then the exit). Without the creature every run is winnable in ~2.5-3 minutes. With it, a naive bot died on
  nearly every sighting, so: level-1 chase speed 4.35 -> 4.2 m/s, per-page speed bonus 4% -> 2.5%, chase sight now
  depends on how lit you are (12-22 m instead of a flat 26 m), the "sense" after losing sight 1.2 -> 0.8 s, sprint
  lasts 8 s and stamina refills faster while walking. Also found and fixed: the escape-sequence timer could fire into
  a newly started run.
- **[07:58 UTC] Extra — Level 3 "Lights Out".** Unlocked by escaping level 2 ("Descend to level 3", plus a menu
  button). The power is gone: only ~13% of fixtures work, as dim red emergency lights (some flickering), near-black
  red fog, office blocks and corridors dominate, batteries spawn in 62% of chunks, and the creature is the fastest
  wanderer/searcher yet (chase 4.6 m/s vs your 5.0). New set of 5 pages, its own best time, and a short ending text
  when you escape it. Panel glow now follows each level's light colour.
- **[08:00 UTC] Extra — Decay details.** Decal atlas grew to 8 cells: rare hand-scrawled warnings on walls ("DON'T RUN",
  tally marks, "IT HEARS YOU" — alpha-tested), missing ceiling tiles (black ragged holes) around dead fixtures, and
  ~22% of dead fixtures now dangle from one edge out of their hole. Nearby dangling fixtures occasionally spit sparks
  (pooled additive sprites with gravity and bounce) with a spatial crackle.
- **[08:02 UTC] Extra — Shader pre-compilation.** Every material (creature, items, notes, exit, doors, water, sprites,
  post/bloom) is compiled at boot against the render target it will actually draw into, so nothing hitches the first
  time the creature or a note appears. Verified: 14 GPU programs exist at the menu and none are added during play.
- **[08:04 UTC] Extra — Note radios, damp footsteps.** Every page now has a small tape recorder beside/below it (speaker
  grille, antenna, blinking red LED) — the source of the static. Footsteps squelch when you walk over the visible damp
  carpet patches (the CPU samples the exact same noise field the floor shader uses).
- **[08:11 UTC] Extra — Stalking.** Every minute or so, instead of charging when it first sees you at 11-26 m, the creature
  stops and silently *watches*, head tracking you. Stare back for about a second and it decides once: ~65% of the
  time it slowly slips away out of sight (with a short grace period), ~35% it shrieks and charges; walking within 8 m
  always triggers the charge. Scares pause while it stalks. Verified with scripted trials (4 retreats / 2 charges of 6).
- **[08:14 UTC] Extra — Water life (level 2).** The creature leaves its own wake rings when it wades (so you can see it
  coming), and drops visibly fall from the ceiling: each one plinks where it lands and spreads a ripple ring
  (4-slot ring buffer in the water shader). Touch layout lifts the centre message above the buttons; the loading card
  names the level; the creature's chest breathes when it stands still.
- **[08:14 UTC] Extra — First-run intro, tinted scare.** The very first run opens on black with "You were leaning against
  a wall. Then the wall wasn't there." (remembered in the save). The jump-scare face is tinted per level.
- **[08:17 UTC] Extra — Gamepad support.** Standard-mapping controllers: left stick move, right stick look (curved
  response), RT/LB/L3 run, RB hold breath, A crouch, X flashlight, B/Y close note, Start pause/resume. Tested with an
  emulated pad.
- **[08:18 UTC] Extra — Bug-fix pass 3 (second independent review).** Fixed 7 findings: holding breath past the
  limit caused a gasp every few frames (now latched until you release); wall scrawls were mirrored on half the wall
  orientations; level-2 radios beside floating pages hovered 28 cm above the water; the jump-scare scream was
  low-passed if you were holding your breath (instant un-muffle); a noise during stalking skipped the stalk logic;
  falling drops could freeze in mid-air in later runs; losing pointer lock during the loading/intro card now pauses
  the run once it starts. Verified the breath latch (exactly 2 state changes in 12 s of holding).
- **[08:20 UTC] Extra — Clicks, reset.** While it stalks, searches or stands scanning, the creature makes bursts of
  spatial throat clicks (an audio tell, captioned). Settings has a "Reset progress" button (with confirmation).
- **[08:21 UTC] Extra — Feel.** Batteries stay on the floor if your light is already full (with a hint), sprinting widens
  the FOV by 5 degrees and high danger narrows it (tunnel vision), and the creature's gait phase now matches its stride
  length so its feet no longer skate.
- **[08:22 UTC] Extra — Endless mode.** Unlocked after escaping level 1. Three pages are always out there; each one you
  grab spawns another 35-65 m away, the creature speeds up (capped at +20%) and scares come faster. No exit — the
  score is how many pages you collect before it catches you; the record is saved and shown on the title screen.
  Continue/save, pause, journal and game-over screens understand the mode. README updated (endless + gamepad).
- **[08:23 UTC] Extra — "Reduce flashing" (photosensitivity) setting.** Flickering/stuttering lights only dip to 60%
  instead of blacking out (same in the CPU mirror), no whole-screen brightness dips or VHS glitch bands, a much
  weaker red flash, and camera / jump-scare shake reduced to 20-35%. README controls updated.
- **[08:30 UTC] Extra — Beam haze, eye colours.** A faint screen-space haze follows the flashlight beam (projected beam
  direction, stronger in the dark). The creature's eyes are pale in level 1, sickly green-white in level 2 and burning
  red in level 3. Full regression suite (20 scenario tests) passes.
- **[08:31 UTC] Extra — Automatic quality fallback.** The first 5 s of play are timed; if the machine averages under
  45 FPS the graphics quality drops one step (once per session, saved, with an on-screen note). Choosing a quality in
  Settings disables the auto-adjust.
- **[08:31 UTC] Extra — Robustness.** If WebGL can't start, a clear "NO SIGNAL" message explains what to do instead
  of a blank page; if the GPU context is lost (phones backgrounding the tab), the run is paused and saved and a
  "SIGNAL LOST — Reload" screen appears (verified with WEBGL_lose_context).
- **[08:34 UTC] Extra — Props.** About 5% of cells (fewer in halls) get a static prop pushed against one of the cell's
  walls: cardboard boxes (sometimes stacked), an office chair (sometimes toppled), the yellow wet-floor sign, or a low
  filing cabinet. Deterministic per cell (cached), lit by the sampled fixture light, with collision for player and
  creature; placement keeps the centre lane free so pathfinding is unaffected (connectivity + soak re-verified).
- **[08:35 UTC] Extra — Title drift, emergency lamps.** The title-screen camera now drifts slowly through the maze and
  turns towards open space at walls. In level 3 the few working fixtures are small square red emergency lamps while
  the dead ones remain full-size dark troffers.
- **[08:36 UTC] Extra — Tutorial hints.** One-time contextual hints (remembered in the save, touch-aware wording):
  movement basics after a few seconds, the flashlight the first time you stand in darkness, low battery, what to do
  the first time something gets close, and the static meter after your first page.
- **[08:38 UTC] Extra — Real doors.** ~30% of doorways (an opening between two collinear walls) now have a pair of
  double doors standing open as part of the world (built/disposed with their chunk). The slam scare now prefers one
  of these that you can actually see 4-16 m ahead, so doors no longer pop into existence before slamming (the old
  spawn-a-door behaviour remains as a fallback).
- **[08:47 UTC] Extra — Draw-call fix + bug-fix pass 4 (third review).** Doors and props were made of many small meshes
  (would have added several hundred draw calls); they are now baked into merged geometry with per-vertex colour and
  light under one shared material: props + door headers = 1 mesh per chunk, each door leaf = 1 mesh, and doorways
  with doors are rarer (14%). Back to ~160 draw calls total. Fixed the review's 8 findings: losing the GPU context
  now freezes the game in a 'lost' state (the save survives; a pending load is cancelled); endless-mode stinger
  volume is capped; "Reduce flashing" keeps outages dark, uses steady average levels for flickering/dying lights and
  no longer makes you easier to spot; pages/radios/exit avoid cells with props; toppled-chair collision covers the
  chair; auto-quality ignores the first 1.5 s (loading hitch); abandoning an endless run keeps its record; throat
  clicks only while it truly idles. Full suite (20 scenarios) passes.
- **[08:54 UTC] Extra — Title-screen ghost; balance re-check.** Every 25-45 s on the title screen a still figure may stand
  15-21 m down the corridor the camera drifts along, then vanish in a flicker. Re-ran the bots after props/doors:
  without the creature all 6 runs win (~2.5-3 min); a traced chase confirms that breaking line of sight and moving
  away makes it search and give up (it later drifts back to your area by design).
- **[08:56 UTC] Extra — Jump-scare variety.** Three procedural faces (gaping toothed maw, an impossibly wide grin,
  an eyeless face with a weeping third socket); each run draws one at random 1.5 s after it starts, so the catch
  itself never stalls.
- **[08:58 UTC] Extra — Visual tour fixes.** Took screenshot tours of all three levels (random spots, light on/off) and
  fixed what they showed: door headers now match each level's walls (they were Lobby-yellow in the tiled level 2),
  and a soft highlight roll-off in the shaders keeps the flashlight from blowing walls out at point-blank range.
  Title screen now notes "contains flickering lights" and points to Reduce flashing.
