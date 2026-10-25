# Reference reel — style notes

Source: the uploaded reference (720×1280, 30 fps, 89.4 s, AAC stereo 44.1 kHz). I watched it as 15 contact sheets at 2 fps and 14 full-resolution frames. Colours below were sampled with PIL. The reference's channel name, logo mark and episode title are **not** reused anywhere.

## 1. Pacing (from the audio envelope + caption reveal times)
- 27 sentences, ~267 words in ~87 s of speech → **~3.1 words/s overall**. Inside a sentence it runs 3.5–4 words/s, so it's brisk.
- The voice and music bed are continuous. Gaps between sentences are only **0.1–0.3 s**, and there are no long silences.
- **One shot per sentence**: shots last 2.3–5 s. Cuts land exactly on the first word of a sentence. Long sentences (15–19 words) hold one shot with a slow push or orbit.
- Audio hits (whoosh, shimmer, low boom) mark scene changes: 6.0, 8.3, 40.8, 58.6 and 70.0 s. The music stops at 87.2 s, and a ~2 s logo sting follows.
- Structure: hook question (0–5.5 s) → reframe → escalating examples → grey "puppet" low point → golden "divine" turn → Scripture card → answer → poll + comment CTA → logo.

## 2. World / art style
- Low-poly 3D with **flatShading**, matte (no specular), big faceted shapes: trees are icosahedron blobs on cylinder trunks, rocks are dodecahedrons, buildings are plain boxes.
- One warm key light, low and from the side, casts **long, very soft shadows** (blurred PCF, low-contrast, tinted to the ground colour rather than black).
- **Heavy atmospheric haze**: the fog colour equals the sky colour, so the horizon dissolves and there's no visible sky line. Distant objects go pale and flat.
- Ground is a single flat colour with a subtle radial lighter "spot" under the action (a vignette on the ground).
- Camera: mostly 3/4 overhead, ~35–55° down, mid-telephoto (little perspective distortion). Close-ups drop to ~10–15° down at character height.
- Background depth of field in close-ups: foreground leaves and background trees are blurred (e.g. 0 s and 67 s).

## 3. Characters (2D flat figures standing in the 3D world)
- Flat-fill cartoon figures on billboards, **thick dark-brown outline `#251507`**. The outline is about 0.75 % of figure height, so it's thick in close-ups and thin in wide shots.
- Proportions: big head (~1/5 of height), trapezoid tunic or dress, limbs as uniform rounded "sausages", rounded nubs for hands (no fingers), foot shapes pointing in the facing direction.
- Faces are 3/4 profile: one visible eye (white sclera + dark pupil in close-ups, just a dot in wide shots), a small nose bump, no mouth. Hair is a solid dark shape; men have full beards.
- Flat colours, no shading. Skin tones are diverse: `#96633b`, light tan, deep brown. Clothes are muted: sand `#c8a77a`, sage, ochre, dusty red, slate blue, plum.
- Every figure stands on a soft elliptical contact shadow. They're hazed by fog like everything else.
- Acting is minimal (reach, walk, raise arms, point, kneel, lie down). Walk cycles are simple 2-pose leg swings with a slight bob.

## 4. Captions
- **Cormorant Garamond Italic**, off-white `#edeede`, ~38 px at 720 (≈ **56 px at 1080**), left-aligned at x≈44/720 (≈ 66 px at 1080). The baseline of line 1 sits at ~y = 300/1280 (23 %). Line height is ~1.3. Up to 3 lines.
- A **soft dark horizontal band** sits behind the caption block: a full-width blurred gradient at ~25–35 % darkness. You see it as a darker stripe across the frame.
- **Word-by-word reveal** exactly as spoken. The *next* word is already shown **ghosted at ~40 %** (grey). The current word fades up to 100 %.
- Highlight words: **Cinzel caps, coral red** (`#e5534b`; sampled `#eb7061` with glow), slightly larger cap height, faint red glow.
- The page clears when the next sentence starts (fast ~0.15 s fade), and the next page starts with its first word.

## 5. Overlays
- **Label pills**: dark rounded tag `#2d2517` (~95 % opacity), off-white `#f2ebdd` letter-spaced sans caps (~15 px at 720, tracking +0.18 em, bold). An optional **thin leader line** (1 px, off-white) runs from the pill to a 3D point and ends in a small dot. Formats: `IN THE MIDST OF THE GARDEN · GENESIS 2:9`, `EVERY WAR`, `NO CHOICE LEFT`, `THE SECOND TREE · 1 PETER 2:24`. Placed either under the action (y ≈ 70–80 %) or near the object with a leader. Fade in ~0.25 s.
- **Scripture card**: cream `#ece3d2` rounded card (r ≈ 14 px), soft drop shadow, **dark-red left accent bar `#7f342f`** (~5 px), centred italic serif body in near-black `#1d1507`. Key words are in **Cinzel caps, deep red `#72272c`**. A tiny letter-spaced sans reference line reads `DEUTERONOMY 30:19 · KJV` in `#724942`. The card fades and slides in at the caption position and holds for ~6 s while the verse is read.
- **Engraved text** on 3D objects (the tablets) is written letter by letter.
- **Icon row**: cream rounded "tablets" in a row (the law scene).
- **Ending poll**: dark brown screen `#21150e` with faint concentric radial rings. Two big icons with Cinzel labels (`GIFT` glows with a warm halo; `BURDEN` is a dull grey `#423e3d`). Then a **comment bubble** (cream pill `#f4f0e4`, dark-red avatar dot `#7c1c1e`) types "A gift, because..." with a caret, and small red hearts `#b13538` float up.
- **Logo outro**: near-black `#15100d`. The mark draws on stroke by stroke, then the wordmark fades in below. ~2 s.
- **Top bar** on every frame: small red mark + `HONEST QUESTIONS` on the left, the episode name on the right. Letter-spaced sans, `#efe0ba`, ~11 px at 720, y ≈ 70/1280.

## 6. Mood → palette (sampled: top / mid / ground)
| Mood | Top | Mid | Ground | Use |
|---|---|---|---|---|
| Garden / neutral warm | `#a28c4f` | `#878849` | `#807f3a` | innocence |
| Divine gold (pillar) | `#b19b59` | pillar core `#ecd889` | pool `#fdfd9f` | God acting |
| Grey (war / puppets / cross) | `#5a5b5c` | `#6a6862` | `#5e5c56` | fear, no choice, death |
| Maroon (sickness) | `#73473c` | `#6d432d` | `#4d2c1c` | suffering |
| Orange law / desert | `#c1884d` | `#ad7944` | `#ce833d` | commandments |
| Tan market | `#bf9e6e` | `#b57e54` | `#bd9459` | everyday life |
| Deep brown (choice) | `#755430` | `#7f5229` | `#674120` | decision, quiet |
| Dusk garden | `#7a5940` | `#63502e` | `#6c5b2d` | foreboding |
| Outro dark | `#21150e` | `#2b2019` | `#1d130c` | poll / CTA |
- Palette changes are a fast cross-dissolve with the cut, or a slow drain within a shot (the garden goes dusky at 63–66 s).

## 7. Divine / light-pillar moments
- A vertical soft cone of pale gold light from the top of the frame, brightest at the core (`#ecd889`), with slow drifting **sparkle particles** (small white-gold dots twinkling and rising).
- A **glowing elliptical pool** on the ground (`#fdfd9f`) with a soft halo ring. Characters inside it get brightened and lose contrast.
- The pillar fades in over ~0.7 s with a shimmer SFX. It's used for God's knowledge, the second tree (cross) and "children who love Him".

## 8. Transitions
- Mostly **cross-dissolves of 0.3–0.5 s** on the cut. Sometimes the camera pulls back while dissolving (2.5–3 s). Some cuts are hard, with a whoosh (to grey at 8.3 s and 40.5 s).
- Match moves: the garden is revisited from new angles, and the puppet crowd is the same group as the "no choice" crowd.
- There's never a fully static camera: each shot has a slow push, pull, truck or crane with ease-in-out.

## 9. Ending structure
Question to the viewer (2 options as icons) → "Tell us why in the comments." with a typed comment bubble and hearts → 0.3 s black → logo draw-on → end. Total CTA + logo ≈ 7.5 s.

## 10. What I will improve on
- The hook text is visible from frame 1 (the reference starts with 1 word). There's motion from frame 1 and no logo intro.
- Richer acting: brows and posture carry emotion. Crowds vary in body type, age, clothing, timing offsets and idle breathing, and everyone blinks.
- Ambient life: smoke, flags on tents, birds, flickering windows, dust motes.
- Post-processing: subtle bloom, vignette, film grain, depth-based background DOF in close-ups.
- Captions respect the Instagram safe zone (x 60–960, y 220–1500). The reference's top bar sits at y≈105/1920, under the IG header, so mine sits lower.
- The last frame echoes the first (dusk rooftop crowd looking up), so the reel loops.
