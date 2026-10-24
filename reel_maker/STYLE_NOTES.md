# STYLE NOTES — reference.mp4 study

Source: `reference.mp4` (720x1280, 30 fps, 58.7 s, AAC 48 kHz). Measured from
`ref_frames/` (1 frame / 1.5 s, contact sheets `contact_sheet_0*.jpg`), 10 fps
motion strips (`ref_frames/motion/`), pixel sampling, and a whisper word-level
transcript (`ref_analysis/reference_transcript.json`). All sizes below are
converted to the 1080x1920 output (x1.5).

## Background
- Near-black with a soft radial glow, not a flat color: centre of glow at
  (50% W, ~38% H) is `#17161b` (very slightly cool), mid-frame ~`#0b0b0b`,
  corners and everything below the captions `#030303`.
- No texture or grain. The glow sits behind the characters, so the stage reads
  as a spotlight.

## Ground line
- One thin warm-white line at **~58% height** (y≈1120 px), spanning ~7%→93% of
  the width. Slight hand wobble, ~4.5 px thick. It dims to grey when a scene
  de-emphasises the "world" (e.g. the checklist scene removes it entirely).
- *Refinement of your note:* it is at 58%, not 62%.

## Line work
- Warm off-white ink `#efecea`, uniform width ~**6 px** for characters
  (~4.5 px for ground/props), round caps and joins.
- Hand-drawn wobble: low-frequency, ~1–2 px deviation; circles do not close
  perfectly — the stroke overshoots ~20° and leaves a small tail where it ends.
- **Boiling lines**: every ~3–4 frames (≈8 Hz) all strokes re-jitter by ~1 px
  (frame-diff spikes every 3–4 frames on otherwise still poses). Between boils,
  poses still drift smoothly (breathing/sway) — 99% of frame steps show motion;
  the longest fully static stretch is 0.2 s.

## Stickmen
- Height ≈ 22% of frame (~420 px): head Ø ~96 px (radius ~48), torso ~165 px,
  legs ~160 px. Arms ≈ torso length, attached at the neck point, hanging in a
  slight outward bow; legs are two straight-ish lines from one hip point.
- Head interior is **filled near-black** (it hides lines behind it).
- Faces are tiny and centred low in the head: dot eyes (or closed "◡" arcs
  when content), small arc mouth; emotion is carried by eyebrows (worried "/ \",
  angry "\ /") and mouth shape (wavy when stressed). A small blue sweat drop
  `#6f9fd8` appears beside the head when stressed.
- Women: same body, plus 2–3 long hair strokes falling from the crown past the
  chin on both sides, flaring slightly outward.
- Hypothetical/"ghost" figures are drawn with grey dashed strokes.

## Typography
- **Kalam Bold** is an exact match for all text (checked side by side in
  `ref_analysis/font_compare.png`). Patrick Hand is noticeably different.
- Captions: one line, centred at **~70% height** (y≈1344), large: ~88 px
  (auto-shrinks for long chunks), 2–5 words per chunk, ~1.1 s per chunk.
- Labels: Kalam Bold; emphatic labels in CAPS inside a thin outlined box
  (red `#a8344f` "COMPLETELY WRONG", gold `#d9c55a` "SURPRISING"), soft labels
  in lowercase without box (pink "chasing", gold "intentional", grey "chase?").
  Small item labels (~36 px) sit in dark boxes with thin grey outline.
- The reference puts top labels at ~12% height, which is inside Instagram's
  top UI zone — this build moves them to ~16–17%.

## Caption behaviour (karaoke)
- Chunk fades in quickly (~0.1 s) with **all words dim grey `#4b4b4a`**; each
  word turns warm white `#f3ecdd` as it is spoken.
- *Refinement of your note:* in the reference the **yellow + underline follows
  the word currently being spoken** (it moves word by word, and the last word
  of a chunk stays yellow until the chunk changes). You asked for one key word
  per chunk in yellow — that is the default here (`CAPTION_HIGHLIGHT =
  "keyword"`); set `CAPTION_HIGHLIGHT = "active"` for the reference behaviour.
- Yellow `#ecd462`, underline ~5 px, slightly bowed, full word width, sits at
  descender depth, draws on left→right.

## Colour (accents only carry meaning)
| role | reference (measured) | your spec | used |
|---|---|---|---|
| keyword / labels | `#e8db60` / `#ccc05b` | `#f2c94c` | `#ecd462` |
| hearts / affection | `#e993c2` pink, `#e03a57` red heart | `#ff6b9a` | `#f27aa6` |
| good / full | `#75ae6e` battery, `#99cc94` tick | `#4cd964` | `#6fcf6a` |
| bad / empty | `#972e46` label, dark red battery | `#ff3b30` | `#e0464f` |
The reference accents are slightly muted/pastel — the used values sit between
the two so they read on a phone but don't look neon.

## Props
- Same line style as characters, often with **dark fills** (`#111`) so they
  read as objects: battery (outlined, 4 segments, green → dark red), tall meter
  bar (white outline, coloured fill rising), magnifying glass (grey rim, dark
  glass, tan handle), checklist boxes with green ticks, outlined label boxes,
  hearts (filled, thin white outline, sometimes with yellow sparkle rays),
  dotted/dashed eye-lines, U-shaped container, scale, iceberg.

## Motion
- Props and label boxes **pop**: scale ~0.3 → 1.0 in 0.15–0.25 s with a small
  overshoot (ease-out-back); text labels fade + slide up.
- Characters walk with a smooth leg cycle, hearts drift upward, eye-lines draw
  on, meters fill smoothly; dimmed elements fade to ~40% grey instead of
  vanishing when they stop being the subject.
- Scene changes are short crossfades (~0.2–0.3 s), timed to sentence starts.

## Pacing (whisper, word timestamps)
- 146 words in 56.9 s of speech → **2.56 words/s (154 wpm)**, calm male narrator.
- Sentence pauses 0.30–0.48 s (median gap at sentence ends ≈ 0.37 s), longest
  pause **0.78 s after the hook**; commas get ~0.3 s.
- Sentences average 3.7 s / 10 words; major visual layout changes every
  ~4.4 s (median), i.e. roughly one new picture per sentence, with smaller
  beats (label pops, prop changes) every ~1–1.5 s.

## Audio
- Integrated loudness −17.1 LUFS, peak −0.6 dBFS.
- Soft tonal pad/piano under the voice (energy peaks at ~196 Hz and 261 Hz,
  G3/C4), ~19 dB below speech RMS. This build follows your spec (−24 dB under
  the voice), with very quiet pops/whooshes on prop appearances.

## Addendum — "The Spotlight Effect" (re-study, same reference)
Re-extracted `ref_frames/` (1 frame / 1.5 s, 3 contact sheets) and re-checked
the transcript; pacing numbers above still apply (2.56 words/s, 0.3–0.5 s
sentence pauses, one new picture per sentence). Crops in
`ref_analysis/spotlight_study.png`. Details that matter for this video:
- **Crowds**: same-size figures spaced evenly along the ground (≈18% / 50% /
  82% of the width for three), all on one ground line — no perspective. Each
  can carry its own text box above the head: dark fill, thin light-grey
  outline (~3 px), small white Kalam text (~36 px).
- **Eye-lines**: thin dashed pale-yellow lines (~3 px, dash ≈ gap ≈ 9 px)
  from the eyes to the target; several lines converging read as "everyone is
  looking". The looked-at person gets a soft yellow glow — the reference's own
  version of a spotlight.
- **Thoughts / questions**: dark boxes with a thin coloured outline (yellow or
  pink) and white text; grey "?" marks of mixed sizes around a head.
- Spotlight beams, speech/thought bubbles, shirt and doorway are not in the
  reference, so they are drawn in the same rules: thin warm-white line work,
  dark fills, one accent colour each (yellow = attention/light).
