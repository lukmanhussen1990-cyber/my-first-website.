# Reference video – observation list

Source: 15.0 s screen recording, 1320×2868 @ ~59 fps (iPhone, 440×956 CSS px @3x), AAC stereo.
All CSS numbers below are for the 440 px reference width (1 CSS px = 3 video px).

## Layout (measured)
- Page background #181818. Top bar icons at ~9 % of height (y≈86–88 px).
  - Back arrow 15×15 px, thin 1 px stroke, #b3b3aa, centered x≈48.
  - Counter "0 / 3 000" right edge x≈368, thin mono digits ≈9 px tall, #d4d4d4.
  - Share icon (open box + up arrow) 16×17 px, #b0b2a7, centered x≈400.
- Paper top at 19.35 % of height, full width, top corners = ellipse rx≈53 px (12 % W), ry≈160 px.
  - Light: cream #eae5d9 with small dark specks, dust, faint fibres.
  - Lamp: #30302d … #343431, slightly darker toward the edges.
- Text grid: cell 13.1 px (2.98 % W), Courier-Prime-like glyphs ≈21.8 px; line pitch 23.3 px.
  - Column 0 starts at x≈88.8 px (20.2 %), 19 columns per line.
  - Typing baseline fixed at 38.5 % H (56.5 px above rail centre); older lines scroll up.
  - Hint "Need a first line?" centred, ≈54 % of body size, dark ink, at 30 % H.
  - Placeholder "Begin here." on the typing line, mid grey (#6b6357 measured).
- Rail centre 44.4 % H, 21–22 px thick. Light profile: dark top edge #272e2c, highlight #a0a6a9 at ~35 %,
  #52585b mid, #171619 bottom; soft shadow ~15 px under it. Lamp: #1a1a1a…#282828.
- Collars #313633, 16 px wide, ~28 px tall, at x≈4–20 and x≈420–436.
- Capsule 91.7×43.3 px centred on the T stem; pill with large corner radius.
  - Light: sage #869476 top → #7e8a6f → #6c755a → #575c47; lamp: #363628 → #2e3021 → #202117.
  - LEDs at −37, −25, −13 px from centre, r≈3.2 px with thin light bezels.
    LED1 green #63e346 idle / orange while typing; LED2 dark red (light) / orange #f58525 (lamp); LED3 black.
  - Stitched patch on right half: seams at +9.7 px and +37.7 px (vertical) and +11.3 px (horizontal), brown cross stitches.
  - Two silver screw bolts at +25.5 px: one up out of the top, one down out of the bottom.
  - Top slot (22×3 px notch); lamp mode: glowing bar #eed396.
  - T: stem 4.2 px (silver in light mode, black in lamp mode), bar 20.7×6 px black roller; bar 22 px above capsule.
- Dimmer dial centre (396, 574) = 60 % H: 18 px disc + diagonal line + 8 rounded rays.
  Light #202012 disc with light line; lamp #b0b19e disc with dark line.
- Slider row (lamp only) labels baseline 59.2 % H, tracks 61.5 % H; groups x 20–115, 140–232, 257–348.
  Labels Courier ≈10.5 px #b4b4b1: LIGHT/Low, SPREAD/144°, REACH/210%. 9 ticks (ends + middle taller). Thumb 8×16 px #d2d2cd.
  Video values: LIGHT far left, SPREAD at ~71 % of travel, REACH far right.

## Motion / timing (measured from 60 fps frames)
- Key strike: T bar rises 18 px in ~50 ms, holds ~30 ms, falls in ~70 ms (tiny overshoot), THEN capsule slides
  one cell (13.1 px) right in ~90–100 ms ease-out. Letter appears at the top of the strike.
  A new key during the slide snaps the carriage to its target and starts a new strike.
- Spark per key: 3–4 frames (50–70 ms): patch flashes silver-white + jagged white/violet bolt between the bolts.
- At column 18 the carriage stops (margin); the next letter wraps the word: text block scrolls up one line
  in ~250 ms ease-out, the word moves down, carriage returns left in ~250 ms ease-out (fast start),
  T retracts into the slot then rises back over ~300 ms. Big zap: ~170 ms green glow + bolt, then white flash ~150 ms.
- Random big zaps with green glow also on some normal keys (#14 and #32 of 32).
- Idle (from ~2.4 s after last key): green glow + zap every ~0.63 s at the end of the clip.
- LED1 back to green ~0.5–0.8 s after the last key.
- Lamp on (tap at ~0.95 s): capsule turns dark olive + LED2 orange immediately; paper fades cream→dark ~0.35 s
  (hint fades, webs turn white, sliders fade in, stem darkens); slot glow ramps ~0.15 s; light grows from a spot
  into the full fan with a flicker over ~0.3 s. T height unchanged (measured).
- Light fan: apex at the slot, elliptical falloff (horizontal radius ≈1.86× vertical), clipped to a ~144° fan with
  soft edges (~18–25° above horizontal). Vertical reach ≈193 px. Colours: #e6d3b0 core → #d2bea4 → #91826e →
  #686055 → #4b473f → paper. Shape is fixed relative to the capsule (moves with it).
- Webs: bundles of 8–10 near-parallel hairline strands (white ~60 % in lamp mode, faint grey in light mode):
  collar fans, a coil wrapped on the rail, ribbons with twists and ties, ribbons sagging under the rail on the right,
  single hanging threads with tiny dots. They drag/stretch when the carriage moves, then sway.
- Steam: faint white streaky wisp rising ~40 px from the top bolt in lamp mode.

## Sound (spectral analysis)
- Music loop ≈113.9 BPM (beat 0.527 s), soft kick on every beat (strong 40–150 Hz pulses).
- Minor-key / C-major colour with chromatic G♯ (E7 → Am feel), plucky chord stabs, wobbly vibrato lead
  (theremin-like, E5/G5/A5 region), occasional bell partials (long straight lines at ~2.5 kHz / 5–6 kHz).
- Typewriter clicks / sparks are short broadband transients mixed under the music.
