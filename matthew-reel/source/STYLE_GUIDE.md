# Style guide (from reference video study)

Reference: 720x1280, 30 fps, 67 s, -14.1 LUFS, TP -1.3 dBFS. All values below are scaled to 1080x1920 (x1.5).

## Layout
- Scene: y 0..1190 (62%). Ground line at y=1190, near-black #100904, 4.5 px, full width.
- Caption panel: y 1190..1920, off-white #F5F3EF centre, radial vignette to #E4E2DE at edges, #DAD8D4 in corners.
  Warm/God scenes: whole canvas cream (#F2EEDE / warm #F2E2C6) with radial vignette; panel tinted to match.
- Labels: Playfair Display Bold caps, gold #B8892B, tracking +3 px, soft cream halo (#F7EED8), ~46 px, centred at y~300.
  Old-style numerals (Playfair default) like the reference "1854" / "3:20".
- Name titles: Cinzel Black, gold fill, thick cream outline + thin dark edge (embossed), ~100 px, y~300.
- Watermark: "Grace in Motion" (user update: no @), 30 px, gold #B8892B @ 60%, tracking 2 px, centred, y=1265, every frame.
- Captions: Plus Jakarta Sans ExtraBold 58 px, centred, max 2 lines, max width 800 px, line centres y~1372 / 1458.
  Unspoken #CFCBC4 -> spoken #141414 exactly at the word timestamp (80 ms ease).
  Highlights: gold #B8892B, red #A8322A, green #2F6B4E. Short phrase "pages" (3-8 words) like the reference.

## Drawing
- Outline #100904, 5-6 px, round caps/joins. Flat soft fills, no gradients except glows/sky.
- Night sky #D8DBE6 (top) warming to #E0DBD8 near the horizon. Stars: tiny 4-point gold sparkles, twinkle.
- Moon: thin gold crescent stroke (#BD9640) with a big soft white-lavender radial glow.
- Walls #E8DFD2, stone #E6E2D6 with thin brick lines #D0CCC0, roof #DED4C2, dark wood #A07F53, light wood #C6A276.
- Soft glow #ECDCBC. Background objects (trees) use pale fills with light grey outlines.
- Jesus: gold outline #C08D28, warm yellow fill #F5D28F (lighter in the centre), round head, robe with belt line,
  gold cross on chest, gold stick legs and arms, soft radial aura.
- People: round head, rounded torso, light-blue #D1DFEC fill, black outline, line arms/legs. "Lost" people grey #C9C7C4.
- Magnifier: black outline, thick gold rim #C8962E, glass with white shine arc, brown handle #8A6638 with round end,
  real 2x zoom inside the lens.
- Red circle #A8322A ~9 px, round caps, draws on clockwise. Red X: two strokes drawn one after the other.
- Speech bubble: near-white rounded rect, black outline, little tail; Playfair Bold caps text.
- Quote icon: two gold quote marks over a soft cream glow circle.
- Bible icon: open book (white pages, black outline, grey lines) on a beige disc, gold rays, gold serif reference under.
- Gold frame: thin gold outer line, cream band, gold band, black inner line + thin gold line; corner roundels
  (gold ring, cream fill, gold dot), almond ornaments mid-sides; plate below with black Playfair caps.
- Spotlight: soft cream trapezoid beam from top centre.

## Motion / sound
- Reference voice ~2.9 words/s, phrase gaps 0.2-0.55 s, continuous soft music bed ~15-20 dB under voice.
- Crossfades 0.3-0.5 s; frame zoom-in transition; slow push-ins (1.00 -> 1.06) at reveals.
- Pops: easeOutBack with ~8% overshoot over 0.35 s. Magnifier glides with easeInOutCubic.
- Idle: breathing (+-1.2% y-scale, ~3 s), glow pulse, star twinkle, dust motes in light beams.
- Improve on the reference: never let light beams/props overlap captions; better line breaks; sharper 1080p.
