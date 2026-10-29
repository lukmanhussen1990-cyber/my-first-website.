# Style notes — Grace in Motion

Updated for episode **not-an-apple** (Idea 76).

## Sources looked at

| Source | Status |
|---|---|
| `reference/reference_01.mp4` (720×1280, 30 fps, 89.5 s), 89 frames at 1 fps in `reference/frames/` | studied |
| `episodes/never-died/` (render, style block, rig, Jesus images) | **not in this repo**: style block below was rewritten from these notes |

## Animation reference from you (29 Oct) — `reference/animation_reference_eden.png`

This is now the main look for **not-an-apple**: everything is **low-poly 3D** (faceted flat-shaded meshes), characters included.
- Golden-hour **backlight**: low sun behind the tree at upper left, warm god rays, glowing rim on leaves and hair.
- Faceted tree: thick angular trunk, a canopy of big low-poly chunks in yellow-green to deep green.
- Deep background: hazy cliffs with waterfalls, cypress trees, a sparkling river with rocks.
- Foreground flowers and leaves in strong blur (shallow depth of field), so the shot has three clear depth layers.
- Characters: low-poly figures, long dark faceted hair, simple calm faces. The snake is a smooth low-poly tube with a green/gold diamond pattern, wrapped around the trunk.
- **Our changes for this episode's rules:** no apples on the tree (glowing light shapes only); Eve and Adam in modest **leaf** garments from shoulders to knees, not the pink dress.

## What the first reference video does (copy the STYLE only)

**World**
- Warm low-poly diorama: faceted icosahedral tree canopies, palms, flat ground plane, a winding blue river.
- A long soft shadow from a low warm sun on every object. Soft contact shadows.
- High, long-lens camera (almost isometric). Tilt-shift depth of field: top and bottom of frame blurred.
- Light atmospheric haze, volumetric god-ray beams with floating dust motes for "holy" moments.
- Mood is colour-coded per scene: green-gold (garden), orange-amber (desert / law), cool grey (sad / no choice), dark warm brown (call to action).

**People**
- Flat 2D cut-out figures standing in the 3D world (billboards), dark-brown outline about 3–4 px at 1080 wide, flat fills, one shadow tone.
- Weak spot: tiny heads, dot eyes, almost no eyebrows or mouth, stiff limbs, very little acting. **We do better:** bigger readable faces, eyebrows, mouth shapes, follow-through on hair and leaves, real poses.

**Text and graphics (measured, scaled to 1080×1920)**
- Header ≈ y 105 px: small logo + series name left, episode name right, white letter-spaced caps ≈ 20 px.
- Captions: top-left block from y ≈ 450 px, left margin ≈ 66 px, italic serif (Cormorant-style) ≈ 66 px, white with soft shadow, a soft dark horizontal scrim band behind.
- Word-by-word reveal; the next word shows as a faint ghost before it is spoken. Keywords in coloured bold caps.
- Label tags: near-black rounded pill, white letter-spaced caps ≈ 24 px, thin white leader line ending in a dot on the target.
- Scripture cards: cream rounded card with a thin coloured left bar, italic serif, keywords in deep coloured caps, reference line in small letter-spaced caps ("BOOK 30:19 · KJV"), soft drop shadow, held 4–6 s.
- Call to action: two choice icons (the chosen one glows), a pill comment box that types an answer, small floating hearts. Then black, and a logo draws itself in brush strokes (~2 s).

**Pace and sound**
- Voice from frame 1, no intro. A new caption sentence every 2–4 s, a new shot every 3–6 s.
- Cuts are mostly crossfades plus slow camera drifts, pull-backs and push-ins.
- Continuous soft music bed under the voice (never silent), integrated loudness ≈ −14 LUFS.

## Do NOT copy
Their series name, their logo mark, their episode title, their coral-red keyword colour, their character designs (tan tunics, plain green snake), their props and their script lines.

## Our version — same family, better

| Area | Grace in Motion rule |
|---|---|
| Hook | Big object + big two-line title on frame 1, a physical "slam" event in the first 5 s |
| Keywords | **Gold** `#F2B544` caps (red `#C0392B` only for "wrong" / added words) |
| Characters | Expressive paper-cut cartoon people: almond eyes with a highlight, readable brows, mouth shapes, leaf garments with follow-through |
| Light | Warm key + rim light on characters, bloom on holy/glowing things, haze layers, parallax foreground leaves |
| Retention | WORD CHECK tracker panel with 3 locked slots |
| Cuts | Match cuts and motivated camera moves instead of plain crossfades |
| Text moments | "Document edit" metaphor (cream strip, red caret, typed insert) so text screens still move |
| Brand | GRACE IN MOTION header + gold logo, our end card |

## STYLE BLOCK (paste at the start of every GPT Image prompt)

> Flat 2D paper-cut illustration in a warm cinematic storybook style. Clean dark brown outline (#3B2416) of even weight around every shape, expressive cartoon faces (almond eyes with a small white highlight, clear eyebrows, small expressive mouth), matte flat colors with one soft shadow tone per shape and a thin warm rim light on the lit edge, warm biblical palette (olive and sage green, ochre, terracotta, cream, soft gold, deep warm brown), cinematic lighting from a low warm sun, high detail but clean and readable on a phone screen, no text, no letters, no numbers, no watermark, no signature, no frame, no border.

**WORLD ADD-ON (backgrounds only)**

> The world is a warm low-poly diorama: faceted low-poly trees, hills and rocks with flat-shaded triangular facets, soft ambient-occlusion contact shadows, long soft shadows, light atmospheric haze, gentle tilt-shift depth.
