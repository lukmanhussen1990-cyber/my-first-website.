# Q.02 · THE OLDEST MAN — production brief (shared by every track)

Account: GRACE IN MOTION (@grace_in_motion616). One finished Instagram Reel, 1080×1920, 30 fps, **84.44 s**
(voice 81.04 s + end card). Everything is made in code: animation, text, voice, music and SFX. Do not use stock footage,
downloaded images or music, or AI image/video tools. The last Noah reel got 65k views in 17 h; this one must look **even better**.

## Style: the same as the reference reels, but clearly better
The references are in `grace-reels/reference/*.mp4`. Style notes are in `grace-reels/reference/style_notes.md` (written by the style track); older notes are in `ark_ref_style_notes.md`.
- **People:** flat 2D paper-cut figures standing upright in the 3D world, mostly in side or ¾ view.
  - Big simple head, almond white eye with a dark pupil and a thin dark lid line, small nose bump in profile, usually no mouth.
  - Solid hair and beard shapes. Thin arms and legs with rounded ends, trapezoid robes with a belt band, small feet.
  - Clean dark-brown outline on every shape. A soft shadow on the ground.
- **World:** faceted low-poly sand, hills, palms, round trees, mud-brick houses and tents.
  - Palette: warm ochre, sand, olive, dusty red. Haze in the distance.
  - High camera with a long lens, like looking at a miniature model.
- **Captions:** italic serif (Cormorant Garamond Italic), word-timed.
- Copy the style only. Never copy their brand name, logo, series title, colours, script lines or exact shots.

### Upgrades the client asked for (quality target)
- **Characters**
  - Clean vector parts rendered as high-resolution textures (≥1024×2048 per character) with mipmaps and anisotropic filtering, razor sharp in close-ups.
  - Outline about 5 px on screen at 1080×1920 at every distance.
  - Two-tone cel shading: a shadow tone on the side away from the scene's key light (must match the real sun/lamp direction) plus a thin warm rim on the light side.
  - Fold lines, 3–5 strand lines in hair and beards, eyebrows, mitten hands with a thumb, toes on bare feet.
  - Accessories: staff, sash, headband, bracelet, satchel, oil lamp.
  - Varied silhouettes (ages, heights, builds).
  - Side, ¾ and back views; a 2–3 frame paper-flip squash when turning.
- **World**
  - Low-poly but crafted: bevelled edges on houses and stones, per-face colour variation, vertex-colour gradients on big surfaces.
  - Rich InstancedMesh set dressing: grass tufts, pebbles, pots, baskets, firewood, footprints.
  - Noise hills, worn paths, half-buried rocks.
- **Light**
  - Warm key sun plus a cool hemisphere fill, soft shadows (2048–4096), contact shadows, ambient occlusion.
  - God rays on key shots, selective bloom on flames and holy light, filmic tone mapping.
  - Height fog, sky gradient with drifting low-poly clouds, sun disc, stars at night.
  - An oil-lamp flame with a real glow and a flicker light on nearby faces.
- **Rain:** streaks, splashes, ripples, wet darker ground, puddles with soft reflections.
- **Camera polish**
  - DOF on close-ups with smooth focus pulls, subtle tilt-shift on wide shots.
  - Light grain, soft vignette, a grade per mood.
  - SMAA. Render at 1.5× and downsample only if render time allows (never lower the output size).
- **Quality loop (×2):** for a character close-up, a wide world shot and a verse card:
  - Make `quality/compare_N.png` with the reference frame on the left and ours on the right.
  - List 5 things where ours is weaker, fix them, and repeat.

## Story (KJV quotes word for word; "…" = omitted)
- "If you add up the ages in Genesis 5":
  - Methuselah was 187 when Lamech was born (5:25).
  - Lamech was 182 when Noah was born (5:28–29).
  - Noah was 600 at the flood (7:6).
  - 187 + 182 + 600 = 969 = Methuselah's age (5:27).
- Anno mundi:
  - Methuselah was born in 687, and Adam died in 930, so Methuselah was 243 when Adam died.
  - Noah was born in 1056. The flood came in 1656 = 687 + 969.
- Name: **"some say"** it can mean "when he dies, it shall be sent". Always show "(meaning debated)".
- **Rules**
  - Gentle and family-safe: no drowning people, no bodies, no destruction close-ups. Mocking crowds are fine.
  - God is never shown as a person, only as light.

## Script (timeline.json has every word's time; scene per beat)
| beat | scene | text |
|---|---|---|
| B01 | S1 | The oldest man who ever lived died the same year as the *flood*. Coincidence? |
| B02 | S2 | His name was *Methuselah*. He lived *969* years. |
| B03 | S3 | His father, Enoch, "walked with God: and he was not; for God *took* him." |
| B04 | S4 | If you add up the ages in Genesis 5, Methuselah's life overlapped with *Adam*… and with *Noah*. |
| B05 | S5 | Now watch the *math*. |
| B06 | S5 | Methuselah was *187* when his son Lamech was born. |
| B07 | S6 | Lamech was *182* when Noah was born. |
| B08 | S7 | Noah was *600* when the flood came. |
| B09 | S8 | 187… plus 182… plus 600… equals *969*. |
| B10 | S9 | The exact year Methuselah *died*. (then 0.6 s near silence + one giant slow-motion raindrop) |
| B11 | S10 | Some say his name can mean "when he dies, it shall be *sent*." |
| B12 | S11 | But notice: the flood came the same year his long life ended. As if God was *waiting*… as long as He could. |
| B13 | S11 | "The longsuffering of God *waited* in the days of Noah, while the ark was a preparing." (then S12, the flood, in a held pause) |
| B14 | S13 | And God is still waiting today. Not to punish you… but *for* you. |
| B15 | S13 | "The Lord is… not willing that any should *perish*, but that all should come to repentance." |
| B16 | S14 | Coincidence… or God's *timing*? Comment one word. |
| — | S15 | End card, then back to the lit lamp of S1 (loop) |

## Scene plan (shot ids/times: `src/plan.js` `shots`; events: `plan.ev`)
- **S1 hook (night):** old Methuselah sits beside a single oil lamp on a hill. Far behind, the finished ark stands under gathering storm clouds. Slow push-in. The hook title "969 YEARS. THEN THE FLOOD." punches in (frame 0) and flies into the caption spot at 1.8 s.
- **S2:** close-up of his face lit by the lamp, beard swaying in the wind. Label "METHUSELAH · 969 YEARS · GENESIS 5:27". A thin glowing life-ribbon stretches across the frame.
- **S3 (golden morning):**
  - Enoch walks on a path beside a soft beam of light. Young Methuselah (dark beard) watches from a doorway.
  - Enoch walks into the light and is gone at `ev.enochGone` ("took"). His footprints in the sand simply stop.
  - Floating card Genesis 5:24 with "GOD TOOK HIM" in gold.
- **S4 (HTML):** a parchment timeline across the screen.
  - Bars: ADAM 0–930, METHUSELAH 687–1656, NOAH born 1056 → flood 1656. Character icons at the ends.
  - The overlaps glow gold. Small text: "ADDING THE AGES IN GENESIS 5".
- **S5:** "Now watch the math." Younger Methuselah (dark beard) rocks baby Lamech. A big 3D gold **187** dips, then rises from the ground (`ev.n187`). The tracker shows 187.
- **S6:** strong, dark-bearded Lamech holds baby Noah. A gold **182** rises. The tracker rolls to 369.
- **S7:** old Noah (600, white beard, builder's tools) stands beside the finished ark. A gold **600** rises. The tracker rolls to 969.
- **S8:** the numbers fly together and slam into one huge **969** over Methuselah's lamp (`ev.slam`). Gold dust burst, short shake. Label "THE YEAR HE DIED · GENESIS 5:27".
- **S9:** extreme close-up of the lamp.
  - The flame (guttering since the slam) dies at `ev.lampOut` ("died"), leaving a curl of smoke.
  - Near silence (`ev.silence`). One giant slow-motion raindrop falls (`ev.dropFall`) and splashes on dry, cracked ground (`ev.dropSplash`).
- **S10:** the cold lamp and his cane leaning on a rock (no body). Gentle first rain, the distant ark. Label "SOME SAY: 'WHEN HE DIES, IT SHALL BE SENT'" with "(meaning debated)".
- **S11 (a/b/c):** time-lapse of Noah building the ark over the years.
  - Ribs rise. Seasons change green → dry → green.
  - Crowds walk past laughing and pointing. Old Methuselah watches from his hill every year.
  - Card 1 Peter 3:20 with "WAITED" in gold.
- **S12 (held pause, no voice):**
  - The sky cracks with light ("the windows of heaven were opened", label GENESIS 7:11). Rain falls in sheets.
  - The camera cranes up as water spreads over the land. The ark lifts.
  - No people in the water.
- **S13 (a/b):**
  - Match cut: rain on the ark becomes rain on a modern low-poly city at night, in the same art style.
  - One person stands alone under a streetlight. The rain slows and a soft warm light falls on them at `ev.warmLight` ("for you").
  - Card 2 Peter 3:9 with "NOT WILLING" and "PERISH" in gold.
- **S14:** dark warm background with two big icons: COINCIDENCE = a pair of dice, TIMING = a golden hourglass that glows. A comment box types "TIMING 🙏" with floating hearts.
- **S15:** end card (logo placeholder `public/logo.svg` + GRACE IN MOTION + @grace_in_motion616), flowing back into S1's lit lamp (loop).
- **The lamp:**
  - Appears in S1 and burns lower in later shots (`plan.ev.lampLevel(t)`, 1 → 0.15).
  - Goes out at `ev.lampOut`, right after the math hits 969.
  - Then 0.6 s of near silence and one huge slow-motion raindrop.
- **Retention:**
  - Math tracker under the captions from line 5: 187 → 369 → 969. Each number lands with weight and the total rolls up.
  - Something changes at least every 2 s.

## Moods
| scene | mood |
|---|---|
| Night lamp (S1, S2, S8) | deep blue + warm amber |
| Enoch (S3) | soft morning gold |
| Timeline (S4) | warm parchment |
| The math (S5–S7) | dark with gold numbers |
| Lamp out, raindrop (S9, S10) | cold blue-grey |
| Time-lapse (S11) | changing seasons |
| Flood (S12) | storm grey with cracks of light |
| City (S13) | cool night → warm light |
| Call to action (S14) | dark warm |

## Sound notes
- **Ambience:** night wind, crickets, soft lamp crackle.
- **Enoch:** an airy shimmer as he disappears; footsteps that stop.
- **Timeline:** a soft paper slide.
- **Numbers:** each lands with a deep wooden "thock" and a rising tone; the three tones build a chord.
- **Equals hit:** a big warm boom with a choir-like pad.
- **Lamp out:** a tiny puff, 0.6 s near silence, one huge amplified raindrop "plip", then far thunder.
- **Ark time-lapse:** hammer taps in rhythm, crowd murmur, wind through the seasons.
- **Flood:** a deep rumble and rain sheets (not too loud).
- **City:** soft rain on streets, then a warm pad as the light falls.
- **Music:** D minor, slow and mysterious, building through the math. It resolves to D major on "God is still waiting… for you".
- **Mix:** ducks ~8 dB under the voice, −14 LUFS, −1 dBTP.

## Engineering contract (do not break)
- **Project:** `grace-reels/oldest-man/`. Remotion 4 + `@remotion/three` (R3F) + three r186. Render with `node render.mjs`:
  - `stills 0,300,…` → `build/stills/fNNNN.jpg`. The env var `CONC` sets tabs. Use `CONC=1` or `CONC=2`: the machine has only 4 CPUs and is shared.
  - Also `cast`, `cover`, `frames A-B dir`, `full`.
  - `scripts/sheet.py out.jpg imgs… --w 270 --cols 4` makes contact sheets.
- **Pure function of the frame:** no `Date.now`/`Math.random`. Use the seeded `hash01`/`mulberry32`/`noise2` from `src/lib/util.js`.
- **Timing:** `src/plan.js` holds `ev` (events) and `shots`, and is shared with the audio synth. `timeline.json` has every word.
- **Director** (`src/lib/director.js`):
  - `SETS` gives each set's world offset: hill 0, enoch 1000, family 2000, ark 3000, city 4000, cta 5000 on x.
  - `SHOT_SET` maps each shot to a set.
  - Each set owns a camera module `src/cams/<set>.js` exporting `blocking(plan,H)`, `camera(plan,B,shot,t,H)` → `{pos,look,fov,focus?,mblur?,locked?}` and `anchors`.
  - The overlay projects label anchors with the same camera.
- **Engine** (`src/three/engine.js`): sets are `src/three/sets/<set>.js` exporting `build(ctx)` → `{ group, persons, update(t, cam, shot, c, M), mood(t, shot, c) }`.
  - The mood keys are in `src/three/moods.js` `BASE`.
  - Characters get the key light via the uniforms `U.uSunDir`/`U.uSunColor` (sun) and `U.uPointPos`/`U.uPointColor`/`U.uPointRange` (lamp/fire).
- **Characters:** `src/three/rig.js`, with the `Person` / `Poses` / `expr` API and `src/three/cast.js` helpers. Earlier sets are in `src/three/sets_legacy/` (reference only, not imported).
- **Overlay:** `src/overlay/`. Fonts come from `src/lib/fonts.js`.
- **Git:** do NOT run git commit/push (the lead integrates and commits).
