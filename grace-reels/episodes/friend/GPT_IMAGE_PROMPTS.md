# Friend: GPT Image prompts

Idea 44, one-time GPT Image episode. **29 images: 18 MUST-HAVE, 11 NICE-TO-HAVE.**
Make the MUST images first, **in this order**. Later prompts attach earlier images as references.
Every NICE image has a code fallback, so skipping one is fine. If time runs short, **#1–#8 matter most**
(Jesus, Judas, the kiss close-up, their poses, the washing kit and the coins); I can build the rest in
code, as in "They Never Died".

## How to make them in ChatGPT

1. Download the 3 style references from `style_refs/`: `style_ref_1.png` (character close-up),
   `style_ref_2.png` (wide scene) and `style_ref_3.png` (group of people).
2. **Make #1, `char_jesus_turnaround.png`, first.** Re-roll until it is right: dark brown outline, one
   almond eye, no mouth, mitten hands, an off-white robe with a blue-grey sash, a sand outer robe, no
   halo and no text. **This is the style anchor: attach it to every image after it**, as the "Attach"
   lists below show.
3. For each image: open a chat, attach the files in **Attach**, paste the prompt from its box, and send.
   If it is close but not right, fix it in the same chat (for example "same image, but the beard is
   shorter").
4. Save each result as a full-size PNG (download it, don't screenshot it) and **rename it to the exact
   file name** shown.
5. Re-roll any image that has text, letters, a frame, a border, a mouth (except where a prompt allows a
   smile), extra fingers, a halo or a glow.

Tips: use one ChatGPT chat per character (Jesus, Judas, the disciples) so they stay consistent. Use a new
chat for each background scene. Characters and props are drawn in plain, even light on purpose: I add
the candlelight, torchlight and moonlight in animation.

## If transparency fails

ChatGPT sometimes paints a fake checkerboard, or a white or grey background, instead of real
transparency. Then send the same prompt again, but **replace the whole BACKGROUND line** with:

```text
BACKGROUND: plain solid flat magenta (#FF00FF) filling all empty areas, no shadow on the background, no gradient, no ground.
```

I remove the magenta in code.

## Where to put them

Put every finished image in **`grace-reels/episodes/friend/assets/gpt/`** with the exact file name.

- **Easiest:** on GitHub, open the branch `ccr-a41eecd7-s7gufw`, go to that folder, choose
  **Add file → Upload files**, drop the PNGs in, and commit to the same branch.
- **Or:** attach them in our chat and say which number each one is.

Then type **DONE**.

## STYLE BLOCK (starts every prompt)

> Flat 2D paper-cut illustration for a cinematic 2.5D animated Bible story. Characters and props: simple bold shapes with a clean, even, dark brown outline (#2B1D12) and rounded joins; matte flat colors with exactly one soft shadow tone per color (far-side arm and leg one shade darker); no gradients on characters, no texture, no noise, no 3D rendering, no realism. Minimal faces: one almond-shaped eye (white with a round dark pupil), a small rounded nose bump on the profile, usually no mouth; hair and beards are flat shapes. Bodies about 5.5 heads tall, tube-like arms ending in rounded mitten hands (no separate fingers), simple rounded feet, robes as clean A-line shapes. Scenery: a warm low-poly diorama look, with walls, hills, rocks and trees built from large flat-shaded triangular facets, no outlines, soft haze and cinematic lighting. Warm biblical palette: sand #D9B27C, ochre #C98A4B, terracotta #B4643C, olive #8A8F45, sage #A3A36E, dusty blue #6F8FA0, cream #F3ECDF, deep brown #2B1D12, and deep night blues #1B2440 and #32456B for night scenes. High detail but clean and readable, crisp edges. No text, no letters, no numbers, no watermark, no signature, no logo, no frame, no border.

## CHARACTER BIBLE (repeated word for word in every prompt for that character)

- JESUS: a calm, kind man of about thirty with warm brown skin (#A8693F); shoulder-length dark-brown hair (#3B271A) tucked behind his ear; a short, neat dark-brown beard; one almond eye with a dark pupil and a soft, gentle look, a small rounded nose, no mouth. He wears a long off-white robe (#EFE8D8) that reaches his ankles, tied with a soft blue-grey sash (#7E8FA0), and over it a light sand-colored outer robe (mantle, #CDB892) that hangs from his shoulders to his knees; simple brown sandals (#6B4A2E). Slim build, calm upright posture, about 5.5 heads tall. No halo, no glow, no crown, no realistic face.
- JUDAS: a younger man of about thirty with olive-brown skin (#9A6440); short, tightly curly black-brown hair (#2A1E17); a short, thin beard along his jaw; one almond eye with a dark pupil and a tense, narrow look, a small rounded nose, no mouth. He wears a long deep red-brown robe (#7A3324) that reaches his ankles, a dark leather belt (#3B2618) with a small leather coin pouch (#8A5A32) tied at his hip, and simple dark-brown sandals. Lean build, shoulders slightly raised and tense, about 5.5 heads tall.
- PETER: a stocky, strong fisherman in his forties with tan skin (#996240); short dark hair and a full, short beard, both streaked with grey (#4A443E with #8F8A84 streaks); one almond eye with a dark pupil, a small rounded nose, no mouth; a plain brown robe (#7A5233) with a tan rope belt. Broad shoulders, about 5.5 heads tall.
- JOHN: the youngest disciple, about eighteen, with no beard; light-brown skin (#B98457); short, wavy black hair (#1F1A17); one almond eye with a dark pupil and soft, gentle eyes, a small rounded nose, no mouth; a light-blue robe (#8FB0C8) with a cream belt. Slim build, about 5.5 heads tall.
- THE CROWD: ordinary men in simple, plain robes of muted dusty colors (grey-brown, dark olive, faded blue-grey, dull rust), some with a plain head cloth; no uniforms, no armor, no helmets, no badges, no emblems and no symbols of any group. They carry wooden torches, plain short swords and wooden staves.
- THE HAND: a generic adult hand and forearm in a plain grey-brown sleeve, warm brown skin, one plain gold ring, drawn as a rounded mitten hand in the same style; no face and no body.
- FEAST GUESTS: everyday people in colorful simple clothes (saffron, teal, rose, lime green, indigo, coral), men and women of different ages and skin tones, relaxed and happy; a small, simple curved smile line is allowed for them.

## All images at a glance

| # | File | Size | Transparent | Priority | Attach | Used in |
|---|---|---|---|---|---|---|
| 1 | `char_jesus_turnaround.png` | 1536×1024 | yes | MUST | style_ref_1.png, style_ref_3.png | design master and style anchor for every image; S1–S16 |
| 2 | `char_judas_turnaround.png` | 1536×1024 | yes | MUST | char_jesus_turnaround.png, style_ref_1.png | design master for Judas; S2, S4–S10 |
| 3 | `key_kiss_closeup.png` | 1536×1024 | yes | MUST | char_jesus_turnaround.png, char_judas_turnaround.png | S1 hook, S10 the kiss, S11 FRIEND close-up (the most important image) |
| 4 | `char_jesus_poses_a.png` | 1024×1536 | yes | MUST | char_jesus_turnaround.png, style_ref_1.png | S2 at the table, S3 the towel and the water |
| 5 | `char_jesus_poses_b.png` | 1024×1536 | yes | MUST | char_jesus_turnaround.png, char_jesus_poses_a.png | S3–S5 washing feet, S5 looking up at Judas, S10 the kiss, S14 the feast |
| 6 | `char_judas_poses.png` | 1024×1536 | yes | MUST | char_judas_turnaround.png, char_jesus_turnaround.png | S2 at the table, S5 stiff and looking away, S6 the open palm, S9 walking, S10 the kiss |
| 7 | `prop_washing_kit.png` | 1536×1024 | yes | MUST | char_jesus_turnaround.png, style_ref_1.png | S3 pouring, S4–S5 washing, S12 split screen, S15 call to action |
| 8 | `prop_coins.png` | 1536×1024 | yes | MUST | char_judas_turnaround.png, char_jesus_turnaround.png | S5 the pouch glints, S6 counting, S7 the stack, S8 the spinning coin |
| 9 | `bg_garden_sky.png` | 1024×1536 | no | MUST | style_ref_2.png | S1, S9–S13 night sky with the big moon |
| 10 | `bg_garden_mid.png` | 1536×1024 | yes (around the scenery) | MUST | bg_garden_sky.png, style_ref_2.png | S1, S9–S13 the olive grove (the camera pans across it) |
| 11 | `bg_room_back.png` | 1536×1024 | no | MUST | style_ref_2.png, char_jesus_turnaround.png | S2 landing, S3–S5 the upper room (the camera dollies along it), S12 left half |
| 12 | `prop_table_set.png` | 1536×1024 | yes | MUST | bg_room_back.png, char_jesus_turnaround.png | S2 the 13 at supper, S4 the dolly along the table, S8 the coin on the table, S14 the feast |
| 13 | `char_disciples_seated.png` | 1536×1024 | yes | MUST | char_jesus_turnaround.png, style_ref_3.png | S2 at the table, S4 Jesus kneels at each one's feet |
| 14 | `char_peter_john_poses.png` | 1536×1024 | yes | MUST | char_jesus_turnaround.png, char_disciples_seated.png | S4 Peter surprised, John moved |
| 15 | `char_crowd_torches.png` | 1536×1024 | yes | MUST | char_judas_turnaround.png, style_ref_3.png | S1 out of focus behind the kiss, S9 the torch line, S12 right half |
| 16 | `char_jesus_parts.png` | 1536×1024 | yes | MUST | char_jesus_turnaround.png, style_ref_1.png | bone rig: breathing, head turns, arm moves, the robe laid aside |
| 17 | `char_judas_parts.png` | 1536×1024 | yes | MUST | char_judas_turnaround.png, char_jesus_parts.png | bone rig: walking (S9), flinch (S5), the lean before the kiss (S10) |
| 18 | `prop_scale_chain.png` | 1536×1024 | yes | MUST | prop_coins.png, char_jesus_turnaround.png | S7 the balance scale: 30 coins against the price of a slave |
| 19 | `bg_garden_far.png` | 1536×1024 | yes (around the scenery) | NICE | bg_garden_sky.png, bg_garden_mid.png | S9 depth behind the grove (code hills if skipped) |
| 20 | `bg_garden_near.png` | 1536×1024 | yes (around the scenery) | NICE | bg_garden_mid.png | S1, S9 foreground parallax (blurred in code) |
| 21 | `bg_room_near.png` | 1536×1024 | yes | NICE | bg_room_back.png | S2–S5 foreground parallax in the upper room |
| 22 | `bg_dealroom.png` | 1024×1536 | no | NICE | bg_room_back.png, prop_coins.png | S6 the flashback deal (dark code room if skipped) |
| 23 | `prop_hands_coins.png` | 1536×1024 | yes | NICE | prop_coins.png, char_judas_turnaround.png | S6 coins counted into Judas's palm (Judas's pose sheet if skipped) |
| 24 | `char_feast_guests.png` | 1536×1024 | yes | NICE | char_jesus_turnaround.png, style_ref_3.png | S14 the feast with publicans and sinners (code silhouettes if skipped) |
| 25 | `bg_feast_back.png` | 1024×1536 | no | NICE | style_ref_2.png, char_jesus_turnaround.png | S14 the bright feast courtyard (code courtyard if skipped) |
| 26 | `bg_feast_near.png` | 1536×1024 | yes | NICE | bg_feast_back.png | S14 foreground parallax |
| 27 | `prop_lamps.png` | 1536×1024 | yes | NICE | bg_room_back.png | S2–S5 lamps close to the lens, S15 call to action (flames added in code) |
| 28 | `prop_torches_weapons.png` | 1536×1024 | yes | NICE | char_crowd_torches.png | S9 torches and weapons passing close to the lens |
| 29 | `prop_olive_branches.png` | 1536×1024 | yes | NICE | bg_garden_mid.png | S1, S9, S13 branches passing close to the lens |

Made in code, so no image is needed: water, flames and embers, the rewind swirl, light and dust, the
coin spin and counter, the 12-dot tracker, the end card, the YES/NO icons and every word on screen.

## MUST-HAVE prompts (make these first, in order)

### 1. `char_jesus_turnaround.png`

- **Size:** 1536×1024 (landscape 3:2)
- **Transparent:** yes
- **Priority:** MUST-HAVE
- **Attach:** style_ref_1.png, style_ref_3.png
- **Used in:** design master and style anchor for every image; S1–S16

```text
Flat 2D paper-cut illustration for a cinematic 2.5D animated Bible story. Characters and props: simple bold shapes with a clean, even, dark brown outline (#2B1D12) and rounded joins; matte flat colors with exactly one soft shadow tone per color (far-side arm and leg one shade darker); no gradients on characters, no texture, no noise, no 3D rendering, no realism. Minimal faces: one almond-shaped eye (white with a round dark pupil), a small rounded nose bump on the profile, usually no mouth; hair and beards are flat shapes. Bodies about 5.5 heads tall, tube-like arms ending in rounded mitten hands (no separate fingers), simple rounded feet, robes as clean A-line shapes. Scenery: a warm low-poly diorama look, with walls, hills, rocks and trees built from large flat-shaded triangular facets, no outlines, soft haze and cinematic lighting. Warm biblical palette: sand #D9B27C, ochre #C98A4B, terracotta #B4643C, olive #8A8F45, sage #A3A36E, dusty blue #6F8FA0, cream #F3ECDF, deep brown #2B1D12, and deep night blues #1B2440 and #32456B for night scenes. High detail but clean and readable, crisp edges. No text, no letters, no numbers, no watermark, no signature, no logo, no frame, no border.

ATTACHED: 2 style reference screenshots. Copy only their drawing style (outline, flat colors, minimal faces, proportions), never their people, animals, trees or scene.

JESUS: a calm, kind man of about thirty with warm brown skin (#A8693F); shoulder-length dark-brown hair (#3B271A) tucked behind his ear; a short, neat dark-brown beard; one almond eye with a dark pupil and a soft, gentle look, a small rounded nose, no mouth. He wears a long off-white robe (#EFE8D8) that reaches his ankles, tied with a soft blue-grey sash (#7E8FA0), and over it a light sand-colored outer robe (mantle, #CDB892) that hangs from his shoulders to his knees; simple brown sandals (#6B4A2E). Slim build, calm upright posture, about 5.5 heads tall. No halo, no glow, no crown, no realistic face.

IMAGE: a character turnaround sheet of JESUS. Three full-body views of the same man in a relaxed, neutral standing pose, arranged left to right with wide empty space between them: (1) side view facing right, (2) three-quarter front view turned toward the right, (3) back view. All three are exactly the same height and scale, with the feet on one shared invisible ground line, and each figure fills about 90% of the image height. The arms hang slightly away from the body so the mitten hands are clearly separate from the clothes. The outer robe (mantle) is clearly visible in all three views. Calm, kind and humble.

LIGHT: soft, even, neutral light from the upper left, so the art can be re-lit later in animation; no colored light, no strong shadows, no glow, no rim light, no cast shadows.

BACKGROUND: fully transparent (PNG with a real alpha channel). Nothing behind the subject: no ground, no floor, no cast shadow, no scenery, no white or checkerboard pattern.

FORMAT: landscape 3:2 (1536×1024).

AVOID: text, letters, numbers, labels, arrows, guide lines, grid lines, frames, borders; extra fingers, extra arms or legs, mouths, realistic faces, halos, glows, cast shadows, gradients.
```

### 2. `char_judas_turnaround.png`

- **Size:** 1536×1024 (landscape 3:2)
- **Transparent:** yes
- **Priority:** MUST-HAVE
- **Attach:** char_jesus_turnaround.png, style_ref_1.png
- **Used in:** design master for Judas; S2, S4–S10

```text
Flat 2D paper-cut illustration for a cinematic 2.5D animated Bible story. Characters and props: simple bold shapes with a clean, even, dark brown outline (#2B1D12) and rounded joins; matte flat colors with exactly one soft shadow tone per color (far-side arm and leg one shade darker); no gradients on characters, no texture, no noise, no 3D rendering, no realism. Minimal faces: one almond-shaped eye (white with a round dark pupil), a small rounded nose bump on the profile, usually no mouth; hair and beards are flat shapes. Bodies about 5.5 heads tall, tube-like arms ending in rounded mitten hands (no separate fingers), simple rounded feet, robes as clean A-line shapes. Scenery: a warm low-poly diorama look, with walls, hills, rocks and trees built from large flat-shaded triangular facets, no outlines, soft haze and cinematic lighting. Warm biblical palette: sand #D9B27C, ochre #C98A4B, terracotta #B4643C, olive #8A8F45, sage #A3A36E, dusty blue #6F8FA0, cream #F3ECDF, deep brown #2B1D12, and deep night blues #1B2440 and #32456B for night scenes. High detail but clean and readable, crisp edges. No text, no letters, no numbers, no watermark, no signature, no logo, no frame, no border.

ATTACHED: our approved JESUS character sheet as a STYLE MATCH. Use the exact same drawing style, outline weight, proportions and level of detail, but draw JUDAS as described below, not Jesus. Also attached: 1 style reference screenshot. Copy only its drawing style, never its people or scene.

JUDAS: a younger man of about thirty with olive-brown skin (#9A6440); short, tightly curly black-brown hair (#2A1E17); a short, thin beard along his jaw; one almond eye with a dark pupil and a tense, narrow look, a small rounded nose, no mouth. He wears a long deep red-brown robe (#7A3324) that reaches his ankles, a dark leather belt (#3B2618) with a small leather coin pouch (#8A5A32) tied at his hip, and simple dark-brown sandals. Lean build, shoulders slightly raised and tense, about 5.5 heads tall.

IMAGE: a character turnaround sheet of JUDAS. Three full-body views of the same man in a relaxed, neutral standing pose, arranged left to right with wide empty space between them: (1) side view facing right, (2) three-quarter front view turned toward the right, (3) back view. All three are exactly the same height and scale, with the feet on one shared invisible ground line, and each figure fills about 90% of the image height. The arms hang slightly away from the body so the mitten hands are clearly separate from the clothes. The coin pouch at his hip is clearly visible in the side and three-quarter views.

LIGHT: soft, even, neutral light from the upper left, so the art can be re-lit later in animation; no colored light, no strong shadows, no glow, no rim light, no cast shadows.

BACKGROUND: fully transparent (PNG with a real alpha channel). Nothing behind the subject: no ground, no floor, no cast shadow, no scenery, no white or checkerboard pattern.

FORMAT: landscape 3:2 (1536×1024).

AVOID: text, letters, numbers, labels, arrows, guide lines, grid lines, frames, borders; extra fingers, extra arms or legs, mouths, realistic faces, halos, glows, cast shadows, gradients.
```

### 3. `key_kiss_closeup.png`

- **Size:** 1536×1024 (landscape 3:2)
- **Transparent:** yes
- **Priority:** MUST-HAVE
- **Attach:** char_jesus_turnaround.png, char_judas_turnaround.png
- **Used in:** S1 hook, S10 the kiss, S11 FRIEND close-up (the most important image)

```text
Flat 2D paper-cut illustration for a cinematic 2.5D animated Bible story. Characters and props: simple bold shapes with a clean, even, dark brown outline (#2B1D12) and rounded joins; matte flat colors with exactly one soft shadow tone per color (far-side arm and leg one shade darker); no gradients on characters, no texture, no noise, no 3D rendering, no realism. Minimal faces: one almond-shaped eye (white with a round dark pupil), a small rounded nose bump on the profile, usually no mouth; hair and beards are flat shapes. Bodies about 5.5 heads tall, tube-like arms ending in rounded mitten hands (no separate fingers), simple rounded feet, robes as clean A-line shapes. Scenery: a warm low-poly diorama look, with walls, hills, rocks and trees built from large flat-shaded triangular facets, no outlines, soft haze and cinematic lighting. Warm biblical palette: sand #D9B27C, ochre #C98A4B, terracotta #B4643C, olive #8A8F45, sage #A3A36E, dusty blue #6F8FA0, cream #F3ECDF, deep brown #2B1D12, and deep night blues #1B2440 and #32456B for night scenes. High detail but clean and readable, crisp edges. No text, no letters, no numbers, no watermark, no signature, no logo, no frame, no border.

ATTACHED: our approved JESUS and JUDAS character sheets. Keep both faces, hair, beards, clothes, colors and proportions exactly the same.

JESUS: a calm, kind man of about thirty with warm brown skin (#A8693F); shoulder-length dark-brown hair (#3B271A) tucked behind his ear; a short, neat dark-brown beard; one almond eye with a dark pupil and a soft, gentle look, a small rounded nose, no mouth. He wears a long off-white robe (#EFE8D8) that reaches his ankles, tied with a soft blue-grey sash (#7E8FA0), and over it a light sand-colored outer robe (mantle, #CDB892) that hangs from his shoulders to his knees; simple brown sandals (#6B4A2E). Slim build, calm upright posture, about 5.5 heads tall. No halo, no glow, no crown, no realistic face.

JUDAS: a younger man of about thirty with olive-brown skin (#9A6440); short, tightly curly black-brown hair (#2A1E17); a short, thin beard along his jaw; one almond eye with a dark pupil and a tense, narrow look, a small rounded nose, no mouth. He wears a long deep red-brown robe (#7A3324) that reaches his ankles, a dark leather belt (#3B2618) with a small leather coin pouch (#8A5A32) tied at his hip, and simple dark-brown sandals. Lean build, shoulders slightly raised and tense, about 5.5 heads tall.

IMAGE: two separate CLOSE-UP figures, each shown from the middle of the chest up to the top of the head, at a large scale, side by side with wide empty space between them so they can be cut apart (the two figures must not touch or overlap): LEFT: JUDAS in side profile facing right, leaning forward from the chest with his head tilted a little, his eye half closed, as he moves in to kiss someone on the cheek; his near hand is raised at the bottom edge as if to hold the other man's shoulder. RIGHT: JESUS in side profile facing left, standing still and upright, calm, his eye open with a gentle, sorrowful and loving look. Each figure fills about 85% of the image height. Simple, quiet and respectful.

LIGHT: soft, even, neutral light from the upper left, so the art can be re-lit later in animation; no colored light, no strong shadows, no glow, no rim light, no cast shadows.

BACKGROUND: fully transparent (PNG with a real alpha channel). Nothing behind the subject: no ground, no floor, no cast shadow, no scenery, no white or checkerboard pattern.

FORMAT: landscape 3:2 (1536×1024).

AVOID: text, letters, numbers, labels, arrows, guide lines, grid lines, frames, borders; extra fingers, extra arms or legs, mouths, realistic faces, halos, glows, cast shadows, gradients.
```

### 4. `char_jesus_poses_a.png`

- **Size:** 1024×1536 (portrait 2:3)
- **Transparent:** yes
- **Priority:** MUST-HAVE
- **Attach:** char_jesus_turnaround.png, style_ref_1.png
- **Used in:** S2 at the table, S3 the towel and the water

```text
Flat 2D paper-cut illustration for a cinematic 2.5D animated Bible story. Characters and props: simple bold shapes with a clean, even, dark brown outline (#2B1D12) and rounded joins; matte flat colors with exactly one soft shadow tone per color (far-side arm and leg one shade darker); no gradients on characters, no texture, no noise, no 3D rendering, no realism. Minimal faces: one almond-shaped eye (white with a round dark pupil), a small rounded nose bump on the profile, usually no mouth; hair and beards are flat shapes. Bodies about 5.5 heads tall, tube-like arms ending in rounded mitten hands (no separate fingers), simple rounded feet, robes as clean A-line shapes. Scenery: a warm low-poly diorama look, with walls, hills, rocks and trees built from large flat-shaded triangular facets, no outlines, soft haze and cinematic lighting. Warm biblical palette: sand #D9B27C, ochre #C98A4B, terracotta #B4643C, olive #8A8F45, sage #A3A36E, dusty blue #6F8FA0, cream #F3ECDF, deep brown #2B1D12, and deep night blues #1B2440 and #32456B for night scenes. High detail but clean and readable, crisp edges. No text, no letters, no numbers, no watermark, no signature, no logo, no frame, no border.

ATTACHED: our approved JESUS character sheet. Keep his face, hair, beard, clothes, colors and proportions exactly the same. Also attached: 1 style reference screenshot. Copy only its drawing style, never its people or scene.

JESUS: a calm, kind man of about thirty with warm brown skin (#A8693F); shoulder-length dark-brown hair (#3B271A) tucked behind his ear; a short, neat dark-brown beard; one almond eye with a dark pupil and a soft, gentle look, a small rounded nose, no mouth. He wears a long off-white robe (#EFE8D8) that reaches his ankles, tied with a soft blue-grey sash (#7E8FA0), and over it a light sand-colored outer robe (mantle, #CDB892) that hangs from his shoulders to his knees; simple brown sandals (#6B4A2E). Slim build, calm upright posture, about 5.5 heads tall. No halo, no glow, no crown, no realistic face.

IMAGE: a poses sheet of JESUS, matching the attached JESUS character sheet exactly. Four full-body poses of the same man, all in side view facing right and all at the same scale, arranged in 2 rows of 2 with clear empty space between them (no pose touches another): (1) standing calm and still, wearing the outer robe; (2) lifting the outer robe off his shoulders to lay it aside, the robe held out in both hands; (3) WITHOUT the outer robe, tying a long white linen towel around his waist, both hands at the knot, the towel ends hanging; (4) WITHOUT the outer robe, the towel tied at his waist, holding a clay water jug in both hands and tilting it forward to pour. Strong, clear silhouettes; the hands stay rounded mittens.

LIGHT: soft, even, neutral light from the upper left, so the art can be re-lit later in animation; no colored light, no strong shadows, no glow, no rim light, no cast shadows.

BACKGROUND: fully transparent (PNG with a real alpha channel). Nothing behind the subject: no ground, no floor, no cast shadow, no scenery, no white or checkerboard pattern.

FORMAT: portrait 2:3 (1024×1536).

AVOID: text, letters, numbers, labels, arrows, guide lines, grid lines, frames, borders; extra fingers, extra arms or legs, mouths, realistic faces, halos, glows, cast shadows, gradients.
```

### 5. `char_jesus_poses_b.png`

- **Size:** 1024×1536 (portrait 2:3)
- **Transparent:** yes
- **Priority:** MUST-HAVE
- **Attach:** char_jesus_turnaround.png, char_jesus_poses_a.png
- **Used in:** S3–S5 washing feet, S5 looking up at Judas, S10 the kiss, S14 the feast

```text
Flat 2D paper-cut illustration for a cinematic 2.5D animated Bible story. Characters and props: simple bold shapes with a clean, even, dark brown outline (#2B1D12) and rounded joins; matte flat colors with exactly one soft shadow tone per color (far-side arm and leg one shade darker); no gradients on characters, no texture, no noise, no 3D rendering, no realism. Minimal faces: one almond-shaped eye (white with a round dark pupil), a small rounded nose bump on the profile, usually no mouth; hair and beards are flat shapes. Bodies about 5.5 heads tall, tube-like arms ending in rounded mitten hands (no separate fingers), simple rounded feet, robes as clean A-line shapes. Scenery: a warm low-poly diorama look, with walls, hills, rocks and trees built from large flat-shaded triangular facets, no outlines, soft haze and cinematic lighting. Warm biblical palette: sand #D9B27C, ochre #C98A4B, terracotta #B4643C, olive #8A8F45, sage #A3A36E, dusty blue #6F8FA0, cream #F3ECDF, deep brown #2B1D12, and deep night blues #1B2440 and #32456B for night scenes. High detail but clean and readable, crisp edges. No text, no letters, no numbers, no watermark, no signature, no logo, no frame, no border.

ATTACHED: our approved JESUS character sheet. Keep his face, hair, beard, clothes, colors and proportions exactly the same. Also attached: our approved JESUS poses sheet (the first one). Match its scale and the towel exactly.

JESUS: a calm, kind man of about thirty with warm brown skin (#A8693F); shoulder-length dark-brown hair (#3B271A) tucked behind his ear; a short, neat dark-brown beard; one almond eye with a dark pupil and a soft, gentle look, a small rounded nose, no mouth. He wears a long off-white robe (#EFE8D8) that reaches his ankles, tied with a soft blue-grey sash (#7E8FA0), and over it a light sand-colored outer robe (mantle, #CDB892) that hangs from his shoulders to his knees; simple brown sandals (#6B4A2E). Slim build, calm upright posture, about 5.5 heads tall. No halo, no glow, no crown, no realistic face.

IMAGE: a second poses sheet of JESUS, matching the attached sheets exactly. Four full-body poses of the same man, all in side view facing right and all at the same scale, arranged in 2 rows of 2 with clear empty space between them (no pose touches another): (1) WITHOUT the outer robe, the white towel tied at his waist, kneeling on both knees and leaning forward, both hands low in front of him as if washing feet in a basin (no basin, no feet, no other person); (2) the same kneeling pose, but his head lifted, looking up with a kind, gentle eye at someone seated above him; (3) wearing the outer robe, standing still and upright with his head level and calm, as someone greets him with a kiss on the cheek (no other person drawn); (4) wearing the outer robe, sitting cross-legged on a floor cushion at a feast, leaning back a little and laughing with joy, his eye closed in a happy upward curve, one hand raised in a warm gesture; a small, simple curved smile line is allowed in this pose only.

LIGHT: soft, even, neutral light from the upper left, so the art can be re-lit later in animation; no colored light, no strong shadows, no glow, no rim light, no cast shadows.

BACKGROUND: fully transparent (PNG with a real alpha channel). Nothing behind the subject: no ground, no floor, no cast shadow, no scenery, no white or checkerboard pattern.

FORMAT: portrait 2:3 (1024×1536).

AVOID: text, letters, numbers, labels, arrows, guide lines, grid lines, frames, borders; extra fingers, extra arms or legs, mouths, realistic faces, halos, glows, cast shadows, gradients.
```

### 6. `char_judas_poses.png`

- **Size:** 1024×1536 (portrait 2:3)
- **Transparent:** yes
- **Priority:** MUST-HAVE
- **Attach:** char_judas_turnaround.png, char_jesus_turnaround.png
- **Used in:** S2 at the table, S5 stiff and looking away, S6 the open palm, S9 walking, S10 the kiss

```text
Flat 2D paper-cut illustration for a cinematic 2.5D animated Bible story. Characters and props: simple bold shapes with a clean, even, dark brown outline (#2B1D12) and rounded joins; matte flat colors with exactly one soft shadow tone per color (far-side arm and leg one shade darker); no gradients on characters, no texture, no noise, no 3D rendering, no realism. Minimal faces: one almond-shaped eye (white with a round dark pupil), a small rounded nose bump on the profile, usually no mouth; hair and beards are flat shapes. Bodies about 5.5 heads tall, tube-like arms ending in rounded mitten hands (no separate fingers), simple rounded feet, robes as clean A-line shapes. Scenery: a warm low-poly diorama look, with walls, hills, rocks and trees built from large flat-shaded triangular facets, no outlines, soft haze and cinematic lighting. Warm biblical palette: sand #D9B27C, ochre #C98A4B, terracotta #B4643C, olive #8A8F45, sage #A3A36E, dusty blue #6F8FA0, cream #F3ECDF, deep brown #2B1D12, and deep night blues #1B2440 and #32456B for night scenes. High detail but clean and readable, crisp edges. No text, no letters, no numbers, no watermark, no signature, no logo, no frame, no border.

ATTACHED: our approved JUDAS character sheet. Keep his face, hair, beard, clothes and coin pouch, colors and proportions exactly the same. Also attached: the approved JESUS character sheet as a STYLE MATCH only (same outline weight and level of detail). Do not draw Jesus.

JUDAS: a younger man of about thirty with olive-brown skin (#9A6440); short, tightly curly black-brown hair (#2A1E17); a short, thin beard along his jaw; one almond eye with a dark pupil and a tense, narrow look, a small rounded nose, no mouth. He wears a long deep red-brown robe (#7A3324) that reaches his ankles, a dark leather belt (#3B2618) with a small leather coin pouch (#8A5A32) tied at his hip, and simple dark-brown sandals. Lean build, shoulders slightly raised and tense, about 5.5 heads tall.

IMAGE: a poses sheet of JUDAS, matching the attached JUDAS character sheet exactly. Five full-body poses of the same man, all in side view facing right and all at the same scale, arranged in 2 rows (3 on top, 2 below) with clear empty space between them (no pose touches another): (1) sitting stiffly on a flat floor cushion, back rigid, hands gripping his knees, his bare feet flat on the floor in front of him and clearly visible (sandals off); (2) the same sitting pose, but his head turned away and down, avoiding someone's eyes, shoulders tight; (3) standing and holding one open palm out flat in front of him, as if to receive coins; (4) walking forward with a tense, hurried stride, mid-step; (5) standing and leaning forward from the waist, head forward and a little tilted, both hands raised to hold someone's shoulders, about to greet him with a kiss (no other person drawn). Strong, clear silhouettes; the hands stay rounded mittens.

LIGHT: soft, even, neutral light from the upper left, so the art can be re-lit later in animation; no colored light, no strong shadows, no glow, no rim light, no cast shadows.

BACKGROUND: fully transparent (PNG with a real alpha channel). Nothing behind the subject: no ground, no floor, no cast shadow, no scenery, no white or checkerboard pattern.

FORMAT: portrait 2:3 (1024×1536).

AVOID: text, letters, numbers, labels, arrows, guide lines, grid lines, frames, borders; extra fingers, extra arms or legs, mouths, realistic faces, halos, glows, cast shadows, gradients.
```

### 7. `prop_washing_kit.png`

- **Size:** 1536×1024 (landscape 3:2)
- **Transparent:** yes
- **Priority:** MUST-HAVE
- **Attach:** char_jesus_turnaround.png, style_ref_1.png
- **Used in:** S3 pouring, S4–S5 washing, S12 split screen, S15 call to action

```text
Flat 2D paper-cut illustration for a cinematic 2.5D animated Bible story. Characters and props: simple bold shapes with a clean, even, dark brown outline (#2B1D12) and rounded joins; matte flat colors with exactly one soft shadow tone per color (far-side arm and leg one shade darker); no gradients on characters, no texture, no noise, no 3D rendering, no realism. Minimal faces: one almond-shaped eye (white with a round dark pupil), a small rounded nose bump on the profile, usually no mouth; hair and beards are flat shapes. Bodies about 5.5 heads tall, tube-like arms ending in rounded mitten hands (no separate fingers), simple rounded feet, robes as clean A-line shapes. Scenery: a warm low-poly diorama look, with walls, hills, rocks and trees built from large flat-shaded triangular facets, no outlines, soft haze and cinematic lighting. Warm biblical palette: sand #D9B27C, ochre #C98A4B, terracotta #B4643C, olive #8A8F45, sage #A3A36E, dusty blue #6F8FA0, cream #F3ECDF, deep brown #2B1D12, and deep night blues #1B2440 and #32456B for night scenes. High detail but clean and readable, crisp edges. No text, no letters, no numbers, no watermark, no signature, no logo, no frame, no border.

ATTACHED: our approved JESUS character sheet as a STYLE MATCH. Use the exact same drawing style, outline weight, proportions and level of detail, but draw the props as described below, not Jesus. Also attached: 1 style reference screenshot. Copy only its drawing style.

IMAGE: a props sheet for the foot-washing, every item a separate flat paper-cut piece with wide empty space around it, all at a consistent scale: (1) a wide, shallow round clay basin (#B4643C with a darker rim) seen from the side at a slight high angle so its empty inside is visible; (2) the same basin seen straight from the side; (3) a tall clay water jug with one handle (#C98A4B), side view; (4) the same jug tilted forward as if pouring (no water drawn); (5) a long white linen towel (#F3ECDF, soft grey-beige shadows) hanging straight down; (6) the same towel folded in a neat stack. No water, no liquid, no people, no hands.

LIGHT: soft, even, neutral light from the upper left, so the art can be re-lit later in animation; no colored light, no strong shadows, no glow, no rim light, no cast shadows.

BACKGROUND: fully transparent (PNG with a real alpha channel). Nothing behind the subject: no ground, no floor, no cast shadow, no scenery, no white or checkerboard pattern.

FORMAT: landscape 3:2 (1536×1024).

AVOID: text, letters, numbers, inscriptions, faces or portraits on coins, people, hands, labels, frames, borders, cast shadows.
```

### 8. `prop_coins.png`

- **Size:** 1536×1024 (landscape 3:2)
- **Transparent:** yes
- **Priority:** MUST-HAVE
- **Attach:** char_judas_turnaround.png, char_jesus_turnaround.png
- **Used in:** S5 the pouch glints, S6 counting, S7 the stack, S8 the spinning coin

```text
Flat 2D paper-cut illustration for a cinematic 2.5D animated Bible story. Characters and props: simple bold shapes with a clean, even, dark brown outline (#2B1D12) and rounded joins; matte flat colors with exactly one soft shadow tone per color (far-side arm and leg one shade darker); no gradients on characters, no texture, no noise, no 3D rendering, no realism. Minimal faces: one almond-shaped eye (white with a round dark pupil), a small rounded nose bump on the profile, usually no mouth; hair and beards are flat shapes. Bodies about 5.5 heads tall, tube-like arms ending in rounded mitten hands (no separate fingers), simple rounded feet, robes as clean A-line shapes. Scenery: a warm low-poly diorama look, with walls, hills, rocks and trees built from large flat-shaded triangular facets, no outlines, soft haze and cinematic lighting. Warm biblical palette: sand #D9B27C, ochre #C98A4B, terracotta #B4643C, olive #8A8F45, sage #A3A36E, dusty blue #6F8FA0, cream #F3ECDF, deep brown #2B1D12, and deep night blues #1B2440 and #32456B for night scenes. High detail but clean and readable, crisp edges. No text, no letters, no numbers, no watermark, no signature, no logo, no frame, no border.

ATTACHED: our approved JUDAS character sheet (match his leather coin pouch exactly) and the approved JESUS sheet as a STYLE MATCH only. Do not draw any person.

IMAGE: a props sheet of silver coins and a pouch, every item a separate flat paper-cut piece with wide empty space around it: (1) one large silver coin seen face-on, a plain round coin with a simple raised rim and a plain simple pattern of dots (no face, no portrait, no letters), silver-grey (#B9BDC2) with one darker grey tone (#7F858C); (2) the same coin seen exactly edge-on, a thin silver bar; (3) the same coin tilted at a 45-degree angle; (4) a neat stack of about ten coins seen from the side; (5) a small heap of about thirty coins on a flat surface, seen from a slight high angle; (6) the leather coin pouch from Judas's belt (#8A5A32), closed with a drawstring; (7) the same pouch open with a few coins spilling out.

LIGHT: soft, even, neutral light from the upper left, so the art can be re-lit later in animation; no colored light, no strong shadows, no glow, no rim light, no cast shadows.

BACKGROUND: fully transparent (PNG with a real alpha channel). Nothing behind the subject: no ground, no floor, no cast shadow, no scenery, no white or checkerboard pattern.

FORMAT: landscape 3:2 (1536×1024).

AVOID: text, letters, numbers, inscriptions, faces or portraits on coins, people, hands, labels, frames, borders, cast shadows.
```

### 9. `bg_garden_sky.png`

- **Size:** 1024×1536 (portrait 2:3)
- **Transparent:** no
- **Priority:** MUST-HAVE
- **Attach:** style_ref_2.png
- **Used in:** S1, S9–S13 night sky with the big moon

```text
Flat 2D paper-cut illustration for a cinematic 2.5D animated Bible story. Characters and props: simple bold shapes with a clean, even, dark brown outline (#2B1D12) and rounded joins; matte flat colors with exactly one soft shadow tone per color (far-side arm and leg one shade darker); no gradients on characters, no texture, no noise, no 3D rendering, no realism. Minimal faces: one almond-shaped eye (white with a round dark pupil), a small rounded nose bump on the profile, usually no mouth; hair and beards are flat shapes. Bodies about 5.5 heads tall, tube-like arms ending in rounded mitten hands (no separate fingers), simple rounded feet, robes as clean A-line shapes. Scenery: a warm low-poly diorama look, with walls, hills, rocks and trees built from large flat-shaded triangular facets, no outlines, soft haze and cinematic lighting. Warm biblical palette: sand #D9B27C, ochre #C98A4B, terracotta #B4643C, olive #8A8F45, sage #A3A36E, dusty blue #6F8FA0, cream #F3ECDF, deep brown #2B1D12, and deep night blues #1B2440 and #32456B for night scenes. High detail but clean and readable, crisp edges. No text, no letters, no numbers, no watermark, no signature, no logo, no frame, no border.

ATTACHED: 1 style reference screenshot. Copy only its flat, low-poly look and soft haze, never its people, animals, trees or scene.

IMAGE: the SKY layer of a night olive garden, filling the whole image: a deep blue night sky (#1B2440 at the top fading to #32456B near the bottom), a big, bright, pale cream full moon (#F3ECDF) in the upper right third with a soft halo of light around it, a few small simple stars, and thin, soft low-poly clouds lit silver at their edges near the bottom. Calm, cinematic and quiet. Sky only.

LIGHT: night. Cool blue-silver moonlight from the upper right outlines the leaves, trunks and rocks; deep blue-violet shadows (#1E2236, #2B2440, never pure black); a faint warm orange glow low on the far left, as if from distant torches.

BACKGROUND: a complete, opaque picture that fills the whole image (no transparency).

FORMAT: portrait 2:3 (1024×1536).

AVOID: text, letters, numbers, ground, hills, trees, buildings, people, birds, frames, borders.
```

### 10. `bg_garden_mid.png`

- **Size:** 1536×1024 (landscape 3:2)
- **Transparent:** yes (around the scenery)
- **Priority:** MUST-HAVE
- **Attach:** bg_garden_sky.png, style_ref_2.png
- **Used in:** S1, S9–S13 the olive grove (the camera pans across it)

```text
Flat 2D paper-cut illustration for a cinematic 2.5D animated Bible story. Characters and props: simple bold shapes with a clean, even, dark brown outline (#2B1D12) and rounded joins; matte flat colors with exactly one soft shadow tone per color (far-side arm and leg one shade darker); no gradients on characters, no texture, no noise, no 3D rendering, no realism. Minimal faces: one almond-shaped eye (white with a round dark pupil), a small rounded nose bump on the profile, usually no mouth; hair and beards are flat shapes. Bodies about 5.5 heads tall, tube-like arms ending in rounded mitten hands (no separate fingers), simple rounded feet, robes as clean A-line shapes. Scenery: a warm low-poly diorama look, with walls, hills, rocks and trees built from large flat-shaded triangular facets, no outlines, soft haze and cinematic lighting. Warm biblical palette: sand #D9B27C, ochre #C98A4B, terracotta #B4643C, olive #8A8F45, sage #A3A36E, dusty blue #6F8FA0, cream #F3ECDF, deep brown #2B1D12, and deep night blues #1B2440 and #32456B for night scenes. High detail but clean and readable, crisp edges. No text, no letters, no numbers, no watermark, no signature, no logo, no frame, no border.

ATTACHED: the approved night sky of this same scene. Match its light, colors, haze and level of detail exactly. Also attached: 1 style reference screenshot. Copy only its faceted low-poly trees and level of detail.

IMAGE: the MIDDLE layer of a night olive garden, as a wide strip for a slow camera pan: a row of old olive trees with thick, twisted, gnarled trunks and wide, rounded low-poly canopies of small silver-green facets (#5E6B4E with moonlit edges #9FB4A8), standing on a gentle slope of dark earth with a few rocks and a pale dirt path that winds between the trees; the trees fill the lower two-thirds of the image across the full width, with gaps between them. Everything above the treetops is transparent.

LIGHT: night. Cool blue-silver moonlight from the upper right outlines the leaves, trunks and rocks; deep blue-violet shadows (#1E2236, #2B2440, never pure black); a faint warm orange glow low on the far left, as if from distant torches.

BACKGROUND: everything above and around the scenery is fully transparent (PNG with a real alpha channel): no sky color, no white, no checkerboard pattern.

FORMAT: landscape 3:2 (1536×1024).

AVOID: text, letters, numbers, people, animals, signs, frames, borders.
```

### 11. `bg_room_back.png`

- **Size:** 1536×1024 (landscape 3:2)
- **Transparent:** no
- **Priority:** MUST-HAVE
- **Attach:** style_ref_2.png, char_jesus_turnaround.png
- **Used in:** S2 landing, S3–S5 the upper room (the camera dollies along it), S12 left half

```text
Flat 2D paper-cut illustration for a cinematic 2.5D animated Bible story. Characters and props: simple bold shapes with a clean, even, dark brown outline (#2B1D12) and rounded joins; matte flat colors with exactly one soft shadow tone per color (far-side arm and leg one shade darker); no gradients on characters, no texture, no noise, no 3D rendering, no realism. Minimal faces: one almond-shaped eye (white with a round dark pupil), a small rounded nose bump on the profile, usually no mouth; hair and beards are flat shapes. Bodies about 5.5 heads tall, tube-like arms ending in rounded mitten hands (no separate fingers), simple rounded feet, robes as clean A-line shapes. Scenery: a warm low-poly diorama look, with walls, hills, rocks and trees built from large flat-shaded triangular facets, no outlines, soft haze and cinematic lighting. Warm biblical palette: sand #D9B27C, ochre #C98A4B, terracotta #B4643C, olive #8A8F45, sage #A3A36E, dusty blue #6F8FA0, cream #F3ECDF, deep brown #2B1D12, and deep night blues #1B2440 and #32456B for night scenes. High detail but clean and readable, crisp edges. No text, no letters, no numbers, no watermark, no signature, no logo, no frame, no border.

ATTACHED: 1 style reference screenshot (copy only its faceted low-poly look) and the approved JESUS sheet as a STYLE MATCH for outlines and color only. Do not draw any person.

IMAGE: the BACK layer of the upper room at night, as a wide image for a slow sideways camera move: a large plastered stone room seen from the side, with a long back wall in warm ochre and sand tones built from big flat facets, wooden ceiling beams, two arched windows showing the deep-blue night sky with a few stars, small clay oil lamps burning in wall niches and on a shelf, woven rugs and floor cushions along the base of the wall, and the floor in warm terracotta tiles. The middle of the floor is open and empty (a long table and people are added later). No people, no table.

LIGHT: night interior lit only by small clay oil lamps: warm amber-gold pools of light on the walls and floor (#C9894E fading to #7A4E2E), soft dark warm-brown corners (never pure black), and a cool deep-blue night outside the window.

BACKGROUND: a complete, opaque picture that fills the whole image (no transparency).

FORMAT: landscape 3:2 (1536×1024).

AVOID: text, letters, numbers, people, animals, signs, frames, borders.
```

### 12. `prop_table_set.png`

- **Size:** 1536×1024 (landscape 3:2)
- **Transparent:** yes
- **Priority:** MUST-HAVE
- **Attach:** bg_room_back.png, char_jesus_turnaround.png
- **Used in:** S2 the 13 at supper, S4 the dolly along the table, S8 the coin on the table, S14 the feast

```text
Flat 2D paper-cut illustration for a cinematic 2.5D animated Bible story. Characters and props: simple bold shapes with a clean, even, dark brown outline (#2B1D12) and rounded joins; matte flat colors with exactly one soft shadow tone per color (far-side arm and leg one shade darker); no gradients on characters, no texture, no noise, no 3D rendering, no realism. Minimal faces: one almond-shaped eye (white with a round dark pupil), a small rounded nose bump on the profile, usually no mouth; hair and beards are flat shapes. Bodies about 5.5 heads tall, tube-like arms ending in rounded mitten hands (no separate fingers), simple rounded feet, robes as clean A-line shapes. Scenery: a warm low-poly diorama look, with walls, hills, rocks and trees built from large flat-shaded triangular facets, no outlines, soft haze and cinematic lighting. Warm biblical palette: sand #D9B27C, ochre #C98A4B, terracotta #B4643C, olive #8A8F45, sage #A3A36E, dusty blue #6F8FA0, cream #F3ECDF, deep brown #2B1D12, and deep night blues #1B2440 and #32456B for night scenes. High detail but clean and readable, crisp edges. No text, no letters, no numbers, no watermark, no signature, no logo, no frame, no border.

ATTACHED: the approved upper-room back layer (match its warm wood and clay colors) and the approved JESUS sheet as a STYLE MATCH. Do not draw any person.

IMAGE: a props sheet for the supper, every item a separate flat paper-cut piece with wide empty space around it: (1) one long, low wooden table seen from the front at a slight high angle, about knee height, set with round flatbreads, a few broken pieces of bread, clay cups, a clay wine jug and two small unlit clay oil lamps (no flame), filling most of the image width; (2) one round flatbread; (3) one clay cup; (4) one clay wine jug; (5) one floor cushion. No people, no hands, no food other than bread.

LIGHT: soft, even, neutral light from the upper left, so the art can be re-lit later in animation; no colored light, no strong shadows, no glow, no rim light, no cast shadows.

BACKGROUND: fully transparent (PNG with a real alpha channel). Nothing behind the subject: no ground, no floor, no cast shadow, no scenery, no white or checkerboard pattern.

FORMAT: landscape 3:2 (1536×1024).

AVOID: text, letters, numbers, inscriptions, faces or portraits on coins, people, hands, labels, frames, borders, cast shadows.
```

### 13. `char_disciples_seated.png`

- **Size:** 1536×1024 (landscape 3:2)
- **Transparent:** yes
- **Priority:** MUST-HAVE
- **Attach:** char_jesus_turnaround.png, style_ref_3.png
- **Used in:** S2 at the table, S4 Jesus kneels at each one's feet

```text
Flat 2D paper-cut illustration for a cinematic 2.5D animated Bible story. Characters and props: simple bold shapes with a clean, even, dark brown outline (#2B1D12) and rounded joins; matte flat colors with exactly one soft shadow tone per color (far-side arm and leg one shade darker); no gradients on characters, no texture, no noise, no 3D rendering, no realism. Minimal faces: one almond-shaped eye (white with a round dark pupil), a small rounded nose bump on the profile, usually no mouth; hair and beards are flat shapes. Bodies about 5.5 heads tall, tube-like arms ending in rounded mitten hands (no separate fingers), simple rounded feet, robes as clean A-line shapes. Scenery: a warm low-poly diorama look, with walls, hills, rocks and trees built from large flat-shaded triangular facets, no outlines, soft haze and cinematic lighting. Warm biblical palette: sand #D9B27C, ochre #C98A4B, terracotta #B4643C, olive #8A8F45, sage #A3A36E, dusty blue #6F8FA0, cream #F3ECDF, deep brown #2B1D12, and deep night blues #1B2440 and #32456B for night scenes. High detail but clean and readable, crisp edges. No text, no letters, no numbers, no watermark, no signature, no logo, no frame, no border.

ATTACHED: our approved JESUS character sheet as a STYLE MATCH. Use the exact same drawing style, outline weight, proportions and level of detail, but draw these nine men as described below, not Jesus. Also attached: 1 style reference screenshot of a group. Copy only its variety of skin tones, hair and clothing, never its people.

IMAGE: nine different disciples, each sitting on a flat floor cushion in side view facing right, knees bent, hands resting on their knees, bare feet flat on the floor in front of them and clearly visible (no sandals); all at the same scale, arranged in 2 rows (5 on top, 4 below) with clear empty space between them (no figure touches another). Each man looks different: (1) an old man with a long white beard and a sand robe; (2) a young man with short black hair, light stubble and an olive robe; (3) a middle-aged bald man with a dark beard and a rust robe; (4) a man with long dark hair tied back, a short beard and a mustard robe; (5) a lean man with grey curly hair, a trimmed grey beard and a teal-grey robe; (6) a broad man with a thick black beard, a plain head cloth and a dark-brown robe; (7) a young man with wavy brown hair, no beard and a cream robe; (8) a man with deep-brown skin, short curly hair, a short beard and a terracotta robe; (9) a man with a long dark beard, a striped head cloth and a sage-green robe. Skin tones vary from light tan to deep brown. Each has one almond eye, a small nose and no mouth.

LIGHT: soft, even, neutral light from the upper left, so the art can be re-lit later in animation; no colored light, no strong shadows, no glow, no rim light, no cast shadows.

BACKGROUND: fully transparent (PNG with a real alpha channel). Nothing behind the subject: no ground, no floor, no cast shadow, no scenery, no white or checkerboard pattern.

FORMAT: landscape 3:2 (1536×1024).

AVOID: text, letters, numbers, labels, arrows, guide lines, grid lines, frames, borders; extra fingers, extra arms or legs, mouths, realistic faces, halos, glows, cast shadows, gradients.
```

### 14. `char_peter_john_poses.png`

- **Size:** 1536×1024 (landscape 3:2)
- **Transparent:** yes
- **Priority:** MUST-HAVE
- **Attach:** char_jesus_turnaround.png, char_disciples_seated.png
- **Used in:** S4 Peter surprised, John moved

```text
Flat 2D paper-cut illustration for a cinematic 2.5D animated Bible story. Characters and props: simple bold shapes with a clean, even, dark brown outline (#2B1D12) and rounded joins; matte flat colors with exactly one soft shadow tone per color (far-side arm and leg one shade darker); no gradients on characters, no texture, no noise, no 3D rendering, no realism. Minimal faces: one almond-shaped eye (white with a round dark pupil), a small rounded nose bump on the profile, usually no mouth; hair and beards are flat shapes. Bodies about 5.5 heads tall, tube-like arms ending in rounded mitten hands (no separate fingers), simple rounded feet, robes as clean A-line shapes. Scenery: a warm low-poly diorama look, with walls, hills, rocks and trees built from large flat-shaded triangular facets, no outlines, soft haze and cinematic lighting. Warm biblical palette: sand #D9B27C, ochre #C98A4B, terracotta #B4643C, olive #8A8F45, sage #A3A36E, dusty blue #6F8FA0, cream #F3ECDF, deep brown #2B1D12, and deep night blues #1B2440 and #32456B for night scenes. High detail but clean and readable, crisp edges. No text, no letters, no numbers, no watermark, no signature, no logo, no frame, no border.

ATTACHED: our approved JESUS character sheet as a STYLE MATCH. Use the exact same drawing style, outline weight, proportions and level of detail, but draw PETER and JOHN as described below, not Jesus. Also attached: our approved seated disciples sheet. Match its seated pose, cushion and scale.

PETER: a stocky, strong fisherman in his forties with tan skin (#996240); short dark hair and a full, short beard, both streaked with grey (#4A443E with #8F8A84 streaks); one almond eye with a dark pupil, a small rounded nose, no mouth; a plain brown robe (#7A5233) with a tan rope belt. Broad shoulders, about 5.5 heads tall.

JOHN: the youngest disciple, about eighteen, with no beard; light-brown skin (#B98457); short, wavy black hair (#1F1A17); one almond eye with a dark pupil and soft, gentle eyes, a small rounded nose, no mouth; a light-blue robe (#8FB0C8) with a cream belt. Slim build, about 5.5 heads tall.

IMAGE: four seated figures in one row with clear empty space between them, all at the same scale and all in side view facing right, each sitting on a flat floor cushion with bare feet visible in front: (1) PETER sitting calmly, hands on his knees; (2) PETER pulling back in surprise, leaning away, both hands raised in front of his chest, feet pulled in; (3) JOHN sitting calmly; (4) JOHN deeply moved, head bowed, one hand on his chest. Each disciple must look the same in both of his poses.

LIGHT: soft, even, neutral light from the upper left, so the art can be re-lit later in animation; no colored light, no strong shadows, no glow, no rim light, no cast shadows.

BACKGROUND: fully transparent (PNG with a real alpha channel). Nothing behind the subject: no ground, no floor, no cast shadow, no scenery, no white or checkerboard pattern.

FORMAT: landscape 3:2 (1536×1024).

AVOID: text, letters, numbers, labels, arrows, guide lines, grid lines, frames, borders; extra fingers, extra arms or legs, mouths, realistic faces, halos, glows, cast shadows, gradients.
```

### 15. `char_crowd_torches.png`

- **Size:** 1536×1024 (landscape 3:2)
- **Transparent:** yes
- **Priority:** MUST-HAVE
- **Attach:** char_judas_turnaround.png, style_ref_3.png
- **Used in:** S1 out of focus behind the kiss, S9 the torch line, S12 right half

```text
Flat 2D paper-cut illustration for a cinematic 2.5D animated Bible story. Characters and props: simple bold shapes with a clean, even, dark brown outline (#2B1D12) and rounded joins; matte flat colors with exactly one soft shadow tone per color (far-side arm and leg one shade darker); no gradients on characters, no texture, no noise, no 3D rendering, no realism. Minimal faces: one almond-shaped eye (white with a round dark pupil), a small rounded nose bump on the profile, usually no mouth; hair and beards are flat shapes. Bodies about 5.5 heads tall, tube-like arms ending in rounded mitten hands (no separate fingers), simple rounded feet, robes as clean A-line shapes. Scenery: a warm low-poly diorama look, with walls, hills, rocks and trees built from large flat-shaded triangular facets, no outlines, soft haze and cinematic lighting. Warm biblical palette: sand #D9B27C, ochre #C98A4B, terracotta #B4643C, olive #8A8F45, sage #A3A36E, dusty blue #6F8FA0, cream #F3ECDF, deep brown #2B1D12, and deep night blues #1B2440 and #32456B for night scenes. High detail but clean and readable, crisp edges. No text, no letters, no numbers, no watermark, no signature, no logo, no frame, no border.

ATTACHED: our approved JUDAS sheet as a STYLE MATCH only (same outline weight and level of detail; do not draw Judas) and 1 style reference screenshot of a group (copy only its variety, never its people).

THE CROWD: ordinary men in simple, plain robes of muted dusty colors (grey-brown, dark olive, faded blue-grey, dull rust), some with a plain head cloth; no uniforms, no armor, no helmets, no badges, no emblems and no symbols of any group. They carry wooden torches, plain short swords and wooden staves.

IMAGE: six different men from the crowd, each walking in side view facing right, mid-stride, all at the same scale, in 2 rows of 3 with clear empty space between them (no figure touches another): two hold a wooden torch raised high (the torch head is a wrapped cloth bundle on a stick, UNLIT, with no flame: the fire is added later in animation), two hold a wooden staff upright, and two hold a plain short sword pointing upward, resting against the shoulder. Calm, serious faces; nobody is fighting.

LIGHT: soft, even, neutral light from the upper left, so the art can be re-lit later in animation; no colored light, no strong shadows, no glow, no rim light, no cast shadows.

BACKGROUND: fully transparent (PNG with a real alpha channel). Nothing behind the subject: no ground, no floor, no cast shadow, no scenery, no white or checkerboard pattern.

FORMAT: landscape 3:2 (1536×1024).

AVOID: text, letters, numbers, labels, arrows, guide lines, grid lines, frames, borders; extra fingers, extra arms or legs, mouths, realistic faces, halos, glows, cast shadows, gradients.
```

### 16. `char_jesus_parts.png`

- **Size:** 1536×1024 (landscape 3:2)
- **Transparent:** yes
- **Priority:** MUST-HAVE
- **Attach:** char_jesus_turnaround.png, style_ref_1.png
- **Used in:** bone rig: breathing, head turns, arm moves, the robe laid aside

```text
Flat 2D paper-cut illustration for a cinematic 2.5D animated Bible story. Characters and props: simple bold shapes with a clean, even, dark brown outline (#2B1D12) and rounded joins; matte flat colors with exactly one soft shadow tone per color (far-side arm and leg one shade darker); no gradients on characters, no texture, no noise, no 3D rendering, no realism. Minimal faces: one almond-shaped eye (white with a round dark pupil), a small rounded nose bump on the profile, usually no mouth; hair and beards are flat shapes. Bodies about 5.5 heads tall, tube-like arms ending in rounded mitten hands (no separate fingers), simple rounded feet, robes as clean A-line shapes. Scenery: a warm low-poly diorama look, with walls, hills, rocks and trees built from large flat-shaded triangular facets, no outlines, soft haze and cinematic lighting. Warm biblical palette: sand #D9B27C, ochre #C98A4B, terracotta #B4643C, olive #8A8F45, sage #A3A36E, dusty blue #6F8FA0, cream #F3ECDF, deep brown #2B1D12, and deep night blues #1B2440 and #32456B for night scenes. High detail but clean and readable, crisp edges. No text, no letters, no numbers, no watermark, no signature, no logo, no frame, no border.

ATTACHED: our approved JESUS character sheet. Keep his face, hair, beard, clothes, colors and proportions exactly the same. Also attached: 1 style reference screenshot. Copy only its drawing style.

JESUS: a calm, kind man of about thirty with warm brown skin (#A8693F); shoulder-length dark-brown hair (#3B271A) tucked behind his ear; a short, neat dark-brown beard; one almond eye with a dark pupil and a soft, gentle look, a small rounded nose, no mouth. He wears a long off-white robe (#EFE8D8) that reaches his ankles, tied with a soft blue-grey sash (#7E8FA0), and over it a light sand-colored outer robe (mantle, #CDB892) that hangs from his shoulders to his knees; simple brown sandals (#6B4A2E). Slim build, calm upright posture, about 5.5 heads tall. No halo, no glow, no crown, no realistic face.

IMAGE: an animation parts sheet (a cut-out puppet kit for a 2D bone rig) of JESUS in side view facing right, at exactly the same scale as the side view in the attached JESUS character sheet. Every part is a separate flat paper-cut piece, laid out in a tidy grid with clear empty space around each piece; no piece touches or overlaps another: (1) the head in side profile with eye, nose and ear, without hair and without beard, with a short neck stub at the bottom; (2) the shoulder-length hair as one separate piece; (3) the beard as one separate piece; (4) the torso with the off-white robe and blue-grey sash, from the neck down to the knees, without head, arms or outer robe; (5) the lower part of the robe (the hem) from the knees down to the ankles; (6) the outer robe (mantle) as one separate piece, as it hangs from the shoulders in side view; (7) the near upper arm with sleeve; (8) the far upper arm with sleeve; (9) the near forearm with sleeve and mitten hand; (10) the far forearm with sleeve and mitten hand; (11) the near leg from hip to foot with sandal; (12) the far leg from hip to foot with sandal. Each limb piece has rounded ends with a little extra overlap area at the joints (neck, shoulder, elbow, hip, knee), so the pieces can rotate and overlap without gaps. The far-side arm and leg are one shade darker. Every piece keeps the same outline and colors. No shadows.

LIGHT: soft, even, neutral light from the upper left, so the art can be re-lit later in animation; no colored light, no strong shadows, no glow, no rim light, no cast shadows.

BACKGROUND: fully transparent (PNG with a real alpha channel). Nothing behind the subject: no ground, no floor, no cast shadow, no scenery, no white or checkerboard pattern.

FORMAT: landscape 3:2 (1536×1024).

AVOID: text, letters, numbers, labels, arrows, guide lines, grid lines, frames, borders; extra fingers, extra arms or legs, mouths, realistic faces, halos, glows, cast shadows, gradients.
```

### 17. `char_judas_parts.png`

- **Size:** 1536×1024 (landscape 3:2)
- **Transparent:** yes
- **Priority:** MUST-HAVE
- **Attach:** char_judas_turnaround.png, char_jesus_parts.png
- **Used in:** bone rig: walking (S9), flinch (S5), the lean before the kiss (S10)

```text
Flat 2D paper-cut illustration for a cinematic 2.5D animated Bible story. Characters and props: simple bold shapes with a clean, even, dark brown outline (#2B1D12) and rounded joins; matte flat colors with exactly one soft shadow tone per color (far-side arm and leg one shade darker); no gradients on characters, no texture, no noise, no 3D rendering, no realism. Minimal faces: one almond-shaped eye (white with a round dark pupil), a small rounded nose bump on the profile, usually no mouth; hair and beards are flat shapes. Bodies about 5.5 heads tall, tube-like arms ending in rounded mitten hands (no separate fingers), simple rounded feet, robes as clean A-line shapes. Scenery: a warm low-poly diorama look, with walls, hills, rocks and trees built from large flat-shaded triangular facets, no outlines, soft haze and cinematic lighting. Warm biblical palette: sand #D9B27C, ochre #C98A4B, terracotta #B4643C, olive #8A8F45, sage #A3A36E, dusty blue #6F8FA0, cream #F3ECDF, deep brown #2B1D12, and deep night blues #1B2440 and #32456B for night scenes. High detail but clean and readable, crisp edges. No text, no letters, no numbers, no watermark, no signature, no logo, no frame, no border.

ATTACHED: our approved JUDAS character sheet. Keep his face, hair, beard, clothes and coin pouch, colors and proportions exactly the same. Also attached: the JESUS parts sheet as a LAYOUT EXAMPLE only. Use the same kind of pieces, scale and spacing, but draw Judas, not Jesus.

JUDAS: a younger man of about thirty with olive-brown skin (#9A6440); short, tightly curly black-brown hair (#2A1E17); a short, thin beard along his jaw; one almond eye with a dark pupil and a tense, narrow look, a small rounded nose, no mouth. He wears a long deep red-brown robe (#7A3324) that reaches his ankles, a dark leather belt (#3B2618) with a small leather coin pouch (#8A5A32) tied at his hip, and simple dark-brown sandals. Lean build, shoulders slightly raised and tense, about 5.5 heads tall.

IMAGE: an animation parts sheet (a cut-out puppet kit for a 2D bone rig) of JUDAS in side view facing right, at exactly the same scale as the side view in the attached JUDAS character sheet. Every part is a separate flat paper-cut piece, laid out in a tidy grid with clear empty space around each piece; no piece touches or overlaps another: (1) the head in side profile with eye, nose and ear, without hair and without beard, with a short neck stub at the bottom; (2) the curly hair as one separate piece; (3) the thin beard as one separate piece; (4) the torso with the red-brown robe, belt and coin pouch, from the neck down to the knees, without head or arms; (5) the lower part of the robe (the hem) from the knees down to the ankles; (6) the near upper arm with sleeve; (7) the far upper arm with sleeve; (8) the near forearm with sleeve and mitten hand; (9) the far forearm with sleeve and mitten hand; (10) the near leg from hip to foot with sandal; (11) the far leg from hip to foot with sandal. Each limb piece has rounded ends with a little extra overlap area at the joints (neck, shoulder, elbow, hip, knee), so the pieces can rotate and overlap without gaps. The far-side arm and leg are one shade darker. Every piece keeps the same outline and colors. No shadows.

LIGHT: soft, even, neutral light from the upper left, so the art can be re-lit later in animation; no colored light, no strong shadows, no glow, no rim light, no cast shadows.

BACKGROUND: fully transparent (PNG with a real alpha channel). Nothing behind the subject: no ground, no floor, no cast shadow, no scenery, no white or checkerboard pattern.

FORMAT: landscape 3:2 (1536×1024).

AVOID: text, letters, numbers, labels, arrows, guide lines, grid lines, frames, borders; extra fingers, extra arms or legs, mouths, realistic faces, halos, glows, cast shadows, gradients.
```

### 18. `prop_scale_chain.png`

- **Size:** 1536×1024 (landscape 3:2)
- **Transparent:** yes
- **Priority:** MUST-HAVE
- **Attach:** prop_coins.png, char_jesus_turnaround.png
- **Used in:** S7 the balance scale: 30 coins against the price of a slave

```text
Flat 2D paper-cut illustration for a cinematic 2.5D animated Bible story. Characters and props: simple bold shapes with a clean, even, dark brown outline (#2B1D12) and rounded joins; matte flat colors with exactly one soft shadow tone per color (far-side arm and leg one shade darker); no gradients on characters, no texture, no noise, no 3D rendering, no realism. Minimal faces: one almond-shaped eye (white with a round dark pupil), a small rounded nose bump on the profile, usually no mouth; hair and beards are flat shapes. Bodies about 5.5 heads tall, tube-like arms ending in rounded mitten hands (no separate fingers), simple rounded feet, robes as clean A-line shapes. Scenery: a warm low-poly diorama look, with walls, hills, rocks and trees built from large flat-shaded triangular facets, no outlines, soft haze and cinematic lighting. Warm biblical palette: sand #D9B27C, ochre #C98A4B, terracotta #B4643C, olive #8A8F45, sage #A3A36E, dusty blue #6F8FA0, cream #F3ECDF, deep brown #2B1D12, and deep night blues #1B2440 and #32456B for night scenes. High detail but clean and readable, crisp edges. No text, no letters, no numbers, no watermark, no signature, no logo, no frame, no border.

ATTACHED: our approved coins sheet (match its silver and outline) and the approved JESUS sheet as a STYLE MATCH only. Do not draw any person.

IMAGE: a props sheet, every item a separate flat paper-cut piece with wide empty space around it: (1) an old bronze balance scale seen from the front: a central post on a round base, a level crossbeam, and two empty round pans hanging from three thin chains each (#9A6A34 with a darker tone #6B4A2E); (2) the crossbeam alone with its two hanging pans, as a separate piece (so it can tilt in animation); (3) a simple old iron chain with a plain open shackle ring at one end and about eight links (#5E5A55 with a darker tone #3F3A36); (4) a small blank tag of old parchment on a short string (#E6D3A8), with nothing written on it.

LIGHT: soft, even, neutral light from the upper left, so the art can be re-lit later in animation; no colored light, no strong shadows, no glow, no rim light, no cast shadows.

BACKGROUND: fully transparent (PNG with a real alpha channel). Nothing behind the subject: no ground, no floor, no cast shadow, no scenery, no white or checkerboard pattern.

FORMAT: landscape 3:2 (1536×1024).

AVOID: text, letters, numbers, inscriptions, faces or portraits on coins, people, hands, labels, frames, borders, cast shadows.
```

## NICE-TO-HAVE prompts

### 19. `bg_garden_far.png`

- **Size:** 1536×1024 (landscape 3:2)
- **Transparent:** yes (around the scenery)
- **Priority:** NICE-TO-HAVE
- **Attach:** bg_garden_sky.png, bg_garden_mid.png
- **Used in:** S9 depth behind the grove (code hills if skipped)

```text
Flat 2D paper-cut illustration for a cinematic 2.5D animated Bible story. Characters and props: simple bold shapes with a clean, even, dark brown outline (#2B1D12) and rounded joins; matte flat colors with exactly one soft shadow tone per color (far-side arm and leg one shade darker); no gradients on characters, no texture, no noise, no 3D rendering, no realism. Minimal faces: one almond-shaped eye (white with a round dark pupil), a small rounded nose bump on the profile, usually no mouth; hair and beards are flat shapes. Bodies about 5.5 heads tall, tube-like arms ending in rounded mitten hands (no separate fingers), simple rounded feet, robes as clean A-line shapes. Scenery: a warm low-poly diorama look, with walls, hills, rocks and trees built from large flat-shaded triangular facets, no outlines, soft haze and cinematic lighting. Warm biblical palette: sand #D9B27C, ochre #C98A4B, terracotta #B4643C, olive #8A8F45, sage #A3A36E, dusty blue #6F8FA0, cream #F3ECDF, deep brown #2B1D12, and deep night blues #1B2440 and #32456B for night scenes. High detail but clean and readable, crisp edges. No text, no letters, no numbers, no watermark, no signature, no logo, no frame, no border.

ATTACHED: the approved night sky and olive-grove layers of this same scene. Match its light, colors, haze and level of detail exactly.

IMAGE: the FAR layer of the night olive garden, as a wide strip: low, rolling low-poly hills in deep moonlit blue-grey (#2E3A55, #45557A) along the bottom third, and on a far hilltop a tiny, simple city wall with a few small warm window lights. Soft night haze. Everything above the hills is transparent.

LIGHT: night. Cool blue-silver moonlight from the upper right outlines the leaves, trunks and rocks; deep blue-violet shadows (#1E2236, #2B2440, never pure black); a faint warm orange glow low on the far left, as if from distant torches.

BACKGROUND: everything above and around the scenery is fully transparent (PNG with a real alpha channel): no sky color, no white, no checkerboard pattern.

FORMAT: landscape 3:2 (1536×1024).

AVOID: text, letters, numbers, people, animals, signs, frames, borders.
```

### 20. `bg_garden_near.png`

- **Size:** 1536×1024 (landscape 3:2)
- **Transparent:** yes (around the scenery)
- **Priority:** NICE-TO-HAVE
- **Attach:** bg_garden_mid.png
- **Used in:** S1, S9 foreground parallax (blurred in code)

```text
Flat 2D paper-cut illustration for a cinematic 2.5D animated Bible story. Characters and props: simple bold shapes with a clean, even, dark brown outline (#2B1D12) and rounded joins; matte flat colors with exactly one soft shadow tone per color (far-side arm and leg one shade darker); no gradients on characters, no texture, no noise, no 3D rendering, no realism. Minimal faces: one almond-shaped eye (white with a round dark pupil), a small rounded nose bump on the profile, usually no mouth; hair and beards are flat shapes. Bodies about 5.5 heads tall, tube-like arms ending in rounded mitten hands (no separate fingers), simple rounded feet, robes as clean A-line shapes. Scenery: a warm low-poly diorama look, with walls, hills, rocks and trees built from large flat-shaded triangular facets, no outlines, soft haze and cinematic lighting. Warm biblical palette: sand #D9B27C, ochre #C98A4B, terracotta #B4643C, olive #8A8F45, sage #A3A36E, dusty blue #6F8FA0, cream #F3ECDF, deep brown #2B1D12, and deep night blues #1B2440 and #32456B for night scenes. High detail but clean and readable, crisp edges. No text, no letters, no numbers, no watermark, no signature, no logo, no frame, no border.

ATTACHED: the approved olive-grove layer of this same scene. Match its light, colors, haze and level of detail exactly.

IMAGE: the NEAR (foreground) layer of the night olive garden: two big dark olive trunks at the far left and far right edges with a few low leafy branches reaching in from the top corners, and dark rocks and grass tufts along the bottom edge; slightly darker and richer than the middle layer, because it is closest to the camera. The middle of the image is transparent.

LIGHT: night. Cool blue-silver moonlight from the upper right outlines the leaves, trunks and rocks; deep blue-violet shadows (#1E2236, #2B2440, never pure black); a faint warm orange glow low on the far left, as if from distant torches.

BACKGROUND: everything above and around the scenery is fully transparent (PNG with a real alpha channel): no sky color, no white, no checkerboard pattern.

FORMAT: landscape 3:2 (1536×1024).

AVOID: text, letters, numbers, people, animals, signs, frames, borders.
```

### 21. `bg_room_near.png`

- **Size:** 1536×1024 (landscape 3:2)
- **Transparent:** yes
- **Priority:** NICE-TO-HAVE
- **Attach:** bg_room_back.png
- **Used in:** S2–S5 foreground parallax in the upper room

```text
Flat 2D paper-cut illustration for a cinematic 2.5D animated Bible story. Characters and props: simple bold shapes with a clean, even, dark brown outline (#2B1D12) and rounded joins; matte flat colors with exactly one soft shadow tone per color (far-side arm and leg one shade darker); no gradients on characters, no texture, no noise, no 3D rendering, no realism. Minimal faces: one almond-shaped eye (white with a round dark pupil), a small rounded nose bump on the profile, usually no mouth; hair and beards are flat shapes. Bodies about 5.5 heads tall, tube-like arms ending in rounded mitten hands (no separate fingers), simple rounded feet, robes as clean A-line shapes. Scenery: a warm low-poly diorama look, with walls, hills, rocks and trees built from large flat-shaded triangular facets, no outlines, soft haze and cinematic lighting. Warm biblical palette: sand #D9B27C, ochre #C98A4B, terracotta #B4643C, olive #8A8F45, sage #A3A36E, dusty blue #6F8FA0, cream #F3ECDF, deep brown #2B1D12, and deep night blues #1B2440 and #32456B for night scenes. High detail but clean and readable, crisp edges. No text, no letters, no numbers, no watermark, no signature, no logo, no frame, no border.

ATTACHED: the approved upper-room back layer of this same scene. Match its light, colors, haze and level of detail exactly.

IMAGE: a FOREGROUND KIT for the upper room, six separate pieces with clear empty space around each: (1) the edge of a thick stone pillar, tall; (2) a hanging clay oil lamp on a short chain; (3) a large clay storage jar; (4) a stack of two floor cushions; (5) a low wooden stool; (6) a woven basket. Slightly darker and richer than the back layer (they are close to the camera).

LIGHT: night interior lit only by small clay oil lamps: warm amber-gold pools of light on the walls and floor (#C9894E fading to #7A4E2E), soft dark warm-brown corners (never pure black), and a cool deep-blue night outside the window.

BACKGROUND: fully transparent (PNG with a real alpha channel). Nothing behind the subject: no ground, no floor, no cast shadow, no scenery, no white or checkerboard pattern.

FORMAT: landscape 3:2 (1536×1024).

AVOID: text, letters, numbers, people, animals, signs, frames, borders.
```

### 22. `bg_dealroom.png`

- **Size:** 1024×1536 (portrait 2:3)
- **Transparent:** no
- **Priority:** NICE-TO-HAVE
- **Attach:** bg_room_back.png, prop_coins.png
- **Used in:** S6 the flashback deal (dark code room if skipped)

```text
Flat 2D paper-cut illustration for a cinematic 2.5D animated Bible story. Characters and props: simple bold shapes with a clean, even, dark brown outline (#2B1D12) and rounded joins; matte flat colors with exactly one soft shadow tone per color (far-side arm and leg one shade darker); no gradients on characters, no texture, no noise, no 3D rendering, no realism. Minimal faces: one almond-shaped eye (white with a round dark pupil), a small rounded nose bump on the profile, usually no mouth; hair and beards are flat shapes. Bodies about 5.5 heads tall, tube-like arms ending in rounded mitten hands (no separate fingers), simple rounded feet, robes as clean A-line shapes. Scenery: a warm low-poly diorama look, with walls, hills, rocks and trees built from large flat-shaded triangular facets, no outlines, soft haze and cinematic lighting. Warm biblical palette: sand #D9B27C, ochre #C98A4B, terracotta #B4643C, olive #8A8F45, sage #A3A36E, dusty blue #6F8FA0, cream #F3ECDF, deep brown #2B1D12, and deep night blues #1B2440 and #32456B for night scenes. High detail but clean and readable, crisp edges. No text, no letters, no numbers, no watermark, no signature, no logo, no frame, no border.

ATTACHED: the approved upper-room back layer (match its faceted walls and colors, but darker) and the approved coins sheet.

IMAGE: a small, dim stone room earlier in the week: rough stone walls in dark warm browns, a heavy wooden table in the foreground center with one small lit clay oil lamp on it, a closed wooden door and a tiny high window in the back wall, deep shadows in the corners. Quiet and secretive. No people, no coins.

LIGHT: dim. One small oil lamp on the table makes a warm pool of light; everything else falls into deep warm-brown shadow.

BACKGROUND: a complete, opaque picture that fills the whole image (no transparency).

FORMAT: portrait 2:3 (1024×1536).

AVOID: text, letters, numbers, people, animals, signs, frames, borders.
```

### 23. `prop_hands_coins.png`

- **Size:** 1536×1024 (landscape 3:2)
- **Transparent:** yes
- **Priority:** NICE-TO-HAVE
- **Attach:** prop_coins.png, char_judas_turnaround.png
- **Used in:** S6 coins counted into Judas's palm (Judas's pose sheet if skipped)

```text
Flat 2D paper-cut illustration for a cinematic 2.5D animated Bible story. Characters and props: simple bold shapes with a clean, even, dark brown outline (#2B1D12) and rounded joins; matte flat colors with exactly one soft shadow tone per color (far-side arm and leg one shade darker); no gradients on characters, no texture, no noise, no 3D rendering, no realism. Minimal faces: one almond-shaped eye (white with a round dark pupil), a small rounded nose bump on the profile, usually no mouth; hair and beards are flat shapes. Bodies about 5.5 heads tall, tube-like arms ending in rounded mitten hands (no separate fingers), simple rounded feet, robes as clean A-line shapes. Scenery: a warm low-poly diorama look, with walls, hills, rocks and trees built from large flat-shaded triangular facets, no outlines, soft haze and cinematic lighting. Warm biblical palette: sand #D9B27C, ochre #C98A4B, terracotta #B4643C, olive #8A8F45, sage #A3A36E, dusty blue #6F8FA0, cream #F3ECDF, deep brown #2B1D12, and deep night blues #1B2440 and #32456B for night scenes. High detail but clean and readable, crisp edges. No text, no letters, no numbers, no watermark, no signature, no logo, no frame, no border.

ATTACHED: our approved coins sheet and the approved JUDAS sheet (match his red-brown sleeve and skin for piece 2).

THE HAND: a generic adult hand and forearm in a plain grey-brown sleeve, warm brown skin, one plain gold ring, drawn as a rounded mitten hand in the same style; no face and no body.

IMAGE: two separate pieces with wide empty space between them: (1) THE HAND, coming in from the left, palm down, holding one silver coin at its rounded fingertips as if about to drop it; (2) JUDAS's hand and forearm in his deep red-brown sleeve (#7A3324), coming in from the right, palm open and facing up, cupped to receive coins, empty. Rounded mitten hands in the same flat style.

LIGHT: soft, even, neutral light from the upper left, so the art can be re-lit later in animation; no colored light, no strong shadows, no glow, no rim light, no cast shadows.

BACKGROUND: fully transparent (PNG with a real alpha channel). Nothing behind the subject: no ground, no floor, no cast shadow, no scenery, no white or checkerboard pattern.

FORMAT: landscape 3:2 (1536×1024).

AVOID: text, letters, numbers, inscriptions, faces or portraits on coins, people, hands, labels, frames, borders, cast shadows.
```

### 24. `char_feast_guests.png`

- **Size:** 1536×1024 (landscape 3:2)
- **Transparent:** yes
- **Priority:** NICE-TO-HAVE
- **Attach:** char_jesus_turnaround.png, style_ref_3.png
- **Used in:** S14 the feast with publicans and sinners (code silhouettes if skipped)

```text
Flat 2D paper-cut illustration for a cinematic 2.5D animated Bible story. Characters and props: simple bold shapes with a clean, even, dark brown outline (#2B1D12) and rounded joins; matte flat colors with exactly one soft shadow tone per color (far-side arm and leg one shade darker); no gradients on characters, no texture, no noise, no 3D rendering, no realism. Minimal faces: one almond-shaped eye (white with a round dark pupil), a small rounded nose bump on the profile, usually no mouth; hair and beards are flat shapes. Bodies about 5.5 heads tall, tube-like arms ending in rounded mitten hands (no separate fingers), simple rounded feet, robes as clean A-line shapes. Scenery: a warm low-poly diorama look, with walls, hills, rocks and trees built from large flat-shaded triangular facets, no outlines, soft haze and cinematic lighting. Warm biblical palette: sand #D9B27C, ochre #C98A4B, terracotta #B4643C, olive #8A8F45, sage #A3A36E, dusty blue #6F8FA0, cream #F3ECDF, deep brown #2B1D12, and deep night blues #1B2440 and #32456B for night scenes. High detail but clean and readable, crisp edges. No text, no letters, no numbers, no watermark, no signature, no logo, no frame, no border.

ATTACHED: our approved JESUS character sheet as a STYLE MATCH. Use the exact same drawing style, outline weight, proportions and level of detail, but draw these guests as described below, not Jesus. Also attached: 1 style reference screenshot of a group. Copy only its variety, never its people.

FEAST GUESTS: everyday people in colorful simple clothes (saffron, teal, rose, lime green, indigo, coral), men and women of different ages and skin tones, relaxed and happy; a small, simple curved smile line is allowed for them.

IMAGE: six different feast guests, all at the same scale, in 2 rows of 3 with clear empty space between them (no figure touches another): (1) a tax collector in a fine but faded saffron robe, sitting cross-legged on a cushion, laughing; (2) a woman in a rose robe and head scarf, sitting and smiling, holding a cup; (3) an old man in a teal robe, sitting and clapping; (4) a young man in a lime-green tunic, sitting and reaching for bread; (5) a woman in an indigo robe, standing and carrying a plate of fruit; (6) a rough, poor man in a patched coral tunic, sitting shyly but smiling. Side views facing right or left, mixed.

LIGHT: soft, even, neutral light from the upper left, so the art can be re-lit later in animation; no colored light, no strong shadows, no glow, no rim light, no cast shadows.

BACKGROUND: fully transparent (PNG with a real alpha channel). Nothing behind the subject: no ground, no floor, no cast shadow, no scenery, no white or checkerboard pattern.

FORMAT: landscape 3:2 (1536×1024).

AVOID: text, letters, numbers, labels, arrows, guide lines, grid lines, frames, borders; extra fingers, extra arms or legs, mouths, realistic faces, halos, glows, cast shadows, gradients.
```

### 25. `bg_feast_back.png`

- **Size:** 1024×1536 (portrait 2:3)
- **Transparent:** no
- **Priority:** NICE-TO-HAVE
- **Attach:** style_ref_2.png, char_jesus_turnaround.png
- **Used in:** S14 the bright feast courtyard (code courtyard if skipped)

```text
Flat 2D paper-cut illustration for a cinematic 2.5D animated Bible story. Characters and props: simple bold shapes with a clean, even, dark brown outline (#2B1D12) and rounded joins; matte flat colors with exactly one soft shadow tone per color (far-side arm and leg one shade darker); no gradients on characters, no texture, no noise, no 3D rendering, no realism. Minimal faces: one almond-shaped eye (white with a round dark pupil), a small rounded nose bump on the profile, usually no mouth; hair and beards are flat shapes. Bodies about 5.5 heads tall, tube-like arms ending in rounded mitten hands (no separate fingers), simple rounded feet, robes as clean A-line shapes. Scenery: a warm low-poly diorama look, with walls, hills, rocks and trees built from large flat-shaded triangular facets, no outlines, soft haze and cinematic lighting. Warm biblical palette: sand #D9B27C, ochre #C98A4B, terracotta #B4643C, olive #8A8F45, sage #A3A36E, dusty blue #6F8FA0, cream #F3ECDF, deep brown #2B1D12, and deep night blues #1B2440 and #32456B for night scenes. High detail but clean and readable, crisp edges. No text, no letters, no numbers, no watermark, no signature, no logo, no frame, no border.

ATTACHED: 1 style reference screenshot (copy only its warm faceted low-poly look) and the approved JESUS sheet as a STYLE MATCH. Do not draw any person.

IMAGE: the BACK layer of a bright courtyard feast, tall for a slow camera crane-up: warm sunlit cream and sand walls built from big flat facets, a wooden pergola covered in a green grapevine across the top third, colorful cloth awnings, hanging lanterns, a clear blue sky (#8FB6D9) above, and a sunny tiled floor with rugs and cushions where a low table will be placed. Joyful and welcoming. No people, no table.

LIGHT: bright, warm late-morning sun from the upper left, soft long shadows, cheerful and welcoming.

BACKGROUND: a complete, opaque picture that fills the whole image (no transparency).

FORMAT: portrait 2:3 (1024×1536).

AVOID: text, letters, numbers, people, animals, signs, frames, borders.
```

### 26. `bg_feast_near.png`

- **Size:** 1536×1024 (landscape 3:2)
- **Transparent:** yes
- **Priority:** NICE-TO-HAVE
- **Attach:** bg_feast_back.png
- **Used in:** S14 foreground parallax

```text
Flat 2D paper-cut illustration for a cinematic 2.5D animated Bible story. Characters and props: simple bold shapes with a clean, even, dark brown outline (#2B1D12) and rounded joins; matte flat colors with exactly one soft shadow tone per color (far-side arm and leg one shade darker); no gradients on characters, no texture, no noise, no 3D rendering, no realism. Minimal faces: one almond-shaped eye (white with a round dark pupil), a small rounded nose bump on the profile, usually no mouth; hair and beards are flat shapes. Bodies about 5.5 heads tall, tube-like arms ending in rounded mitten hands (no separate fingers), simple rounded feet, robes as clean A-line shapes. Scenery: a warm low-poly diorama look, with walls, hills, rocks and trees built from large flat-shaded triangular facets, no outlines, soft haze and cinematic lighting. Warm biblical palette: sand #D9B27C, ochre #C98A4B, terracotta #B4643C, olive #8A8F45, sage #A3A36E, dusty blue #6F8FA0, cream #F3ECDF, deep brown #2B1D12, and deep night blues #1B2440 and #32456B for night scenes. High detail but clean and readable, crisp edges. No text, no letters, no numbers, no watermark, no signature, no logo, no frame, no border.

ATTACHED: the approved feast courtyard layer of this same scene. Match its light, colors, haze and level of detail exactly.

IMAGE: a FOREGROUND KIT for the feast, six separate pieces with clear empty space around each: (1) a bowl of grapes and figs; (2) a clay pitcher; (3) a basket of round breads; (4) a potted olive sapling; (5) a hanging grapevine branch with leaves; (6) a stack of two bright cushions.

LIGHT: bright, warm late-morning sun from the upper left, soft long shadows, cheerful and welcoming.

BACKGROUND: fully transparent (PNG with a real alpha channel). Nothing behind the subject: no ground, no floor, no cast shadow, no scenery, no white or checkerboard pattern.

FORMAT: landscape 3:2 (1536×1024).

AVOID: text, letters, numbers, inscriptions, faces or portraits on coins, people, hands, labels, frames, borders, cast shadows.
```

### 27. `prop_lamps.png`

- **Size:** 1536×1024 (landscape 3:2)
- **Transparent:** yes
- **Priority:** NICE-TO-HAVE
- **Attach:** bg_room_back.png
- **Used in:** S2–S5 lamps close to the lens, S15 call to action (flames added in code)

```text
Flat 2D paper-cut illustration for a cinematic 2.5D animated Bible story. Characters and props: simple bold shapes with a clean, even, dark brown outline (#2B1D12) and rounded joins; matte flat colors with exactly one soft shadow tone per color (far-side arm and leg one shade darker); no gradients on characters, no texture, no noise, no 3D rendering, no realism. Minimal faces: one almond-shaped eye (white with a round dark pupil), a small rounded nose bump on the profile, usually no mouth; hair and beards are flat shapes. Bodies about 5.5 heads tall, tube-like arms ending in rounded mitten hands (no separate fingers), simple rounded feet, robes as clean A-line shapes. Scenery: a warm low-poly diorama look, with walls, hills, rocks and trees built from large flat-shaded triangular facets, no outlines, soft haze and cinematic lighting. Warm biblical palette: sand #D9B27C, ochre #C98A4B, terracotta #B4643C, olive #8A8F45, sage #A3A36E, dusty blue #6F8FA0, cream #F3ECDF, deep brown #2B1D12, and deep night blues #1B2440 and #32456B for night scenes. High detail but clean and readable, crisp edges. No text, no letters, no numbers, no watermark, no signature, no logo, no frame, no border.

ATTACHED: the approved upper-room back layer. Match the clay color of its lamps.

IMAGE: a props sheet of lamps, every item a separate flat paper-cut piece with wide empty space around it: three small clay oil lamps of slightly different shapes, each UNLIT with no flame (the flame is added in animation), and one tall wooden lamp stand with a lamp on top, also unlit.

LIGHT: soft, even, neutral light from the upper left, so the art can be re-lit later in animation; no colored light, no strong shadows, no glow, no rim light, no cast shadows.

BACKGROUND: fully transparent (PNG with a real alpha channel). Nothing behind the subject: no ground, no floor, no cast shadow, no scenery, no white or checkerboard pattern.

FORMAT: landscape 3:2 (1536×1024).

AVOID: text, letters, numbers, inscriptions, faces or portraits on coins, people, hands, labels, frames, borders, cast shadows.
```

### 28. `prop_torches_weapons.png`

- **Size:** 1536×1024 (landscape 3:2)
- **Transparent:** yes
- **Priority:** NICE-TO-HAVE
- **Attach:** char_crowd_torches.png
- **Used in:** S9 torches and weapons passing close to the lens

```text
Flat 2D paper-cut illustration for a cinematic 2.5D animated Bible story. Characters and props: simple bold shapes with a clean, even, dark brown outline (#2B1D12) and rounded joins; matte flat colors with exactly one soft shadow tone per color (far-side arm and leg one shade darker); no gradients on characters, no texture, no noise, no 3D rendering, no realism. Minimal faces: one almond-shaped eye (white with a round dark pupil), a small rounded nose bump on the profile, usually no mouth; hair and beards are flat shapes. Bodies about 5.5 heads tall, tube-like arms ending in rounded mitten hands (no separate fingers), simple rounded feet, robes as clean A-line shapes. Scenery: a warm low-poly diorama look, with walls, hills, rocks and trees built from large flat-shaded triangular facets, no outlines, soft haze and cinematic lighting. Warm biblical palette: sand #D9B27C, ochre #C98A4B, terracotta #B4643C, olive #8A8F45, sage #A3A36E, dusty blue #6F8FA0, cream #F3ECDF, deep brown #2B1D12, and deep night blues #1B2440 and #32456B for night scenes. High detail but clean and readable, crisp edges. No text, no letters, no numbers, no watermark, no signature, no logo, no frame, no border.

ATTACHED: our approved crowd sheet. Match its torches, staves and swords exactly.

IMAGE: a props sheet, every item a separate flat paper-cut piece with wide empty space around it, all held upright: (1) a wooden torch, UNLIT, the head a wrapped cloth bundle (the flame is added in animation); (2) a second torch of a slightly different length; (3) a plain wooden staff; (4) a plain short sword in a simple leather scabbard. No hands, no people.

LIGHT: soft, even, neutral light from the upper left, so the art can be re-lit later in animation; no colored light, no strong shadows, no glow, no rim light, no cast shadows.

BACKGROUND: fully transparent (PNG with a real alpha channel). Nothing behind the subject: no ground, no floor, no cast shadow, no scenery, no white or checkerboard pattern.

FORMAT: landscape 3:2 (1536×1024).

AVOID: text, letters, numbers, inscriptions, faces or portraits on coins, people, hands, labels, frames, borders, cast shadows.
```

### 29. `prop_olive_branches.png`

- **Size:** 1536×1024 (landscape 3:2)
- **Transparent:** yes
- **Priority:** NICE-TO-HAVE
- **Attach:** bg_garden_mid.png
- **Used in:** S1, S9, S13 branches passing close to the lens

```text
Flat 2D paper-cut illustration for a cinematic 2.5D animated Bible story. Characters and props: simple bold shapes with a clean, even, dark brown outline (#2B1D12) and rounded joins; matte flat colors with exactly one soft shadow tone per color (far-side arm and leg one shade darker); no gradients on characters, no texture, no noise, no 3D rendering, no realism. Minimal faces: one almond-shaped eye (white with a round dark pupil), a small rounded nose bump on the profile, usually no mouth; hair and beards are flat shapes. Bodies about 5.5 heads tall, tube-like arms ending in rounded mitten hands (no separate fingers), simple rounded feet, robes as clean A-line shapes. Scenery: a warm low-poly diorama look, with walls, hills, rocks and trees built from large flat-shaded triangular facets, no outlines, soft haze and cinematic lighting. Warm biblical palette: sand #D9B27C, ochre #C98A4B, terracotta #B4643C, olive #8A8F45, sage #A3A36E, dusty blue #6F8FA0, cream #F3ECDF, deep brown #2B1D12, and deep night blues #1B2440 and #32456B for night scenes. High detail but clean and readable, crisp edges. No text, no letters, no numbers, no watermark, no signature, no logo, no frame, no border.

ATTACHED: the approved olive-grove layer of this same scene. Match its light, colors, haze and level of detail exactly.

IMAGE: four separate olive branches with leaves, for the foreground, with wide empty space around each: two long branches reaching in sideways, one short branch with a cluster of leaves, and one hanging branch. Small low-poly silver-green leaves with moonlit edges, dark twisted wood.

LIGHT: night. Cool blue-silver moonlight from the upper right outlines the leaves, trunks and rocks; deep blue-violet shadows (#1E2236, #2B2440, never pure black); a faint warm orange glow low on the far left, as if from distant torches.

BACKGROUND: fully transparent (PNG with a real alpha channel). Nothing behind the subject: no ground, no floor, no cast shadow, no scenery, no white or checkerboard pattern.

FORMAT: landscape 3:2 (1536×1024).

AVOID: text, letters, numbers, people, animals, signs, frames, borders.
```
