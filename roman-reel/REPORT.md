# "Pooping Next to Your Best Friend in a Roman Toilet": delivery report

**Files**
- `roman_toilet_720p.mp4`: the finished reel. 720×1280 (vertical 9:16, as you asked), 30 fps, H.264 High, 1065 frames = 35.500 s, AAC 48 kHz stereo.
- `preview_low.mp4`: the 360-px low-res preview sent earlier.
- `CREDITS.txt`: every asset and its licence. Everything is CC0, OFL or made from scratch; no attribution is required.

## Pipeline
- Blender 4.5 LTS, Cycles on CPU with OpenImageDenoise, AgX (Medium High Contrast).
- Frames rendered at 723×1286 (3 samples, adaptive, plus denoising). They are upscaled to 1080×1920 for the captions (Lanczos plus a light unsharp), then encoded at 720×1280.
- Every frame is rendered; there is no frame interpolation.
- Assembly is frame-exact (frame *f* shows time (f−1)/30 s), so picture and voice cannot drift.
- **Set:** a Roman public latrine.
  - **Bench:** a marble bench with nine keyhole seats, consoles and a riser, plus the water gutter at the feet, with flowing water.
  - **Floor:** a black-and-white mosaic with Greek-key borders and coloured rosettes.
  - **Walls:** Pompeian red, black and ochre frescoes.
  - **Details:** oil lamps on shelves, amphorae, and an open roof with a tiled overhang and beams.
  - **Lighting:** Poly Haven sky HDRI plus a sun, with soft fill lights.
  - The floor and fresco textures are painted procedurally by my own script.
- **Fireball:**
  - a bold cartoon core: a displaced, glowing ball that goes yellow, then orange, then red toward the edges;
  - inside a volumetric fire jet, with a flash light, flying embers and rising smoke;
  - an orange glow inside the keyhole before and after it;
  - a camera shake on the bang.

## Characters
- **You (white tunic, red stripes):** MPFB2 / MakeHuman male with dark hair and brown eyes.
- **Your best friend (ochre tunic):** MPFB2 / MakeHuman male with lighter brown hair and blue eyes. He reads a scroll the whole time and never notices anything.
- **Two extra Romans** fill the row in the wide shot: one reads, one dozes.
- **Clothes:** tunics, belts and strapped sandals are generated from each body mesh, so they deform with the body (no clipping).
- **Rig:** the MPFB "default" rig (163 bones including fingers and face).
- **Arms and legs:** my own two-bone solver, baked to keyframes. Hand-held props (sponge stick, love note, scroll) are attached to the wrist bone every frame, so they never slide out of the hand.
- **Faces:**
  - 52 ARKit face shapes drive the expressions, pushed a little past realistic for a cartoony read: lovestruck, dreamy, nervous, hopeful, disappointed, whisper, puzzled, shock, horror, dazed, deadpan, proud grin, beam.
  - The mouth follows your voice on the spoken lines: a per-frame jaw envelope, vowel shapes and lip closures.
  - Also: blinks and eye targets.
- **Cartoon gags:**
  - pop-in heart eyes that pulse, a blush that rises, sparkle bursts and floating heart bubbles;
  - soot smudges on both faces after the fireball, with smoke wisps rising from their heads.

## Shots (18 cuts on your word timings)
| # | time (s) | what you see |
|---|---|---|
| 1 | 0.00–3.50 | Establishing three-quarter view of the keyhole bench. Your friend reads his scroll; you sit up straight, then on "best friend" sneak a dreamy look at him |
| 2 | 3.50–5.66 | Close-up of you. On "LOVE" the heart eyes pop in, with a love chime, sparkle burst and heart bubbles; you blush and swoon, shoulders up |
| 3 | 5.66–7.94 | Wide shot down the whole row of seats under the open roof, with two more Romans on the bench. You're still heart-eyed |
| 4 | 7.94–10.43 | Waiting for the perfect moment: nervous glances, fidgeting fingers in your lap, a tapping heel. He just keeps reading |
| 5 | 10.43–12.05 | Top-down insert on the bench: your fingers creep across the marble toward his hand |
| 6 | 12.05–15.17 | Without looking up, he pulls the sponge-on-a-stick out of the little jar and puts it in your open hand. Squish, drips, a sad deflating sound; your face falls |
| 7 | 15.17–16.58 | "So you lean in": you gather courage and lean toward him |
| 8 | 16.58–18.20 | Whisper close-up, your hand cupped by your mouth; he turns, puzzled |
| 9 | 18.20–21.23 | The next keyhole starts to glow, you both glance at it… and a cartoon FIREBALL shoots up (whoosh, camera shake). You leap into him, he jerks his scroll up like a shield, and soot lands on both faces |
| 10 | 21.23–24.17 | Aftermath: both dazed and sooty, with smoke curling off your heads and embers glowing in the hole. He slowly turns to give you a deadpan look |
| 11 | 24.17–25.22 | "Clever!": a proud grin. You pull a love note ("AMO TE" with a heart) out of your tunic, with a sparkle ding |
| 12 | 25.22–26.71 | Top-down insert: you slide the folded note across the bench; his hand takes it |
| 13 | 26.71–28.39 | Still reading, he crumples the note and reaches down to the bench's front slot (the wipe is only implied; nothing is shown). You: hands to your cheeks in horror |
| 14 | 28.39–30.77 | "So finally…": a big breath with puffed cheeks, fists clenched, determined, and you turn to him |
| 15 | 30.77–31.79 | "I love you.": close-up with lip sync. The heart eyes pop back, full blush, sparkles and hearts, in a warm rosy grade |
| 16 | 31.79–32.92 | "He smiles.": he lowers the scroll and turns to you with a big smile and a blush, to a harp glissando |
| 17 | 32.92–34.07 | "I love you too…": two-shot. He says it (lip sync), you beam, and a cloud of heart bubbles rises between you |
| 18 | 34.07–35.50 | "…now pass the sponge.": he holds out his palm; your heart eyes deflate away and you stare deadpan toward the camera |

**Captions:**
- Poppins Bold, white with a thin dark outline and a soft shadow, centred at 60 % height.
- 1–3 words each ("LOVE him.", "a FIREBALL!" in capitals), with hard cuts one frame before each word.
- The `@garden_reels` watermark is small and semi-transparent, centred at 80 % height, for the whole video.

## Sound
- **Voice:** your ElevenLabs file, used as-is apart from gain: normalised alone to −16 LUFS. All of it is used (35.40 s), and the last word ("sponge") ends at 35.20 s, inside the 35.50 s video.
- **Effects** (31 files, all CC0 or synthesized), placed on the frame timeline:
  - Roman room tone and a water-trickle bed for the gutter;
  - cloth rustles and a bench creak;
  - sponge squishes and water drips, plus a comedic deflate;
  - a gas hiss, a big fireball whoosh, fire crackle, gasps and a smoke hiss;
  - paper rustles and a crumple;
  - a love chime, heart pops, sparkle dings and a harp glissando.
- **Music and ducking:** a very quiet comedic music bed. Effects, music and beds are ducked under the voice (about 3 dB, 9 dB and 6 dB).
- **Limiter:** a lookahead peak limiter at −1.5 dBFS. The final MP4 measures −17.0 LUFS integrated with a true peak of −1.0 dBFS (AAC).

## Self-check and fixes
Every shot was checked automatically (missing, black or flat frames, and frame-to-frame jump detection). It was also checked by eye on contact sheets: first on low-res stills and the preview, then on the finished full-quality frames.

**Fixed before or right after the preview:**
- **Eyes:** they rendered black. The glass cornea layer was blocking light to the iris; it was fixed per layer, so the irises (brown for you, blue for him) and the highlights now show.
- **Sponge stick:** it sat upside down in the jar; it now stands sponge-down. It is attached to the hand through the whole hand-off, which was rebuilt with proper grips.
- **Heart eyes:** they floated above the eyes from low camera angles; they were moved onto the eyes.
- **Soot:** it looked like camouflage blotches; it is now finer and softer, like smudges.
- **Fireball:** it first read too faint, then too white-hot. It now has the bold cartoon core in yellow-orange-red.
- **Framing:** cameras were moved for the close-ups that cropped faces (shots 2, 14, 15, 16). The two bench inserts (5 and 12) became top-down views of the hands on the marble.
- **Hands:**
  - the whisper hand sat on top of the head; it is now cupped by the mouth;
  - the horror hands were on top of the head; they are now on the cheeks.

**Final check (full-quality frames):**
- all 1065 frames are present;
- no black or flat frames;
- no unintended jumps inside any shot. The only flagged jumps are the fireball flash and your leap in shot 9, both intended;
- the final MP4 decodes cleanly: 1065 frames, 35.500 s, 0 missing frames, captions at 60 % and the watermark at 80 %.

## Things to know
- **No logins needed:** every asset was freely downloadable without an account. Nothing is missing.
- **Licences:** no CC-BY material is used, so no credit line is legally required. Credits are in `CREDITS.txt` as a courtesy.
- **Resolution:** 720×1280 as asked, rendered at 723×1286, so it is essentially native. I can also export a 1080×1920 upscale for Instagram from the same frames (about 3 minutes, no re-render).
- **Render interruptions:** the render was interrupted twice: once by a container restart, once by a 2-hour job limit. It resumed where it stopped each time; no frames were lost or re-rendered differently.
- **Fireball colour:** at full quality the fireball reads as a pale, glowing peach-white ball rather than a deep orange-red one, because the very bright glow is tone-mapped toward white. I can make it more orange and red and re-render only that shot (about 20 minutes).
- **Keep it friendly:** the crude moments are cartoony and implied. You're seen from the front, the note goes down to the bench's front slot off-screen, and there is no bare-bottom detail.
