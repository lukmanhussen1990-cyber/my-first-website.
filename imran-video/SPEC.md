# FINAL PRODUCTION SPEC: "Imran, I got you!" (the spark that comes home)

**Format.** 1920×1080 at 30 fps. **Length 16.30 s, which is 489 frames (frame n renders t = n/30, so n = 0…488).** H.264 yuv420p, CRF 16. Audio is 48 kHz stereo, AAC 192k.

**Base proposal.** The base is **story-warmth**, which all three judges chose. Grafted onto it:
- From **faithful-plus**: the spring and wobble pop specs, the 3 action ticks on each orange ignition, the orange underline under "got it!", and the word-pop marimba motif that rhymes at the end.
- From **kinetic-pop**: the pen-nib dot on the write-ons, and a second shockwave ring in badge orange.

**Judge fixes applied**
| Fix | What changed |
|---|---|
| The chat was rushed | The chat now lasts 0.80 s longer, and the finished "I've got it!" holds for 1.06 s before the dot leaves. |
| The avatar was named as Imran | The avatar is now an unnamed sender, so no one sends a message to himself. |
| "Looking for Imran" did not read | That beat is cut. |
| The words were too small | The words are now ≥100 px. |
| The reaction chip was too small | The chip is now 168×104 and the thumb is at scale 0.20. |
| No big closing line | A push-in plus a word "wave" makes "Imran, I got you!" the large closing line, about 113 px on screen. |
| The turbulence-resolve technique was unproven | A cheaper technique with a fallback is specified. |

---

## 0. One-paragraph story

1. A black starfield irises open on beige.
2. An unnamed person's chat bubble pops in with the message **"Imran, I got you!"**, and the serif reply **"I’ve got it!"** types on letter by letter. Its "!" is hand-drawn in Claude orange, and an orange underline swooshes under "got it!".
3. The orange dot of the "!" pops off. The camera pans down in one continuous move and the dot falls into the thinking space below, where it lands as a small orange **seed**.
4. The seed puffs out four white thought bubbles. Each one first fills with the source's illegible cursive scribble, then the scribble **comes into focus as a real handwritten word**: "hmm…", "what if…", "try this!", "for Imran". This puts the user's "extract text" request on screen.
5. "for Imran" makes the seed hop. Orange then ignites clockwise through all four bubbles, each with ink action ticks.
6. The bubbles wind up and whip in a clockwise spiral into the seed. Their words unravel into looping ink comets, and everything slams into one orange **hero blob**: a 2-frame ink flash, a double shockwave and paper shards.
7. The comets are gulped in. The blob calls out with the source's **"C" pose** twice, the second time bigger.
8. The blob jump-spins into a big cut-paper **thumbs-up**, with a burst of confetti.
9. The thumbs-up flies home as the camera pans back up and lands as a 👍 **reaction** on the "Imran, I got you!" bubble. The spark dot hops back into the "!", and a small pink heart floats up.
10. The camera pushes in so the message reads big, the bubble's words do a happy wave, and a black diagonal wipe (as in the source) ends on a twinkling orange dot.

---

## 1. Global spec (applies to every scene)

### 1.1 Palette (no other colors, no gradients, no vignette)
| token | hex | use |
|---|---|---|
| BG | `#E3D9CB` | background (both pages) |
| ORANGE | `#D67556` | seed, blob, orange bubbles, "!", underline, shards |
| BADGE | `#DE8053` | badge, second shockwave ring, some shards/confetti |
| INK | `#16120E` | text, strokes, black wipe, intro black, impact frame |
| CHAT | `#F2EEE6` | chat bubble, intro star specks |
| WHITE | `#F9F8F5` | thought bubbles, reaction chip, sparkles |
| LAV | `#CAC9DA` | avatar circle, some confetti |
| PINK | `#C2648A` | avatar silhouette, heart, some confetti |
| SHADOW | `#B8B1A7` | badge drop shadow only |
| STARWHITE | `#FBF3EA` | badge ✦ and "OPUS 5" text |
| BADGEINK | `#3A2418` | badge "CLAUDE" text |

### 1.2 Camera, world and layers
**World pages**
- **Chat page:** world y 0–1080.
- **Thought page:** world y 1080–2160.
- All coordinates in this spec are **screen coordinates at the page's resting camera**, i.e. at camY = 0 for chat-page items and camY = 1080 for thought-page items.

**Camera transform** (world layer only):
`screen = ((wx, wy − camY) − P) · Z + P + shake`, rotated by `rot` about P.
- Pivot P = (960, 555) for t < 12.27 and (960, 520) for t ≥ 12.27. Zoom is exactly 1.0 when the pivot switches, so the switch is seamless.

**camY(t)**
| t | camY |
|---|---|
| 0–3.60 | 0 |
| 3.60–4.20 | 0 → 1080, easeInOutCubic |
| 4.20–12.42 | 1080 |
| 12.42–13.12 | 1080 → 0, easeInOutCubic |
| 13.12–end | 0 |

**Zoom Z(t)**
| t | Z |
|---|---|
| 0–4.20 | 1.000 |
| 4.20–8.21 | 1.000 → 1.035, easeInOutSine |
| 8.21–8.90 | 1.035 |
| 8.90–8.96 | 1.035 → 1.085, easeOutQuad (impact punch) |
| 8.96–9.40 | 1.085 → 1.000, easeOutCubic |
| 9.40–14.05 | 1.000 |
| 14.05–14.65 | 1.000 → 1.180, easeInOutCubic (end push-in) |
| 14.65–15.30 | 1.180 → 1.195, linear drift |
| 15.30–end | holds 1.195 (hidden by the wipe) |

**Shake** (world layer only)
- Impact, 8.90–9.20: amplitude `10·e^(−τ/0.09)` px in x and y, using seeded 2D value noise sampled at 30 Hz, plus rotation `0.5°·e^(−τ/0.09)`.
- Payoff, 11.70–11.85: amplitude `4·e^(−τ/0.06)` px, translation only.

**Layer order, bottom to top**
1. BG fill
2. World: pages and their shapes, then world FX (ink strokes, rings, shards, confetti, comets)
3. **Screen-space flyers.** Two objects fly in screen space:
   - The falling dot, 3.52–4.20. It is reparented into the thought page at 4.20, when camY = 1080 and Z = 1.
   - The flying thumbs-up, 12.42–13.12. It is reparented into the chip on the chat page at 13.12, when camY = 0 and Z = 1.
4. Black wipe (screen space)
5. Badge (screen space; it never moves, shakes or boils)
6. Paper grain (screen space)

### 1.3 Hand-made look
**Boil**
- Every cut-paper vertex gets a seeded offset of ±2.5 px. Shapes under 40 px get ±1.2 px. Ink-stroke centerline points get ±1.2 px, and stroke width gets ±8%.
- `boilSeed = shapeId*7919 + (floor(t*12) % 3)`. This is a classic 3-drawing hand boil at 12 fps.
- Use only a seeded PRNG (mulberry32). Never use Math.random.
- Motion, scale, rotation and morphs are evaluated continuously at 30 fps, and the boil is added last.

**Cut-paper shapes**
- Irregular N-gons, with a fixed per-shape radial irregularity (stated per shape) plus the boil.
- Corners are rounded with a 6 px arcTo, so edges stay straight-ish.
- Curved targets (chat bubble, C, thumbs-up, heart) are flattened to points first, then boiled.

**Ink strokes**
- Variable width; the profile is `w·sin(π·s)^0.6` along normalized length s, giving tapered ends and round caps.
- **Write-on** draws arc length 0…p. **Write-off** retracts from the tail.

**Text roughness**
- All text is drawn through SVG `feTurbulence` (baseFrequency 0.035, numOctaves 2, seed = boilSeed) into `feDisplacementMap`.
- Scale is 2.5 for chat text and 3 for thought words.
- Render in **headless Chromium** (ctx.filter = 'url(#id)').

**Paper grain**
- Three pre-made monochrome noise tiles (2 px grain), cycled at 12 fps.
- Overlay blend at opacity 0.055 over the whole frame, including the badge.

### 1.4 Easing primitives (use these names exactly)
- `easeOutBack(x, s=1.70158) = 1 + (s+1)(x−1)³ + s(x−1)²`
- easeInBack, easeInOutCubic, easeOutCubic, easeInCubic, easeInQuad, easeOutQuad, easeInOutSine, easeOutExpo: the standard Penner curves.
- `SPRING_IN(τ; f, ζ) = 1 − e^(−ζωτ)·cos(ω_d τ)`, with ω = 2πf and ω_d = ω√(1−ζ²).
  - Used for 0→1 pops.
  - Check: with f 3.2 and ζ 0.55 it should peak at about 1.13.
- `WOBBLE(τ; A, f, T) = 1 + A·e^(−τ/T)·cos(2πfτ)`.
  - Used for squash recovery. It starts at 1 + A.
  - Apply it to sx, and set `sy = 1/sx` (volume-preserving) unless stated otherwise.
- **Smear echoes:** redraw the object as evaluated at t − 1/30, t − 2/30 and t − 3/30, at opacity 0.35 / 0.20 / 0.10, behind the object.
- **Stretch along velocity:** `s = 1 + min(Smax, |v|/3000)` along the velocity direction, and 1/s across it.

### 1.5 Morphs
- Resample both shapes to **96 points by arc length**, both clockwise (y-down), starting at the top-most point.
- Try cyclic index offsets within ±8 and pick the one with the lowest sum of squared distances. Then lerp per point.
- Morph progress may overshoot past 1 when an easeOutBack drives it. The points then extrapolate, which is intended.

### 1.6 Fonts (Google Fonts only)
**Families and weights used**
| Family | Weight | Size |
|---|---|---|
| Shantell Sans | 700 | 96 px |
| Fraunces | 500 | 96 px |
| Caveat Brush | 400 | 100–108 px |
| Inter | 700 | 15 px |
| Inter | 800 | 40 px |

**Loading and measuring**
- `await document.fonts.load(...)` for each family+weight+size, then assert `document.fonts.check`, before rendering frame 0.
- Measure every string with `measureText` only after the fonts have loaded.
- If Caveat Brush lacks U+2026 "…", use "..." instead.

### 1.7 Badge (screen space, every frame 0–488, static, no boil)
- **Shadow:** rect x 1557–1877, y 41–125, color SHADOW (the badge rect offset +6,+6).
- **Badge:** rect x 1551–1871, y 35–119 (320×84), color BADGE.
- **✦:** a 4-point star polygon (not a font glyph), STARWHITE, centered at (1594, 72), outer r 13, inner r 4.5.
- **"CLAUDE":** Inter 700, 15 px, letter-spacing 1 px, BADGEINK, left x 1636, baseline 56.
- **"OPUS 5":** Inter 800, 40 px, letter-spacing 2 px, STARWHITE, left x 1634, baseline 100.

### 1.8 Measured chat layout (all derived values are computed once, after fonts load)
**Bubble text**
- `tw` = width of "Imran, I got you!" in Shantell Sans 700 96 px. Expected about 780–840.
- If tw > 900, shrink the font size so that tw = 900.

**Bubble**
- Width W = tw + 332, height 216, centered at (960, 426).
- L = 960 − W/2 and R = 960 + W/2. Nominally L ≈ 394, R ≈ 1526.
- Top y 318, bottom y 534.
- A rounded rect with corner radius 76, flattened to 40 points through Catmull-Rom, fill CHAT.

**Avatar**
- LAV 16-gon (±2% irregularity), r 63, centered at (L+105, 426).
- PINK silhouette, clipped to the circle:
  - head: circle r 22 at (L+105, 408)
  - shoulders: ellipse rx 42, ry 30 at (L+105, 472)

**Bubble text**
- INK, left x = L+212, baseline 458.
- Each word is positioned from the measured prefix width, so it sits exactly where the full string would.

**Reply line**
- "I’ve got it" in Fraunces 500, 96 px, INK, left x = L+212, baseline 690. Use the typographic apostrophe ’.
- **Hand-drawn orange "!"** (ORANGE), with its x center `bangX = L+212 + width("I’ve got it") + 20` (nominally ≈ 1046):
  - Stem: a tapered quad from y 621 to 668, top width 15, bottom width 9, tilted +3°.
  - Dot: circle r 10 at (bangX, 681). **This dot is the spark.**

**Caret.** INK rect 6×84, top y 612, x = (end of the last visible glyph) + 8.

**Underline anchors**
- gLeft = L+212 + width("I’ve ") − 6.
- underlineEnd = bangX + 14.

**Reaction chip anchor.** Cx = R − 100 (nominally ≈ 1426), Cy = 534.

---

## 2. Scene table (absolute seconds, for independent builds)

Each scene owns the animation of its elements inside [start, end). Every element persists with its OUT state plus boil after its scene ends, unless the table says otherwise. Shared deterministic modules are evaluated from absolute t by any scene that shows them: the camera (§1.2), the hero-blob spring (§3.5), comets (§3.4), shards and confetti particle sims, and the chat page's frozen state.

| id | start | end | content | IN state (at start) | OUT state (at end) |
|---|---|---|---|---|---|
| **intro** | 0.000 | 0.500 | starfield, iris opens | Frame 0: full INK, 8 specks, ORANGE dot r 6 at (960,540), badge. | Full BG, empty chat page, camY 0, Z 1, dot gone. |
| **chat** | 0.500 | 3.400 | bubble, avatar, words, reply typed, orange "!", underline | = intro OUT | **CHAT_FINAL**: bubble + avatar + "Imran, I got you!" settled; "I’ve got it" + orange "!" (stem + dot); orange underline under "got it!"; caret hidden; avatar breathing; camY 0. |
| **drop** | 3.400 | 4.200 | dot pops off, camera pans down, dot falls → seed | = CHAT_FINAL | camY 1080 (chat page fully off-screen above, its "!" dot missing). Thought page empty BG except the **seed**: ORANGE 10-gon r 34 at (960,555), landing squash just starting (sx 1.45, sy 0.62, bottom-anchored). The dot is now a thought-page world object. Z 1. |
| **thoughts** | 4.200 | 8.210 | puff chains, 4 bubbles, scribbles, resolve to words, seed hop, orange ignition chain | = drop OUT | Four **orange** bubbles (with orange puffs) at rest, bobbing, words legible in INK; seed r 34 breathing at center; all ticks gone; Z = 1.035; music on Bbmaj7. |
| **merge** | 8.210 | 9.600 | wind-up, puff suck, spiral whip-in, words → comets, IMPACT 8.90, comets gulped | = thoughts OUT | One **hero blob** (§3.5 base shape) at (960,555), ORANGE, spring residual sx ≈ 1.016 (formula continues), no comets / shards / rings, Z 1.000, no shake. |
| **blob** | 9.600 | 12.270 | C pose ×2, jump-spin, thumbs-up, payoff burst, pump | = merge OUT | **Thumbs-up** (§3.6 shape), scale 1, rotation 0, center (960,560), finger lines drawn, bob offset 0; confetti still falling (world, thought page); sparkles done; camY 1080. |
| **home** | 12.270 | 15.300 | thumb flies home, pan up, chip, dot returns, heart, push-in, word wave | = blob OUT | CHAT_FINAL with dot restored, plus reaction chip (thumb inside) at (Cx,534), heart gone, Z 1.195 about (960,520), everything boiling. |
| **outro** | 15.300 | 16.300 | black diagonal wipe, specks, orange dot bookend | = home OUT | Last frame (488): full INK, 8 specks, ORANGE dot r 9 at (960,540), badge. |

**Shared timeline constants** (one JSON file drives both picture and audio):
```
T_IRIS=0.08  T_BUBBLE=0.50  T_TYPE0=1.48  T_BANG=2.46  T_DOTHOP=3.52  T_PAN1=3.60  T_SEED=4.20
T_RESOLVE_BR=6.85  T_IGNITE0=7.35  T_WINDUP=8.21  T_SPIRAL=8.45  T_UNRAVEL=8.62  T_IMPACT=8.90
T_C1=9.80  T_C2=10.44  T_JUMP=11.22  T_PAYOFF=11.70  T_FLY=12.42  T_LAND_CHIP=13.12
T_PUSH=14.05  T_WAVE=14.55  T_WIPE=15.30  T_END=16.30
```

---

## 3. Beat-by-beat

### 3.1 intro (0.00–0.50)
**0.00 opening frame**
- Full INK.
- 8 star specks: CHAT color, r 1.5–3, opacity 30–70%, twinkling with a sine at a seeded 2–5 Hz.
- Speck positions are seeded but must avoid the badge rect and a 200 px radius around the center.
- ORANGE dot r 6 at (960,540), twinkling scale 1 ± 0.15 at 2 Hz.

**0.08–0.48 iris**
- A BG irregular 16-gon (±3% radius) centered at (960,540) grows from r 0 to 1150, easeInOutCubic.
- Its edge boils.

**0.30–0.42 dot exit**
- The dot shrinks to 0 (easeInBack) on top of the beige.

### 3.2 chat (0.50–3.40)
**0.50–0.90 bubble pop**
- The origin is the bubble's left-center (L, 426).
- scaleX = easeOutBack(s 2.0) over 0.40 s.
- scaleY uses the same curve, delayed 0.05 s. This gives a horizontal stretch that settles.

**0.60–0.90 avatar pop**
- Circle: scale 0→1, easeOutBack(s 2.2), over 0.30 s, with rotation −12°→0°.
- The silhouette pops 0.05 s later with the same curve.

**Bubble words**
- "Imran," at **0.76**, "I" at **0.86**, "got" at **0.96**, "you!" at **1.08**.
- Each word, over 0.24 s:
  - scale 0.55→1, easeOutBack(1.8), origin at the word's bottom-center
  - y +18→0
  - opacity 0→1 over the first 0.08 s
- "you!" also settles its rotation: `rot = −8°·(1 − SPRING_IN(τ; 4, 0.45))`, i.e. it starts at −8°, overshoots slightly past 0° and settles at 0°.

**1.20–1.38 avatar nod.** The silhouette moves y 0→−7→0 (sine), and the circle squashes sx 1.04 / sy 0.96 and back.

**1.36 caret.** The caret appears at x L+212 and stays solid while typing.

**Typing "I’ve got it"** (letter by letter, with a human pause after "I’ve")
| glyph | t |
|---|---|
| I | 1.48 |
| ’ | 1.54 |
| v | 1.60 |
| e | 1.66 |
| (space) | 1.84 |
| g | 1.90 |
| o | 1.97 |
| t | 2.04 |
| (space) | 2.11 |
| i | 2.18 |
| t | 2.25 |

- Each glyph: scale 1.25→1 and y −6→0, easeOutBack(1.7), over 0.10 s, origin at its baseline-center.
- The caret jumps to the end of each glyph as it appears.

**2.25–2.46 pause.** The caret stays solid.

**2.46 the orange "!" types last**
- scale 1.5→1, easeOutBack(2.5), over 0.25 s, origin at the stem bottom.
- rotation 10°→0°.
- The caret jumps to bangX + 18.

**2.58–2.88 underline**
- An ORANGE ink stroke writes on, easeOutCubic.
- Path: a quadratic from (gLeft, 732), through the control point at the midpoint x with y 742, to (underlineEnd, 726).
- Peak width 10 px.

**Caret blinks**
- Visible 2.46–2.71, hidden 2.71–2.96, visible 2.96–3.12.
- Fades to 0 over 3.12–3.20, then stays hidden for the rest of the video.

**2.90–3.40 hold.** Boil only. The avatar silhouette breathes, scale 1 ± 0.015 at 1.2 Hz.
- The finished "I’ve got it!" is fully readable from 2.46 to 3.52.

### 3.3 drop (3.40–4.20): one continuous camera move
**3.40–3.52 dot anticipation.** The "!" dot squashes to sx 1.3 / sy 0.7, bottom-anchored, easeOutQuad.

**3.52–3.75 pop-off**
- The dot becomes a screen-space flyer and jumps from (bangX, 681) to its apex at (bangX − 40, 380), easeOutQuad.
- It stretches vertically to sy 1.2 / sx 0.83, settling to 1/1 at the apex.
- The orange stem stays on the text.

**3.60–4.20 pan.** camY goes 0→1080 (§1.2) and the chat page scrolls up and out of frame.

**3.75–4.20 fall**
- The dot moves from the apex to (960, 555): x easeInOutSine, y easeInQuad.
- Its radius grows 10→34 (easeInQuad).
- It stretches along its velocity with Smax 0.35.

**3.85–4.15 speed lines**
- Three INK strokes ride above the dot, vertical, at x offsets −18 / 0 / +18 from its center.
- They start 20 px above the dot's top, with lengths 60 / 110 / 70 and width 5, tapered.
- They write off from the top and are gone by 4.15.

**4.20 seed lands**
- The dot becomes the **seed**: an ORANGE 10-gon, r 34, ±6% irregularity, at (960,555).
- Squash, bottom-anchored at y 589: `sx = WOBBLE(τ; 0.45, 4, 0.12)`, `sy = 1/sx`. It is settled by about 4.55.

### 3.4 thoughts (4.20–8.21): the "3rd image", made cool

**Geometry** (thought page, screen coordinates at camY 1080)
- **Seed:** (960,555), r 34. From 4.55 it breathes, scale 1 ± 0.04 with a 1.2 s period.
- **Bubbles:**
  - WHITE 14-gons on an ellipse rx 220 / ry 170, with radial jitter ±4% and angle jitter ±5° (fixed per bubble).
  - Centers: **TL (585,325), TR (1335,325), BL (585,785), BR (1335,785)**.
  - TR's top stays clear of the badge, even at pop overshoot.
- **Tail puffs:** WHITE 8-gons on the line from the seed to each bubble, so every thought visibly comes from the seed.
  | bubble | small puff, r 15 | big puff, r 26 |
  |---|---|---|
  | TL | (888,511) | (824,471) |
  | TR | (1032,511) | (1096,471) |
  | BL | (888,599) | (824,639) |
  | BR | (1032,599) | (1096,639) |
- **Idle once popped**
  - Bubble: y bob ±6 px with a 2.4 s period, phase offsets 0 / 0.6 / 1.2 / 1.8 s for TL / TR / BL / BR, plus rotation ±1.5° with the same period.
  - Puffs follow 0.08 s behind at half the amplitude (overlap).
  - The words and scribbles are children of their bubble.

**Beat A, 4.40–5.76: puff chains, in reading order TL → TR → BL → BR**
| thought | small puff | big puff | bubble |
|---|---|---|---|
| TL | 4.40 | 4.48 | 4.56 |
| TR | 4.80 | 4.88 | 4.96 |
| BL | 5.20 | 5.28 | 5.36 |
| BR | 5.60 | 5.68 | 5.76 |

- **Puff pop:** scale 0→1, easeOutBack(2.2), over 0.12 s.
- **Bubble pop**
  - Uniform scale `s = SPRING_IN(τ; 3.2, 0.55)`, peaking at about 1.13.
  - A squash wobble on top: `sx = s·(1 + 0.10·sin(2π·4τ)·e^(−6τ))` and `sy = s·(1 − 0.10·sin(2π·4τ)·e^(−6τ))`.
  - Rotation −8°→rest on the same spring.
  - The bubble **emerges from its tail**: it starts 40 px toward the seed and travels to its center, easeOutCubic over 0.30 s.
- **Seed pulse** at each bubble pop (4.56, 4.96, 5.36, 5.76): scale 1.12→1, easeOutQuad, 0.12 s.

**Beat B, 4.70–6.25: scribbles write on (the source look)**
| bubble | write-on |
|---|---|
| TL | 4.70–5.05 |
| TR | 5.10–5.45 |
| BL | 5.50–5.85 |
| BR | 5.90–6.25 |
Each is 0.35 s, easeInOutSine.

- **Scribble ribbon:** a prolate cycloid, `x = 10φ − 30 sin φ`, `y = −26·h(φ)·cos φ`, φ ∈ [0, 8π].
  - This gives 4 ascender loops, like "lulu".
  - `h` is a seeded per-loop height in 0.7–1.4, cosine-blended between loops.
  - Add a 20 px lead-in swash and a 40 px trailing tail.
  - Scale ×1.2, centered at bubble center + (−6, +4), tilted −4°.
  - INK, with width rising 5 → 11 → 4 px along its length.
  - Each bubble uses a different seed.
- **Pen nib** (from kinetic-pop): an INK dot r 6 rides the stroke head while writing, then scales out over 0.06 s.
- At 6.25 the frame shows the user's 3rd screenshot: four white bubbles with cursive. It is centered and alive.

**Beat C, 6.30–7.13: focus pull, scribble → readable word (cool beat #1)**
- **Words:** Caveat Brush 400, **108 px**, INK.
  - Centered horizontally on the bubble center, with the baseline at center y + 34.
  - Auto-fit to a maximum width of 380 px, but never below **100 px**. If a word is still wider at 100 px, let it overflow (the source scribbles overflow too).
  - Rotations: TL −3°, TR +2°, BL −2°, BR +3°.
  | bubble | word | resolve window |
  |---|---|---|
  | TL | hmm… | 6.30–6.58 |
  | TR | what if… | 6.46–6.74 |
  | BL | try this! | 6.62–6.90 |
  | BR | **for Imran** | **6.85–7.13** |
- **Each resolve, over 0.28 s:**
  - The scribble un-writes from its end: trim 1→0, easeInCubic.
  - The word appears at the same time:
    - opacity 0→1 over the first 0.12 s
    - scale 1.15→1, easeOutBack
    - displacement scale 28→3, easeOutCubic
  - "for Imran" gets scale 1.25→1 instead.
- **Displacement technique**
  - Pre-render each word once, into an offscreen canvas with a 40 px margin.
  - Before drawing it each frame, set that frame's `scale` on the `feDisplacementMap` element.
  - **Fallback:** slice displacement. Shift 2-px rows horizontally and 2-px columns vertically by seeded value noise × amplitude.
- **Legibility:** "for Imran" stays readable from 7.13 to 8.62 (≥ 1.4 s). Do not move the merge earlier.

**Beat D, 7.05–7.25: the seed reacts to "for Imran"**
- Hop: up 20 px over 7.05–7.15 (easeOutQuad), stretched to sy 1.25 / sx 0.85.
- Down over 7.15–7.25 (easeInQuad).
- Landing squash sy 0.85 / sx 1.15, recovering by 7.35.
- **Joy ticks:** two INK ticks, 14 px long and 4 px wide, at ±30° from vertical, starting at radius 46 above the seed. They write on over 7.10–7.16 and are gone by 7.24.

**Beat E, 7.25–8.16: ignition chain, clockwise from BR: BR → BL → TL → TR (cool beat #2)**
| thought | small puff turns orange | big puff | bubble ignites (Ti) |
|---|---|---|---|
| BR | 7.25 | 7.30 | 7.35 |
| BL | 7.42 | 7.47 | 7.52 |
| TL | 7.59 | 7.64 | 7.69 |
| TR | 7.76 | 7.81 | 7.86 |

- **Puff:** its fill swaps to ORANGE, with a scale pop 1.3→1, easeOutBack, 0.12 s. The light travels outward from the seed.
- **Bubble, for τ = t − Ti**
  - **Spill:** an ORANGE irregular 12-gon (±10% radius, boiling) grows from the bubble's rim point nearest the seed.
    - Radius 0→520 over τ 0–0.25, easeOutCubic.
    - Clipped to the bubble shape.
    - At τ 0.25 the bubble's fill becomes solid ORANGE and the spill layer is removed.
  - **Scale pulse:**
    - 1.00→1.10 over τ 0–0.10 (easeOutQuad)
    - →0.98 over τ 0.10–0.20 (easeInOutSine)
    - →1.00 over τ 0.20–0.30 (easeInOutSine)
  - **Word:** a sympathetic hop, y −8 px at τ 0.05, back by τ 0.20. It stays INK on orange (5.9:1 contrast).
  - **3 action ticks** (from faithful-plus; they foreshadow the C pose):
    - INK, length 30, width 7.
    - Angles: the seed→bubble direction, and that direction ±28°.
    - Each starts at (bubble rim along that ray) + 18 px.
    - Start times τ 0.04 / 0.07 / 0.10. Each writes on outward in 0.07 s, holds 0.06 s, then writes off in 0.07 s while drifting 10 px outward.
    - All ticks are gone by Ti + 0.30. The last one ends at 8.16.

**8.16–8.21 breath.** All four bubbles are orange and idle-bob.

**Camera:** a slow push, Z 1.000→1.035 over 4.20–8.21 (§1.2).

### 3.5 merge (8.21–9.60): the "4th image", part 1

**8.21–8.45 wind-up**
- Each bubble group (bubble + puffs + word) translates 24 px radially outward from (960,555).
- It rotates −4° (counter-clockwise, the anticipation for the clockwise whip).
- It squashes to radial 0.94 / tangential 1.06.
- All easeOutQuad.
- The seed contracts to 0.8, easeOutQuad. The music drops out (§4).

**Puff suck**
- Small puffs: 8.38–8.52. Big puffs: 8.46–8.64.
- Each moves to the seed center (easeInQuad), scaling to 0.4, and vanishes on arrival.
- The seed blips scale +6% for 0.08 s at 8.52 and again at 8.64.

**8.45–8.90 spiral whip-in (cool beat #3)**
- Each bubble center moves in polar coordinates about (960,555).
  - r0 and θ0 are its values at 8.45 (r0 ≈ 464).
  - u = (t − 8.45)/0.45.
  - `r = r0·(1 − easeInCubic(u))`.
  - `θ = θ0 + 110°·easeInQuad(u)`, clockwise (increasing angle in y-down).
- Bubble scale 1→0.6. The wind-up squash relaxes to 1 over 8.45–8.60.
- Stretch along velocity with Smax 0.4, plus smear echoes (§1.4).
- The overlapping same-color shapes read as one mass forming.
- The seed's radius grows 27→70, easeInCubic.

**8.62 words unravel into ink comets (cool beat #4)**
- The words stop following their bubbles and fade out over 0.12 s, scaling to 0.85.
- Each word spawns a comet at its center. For word i:
  - Polar values at 8.62 are (ρ0_i, θ0_i), with ρ0 ≈ 440.
  - Absorb times Ta: **BR 9.35, BL 9.42, TL 9.49, TR 9.56**.
- **Head**
  - `θh(t) = θ0_i + 7.0·(t − 8.62)` rad, clockwise.
  - `ρh(t) = ρ0_i + (205 − ρ0_i)·easeInOutSine((t − 8.62)/(Ta_i − 8.62))`.
  - Drawn as an INK disc, r 6.
- **Tail**
  - It covers the head's angular history Δθ ∈ [0, Lc(t)].
  - `Lc` rises 0→1.6 rad over 8.62–8.85 (easeOutQuad), holds, then shrinks linearly to 0 over [Ta_i − 0.25, Ta_i].
  - Tail point: `center + (ρh(t − Δθ/7) + 10·sin(9Δθ)·Δθ/Lc)·(cos, sin)(θh − Δθ)`. The time argument is clamped to ≥ 8.62.
  - Width 12 at the head, tapering to 2. INK, drawn above everything in the world.
  - The loopy wobble makes the tail read as the source's cursive scribble swirling.

**8.90 IMPACT (frame 267) (cool beat #5)**
- The bubbles and seed are removed. One **hero blob** appears:
  - An 18-gon, base r 200, with fixed ±8% radial variation (seeded), centered at (960,555).
  - This is the "base shape" used by later scenes.
- **Ink impact frame:** on frames 267–268 the blob is filled INK. From frame 269 it is ORANGE. This hides the shape swap. Only the blob changes; the background stays BG.
- **Squash spring** (a global function, also used by the blob scene): `sx(t) = WOBBLE(t − 8.90; 0.32, 3, 0.25)`, `sy = 1/sx`, about the blob center.
- **Shockwave 1:** an INK irregular 24-gon ring, r 210→460, stroke 7→1, opacity 1→0, easeOutCubic, 8.90–9.30.
- **Shockwave 2** (badge orange): BADGE ring, r 190→400, stroke 12→0, easeOutCubic, 8.96–9.32.
- **Shards**
  - 12 cut-paper 5- and 6-gons, 10–26 px: 8 in ORANGE and 4 in BADGE.
  - Spawned on the blob rim at evenly spaced angles, with ±12° seeded jitter.
  - Radial speed 600–900 px/s, gravity 1500 px/s² downward, spin ±720°/s.
  - Each scales to 0 (easeInQuad) over a seeded life of 0.5–0.7 s, so all are gone by 9.60.
- **Camera:** punch Z 1.035→1.085→1.000 and shake (§1.2).

**9.35 / 9.42 / 9.49 / 9.56 gulps**
- At each absorb time, the blob vertices near the comet's entry angle bulge outward by up to +16 px, with a Gaussian falloff (σ 25°), decaying over 0.15 s.
- The whole blob blips scale 1.04 at the same time.

### 3.6 blob (9.60–12.27): the "4th image", part 2
The blob is centered at (960,555). The idle breath is scale `1 ± 0.02` at 1.2 Hz whenever the blob is not acting. It continues the §3.5 squash spring.

**C shape** (relative to the blob center; flattened to 96 points; opens to the right like the source, with the upper lobe as the "head"):
```
M 40 -200 C 110 -210 130 -140 80 -100 C 40 -70 10 -40 20 0 C 30 30 80 40 130 50
C 190 60 190 170 110 180 C 20 195 -120 190 -165 120 C -190 60 -170 -20 -110 -60
C -60 -100 -30 -195 40 -200 Z
```

**C #1, "calling out" (as in the source)**
- **9.66–9.80 anticipation:** sx 1.10 / sy 0.90, shifted x −10 px, easeOutQuad.
- **9.80–9.98 morph** base → C, with morph progress = easeOutBack(1.6) and rotation −6°→0°.
- **Hold** 9.98–10.18, boiling.
- **10.18–10.34 back** to base, easeInOutCubic, then `WOBBLE(0.06, 4, 0.10)` on sx.
- **3 action lines**
  - INK, width 10, tapered at both ends.
  - Coordinates are relative to the blob center:
    - (+215,−150)→(+250,−185)
    - (+240,−40)→(+290,−48)
    - (+235,+80)→(+285,+88)
  - They write on at 9.92 / 9.96 / 10.00, taking 0.06 s each.
  - Each then flicks outward 18 px while thinning to 0, gone by 10.20.

**C #2, a bigger shout**
- **10.34–10.44 anticipation:** sx 1.15 / sy 0.85, shifted x −14 px.
- **10.44–10.62 morph** to **C2**, easeOutBack(1.6). C2 is the C points with these changes:
  - points with y < −60 shifted −14 px in y
  - points with y > 40 shifted +14 px (a wider mouth)
  - then scaled (1.08, 1.12) and rotated −8° about the center
- **Hold** 10.62–10.87.
- **10.87–11.02 back** to base, easeInOutCubic.
- **5 action lines**
  - INK, width 12, at absolute screen positions:
    - (1124,360)→(1166,310)
    - (1191,447)→(1250,420)
    - (1215,555)→(1280,555)
    - (1200,642)→(1261,664)
    - (1155,719)→(1205,761)
  - They write on at 10.56 / 10.60 / 10.64 / 10.68 / 10.72, taking 0.06 s each.
  - Each holds 0.08 s, then flicks out 18 px while thinning over 0.10 s.
  - If any start point lies within 30 px of the C2 silhouette, push it outward along its ray.

**11.02–11.22 anticipation**
- Squash to sy 0.68 / sx 1.28, bottom-anchored at y 755, easeOutQuad.

**11.22–11.70 jump-spin-morph (cool beat #7)**
- **Rise:** y offset 0→−150, easeOutQuad, 11.22–11.46. The take-off stretch sx 0.8 / sy 1.3 relaxes to 1/1 by 11.46.
- **Fall:** offset −150→+5, easeInQuad, 11.46–11.70. It lands centered at (960,560).
- **Rotation:** 0→360° clockwise, easeInOutCubic, 11.22–11.72.
- **Morph** base → thumbs-up, easeInOutCubic, 11.36–11.66. The spin hides any mushiness.
- **Smear echoes** over 11.26–11.66.

**Thumbs-up shape** (relative to its center; thumb up at the top-left, four fingers stacked on the right; about 328×428):
```
M -60 -232 C -30 -250 10 -240 18 -205 L 30 -70 L 125 -62 C 165 -60 172 -10 135 -5
C 175 0 178 52 138 58 C 175 64 176 114 136 120 C 168 128 165 182 125 188 L -105 196
C -140 196 -150 170 -150 140 L -150 -20 C -150 -50 -120 -60 -100 -70 L -98 -200
C -96 -225 -80 -232 -60 -232 Z
```
At center (960,560) it spans about x 810–1138 and y 324–756.
**Prerequisite:** check that the silhouette reads as a thumbs-up at 25% size before animating it.

**11.70 PAYOFF (frame 351)**
- **Landing squash:** sy = 1/WOBBLE(τ; 0.22, 4, 0.12), sx = 1/sy, bottom-anchored at y 756.
- **Finger creases:** 3 INK strokes, 7 px, tapered, written on in 0.05 s each at 11.74 / 11.79 / 11.84. Relative to the center:
  - (70,−5)→(138,−5)
  - (70,58)→(140,58)
  - (70,120)→(136,120)
- **Radial burst**
  - 8 INK lines, width 8, at angles 22.5° + k·45°, around (974,533).
  - Each runs from r 300 to r 355.
  - Written on 11.72–11.78, then flicked out to r 350–400 while thinning, gone by 11.95.
- **Confetti**
  - 28 cut-paper triangles and quads, 12–28 px:
    | color | count |
    |---|---|
    | ORANGE | 8 |
    | BADGE | 6 |
    | LAV | 4 |
    | PINK | 4 |
    | WHITE | 3 |
    | INK | 3 |
  - Launched from (960,500) in a fan from −150° to −30° (upward), at 700–1200 px/s.
  - Gravity 1600 px/s², drag 0.8/s.
  - Flutter: spin 2–8 rad/s, plus an x sway of ±12 px at 2 Hz once speed is below 250 px/s.
  - Deterministic world particles on the thought page. They later ride the pan out of frame.
- **Sparkles**
  - Three 4-point stars, WHITE with a 3 px INK outline, sizes 30 / 24 / 34 px.
  - At (1015,305), (1095,365) and (905,270).
  - Each does scale 0→1→0 over 0.35 s while rotating 45°, starting at 11.77 / 11.85 / 11.93.
- **Camera:** a small shake (§1.2).

**11.82–12.12 pump**
- Rotation −10°→0°, easeOutBack, about the bottom pivot (960,756), plus scale 1.06→1.

**12.12–12.27 hold**
- Bob ±4 px at 1 Hz, with phase chosen so the offset is 0 at 12.27.

### 3.7 home (12.27–15.30): the homecoming payoff and the end line

**12.27–12.42 dip.** The thumb dips 16 px, squashed to sy 0.9 (anticipation).

**12.42–13.12 flight home (screen-space flyer)**
- **Path:** a cubic Bézier from P0 (960,560) via (1180,250) and (1600,330) to P3, where P3 places the thumb's bbox center at the chip center (Cx,534), about (1423,539). easeInOutCubic.
- **Scale:** 1.0→0.20.
- **Rotation:** 0 → −15° (at 30% of the path) → 0°, smooth.
- Smear echoes during the flight.
- Finger-line strokes scale with the thumb but are never thinner than 2 px.
- **Pan:** camY goes 1080→0 at the same time (§1.2), so the chat page descends back into view, "!" dot still missing.

**13.04–13.29 reaction chip pops**
- A pill 168×104 with radius 52, WHITE, at (Cx,534), overlapping the bubble's bottom-right edge.
- It has a 6 px BG outer ring as a cut-out.
- Scale 0→1, easeOutBack(2.2).
- It belongs to the chat page (world).

**13.12 the thumb lands**
- It is reparented into the chip.
- Scale 0.22→0.20, easeOutBack, 0.15 s.
- The bubble reacts: `sy = 1/WOBBLE(τ; 0.03, 5, 0.10)`, `sx = 1/sy`, about the bubble center.

**13.32–13.67 the spark comes home**
- An ORANGE dot, r 10, hops out of the chip's lower-left at (Cx − 40, 560).
- It travels a quadratic arc through control (1260,520) to the "!" dot spot (bangX, 681). x is easeInOutSine.
- It passes below the bubble and never crosses the bubble text.

**13.67–13.82 dot lands**
- Squash 1.3 / 0.75, recovering on WOBBLE.
- **"I’ve got it!" is whole again.**

**13.72–14.62 heart**
- A PINK cut-paper heart (16 points, boil 1.2 px):
  ```
  M 0 22 C -10 14 -30 4 -28 -8 C -26 -20 -10 -22 0 -10 C 10 -22 26 -20 28 -8 C 30 4 10 14 0 22 Z
  ```
- It rises from (Cx, 478) to (Cx, 350).
- Scale 0→1, easeOutBack, 0.25 s.
- x wobble ±8 px at 2 Hz.
- Fades out over 14.32–14.62.

**13.77–14.17 avatar hops.** The silhouette does two happy hops of 6 px, 0.20 s each, clipped to the circle. The avatar is the unnamed sender, delighted by the reaction.

**14.05–14.65 push-in.**
- Z 1.00→1.18 about (960,520), easeInOutCubic.
- "Imran, I got you!" grows to about 113 px on screen, which reads on phones.
- Framing at Z 1.18:
  - The bubble spans about x 292–1628 and y 282–537.
  - The underline sits at about y 780.
  - The chip's right edge is at about 1609.
  - Nothing crosses the badge.

**14.55–15.07 word wave** (the closing line)
- The bubble's words hop in sequence: "Imran," 14.55, "I" 14.65, "got" 14.75, "you!" 14.85.
- Each, over 0.22 s: y 0→−16→0 (sine) and scale 1→1.10→1.
- "you!" also wobbles ±6° on SPRING_IN(4 Hz, ζ 0.45).
- At 14.85 the chip's mini thumb pumps: rotation −8°→0°, easeOutBack, 0.2 s.

**15.07–15.30 hold.** Everything boils, and Z drifts toward 1.195.

### 3.8 outro (15.30–16.30)
**15.30–15.90 black wipe**
- An INK screen-space polygon moves left → right, easeInOutCubic.
- Its leading edge is diagonal, with the top 380 px ahead of the bottom (like the source).
- The edge has 4 irregular kinks and boils ±8 px.
- The edge's midpoint x travels −400 → 2320.
- Only the badge and grain stay above it.

**15.60–15.85 specks.** 8 star specks fade in on the black, drawn inside the wipe panel.

**15.92–16.12 dot.** An ORANGE dot pops in at (960,540), r 0→9, easeOutBack.

**16.02–16.27 sparkle.** A WHITE 4-point sparkle, 18 px, at (984,518), scales 0→1→0 while rotating 45°.

**16.30 end** (last frame 488).

---

## 4. Sound design (everything synthesized in numpy, no samples)

### 4.1 Mix
- 48 kHz stereo.
- **Reverb:** a Schroeder send (4 combs + 2 allpasses, RT about 1.2 s). Sends: 15% for pops and marimba, 30% for bells and pad.
- **Panning:** `pan = clamp((x − 960)/960 · 0.6, −0.6, 0.6)` from each source's screen x, with a constant-power law.
- **Levels:**
  - SFX peaks about −12 dBFS; the impact peaks at −6.
  - Music RMS about −22 dBFS.
  - Master: soft limiter at −1 dBFS.
- **One cue table drives everything.** Generate the audio from the same constants and cue table as the picture.
- **A/V sync checks:**
  - impact thump on frame 267 (8.90)
  - payoff chord on frame 351 (11.70)
  - reaction marimba at exactly 13.12 s (between frames 393 and 394; the audio is sample-accurate, the picture is time-based)

### 4.2 Music bed "Warm Spark"
**Key and tempo.** F major, 96 BPM (beat = 0.625 s). Calm, tender, playful.

**Instruments**
- **PAD:** two detuned triangle voices per note (±4 cents), one-pole LP at 1.8 kHz, attack 0.8 s, release 1.2 s, base −24 dBFS.
- **PLUCK BASS:** triangle, attack 8 ms, τ 0.4 s, −26 dB.
- **SUB:** sine on F1 from 8.90 to 11.70, −30 dB.
- **MARIMBA:** melodic hits, as cued.
- **BELL / CELESTA:** sparkles, as cued.
- No drums: the SFX are the rhythm.

**Chord map**
| t (s) | chord | voicing |
|---|---|---|
| 0.10–0.50 | swell from silence into Fmaj7 | |
| 0.50–4.20 | Fmaj7 | F3 A3 C4 E4 |
| 4.20–7.25 | Dm9 (curious) | D3 F3 A3 C4 E4 |
| 7.25–8.21 | B♭maj7, +4 dB swell under the ignitions | B♭2 D3 F3 A3 |
| 8.21–8.70 | Csus4, fading out under the riser | C3 F3 G3 C4 |
| 8.70–8.90 | **silence** (bed at −40 dB) | |
| 8.90–11.70 | Fadd9 | F2 C3 G3 A3 + SUB F1 |
| 11.70–13.12 | F major, bright | adds C5 F5 |
| 13.12–14.30 | B♭maj7 | |
| 14.30–16.30 | F (plagal "amen") | F2 C3 F3 A3 C4; fades out 15.70–16.30 |

**Thinking pulse** (PLUCK BASS on every beat)
| t | note |
|---|---|
| 4.200 | D2 |
| 4.825 | A2 |
| 5.450 | D2 |
| 6.075 | A2 |
| 6.700 | D2 |
| 7.325 | B♭1 |
| 7.950 | F2 |
It stops at the wind-up.

**Note frequencies (Hz)**
| | | | | | |
|---|---|---|---|---|---|
| F4 349.2 | A4 440.0 | C5 523.3 | D5 587.3 | E5 659.3 | F5 698.5 |
| G5 784.0 | A5 880.0 | C6 1046.5 | D6 1174.7 | E6 1318.5 | F6 1396.9 |
| C7 2093.0 | | | | | |

### 4.3 Sound recipes
| name | recipe |
|---|---|
| POP(f0) | Sine whose pitch drops 1.6·f0 → f0 exponentially over 30 ms; 2 ms attack; exponential decay τ 80 ms; plus a 3 ms white-noise click HP 2.5 kHz at −10 dB relative. |
| PUFF | POP with f0 1500 and τ 25 ms. |
| MAR(n) | Sines f (1.0, τ 0.40 s) + 3.93f (0.25, τ 0.08 s) + 10.5f (0.08, τ 0.03 s); 2 ms attack; 2 ms LP-noise mallet click at −18 dB. |
| BELL(n…) | Per note, partials f, 2.76f, 5.40f, 8.93f with amplitudes 1, .4, .15, .06 and τ 1.3, .6, .3, .15 s; 1 ms attack. |
| CEL(n) | Sine + 2f (−8 dB) + 3f (−18 dB), τ 0.9 s, 5 Hz tremolo at 3%. |
| KEY | 10 ms of noise BP 3.5 kHz (Q 2) plus a 180 Hz sine "thock" (τ 15 ms). Seeded ±6% pitch and ±2 dB gain. Plays at −20 dB. |
| SPACE | KEY with a 120 Hz thock and the noise BP at 1.8 kHz, 14 ms. |
| THOCK | 140 Hz sine (τ 40 ms) + KEY. |
| SCRATCH(d) | Pink noise BP 2.5–4 kHz (Q 0.8), AM by seeded 14–22 Hz noise, Hann envelope over d. Plays at −26 dB. |
| SWISH(d) | Noise BP whose center sweeps 1.2 → 4.5 kHz, Hann envelope. |
| FWIP | Noise BP whose center sweeps 700 → 2600 Hz over 80 ms. |
| TICK | Sines at 1900 + 2650 Hz (τ 25 ms) + 2 ms click. |
| TSK | Noise HP 4 kHz, 15 ms. |
| PLIP(f0→f1, d) | Sine chirp with exponential decay. |
| BOING(f0→f1, d) | Sine sweep with 8 Hz vibrato ±3%, Hann-ish envelope. |
| GULP | Sine 420 → 180 Hz over 70 ms through a BP formant at 800 Hz. |
| SQUISH | 80 ms of noise BP 400 Hz + a sine 180 → 260 Hz over 90 ms. |
| HUP(f0→f1, d) | Sine sweep + breath (noise BP 1.2 kHz at −12 dB relative). |
| CREAK | Sine 240 → 160 Hz with FM (modulator 37 Hz, index 2), 0.2 s. |
| RISER(d) | Reversed-swell noise LP sweeping 300 → 3000 Hz + a sine 200 → 600 Hz at −8 dB relative. Gain ramps −20 → −12 dB. Auto-pans in a clockwise circle, 1.6 → 3 Hz. Hard stop with a 5 ms fade. |
| THUMP | Sine 110 → 55 Hz over 60 ms, τ 0.45 s, + a 50 ms burst of noise LP 900 Hz at −14 dB relative, tanh soft-clip. |
| CRACK | Noise HP 3 kHz, 30 ms. |
| PAPER | 8 ms click of noise BP 2.5–4.5 kHz. |
| SHIMMER(n, d) | n 30 ms CEL pings at F-major pitches between 3 and 7 kHz, scattered over d, random pan ±0.6, decaying. |
| WHOOSH(f0→f1, d) | Noise BP (Q 1.5) whose center sweeps f0 → f1; swell envelope peaking at 40% of d. |
| SLIDE(f0→f1, d) | Sine glide with 6 Hz vibrato (slide whistle). |
| TWINKLE(f) | Sine f + 1.5f, τ 0.3 s. |
| AIR | Pink noise LP 700 Hz, slow swell. |

### 4.4 Cue list (absolute seconds)
| t | cue | level / pan |
|---|---|---|
| 0.00 | TWINKLE 2400 Hz | −30 |
| 0.08–0.48 | Iris "fwoom": AIR with LP sweeping 200 → 900 Hz | −22 |
| 0.10 | Pad swell begins | |
| 0.36 | PUFF (dot shrinks out) | −26 |
| 0.50 | POP 340 Hz + SWISH 0.3 s (bubble) | −14 / −24, pan −0.1 |
| 0.60 | POP 620 Hz (avatar) | −18, pan −0.35 |
| 0.76 / 0.86 / 0.96 / 1.08 | MAR F4 / A4 / C5 / F5 (bubble words, the motif) | −16 |
| 1.20 | PLIP 700 → 900 Hz, 60 ms (nod) | −28 |
| 1.48, 1.54, 1.60, 1.66 | KEY ×4 ("I’ve") | −20 |
| 1.84 | SPACE | −22 |
| 1.90, 1.97, 2.04 | KEY ×3 ("got") | −20 |
| 2.11 | SPACE | −22 |
| 2.18, 2.25 | KEY ×2 ("it") | −20 |
| 2.46 | THOCK + MAR C6 (orange "!") | −16 |
| 2.58–2.88 | SWISH 0.30 s (underline) | −24 |
| 3.40 | SQUISH, tiny (dot anticipation) | −28 |
| 3.52 | PLIP 500 → 900 Hz, 80 ms (dot pops off) | −16 |
| 3.60–4.20 | WHOOSH 1800 → 400 Hz, peak at 3.95 | −18 |
| 3.75–4.20 | SLIDE 900 → 300 Hz (fall) | −24 |
| 4.20 | PLIP 400 → 220 Hz, 120 ms (seed lands) | −14 |
| 4.40 / 4.48 / 4.56 | POP at C5 / F5 / A5 (TL chain) | −20 / −20 / −17, pan −0.35 |
| 4.80 / 4.88 / 4.96 | POP at D5 / G5 / C6 (TR chain) | −19 / −19 / −16, pan +0.35 |
| 5.20 / 5.28 / 5.36 | POP at F5 / A5 / D6 (BL chain) | −18 / −18 / −15, pan −0.35 |
| 5.60 / 5.68 / 5.76 | POP at G5 / C6 / F6 (BR chain) | −18 / −18 / −15, pan +0.35 |
| 4.70 / 5.10 / 5.50 / 5.90 | SCRATCH 0.35 s each (scribbles) | −26, panned per bubble |
| 6.30 / 6.46 / 6.62 | Focus glints: 0.1 s reversed noise swell into a 2 kHz + 3 kHz sine pair (τ 0.25 s), pitch ×1.00 / ×1.06 / ×1.12 | −20, panned |
| 6.85 | BELL A5 then C6, 60 ms apart ("for Imran") | −16, pan +0.35 |
| 7.05 | BOING 300 → 520 Hz, 0.15 s (seed hop) | −20 |
| 7.10, 7.13 | TSK ×2 (joy ticks) | −28 |
| 7.25 / 7.42 / 7.59 / 7.76 | PUFF (puffs turn orange) | −24, panned |
| 7.35 / 7.52 / 7.69 / 7.86 | FWIP + MAR F5 / A5 / C6 / F6 (ignitions BR / BL / TL / TR) | −15, panned |
| Ti + 0.04 / 0.07 / 0.10 | TICK ×3 per ignition (action ticks) | −22 |
| 8.21 | SQUISH (wind-up) | −20 |
| 8.21–8.88 | RISER, crescendo with clockwise auto-pan; hard cut at 8.88 (20 ms of silence) | −20 → −12 |
| 8.52 | PLIP 900 → 1300 Hz (small puffs sucked in) | −20 |
| 8.64 | PLIP 1130 → 1640 Hz (big puffs, +4 semitones) | −20 |
| 8.62 | SWISH 0.25 s (words unravel to ink) | −22 |
| **8.90** | **IMPACT:** THUMP + POP 260 Hz + MAR stab F5+A5+C6 + CRACK, with a 1.2 s reverb tail | −8 / −14 / −14 / −18 |
| 8.90–9.50 | PAPER ×6 at seeded times (shards) | −28, random pan ±0.5 |
| 9.35 / 9.42 / 9.49 / 9.56 | GULP at pitch ×1.00 / 1.06 / 1.12 / 1.19 | −20 |
| 9.66 | SQUISH (C1 anticipation) | −22 |
| 9.80 | HUP 380 → 620 Hz, 0.12 s (C1) | −16 |
| 9.92 / 9.96 / 10.00 | TSK ×3 (C1 lines) | −22, pan +0.25 |
| 10.18 | SQUISH, quiet (C1 closes) | −26 |
| 10.34 | SQUISH (C2 anticipation) | −20 |
| 10.44 | HUP 480 → 820 Hz, 0.14 s (C2, bigger) | −14 |
| 10.56 / 10.60 / 10.64 / 10.68 / 10.72 | TSK ×5, each 1 semitone higher | −22, pan +0.3 |
| 10.87 | SQUISH, quiet | −26 |
| 11.02 | CREAK (anticipation) | −22 |
| 11.22 | BOING 300 → 900 Hz, 0.25 s + spin WHOOSH (BP 1.5 kHz, 12 Hz tremolo, 0.48 s) | −16 / −20 |
| **11.70** | **PAYOFF:** THUMP (soft) + BELL F5 A5 C6 F6 (1.4 s) + confetti "pfft" (noise HP 2 kHz, 0.25 s) + SHIMMER(16, 0.5 s) | −14 / −10 / −18 / −22 |
| 11.74 / 11.79 / 11.84 | SCRATCH 0.05 s (finger creases) | −28 |
| 11.77 / 11.85 / 11.93 | CEL C7 / E7 / G7 (sparkles) | −24 |
| 11.82 | "Tock": 600 Hz TICK (pump) | −20 |
| 12.27 | PLIP 520 → 440 Hz (dip squeak) | −24 |
| 12.42–13.12 | WHOOSH 400 → 2000 Hz + SLIDE 400 → 1000 Hz (flight home) | −18, pan 0 → +0.27 |
| 13.04 | POP 520 Hz (chip) | −16, pan +0.27 |
| 13.12 | MAR C6 then F6, 80 ms apart, + a soft 330 Hz POP (reaction lands) | −14, pan +0.27 |
| 13.32 | PLIP 900 → 1300 Hz, 50 ms (dot hops out) | −20 |
| 13.67 | PLIP 1600 Hz, 40 ms (dot lands in the "!") | −18, pan +0.05 |
| 13.72 | BELL G5 → C6, glassy (heart) | −16, pan +0.27 |
| 13.77 / 13.97 | TICK 1.2 kHz (avatar hops) | −26, pan −0.3 |
| 14.05–14.65 | AIR swell (push-in) | −26 |
| 14.55 / 14.65 / 14.75 / 14.85 | MAR F5 / A5 / C6 / F6 (word wave: the chat motif an octave up) | −15 |
| 14.85 | TICK 600 Hz, tiny (chip thumb pump) | −24, pan +0.3 |
| 15.30–15.90 | WHOOSH 900 Hz BP, 0.6 s swell (wipe) | −18, pan L → R |
| 15.92 | TWINKLE 2800 Hz + 4200 Hz, 0.4 s (orange dot) | −22 |
| 16.02 | SHIMMER(4, 0.2 s) (sparkle) | −26 |
| 16.30 | End. The pad has faded to silence. | |

---

## 5. Risks, mitigations and cut order

**Risks**
1. **Morph quality** (base ↔ C ↔ C2, and base → thumbs-up).
   - Use the §1.5 resampling with offset search for every morph.
   - Inspect frames 294–300 (C1), 313–319 (C2) and 337–351 (spin) at full size.
   - The spin hides most artifacts.
2. **Thumbs-up legibility.** Check the silhouette at 25% before animating. In the chip, the thumb is about 66×86 px with ≥2 px creases. If it still doesn't read, raise the thumb scale to 0.22 and widen the chip to 180×112, keeping the center.
3. **Displacement resolve.** Prototype the per-frame feDisplacementMap scale in headless Chromium on day one. If it is slow or unstable, use the slice-displacement fallback (§3.4).
4. **Fonts.** Gate frame 0 on font loading. A fallback font would break every measured position.
5. **Two-page camera.** Boil seeds use `floor(t*12)`, never the frame index. Shake and zoom apply only to the world layer, never to the badge, grain or wipe. Reparenting the flyers happens only when Z = 1 and camY is at rest (4.20 and 13.12).
6. **Small text on phones.** Thought words are ≥100 px. The end push-in brings the bubble text to about 113 px.
7. **Sync.** The constants block (§2) is the only source of times. Never place a sound by hand.

**Cut order** (cut item 1 first)
1. Avatar happy hops (13.77–14.17).
2. Dot-return arc (13.32–13.82). Instead, the dot pops in place at 13.40 (easeOutBack, 0.25 s).
3. Payoff radial burst lines. Keep the confetti and sparkles.
4. Comet tails. Fallback: draw 4 source-style ink arcs (about 200°, radius 290–340) that write on over 8.62–8.95 and fade by 9.40. Keep the gulps.
5. Scribble → word focus pull. Fallback: a left-to-right mask reveal of each word (0.40 s), with the pen nib riding the mask edge. Keep the four words.
6. Ink impact frame. Cut straight to the orange blob on frame 267, and keep the rings and shake.

**Never cut:**
- "Imran, I got you!" in the bubble
- the typed "I’ve got it!" with the orange "!"
- the readable words
- "for Imran" starting the ignition chain
- the clockwise spiral and the impact
- C pose ×2
- the jump-spin into the thumbs-up
- the reaction landing on the bubble
- the push-in and word wave
- the badge
- the black diagonal wipe
