# Reference style notes v2 (measured): Q.02 "The Oldest Man"

Written by the style track. These notes replace `ark_ref_style_notes.md`; corrections to that file are marked **[fix]**.
All numbers were measured with ffmpeg, PIL and numpy on the two reference reels. Both are 720×1280, 30 fps, AAC 44.1 kHz stereo.

| ref | file | length | shots | words/s |
|---|---|---|---|---|
| A | `refA_cains_wife.mp4` | 84.2 s | 23 | 2.6 |
| B | `refB_the_tree.mp4` | 89.5 s | 26 | 3.0 |

**Scale rule:** our output is 1080×1920, so **×1.5** turns every 720-px number into our pixels.

## Files

| file | content (timestamp in the source reel) |
|---|---|
| `frames/refA_NNN.jpg`, `frames/refB_NNN.jpg` | 1 frame per second; frame NNN is at t = NNN−1 s (84 + 89 frames) |
| `closeups/close_1.png` | A 2.20 s: Cain and a white-haired woman, full-figure medium shot, "?" mark |
| `closeups/close_2.png` | A 8.10 s: same pair, a different caption |
| `closeups/close_3.png` | A 26.50 s: Cain and his wife, brick props |
| `closeups/close_4.png` | A 52.60 s: Abraham and Sarah at a striped tent, two label pills |
| `closeups/close_5.png` | B 1.60 s: Eve reaching for fruit, serpent on the tree (best "close" shot) |
| `closeups/close_6.png` | B 69.20 s: Adam, Eve and the serpent |
| `wides/wide_1.png` | A 36.50 s: village of pyramid-roof houses, crowd, label with leader line |
| `wides/wide_2.png` | A 59.00 s: green hill, river, palms, "OTHER PEOPLE?" label |
| `wides/wide_3.png` | A 55.50 s: village plus crowd from high up, terraced fields |
| `wides/wide_4.png` | B 4.50 s: garden, river, palms, trees, sheep |
| `wides/wide_5.png` | B 12.50 s: widest garden view (best for shadows and haze) |
| `wides/wide_6.png` | B 80.50 s: orange desert, crowd walking a glowing path to a lit door |
| `closeups/closeups_sheet.jpg`, `wides/wides_sheet.jpg` | 6-up contact sheets |
| `cards/card_1.png` | B 55.0 s: Scripture card floating over a scene |
| `cards/card_2.png` | A 31.5 s: full-screen cream "verse page" |
| `cards/card_3.png` | B 2.1 s: caption-only frame (white italic with coral caps over the dark band) |

---

## 1. Characters

### Build
- Flat 2D paper cut-outs on vertical planes in the 3D world. There is **no shading on the figures at all**: each part is one flat colour.
  - The one depth cue is that the **far leg and far arm are about 18 % darker** (Eve: far leg `#8a5632`, near leg `#a8683a`).
- The two reels use two different builds:
  - **A (angular):**
    - Polygonal head with a hard jaw corner and a sharp triangular nose wedge.
    - Hair is a solid cap with a straight fringe that doubles as the brow.
  - **B (rounded):**
    - Round head with a small rounded nose bump.
    - Long hair as one solid mass.
- **Proportions:**

| ref | figure | height | head | ratio |
|---|---|---|---|---|
| A | Cain | 474 px | 132 px | 3.6 heads |
| A | woman | 480 px | 145 px | 3.4 heads |
| B | Eve | 374 px | 69 px | 5.4 heads |
| B | Adam | 282 px | 58 px | 4.9 heads |

  **[fix]** The old notes said "head ≈ 1/5" for both reels. That only holds for B; A is about 1/3.5.
- **Eye:** one almond per head, in profile, with no lids or lashes.

| | A | B |
|---|---|---|
| width ÷ head height | 0.23 (31 px on a 132 px head) | 0.19 (13 px on 69 px) |
| height ÷ width | ≈ 0.30 | ≈ 0.6 |
| outline | none | thin dark ring |

  - The eye white is warm cream, **not white**: `#f6d0ab` to `#f7d8b6`.
  - The pupil is a round dark-brown dot `#332413`, about 1/3 of the eye width. It sits centred or forward and can poke past the almond.
- **Brows:** usually none. Some women get a flat darker tonal bar above the eye. The emotion comes from the "?" mark, not from the face.
- **Nose:** A uses a triangle that sticks out about 0.13 × head height. B uses a rounded bump of about 0.08 × head height.
- **Mouth:** none in any frame we checked.
- **Body:**
  - Trapezoid knee-length tunic: shoulders about 0.75 head wide, hem about 1.2 heads wide.
  - Contrasting belt band about 0.12 × head height: cream `#a58768` on red, olive on Eve.
  - Arms are capsules about 0.15 × head height thick with **round mitten ends (no thumb, no fingers)**.
  - Legs are two straight bars about 0.17 × head height thick.
- **Feet:** A uses a small wedge or L-shape pointing where the figure faces. B uses an L-shaped boot that is the same piece as the leg, with a rounded toe. No toes in either reel.
- **Outline:** one continuous warm near-black stroke round every part, including the arm drawn over the body.

  **[fix]** It is **not** a constant screen width. It scales with figure size, at about **1.2 % of figure height**:

| figure height (720) | outline (720) | outline (1080) |
|---|---|---|
| 474 px (A close) | 5.5 px | 8.3 px |
| 374 px (B close) | 4.2 px | 6.3 px |
| 280 px | 3.2 px | 4.8 px |
| 150 px (crowd) | 1.8 px | 2.7 px |
| 90 px (wide) | 1.3 px | 2.0 px |

  - Colour: `#2a1206` to `#30100a` (median `#2e1c12` where it blends with the fills).
  - Flaws: the outline breaks or doubles at the feet and far leg in A (close_1). Edges are soft (2–3 px ramp) from upscaling and compression.
- **Palette (sampled):**

| part | colours |
|---|---|
| skin | `#89512c`, `#ae6c3b`, `#c98f4f`, `#ceb18c` (pale elder) |
| hair | `#3d2c20` (dark brown), `#24150e` (black), `#e3c5a3` (white/elder), `#ab5a2f` (red), plus blonde |
| robe red | `#773019` to `#983c20` |
| robe linen | `#aa8248` |
| robe cream | `#dcbe99` |
| other robes | olive green, slate blue, plum |

- **Staging in 3D:**
  - Figures are almost always in pure **side profile** (a few ¾ views), facing left or right, with both feet planted.
  - They never turn on screen; they simply face the other way. Crowds are depth-sorted on the ground.
  - The largest figure in either reel is **37 % of frame height**. **There are no face close-ups at all.**
- **Shadows on figures:**
  - A soft contact blob under the feet.
  - A soft cast shadow in the sun direction, toward the lower right of the screen.
  - Both are weak: ground × 0.73–0.83, so 18–27 % opacity. **[fix]** The old notes said 35 %.

## 2. World
- **Low-poly density:**
  - Tree crowns are jittered icospheres (detail 1–2) with about **8–10 facets across**, 40–60 visible.
  - Fruit has about 6 facets across. Palms are flat star fans on a cylinder trunk.
  - Houses are a box, a coloured roof slab and a cream pyramid cap, with a dark door `#1c1209`. No bevels and no textures.
  - The ground is a **flat single-colour plane** with a soft gradient: no grass, no displacement, almost no props. A wide has about 15–30 props in total (sheep, fruit, rocks).
- **Facet contrast:**
  - Foliage runs from `#2d3918` (shade) to `#636c39` (lit), a luminance ratio of about 2.1.
  - Houses in A are almost unlit: pyramid lit face `#b4936b` against shade face `#b9986c`, a ratio of about 1.0.
- **Palette by mood (sampled):**

| mood | lit ground | haze (top of frame) | notes |
|---|---|---|---|
| sand/town (A) | `#aa814b`, `#9d6c38` | `#c8ab7e`, `#bd9d6c` | roofs: red `#903b21`, green `#475428`, ochre `#956e2c`, slate `#384446` |
| garden/olive (B) | `#8f8f42`, `#787735` | `#a48e4f`, `#9e874d` | river `#6a7b69`; foliage `#39411e` to `#636c39` |
| orange desert (B) | `#ca813b`, `#d1853f` | `#ce904f` | glowing path `#ffad56` |
| grey judgement (B) | `#56534c` | `#6b675e` | from the older notes |
| dark ending (B) | `#2d1d14` → `#15100d` | n/a | radial |

- **Fog/haze:**
  - Distance haze fills the top 25–35 % of the frame; the far ground fades to the haze colour.
  - The camera looks down, so **the sky is never shown**.
  - **Tilt-shift:** sharpness (Laplacian energy) drops 10× in the top band and in the bottom 25 %. Only y ≈ 50–72 % of the frame is sharp in wides.
- **Light:**
  - One warm sun from the **back-left**: shadows fall toward the camera and to the right, about 35–40° below horizontal on screen.
  - Shadow length is about 1× object height in B (sun about 40–45° high) and 1.5–2× in A (sun about 25–30°).
  - Shadows are soft: penumbra about 6–10 px at 720, about 1.2 % of frame width. They are multiplied (hue kept).
  - There is no fill colour shift, no rim and no AO.
  - "Golden light-pillar" moments (B):
    - A cream cone with a bright ground pool (ellipse h/w ≈ 0.43) and lit dust motes.
    - The rest of the frame dims about 20 %.
- **Vignette:** **[fix]** Weaker than noted before. Frame edges are 8 % darker than the centre in B and about 20 % darker at the bottom corners in A.

## 3. Camera
- **Lens:** extremely long, close to orthographic. Two ground rings at different depths in one frame differ in size by under 1 %, so vertical FOV is roughly 15° or less.
- **Angle:** measured from ground-ring ellipses (h/w = 0.49).
  - Medium shots: **elevation about 30°**.
  - Wides: about 35–50°.
  - Never eye level, never a low angle, never a close-up.
- **Moves:** **[fix]** Mostly locked off.
  - **71 % of all frames are effectively static** (mean frame-to-frame change under 0.6/255 at 72×128).
  - The rest are slow pushes or drifts of 1–3 % per second; the life comes from characters and overlays.
  - Ref A has three "fly-through" camera travels across one continuous world, lasting 1.4–2.1 s (13.5 s, 65.9 s, 70.3 s).
- **DOF:** medium shots have a softly blurred background. Wides use the tilt-shift band described above.

## 4. Text

### Captions
- **Font:** Cormorant Garamond Italic, sentence case.
- **Size:** x-height 16 px at 720, so **em ≈ 40.5 px at 720, or 61 px at 1080**.
  - Our font metrics are x-height 0.395 em and cap height 0.623 em.
  - The first caption (the hook) is bigger: 1.2× in B (x-height 19) and 1.4× in A (x-height 22).
- **Highlight words:** **[fix]** These are Cormorant Garamond **SemiBold/Bold upright caps at the same em** (B: cap height 31 px against x-height 19), not "x-height + 20 %". They have a faint glow.

  Colours:
  - B: `#f27b5b` coral on white text `#ecede0`.
  - A: maroon `#6d1f15` on dark ink `#1f0b00`.
- **Position:**

| | left edge | first baseline | line pitch | wrap |
|---|---|---|---|---|
| B | x = 45 px (6.3 %), so 68 px at 1080 | y = 312 (24.4 %), so 468 px at 1080 | 52 px (1.28 em) | about 575 px (80 %) |
| A | x = 58–62 px | y = 182 (14.2 %) | 47–54 px | n/a |

- **Reveal:** word-timed. The **next word is pre-shown at 40 % opacity** (measured 0.43), then snaps to 100 %. The whole sentence holds, then clears.
- **Readability band (B):** a fixed soft dark horizontal band.
  - Centre at y ≈ 330 (25.8 %), FWHM about 110 px.
  - Multiplies the scene by **0.76** at its centre.
  - At 1080: centre y ≈ 495, FWHM ≈ 165 px.
  - A has no band; it relies on dark text over light haze.

### Top bar
- On every frame: logo, series name on the left and the episode name on the right, in letter-spaced sans caps.
- Cap height is 7 px in B and 10 px in A; text sits at y ≈ 67–95.
- **Ours must differ (see DO NOT COPY).**

### Label pills
- A near-opaque dark rounded rectangle `#140e0a`, **33–35 px tall at 720 (≈ 51 px at 1080)**, radius about 4 px, padding about 12 px either side.
- Text is cream `#ddd6d1` letter-spaced sans caps (about 0.18 em tracking), cap height 13 px, so the font is ≈ 18 px at 720 or 27 px at 1080. **[fix]** The old notes said 11 px.
- Formats: "THING", or "THING · BOOK 2:9".
- **Leader line:** a 1.5 px line from the pill to the object.
  - B: cream, ending in a 5 px cream dot with a glow on the target.
  - A: a dark line.
- Other callouts: a red "?" over heads, red ground rings, a red X and red connecting strings (A).

### Scripture card (B, `card_1`)
- Size: x 36–684 (90 % width), y 300–545 (245 px tall), **radius about 13 px**.
- Colours: card `#ece3d1`; **4 px left accent bar `#8c382c`** inset vertically.
- Shadow: a soft drop shadow 3–4 px down with about 8 px blur, about 20 % darker.
- Verse text:
  - Centred italic `#2e1c12`, x-height 15–16 (em ≈ 40 px at 720).
  - Line pitch 49 px (1.22).
  - Key words in maroon caps `#762722`, slightly smaller (cap height 20–21 px, about 0.8×).
- Reference line:
  - Letter-spaced sans, cap height 9 px, maroon, centred, about 45 px under the last line.
  - Format "DEUTERONOMY 30:19 · KJV".
- Timing: holds 5.7 s while the verse is read.

### Verse page (A, `card_2`)
- A full-screen cream wash `#e2d8c6` over the scene; the ghost scene shows through at about 8–10 %. The top bar is hidden.
- Text:
  - Italic em ≈ 52 px at 720 (x-height 20–21), line pitch 62 (1.19).
  - Maroon caps `#6f1f1d` at about 0.85×.
  - Centred block, centre at y ≈ 610 (47.6 %).
- Timing: about 4 s each, used 4 times in A.

### Endings
- **A:** a hard logo outro, about 3 s on near-black.
- **B:**
  - A two-icon poll on a dark radial background for 5 s.
  - A cream pill comment box types an answer while small hearts float up.
  - Then a 2 s logo outro.

## 5. Pacing and transitions
- Shot length:
  - **A:** mean 3.1 s, median 3.2 s, range 0.4–4.7 s.
  - **B:** mean 3.3 s, median 3.0 s, range 1.4–8.4 s.
  - The 8.4 s shot is the puppet-strings shot.
  - **No hard cuts:** ffmpeg `select=gt(scene,0.3)` finds only one event per reel, and both are flashes.
- Transitions:

| type | frames | where |
|---|---|---|
| quick dissolve | **4–6 frames (0.13–0.2 s)** | almost all of B |
| dissolve | **10–15 frames (0.33–0.5 s)** | A |
| cream verse-page fade | 0.3–0.5 s in, then dissolve or fly-through out | A |
| world fly-through | 1.4–2.1 s | A |
| flash cut through cream, then 6-frame settle | n/a | B 49.0 s |
| dip to black | 5 frames | B 82.1 s, into the poll |

  **[fix]** The old notes said 0.6–0.8 s crossfades.
- **Hook:** the caption is already on screen at frame 0. There is no intro card.
- **Voice:**
  - Calm male baritone, 2.6–3.0 words per second.
  - **Almost no pauses ≥ 0.25 s** (1 in A, 2 in B); the edit is tight.
- **Mix:** **[fix]** −14.1 LUFS integrated in both reels (not −17), LRA 3.2/3.6 LU, true peak −1.2/−0.8 dBTP.
  - Under-bed level (the music and ambience heard in pauses) is about **20–30 dB under the voice**:

| ref | bed in pauses | character |
|---|---|---|
| A | −34 dBFS | 64 % of energy at 20–80 Hz (sub drone) |
| B | −44 dBFS | 81 % at 250–1000 Hz (soft pad) |

  - Voice median is about −15 dBFS RMS.
  - Sound effects are minimal: subtle ticks and pops.

---

## HOW WE BEAT IT (measurable targets)
The quality loop checks these numbers on `quality/compare_N.png`. Every value is given at 1080×1920.

### Characters
1. **Real close-ups.** S2 face shot: the head is **≥ 45 % of frame width**. The reference never goes past a 37 %-tall full figure.
   - Textures are **≥ 1024×2048 per character**, with mipmaps and anisotropy 8–16.
   - The edge ramp is **≤ 1.5 px** in close-ups (ref: 3–4 px soft at 1080).
   - No outline gaps or doubles anywhere. The ref breaks at the feet.
2. **Constant outline of 5 ± 1 px on screen** for figures from 150 to 1500 px tall. The ref drifts from 2 to 8 px.
3. **Proportions:** adults 4.2–4.6 heads (between A's 3.5 and B's 5.2), children 3.0–3.3, elders 4.2 with a slight stoop.
   - Height varies ±12 % across the cast, with at least 3 builds (thin, average, broad).
4. **Face:**
   - Almond eye **0.20–0.22 × head height**, with a pupil about 0.35 × eye width.
   - **1.5–2 px dark lid line** on top (A has none; B has a full ring).
   - Eyebrows on every adult, a 3–5 % head-height bar.
   - Blink every 3–5 s (2 frames closed). The ref never blinks.
   - Nose bump about 0.10 × head height.
5. **Cel shading** (the ref has none):
   - Shadow tone 20–25 % darker on the side away from the scene's key light, within 10° of the sun or lamp direction.
   - A warm rim 2–3 px wide on the light side.
   - Far limbs 15 % darker (matches the ref).
6. **Detail:**
   - 3–5 strand lines in hair and beards; 2–3 fold lines per robe.
   - Mitten hands **with a thumb**; 3–4 toe notches on bare feet.
   - At least one accessory per named character: staff, sash, headband, bracelet, satchel or oil lamp.
7. **Ground contact:** a contact shadow with **35–45 % centre opacity** (the ref's 18–27 % looks floaty) and a cast shadow in the true key direction.
8. **Life:** breathing (±1 % torso scale at about 0.25 Hz), beard and robe sway in wind, and a 2–3 frame paper-flip squash on every turn. The ref has none of these.

### World
1. **Faceting:**
   - Crowns of 80–320 faces with per-face colour jitter of ±5–8 % luminance. The ref's faces vary only with the light.
   - Rocks and houses with 2–4 % bevels.
   - Ground is a noise-displaced plane of **≥ 128×128 segments** with vertex-colour gradients and worn paths. The ref ground is one flat colour.
2. **Set dressing:** **≥ 150 instanced props** in every wide (grass tufts, pebbles, pots, baskets, firewood, footprints). The ref has 15–30.
3. **Facet contrast:**
   - Lit/shade luminance ratio 1.6–2.2 on foliage **and ≥ 1.4 on buildings**. Ref A buildings are about 1.0 and read flat.
4. **Palette:** our own values; see DO NOT COPY.
   - Proposed base colours:

| role | hex |
|---|---|
| sand | `#cfa76c` |
| ochre | `#b97a37` |
| olive ground | `#7d7a3e` |
| dusty-red rock | `#9b5b3e` |
| mud brick | `#b98c5a` |
| outline | `#2a1810` |
| night | `#16203a` |
| lamp | `#ffb35c` |
| holy light | `#fff1c8` |

   - The robe palette must not reuse the ref's `#983c20` red robe and cream-belt combination.

### Light
1. Warm key sun plus a cool hemisphere fill. **Shadow maps of 2048–4096**, a penumbra of about 1–1.5 % of frame width, plus contact AO under every prop.
2. **Show the sky** in S1, S3, S10, S12 and S13: a gradient, a sun disc or stars, and drifting low-poly clouds. The ref never shows sky.
   - Height fog plus distance fog keeps far contrast at **≤ 35 %** of the foreground.
3. **Night and lamp light** (the ref has no night scenes):
   - A point light with a falloff of about 2–4 m.
   - Faces within 1.5 m pick up an amber flicker of ±8 % at 6–9 Hz (seeded noise).
   - Bloom only on the flame and holy light (threshold 0.85).
4. **Light pillars:** match the ref's cone, pool and motes, then beat it with real bloom, volumetric god rays and motes lit by the beam. Dim the rest of the frame 20–30 %.
5. **Grade:** ACES/AgX filmic, one grade per mood (see BRIEF), grain 2–3 %, and a vignette of 12–18 % at the corners.

### Camera
1. Long lens:
   - Vertical FOV **14–22° on wides** and 18–30° on close-ups.
   - Elevation 30–45° on wides (the miniature look, as in the ref) and **5–15° on close-ups** (new for us).
2. **Every shot moves:** an eased push of 1.5–3 % per second, an orbit of 1–2° per second, or a crane. The ref has 71 % static frames.
   - A static hold is allowed only on purpose: the 0.6 s silence and the raindrop.
3. **DOF on close-ups:** background blur ≥ 6 px, with smooth focus pulls over 12–20 frames.
   - **Tilt-shift on wides:** top 15 % and bottom 20 % softened (as in the ref).
4. **Shot lengths** 2.0–3.5 s, with something new at least every 2 s.
   - Transitions: 6–10 frame dissolves, match cuts (rain on the ark to rain on the city) and one world fly-through. Never the ref's 4-frame mush.

### Text
1. **Captions:**
   - Cormorant Garamond Italic 600 at **em 64–68 px**. The hook line is 1.3× (about 86 px), punched in at frame 0.
   - Left x = 72 px; first baseline y ≈ 470 (24.5 %); line pitch 1.22 em; wrap at 82 % width.
   - Highlight words: Cormorant Garamond 700 caps at the same em, in **our gold** (for example `#f4c45a` with a soft glow), never coral or maroon.
   - Ghost next word at 40 %, plus a 6 px rise and a 120 ms ease when it lands. The ref simply snaps.
2. **Band:**
   - A soft dark band behind captions: multiply 0.72–0.78 at its centre, FWHM about 170 px, following the caption block's height.
   - Plus a text shadow `0 2px 8px rgba(0,0,0,.45)`.
   - Contrast target: **≥ 4.5:1** against the band on every frame.
3. **Labels:**
   - Pill 50–54 px tall, Inter 600 caps at 26–28 px, 0.16–0.18 em tracking, radius 10.
   - Our own colours: deep umber glass `rgba(22,16,12,.82)` with a **1 px gold hairline**.
   - Leader line 2 px with a 7 px dot. Slide in plus fade over 0.3 s.
4. **Verse cards:**
   - Our own design: parchment `#efe2c2` with a **gold top and bottom rule**, a subtle paper grain and a deckled edge. No red left bar, no cream full-screen wash.
   - Verse italic at em 58–62 px; key words in gold caps; reference line in Inter 600 with tracking.
   - Rises 24 px over 0.4 s.
5. **The math tracker and the 3D numbers are ours.** The ref has no numeric device.

### Sound
1. −14 LUFS integrated, ≤ −1 dBTP (the ref sits at −14.1 and −0.8).
2. A real music bed ducked **8 dB under the voice**, louder and more emotional than the ref's −34/−44 dBFS bed. It moves from D minor to D major.
3. **Sound design on every visual hit:** number thocks, the boom, the lamp puff, the raindrop plip and thunder. The ref has almost no sound effects.
4. Breathing room: allow 0.4–0.7 s pauses at the 3–4 dramatic beats. The ref has 1–2 pauses in the whole reel.

---

## DO NOT COPY
- **Brand:**
  - The series title "HONEST QUESTIONS" and the red gate/"π" logo mark.
  - The "THE LINTEL / NETWORK" wordmark and the "Covered, every day." tagline.
  - Their top-bar layout (logo and series on the left, episode on the right, on every frame).
  - Their outro (red mark on black, then the wordmark).
- **Their signature colours:**
  - Coral highlight `#f27b5b`; maroon highlight caps `#6d1f15`, `#762722`, `#6f1f1d`.
  - Card cream `#ece3d1` with the red left accent bar `#8c382c`.
  - Verse-page wash `#e2d8c6`.
  - Label pill `#140e0a` with cream `#ddd6d1` text. Ours is umber glass with a gold hairline.
  - Their exact red-robe and cream-belt costume.
- **Their script lines:**
  - Anything from "Where did Cain's wife come from?", "If God knew Eve would eat the fruit…" or "Tell us why in the comments."
  - Their questions, their poll wording ("GIFT / BURDEN") and their caption sentences.
- **Their gimmicks and exact shots:**
  - The search-bar autocomplete gag and the open-book "GENESIS 4 / GENESIS 5" graphic.
  - The ADAM–ABRAHAM–MOSES dot timeline. Our S4 is a parchment bar chart with icons.
  - Red ground rings, the bobbing red "?" and the red X; puppet strings.
  - Eve and the serpent at the fruit tree, and Cain with the bricks.
  - The pyramid-roof village with red/green/blue/ochre caps.
  - The cross in a light pillar and the crowd walking a glowing path into a lit door.
  - The gift and chain poll icons, and the cream pill comment bubble with a red avatar dot.

    Our S14 (dice against an hourglass, a typed comment, hearts) must look different: 3D icons, a dark glass comment box with a gold border, our own avatar and hearts in our gold.
