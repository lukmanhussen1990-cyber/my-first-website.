# "Pooping on Top of Mount Everest": delivery report (draft)

**Files**
- `everest_reel_final.mp4`: 1080×1920, 30 fps, H.264 High, 1116 frames = 37.200 s, AAC 256 kb/s 48 kHz.
- `preview_low.mp4`: the earlier quick low-res preview.
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
