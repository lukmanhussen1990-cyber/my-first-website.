# 趙雲 · 長坂無雙 — Zhao Yun: Changban Musou

A 3D voxel "musou" (Dynasty Warriors-style) brawler. Zhao Yun cuts through the
Wei army at Changban to protect his lord's infant son. Built with three.js
(r186), bundled with esbuild into ONE self-contained `dist/index.html`
(JS + CSS + fonts inlined). That file is used both for the web build and as the
only asset of the Android WebView APK (`android/`).

Reference video frames: `reference/frames/*.jpg` (study them — the look and HUD
must match: sunset haze, black-armoured Wei soldiers with red headbands and gold
round shields, white/teal armoured Zhao Yun with long spear and white cape,
voxel paving tiles on sand, city wall + gate towers, black/red banners, fires,
smoke columns, palisade, distant mountains).

## Hard rules for every module

* Plain ES modules in `src/`, `import * as THREE from 'three'`. No other runtime deps.
* Must run in an Android System WebView (Chrome 90+), WebGL2, **on mid-range phones at
  60 fps**: prefer `InstancedMesh`, merged geometry, `MeshLambertMaterial`
  (or `MeshStandardMaterial` only where it matters), few draw calls, no per-frame
  allocations in hot paths (reuse `Vector3`/`Matrix4` scratch objects), no
  post-processing passes.
* Everything respects `ctx.quality` (see below).
* The whole game must work offline from a single HTML file loaded over
  `file://` or `https://appassets.androidplatform.net/` — **no fetch/XHR of
  external files, no ES module loading at runtime, no CDN**. Textures are drawn on
  canvases at runtime, fonts are embedded as base64 by the build.
* No blood/gore (the reference has none): hits = sparks, dust, voxel armour chips.
* Module ownership is strict: only edit files you own. If you need something from
  another module that its contract doesn't provide, work around it inside your
  module and report it in your final summary.

## Coordinates & units

* Y is up, 1 unit = 1 metre, ground is flat at `y = 0`.
* Facing angle `yaw` (radians): forward vector = `(sin(yaw), 0, cos(yaw))`.
  `yaw = Math.PI` faces north (−Z), toward the Wei gate.
* Arena (see `config.js` `ARENA`): x ∈ [−80, 80], z ∈ [−125, 70].
  City wall runs along z = −125 with the gate 城門 at x = 0.
  Player starts at (0, 0, 40) facing north.
* Human characters ≈ 1.8 m tall (hero ≈ 1.9 m); spear ≈ 2.8 m.

## Shared context object `ctx`

Created in `main.js` and passed to every `create*` factory:

```js
ctx = {
  renderer,        // THREE.WebGLRenderer
  scene,           // THREE.Scene
  camera,          // THREE.PerspectiveCamera (fov 55, near 0.1, far from quality)
  quality,         // see QUALITY in config.js: { name, pixelRatio, shadows, shadowMapSize,
                   //   maxSoldiers, particleScale, drawDistance, antialias }
  isTouch,         // true on touch devices
  uiRoot,          // HTMLElement overlay root (#ui) for all DOM UI
  events,          // tiny event bus from core/events.js: on(name, fn), off, emit(name, data)
}
```

## Module APIs (the contract)

### world/world.js — owner: World agent

```js
const world = createWorld(ctx)
world.update(dt, time, focus)     // focus: THREE.Vector3 (player pos) – move shadow camera, animate fires/smoke/flags
world.sun                         // THREE.DirectionalLight (casts shadows when quality.shadows)
world.colliders                   // [{ x, z, r }] circles and [{ minX, maxX, minZ, maxZ }] boxes (static, solid)
world.bounds                      // { minX, maxX, minZ, maxZ } playable rectangle
world.spawnPoints                 // { north:[{x,z}...], west:[...], east:[...], south:[...] }  (just outside view, inside bounds)
world.gate                        // { x, z, open(t0..1) } — call gate.open(k) to animate the gate doors opening (k 0..1)
world.minimapFeatures             // [{ type:'wall'|'gate'|'palisade'|'tower'|'camp', x, z, w, h, rot }] for the minimap
world.setMusouTint(k)             // 0..1: shift lighting/fog to the cold dark-blue musou grade (see frame f_020)
```

### chars/crowd.js — owner: Characters agent

Instanced renderer for up to `max` common soldiers. It only READS soldier objects.

```js
const crowd = createCrowdRenderer(ctx, { max })
crowd.update(soldiers, count, time, camera)   // render soldiers[0..count-1] (skip !s.visible)
crowd.dispose()
```

Soldier object (created and mutated by gameplay, read-only for the renderer):

```js
{
  kind: 'spear' | 'sword' | 'shield' | 'archer' | 'banner',  // equipment & look ('banner' = carries a tall red flag)
  tint: 0 | 1 | 2,   // 0 = normal Wei soldier, 1 = veteran (darker/more gold), 2 = captain (gold trim, red plume)
  x, y, z,           // FEET position. y > 0 when airborne
  yaw,               // facing
  pitch,             // body tumble about its local right axis, used only while anim === 'air'
  roll,              // body tumble about its forward axis, used only while anim === 'air'
  anim,              // see SOLDIER_ANIMS below
  animT,             // seconds since anim started
  phase,             // walk-cycle phase in radians (gameplay advances it by distance moved)
  flash,             // 0..1 white hit flash (gameplay decays it)
  fade,              // 0..1 death sink (1 = fully gone into the ground)
  visible,           // boolean
}
```

`SOLDIER_ANIMS` (exported from `game/moves.js`):
`idle, walk, run, windup, attack, guard, block, shoot, flinch, air, down, getup, dead, cheer`.
Renderer rules: `air` uses pitch/roll with pivot at the hips and flailing limbs;
`down` and `dead` lie flat on their back on the ground (renderer computes the
proper height); `getup` animates lying → standing over 0.7 s; `dead` also sinks by `fade`.
`windup` must be a clear telegraph (weapon raised, 0.5 s), `attack` a quick strike (0.35 s).

### chars/hero.js — owner: Characters agent

```js
const hero = createHeroRig(ctx)
hero.group                  // THREE.Group (gameplay sets group.position / rotation.y = yaw; added to scene by gameplay)
hero.pose(name, u, time, p) // name: a HERO_POSES entry, u: 0..1 progress in that move, time: seconds (idle breathing),
                            // p: { speed:0..1 (run blend), air:bool, vy:number }
hero.getWeaponTip(v)        // writes world position of spear tip into Vector3 v (call after pose)
hero.getWeaponBase(v)       // world position of spear butt-end / grip
hero.setFlash(k)            // 0..1 hit flash
hero.setMusouGlow(k)        // 0..1 cyan-white aura/emissive for musou
hero.height                 // metres (for camera/labels)
```

`HERO_POSES` = every key of `MOVES` in `game/moves.js` plus
`idle, run, jump, fall, land, hurt, knockdown, getup, victory, defeat`.
Attack poses MUST use `MOVES[name].keys` so the visible strike happens exactly when
the hitbox is live (see moves.js comments).

### chars/officer.js — owner: Characters agent

```js
const off = createOfficerRig(ctx, id)   // id: 'xiahouen' | 'yanming' | 'zhanghe'  (see OFFICERS in game/moves.js)
off.group, off.height
off.pose(name, u, time, p)   // name: SOLDIER_ANIMS or officer moves 'atk1' | 'atk2' | 'atk3' | 'special' | 'taunt'
                             // (timings in OFFICER_MOVES of moves.js); for 'air' use p.pitch/p.roll
off.setFlash(k)
off.getWeaponTip(v)
```

### chars/items.js — owner: Characters agent

```js
const items = createItemRenderer(ctx, { max: 32 })
items.update(list, time)   // list: [{ kind:'bun'|'wine'|'sword'|'scroll', x, y, z, visible }] — bobbing, spinning, glowing voxel pickups
```

### fx/fx.js — owner: FX agent

```js
const fx = createFX(ctx)
fx.update(dt, camera)
fx.hitSpark(pos, dir, power)          // gold/white spark burst at a hit (power 0.5 light … 2 huge)
fx.debris(pos, dir, count, color)     // voxel chips (armour pieces) flying with gravity & bounce
fx.dust(pos, radius, count)           // ground dust puff (landing, sliding bodies, dash)
fx.shockwave(pos, radius, color, dur) // expanding ground ring + dust wall
fx.slash(opts)                        // big crescent swipe mesh:
                                      //  { center, yaw, radius, arcFrom, arcTo (radians rel. to yaw), y, tilt, color, dur, width }
fx.createTrail({ color, width, life }) → trail with trail.push(basePos, tipPos) each frame, trail.stop()
fx.musouAura(k, pos)                  // 0..1 swirling cyan-white voxel particles around the hero
fx.impactFlash(pos, size, color)      // brief additive billboard flash
fx.projectile(from, to, speed, kind)  // 'arrow' visual only; returns handle { done, pos }
```

### audio/audio.js — owner: Audio agent

All sound is synthesised with WebAudio at runtime (no audio files).

```js
const audio = createAudio()
audio.unlock()                      // call from the first user gesture
audio.play(name, { vol, rate, x, z })  // one-shot SFX; names in AUDIO_SFX below
audio.setMusic(track)               // 'title' | 'battle' | 'boss' | 'victory' | 'defeat' | null (crossfade)
audio.setIntensity(k)               // 0..1 battle-music intensity (crowd size / combo)
audio.setListener(x, z, yaw)        // for stereo panning of positioned SFX
audio.setVolume({ master, music, sfx })   // 0..1
audio.suspend() / audio.resume()    // app backgrounded / foregrounded
```

`AUDIO_SFX`: `swing, swingHeavy, thrust, hit, hitHeavy, ko, block, playerHurt, jump,
land, dodge, musouStart, musouHit, musouFinale, shockwave, pickup, officerAppear,
reinforce, officerDefeat, victory, defeat, uiClick, uiBack, arrow, arrowHit, gong,
milestone, gateOpen, warcry`.

### ui/input.js — owner: UI agent

```js
const input = createInput(ctx)
input.update(dt)            // poll gamepads, update touch joystick
input.state                 // live state object (read by gameplay every frame):
  { moveX, moveY,           // -1..1, camera-relative: moveY = +1 forward (away from camera), moveX = +1 right
    look: { dx, dy },       // accumulated camera rotation deltas (radians) since last endFrame
    held: { attack, charge, jump, dodge, musou },
    pressed: { attack, charge, jump, dodge, musou, pause, camReset, help } }  // edge-triggered this frame
input.endFrame()            // clear `pressed` and `look`
input.setEnabled(b)         // hide/disable gameplay touch controls (menus / cutscenes)
input.setMusouReady(b)      // make the touch musou button glow
input.mode                  // 'touch' | 'keyboard' | 'gamepad' (last used)
```

Keyboard: WASD move, J attack, K charge, Space jump, L dodge, I musou, Q/E rotate
camera, R camera reset, H help, Esc/P pause; mouse drag rotates camera, left click
attack, right click charge. Gamepad (standard mapping): left stick move, right stick
camera, X/□ attack, Y/△ charge, A/× jump, B/○ dodge, RB/R1 or RT musou, LB camera
reset, Start pause.

### ui/hud.js — owner: UI agent

```js
const hud = createHUD(ctx)
hud.update(dt)
hud.setHealth(frac)                       // 0..1 (teal bar, low HP turns red + vignette)
hud.setMusou(value, active)               // value 0..3 (3 segments), active = musou in progress
hud.setChain(n)                           // 0 hides; pops on increase ("連擊 CHAIN")
hud.setKO(n)                              // "擊破 K.O. COUNT"
hud.setTarget(t | null)                   // top-left officer bar: { zh, en, frac }
hud.setLabels(list)                       // floating names/HP above officers: [{ x, y (CSS px), zh, en, frac, show }]
hud.showDialogue({ who, zh, en, dur })    // who: 'zhaoyun' | 'xiahouen' | 'yanming' | 'zhanghe' | 'caocao' | 'soldier'
hud.showBanner({ zh, en, kind, dur })     // center banner: kind 'enemy' (red first chars) | 'ally' | 'info'
hud.showTitleCard()                       // 趙雲 / ZHAO YUN intro card top-left with controls hint
hud.musouCinematic(dur)                   // fullscreen 無雙 calligraphy + 常山 趙子龍 + 龍膽 seal + 長槍所向 百軍皆破
hud.toast(zh, en)                         // small notification (item pick-up, milestones)
hud.flash(color, alpha, dur)              // full-screen flash
hud.setMorale(frac)                       // 蜀 (blue) vs 魏 (red) bar above minimap, frac = Shu share
hud.minimap(data)                         // { px, pz, pyaw, camYaw, enemies:[{x,z,o}] , items, gate:{x,z} , features }
hud.showScreen(name, data, handlers)      // 'title' | 'pause' | 'victory' | 'defeat' | 'help' | 'settings' | null
                                          // handlers: { onStart, onResume, onRestart, onQuit, onSettings(changes) }
hud.setVisible(b)                         // hide gameplay HUD (title screen, cinematics)
```

### game/* — owner: Gameplay agent (also owns main.js, config.js, moves.js)

Player controller, combat & hit detection, crowd simulation & AI, officers,
spawner / stage script, camera, items, pause & menus flow, adaptive quality,
Android bridge. Exposes `window.__game` for automated tests:

```js
window.__game = {
  state,            // 'title' | 'playing' | 'paused' | 'cinematic' | 'victory' | 'defeat'
  start(), restart(), pause(), resume(),
  player,           // { x, z, hp, maxHp, musou, move, ... }
  soldiers(),       // alive soldier count
  stats,            // { ko, maxChain, time, officersDefeated }
  fps,              // smoothed fps
  debug: { godMode(b), spawnWave(n), skipToPhase(i), setInput(partialState) }
}
```

### Android bridge

The APK loads the game in a WebView. The Java side calls
`window.__android && window.__android.onBack()` when the Back button is pressed
(game: pause / close menu; return `true` if handled — if unhandled the game calls
`AndroidApp.exit()`), and `window.__android.onPause()` / `onResume()` on
lifecycle changes. The Java side injects `AndroidApp` with `exit()`,
`vibrate(ms)`, `isAndroid()`.
Gameplay guards every call: `window.AndroidApp && AndroidApp.vibrate(30)`.

## Fonts

Built by `tools/subset_fonts.py` (scans all source files for CJK characters and
subsets the fonts into `assets/fonts/*.woff2`; `build.mjs` inlines them):

* `font-family: 'Brush'` — LXGW WenKai TC Bold (calligraphy: 無雙, dialogue, titles)
* `font-family: 'Serif'` — Noto Serif CJK TC Black (names, numbers, UI)
* `font-family: 'Latin'` — Latin display face for ZHAO YUN / numbers.

**If you add new Chinese characters anywhere, re-run `python3 tools/subset_fonts.py`.**
Canvas drawing with these fonts must wait for `document.fonts.ready`.

## Build & test

```
node build.mjs                     # → dist/index.html (single file)
node build.mjs --out dist/x.html   # custom output (use your own name when running in parallel!)
node build.mjs --entry src/some_test_entry.js --out dist/some_test.html   # harness pages
node tests/smoke.mjs dist/x.html out_dir   # headless Chromium (SwiftShader WebGL): console errors + screenshots
```

Headless Chromium here renders WebGL in software, so it is SLOW (5–15 fps) — judge
performance by draw calls / triangle counts (`renderer.info`) and code review,
not by headless fps.
