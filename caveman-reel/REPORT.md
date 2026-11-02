# "Delivering the Nuclear Power Plant": delivery report

**Files**
- `caveman_reel_final.mp4`: 1080×1920, 30 fps, H.264 High, 900 frames = 30.000 s, AAC 256 kb/s 48 kHz.
- `preview_140p.mp4`: the earlier quick preview.
- `notes.md`: reference study, word timings, shot plan.
- `CREDITS.txt`: all assets and licences.

## Pipeline
- Blender 4.5 LTS, Cycles on CPU with OpenImageDenoise.
- Frames rendered at 720×1280 (6 samples + denoise, fast GI, motion-friendly adaptive sampling), then upscaled cleanly (Lanczos + light unsharp) to 1080×1920 at assembly.
- Every frame is rendered; no frame interpolation. Assembly is frame-exact: frame *f* shows time (f-1)/30 s, so picture and voice cannot drift.
- Sky: Poly Haven clear-sky HDRI (sun hotspot clamped), plus a sun lamp aligned to the HDRI sun. Shots 1a and 4 rotate sky and sun together so the light comes from behind the camera.
- Distance haze; real geometry grass; displaced ground, thatch and stone.
- Volumetric steam and dust; depth of field on the close-ups.

## Character
- **Body:** MPFB2 / MakeHuman. A plain young MakeHuman face in the reference style, as you asked mid-job, with slightly larger eyes for readability.
- **Rig:** the default rig, 163 bones including fingers and face.
- **Hair:** long, dark-brown, centre-parted strands like the reference. These are real curves bound to the skin, so they follow the head and the face shapes.
- **Outfit:** MakeHuman collared shirt and trousers retextured as orange fur with dark spots. Bare feet; no logo t-shirt anywhere.
- **Face:** 52 ARKit face shapes (CC0) drive the expressions: annoyed, love, smug, strain, shrug, excited, deadpan, proud. The mouth follows the voice: a per-frame jaw envelope plus vowel shapes from the transcript and lip closures on m/b/p. There are also blinks and eye targets.
- **Tongue out:** on the heart-eye beats (shots 2 and 11), as you asked.
- **Arms and legs:** my own exact two-bone solver, baked to keyframes. Blender's IK mis-aimed the elbows on this rig's twist bones, so I replaced it. Hands land exactly on what they grip, elbows and knees point where intended, and there's one rotation layer per bone, so no snapping.
- **Fingers:** curl for grips, fists, the pointing index and spread hands.
- **Heart eyes:** glossy candy-red, pop with overshoot, then pulse like a heartbeat.
- **Third arm:** built only from vertices that are 100% arm-weighted, so no stretched skin. It has its own mini-rig parented to the chest and a glowing green material, pops out with an overshoot, then waves with a bounce.

## Shots
| # | time | what you see |
|---|---|---|
| 1a | 0.00–2.20 | Hook: low angle, wooden mailbox "theoddtilt" in the foreground; the caveman hauls the steaming cooling tower up the path on a rope behind it |
| 1b | 2.20–3.93 | He holds up a stone-framed "phone" showing a landscape with no power plant (with a video play bar), jabs at it, glares at camera |
| 2 | 3.93–6.07 | Close-up cradling a toy cooling tower; on "LOVE" a camera punch, heart eyes pop, tongue out, sparkles, loving sway |
| 3 | 6.07–8.73 | "Roll-safe" temple tap with smug grin; punch-in and sparkle ding on "genius" |
| 4 | 8.73–11.50 | Front three-quarter: the giant steaming tower on his back, heavy shaking steps, sweat drops, toward the house |
| 5 | 11.50–13.43 | Side-on: tower jammed in the open doorway, he shoves with his whole body, feet slipping, door frame creaking |
| 6a | 13.43–14.90 | He rams the tower's top end at the tiny window |
| 6b | 14.90–16.00 | Punch-in: hands on hips, smug "Clever!" to camera |
| 7 | 16.00–17.87 | Tower stuck, glass cracks; camera follows him into a shrug to camera |
| 8a | 17.87–19.87 | On the roof ridge he shoves the upside-down tower onto the chimney |
| 8b | 19.87–21.53 | The chimney crumbles (each stone block tumbles) into a dust cloud; the tower drops in; he hops clear and looks at camera |
| 9a | 21.53–23.37 | He heaves the tower upright in the yard, it thumps down, a proud pat |
| 9b | 23.37–24.27 | Close-up: his hand pushes the yellow plug into the wall socket on "in" |
| 10 | 24.27–25.30 | Wide: windows glow warm, steam puffs, big fist pump |
| 11 | 25.30–30.00 | Close-up: heart eyes and tongue again; on "third arm" a green glowing arm pops out of his chest and waves goodbye with a bounce |

Captions use Poppins Bold: white, thin dark outline, soft shadow, centred at 60 % height, 1–3 words each, hard cuts one frame before each word. The `@garden_reels` watermark is centred at 80 %, semi-transparent, for the whole video.

## Sound
- **Voice:** your ElevenLabs file, untouched apart from gain: normalised alone to −16 LUFS (it's 28.68 s, so no trimming or speed change).
- **SFX** (85-file CC0/CC-BY library), placed on the frame timeline:
  - rope haul and footsteps on each heel strike;
  - wordless effort grunts;
  - door creak, wood jam and thunks;
  - glass crack and tinkle;
  - chimney crumble and heavy thumps;
  - plug click, power-up hum, lights-on zap, steam puff;
  - boing and love chime for the heart eyes, idea ding, shrug blip, whooshes on punch-ins;
  - squelchy pop for the third arm.
- **Beds and ducking:** quiet birds and wind, plus a very low CC0 comedy music bed. The SFX are ducked about 3 dB and the music about 9 dB under the voice.
- **Master:** final mix −16.0 LUFS, peak −1.4 dBFS. The last line is intact.

## Self-check and fixes
I checked each shot automatically (black or flat frames, frame-to-frame jump detection) and by eye on frame contact sheets.

**Fixed after the low-res preview:**
- the camera missed the caveman in shots 1b and 6b (the camera was placed before the character's position updated);
- the toy tower's steam rendered as a grey blob in front of his face;
- a near grass blade streaked across the hook, and the rope was hidden.

**Fixed in round 2 of the full render:**
- **Shot 4:** tighter framing so he reads; removed a roof-edge sliver.
- **Shot 7:** the camera now follows him into the shrug instead of losing him at the frame edge.
- **Shot 8b:** the dust cloud was invisible (its copied material read the hidden original's density); the tower now tips away and he stays visible.
- **Shot 9b:** the plug now actually goes into the socket (he was on the wrong side and out of reach).
- **Shot 11:** for about 3 frames the third arm flashed out of his hip. It's now solved exactly with a clean pop; frames 826–900 were re-rendered.

**Verified clean:** no black frames, no unintended jumps (every flagged jump was an intended punch-in or pop), the full 30.000 s of audio is present, and the voice ends at 28.59 s with the tail intact.

## Things to know
- **No logins needed:** every asset was freely downloadable without an account. Nothing is missing.
- **Cut short:** the world-building helper agent was stopped mid-job, so I finished the world myself from its modules. The world matches the reference style (meadow, spotty grey boulders, broccoli trees, clear sky) plus a cosy thatched cottage.
- **Resolution:** frames were rendered at 720×1280 and upscaled to keep the total render to about 4 hours on this CPU-only machine (your stated minimum). A native 1080×1920 render would take roughly 2.3× longer.
- **Required credit:** one CC-BY item needs a credit line in the post: the effort grunts, "Valiant Genericus (Effort Noises)" by tinsin, CC-BY 3.0. The line is at the top of `CREDITS.txt`.
