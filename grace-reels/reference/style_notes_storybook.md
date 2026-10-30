# Style notes: storybook_style.mp4

Source: `reference/storybook_style.mp4`, 720×1280, 30 fps, 61.1 s, H.264 + AAC 44.1 kHz stereo.
Frames: `reference/frames_storybook/f_001.jpg … f_122.jpg` (2 fps, `f_N` = t (N−1)/2 s).
All pixel sizes below are converted to our 1080×1920 canvas (×1.5).

We copy the **look** only: no story, people, lines or scenes from this video.

---

## 1. Line art
- Thin, clean, dark warm-brown lines (around #3A2418 to #4B2E22, never black). Weight is about 1.5–2.5 px at 1080 on faces and slightly heavier on outer silhouettes.
- Lines are mostly "inked" on the outer contour, eyes, brows, nose tip and lips. Inner cloth folds use thinner, lighter lines or none at all, so the shading does the work.
- Hair: grouped strands with 3–6 fine inner lines per lock, plus loose flyaway strands that catch the rim light.

## 2. Shading
- Soft cel shading: one main shadow tone with a smooth airbrushed gradient at its edge. It's never a hard two-tone.
- Warm blush on the cheeks and nose. Skin shadows go warm red-brown, not grey.
- Eyes: large but realistic (semi-real anime). Brown irises with 1 big and 1 small catchlight, a soft lower-lid highlight and defined upper lashes.
- **Rim / edge glow**: the main signature. Every character has a soft luminous edge (about 4–10 px glow, warm cream/gold) on the side facing the key light. Often the whole silhouette glows faintly against dark backgrounds. Skin edges catch gold.
- Subtle painterly grain over the whole frame, plus a slight vignette.

## 3. Palette (sampled)
| Scene type | Main colors |
|---|---|
| Night interior (close-up) | #0D0D1A · #12111D · #0A0917 bg, skin #B78D76 / #7A5244 |
| Moonlit sky | #141525 · #231F2D · #3F363F, moon glow cream |
| Candle interior | #130A08 bg · #582D1A · #9B633C · skin #D5A46D · highlights #E4C79B |
| Sunbeam outdoor (dim gold-green) | #343520 · #57533C · #797254 · #9F9372 |
| Golden bokeh close-up | #3B3736 bg · #674931 · #EBC59E skin · #DEAA7F |
| Gold "divine" close-up | #36200F · #5E3E22 · #AA8144 · #D2A95F |
| Purple dusk city | #140E1C · #2C1D29 · #695079 · #8F749B · clouds #BDA0AF |
| Night bedroom | #111526 · #161B2D · #232839 · #484151 |
| Dawn window | #101425 · #242738 · warm wash #7D6961 · window #DBD3C6 |
| White line-art mode | lines #AEA9C0 (lavender-white) on #180E12 |
| Gold line-art mode | lines #DBCBA3 (core) with gold bloom on #151215 |

Rule of thumb: **one warm light source** (candle, sun, moon, glow) against **deep navy/purple/black-brown** shadows. Saturation is gentle and never neon.

## 4. Light
- Strong motivated warm key light from one side, plus a soft bloom around light sources (moon, candle flame, window).
- God rays / sunbeams as soft diagonal shafts at 10–25% opacity.
- Floating dust motes and bokeh discs (warm gold, 20–60 px, soft) in emotional close-ups.
- "Divine" moments push the whole frame toward gold, with bloom that almost blows out to white.

## 5. Backgrounds
- Much simpler than the characters: **flat vector-like shapes** with soft gradients. Examples: a city skyline as plain rectangles with dotted lit windows, a tree as one rounded canopy blob, a fence, a window frame. Very little texture.
- Backgrounds are often blurred (shallow depth of field) behind close-ups.
- "Ghost world" variant: backgrounds and extra people drawn as **thin lavender-white outlines** with a near-black fill (houses, fence, trees, people). Only the hero stays painted.
- This is good news for us: these backgrounds are easy to build in code.

## 6. Shot rhythm (scene detection + eye check)
- About 33 shots in 61 s. **Average shot 1.85 s, median about 1.9 s**, range 0.5–4.1 s.
- Longest holds (3–4 s): the quote card, the gold line-art face drawing itself, and the light-flood finale.
- Mix: about 55% close-ups (face, hands), 30% medium, 15% wide.
- Measured cut times (s): 1.9, 2.77, 3.7, 4.93, 6.5, 9.9, 10.8, 12.87, 14.8, 16.3, 18.1, 19.3, 20.4, 21.43, 22.07, 23.1, 25.3, 26.0, 27.03, 28.9, 32.97, 35.93, 38.73, 41.4, 43.0, 44.0, 46.1, 47.77, 49.1, 52.27, 54.6, 57.47.

## 7. Camera
- Slow push-ins on almost every shot. Measured: **0.3–3.3 % scale per second, typically about 1.5–2 %/s**, with a tiny upward drift.
- Over-the-shoulder with a soft out-of-focus foreground head (rack-focus feel).
- One fast push into an object (into the dark glasses), ending in black, used as a transition.
- Wides are almost static, with gentle bloom pulses.

## 8. How characters move
- Subtle "breathing" life: blinks (one blink about 0.15 s), small head tilts, eyes turning up, smile widening, hands moving on keys, hair strands swaying.
- Pose changes happen on a cut or a short crossfade (e.g. praying hands → open hands), not as full animation.
- Emotion is carried by the eyes and brows. Mouths stay mostly closed or softly open (no lip-sync).

## 9. Transitions
- Hard cuts (most of them), sometimes on the voice phrase.
- **Light-bloom flash**: the frame washes to warm white over about 6–10 frames, then cuts or reveals the next shot (3.5 s, 18.5 s, 38.5 s, 43 s, 49 s).
- Painted → **glowing line art**: a crossfade over about 15 frames. The fill fades to dark, and the lines brighten and glow.
- Desaturate-to-grey before a light reveal (37.5 s).
- Push to black, and a dip to black for one beat (28.5 s, 54.5 s).
- A dark wisp in the hands turns into gold sparkles that rise (the "giving it to God" moment).

## 10. Line-art effect (signature)
- White mode: thin lavender-white lines (#AEA9C0) with a soft 2–4 px glow on near-black (#180E12). Lines follow the original drawing's contours (an edge-detected look), including hair strands and cloth folds.
- Gold mode: cream-gold core (#DBCBA3), warm bloom (#E2B25A) and tiny star sparkles drifting around. It "draws itself" (lines appear progressively over about 2–3 s, from the face outward).
- Ghost people: the same white-outline look with a dark fill at about 85% opacity. They stand still or shift slightly.

## 11. Text
| Element | Font look | Size @1080 | Position @1920 | Color |
|---|---|---|---|---|
| Top hook | Garamond-style serif (Cormorant Garamond Medium) | about 64 px, line pitch about 84 px | 2 lines centered, y ≈ 255–405 | cream #F3ECDF / #FEFEF9, ONE gold word #DBC37F to #E2B25A |
| Lower caption | Montserrat Medium | about 54 px (ascender-descender 52 px) | 1 line centered, y ≈ 1487 (center) | white, soft dark shadow |
| Quote card, "The Bible says," | Cormorant italic | about 46 px | y ≈ 405 | cream at 85% |
| Quote card, quote | Cormorant Medium | about 72–76 px, line pitch about 99 px | y ≈ 460–625 | cream #F9E7DF, gold keyword #EED596 |
| Quote card, reference | Cormorant caps, tracking about 0.2em, with ✦ dots on both sides | about 30 px | y ≈ 738 | muted #A088A0 (tinted by the bg) |
| Name tag | Cormorant SemiBold caps, tracking about 0.12em | about 80 px | y ≈ 280 | cream at 70% (#ADA697 over the bg) |
| Name subtitle | Cormorant, tracking about 0.2em | about 38 px | y ≈ 350 | cream at 60% |
| Big number counter | Cormorant SemiBold numerals + tiny caps label | numbers about 90 px | upper right third | cream |

- Captions change per phrase (2–5 words), synced to the voice. The hook stays about 3.5 s, then leaves with the first bloom.
- The quote card builds word by word, and the gold keyword arrives last, with a slight glow.
- Our spec differs on purpose: captions 48 px at y ≈ 1380 (Instagram safe zone) and quotes 64 px. Both are close enough to the reference.

## 12. Sound (reference)
- Integrated loudness −14.2 LUFS, LRA 3.4 LU: a steady, intimate mix.
- A continuous warm music bed (sustained string/pad chord around 300–800 Hz) with soft piano notes. A high sustained bell/choir tone appears at the "face of Jesus" moment.
- The voice is calm, close-mic'd and unhurried. It sits clearly on top, and the music never stops.

## 13. What to copy vs. avoid
- COPY: rim-glow characters, simple flat-gradient code backgrounds, a warm-vs-navy palette, about 2 s cuts with slow push-ins, light-bloom transitions, white/gold glowing line art, ghost-outline people, the serif hook with one gold word, the Montserrat captions and the quote-card layout.
- AVOID: their characters (the blind girl, mother, preacher, hoodie man), their scenes (piano, rocking chair, rooftop) and their wording. Our young man must look clearly different from their hoodie guy (curly black hair, light-grey sweatshirt, no hood).

## 14. Files made from this video (kept out of git)
- `frames_storybook/`: `ffmpeg -i storybook_style.mp4 -vf fps=2 -q:v 2 frames_storybook/f_%03d.jpg`
- `episodes/adam-silent/style_refs/` (crops above the caption band):
  - `style_ref_closeup.png`: t = 6.6 s, crop 720×935+0+0
  - `style_ref_medium.png`: t = 22.4 s, crop 720×935+0+0
  - `style_ref_wide.png`: t = 51.0 s, crop 720×500+0+515
  - `style_ref_lineart.png`: t = 8.3 s, crop 720×935+0+0
