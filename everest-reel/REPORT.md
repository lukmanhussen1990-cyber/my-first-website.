# "Pooping on Top of Mount Everest": delivery report

**Files**
- `everest_reel_final.mp4`: 1080×1920, 30 fps, H.264 High, 1116 frames = 37.200 s, AAC 256 kb/s 48 kHz.
- `preview_low.mp4`, `preview_full_140p.mp4`, `clip_5s_140p.mp4`, `clip_20s_140p.mp4`, `so_far.mp4`: the previews and in-progress cuts sent along the way.
- `notes.md`: reference study, word timings, shot plan.
- `CREDITS.txt`: every asset and its licence. Everything is CC0 or OFL; no attribution is required.

## Pipeline
- Blender 4.5 LTS, Cycles on CPU with OpenImageDenoise.
- Frames rendered at 723×1286, then cleanly upscaled to 1080×1920 (Lanczos + light unsharp).
- Every frame is rendered; no frame interpolation.
- Assembly is frame-exact (frame *f* shows time (f−1)/30 s), so picture and voice cannot drift.
- **Sky and light:**
  - Poly Haven clear-sky HDRI with a sun lamp locked to the HDRI sun. The sky seen by the camera is deepened to a high-altitude cobalt blue.
  - The two finale shots switch to a low golden-hour HDRI and sun, rotated so the warm light falls on the characters.
- **Landscape:** distant Himalaya-style peaks poke out of a sea of clouds, with aerial haze.
- **Snow:**
  - Poly Haven snow with wind-carved ripples and fine sparkle.
  - Blowing-snow streaks are thin motion streaks, never balls.
- **Effects:** steam and breath fog are soft volumetric clouds (never spheres). Depth of field on every close-up.

## Characters
- **Climber:**
  - MPFB2 / MakeHuman male with a plain MakeHuman face (reference style).
  - His gear is generated from his own body mesh, so it deforms with exactly the same weights (no clipping):
    - a quilted orange down suit with black yoke and gaiters, and a hood with a fur ruff;
    - yellow high-altitude boots;
    - big padded black mittens with a separate thumb.
  - Frosty eyebrows.
  - **Black sunglasses**, as you asked mid-job, replacing the beard and the forehead goggles. For the big-eye moments they slide down his nose, cartoon style, so his eyes still act.
- **Friend:** skinnier MPFB2 male, blond, blue down suit (hood down) and red boots. He has a sleepy face, a big yawn and a glare.
- **Rig:** the MPFB "default" rig (163 bones including fingers and face).
- **Arms and legs:** my own exact two-bone solver, baked to keyframes. One rotation layer per bone, so no arm snapping. The A-pose rest is handled in the solver.
- **Faces:**
  - 52 ARKit face shapes (CC0 Faceunits) drive the expressions, pushed a little past realistic for a cartoony read: urgent, shock, shiver, determined, smug, strain, bliss, frustrated, bite, horror, proud, heroic, sleepy, yawn, glare.
  - The mouth follows your voice: a per-frame jaw envelope plus vowel shapes and lip closures.
  - Also: teeth chattering, blinks and eye targets.
- **Cold gags:** a full-body shiver; breath fog when he talks or gasps; frost creeping over the sunglasses lenses; the bare hand turns red, then blue.

## Shots (22 cuts on your word timings, cutting 0.05–0.15 s before each line, like the reference)
| # | time (s) | what you see |
|---|---|---|
| 1 | 0.00–2.60 | Hook: low-angle push-in. The climber does an urgent knees-together dance clutching his stomach; on "poop" his sunglasses slide down to show wide eyes. Prayer flags whip behind him and snow streaks blow across the deep-blue sky |
| 2 | 2.60–4.13 | Frosty dial thermometer on his chest reading −40, then rack focus to his face as frost creeps over his sunglasses; teeth chattering |
| 3 | 4.13–7.03 | From the front: he checks around and unzips (implied), then on "come down" drops into a squat with overshoot. An ice-crystal burst shoots up behind him, he looks shocked (glasses pop up) and shivers all over |
| 4a | 7.03–8.00 | Close insert: mittens slam an ice block into the snow, with a powder puff |
| 4b | 8.00–8.80 | Second angle: the next block is stacked on top |
| 4c | 8.80–9.90 | The little ice wall is done; he ducks behind it as spindrift blows over the top |
| 5 | 9.90–11.06 | "Clever!": smug close-up over the wall. He pushes his sunglasses down with a mitten; sparkle ding |
| 6 | 11.06–13.43 | Straining face… "clink!" (implied, nothing shown); the glasses drop and his eyes go huge |
| 7a | 13.43–15.38 | Close-up: mittens hold a rock over the camping-stove flame; glowing cracks spread through the rock |
| 7b | 15.38–16.38 | He sits on the hot rock: steam bursts around him, with a shocked jolt |
| 8 | 16.38–17.62 | "Much better.": blissful face with the glasses pushed up and eyes closed, steam rising |
| 9a | 17.62–19.70 | He fumbles the toilet-paper roll with his fat mittens; it pops up, he catches it, and frustratedly waves a useless mitten |
| 9b | 19.70–21.13 | He bites the mitten tip and yanks his hand out; the mitten dangles from his teeth while the bare fingers wiggle and turn red, then blue |
| 10a | 21.13–23.00 | Extreme close-up of the blue fingertip: a tiny cartoony frozen brown smudge with frost crystals at the nail |
| 10b | 23.00–23.92 | Horrified face: the glasses slide down, he gasps and a breath-fog cloud comes out |
| 11 | 23.92–26.42 | Tent door close-up: the yellow tent's door rolls open and the friend's sleepy blond head pops out into a huge yawn |
| 12a | 26.42–27.62 | A gust: the toilet paper unrolls from his hand and streams through the air toward the tent, flapping |
| 12b | 27.62–29.03 | The paper slaps across the yawning friend's face and sticks there; he freezes like that |
| 13a | 29.03–30.62 | He proudly holds up the sealed poop bag (cute swirl label), sparkle |
| 13b | 30.62–31.88 | Close-up: the carabiner clicks onto the backpack's gear loop and the bag swings |
| 14a | 31.88–35.38 | Golden light: the heroic pose beside the planted summit flag, backpack on; a glint off his sunglasses on "top of the world" |
| 14b | 35.38–36.40 | He walks off down the ridge in the golden light, the bag swinging from his pack, past the tent |
| 14c | 36.40–37.20 | The friend glares out of the tent with the toilet paper still stuck to his face, the end of it flapping |

Captions: Poppins Bold, white with a thin dark outline and soft shadow, centred at 60 % height, 1–3 words, hard cuts one frame before each word ("DUMBASS" in capitals, as in the reference). The `@garden_reels` watermark is small and semi-transparent, centred at 80 %, for the whole video.

## Sound
- **Voice:** your file, untouched apart from gain: normalised alone to −16 LUFS. All 37.15 s are used, and the last word ends at 37.02 s, inside the video.
- **Effects** (48 files, all CC0: BigSoundBank, Kenney, OpenGameArt, plus a few synthesized), placed on the frame timeline:
  - howling wind bed and gusts, flag flapping, snow-crunch footsteps;
  - teeth chattering, a wordless "brrr" shiver;
  - ice-block thuds, the "clink", stove ignition and roar, a hot-rock sizzle and steam;
  - nylon suit rustles, mitten yank, frost crackle, gasps;
  - tent zipper, paper flutter and slap on the face, zip-lock seal, carabiner click;
  - sparkle dings and a short triumphant brass sting at the end.
- **Music and ducking:** a very quiet CC0 comedy music bed. The effects are ducked about 3 dB and the music about 9 dB under the voice.

## Self-check and fixes
Every shot was checked automatically (black or flat frames, frame-to-frame jump detection) and by eye on frame contact sheets. This happened first on low-res Cycles stills and the 360×640 preview, then on every finished shot of the full render.

**Fixed before or right after the preview:**
- **Characters:**
  - The hood showed ear bumps; it was rebuilt as a smooth shell.
  - Metaball mittens came out lumpy with holes; they were rebuilt as one padded pouch with a thumb and a flared cuff.
  - The beard was removed, and black sunglasses were added instead of goggles, as you asked.
- **Steam:** it read as grey smoke; it is now 5× denser and lit from within, and thinned out so his face stays visible in "Much better".
- **Thermometer:** it was hidden inside the puffy chest; it now snaps onto the suit surface, with his arms clamped at his sides.
- **Cameras:** several were rebuilt from the real prop and character positions:
  - the thermometer and face rack focus, and the mitten inserts;
  - the side view for the flying toilet paper (white paper against white snow became paper against blue sky);
  - the clip-on-backpack shot (his body was blocking the lens), the hero pose, and the ending.
- **Sunglasses:** they now slide far enough down his nose to reveal his eyes.
- **Bitten mitten:** its pivot was moved to his teeth; it had been swinging around the world origin.
- **Cold hand:** the red, then blue colours are stronger so they read against the bright skin shader.
- **Toilet paper on the friend's face:** moved to his lower face so his glaring eyes stay visible.
- **Backpack:** it floated; it is now snapped to the suit's back surface, and its hip belt is hidden.
- **Golden finale:** the sun is rotated to light him from the front, plus a warm grade.
- **Ending:** split into the walk-away and a close-up of the friend's glare.

**Fixed during the full render** (the render itself was never stopped):
- **Sky box (shots 1–2):** a faint translucent box in the sky came from the environment's spindrift volume slab. It is now off; blowing snow comes from fine snow streaks plus soft wisps. This also made the render about 40 % faster.
- **Breath-fog puffs:** they were square-edged, because the Principled Volume glow is not scaled by density. Their glow now follows the fog density and the falloff is rounder. All upcoming shots were patched before the render reached them.
- **Shot 5:** a one-frame pop out of the crouch on "Clever!". The rise is now spread over 6 frames.
- **Shot 6:** soft focus on the "eyes go huge" beat. The focus now tracks his face, with a deeper depth of field.
- **Shot 14a:** the hero was too small in a static wide frame. It is now a low hero angle with a slow push-in.
- Shots 1, 2, 5, 6 and 14a were re-rendered with these fixes.

**Verified:**
- no black frames;
- every flagged jump is an intended action: block slams, punch-ins, the toilet-paper slap and recoils;
- the full 37.2 s of audio is present, and your last word ends at 37.02 s with nothing cut off.

## Things to know
- **No logins needed:** every asset was freely downloadable without an account. Nothing is missing.
- **Licences:** no CC-BY material is used, so no credit line is legally required. Credits are in `CREDITS.txt` as a courtesy.
- **Resolution:** frames were rendered at 723×1286 with 4 samples plus denoising, then cleanly upscaled to 1080×1920. A side-by-side test showed 4 samples look the same as 6 and render about 30 % faster. A native 1080×1920 render would take about 2.2× longer.
- **Synthesized sounds:** the "brrr" shiver is synthesized, because no wordless CC0 recording exists. The gasps are real CC0 breaths, reshaped.
- **Implied gags:** the crude moments are implied, never shown: framing from the front, the "clink", and a cute swirl icon on the bag and the flag.
