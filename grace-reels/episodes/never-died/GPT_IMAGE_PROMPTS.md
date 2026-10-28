# They Never Died: GPT Image prompts

One-time GPT Image test. **35 images: 28 MUST-HAVE, 7 NICE-TO-HAVE.**
Make the MUST images first, **in this order**. Later prompts attach earlier images as references.
Every NICE image has a code fallback, so skipping one is fine.

## How to make them in ChatGPT

1. Download the 3 style references from `style_refs/`: `style_ref_1.png` (character close-up),
   `style_ref_2.png` (wide scene) and `style_ref_3.png` (group in holy light).
2. **Make #1, `char_elijah_turnaround.png`, first.** Re-roll until it is right: dark brown outline,
   one almond eye, no mouth, mitten hands, a shaggy fawn camel-hair garment, a leather belt, a
   dark-brown cloak, and no text. **This is the style anchor: attach it to every character and prop
   prompt after it**, as the "Attach" lists below show.
3. For each image: open a chat, attach the files in **Attach**, paste the prompt from its box, and send.
   If it is close but not right, fix it in the same chat (for example "same image, but the beard is
   shorter").
4. Save each result as a full-size PNG (download it, don't screenshot it) and **rename it to the exact
   file name** shown.
5. Re-roll any image that has text, letters, a frame, a border, a mouth or extra fingers.

Tips: use one ChatGPT chat per character (Elijah, Elisha, Enoch, and so on) so they stay consistent.
Use a new chat for each background scene.

## If transparency fails

ChatGPT sometimes paints a fake checkerboard, or a white or grey background, instead of real
transparency. Then send the same prompt again, but **replace the whole BACKGROUND line** with:

```text
BACKGROUND: plain solid flat magenta (#FF00FF) filling all empty areas, no shadow on the background, no gradient, no ground.
```

For the fire images (#14, #15, #16), use black instead of magenta:

```text
BACKGROUND: pure solid black (#000000) filling all empty areas, no shadow, no gradient, no ground.
```

I remove the magenta or black in code.

## Where to put them

Put every finished image in **`grace-reels/episodes/never-died/assets/gpt/`** with the exact file name.

- **Easiest:** on GitHub, open the branch `ccr-a41eecd7-s7gufw`, go to that folder, choose
  **Add file → Upload files**, drop the PNGs in, and commit to the same branch.
- **Or:** attach them in our chat and say which number each one is.

Then type **DONE**.

## STYLE BLOCK (starts every prompt)

> Flat 2D paper-cut illustration for a 2.5D animated Bible story. Characters and props: simple bold shapes with a clean, even, dark brown outline (#2B1D12) and rounded joins; matte flat colors with exactly one soft shadow tone per color (far-side arm and leg one shade darker); no gradients, no texture, no noise, no 3D rendering, no realism. Minimal faces: one almond-shaped eye (white with a round dark pupil), a small rounded nose bump on the profile, usually no mouth; hair and beards are flat shapes. Bodies about 5.5 heads tall, tube-like arms ending in rounded mitten hands (no separate fingers), straight legs with simple rounded feet in sandals, robes as clean A-line shapes. Landscapes: a warm low-poly diorama look, with hills, rocks and trees built from large flat-shaded triangular facets, no outlines, and soft warm haze toward the horizon. Light from the upper left; soft shadows fall to the lower right. Warm biblical desert palette: sand #D9B27C, ochre #C98A4B, terracotta #B4643C, olive #8A8F45, sage #A3A36E, dusty blue #6F8FA0, cream #F3ECDF, deep brown #2B1D12. High detail but clean and readable, crisp edges. No text, no letters, no numbers, no watermark, no signature, no logo, no frame, no border.

## CHARACTER BIBLE (repeated word for word in every prompt for that character)

- ELIJAH: an older, strong, weathered prophet with deep tan-brown skin (#8E5634); wild, long, dark-grey hair with lighter grey streaks (#5E5A55, #8F8A84) falling past his shoulders; a thick, bushy dark-grey beard reaching his chest; heavy brows; one almond eye with a dark pupil, a small rounded nose, no mouth. He wears a rough, shaggy garment of fawn camel hair (#B08D62 with darker tufts #8C6B47) that reaches his knees with a jagged furry hem, a wide dark leather belt with a simple round buckle around his waist (#3B2618), and a long, heavy dark-brown cloak (mantle, #4A3020) over his shoulders that reaches his calves; bare, strong forearms and shins; simple worn leather sandals. Broad shoulders, about 5.5 heads tall.
- ELISHA: a younger man of about thirty with light-brown skin (#B27B52); a completely bald, smooth, round head with no hair at all; a short, neat dark-brown beard (#3A2A1F); one almond eye with a dark pupil, a small rounded nose, no mouth. He wears a simple long blue-grey robe (#6D8196) that reaches his ankles, a thin tan rope belt (#C9A46E) tied at the waist, and simple brown sandals. Lean, light build, upright and eager posture, about 5.5 heads tall.
- ENOCH: a calm, gentle middle-aged man with warm medium-brown skin (#A2683F); short, neat grey hair and a short, neat grey beard (#9A948C); one almond eye with a dark pupil, a small rounded nose, no mouth. He wears a long, plain cream robe (#EDE2C8) that reaches his ankles, a soft brown cloth sash tied at the waist with two ends hanging down (#7A4E2D), and simple brown sandals. Slim build, upright and peaceful posture, about 5.5 heads tall.
- MOSES: a very old, dignified man with tan skin (#9C6646); long, flowing white hair and a long white beard reaching his belly (#F1ECE2); one almond eye with a dark pupil, a small rounded nose, no mouth. He wears a deep red-brown outer robe (#8A3B2E) over a cream tunic (#E6D9BD), a brown belt and sandals, and he holds a tall wooden shepherd's staff with a curved top (#6B4A2E). Slightly stooped but strong, about 5.5 heads tall.
- JESUS: a simple, humble figure in the same flat paper-cut style, wearing a long, plain robe that shines pure white (#FFFDF6) with only pale gold-cream shadow tones (#F1E2B8); warm brown skin on the hands and feet; shoulder-length dark-brown hair and a short dark-brown beard; his face is a soft pale-gold shape that shines like the sun, with no facial features drawn; bare feet. No halo, no crown, no realistic face, and no glow drawn around him (the glow is added later in animation). About 5.5 heads tall.
- PETER: a sturdy older fisherman with tan skin (#996240); curly grey-black hair and a full, short grey-black beard (#3F3A36); one almond eye with a dark pupil, a small rounded nose, no mouth; a rust-orange robe (#B65A36) with a tan belt and sandals. Broad build, about 5.5 heads tall.
- JAMES: a strong man in his thirties with olive-brown skin (#8B5A3B); dark-brown hair to the jaw and a full dark-brown beard (#3A281C); one almond eye with a dark pupil, a small rounded nose, no mouth; a dusty green robe (#6E7E4E) with a brown belt and sandals. About 5.5 heads tall.
- JOHN: the youngest, with no beard, light-brown skin (#B98457) and short, wavy black hair (#1F1A17); one almond eye with a dark pupil, a small rounded nose, no mouth; a soft sky-blue robe (#7FA5BF) with a cream belt and sandals. Slim build, about 5.5 heads tall.

## All images at a glance

| # | File | Size | Transparent | Priority | Attach | Used in |
|---|---|---|---|---|---|---|
| 1 | `char_elijah_turnaround.png` | 1536×1024 | yes | MUST | style_ref_1.png, style_ref_3.png | S3–S8 design master, badge face (S1/S6/S10) |
| 2 | `char_elijah_parts.png` | 1536×1024 | yes | MUST | char_elijah_turnaround.png, style_ref_1.png | bone rig: walk (S3), talk, reach (S6) |
| 3 | `char_elijah_poses.png` | 1024×1536 | yes | MUST | char_elijah_turnaround.png, style_ref_1.png | S3 walk/talk, S6 rising, S8 talking |
| 4 | `char_elisha_turnaround.png` | 1536×1024 | yes | MUST | char_elijah_turnaround.png, style_ref_1.png | S3–S7 design master |
| 5 | `char_elisha_parts.png` | 1536×1024 | yes | MUST | char_elisha_turnaround.png, char_elijah_parts.png | bone rig: walk (S3), reach (S6), kneel and pick up (S7) |
| 6 | `char_elisha_poses.png` | 1024×1536 | yes | MUST | char_elisha_turnaround.png, char_elijah_turnaround.png | S3 walk/talk, S6 reach up, S7 cry out, kneel, pick up cloak |
| 7 | `char_enoch_turnaround.png` | 1536×1024 | yes | MUST | char_elijah_turnaround.png, style_ref_1.png | S2 design master, badge face (S2/S10) |
| 8 | `char_enoch_parts.png` | 1536×1024 | yes | MUST | char_enoch_turnaround.png, char_elijah_parts.png | bone rig: walk into the light (S2) |
| 9 | `char_enoch_poses.png` | 1024×1536 | yes | MUST | char_enoch_turnaround.png, char_elijah_turnaround.png | S2 walk, look up, reach toward the light |
| 10 | `char_moses_poses.png` | 1536×1024 | yes | MUST | char_elijah_turnaround.png, style_ref_1.png | S8 mountain |
| 11 | `char_jesus_poses.png` | 1536×1024 | yes | MUST | char_elijah_turnaround.png, style_ref_1.png | S8 mountain (glow added in code) |
| 12 | `char_disciples_poses.png` | 1536×1024 | yes | MUST | char_elijah_turnaround.png, style_ref_3.png | S8 mountain (Peter, James, John) |
| 13 | `prop_elijah_cloak.png` | 1536×1024 | yes | MUST | char_elijah_turnaround.png, style_ref_1.png | S1 hook, S6 falls away, S7 floats down and lands |
| 14 | `fx_chariot.png` | 1536×1024 | yes | MUST | char_elijah_turnaround.png, style_ref_2.png | S4 burst, S6 replay (wheels spin in code) |
| 15 | `fx_horse_gallop.png` | 1536×1024 | yes | MUST | fx_chariot.png, style_ref_2.png | S4 gallop cycle (2 horses), S5 myth picture |
| 16 | `fx_flames.png` | 1536×1024 | yes | MUST | fx_chariot.png | S4 fire bursts, chariot trail, S5 myth picture glow |
| 17 | `bg_enoch_sky.png` | 1024×1536 | no | MUST | style_ref_2.png, style_ref_3.png | S2 sky, S9 sunrise sky (re-graded) |
| 18 | `bg_enoch_far.png` | 1536×1024 | yes (sky area) | MUST | bg_enoch_sky.png, style_ref_2.png | S2 far hills, S9 sunrise (re-graded) |
| 19 | `bg_enoch_mid.png` | 1536×1024 | yes (sky area) | MUST | bg_enoch_sky.png, bg_enoch_far.png, style_ref_2.png | S2 the path Enoch walks on |
| 20 | `bg_jordan_sky.png` | 1024×1536 | no | MUST | style_ref_2.png | S3–S5 sky, S7 (re-graded) |
| 21 | `bg_jordan_far.png` | 1536×1024 | yes (sky area) | MUST | bg_jordan_sky.png, style_ref_2.png | S3–S7 far mountains (storm grade in S6) |
| 22 | `bg_jordan_mid.png` | 1536×1024 | yes (sky area) | MUST | bg_jordan_sky.png, bg_jordan_far.png, style_ref_2.png | S3 walk, S4 chariot, S6 whirlwind ground, S7 Elisha alone |
| 23 | `bg_storm_sky.png` | 1024×1536 | no | MUST | style_ref_2.png | S1 hook, S6 whirlwind sky, S11 loop |
| 24 | `bg_mountain_far.png` | 1536×1024 | yes (sky area) | MUST | style_ref_2.png, style_ref_3.png | S8 cloud sea and far peaks |
| 25 | `bg_mountain_mid.png` | 1536×1024 | yes (sky area) | MUST | bg_mountain_far.png, style_ref_2.png | S8 the summit stage |
| 26 | `fx_whirlwind_1.png` | 1536×1024 | yes | MUST | bg_storm_sky.png, style_ref_2.png | S1 + S6 whirlwind cylinder, back layer |
| 27 | `fx_whirlwind_2.png` | 1536×1024 | yes | MUST | fx_whirlwind_1.png, bg_storm_sky.png | S1 + S6 whirlwind cylinder, middle layer |
| 28 | `fx_myth_painting.png` | 1024×1536 | no | MUST | char_elijah_turnaround.png, fx_chariot.png, fx_horse_gallop.png | S5 the "most people think" picture (aged and framed in code, then stamped with the red X) |
| 29 | `fx_whirlwind_3.png` | 1536×1024 | yes | NICE | fx_whirlwind_2.png, bg_storm_sky.png | S1 + S6 whirlwind cylinder, front layer (code particles if skipped) |
| 30 | `fx_embers_sparks.png` | 1536×1024 | no, pure black | NICE | fx_flames.png | S4 sparks, S6 embers (code particles if skipped) |
| 31 | `fx_light_beam.png` | 1024×1536 | no, pure black | NICE | style_ref_3.png | S2 holy light, S8 mountain light (shader beam if skipped) |
| 32 | `prop_footprints.png` | 1536×1024 | yes | NICE | bg_enoch_mid.png | S2 footprints that stop (drawn in code if skipped) |
| 33 | `bg_storm_clouds.png` | 1536×1024 | yes | NICE | bg_storm_sky.png | S6 cloud layer the whirlwind enters (code fog if skipped) |
| 34 | `bg_mountain_sky.png` | 1024×1536 | no | NICE | bg_mountain_far.png, style_ref_3.png | S8 bright sky (code gradient if skipped) |
| 35 | `bg_near_kit.png` | 1536×1024 | yes | NICE | bg_jordan_mid.png, bg_enoch_mid.png, style_ref_2.png | foreground pieces for parallax in S2, S3, S7, S8 (code-blurred) |

Reuse, so we need fewer images: the S9 sunrise uses the Enoch sky and far hills with a sunrise grade.
The S6 storm ground uses the Jordan layers with a storm grade. Badge faces are cut from the turnarounds.
The cover is rendered from the S6 shot.

## MUST-HAVE prompts (make these first, in order)

### 1. `char_elijah_turnaround.png`

- **Size:** 1536×1024 (landscape 3:2)
- **Transparent:** yes
- **Priority:** MUST-HAVE
- **Attach:** style_ref_1.png, style_ref_3.png
- **Used in:** S3–S8 design master, badge face (S1/S6/S10)

```text
Flat 2D paper-cut illustration for a 2.5D animated Bible story. Characters and props: simple bold shapes with a clean, even, dark brown outline (#2B1D12) and rounded joins; matte flat colors with exactly one soft shadow tone per color (far-side arm and leg one shade darker); no gradients, no texture, no noise, no 3D rendering, no realism. Minimal faces: one almond-shaped eye (white with a round dark pupil), a small rounded nose bump on the profile, usually no mouth; hair and beards are flat shapes. Bodies about 5.5 heads tall, tube-like arms ending in rounded mitten hands (no separate fingers), straight legs with simple rounded feet in sandals, robes as clean A-line shapes. Landscapes: a warm low-poly diorama look, with hills, rocks and trees built from large flat-shaded triangular facets, no outlines, and soft warm haze toward the horizon. Light from the upper left; soft shadows fall to the lower right. Warm biblical desert palette: sand #D9B27C, ochre #C98A4B, terracotta #B4643C, olive #8A8F45, sage #A3A36E, dusty blue #6F8FA0, cream #F3ECDF, deep brown #2B1D12. High detail but clean and readable, crisp edges. No text, no letters, no numbers, no watermark, no signature, no logo, no frame, no border.

ATTACHED: 2 style reference screenshots. Copy only their drawing style (outline, flat colors, minimal faces, proportions, warm light), never their people, animals, trees or scene.

ELIJAH: an older, strong, weathered prophet with deep tan-brown skin (#8E5634); wild, long, dark-grey hair with lighter grey streaks (#5E5A55, #8F8A84) falling past his shoulders; a thick, bushy dark-grey beard reaching his chest; heavy brows; one almond eye with a dark pupil, a small rounded nose, no mouth. He wears a rough, shaggy garment of fawn camel hair (#B08D62 with darker tufts #8C6B47) that reaches his knees with a jagged furry hem, a wide dark leather belt with a simple round buckle around his waist (#3B2618), and a long, heavy dark-brown cloak (mantle, #4A3020) over his shoulders that reaches his calves; bare, strong forearms and shins; simple worn leather sandals. Broad shoulders, about 5.5 heads tall.

IMAGE: a character turnaround sheet of ELIJAH. Three full-body views of the same man in a relaxed, neutral standing pose, arranged left to right with wide empty space between them: (1) side view facing right, (2) three-quarter front view turned toward the right, (3) back view. All three are exactly the same height and scale, with the feet on one shared invisible ground line, and each figure fills about 90% of the image height. The arms hang slightly away from the body so the mitten hands are clearly separate from the clothes. The cloak is clearly visible in all three views.

BACKGROUND: fully transparent (PNG with a real alpha channel). Nothing behind the subject: no ground, no floor, no cast shadow, no scenery, no white or checkerboard pattern.

FORMAT: landscape 3:2 (1536×1024).

AVOID: text, letters, numbers, labels, arrows, guide lines, grid lines, frames, borders; extra fingers, extra arms or legs, mouths, realistic faces, gradients.
```

### 2. `char_elijah_parts.png`

- **Size:** 1536×1024 (landscape 3:2)
- **Transparent:** yes
- **Priority:** MUST-HAVE
- **Attach:** char_elijah_turnaround.png, style_ref_1.png
- **Used in:** bone rig: walk (S3), talk, reach (S6)

```text
Flat 2D paper-cut illustration for a 2.5D animated Bible story. Characters and props: simple bold shapes with a clean, even, dark brown outline (#2B1D12) and rounded joins; matte flat colors with exactly one soft shadow tone per color (far-side arm and leg one shade darker); no gradients, no texture, no noise, no 3D rendering, no realism. Minimal faces: one almond-shaped eye (white with a round dark pupil), a small rounded nose bump on the profile, usually no mouth; hair and beards are flat shapes. Bodies about 5.5 heads tall, tube-like arms ending in rounded mitten hands (no separate fingers), straight legs with simple rounded feet in sandals, robes as clean A-line shapes. Landscapes: a warm low-poly diorama look, with hills, rocks and trees built from large flat-shaded triangular facets, no outlines, and soft warm haze toward the horizon. Light from the upper left; soft shadows fall to the lower right. Warm biblical desert palette: sand #D9B27C, ochre #C98A4B, terracotta #B4643C, olive #8A8F45, sage #A3A36E, dusty blue #6F8FA0, cream #F3ECDF, deep brown #2B1D12. High detail but clean and readable, crisp edges. No text, no letters, no numbers, no watermark, no signature, no logo, no frame, no border.

ATTACHED: our approved ELIJAH character sheet. Keep his face, hair, beard, clothes, colors and proportions exactly the same. Also attached: 1 style reference screenshot. Copy only its drawing style, never its people or scene.

ELIJAH: an older, strong, weathered prophet with deep tan-brown skin (#8E5634); wild, long, dark-grey hair with lighter grey streaks (#5E5A55, #8F8A84) falling past his shoulders; a thick, bushy dark-grey beard reaching his chest; heavy brows; one almond eye with a dark pupil, a small rounded nose, no mouth. He wears a rough, shaggy garment of fawn camel hair (#B08D62 with darker tufts #8C6B47) that reaches his knees with a jagged furry hem, a wide dark leather belt with a simple round buckle around his waist (#3B2618), and a long, heavy dark-brown cloak (mantle, #4A3020) over his shoulders that reaches his calves; bare, strong forearms and shins; simple worn leather sandals. Broad shoulders, about 5.5 heads tall.

IMAGE: an animation parts sheet (a cut-out puppet kit for a 2D bone rig) of ELIJAH in side view facing right, at the same scale and in the same style as the attached ELIJAH character sheet. Every part is a separate flat paper-cut piece, laid out in a tidy grid with clear empty space around each piece; no piece touches or overlaps another: (1) the head in side profile with eye, nose and ear, bald underneath (no hair, no beard), with a short neck stub at the bottom; (2) the long wild hair as one separate piece; (3) the bushy beard as one separate piece; (4) the torso with the hairy garment and the leather belt down to the knee hem, without head, arms or legs; (5) the near upper arm; (6) the far upper arm; (7) the near forearm with mitten hand; (8) the far forearm with mitten hand; (9) the near leg from hip to foot with sandal; (10) the far leg from hip to foot with sandal; (11) the cloak (mantle) as one separate piece, as it hangs from the shoulders in side view. Each limb piece has rounded ends with a little extra overlap area at the joints (neck, shoulder, elbow, hip, knee), so the pieces can rotate and overlap without gaps. The far-side arm and leg are one shade darker. Every piece keeps the same outline and colors. No shadows.

BACKGROUND: fully transparent (PNG with a real alpha channel). Nothing behind the subject: no ground, no floor, no cast shadow, no scenery, no white or checkerboard pattern.

FORMAT: landscape 3:2 (1536×1024).

AVOID: text, letters, numbers, labels, arrows, guide lines, grid lines, frames, borders; extra fingers, extra arms or legs, mouths, realistic faces, gradients.
```

### 3. `char_elijah_poses.png`

- **Size:** 1024×1536 (portrait 2:3)
- **Transparent:** yes
- **Priority:** MUST-HAVE
- **Attach:** char_elijah_turnaround.png, style_ref_1.png
- **Used in:** S3 walk/talk, S6 rising, S8 talking

```text
Flat 2D paper-cut illustration for a 2.5D animated Bible story. Characters and props: simple bold shapes with a clean, even, dark brown outline (#2B1D12) and rounded joins; matte flat colors with exactly one soft shadow tone per color (far-side arm and leg one shade darker); no gradients, no texture, no noise, no 3D rendering, no realism. Minimal faces: one almond-shaped eye (white with a round dark pupil), a small rounded nose bump on the profile, usually no mouth; hair and beards are flat shapes. Bodies about 5.5 heads tall, tube-like arms ending in rounded mitten hands (no separate fingers), straight legs with simple rounded feet in sandals, robes as clean A-line shapes. Landscapes: a warm low-poly diorama look, with hills, rocks and trees built from large flat-shaded triangular facets, no outlines, and soft warm haze toward the horizon. Light from the upper left; soft shadows fall to the lower right. Warm biblical desert palette: sand #D9B27C, ochre #C98A4B, terracotta #B4643C, olive #8A8F45, sage #A3A36E, dusty blue #6F8FA0, cream #F3ECDF, deep brown #2B1D12. High detail but clean and readable, crisp edges. No text, no letters, no numbers, no watermark, no signature, no logo, no frame, no border.

ATTACHED: our approved ELIJAH character sheet. Keep his face, hair, beard, clothes, colors and proportions exactly the same. Also attached: 1 style reference screenshot. Copy only its drawing style, never its people or scene.

ELIJAH: an older, strong, weathered prophet with deep tan-brown skin (#8E5634); wild, long, dark-grey hair with lighter grey streaks (#5E5A55, #8F8A84) falling past his shoulders; a thick, bushy dark-grey beard reaching his chest; heavy brows; one almond eye with a dark pupil, a small rounded nose, no mouth. He wears a rough, shaggy garment of fawn camel hair (#B08D62 with darker tufts #8C6B47) that reaches his knees with a jagged furry hem, a wide dark leather belt with a simple round buckle around his waist (#3B2618), and a long, heavy dark-brown cloak (mantle, #4A3020) over his shoulders that reaches his calves; bare, strong forearms and shins; simple worn leather sandals. Broad shoulders, about 5.5 heads tall.

IMAGE: a poses sheet of ELIJAH, matching the attached ELIJAH character sheet exactly. Six full-body poses of the same man, all facing right and all at the same scale, arranged in 2 rows of 3 with clear empty space between them (no pose touches another): (1) walking with a heavy, strong stride, mid-step, the opposite arm swinging forward; (2) talking and pointing ahead with one arm; (3) standing and looking up at the sky, head tilted back; (4) rising into the air: both arms lifted up and outward, hair, beard and garment blowing upward as if lifted by a strong wind, WITHOUT his cloak, feet off the ground; (5) kneeling on one knee; (6) bending down to pick something up from the ground with one hand. Strong, clear silhouettes; the hands stay rounded mittens.

BACKGROUND: fully transparent (PNG with a real alpha channel). Nothing behind the subject: no ground, no floor, no cast shadow, no scenery, no white or checkerboard pattern.

FORMAT: portrait 2:3 (1024×1536).

AVOID: text, letters, numbers, labels, arrows, guide lines, grid lines, frames, borders; extra fingers, extra arms or legs, mouths, realistic faces, gradients.
```

### 4. `char_elisha_turnaround.png`

- **Size:** 1536×1024 (landscape 3:2)
- **Transparent:** yes
- **Priority:** MUST-HAVE
- **Attach:** char_elijah_turnaround.png, style_ref_1.png
- **Used in:** S3–S7 design master

```text
Flat 2D paper-cut illustration for a 2.5D animated Bible story. Characters and props: simple bold shapes with a clean, even, dark brown outline (#2B1D12) and rounded joins; matte flat colors with exactly one soft shadow tone per color (far-side arm and leg one shade darker); no gradients, no texture, no noise, no 3D rendering, no realism. Minimal faces: one almond-shaped eye (white with a round dark pupil), a small rounded nose bump on the profile, usually no mouth; hair and beards are flat shapes. Bodies about 5.5 heads tall, tube-like arms ending in rounded mitten hands (no separate fingers), straight legs with simple rounded feet in sandals, robes as clean A-line shapes. Landscapes: a warm low-poly diorama look, with hills, rocks and trees built from large flat-shaded triangular facets, no outlines, and soft warm haze toward the horizon. Light from the upper left; soft shadows fall to the lower right. Warm biblical desert palette: sand #D9B27C, ochre #C98A4B, terracotta #B4643C, olive #8A8F45, sage #A3A36E, dusty blue #6F8FA0, cream #F3ECDF, deep brown #2B1D12. High detail but clean and readable, crisp edges. No text, no letters, no numbers, no watermark, no signature, no logo, no frame, no border.

ATTACHED: our approved ELIJAH character sheet. Match its exact drawing style, outline weight, proportions and level of detail, but draw ELISHA as described below, not Elijah. Also attached: 1 style reference screenshot. Copy only its drawing style, never its people or scene.

ELISHA: a younger man of about thirty with light-brown skin (#B27B52); a completely bald, smooth, round head with no hair at all; a short, neat dark-brown beard (#3A2A1F); one almond eye with a dark pupil, a small rounded nose, no mouth. He wears a simple long blue-grey robe (#6D8196) that reaches his ankles, a thin tan rope belt (#C9A46E) tied at the waist, and simple brown sandals. Lean, light build, upright and eager posture, about 5.5 heads tall.

IMAGE: a character turnaround sheet of ELISHA. Three full-body views of the same man in a relaxed, neutral standing pose, arranged left to right with wide empty space between them: (1) side view facing right, (2) three-quarter front view turned toward the right, (3) back view. All three are exactly the same height and scale, with the feet on one shared invisible ground line, and each figure fills about 90% of the image height. The arms hang slightly away from the body so the mitten hands are clearly separate from the clothes.

BACKGROUND: fully transparent (PNG with a real alpha channel). Nothing behind the subject: no ground, no floor, no cast shadow, no scenery, no white or checkerboard pattern.

FORMAT: landscape 3:2 (1536×1024).

AVOID: text, letters, numbers, labels, arrows, guide lines, grid lines, frames, borders; extra fingers, extra arms or legs, mouths, realistic faces, gradients.
```

### 5. `char_elisha_parts.png`

- **Size:** 1536×1024 (landscape 3:2)
- **Transparent:** yes
- **Priority:** MUST-HAVE
- **Attach:** char_elisha_turnaround.png, char_elijah_parts.png
- **Used in:** bone rig: walk (S3), reach (S6), kneel and pick up (S7)

```text
Flat 2D paper-cut illustration for a 2.5D animated Bible story. Characters and props: simple bold shapes with a clean, even, dark brown outline (#2B1D12) and rounded joins; matte flat colors with exactly one soft shadow tone per color (far-side arm and leg one shade darker); no gradients, no texture, no noise, no 3D rendering, no realism. Minimal faces: one almond-shaped eye (white with a round dark pupil), a small rounded nose bump on the profile, usually no mouth; hair and beards are flat shapes. Bodies about 5.5 heads tall, tube-like arms ending in rounded mitten hands (no separate fingers), straight legs with simple rounded feet in sandals, robes as clean A-line shapes. Landscapes: a warm low-poly diorama look, with hills, rocks and trees built from large flat-shaded triangular facets, no outlines, and soft warm haze toward the horizon. Light from the upper left; soft shadows fall to the lower right. Warm biblical desert palette: sand #D9B27C, ochre #C98A4B, terracotta #B4643C, olive #8A8F45, sage #A3A36E, dusty blue #6F8FA0, cream #F3ECDF, deep brown #2B1D12. High detail but clean and readable, crisp edges. No text, no letters, no numbers, no watermark, no signature, no logo, no frame, no border.

ATTACHED: our approved ELISHA character sheet. Keep his face, bald head, beard, clothes, colors and proportions exactly the same. Also attached: the ELIJAH parts sheet as a LAYOUT EXAMPLE only. Use the same kind of pieces, scale and spacing, but draw ELISHA, not Elijah.

ELISHA: a younger man of about thirty with light-brown skin (#B27B52); a completely bald, smooth, round head with no hair at all; a short, neat dark-brown beard (#3A2A1F); one almond eye with a dark pupil, a small rounded nose, no mouth. He wears a simple long blue-grey robe (#6D8196) that reaches his ankles, a thin tan rope belt (#C9A46E) tied at the waist, and simple brown sandals. Lean, light build, upright and eager posture, about 5.5 heads tall.

IMAGE: an animation parts sheet (a cut-out puppet kit for a 2D bone rig) of ELISHA in side view facing right, at the same scale and in the same style as the attached ELISHA character sheet. Every part is a separate flat paper-cut piece, laid out in a tidy grid with clear empty space around each piece; no piece touches or overlaps another: (1) the bald head in side profile with eye, nose and ear and a short neck stub at the bottom, without the beard; (2) the short beard as one separate piece; (3) the torso with the long blue-grey robe and rope belt down to the ankles, without head or arms; (4) the near upper arm with sleeve; (5) the far upper arm with sleeve; (6) the near forearm with mitten hand; (7) the far forearm with mitten hand; (8) the near leg from hip to foot with sandal; (9) the far leg from hip to foot with sandal. Each limb piece has rounded ends with a little extra overlap area at the joints (neck, shoulder, elbow, hip, knee), so the pieces can rotate and overlap without gaps. The far-side arm and leg are one shade darker. Every piece keeps the same outline and colors. No shadows.

BACKGROUND: fully transparent (PNG with a real alpha channel). Nothing behind the subject: no ground, no floor, no cast shadow, no scenery, no white or checkerboard pattern.

FORMAT: landscape 3:2 (1536×1024).

AVOID: text, letters, numbers, labels, arrows, guide lines, grid lines, frames, borders; extra fingers, extra arms or legs, mouths, realistic faces, gradients.
```

### 6. `char_elisha_poses.png`

- **Size:** 1024×1536 (portrait 2:3)
- **Transparent:** yes
- **Priority:** MUST-HAVE
- **Attach:** char_elisha_turnaround.png, char_elijah_turnaround.png
- **Used in:** S3 walk/talk, S6 reach up, S7 cry out, kneel, pick up cloak

```text
Flat 2D paper-cut illustration for a 2.5D animated Bible story. Characters and props: simple bold shapes with a clean, even, dark brown outline (#2B1D12) and rounded joins; matte flat colors with exactly one soft shadow tone per color (far-side arm and leg one shade darker); no gradients, no texture, no noise, no 3D rendering, no realism. Minimal faces: one almond-shaped eye (white with a round dark pupil), a small rounded nose bump on the profile, usually no mouth; hair and beards are flat shapes. Bodies about 5.5 heads tall, tube-like arms ending in rounded mitten hands (no separate fingers), straight legs with simple rounded feet in sandals, robes as clean A-line shapes. Landscapes: a warm low-poly diorama look, with hills, rocks and trees built from large flat-shaded triangular facets, no outlines, and soft warm haze toward the horizon. Light from the upper left; soft shadows fall to the lower right. Warm biblical desert palette: sand #D9B27C, ochre #C98A4B, terracotta #B4643C, olive #8A8F45, sage #A3A36E, dusty blue #6F8FA0, cream #F3ECDF, deep brown #2B1D12. High detail but clean and readable, crisp edges. No text, no letters, no numbers, no watermark, no signature, no logo, no frame, no border.

ATTACHED: our approved ELISHA character sheet. Keep his face, bald head, beard, clothes, colors and proportions exactly the same. Also attached: the approved ELIJAH character sheet as a STYLE MATCH only (same outline weight and level of detail). Do not draw Elijah.

ELISHA: a younger man of about thirty with light-brown skin (#B27B52); a completely bald, smooth, round head with no hair at all; a short, neat dark-brown beard (#3A2A1F); one almond eye with a dark pupil, a small rounded nose, no mouth. He wears a simple long blue-grey robe (#6D8196) that reaches his ankles, a thin tan rope belt (#C9A46E) tied at the waist, and simple brown sandals. Lean, light build, upright and eager posture, about 5.5 heads tall.

IMAGE: a poses sheet of ELISHA, matching the attached ELISHA character sheet exactly. Six full-body poses of the same man, all facing right and all at the same scale, arranged in 2 rows of 3 with clear empty space between them (no pose touches another): (1) walking with a light, quick step, mid-stride; (2) talking with an open-hand gesture toward someone in front of him; (3) looking up at the sky and crying out, head tilted back, one hand raised; (4) reaching up high with both arms; (5) kneeling on both knees with his head bowed in grief; (6) bending down to pick something up from the ground with both hands. Strong, clear silhouettes; the hands stay rounded mittens.

BACKGROUND: fully transparent (PNG with a real alpha channel). Nothing behind the subject: no ground, no floor, no cast shadow, no scenery, no white or checkerboard pattern.

FORMAT: portrait 2:3 (1024×1536).

AVOID: text, letters, numbers, labels, arrows, guide lines, grid lines, frames, borders; extra fingers, extra arms or legs, mouths, realistic faces, gradients.
```

### 7. `char_enoch_turnaround.png`

- **Size:** 1536×1024 (landscape 3:2)
- **Transparent:** yes
- **Priority:** MUST-HAVE
- **Attach:** char_elijah_turnaround.png, style_ref_1.png
- **Used in:** S2 design master, badge face (S2/S10)

```text
Flat 2D paper-cut illustration for a 2.5D animated Bible story. Characters and props: simple bold shapes with a clean, even, dark brown outline (#2B1D12) and rounded joins; matte flat colors with exactly one soft shadow tone per color (far-side arm and leg one shade darker); no gradients, no texture, no noise, no 3D rendering, no realism. Minimal faces: one almond-shaped eye (white with a round dark pupil), a small rounded nose bump on the profile, usually no mouth; hair and beards are flat shapes. Bodies about 5.5 heads tall, tube-like arms ending in rounded mitten hands (no separate fingers), straight legs with simple rounded feet in sandals, robes as clean A-line shapes. Landscapes: a warm low-poly diorama look, with hills, rocks and trees built from large flat-shaded triangular facets, no outlines, and soft warm haze toward the horizon. Light from the upper left; soft shadows fall to the lower right. Warm biblical desert palette: sand #D9B27C, ochre #C98A4B, terracotta #B4643C, olive #8A8F45, sage #A3A36E, dusty blue #6F8FA0, cream #F3ECDF, deep brown #2B1D12. High detail but clean and readable, crisp edges. No text, no letters, no numbers, no watermark, no signature, no logo, no frame, no border.

ATTACHED: our approved ELIJAH character sheet. Match its exact drawing style, outline weight, proportions and level of detail, but draw ENOCH as described below, not Elijah. Also attached: 1 style reference screenshot. Copy only its drawing style, never its people or scene.

ENOCH: a calm, gentle middle-aged man with warm medium-brown skin (#A2683F); short, neat grey hair and a short, neat grey beard (#9A948C); one almond eye with a dark pupil, a small rounded nose, no mouth. He wears a long, plain cream robe (#EDE2C8) that reaches his ankles, a soft brown cloth sash tied at the waist with two ends hanging down (#7A4E2D), and simple brown sandals. Slim build, upright and peaceful posture, about 5.5 heads tall.

IMAGE: a character turnaround sheet of ENOCH. Three full-body views of the same man in a relaxed, neutral standing pose, arranged left to right with wide empty space between them: (1) side view facing right, (2) three-quarter front view turned toward the right, (3) back view. All three are exactly the same height and scale, with the feet on one shared invisible ground line, and each figure fills about 90% of the image height. The arms hang slightly away from the body so the mitten hands are clearly separate from the clothes.

BACKGROUND: fully transparent (PNG with a real alpha channel). Nothing behind the subject: no ground, no floor, no cast shadow, no scenery, no white or checkerboard pattern.

FORMAT: landscape 3:2 (1536×1024).

AVOID: text, letters, numbers, labels, arrows, guide lines, grid lines, frames, borders; extra fingers, extra arms or legs, mouths, realistic faces, gradients.
```

### 8. `char_enoch_parts.png`

- **Size:** 1536×1024 (landscape 3:2)
- **Transparent:** yes
- **Priority:** MUST-HAVE
- **Attach:** char_enoch_turnaround.png, char_elijah_parts.png
- **Used in:** bone rig: walk into the light (S2)

```text
Flat 2D paper-cut illustration for a 2.5D animated Bible story. Characters and props: simple bold shapes with a clean, even, dark brown outline (#2B1D12) and rounded joins; matte flat colors with exactly one soft shadow tone per color (far-side arm and leg one shade darker); no gradients, no texture, no noise, no 3D rendering, no realism. Minimal faces: one almond-shaped eye (white with a round dark pupil), a small rounded nose bump on the profile, usually no mouth; hair and beards are flat shapes. Bodies about 5.5 heads tall, tube-like arms ending in rounded mitten hands (no separate fingers), straight legs with simple rounded feet in sandals, robes as clean A-line shapes. Landscapes: a warm low-poly diorama look, with hills, rocks and trees built from large flat-shaded triangular facets, no outlines, and soft warm haze toward the horizon. Light from the upper left; soft shadows fall to the lower right. Warm biblical desert palette: sand #D9B27C, ochre #C98A4B, terracotta #B4643C, olive #8A8F45, sage #A3A36E, dusty blue #6F8FA0, cream #F3ECDF, deep brown #2B1D12. High detail but clean and readable, crisp edges. No text, no letters, no numbers, no watermark, no signature, no logo, no frame, no border.

ATTACHED: our approved ENOCH character sheet. Keep his face, hair, beard, clothes, colors and proportions exactly the same. Also attached: the ELIJAH parts sheet as a LAYOUT EXAMPLE only. Use the same kind of pieces, scale and spacing, but draw ENOCH, not Elijah.

ENOCH: a calm, gentle middle-aged man with warm medium-brown skin (#A2683F); short, neat grey hair and a short, neat grey beard (#9A948C); one almond eye with a dark pupil, a small rounded nose, no mouth. He wears a long, plain cream robe (#EDE2C8) that reaches his ankles, a soft brown cloth sash tied at the waist with two ends hanging down (#7A4E2D), and simple brown sandals. Slim build, upright and peaceful posture, about 5.5 heads tall.

IMAGE: an animation parts sheet (a cut-out puppet kit for a 2D bone rig) of ENOCH in side view facing right, at the same scale and in the same style as the attached ENOCH character sheet. Every part is a separate flat paper-cut piece, laid out in a tidy grid with clear empty space around each piece; no piece touches or overlaps another: (1) the head in side profile with eye, nose, ear and short grey hair, with a short neck stub at the bottom, without the beard; (2) the short grey beard as one separate piece; (3) the torso with the long cream robe and brown sash down to the ankles, without head or arms; (4) the two hanging sash ends as one separate piece; (5) the near upper arm with sleeve; (6) the far upper arm with sleeve; (7) the near forearm with mitten hand; (8) the far forearm with mitten hand; (9) the near leg from hip to foot with sandal; (10) the far leg from hip to foot with sandal. Each limb piece has rounded ends with a little extra overlap area at the joints (neck, shoulder, elbow, hip, knee), so the pieces can rotate and overlap without gaps. The far-side arm and leg are one shade darker. Every piece keeps the same outline and colors. No shadows.

BACKGROUND: fully transparent (PNG with a real alpha channel). Nothing behind the subject: no ground, no floor, no cast shadow, no scenery, no white or checkerboard pattern.

FORMAT: landscape 3:2 (1536×1024).

AVOID: text, letters, numbers, labels, arrows, guide lines, grid lines, frames, borders; extra fingers, extra arms or legs, mouths, realistic faces, gradients.
```

### 9. `char_enoch_poses.png`

- **Size:** 1024×1536 (portrait 2:3)
- **Transparent:** yes
- **Priority:** MUST-HAVE
- **Attach:** char_enoch_turnaround.png, char_elijah_turnaround.png
- **Used in:** S2 walk, look up, reach toward the light

```text
Flat 2D paper-cut illustration for a 2.5D animated Bible story. Characters and props: simple bold shapes with a clean, even, dark brown outline (#2B1D12) and rounded joins; matte flat colors with exactly one soft shadow tone per color (far-side arm and leg one shade darker); no gradients, no texture, no noise, no 3D rendering, no realism. Minimal faces: one almond-shaped eye (white with a round dark pupil), a small rounded nose bump on the profile, usually no mouth; hair and beards are flat shapes. Bodies about 5.5 heads tall, tube-like arms ending in rounded mitten hands (no separate fingers), straight legs with simple rounded feet in sandals, robes as clean A-line shapes. Landscapes: a warm low-poly diorama look, with hills, rocks and trees built from large flat-shaded triangular facets, no outlines, and soft warm haze toward the horizon. Light from the upper left; soft shadows fall to the lower right. Warm biblical desert palette: sand #D9B27C, ochre #C98A4B, terracotta #B4643C, olive #8A8F45, sage #A3A36E, dusty blue #6F8FA0, cream #F3ECDF, deep brown #2B1D12. High detail but clean and readable, crisp edges. No text, no letters, no numbers, no watermark, no signature, no logo, no frame, no border.

ATTACHED: our approved ENOCH character sheet. Keep his face, hair, beard, clothes, colors and proportions exactly the same. Also attached: the approved ELIJAH character sheet as a STYLE MATCH only (same outline weight and level of detail). Do not draw Elijah.

ENOCH: a calm, gentle middle-aged man with warm medium-brown skin (#A2683F); short, neat grey hair and a short, neat grey beard (#9A948C); one almond eye with a dark pupil, a small rounded nose, no mouth. He wears a long, plain cream robe (#EDE2C8) that reaches his ankles, a soft brown cloth sash tied at the waist with two ends hanging down (#7A4E2D), and simple brown sandals. Slim build, upright and peaceful posture, about 5.5 heads tall.

IMAGE: a poses sheet of ENOCH, matching the attached ENOCH character sheet exactly. Six full-body poses of the same man, all facing right and all at the same scale, arranged in 2 rows of 3 with clear empty space between them (no pose touches another): (1) walking calmly, mid-step; (2) gently pointing ahead; (3) standing and looking up with a peaceful face, head lifted; (4) reaching up with both open hands toward the sky; (5) kneeling in prayer with his hands together; (6) bending down to pick something up from the ground with one hand. Strong, clear silhouettes; the hands stay rounded mittens.

BACKGROUND: fully transparent (PNG with a real alpha channel). Nothing behind the subject: no ground, no floor, no cast shadow, no scenery, no white or checkerboard pattern.

FORMAT: portrait 2:3 (1024×1536).

AVOID: text, letters, numbers, labels, arrows, guide lines, grid lines, frames, borders; extra fingers, extra arms or legs, mouths, realistic faces, gradients.
```

### 10. `char_moses_poses.png`

- **Size:** 1536×1024 (landscape 3:2)
- **Transparent:** yes
- **Priority:** MUST-HAVE
- **Attach:** char_elijah_turnaround.png, style_ref_1.png
- **Used in:** S8 mountain

```text
Flat 2D paper-cut illustration for a 2.5D animated Bible story. Characters and props: simple bold shapes with a clean, even, dark brown outline (#2B1D12) and rounded joins; matte flat colors with exactly one soft shadow tone per color (far-side arm and leg one shade darker); no gradients, no texture, no noise, no 3D rendering, no realism. Minimal faces: one almond-shaped eye (white with a round dark pupil), a small rounded nose bump on the profile, usually no mouth; hair and beards are flat shapes. Bodies about 5.5 heads tall, tube-like arms ending in rounded mitten hands (no separate fingers), straight legs with simple rounded feet in sandals, robes as clean A-line shapes. Landscapes: a warm low-poly diorama look, with hills, rocks and trees built from large flat-shaded triangular facets, no outlines, and soft warm haze toward the horizon. Light from the upper left; soft shadows fall to the lower right. Warm biblical desert palette: sand #D9B27C, ochre #C98A4B, terracotta #B4643C, olive #8A8F45, sage #A3A36E, dusty blue #6F8FA0, cream #F3ECDF, deep brown #2B1D12. High detail but clean and readable, crisp edges. No text, no letters, no numbers, no watermark, no signature, no logo, no frame, no border.

ATTACHED: our approved ELIJAH character sheet. Match its exact drawing style, outline weight, proportions and level of detail, but draw MOSES as described below, not Elijah. Also attached: 1 style reference screenshot. Copy only its drawing style, never its people or scene.

MOSES: a very old, dignified man with tan skin (#9C6646); long, flowing white hair and a long white beard reaching his belly (#F1ECE2); one almond eye with a dark pupil, a small rounded nose, no mouth. He wears a deep red-brown outer robe (#8A3B2E) over a cream tunic (#E6D9BD), a brown belt and sandals, and he holds a tall wooden shepherd's staff with a curved top (#6B4A2E). Slightly stooped but strong, about 5.5 heads tall.

IMAGE: three full-body poses of MOSES side by side with wide empty space between them, all at the same scale, feet on one shared invisible ground line, each figure filling about 90% of the image height: (1) side view facing right, standing, holding the staff in his far hand, his near hand raised gently as he talks; (2) three-quarter view turned toward the right, both hands resting on the staff; (3) side view facing right, head bowed slightly, one hand on his chest, the staff in the other hand.

BACKGROUND: fully transparent (PNG with a real alpha channel). Nothing behind the subject: no ground, no floor, no cast shadow, no scenery, no white or checkerboard pattern.

FORMAT: landscape 3:2 (1536×1024).

AVOID: text, letters, numbers, labels, arrows, guide lines, grid lines, frames, borders; extra fingers, extra arms or legs, mouths, realistic faces, gradients.
```

### 11. `char_jesus_poses.png`

- **Size:** 1536×1024 (landscape 3:2)
- **Transparent:** yes
- **Priority:** MUST-HAVE
- **Attach:** char_elijah_turnaround.png, style_ref_1.png
- **Used in:** S8 mountain (glow added in code)

```text
Flat 2D paper-cut illustration for a 2.5D animated Bible story. Characters and props: simple bold shapes with a clean, even, dark brown outline (#2B1D12) and rounded joins; matte flat colors with exactly one soft shadow tone per color (far-side arm and leg one shade darker); no gradients, no texture, no noise, no 3D rendering, no realism. Minimal faces: one almond-shaped eye (white with a round dark pupil), a small rounded nose bump on the profile, usually no mouth; hair and beards are flat shapes. Bodies about 5.5 heads tall, tube-like arms ending in rounded mitten hands (no separate fingers), straight legs with simple rounded feet in sandals, robes as clean A-line shapes. Landscapes: a warm low-poly diorama look, with hills, rocks and trees built from large flat-shaded triangular facets, no outlines, and soft warm haze toward the horizon. Light from the upper left; soft shadows fall to the lower right. Warm biblical desert palette: sand #D9B27C, ochre #C98A4B, terracotta #B4643C, olive #8A8F45, sage #A3A36E, dusty blue #6F8FA0, cream #F3ECDF, deep brown #2B1D12. High detail but clean and readable, crisp edges. No text, no letters, no numbers, no watermark, no signature, no logo, no frame, no border.

ATTACHED: our approved ELIJAH character sheet. Match its exact drawing style, outline weight, proportions and level of detail, but draw JESUS as described below, not Elijah. Also attached: 1 style reference screenshot. Copy only its drawing style, never its people or scene.

JESUS: a simple, humble figure in the same flat paper-cut style, wearing a long, plain robe that shines pure white (#FFFDF6) with only pale gold-cream shadow tones (#F1E2B8); warm brown skin on the hands and feet; shoulder-length dark-brown hair and a short dark-brown beard; his face is a soft pale-gold shape that shines like the sun, with no facial features drawn; bare feet. No halo, no crown, no realistic face, and no glow drawn around him (the glow is added later in animation). About 5.5 heads tall.

IMAGE: three full-body poses of JESUS side by side with wide empty space between them, all at the same scale, feet on one shared invisible ground line, each figure filling about 90% of the image height: (1) front view, standing still and calm, arms relaxed and slightly open with palms forward; (2) three-quarter view turned toward the right, one hand gently raised as he speaks; (3) side view facing right, standing with his hands together. Simple, reverent and peaceful; his robe is the brightest thing in the image.

BACKGROUND: fully transparent (PNG with a real alpha channel). Nothing behind the subject: no ground, no floor, no cast shadow, no scenery, no white or checkerboard pattern.

FORMAT: landscape 3:2 (1536×1024).

AVOID: text, letters, numbers, halo, crown, glow, rays, realistic face, facial features, extra fingers, frames, borders.
```

### 12. `char_disciples_poses.png`

- **Size:** 1536×1024 (landscape 3:2)
- **Transparent:** yes
- **Priority:** MUST-HAVE
- **Attach:** char_elijah_turnaround.png, style_ref_3.png
- **Used in:** S8 mountain (Peter, James, John)

```text
Flat 2D paper-cut illustration for a 2.5D animated Bible story. Characters and props: simple bold shapes with a clean, even, dark brown outline (#2B1D12) and rounded joins; matte flat colors with exactly one soft shadow tone per color (far-side arm and leg one shade darker); no gradients, no texture, no noise, no 3D rendering, no realism. Minimal faces: one almond-shaped eye (white with a round dark pupil), a small rounded nose bump on the profile, usually no mouth; hair and beards are flat shapes. Bodies about 5.5 heads tall, tube-like arms ending in rounded mitten hands (no separate fingers), straight legs with simple rounded feet in sandals, robes as clean A-line shapes. Landscapes: a warm low-poly diorama look, with hills, rocks and trees built from large flat-shaded triangular facets, no outlines, and soft warm haze toward the horizon. Light from the upper left; soft shadows fall to the lower right. Warm biblical desert palette: sand #D9B27C, ochre #C98A4B, terracotta #B4643C, olive #8A8F45, sage #A3A36E, dusty blue #6F8FA0, cream #F3ECDF, deep brown #2B1D12. High detail but clean and readable, crisp edges. No text, no letters, no numbers, no watermark, no signature, no logo, no frame, no border.

ATTACHED: our approved ELIJAH character sheet. Match its exact drawing style, outline weight, proportions and level of detail, but draw PETER, JAMES and JOHN as described below, not Elijah. Also attached: 1 style reference screenshot. Copy only its drawing style, never its people or scene.

PETER: a sturdy older fisherman with tan skin (#996240); curly grey-black hair and a full, short grey-black beard (#3F3A36); one almond eye with a dark pupil, a small rounded nose, no mouth; a rust-orange robe (#B65A36) with a tan belt and sandals. Broad build, about 5.5 heads tall.

JAMES: a strong man in his thirties with olive-brown skin (#8B5A3B); dark-brown hair to the jaw and a full dark-brown beard (#3A281C); one almond eye with a dark pupil, a small rounded nose, no mouth; a dusty green robe (#6E7E4E) with a brown belt and sandals. About 5.5 heads tall.

JOHN: the youngest, with no beard, light-brown skin (#B98457) and short, wavy black hair (#1F1A17); one almond eye with a dark pupil, a small rounded nose, no mouth; a soft sky-blue robe (#7FA5BF) with a cream belt and sandals. Slim build, about 5.5 heads tall.

IMAGE: six full-body figures in two rows with clear empty space between them, all at the same scale and all facing right. Top row, left to right: PETER, JAMES and JOHN, each kneeling on one knee with one arm raised to shield his eyes from a very bright light in front of him. Bottom row, left to right: PETER, JAMES and JOHN again, each fallen forward on his knees with his face to the ground and his hands flat on the ground, afraid. Each disciple must look the same in both rows.

BACKGROUND: fully transparent (PNG with a real alpha channel). Nothing behind the subject: no ground, no floor, no cast shadow, no scenery, no white or checkerboard pattern.

FORMAT: landscape 3:2 (1536×1024).

AVOID: text, letters, numbers, labels, arrows, guide lines, grid lines, frames, borders; extra fingers, extra arms or legs, mouths, realistic faces, gradients.
```

### 13. `prop_elijah_cloak.png`

- **Size:** 1536×1024 (landscape 3:2)
- **Transparent:** yes
- **Priority:** MUST-HAVE
- **Attach:** char_elijah_turnaround.png, style_ref_1.png
- **Used in:** S1 hook, S6 falls away, S7 floats down and lands

```text
Flat 2D paper-cut illustration for a 2.5D animated Bible story. Characters and props: simple bold shapes with a clean, even, dark brown outline (#2B1D12) and rounded joins; matte flat colors with exactly one soft shadow tone per color (far-side arm and leg one shade darker); no gradients, no texture, no noise, no 3D rendering, no realism. Minimal faces: one almond-shaped eye (white with a round dark pupil), a small rounded nose bump on the profile, usually no mouth; hair and beards are flat shapes. Bodies about 5.5 heads tall, tube-like arms ending in rounded mitten hands (no separate fingers), straight legs with simple rounded feet in sandals, robes as clean A-line shapes. Landscapes: a warm low-poly diorama look, with hills, rocks and trees built from large flat-shaded triangular facets, no outlines, and soft warm haze toward the horizon. Light from the upper left; soft shadows fall to the lower right. Warm biblical desert palette: sand #D9B27C, ochre #C98A4B, terracotta #B4643C, olive #8A8F45, sage #A3A36E, dusty blue #6F8FA0, cream #F3ECDF, deep brown #2B1D12. High detail but clean and readable, crisp edges. No text, no letters, no numbers, no watermark, no signature, no logo, no frame, no border.

ATTACHED: our approved ELIJAH character sheet. The cloak must match his cloak exactly (color, length, outline). Also attached: 1 style reference screenshot. Copy only its drawing style, never its people or scene.

IMAGE: ELIJAH's cloak (mantle) on its own, with no person: a long, heavy, dark-brown wool cloak (#4A3020) with one darker shadow tone (#35211A) and the same dark brown outline. Show three separate states side by side with wide empty space between them, each about the same size: (1) fully open and spread out in mid-air, gently billowing, as it falls; (2) half-folded and fluttering, twisting in the wind; (3) lying crumpled on the ground in soft folds.

BACKGROUND: fully transparent (PNG with a real alpha channel). Nothing behind the subject: no ground, no floor, no cast shadow, no scenery, no white or checkerboard pattern.

FORMAT: landscape 3:2 (1536×1024).

AVOID: text, letters, numbers, people, hands, hooks, hangers, frames, borders.
```

### 14. `fx_chariot.png`

- **Size:** 1536×1024 (landscape 3:2)
- **Transparent:** yes
- **Priority:** MUST-HAVE
- **Attach:** char_elijah_turnaround.png, style_ref_2.png
- **Used in:** S4 burst, S6 replay (wheels spin in code)

```text
Flat 2D paper-cut illustration for a 2.5D animated Bible story. Characters and props: simple bold shapes with a clean, even, dark brown outline (#2B1D12) and rounded joins; matte flat colors with exactly one soft shadow tone per color (far-side arm and leg one shade darker); no gradients, no texture, no noise, no 3D rendering, no realism. Minimal faces: one almond-shaped eye (white with a round dark pupil), a small rounded nose bump on the profile, usually no mouth; hair and beards are flat shapes. Bodies about 5.5 heads tall, tube-like arms ending in rounded mitten hands (no separate fingers), straight legs with simple rounded feet in sandals, robes as clean A-line shapes. Landscapes: a warm low-poly diorama look, with hills, rocks and trees built from large flat-shaded triangular facets, no outlines, and soft warm haze toward the horizon. Light from the upper left; soft shadows fall to the lower right. Warm biblical desert palette: sand #D9B27C, ochre #C98A4B, terracotta #B4643C, olive #8A8F45, sage #A3A36E, dusty blue #6F8FA0, cream #F3ECDF, deep brown #2B1D12. High detail but clean and readable, crisp edges. No text, no letters, no numbers, no watermark, no signature, no logo, no frame, no border.

ATTACHED: our approved ELIJAH character sheet and 1 style reference screenshot. Match their flat paper-cut style and level of detail; do not draw any person.

IMAGE: the CHARIOT OF FIRE from 2 Kings 2:11: an ancient two-wheeled chariot made entirely of living fire, side view facing right. It is built from layered flat paper-cut flame shapes: a pale-yellow core (#FFE7A0), a golden-orange body (#F2A23A) and deep red-orange tips (#C8452B). Fire shapes have NO dark outline; their edges are crisp layered tones. It has a curved front rail and a long pole reaching forward to the right (where the horses are harnessed). On the left side of the image, draw the chariot body with NO wheel attached. On the right side, draw ONE separate wheel on its own, with empty space between the two. The wheel is a perfect circle seen flat from the side (a ring of fire with six flame spokes and a glowing hub), about as tall as the chariot body. Small flame tongues trail backward (to the left), as if racing forward. No rider, no horses.

BACKGROUND: fully transparent (PNG with a real alpha channel). Nothing behind the subject: no ground, no floor, no cast shadow, no scenery, no white or checkerboard pattern.

FORMAT: landscape 3:2 (1536×1024).

AVOID: text, letters, numbers, people, riders, realistic fire, smoke, photo effects, frames, borders.
```

### 15. `fx_horse_gallop.png`

- **Size:** 1536×1024 (landscape 3:2)
- **Transparent:** yes
- **Priority:** MUST-HAVE
- **Attach:** fx_chariot.png, style_ref_2.png
- **Used in:** S4 gallop cycle (2 horses), S5 myth picture

```text
Flat 2D paper-cut illustration for a 2.5D animated Bible story. Characters and props: simple bold shapes with a clean, even, dark brown outline (#2B1D12) and rounded joins; matte flat colors with exactly one soft shadow tone per color (far-side arm and leg one shade darker); no gradients, no texture, no noise, no 3D rendering, no realism. Minimal faces: one almond-shaped eye (white with a round dark pupil), a small rounded nose bump on the profile, usually no mouth; hair and beards are flat shapes. Bodies about 5.5 heads tall, tube-like arms ending in rounded mitten hands (no separate fingers), straight legs with simple rounded feet in sandals, robes as clean A-line shapes. Landscapes: a warm low-poly diorama look, with hills, rocks and trees built from large flat-shaded triangular facets, no outlines, and soft warm haze toward the horizon. Light from the upper left; soft shadows fall to the lower right. Warm biblical desert palette: sand #D9B27C, ochre #C98A4B, terracotta #B4643C, olive #8A8F45, sage #A3A36E, dusty blue #6F8FA0, cream #F3ECDF, deep brown #2B1D12. High detail but clean and readable, crisp edges. No text, no letters, no numbers, no watermark, no signature, no logo, no frame, no border.

ATTACHED: our approved chariot of fire. Match its exact fire colors and paper-cut flame style. Also attached: 1 style reference screenshot. Copy only its drawing style, never its people or scene.

IMAGE: a 4-frame gallop cycle of one HORSE OF FIRE, side view facing right: the same horse in four poses arranged in a 2×2 grid with clear empty space between them, all the same size: (1) top left, reaching: front legs stretched forward, hind legs stretched back; (2) top right, gathering: all four legs bunched under the body; (3) bottom left, pushing off: hind legs pushing, front legs lifting high; (4) bottom right, flying: all four hooves off the ground, legs tucked. The horse is a strong, clear horse silhouette built from layered flat paper-cut flames (pale-yellow core #FFE7A0, golden-orange body #F2A23A, deep red-orange tips #C8452B, no dark outline), with a long streaming flame mane and tail blowing backward and a simple golden harness strap across the chest.

BACKGROUND: fully transparent (PNG with a real alpha channel). Nothing behind the subject: no ground, no floor, no cast shadow, no scenery, no white or checkerboard pattern.

FORMAT: landscape 3:2 (1536×1024).

AVOID: text, letters, numbers, riders, chariot, realistic fire, smoke, extra legs (each horse has exactly four legs), frames, borders.
```

### 16. `fx_flames.png`

- **Size:** 1536×1024 (landscape 3:2)
- **Transparent:** yes
- **Priority:** MUST-HAVE
- **Attach:** fx_chariot.png
- **Used in:** S4 fire bursts, chariot trail, S5 myth picture glow

```text
Flat 2D paper-cut illustration for a 2.5D animated Bible story. Characters and props: simple bold shapes with a clean, even, dark brown outline (#2B1D12) and rounded joins; matte flat colors with exactly one soft shadow tone per color (far-side arm and leg one shade darker); no gradients, no texture, no noise, no 3D rendering, no realism. Minimal faces: one almond-shaped eye (white with a round dark pupil), a small rounded nose bump on the profile, usually no mouth; hair and beards are flat shapes. Bodies about 5.5 heads tall, tube-like arms ending in rounded mitten hands (no separate fingers), straight legs with simple rounded feet in sandals, robes as clean A-line shapes. Landscapes: a warm low-poly diorama look, with hills, rocks and trees built from large flat-shaded triangular facets, no outlines, and soft warm haze toward the horizon. Light from the upper left; soft shadows fall to the lower right. Warm biblical desert palette: sand #D9B27C, ochre #C98A4B, terracotta #B4643C, olive #8A8F45, sage #A3A36E, dusty blue #6F8FA0, cream #F3ECDF, deep brown #2B1D12. High detail but clean and readable, crisp edges. No text, no letters, no numbers, no watermark, no signature, no logo, no frame, no border.

ATTACHED: our approved chariot of fire. Match its exact fire colors and paper-cut flame style.

IMAGE: five separate flame shapes in one row with wide empty space between them, all standing on the same baseline: (1) a tall thin flame; (2) a medium flame with two tongues; (3) a wide low flame; (4) a flickering flame splitting into three tongues; (5) a small round flame. Each one is layered flat paper-cut fire (pale-yellow core #FFE7A0, golden-orange middle #F2A23A, deep red-orange outer edge #C8452B) with no dark outline, crisp edges, and a slight upward curl as if moving.

BACKGROUND: fully transparent (PNG with a real alpha channel). Nothing behind the subject: no ground, no floor, no cast shadow, no scenery, no white or checkerboard pattern.

FORMAT: landscape 3:2 (1536×1024).

AVOID: text, letters, numbers, realistic fire, smoke, embers, logs, candles, frames, borders.
```

### 17. `bg_enoch_sky.png`

- **Size:** 1024×1536 (portrait 2:3)
- **Transparent:** no
- **Priority:** MUST-HAVE
- **Attach:** style_ref_2.png, style_ref_3.png
- **Used in:** S2 sky, S9 sunrise sky (re-graded)

```text
Flat 2D paper-cut illustration for a 2.5D animated Bible story. Characters and props: simple bold shapes with a clean, even, dark brown outline (#2B1D12) and rounded joins; matte flat colors with exactly one soft shadow tone per color (far-side arm and leg one shade darker); no gradients, no texture, no noise, no 3D rendering, no realism. Minimal faces: one almond-shaped eye (white with a round dark pupil), a small rounded nose bump on the profile, usually no mouth; hair and beards are flat shapes. Bodies about 5.5 heads tall, tube-like arms ending in rounded mitten hands (no separate fingers), straight legs with simple rounded feet in sandals, robes as clean A-line shapes. Landscapes: a warm low-poly diorama look, with hills, rocks and trees built from large flat-shaded triangular facets, no outlines, and soft warm haze toward the horizon. Light from the upper left; soft shadows fall to the lower right. Warm biblical desert palette: sand #D9B27C, ochre #C98A4B, terracotta #B4643C, olive #8A8F45, sage #A3A36E, dusty blue #6F8FA0, cream #F3ECDF, deep brown #2B1D12. High detail but clean and readable, crisp edges. No text, no letters, no numbers, no watermark, no signature, no logo, no frame, no border.

ATTACHED: 2 style reference screenshots. Copy only their warm light, haze, low-poly look and level of detail, never their scene.

IMAGE: the SKY layer for a golden-hour hill scene (Enoch walking with God). A warm golden-hour sky that fills the whole image: bright warm gold near the bottom (the horizon) fading up through soft peach and apricot to a gentle dusty rose-lilac at the very top. A low, soft sun disc on the left side in the lower third. A few large, calm, low-poly faceted clouds catching gold light. Peaceful and holy. Sky only: no ground, no hills, no birds.

BACKGROUND: a complete, opaque picture that fills the whole image (no transparency).

FORMAT: portrait 2:3 (1024×1536).

AVOID: text, letters, numbers, ground, hills, trees, people, birds, sun rays drawn as lines, frames, borders.
```

### 18. `bg_enoch_far.png`

- **Size:** 1536×1024 (landscape 3:2)
- **Transparent:** yes (sky area)
- **Priority:** MUST-HAVE
- **Attach:** bg_enoch_sky.png, style_ref_2.png
- **Used in:** S2 far hills, S9 sunrise (re-graded)

```text
Flat 2D paper-cut illustration for a 2.5D animated Bible story. Characters and props: simple bold shapes with a clean, even, dark brown outline (#2B1D12) and rounded joins; matte flat colors with exactly one soft shadow tone per color (far-side arm and leg one shade darker); no gradients, no texture, no noise, no 3D rendering, no realism. Minimal faces: one almond-shaped eye (white with a round dark pupil), a small rounded nose bump on the profile, usually no mouth; hair and beards are flat shapes. Bodies about 5.5 heads tall, tube-like arms ending in rounded mitten hands (no separate fingers), straight legs with simple rounded feet in sandals, robes as clean A-line shapes. Landscapes: a warm low-poly diorama look, with hills, rocks and trees built from large flat-shaded triangular facets, no outlines, and soft warm haze toward the horizon. Light from the upper left; soft shadows fall to the lower right. Warm biblical desert palette: sand #D9B27C, ochre #C98A4B, terracotta #B4643C, olive #8A8F45, sage #A3A36E, dusty blue #6F8FA0, cream #F3ECDF, deep brown #2B1D12. High detail but clean and readable, crisp edges. No text, no letters, no numbers, no watermark, no signature, no logo, no frame, no border.

ATTACHED: the approved sky of this same scene. Match its light, colors, haze and level of detail exactly. Also attached: 1 style reference screenshot. Copy only its drawing style, never its people or scene.

IMAGE: the FAR layer of the golden-hour hill scene: a long row of distant, rolling low-poly hills across the lower half of the image, softly faceted, in hazy peach, dusty lilac and pale ochre (low contrast, as if seen through warm haze), lit from the left by a low golden sun. The hills run across the full width with no gaps, and the left and right ends are at a similar height.

BACKGROUND: everything above the land (the whole sky area) is fully transparent (PNG with a real alpha channel): no sky color, no white, no checkerboard pattern.

FORMAT: landscape 3:2 (1536×1024).

AVOID: text, letters, numbers, people, animals, birds, buildings, sky, sun, frames, borders.
```

### 19. `bg_enoch_mid.png`

- **Size:** 1536×1024 (landscape 3:2)
- **Transparent:** yes (sky area)
- **Priority:** MUST-HAVE
- **Attach:** bg_enoch_sky.png, bg_enoch_far.png, style_ref_2.png
- **Used in:** S2 the path Enoch walks on

```text
Flat 2D paper-cut illustration for a 2.5D animated Bible story. Characters and props: simple bold shapes with a clean, even, dark brown outline (#2B1D12) and rounded joins; matte flat colors with exactly one soft shadow tone per color (far-side arm and leg one shade darker); no gradients, no texture, no noise, no 3D rendering, no realism. Minimal faces: one almond-shaped eye (white with a round dark pupil), a small rounded nose bump on the profile, usually no mouth; hair and beards are flat shapes. Bodies about 5.5 heads tall, tube-like arms ending in rounded mitten hands (no separate fingers), straight legs with simple rounded feet in sandals, robes as clean A-line shapes. Landscapes: a warm low-poly diorama look, with hills, rocks and trees built from large flat-shaded triangular facets, no outlines, and soft warm haze toward the horizon. Light from the upper left; soft shadows fall to the lower right. Warm biblical desert palette: sand #D9B27C, ochre #C98A4B, terracotta #B4643C, olive #8A8F45, sage #A3A36E, dusty blue #6F8FA0, cream #F3ECDF, deep brown #2B1D12. High detail but clean and readable, crisp edges. No text, no letters, no numbers, no watermark, no signature, no logo, no frame, no border.

ATTACHED: the approved sky and far hills of this same scene. Match their light, colors, haze and level of detail exactly. Also attached: 1 style reference screenshot. Copy only its drawing style, never its people or scene.

IMAGE: the MIDDLE layer of the golden-hour hill scene: a gentle low-poly hill slope covered in dry golden grass, with a smooth, pale sandy footpath crossing the lower third of the image almost horizontally from left to right (a flat, clear stage where a person will walk in side view). Three or four low-poly olive trees and a few faceted rocks near the left and right edges, warm golden-hour light from the left with long soft shadows to the right. Keep the path clear and empty.

BACKGROUND: everything above the land (the whole sky area) is fully transparent (PNG with a real alpha channel): no sky color, no white, no checkerboard pattern.

FORMAT: landscape 3:2 (1536×1024).

AVOID: text, letters, numbers, people, footprints, animals, buildings, frames, borders.
```

### 20. `bg_jordan_sky.png`

- **Size:** 1024×1536 (portrait 2:3)
- **Transparent:** no
- **Priority:** MUST-HAVE
- **Attach:** style_ref_2.png
- **Used in:** S3–S5 sky, S7 (re-graded)

```text
Flat 2D paper-cut illustration for a 2.5D animated Bible story. Characters and props: simple bold shapes with a clean, even, dark brown outline (#2B1D12) and rounded joins; matte flat colors with exactly one soft shadow tone per color (far-side arm and leg one shade darker); no gradients, no texture, no noise, no 3D rendering, no realism. Minimal faces: one almond-shaped eye (white with a round dark pupil), a small rounded nose bump on the profile, usually no mouth; hair and beards are flat shapes. Bodies about 5.5 heads tall, tube-like arms ending in rounded mitten hands (no separate fingers), straight legs with simple rounded feet in sandals, robes as clean A-line shapes. Landscapes: a warm low-poly diorama look, with hills, rocks and trees built from large flat-shaded triangular facets, no outlines, and soft warm haze toward the horizon. Light from the upper left; soft shadows fall to the lower right. Warm biblical desert palette: sand #D9B27C, ochre #C98A4B, terracotta #B4643C, olive #8A8F45, sage #A3A36E, dusty blue #6F8FA0, cream #F3ECDF, deep brown #2B1D12. High detail but clean and readable, crisp edges. No text, no letters, no numbers, no watermark, no signature, no logo, no frame, no border.

ATTACHED: 1 style reference screenshot. Copy only its warm light, haze, low-poly look and level of detail, never its scene.

IMAGE: the SKY layer for the Jordan valley in the afternoon: a warm, hazy sky that fills the whole image, pale cream-gold near the bottom (the horizon) fading up to a soft dusty blue at the top, with a few flat, faceted, low-poly clouds and soft sunlight from the upper left. Calm and open. Sky only: no ground, no hills, no birds.

BACKGROUND: a complete, opaque picture that fills the whole image (no transparency).

FORMAT: portrait 2:3 (1024×1536).

AVOID: text, letters, numbers, ground, hills, trees, people, birds, sun rays drawn as lines, frames, borders.
```

### 21. `bg_jordan_far.png`

- **Size:** 1536×1024 (landscape 3:2)
- **Transparent:** yes (sky area)
- **Priority:** MUST-HAVE
- **Attach:** bg_jordan_sky.png, style_ref_2.png
- **Used in:** S3–S7 far mountains (storm grade in S6)

```text
Flat 2D paper-cut illustration for a 2.5D animated Bible story. Characters and props: simple bold shapes with a clean, even, dark brown outline (#2B1D12) and rounded joins; matte flat colors with exactly one soft shadow tone per color (far-side arm and leg one shade darker); no gradients, no texture, no noise, no 3D rendering, no realism. Minimal faces: one almond-shaped eye (white with a round dark pupil), a small rounded nose bump on the profile, usually no mouth; hair and beards are flat shapes. Bodies about 5.5 heads tall, tube-like arms ending in rounded mitten hands (no separate fingers), straight legs with simple rounded feet in sandals, robes as clean A-line shapes. Landscapes: a warm low-poly diorama look, with hills, rocks and trees built from large flat-shaded triangular facets, no outlines, and soft warm haze toward the horizon. Light from the upper left; soft shadows fall to the lower right. Warm biblical desert palette: sand #D9B27C, ochre #C98A4B, terracotta #B4643C, olive #8A8F45, sage #A3A36E, dusty blue #6F8FA0, cream #F3ECDF, deep brown #2B1D12. High detail but clean and readable, crisp edges. No text, no letters, no numbers, no watermark, no signature, no logo, no frame, no border.

ATTACHED: the approved sky of this same scene. Match its light, colors, haze and level of detail exactly. Also attached: 1 style reference screenshot. Copy only its drawing style, never its people or scene.

IMAGE: the FAR layer of the Jordan valley: long, flat-topped low-poly desert mountain ridges across the valley, filling the lower 45% of the image across the full width, in hazy dusty violet, soft blue-grey and pale ochre (low contrast, with atmospheric haze), lit from the upper left. The left and right ends are at a similar height.

BACKGROUND: everything above the land (the whole sky area) is fully transparent (PNG with a real alpha channel): no sky color, no white, no checkerboard pattern.

FORMAT: landscape 3:2 (1536×1024).

AVOID: text, letters, numbers, people, animals, birds, buildings, sky, sun, frames, borders.
```

### 22. `bg_jordan_mid.png`

- **Size:** 1536×1024 (landscape 3:2)
- **Transparent:** yes (sky area)
- **Priority:** MUST-HAVE
- **Attach:** bg_jordan_sky.png, bg_jordan_far.png, style_ref_2.png
- **Used in:** S3 walk, S4 chariot, S6 whirlwind ground, S7 Elisha alone

```text
Flat 2D paper-cut illustration for a 2.5D animated Bible story. Characters and props: simple bold shapes with a clean, even, dark brown outline (#2B1D12) and rounded joins; matte flat colors with exactly one soft shadow tone per color (far-side arm and leg one shade darker); no gradients, no texture, no noise, no 3D rendering, no realism. Minimal faces: one almond-shaped eye (white with a round dark pupil), a small rounded nose bump on the profile, usually no mouth; hair and beards are flat shapes. Bodies about 5.5 heads tall, tube-like arms ending in rounded mitten hands (no separate fingers), straight legs with simple rounded feet in sandals, robes as clean A-line shapes. Landscapes: a warm low-poly diorama look, with hills, rocks and trees built from large flat-shaded triangular facets, no outlines, and soft warm haze toward the horizon. Light from the upper left; soft shadows fall to the lower right. Warm biblical desert palette: sand #D9B27C, ochre #C98A4B, terracotta #B4643C, olive #8A8F45, sage #A3A36E, dusty blue #6F8FA0, cream #F3ECDF, deep brown #2B1D12. High detail but clean and readable, crisp edges. No text, no letters, no numbers, no watermark, no signature, no logo, no frame, no border.

ATTACHED: the approved sky and far mountains of this same scene. Match their light, colors, haze and level of detail exactly. Also attached: 1 style reference screenshot. Copy only its drawing style, never its people or scene.

IMAGE: the MIDDLE layer of the Jordan valley: the Jordan river (a calm dusty-blue river, #6F8FA0, with a few pale ripple lines) winding horizontally across the middle of the image, with sandy and olive banks and clumps of low-poly palm trees, tamarisk bushes and green reeds along the far bank. On the near side, a flat, open, sandy walking path runs along the river through the lower third (a clear stage where two people will walk in side view). Low-poly faceted terrain, warm afternoon light from the upper left, soft shadows to the lower right. Keep the path clear and empty.

BACKGROUND: everything above the land (the whole sky area) is fully transparent (PNG with a real alpha channel): no sky color, no white, no checkerboard pattern.

FORMAT: landscape 3:2 (1536×1024).

AVOID: text, letters, numbers, people, footprints, animals, buildings, frames, borders.
```

### 23. `bg_storm_sky.png`

- **Size:** 1024×1536 (portrait 2:3)
- **Transparent:** no
- **Priority:** MUST-HAVE
- **Attach:** style_ref_2.png
- **Used in:** S1 hook, S6 whirlwind sky, S11 loop

```text
Flat 2D paper-cut illustration for a 2.5D animated Bible story. Characters and props: simple bold shapes with a clean, even, dark brown outline (#2B1D12) and rounded joins; matte flat colors with exactly one soft shadow tone per color (far-side arm and leg one shade darker); no gradients, no texture, no noise, no 3D rendering, no realism. Minimal faces: one almond-shaped eye (white with a round dark pupil), a small rounded nose bump on the profile, usually no mouth; hair and beards are flat shapes. Bodies about 5.5 heads tall, tube-like arms ending in rounded mitten hands (no separate fingers), straight legs with simple rounded feet in sandals, robes as clean A-line shapes. Landscapes: a warm low-poly diorama look, with hills, rocks and trees built from large flat-shaded triangular facets, no outlines, and soft warm haze toward the horizon. Light from the upper left; soft shadows fall to the lower right. Warm biblical desert palette: sand #D9B27C, ochre #C98A4B, terracotta #B4643C, olive #8A8F45, sage #A3A36E, dusty blue #6F8FA0, cream #F3ECDF, deep brown #2B1D12. High detail but clean and readable, crisp edges. No text, no letters, no numbers, no watermark, no signature, no logo, no frame, no border.

ATTACHED: 1 style reference screenshot. Copy only its warm light, haze, low-poly look and level of detail, never its scene.

IMAGE: the SKY layer for the whirlwind: a dramatic storm sky over a desert valley that fills the whole image. Huge swirling low-poly faceted storm clouds in deep slate blue, dusty purple and charcoal brown spiral toward a bright opening near the top center, where warm golden light (#F2B544) breaks through and lights the cloud edges gold. A strong feeling of upward spiral motion. Sky only.

BACKGROUND: a complete, opaque picture that fills the whole image (no transparency).

FORMAT: portrait 2:3 (1024×1536).

AVOID: text, letters, numbers, ground, people, lightning bolts, rain, birds, frames, borders.
```

### 24. `bg_mountain_far.png`

- **Size:** 1536×1024 (landscape 3:2)
- **Transparent:** yes (sky area)
- **Priority:** MUST-HAVE
- **Attach:** style_ref_2.png, style_ref_3.png
- **Used in:** S8 cloud sea and far peaks

```text
Flat 2D paper-cut illustration for a 2.5D animated Bible story. Characters and props: simple bold shapes with a clean, even, dark brown outline (#2B1D12) and rounded joins; matte flat colors with exactly one soft shadow tone per color (far-side arm and leg one shade darker); no gradients, no texture, no noise, no 3D rendering, no realism. Minimal faces: one almond-shaped eye (white with a round dark pupil), a small rounded nose bump on the profile, usually no mouth; hair and beards are flat shapes. Bodies about 5.5 heads tall, tube-like arms ending in rounded mitten hands (no separate fingers), straight legs with simple rounded feet in sandals, robes as clean A-line shapes. Landscapes: a warm low-poly diorama look, with hills, rocks and trees built from large flat-shaded triangular facets, no outlines, and soft warm haze toward the horizon. Light from the upper left; soft shadows fall to the lower right. Warm biblical desert palette: sand #D9B27C, ochre #C98A4B, terracotta #B4643C, olive #8A8F45, sage #A3A36E, dusty blue #6F8FA0, cream #F3ECDF, deep brown #2B1D12. High detail but clean and readable, crisp edges. No text, no letters, no numbers, no watermark, no signature, no logo, no frame, no border.

ATTACHED: 2 style reference screenshots. Copy only their warm light, haze, low-poly look and level of detail, never their scene.

IMAGE: the FAR layer of a high, bright mountain-top scene: a soft sea of clouds with distant low-poly mountain peaks rising out of it, in pale lavender, cream and soft gold, very hazy and light, as if seen from a great height in heavenly light. The peaks and cloud sea fill the lower half of the image across the full width.

BACKGROUND: everything above the land (the whole sky area) is fully transparent (PNG with a real alpha channel): no sky color, no white, no checkerboard pattern.

FORMAT: landscape 3:2 (1536×1024).

AVOID: text, letters, numbers, people, animals, birds, buildings, sky, sun, frames, borders.
```

### 25. `bg_mountain_mid.png`

- **Size:** 1536×1024 (landscape 3:2)
- **Transparent:** yes (sky area)
- **Priority:** MUST-HAVE
- **Attach:** bg_mountain_far.png, style_ref_2.png
- **Used in:** S8 the summit stage

```text
Flat 2D paper-cut illustration for a 2.5D animated Bible story. Characters and props: simple bold shapes with a clean, even, dark brown outline (#2B1D12) and rounded joins; matte flat colors with exactly one soft shadow tone per color (far-side arm and leg one shade darker); no gradients, no texture, no noise, no 3D rendering, no realism. Minimal faces: one almond-shaped eye (white with a round dark pupil), a small rounded nose bump on the profile, usually no mouth; hair and beards are flat shapes. Bodies about 5.5 heads tall, tube-like arms ending in rounded mitten hands (no separate fingers), straight legs with simple rounded feet in sandals, robes as clean A-line shapes. Landscapes: a warm low-poly diorama look, with hills, rocks and trees built from large flat-shaded triangular facets, no outlines, and soft warm haze toward the horizon. Light from the upper left; soft shadows fall to the lower right. Warm biblical desert palette: sand #D9B27C, ochre #C98A4B, terracotta #B4643C, olive #8A8F45, sage #A3A36E, dusty blue #6F8FA0, cream #F3ECDF, deep brown #2B1D12. High detail but clean and readable, crisp edges. No text, no letters, no numbers, no watermark, no signature, no logo, no frame, no border.

ATTACHED: the approved far layer of this same scene. Match its light, colors, haze and level of detail exactly. Also attached: 1 style reference screenshot. Copy only its drawing style, never its people or scene.

IMAGE: the MIDDLE layer of the bright mountain-top scene: the broad, flat, rocky summit of a high mountain (a wide, stage-like ledge of low-poly faceted pale rock in warm cream, ochre and soft grey, with a few tufts of dry grass and small shrubs near the edges) filling the lower 40% of the image. The flat top is clear and empty (six people will stand there). Bright light falls from above the center, so the top surfaces glow pale gold.

BACKGROUND: everything above the land (the whole sky area) is fully transparent (PNG with a real alpha channel): no sky color, no white, no checkerboard pattern.

FORMAT: landscape 3:2 (1536×1024).

AVOID: text, letters, numbers, people, footprints, animals, buildings, frames, borders.
```

### 26. `fx_whirlwind_1.png`

- **Size:** 1536×1024 (landscape 3:2)
- **Transparent:** yes
- **Priority:** MUST-HAVE
- **Attach:** bg_storm_sky.png, style_ref_2.png
- **Used in:** S1 + S6 whirlwind cylinder, back layer

```text
Flat 2D paper-cut illustration for a 2.5D animated Bible story. Characters and props: simple bold shapes with a clean, even, dark brown outline (#2B1D12) and rounded joins; matte flat colors with exactly one soft shadow tone per color (far-side arm and leg one shade darker); no gradients, no texture, no noise, no 3D rendering, no realism. Minimal faces: one almond-shaped eye (white with a round dark pupil), a small rounded nose bump on the profile, usually no mouth; hair and beards are flat shapes. Bodies about 5.5 heads tall, tube-like arms ending in rounded mitten hands (no separate fingers), straight legs with simple rounded feet in sandals, robes as clean A-line shapes. Landscapes: a warm low-poly diorama look, with hills, rocks and trees built from large flat-shaded triangular facets, no outlines, and soft warm haze toward the horizon. Light from the upper left; soft shadows fall to the lower right. Warm biblical desert palette: sand #D9B27C, ochre #C98A4B, terracotta #B4643C, olive #8A8F45, sage #A3A36E, dusty blue #6F8FA0, cream #F3ECDF, deep brown #2B1D12. High detail but clean and readable, crisp edges. No text, no letters, no numbers, no watermark, no signature, no logo, no frame, no border.

ATTACHED: the approved storm sky. Match its colors and light. Also attached: 1 style reference screenshot. Copy only its flat, faceted look.

IMAGE: the BACK layer texture of a giant whirlwind (a tall spinning column of wind, dust and light). A wide horizontal band that fills the whole width of the image: thick swirling dust clouds drawn as layered flat paper-cut shapes with large faceted puffs in sand, ochre and dusty grey-brown (#C9A46E, #A8835A, #7D6A5A), with pale cream highlights on their upper-left edges. All swirls lean diagonally up toward the right, as if spinning fast. The left edge must continue seamlessly into the right edge (it will wrap around a cylinder). The top and bottom edges of the band are ragged.

BACKGROUND: fully transparent (PNG with a real alpha channel). Nothing behind the subject: no ground, no floor, no cast shadow, no scenery, no white or checkerboard pattern.

FORMAT: landscape 3:2 (1536×1024).

AVOID: text, letters, numbers, people, ground, sky, a full tornado shape (this is only a flat texture band), frames, borders.
```

### 27. `fx_whirlwind_2.png`

- **Size:** 1536×1024 (landscape 3:2)
- **Transparent:** yes
- **Priority:** MUST-HAVE
- **Attach:** fx_whirlwind_1.png, bg_storm_sky.png
- **Used in:** S1 + S6 whirlwind cylinder, middle layer

```text
Flat 2D paper-cut illustration for a 2.5D animated Bible story. Characters and props: simple bold shapes with a clean, even, dark brown outline (#2B1D12) and rounded joins; matte flat colors with exactly one soft shadow tone per color (far-side arm and leg one shade darker); no gradients, no texture, no noise, no 3D rendering, no realism. Minimal faces: one almond-shaped eye (white with a round dark pupil), a small rounded nose bump on the profile, usually no mouth; hair and beards are flat shapes. Bodies about 5.5 heads tall, tube-like arms ending in rounded mitten hands (no separate fingers), straight legs with simple rounded feet in sandals, robes as clean A-line shapes. Landscapes: a warm low-poly diorama look, with hills, rocks and trees built from large flat-shaded triangular facets, no outlines, and soft warm haze toward the horizon. Light from the upper left; soft shadows fall to the lower right. Warm biblical desert palette: sand #D9B27C, ochre #C98A4B, terracotta #B4643C, olive #8A8F45, sage #A3A36E, dusty blue #6F8FA0, cream #F3ECDF, deep brown #2B1D12. High detail but clean and readable, crisp edges. No text, no letters, no numbers, no watermark, no signature, no logo, no frame, no border.

ATTACHED: whirlwind layer 1 and the storm sky. Match their colors and style.

IMAGE: the MIDDLE layer texture of the same whirlwind: long diagonal streaks and ribbons of wind-blown dust and sand in ochre, cream and warm grey, mixed with thin ribbons of golden light (#F2B544), all leaning up toward the right, with clear transparent gaps between the streaks. The streaks fill the whole width, and the left edge continues seamlessly into the right edge.

BACKGROUND: fully transparent (PNG with a real alpha channel). Nothing behind the subject: no ground, no floor, no cast shadow, no scenery, no white or checkerboard pattern.

FORMAT: landscape 3:2 (1536×1024).

AVOID: text, letters, numbers, people, ground, sky, a full tornado shape (this is only a flat texture band), frames, borders.
```

### 28. `fx_myth_painting.png`

- **Size:** 1024×1536 (portrait 2:3)
- **Transparent:** no
- **Priority:** MUST-HAVE
- **Attach:** char_elijah_turnaround.png, fx_chariot.png, fx_horse_gallop.png
- **Used in:** S5 the "most people think" picture (aged and framed in code, then stamped with the red X)

```text
Flat 2D paper-cut illustration for a 2.5D animated Bible story. Characters and props: simple bold shapes with a clean, even, dark brown outline (#2B1D12) and rounded joins; matte flat colors with exactly one soft shadow tone per color (far-side arm and leg one shade darker); no gradients, no texture, no noise, no 3D rendering, no realism. Minimal faces: one almond-shaped eye (white with a round dark pupil), a small rounded nose bump on the profile, usually no mouth; hair and beards are flat shapes. Bodies about 5.5 heads tall, tube-like arms ending in rounded mitten hands (no separate fingers), straight legs with simple rounded feet in sandals, robes as clean A-line shapes. Landscapes: a warm low-poly diorama look, with hills, rocks and trees built from large flat-shaded triangular facets, no outlines, and soft warm haze toward the horizon. Light from the upper left; soft shadows fall to the lower right. Warm biblical desert palette: sand #D9B27C, ochre #C98A4B, terracotta #B4643C, olive #8A8F45, sage #A3A36E, dusty blue #6F8FA0, cream #F3ECDF, deep brown #2B1D12. High detail but clean and readable, crisp edges. No text, no letters, no numbers, no watermark, no signature, no logo, no frame, no border.

ATTACHED: our approved ELIJAH character sheet, chariot of fire and horse of fire. Keep their designs and colors exactly the same.

ELIJAH: an older, strong, weathered prophet with deep tan-brown skin (#8E5634); wild, long, dark-grey hair with lighter grey streaks (#5E5A55, #8F8A84) falling past his shoulders; a thick, bushy dark-grey beard reaching his chest; heavy brows; one almond eye with a dark pupil, a small rounded nose, no mouth. He wears a rough, shaggy garment of fawn camel hair (#B08D62 with darker tufts #8C6B47) that reaches his knees with a jagged furry hem, a wide dark leather belt with a simple round buckle around his waist (#3B2618), and a long, heavy dark-brown cloak (mantle, #4A3020) over his shoulders that reaches his calves; bare, strong forearms and shins; simple worn leather sandals. Broad shoulders, about 5.5 heads tall.

IMAGE: a heroic, classic Bible-storybook picture: ELIJAH, wearing his cloak, stands tall inside the chariot of fire, holding on with one hand and raising the other, pulled by two leaping horses of fire, racing diagonally up into a glowing golden sky full of soft faceted clouds; his cloak, hair and beard fly behind him. The Jordan valley lies small far below in the bottom corner. A dramatic, confident, centered composition that fills the whole picture.

BACKGROUND: a complete, opaque picture that fills the whole image (no transparency).

FORMAT: portrait 2:3 (1024×1536).

AVOID: text, letters, numbers, a whirlwind or tornado, other people, frames, borders.
```

## NICE-TO-HAVE prompts

### 29. `fx_whirlwind_3.png`

- **Size:** 1536×1024 (landscape 3:2)
- **Transparent:** yes
- **Priority:** NICE-TO-HAVE
- **Attach:** fx_whirlwind_2.png, bg_storm_sky.png
- **Used in:** S1 + S6 whirlwind cylinder, front layer (code particles if skipped)

```text
Flat 2D paper-cut illustration for a 2.5D animated Bible story. Characters and props: simple bold shapes with a clean, even, dark brown outline (#2B1D12) and rounded joins; matte flat colors with exactly one soft shadow tone per color (far-side arm and leg one shade darker); no gradients, no texture, no noise, no 3D rendering, no realism. Minimal faces: one almond-shaped eye (white with a round dark pupil), a small rounded nose bump on the profile, usually no mouth; hair and beards are flat shapes. Bodies about 5.5 heads tall, tube-like arms ending in rounded mitten hands (no separate fingers), straight legs with simple rounded feet in sandals, robes as clean A-line shapes. Landscapes: a warm low-poly diorama look, with hills, rocks and trees built from large flat-shaded triangular facets, no outlines, and soft warm haze toward the horizon. Light from the upper left; soft shadows fall to the lower right. Warm biblical desert palette: sand #D9B27C, ochre #C98A4B, terracotta #B4643C, olive #8A8F45, sage #A3A36E, dusty blue #6F8FA0, cream #F3ECDF, deep brown #2B1D12. High detail but clean and readable, crisp edges. No text, no letters, no numbers, no watermark, no signature, no logo, no frame, no border.

ATTACHED: whirlwind layer 2 and the storm sky. Match their colors and style.

IMAGE: the FRONT layer texture of the same whirlwind: sparse thin wisps of dust, a few small leaves, twigs, pebbles and bits of sand, and a few thin bright-gold light ribbons, spread across the whole width with lots of empty transparent space, all moving diagonally up toward the right. The left edge continues seamlessly into the right edge.

BACKGROUND: fully transparent (PNG with a real alpha channel). Nothing behind the subject: no ground, no floor, no cast shadow, no scenery, no white or checkerboard pattern.

FORMAT: landscape 3:2 (1536×1024).

AVOID: text, letters, numbers, people, ground, sky, a full tornado shape (this is only a flat texture band), frames, borders.
```

### 30. `fx_embers_sparks.png`

- **Size:** 1536×1024 (landscape 3:2)
- **Transparent:** no, pure black
- **Priority:** NICE-TO-HAVE
- **Attach:** fx_flames.png
- **Used in:** S4 sparks, S6 embers (code particles if skipped)

```text
Flat 2D paper-cut illustration for a 2.5D animated Bible story. Characters and props: simple bold shapes with a clean, even, dark brown outline (#2B1D12) and rounded joins; matte flat colors with exactly one soft shadow tone per color (far-side arm and leg one shade darker); no gradients, no texture, no noise, no 3D rendering, no realism. Minimal faces: one almond-shaped eye (white with a round dark pupil), a small rounded nose bump on the profile, usually no mouth; hair and beards are flat shapes. Bodies about 5.5 heads tall, tube-like arms ending in rounded mitten hands (no separate fingers), straight legs with simple rounded feet in sandals, robes as clean A-line shapes. Landscapes: a warm low-poly diorama look, with hills, rocks and trees built from large flat-shaded triangular facets, no outlines, and soft warm haze toward the horizon. Light from the upper left; soft shadows fall to the lower right. Warm biblical desert palette: sand #D9B27C, ochre #C98A4B, terracotta #B4643C, olive #8A8F45, sage #A3A36E, dusty blue #6F8FA0, cream #F3ECDF, deep brown #2B1D12. High detail but clean and readable, crisp edges. No text, no letters, no numbers, no watermark, no signature, no logo, no frame, no border.

ATTACHED: our approved flames. Match their fire colors.

IMAGE: a sprite sheet of about 24 separate small embers and sparks, scattered in a loose grid with empty space around each one: round embers, diamond-shaped sparks, short curved spark streaks and tiny glowing ash flakes, in bright yellow, golden orange and red-orange, drawn as flat paper-cut shapes with a small soft glow.

BACKGROUND: pure solid black (#000000) everywhere outside the shapes. It will be blended in 'screen' mode, so the black disappears.

FORMAT: landscape 3:2 (1536×1024).

AVOID: text, letters, numbers, flames, smoke, fireworks, stars, frames, borders.
```

### 31. `fx_light_beam.png`

- **Size:** 1024×1536 (portrait 2:3)
- **Transparent:** no, pure black
- **Priority:** NICE-TO-HAVE
- **Attach:** style_ref_3.png
- **Used in:** S2 holy light, S8 mountain light (shader beam if skipped)

```text
Flat 2D paper-cut illustration for a 2.5D animated Bible story. Characters and props: simple bold shapes with a clean, even, dark brown outline (#2B1D12) and rounded joins; matte flat colors with exactly one soft shadow tone per color (far-side arm and leg one shade darker); no gradients, no texture, no noise, no 3D rendering, no realism. Minimal faces: one almond-shaped eye (white with a round dark pupil), a small rounded nose bump on the profile, usually no mouth; hair and beards are flat shapes. Bodies about 5.5 heads tall, tube-like arms ending in rounded mitten hands (no separate fingers), straight legs with simple rounded feet in sandals, robes as clean A-line shapes. Landscapes: a warm low-poly diorama look, with hills, rocks and trees built from large flat-shaded triangular facets, no outlines, and soft warm haze toward the horizon. Light from the upper left; soft shadows fall to the lower right. Warm biblical desert palette: sand #D9B27C, ochre #C98A4B, terracotta #B4643C, olive #8A8F45, sage #A3A36E, dusty blue #6F8FA0, cream #F3ECDF, deep brown #2B1D12. High detail but clean and readable, crisp edges. No text, no letters, no numbers, no watermark, no signature, no logo, no frame, no border.

ATTACHED: 1 style reference screenshot. Copy only its warm light, haze, low-poly look and level of detail, never its scene.

IMAGE: one soft vertical beam of warm holy light, with no person and no object. It comes down from the top edge of the image, narrow at the top and gently widening toward the bottom, with soft feathered edges and three or four faint parallel streaks inside, in warm white-gold (#FFF3D0 core, #F2B544 edges), ending in a soft glowing oval pool of light near the bottom.

BACKGROUND: pure solid black (#000000) everywhere outside the shapes. It will be blended in 'screen' mode, so the black disappears.

FORMAT: portrait 2:3 (1024×1536).

AVOID: text, letters, numbers, people, figures, ground, sky, clouds, sun, frames, borders.
```

### 32. `prop_footprints.png`

- **Size:** 1536×1024 (landscape 3:2)
- **Transparent:** yes
- **Priority:** NICE-TO-HAVE
- **Attach:** bg_enoch_mid.png
- **Used in:** S2 footprints that stop (drawn in code if skipped)

```text
Flat 2D paper-cut illustration for a 2.5D animated Bible story. Characters and props: simple bold shapes with a clean, even, dark brown outline (#2B1D12) and rounded joins; matte flat colors with exactly one soft shadow tone per color (far-side arm and leg one shade darker); no gradients, no texture, no noise, no 3D rendering, no realism. Minimal faces: one almond-shaped eye (white with a round dark pupil), a small rounded nose bump on the profile, usually no mouth; hair and beards are flat shapes. Bodies about 5.5 heads tall, tube-like arms ending in rounded mitten hands (no separate fingers), straight legs with simple rounded feet in sandals, robes as clean A-line shapes. Landscapes: a warm low-poly diorama look, with hills, rocks and trees built from large flat-shaded triangular facets, no outlines, and soft warm haze toward the horizon. Light from the upper left; soft shadows fall to the lower right. Warm biblical desert palette: sand #D9B27C, ochre #C98A4B, terracotta #B4643C, olive #8A8F45, sage #A3A36E, dusty blue #6F8FA0, cream #F3ECDF, deep brown #2B1D12. High detail but clean and readable, crisp edges. No text, no letters, no numbers, no watermark, no signature, no logo, no frame, no border.

ATTACHED: the approved hill-path layer. Match its sand color and light.

IMAGE: a trail of ten sandal footprints pressed into smooth sand, seen from a high three-quarter camera angle, walking from left to right in a straight line, alternating left and right feet, evenly spaced. Each print is a flat shape in a darker sand tone (#B08A5A) with a thin lighter rim (#E6CC9A) on its upper-left edge. Below the trail, two single prints (one left foot, one right foot) on their own. Only the footprints, with no surrounding sand.

BACKGROUND: fully transparent (PNG with a real alpha channel). Nothing behind the subject: no ground, no floor, no cast shadow, no scenery, no white or checkerboard pattern.

FORMAT: landscape 3:2 (1536×1024).

AVOID: text, letters, numbers, people, feet, sandals, ground texture, frames, borders.
```

### 33. `bg_storm_clouds.png`

- **Size:** 1536×1024 (landscape 3:2)
- **Transparent:** yes
- **Priority:** NICE-TO-HAVE
- **Attach:** bg_storm_sky.png
- **Used in:** S6 cloud layer the whirlwind enters (code fog if skipped)

```text
Flat 2D paper-cut illustration for a 2.5D animated Bible story. Characters and props: simple bold shapes with a clean, even, dark brown outline (#2B1D12) and rounded joins; matte flat colors with exactly one soft shadow tone per color (far-side arm and leg one shade darker); no gradients, no texture, no noise, no 3D rendering, no realism. Minimal faces: one almond-shaped eye (white with a round dark pupil), a small rounded nose bump on the profile, usually no mouth; hair and beards are flat shapes. Bodies about 5.5 heads tall, tube-like arms ending in rounded mitten hands (no separate fingers), straight legs with simple rounded feet in sandals, robes as clean A-line shapes. Landscapes: a warm low-poly diorama look, with hills, rocks and trees built from large flat-shaded triangular facets, no outlines, and soft warm haze toward the horizon. Light from the upper left; soft shadows fall to the lower right. Warm biblical desert palette: sand #D9B27C, ochre #C98A4B, terracotta #B4643C, olive #8A8F45, sage #A3A36E, dusty blue #6F8FA0, cream #F3ECDF, deep brown #2B1D12. High detail but clean and readable, crisp edges. No text, no letters, no numbers, no watermark, no signature, no logo, no frame, no border.

ATTACHED: the approved storm sky of this same scene. Match its light, colors, haze and level of detail exactly.

IMAGE: a CLOUD layer for the storm scene: a wide horizontal band of thick, low-poly faceted storm clouds in slate blue and dusty purple, with gold-lit top edges, filling the middle third of the image across the full width. Everything above and below the band is transparent.

BACKGROUND: fully transparent (PNG with a real alpha channel). Nothing behind the subject: no ground, no floor, no cast shadow, no scenery, no white or checkerboard pattern.

FORMAT: landscape 3:2 (1536×1024).

AVOID: text, letters, numbers, ground, people, lightning bolts, rain, birds, frames, borders.
```

### 34. `bg_mountain_sky.png`

- **Size:** 1024×1536 (portrait 2:3)
- **Transparent:** no
- **Priority:** NICE-TO-HAVE
- **Attach:** bg_mountain_far.png, style_ref_3.png
- **Used in:** S8 bright sky (code gradient if skipped)

```text
Flat 2D paper-cut illustration for a 2.5D animated Bible story. Characters and props: simple bold shapes with a clean, even, dark brown outline (#2B1D12) and rounded joins; matte flat colors with exactly one soft shadow tone per color (far-side arm and leg one shade darker); no gradients, no texture, no noise, no 3D rendering, no realism. Minimal faces: one almond-shaped eye (white with a round dark pupil), a small rounded nose bump on the profile, usually no mouth; hair and beards are flat shapes. Bodies about 5.5 heads tall, tube-like arms ending in rounded mitten hands (no separate fingers), straight legs with simple rounded feet in sandals, robes as clean A-line shapes. Landscapes: a warm low-poly diorama look, with hills, rocks and trees built from large flat-shaded triangular facets, no outlines, and soft warm haze toward the horizon. Light from the upper left; soft shadows fall to the lower right. Warm biblical desert palette: sand #D9B27C, ochre #C98A4B, terracotta #B4643C, olive #8A8F45, sage #A3A36E, dusty blue #6F8FA0, cream #F3ECDF, deep brown #2B1D12. High detail but clean and readable, crisp edges. No text, no letters, no numbers, no watermark, no signature, no logo, no frame, no border.

ATTACHED: the approved far layer of this same scene. Match its light, colors, haze and level of detail exactly. Also attached: 1 style reference screenshot. Copy only its warm light.

IMAGE: the SKY layer of the bright mountain-top scene, filling the whole image: an almost white sky of cream and pale gold, brightest just above the bottom center as if a great light is shining there, with soft, warm-white low-poly clouds around the edges. Very light, peaceful and holy. Sky only.

BACKGROUND: a complete, opaque picture that fills the whole image (no transparency).

FORMAT: portrait 2:3 (1024×1536).

AVOID: text, letters, numbers, ground, hills, trees, people, birds, sun rays drawn as lines, frames, borders.
```

### 35. `bg_near_kit.png`

- **Size:** 1536×1024 (landscape 3:2)
- **Transparent:** yes
- **Priority:** NICE-TO-HAVE
- **Attach:** bg_jordan_mid.png, bg_enoch_mid.png, style_ref_2.png
- **Used in:** foreground pieces for parallax in S2, S3, S7, S8 (code-blurred)

```text
Flat 2D paper-cut illustration for a 2.5D animated Bible story. Characters and props: simple bold shapes with a clean, even, dark brown outline (#2B1D12) and rounded joins; matte flat colors with exactly one soft shadow tone per color (far-side arm and leg one shade darker); no gradients, no texture, no noise, no 3D rendering, no realism. Minimal faces: one almond-shaped eye (white with a round dark pupil), a small rounded nose bump on the profile, usually no mouth; hair and beards are flat shapes. Bodies about 5.5 heads tall, tube-like arms ending in rounded mitten hands (no separate fingers), straight legs with simple rounded feet in sandals, robes as clean A-line shapes. Landscapes: a warm low-poly diorama look, with hills, rocks and trees built from large flat-shaded triangular facets, no outlines, and soft warm haze toward the horizon. Light from the upper left; soft shadows fall to the lower right. Warm biblical desert palette: sand #D9B27C, ochre #C98A4B, terracotta #B4643C, olive #8A8F45, sage #A3A36E, dusty blue #6F8FA0, cream #F3ECDF, deep brown #2B1D12. High detail but clean and readable, crisp edges. No text, no letters, no numbers, no watermark, no signature, no logo, no frame, no border.

ATTACHED: two approved landscape layers. Match their colors, light and faceted look. Also attached: 1 style reference screenshot. Copy only its drawing style, never its people or scene.

IMAGE: a FOREGROUND KIT of ten separate elements for parallax, each isolated with clear empty space around it: three low-poly rock clusters (large, medium, small), three dry golden grass tufts, two clumps of green river reeds and two small desert shrubs. The same flat-shaded faceted look as the attached layers, slightly darker and more saturated (they are close to the camera).

BACKGROUND: fully transparent (PNG with a real alpha channel). Nothing behind the subject: no ground, no floor, no cast shadow, no scenery, no white or checkerboard pattern.

FORMAT: landscape 3:2 (1536×1024).

AVOID: text, letters, numbers, people, animals, ground plane, sky, frames, borders.
```
