# Reference style notes — "Honest Questions" reels

Two reference reels were supplied (both 720×1280, 30 fps, AAC 44.1 kHz stereo):

| ref | topic | length | words | pace |
|---|---|---|---|---|
| A | "Cain's Wife" | 84.2 s | 219 | 2.74 words/s |
| B | "The Tree" | 89.5 s | 269 | 3.11 words/s |

Ref B is the closer match to the brief (off-white captions, coral highlights, label pills with
leader lines, golden light pillars, Scripture card, Gift/Burden poll, typed comment bubble).
Ref A adds the full-screen cream "verse page", the search-bar gag and the timeline graphic.
Their channel name, π-gate logo, "THE LINTEL / NETWORK" wordmark and all their text are **not** reused.

---

## 1. World art style
- **Low-poly 3D, flat shading, matte.** Big faceted icosphere tree crowns, cylinder trunks,
  box houses with pyramid roofs (red / green / blue / ochre roof caps), flat rivers as
  wedge polygons, palms as star-shaped leaf fans. No textures — every surface is one flat colour.
- **Long, soft sun shadows** (low sun from upper-left, shadows fall down-right, ~2–3× object height,
  soft-edged, warm-dark, ~35 % opacity).
- **Heavy atmospheric haze.** The upper ~35 % of the frame dissolves into a warm haze colour;
  everything far away is low contrast. Combined with a **tilt-shift blur** — top band and bottom
  edge are out of focus, the action band (y ≈ 45–80 %) is sharp.
- **Whole-frame mood tint.** Each scene is nearly monochrome: olive-gold garden, orange desert,
  slate-grey judgement, dark umber for the ending. Colour comes from the mood, not from props.
- **Vignette** on every frame (corners ~25–30 % darker). Light film grain / slight softness.

## 2. Characters
- **Flat 2D cut-out people standing in the 3D world** (billboards, always side/¾-profile).
- **Outline:** thick, clean, near-black warm brown (sampled `#220d01`–`#2b1d14`), ≈ 4 px at 720 w
  → **6 px at 1080 w**; consistent on every part.
- **Proportions:** head ≈ 1/5 of height, tall trapezoid tunic/robe (knee length), two thin
  rectangle legs with small foot wedges, capsule arms (upper + forearm) with rounded ends.
- **Faces:** profile head with a small nose bump, one almond eye (cream white `#fad8ba` + dark pupil),
  a short straight brow line for emotion, mouths only when needed. Hair is a solid cap/mass
  (black-brown `#493825`, blonde, red, white for elders), beards as a solid wedge.
- **Skin tones** diverse: `#88512c`, `#a86a3c`, `#c9925e`, `#5e3a22`, `#e0b48a`.
- **Clothing:** muted earth colours — brick red `#9b3d1f`, sand `#c9a36a`, olive, slate blue,
  plum, cream; a contrasting belt band (`#d7b484`).
- **Shadows:** soft dark ellipse under the feet + long cast shadow; feet always planted.
- **Acting:** small, readable gestures — reaching arm, pointing, shrug, walking cycle with
  arm swing, a red "?" bobbing above a head, red ground rings to call out people.

## 3. Camera
- Mostly **high-angle, long-lens (near-isometric)** views, 30–50° down, plus a few
  **medium close shots** at character height (characters fill ~45 % of frame height).
- **Never static:** slow push-ins, lateral drifts and orbits with ease-in-out; a shot lasts
  2–6 s (≈ one caption sentence).
- Close shots use **shallow depth-of-field** — the background (houses, walls) is soft.

## 4. Captions (word-by-word)
- **Font:** Cormorant Garamond *Italic* (≈ 42 px at 720 w → **~63 px at 1080 w**), sentence case.
- **Position:** top third, left-aligned, x = 44/720 (→ 66 px), first baseline ≈ y 300/1280 (→ 450).
  Max line width ≈ 92 % of frame, ~2–3 lines per sentence, line height ≈ 1.25.
- **Colour (ref B):** warm off-white `#f4f3e5` with a soft dark shadow; sits on a **soft
  darkened horizontal band** (blurred gradient, ~45 % black at centre) so it reads on any scene.
  Ref A uses dark ink on light sand — we follow ref B (off-white on band), as the brief asks.
- **Reveal:** each word appears exactly when spoken; the **next word is pre-shown ghosted**
  (~35–40 % opacity, slightly lighter), then snaps to full opacity. The whole caption is held
  until the sentence ends, then fades over ~0.25 s; a new sentence starts fresh.
- **Highlight words:** serif **caps** (Cinzel-like) in **coral red** (`#f47552` sampled; brief
  specifies `#e5534b`), same cap height as the italic x-height + ~20 %, faint glow, tiny pop.
  1–2 per sentence.

## 5. Overlays
- **Label pill:** small dark rounded tag (`#1a1510` at ~85 %, sampled `#43371f` over ground),
  white letter-spaced caps (Work-Sans-like sans, ~0.2 em tracking, ≈ 11 px at 720 → 17 px).
  Optional **thin 1–1.5 px white leader line** ending in a tiny dot on the 3D object.
  Format "THING · BOOK 2:9". Fades/slides in ~0.3 s.
- **Scripture card (ref B):** cream card `#ece2d0`, radius ≈ 14 px, soft drop shadow,
  **thin deep-red left accent bar** `#8b3828`, centred italic verse in near-black `#120800`,
  key words in **deep maroon caps** `#73221b`, tiny letter-spaced reference line
  "DEUTERONOMY 30:19 · KJV" in muted red. The scene behind darkens slightly. Card fades up from
  ~20 px below over 0.4 s, holds while the verse is read, fades out.
- **Verse page (ref A):** full-screen cream `#e4dbc9` wash over a ghosted scene — used here only
  as inspiration for the paper-slide feel.
- **Top bar (every frame):** tiny logo mark + "HONEST QUESTIONS" left, episode title right, in
  letter-spaced sans caps (≈ 11 px at 720 → 17 px), cream `#fbe9c2` at ~85 %, y ≈ 70/1280 (→ 105).
- **Ending poll:** dark umber radial background (`#2d1d14` centre → `#15100d` edge), two icons
  (glowing cream gift vs. dull grey chain/anvil) with Cinzel labels, the chosen one has a warm
  halo. Then a **cream pill comment bubble** (`#f4eee2`) with a red avatar dot `#82221b` that
  **types** "A gift, because…", small red hearts float up from its right end.
- **Logo outro:** near-black `#15100d`, logo mark draws on (stroke reveal), wordmark fades in
  Cinzel caps cream `#fbf4ee`, small letter-spaced sub-line. ~3 s.

## 6. Mood → palette (sampled)
| mood | ground | haze/top | used for |
|---|---|---|---|
| garden / blessing | `#86853e` | `#a39050` | hopeful scenes |
| desert / daily life | `#c27b3a` | `#c68b4d` | narrative, choice |
| sand / town | `#8b6333` | `#c8a36a` | town scenes |
| judgement / weight | `#56534c` grey | `#6b675e` | war, sin, the cross before light |
| ending | `#2d1d14` → `#15100d` | — | question + poll |
| verse | cream `#e4dbc9` / `#ece2d0` | — | Scripture |

Transitions between moods: ~0.6–0.8 s crossfade with a slight blur/brightness dip; scripture
moments wash toward cream; the outro cuts to black.

## 7. Golden light-pillar moments
- A **vertical cone of warm light** (`#fdf8ba` core → transparent), slightly wider at the ground,
  with a **bright elliptical pool** on the ground, **floating dust motes** drifting upward, the
  rest of the scene dims ~20 %. Fades in over ~1 s, used on the turning-point lines
  ("He knew…", "If God had taken the tree…", "the CROSS").

## 8. Structure & pacing (ref B)
1. **Hook question at t = 0** — the first word is already on screen, no intro card.
2. Problem stated (3 short sentences), a "what-if" thought experiment, two Scripture beats.
3. Turn: light pillar + answer, Jesus/cross tie-in.
4. Restate the question → answer in one line.
5. **Poll** ("Do you think… A or B?") → "Tell us why in the comments." with typing bubble.
6. Logo outro (~3 s).
- Narration: calm, warm **male baritone** (median F0 ≈ 111 Hz), 2.7–3.1 words/s, 0.4–0.7 s
  pauses between sentences, ~0.3 s after commas. Verses are **read aloud** while the card shows.
- Music: soft continuous ambient bed ~6 dB under the voice (pauses sit around −20 dBFS RMS);
  subtle UI "tick/pop" on highlights. Integrated loudness ≈ −17 LUFS (we target −14 LUFS for IG).

## 9. What we improve
- Higher resolution (1080×1920 vs 720×1280), crisper outlines, real bloom & DOF.
- More acting: brows, mouths for laughing/preaching, bouncing shoulders, blinking, breathing.
- Ambient life: birds, chimney smoke, swaying grass, sawdust, rain, lightning.
- A single visual thread — **the glowing door** — repeated ark → hill → city → poll icon.
- Loop: last frame echoes the first (ark on dry land under a clear sky).
