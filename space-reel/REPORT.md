# "Pooping in Space": delivery report

**Files**
- `space_poop_1080p.mp4`: the finished reel. 1080×1920, 30 fps, H.264 High, 1320 frames = 44.000 s, AAC 48 kHz stereo.
- `preview_low.mp4`: the 360-px low-res preview sent earlier.
- `notes.md`: word timings and the shot plan.
- `CREDITS.txt`: every asset and its licence. Everything is CC0, public-domain NASA imagery, OFL or made from scratch; no attribution is required.

## Pipeline
- Blender 4.5 LTS, Cycles on CPU with OpenImageDenoise, AgX (Medium High Contrast).
- Frames rendered at 723×1286 (3 samples, adaptive, plus denoising), then cleanly upscaled to 1080×1920 (Lanczos plus a light unsharp).
- Every frame is rendered; no frame interpolation.
- Assembly is frame-exact (frame *f* shows time (f−1)/30 s), so picture and voice cannot drift.
- **Space station:**
  - an ISS-style module with an octagonal cross-section;
  - rack panels with labels, status LEDs, knobs, coloured tags and gold-foil patches;
  - strapped cargo bags, handrails, laptops on swing arms, cable runs and floating cable loops;
  - LED light strips in the corners, and an aft hatch into the next module.
- **Toilet bay:**
  - the "waste and hygiene" compartment with blue curtains;
  - the vacuum toilet: seat, hinged thigh bars, foot loops, a ribbed suction hose with a yellow funnel;
  - a big red FAN switch on a swing arm.
- **Earth:** seen through a bolted porthole. It uses the NASA Blue Marble image with procedural clouds and a thin blue atmosphere glow, and it turns slowly during the reel.
- **1969 flashback:** a generic Apollo-style capsule interior: cone walls, a console full of switches and gauges, couches and bright little windows. It is graded as black-and-white archive film with grain, flicker, vignette, dust specks and gate weave.

## Characters
- **You (navy T-shirt, red polka-dot boxers, white socks):** MPFB2 / MakeHuman male, dark hair, brown eyes.
- **Your crewmate (maroon T-shirt, khaki cargo pants):** MPFB2 male, lighter hair, blue eyes.
- **The new guy (blue T-shirt with a "NEW GUY" duct-tape label, grey pants):** a new, younger and rounder MPFB2 face with ginger hair and green eyes.
- **Clothes:** everyone wears a mission patch. For the 1969 flashback all three switch to white coveralls. All clothes are generated from each body mesh, so they deform with the body (no clipping).
- **Rig and limbs:** the MPFB "default" rig (163 bones, fingers and face). My own two-bone solver is baked to keyframes, and hand-held props (roll, tortilla, pouch, pen, radio mic) are attached to the wrist bone every frame.
- **Zero-g animation:**
  - Whole bodies float, drift and tumble.
  - Arms and legs settle into the relaxed "neutral body posture" astronauts really have in orbit.
  - Sweat forms little floating beads that drift off your forehead, and the face gets a wet sheen.
- **Faces:**
  - 52 ARKit face shapes drive the expressions, pushed a little past realistic: content, smug, strain, shock, panic, nervous, idea, proud grin, wheee, bliss, horror, disgust, guilty, gasp, deadpan, serious.
  - The mouth follows your voice on the spoken lines ("Not me" ×3 and "Houston… we have a problem").
  - Also: blinks and eye targets, including shifty guilty eyes on your "Not me".

## Shots (23 cuts on your word timings)
| # | time (s) | what you see |
|---|---|---|
| 1 | 0.00–1.55 | Hook: you relaxing on the space toilet, Earth in the porthole, a plush duck and a pen floating by |
| 2 | 1.55–3.45 | Your hand flips the big red FAN switch and the green light comes on |
| 3 | 3.45–4.45 | The vacuum funnel sucks in floating crumbs, the hose rattles |
| 4 | 4.45–7.80 | The suction grabs the paper; on "rips" the roll is yanked out of your hand and shoots off, unrolling, with a camera shake |
| 5 | 7.80–10.80 | Down the station: the roll zig-zags off the walls, trailing paper; your crewmate ducks at his laptop, and the roll ends at the far hatch |
| 6 | 10.80–13.05 | You stare at your empty hand, then at the camera: sweat beads float off your forehead |
| 7 | 13.05–15.62 | You float up off the seat, arms flailing; the thigh bars pop open |
| 8 | 15.62–17.05 | Tumbling slowly in zero gravity among the floating duck, pen, spoon and tortilla |
| 9 | 17.05–17.92 | "Clever!": the idea face, finger up, sparkle ding |
| 10 | 17.92–19.00 | Superman push-off from the bay wall, flying toward camera |
| 11 | 19.00–22.70 | You sit on the stretched toilet paper and glide down the whole station like a zip line, arms up on "zip line", past your deadpan crewmate |
| 12 | 22.70–23.32 | "Then…": blissful relief |
| 13 | 23.32–25.98 | A little brown cartoon swirl drifts slowly past the porthole, in front of Earth |
| 14 | 25.98–27.36 | "What the fuck.": horror, with a camera bump |
| 15 | 27.36–28.96 | All three astronauts freeze around the floater, mid-tortilla and mid-drink |
| 16–18 | 28.96–31.40 | "Not me." from your crewmate, then the new guy, then you (shifty eyes) |
| 19 | 31.40–34.42 | Black-and-white 1969 film: three astronauts in white coveralls in the capsule |
| 20 | 34.42–37.96 | The floater drifts between them; they recoil in disgust |
| 21 | 37.96–40.02 | Each one points at another and shakes his head |
| 22 | 40.02–41.90 | Back in colour: you point at the new guy, your crewmate points too, and the new guy gasps |
| 23 | 41.90–44.00 | "Houston… we have a problem." into the radio mic; behind you the floater bonks the new guy on the nose |

**Captions:**
- Poppins Bold, white with a thin dark outline and a soft shadow, centred at 60 % height.
- 1–3 words each ("in SPACE," "it RIPS", "something BROWN", "NEW GUY."), with hard cuts one frame before each word.
- The `@garden_reels` watermark is small and semi-transparent, centred at 80 % height, for the whole video.

## Sound
- **Voice:** your ElevenLabs file, used as-is apart from gain: normalised alone to −16 LUFS. All 43.96 s are used, and the last word ("problem") ends at 43.80 s, inside the 44.00 s video.
- **Effects** (55 files, all CC0 or synthesized), placed on the frame timeline:
  - station fan hum with distant computer chirps;
  - the FAN switch click, vacuum spin-up and suction roar;
  - a paper rip, roll flutter and cardboard bonks;
  - sweat bloops, a boing and slide whistle as you float off, a zero-g wobble;
  - the idea ding, the zip-line whizz;
  - a "bwomp bwomp" for the floater, a gasp with "dun dun duuun", a freeze stab and tape stop;
  - question blips for each "Not me";
  - 1969 film-projector rattle, Quindar beeps and radio squelch.
- **Music:** a quiet CC0 goofy music bed. It drops out for the 1969 flashback (the projector takes over) and comes back for the ending.
- **Mix:** effects, music and beds are ducked under the voice, with a lookahead limiter at −1.5 dBFS. The final MP4 measures −15.8 LUFS integrated with a true peak of −1.7 dBFS (AAC).

## Self-check and fixes
Every shot was checked automatically (missing, black or flat frames, and frame-to-frame jump detection). It was also checked by eye on contact sheets: on test stills, on the full preview, and on the finished full-quality frames.

**Fixed along the way:**
- **Hands and eye lines:** the hand and eye targets were computed from a stale body position, so hands missed the switch and the roll and eyes looked the wrong way. This was fixed for every shot.
- **Lighting:** the first station lighting blew everything out to white. Lights were rebalanced, and the panels got more colour and clutter.
- **Porthole:** it first showed a blank wall (a hidden end cap). Earth's horizon was then raised so the planet shows from every camera angle.
- **Shirts:** they first rendered pastel, and the hem dipped into a bodysuit shape. They are now darker, with a straight untucked hem.
- **Sweat sheen:** it read as pale plastic and was toned down.
- **Framing fixes:**
  - the FAN switch was moved within reach of your hand;
  - the suction close-up camera was moved out from between your knees;
  - the push-off now flies toward the camera instead of into it;
  - the "freeze" and "point" shots were recomposed so all three astronauts read;
  - one camera that sat inside a wall rack was moved out.

**Render:**
- The full render was stopped once by the 2-hour job limit and resumed where it stopped. One frame cut off mid-write was re-rendered.
- **Final check:** all 1320 frames are present, with no black or flat frames. The only flagged jump is the intended camera shake when the roll rips out of your hand.
- **Final MP4:** decodes cleanly: 1080×1920, 1320 frames, 44.000 s, 0 missing frames, captions at 60 % and the watermark at 80 %.

## Things to know
- **No logins needed:** every asset was freely downloadable without an account. Nothing is missing.
- **Licences:** no CC-BY material is used, so no credit line is legally required. Credits are in `CREDITS.txt` as a courtesy.
- **Resolution:** frames were rendered at 723×1286, then cleanly upscaled to 1080×1920 for Instagram.
- **Earth texture:** a 2048-px NASA image, so the planet is slightly soft up close; it reads fine through the porthole.
- **1969 flashback:** a generic cartoon take on an Apollo-style capsule and crew, not a replica of the real spacecraft or a portrayal of the real astronauts.
- **Keep it friendly:** the crude moments stay cartoony and implied. You keep your boxers on the whole time, the "floater" is a small cartoon swirl, and the wipe is only implied by the zip-line glide.
