# Flat style notes (from `reference/flat_style.mp4`)

Source: 720×1280, 30 fps, 79.5 s. Frames pulled at 2 fps into `frames_flat/` (159 frames).
All measurements below are converted to our 1080×1920 canvas (×1.5).

## What I measured

| Thing | Reference (measured) | STYLE LOCK said | We use |
|---|---|---|---|
| Ground line | y = 1180, 4–5 px, ink | y ≈ 1180 | y = 1180, 5.4 px |
| Character outline | ≈ 6 px, constant for big and small figures | ≈ 5 px | **6 px**, non-scaling |
| Caption cap height | 48 px (≈ 66 px font) | ≈ 50 px font | **66 px** Plus Jakarta Sans Bold |
| Caption line pitch | 81 px | — | 1.26 line-height (83 px) |
| Caption centre | 1-line: y 1415 · 2-line: 1377 / 1458 | 1300–1420 | **centre 1385** (keeps 2nd line inside the 1450 safe line) |
| Caption max line width | ≈ 735 px | — | 840 px box |
| Caption ink | #1C1C1B | #1C1B1F | #1C1B1F |
| Ghost words | ink at ≈ 20 % (on fog #E6E4E1 → #D8D7D0) | 25 % | ink 22 %, keyword colour 30 % |
| Red keyword | #AA4B3D | #B4432F | #B4432F |
| Gold keyword / labels | #BB9040 – #BE8E3A | #C8952E | #C8952E |
| Blue keyword | #30537E | #3D6494 | #3D6494 |
| Jesus outline | #BA8F3D (anti-aliased) | #C9A04A | #C29A45 |
| Blue robe | #98B1CC | #8FA8CF | #97AFCC |
| Rust robe | #AB7B57 | #B97A4A | #B47C52 |
| Blush robe | #E1C4BF | #E9C9C4 | #E6C7C2 |
| Beard face | #5C4636 – #685646 | dark brown | #5E4636 |
| Night sky | top #262A54 → #3B3D69 → #5B5D8B → horizon haze #8A899A | #2A284F → #6E6B9C | 4-stop gradient |
| Fog panel | tinted by the sky right under the line (#9C9FB3), white by y ≈ 1420 (#F5F3EF), slightly grey at the bottom (#E0DED9) | #F5F3EF → #EFEDE9 | same, with sky tint |
| Sea | #D6E2EB → #CFDAE3, wave lines #8FA6BA ≈ 4 px, rows ≈ 82 px apart, wavelength ≈ 150 px | #CFD9E0 | same |
| Moon | r ≈ 135 px, cream #F5EDD4, 4 craters #E7D8B2, very wide soft glow | — | same |

## Things the STYLE LOCK missed (now in the kit)

1. **Beard faces are long.** The dark face starts just below the middle of the head and the pointed beard reaches about 1.5 head-radii *below* the head, down onto the robe. The head circle keeps its outline; the face sits on top with a thin outline.
2. **Robes flare.** About 116 px wide at the shoulders and 156 px at the hem, with big round shoulders (r ≈ 30) and a flat hem. The belt is a thin, slightly smiling line about **66 %** of the way down.
3. **Arms at rest** are a single line that runs down just outside the robe edge, from the shoulder to about the belt. That gives the "double edge" look.
4. **Plain figures** have heads the same colour as their robe (blush head on a blush robe). Only the bearded figures show a face.
5. **Labels have two outlines:** a thin cream ring inside a dark outer stroke (for example PIECES OF SILVER, JUDAS, PETER, THE DIFFERENCE). Gold, red or blue fill.
6. **Speech bubbles** use the text colour for a thin edge, are rounded (r ≈ 22), and have a short straight tail. Number badges are small red discs with a cream ring and a cream serif digit.
7. **Fog takes on the scene light.** Fire and Jesus glows spill as big, soft orange ellipses onto the fog right under the line.
8. **Transitions** are 12–15 frame crossfades (about 0.4–0.5 s). New captions crossfade with the picture, and new pages start fully ghosted.
9. **Pacing:** a new picture every 2–4 s; inside a scene, small items (bubbles, badges, hearts) pop in every 1–2 s.
10. **Camera:** mostly locked with small push-ins. There is one fast zoom from a wide shot into a close-up in about 3 frames, so quick scale jumps are allowed.
11. **Grass ticks** are short (9–20 px), grey-green (#6B6F67), tilted a little, at about 75 % opacity.
12. **Stars** are sparse: about 30–35 dots of 1.5–3.5 px, gently twinkling.
13. **Dawn and shore skies** are cream-peach with a strong warm radial glow at the horizon. The fog and sea under them pick up the gold.
14. **Flashbacks** in the reference are a semi-transparent rust-red wash over the whole picture (about 35 %).

## Layout map (1080 × 1920)

```
  0 ┌──────────────────────────────┐
150 │ ✝ @GraceINMotion616 (55 %)   │  brand
260 │ FEAR ━━━━●━━━━━━━━━━━ LOVE   │  meter (track 560 px)
360 │        SCENE LABEL           │  labels + verse ref
    │                              │
    │      (sky, moon, props)      │
    │   figures stand on the line  │
1180├──────────────────────────────┤  ground line + grass ticks
    │   fog / sea / path panel     │
1385│      caption (≤ 2 lines)     │
1450│ - - - - safe line - - - - - -│
1920└──────────────────────────────┘
```

Keep everything important inside x ≤ 960 and y ≤ 1450.

## Kit

The reusable components are in `src/kit-flat/`, and every colour is in `palette.ts`.
The style test is at `episodes/fire-insurance/characters/style_test.png`, and the side-by-side check is `style_compare.png`.
