# Build notes: how the video engine works

`SPEC.md` is the production spec: every beat, time, position, color and sound cue. This file explains the code you build it with.

## Pipeline

- `index.html` loads, in order:
  1. `lib.js`, `parts.js`, `core.js`, `shapes.js`
  2. fonts and `timeline.json`, which becomes `window.T`
  3. `scenes/manifest.js`, then `layout.js`, then every scene file in `SCENE_FILES`
  4. the `SCENE_INIT` hooks
- `render.cjs` drives headless Chromium. It calls `renderFrame(t)` for each time and captures the 1920×1080 canvas.
- Rendering is deterministic: time `t` (in seconds) is the only input.

## Commands

Run all commands from `imran-video/`.

```bash
# contact sheet of N frames between two times (labelled)
python3 tools/preview.py 4.2 8.2 16 /path/sheet.png --cols 4 --width 480
# specific times
python3 tools/preview.py --times 6.3,6.45,6.6 /path/sheet.png --cols 3 --width 640
# full-size stills (PNG), useful to inspect details at 100%
node render.cjs --times 8.9,8.93 --out /path/dir
# only some scenes, by id; also load an extra test script
python3 tools/preview.py --times 9 /p.png --solo merge,blob --extra scratch/mytest.js
# a quick low-quality video of a range
node render.cjs --start 4.2 --end 8.3 --fps 30 --video /path/clip.mp4 --crf 24
```

- Scene runtime errors are printed by `render.cjs` along with the time they happened, and the exit code is 1.
- Use the Read tool on the PNGs to look at your work.
- Put preview images in the scratchpad: `/tmp/claude-0/-home-user-my-first-website-/825b9be8-428e-562b-bf36-3fefdcbdcb33/scratchpad/`, in a subfolder named after your scene.
- Put throwaway test scripts in `imran-video/scratch/`. It is gitignored.

## Scene registration

Each scene file calls `SCENE({...})`. A single file can register several entries.

```js
SCENE({ id: 'thoughts', start: 4.2, end: 8.21, layer: 'world', page: 'thought', z: 0,
        draw(ctx, lt, t, scene) { /* lt = t - start */ } });
```

**Layers, bottom to top** (spec §1.2): BG fill, then the `world` layer, then `screen`, then `overlay`, then the badge, then grain.
- The core draws the badge and the grain. Never draw them yourself.
- The black wipe is `overlay`.

**World layer**
- Draw in your page's own 1920×1080 coordinates. These are exactly the spec's coordinates.
- The core applies the camera for you: camY pan, zoom Z about the pivot, and shake.
- Set `page: 'chat'` or `page: 'thought'`.
- A page is skipped entirely when the camera can't see it.

**Screen layer** (flyers): plain screen pixels, no camera.
- To hand an object off between screen space and a page, use `CAM.pageToScreen(t, CAM.PAGE.thought, x, y)`.

`z` orders scenes within the same layer and page.

## Shared modules

**Read these. Do not edit them**, except for files you are explicitly assigned.

**`L`** (`lib.js`)

| Group | Members |
|---|---|
| Constants | `W`, `H`, `PAL` (bg, orange, badge, ink, chat, white, lav, pink, cream) |
| Math | `clamp`, `lerp`, `remap(t,a,b)` (0..1, clamped), `smoothstep` |
| Easing | `ease.*` (outBack(x,s), inBack, inOutCubic, outCubic, inCubic, inQuad, outQuad, inOutSine, outExpo, …) |
| Spec curves | `SPRING_IN(τ,f,ζ)`, `WOBBLE(τ,A,f,T)`, `smear(ctx,t,drawFn)`, `stretchAlong(ctx,[vx,vy],Smax)` |
| Randomness | `rng(seed)` (mulberry32-style), `hash`, `noise1` |
| Boil | `boil(t)` (0..2, 12 fps 3-drawing cycle), `step12(t)` |
| Point lists | `blobPoints(cx,cy,rx,ry,{n,seed,jag,jit,b,rot})`, `resample`, `catmull`, `morphPair`/`morph` |
| Paths | `polyPath`, `roundPolyPath` (rounded cut-paper corners, cusp-safe), `smoothPath`, `fillPoly(ctx,pts,color,{round}|{smooth})` |
| Strokes | `brushStroke(ctx, pts, {width, taperIn, taperOut, from, to, color, wob, seed})`: a tapered ink stroke; `to` < 1 writes on and `from` > 0 writes off |
| Text | `text(ctx, str, x, y, {family, weight, size, color, align, chars, rough:'soft'|'mid'|'hard', t})`, `measure` |
| Transforms | `at(ctx,{x,y,s,sx,sy,rot,alpha},fn)`, `offscreen(key,w,h)` (a cached offscreen canvas) |
| Sparkles | `sparkle(ctx,x,y,r,color,rot,pinch)`: a 4-point star |

- Text roughness comes from SVG filters in `index.html`: `#rough-{soft,mid,hard}-{0..3}`.
- You may add your own SVG filter element at runtime from your scene's `SCENE_INIT` hook, for example one with a per-frame adjustable `feDisplacementMap` scale. Do this with `document.createElementNS`. Do not edit `index.html`.

**`P`** (`parts.js`)

| Member | What it draws or returns |
|---|---|
| `roundRectPoints` | rounded-rectangle point list |
| `handCut(pts, {amp,freq,seed,b})` | a wobbly paper edge |
| `chatBubble` | chat bubble |
| `avatar` | avatar |
| `thoughtBubble` | a simple bubble with a tail |

`P.thoughtBubble` is a simple version. The thoughts scene may draw its own bubbles to match the spec.

**`S`** (`shapes.js`), the spec §1.5 morph helpers

| Member | What it does |
|---|---|
| `S.canon(pts, 96)` | Resamples a shape to 96 points, clockwise, starting at the top-most point. |
| `S.pair(A, B)` | Returns `[a, b]`, aligned using an index-offset search within ±8. |
| `S.lerpShape(a, b, k)` | Interpolates between the two; it may overshoot. |
| `S.boilPts(pts, shapeId, t, amp?)` | Spec boil: ±2.5 px, or ±1.2 px for shapes smaller than 40 px. |
| `S.fill(ctx, pts, color, round=6)` | Fills a shape with rounded corners. |
| `S.C_SHAPE`, `S.C2_SHAPE` | The C poses, relative to the blob center. |
| `S.HERO_BASE` | The 18-gon hero blob, r 200, relative to its center. |
| `S.HERO_CENTER` | `[960, 555]` |
| `S.heroSpring(t)` | Returns `[sx, sy]`, the global impact squash (spec §3.5). |
| `S.heroBreath(t)` | The idle breath scale. |
| `S.THUMB` | The thumbs-up. It is a refined version of the §3.6 path with a tapered, rounded thumb; always use `S.THUMB`. |
| `S.THUMB_CREASES` | The thumb's finger crease lines. |
| `S.drawThumb(ctx,{x,y,s,rot,sx,sy,t,creases:[p0,p1,p2],id})` | Draws the shape plus its creases. Strokes are never thinner than 2 px. |
| `S.thumbBBoxCenter(s)` | The offset from the thumb's origin to its bounding-box center. |
| `S.HEART` | The 32-point heart, relative to its center. |

**`CAM`** (`core.js`)
- Members: `camY(t)`, `zoom(t)`, `pivot(t)`, `shake(t)`, `pageToScreen(t, pageY, x, y)`, `PAGE` (`{chat: 0, thought: 1080}`).

**`LAYOUT`** (`layout.js`) holds the measured chat layout from spec §1.8:
- `LAYOUT.bubble` with fields `L`, `R`, `cx`, `cy`, `W`, `H`, `top`, `bottom`, `radius`
- `LAYOUT.avatar`
- `LAYOUT.text`, `LAYOUT.words`, `LAYOUT.wordX`
- `LAYOUT.reply`, `LAYOUT.glyphX`
- `LAYOUT.bang` (with the `dot` at `bang.dot`)
- `LAYOUT.caret`
- `LAYOUT.underline`
- `LAYOUT.chip` with fields `x`, `y`, `w`, `h`, `r`

The measured values are tw = 874 → L ≈ 357, R ≈ 1563, bangX ≈ 1006, chip.x ≈ 1463.

**`T`** (`timeline.json`) holds every time constant in spec §2, for example `T.T_IMPACT`. Use these names instead of re-typing the numbers wherever they exist.

## Hand-off contracts between scene files

| At | Contract |
|---|---|
| 3.52 | `chatpage.js` stops drawing the "!" dot. `drop.js`, a screen flyer, takes it over from (bang.dot) until 4.20. It ends at screen (960,555) as a circle of r 34. |
| 4.20 | `thoughts.js` draws the seed on the thought page with its landing squash. |
| 8.21 | `thoughts.js` hands over to `merge.js`. The same author writes both, so they share state through `window.THOUGHTS`. |
| 9.60 | `merge.js` hands over to `blob.js`. The hero blob is `S.HERO_BASE` at `S.HERO_CENTER`, scaled by `S.heroSpring(t)` × `S.heroBreath(t)`. `merge.js` must also export `window.HERO_GULP = (t, pts) => ({ pts, scale })`, which applies the comet gulp bulges (spec §3.5) to blob-relative points. Its last gulp decays until about 9.71, and `blob.js` calls it for every t < 9.75. |
| 12.42 | `blob.js` (thought page) hands over to `flight.js` (screen flyer). The flyer ends at 13.12 with the thumb's **bbox center** at screen (`LAYOUT.chip.x`, 534), at scale 0.20 and rotation 0. |
| 13.12 | `chatpage.js` draws the thumb inside the chip from 13.12 on (scale 0.22→0.20 easeOutBack, bbox-centered in the chip). |
| 13.32–13.67 | `chatpage.js` draws the dot's return arc. The "!" dot is whole again from 13.67. |

## Rules

- **Determinism.** Never use `Math.random`, `Date`, or `performance.now`. Use `L.rng(seed)`, `L.hash` and `L.noise1`. Boil seeds use `L.boil(t)`, never a frame index.
- **Your files only.** Edit only the files you are assigned. If a shared file has a bug or is missing a helper, work around it locally in your own file and report it in your final message.
- **Speed.** Keep each frame fast (under 150 ms). Cache static geometry at load time or in `SCENE_INIT`; for example, the morph pairs.
- **Palette.** Use only the spec palette. No gradients and no vignettes.
- **Fonts.** Use the families named in the spec. They are already loaded via `fonts.css`.
