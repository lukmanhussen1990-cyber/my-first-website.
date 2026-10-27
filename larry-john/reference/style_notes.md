# Reference style notes: "$20 backyard tent → 5-star hotel" reel

How I studied it:
- `ffprobe`: 720x1280, H.264 High, 30 fps, 107.27 s (3,218 frames); HE-AAC stereo, 44.1 kHz.
- 1 frame per second → `frames/` (107 frames), 9 contact sheets in `contact_sheets/`.
- Full-size stills of close-ups, wide shots and labels in `fullsize/`.
- Local Whisper transcription with word timestamps → `reference_transcript.txt` / `.json`.
- Loudness (ffmpeg ebur128) and spectrograms (`spectrogram_*.png`).

We copy the STYLE, PACE and FORMULA only. We do not copy any characters, names, story, lines, signs, shots, audio or footage.

---

## 1. Pace and story formula

| Measure | Reference |
|---|---|
| Length | 1:47 (107.3 s) |
| Words | 473 → **4.4 words per second** (fast, almost no pauses) |
| Gaps between sentences | 0.1 to 0.3 s |
| Shots | about 82 real shots (ffmpeg finds about 129 changes, but some are whip moves and flashes) |
| Cut rhythm | a new shot every 0.8 to 1.5 s; every sentence gets its own shot, and long sentences get 2 or 3 |
| Loudness | **-14.1 LUFS** integrated, loudness range only 2.3 LU (heavily compressed, voice-forward) |

Formula, with timestamps:
- **Hook (0.0 to 4.9 s):** "If you [do a tiny cheap thing]… **Congratulations, you've built a [thing].**" The first sentence is under 4 s.
- **First joke right away (5 to 7.6 s):** "A hotel with **zero stars** and approximately **4,000 mosquitoes**." A red number label pops in on the punchline.
- **About 20 "problem → So you [upgrade]" steps (7.6 to 73 s).** Each step is 1 to 3 sentences: problem, then "So you…", then the upgrade, then the character ruins it, plus a one-line roast ("Bro, you have one job!"). Count-ups appear on screen ("10 rooms, 50 rooms, 200 rooms").
- **Second "Congratulations!" at the top (73.9 s, 69% of the way through).**
- **Twist set up early:** Grandma throws a shoe at 23 s, then owns the land at 95 s.
- **Final line loops back to the opening shot** (the tent and the $20 sign, 106 s).

## 2. Characters

- **Proportions:** about 3.5 to 4 heads tall. The **head is huge and round** (a near-perfect sphere), on a pear-shaped torso (wider at the belly) with short thin capsule arms and legs, mitten or blob hands, and small blocky shoes. No visible neck.
- **Face = flat 2D "stickers" on the 3D head:**
  - Eyes: white circles with a **thick black outline** (about 8% of the eye width) and a small black pupil with a tiny white highlight. The pupil position changes the look (shocked = tiny centered pupils).
  - Lids: a flat line across the eye for bored or smug looks, with a grey-blue tinted upper part. Happy = closed "^ ^" arcs. Laughing or pain = "> <" chevrons.
  - Mouth: a flat black outline. Open mouths are dark red inside with a pink tongue; smiles are a "D" shape with a white tooth row.
  - Brows: short dark strokes, used only for angry or worried looks.
  - **Blush:** soft pink ovals on the cheeks. **Freckles:** 3-dot clusters in orange-brown.
  - **Nose:** a small 3D ball in skin colour (the only 3D facial feature). Ears are small half-spheres.
- **Hair:** chunky 3D shapes. The hero has brown cone spikes; others have caps or buns. Everything has rounded tips.
- **Materials:** matte "clay or vinyl toy" look. Roughness is high (about 0.6 to 0.8) with a soft broad highlight. No textures, only flat colours. Skin is warm peach; clothes are saturated but slightly soft (orange hoodie, blue jeans, green tee).
- **Acting:** big arm poses (both arms up = cheering), head tilts, sweat drops, lean-ins. Faces swap instantly between expressions with no in-between.

## 3. World

- **Lawn:** wide mowed stripes alternating light green (about #86c95a) and darker green (about #5fae43), each about 2 to 3 m wide, plus sparse dark-green **grass tufts** and tiny white daisies.
- **Stepping stones:** flat, light-grey, low-poly 12-sided discs with a slight bevel, leading into the frame from the bottom-left.
- **Backdrop:** white picket fence, vegetable-garden rows, a red wagon, white houses with **orange-red roofs, blue windows and shutters** and chimneys, round low-poly trees (clusters of faceted blobs on brown trunks), and hazy **white hills** on the horizon.
- **Sky:** blue gradient, darker at the top (about #6f86bd) and pale near the horizon. **Big puffy faceted cumulus clouds** plus small flat-bottomed cloud strips. There is strong aerial haze: distant objects fade towards pale blue-grey.
- **Props:** chunky and readable (cardboard signs with tape, chunky dials, a brass bell), always slightly oversized.

## 4. Lighting

- EEVEE-style daylight: one warm-white sun with **soft, slightly blurred shadows**, a strong cool sky fill, **ambient occlusion** in creases, and **gentle bloom** on lamps, glass and sparkles.
- High-key, low contrast, slightly desaturated filmic look. Shadows are never black; they are blue-grey.
- Interiors use soft overhead light and practical lamps (chandelier bulbs glow). Bad weather turns the grade cool blue-grey with rain streaks.
- **There are no real night scenes**, so our Halloween night must be our own look: bright moonlight, coloured accent lights and faces always lit.

## 5. Camera

- **Wide establishing shot** from about 1.3 to 1.6 m high across the lawn: the subject sits a third of the way in, stones lead in from the bottom-left, and the horizon is at about 38 to 45% from the top. It is reused when the building upgrades.
- **Face close-ups with a wide lens** (about 24 to 28 mm equivalent): heads fill a third to half of the frame and bulge slightly towards the camera. These are the funniest shots.
- **Low-angle hero shots** looking up at buildings or characters, plus **drone shots** high over the suburb grid for "it got huge".
- **Inserts:** extreme close-ups of props (dial, bell, bill, cereal bowl).
- The camera is never fully locked: slow push-ins, drifts and small arcs, with whip moves between some shots. Some close-ups have shallow depth of field.

## 6. Captions (subtitles)

- **One word at a time**, synced to the voice, with no line breaks. **The first letter of each word is capitalized** ("Approximately", "Backyard").
- Rounded bold sans (Fredoka-like, weight about 600). White fill, **thin dark outline** (about 0.4% of frame width) and a soft dark drop shadow.
- **Key words in yellow** (#FFE03A-ish): nouns and hooks such as "Tent", "Mosquitoes", "Floods", "Shower", "Restaurant", "$20".
- Size: cap height about 2.7% of frame height (smallish). Position: horizontally centred, vertically at **about 52 to 53% from the top** (dead centre).
- Trailing punctuation is dropped ("$47,000?" shows as "$47,000").

## 7. Big text labels

- Very heavy, wide, slightly rounded display font in ALL CAPS. **Thick dark outline** plus a dark **extrusion or shadow down-right**, so the letters look 3D.
- Colours: **red = problem** ("0 STARS", "4,000", "BATHROOMS: 0", "-3 STARS", "$47,000?!"), **yellow = upgrade** ("WATER HEATER", "200 ROOMS", "ELEVATORS", "RESTAURANT", "$500,000,000"), **green = win** ("BOOKED!").
- **Tilted about 3 to 6°** (rising to the right) and placed in the **upper third** (about 30 to 35% from the top), sometimes overlapping the subject. Width is up to 80% of the frame. Cap height is about 4% of frame height, so labels are bigger than captions.
- Labels stay about 1 to 1.5 s while the captions keep running below them, and they pop in on the punchline word.

## 8. Sound

- A fast, playful adult male narrator, up-front and dry. Character lines are acted inside the narration (a pitch jump for screams like "$47,000?!").
- **Soft music bed under the whole reel** (a constant low-frequency bed in the spectrogram), much quieter than the voice.
- Effects support the action (rain noise from 10.8 to 20 s, pops, whooshes), sitting under the voice.

## 9. Where we will be BETTER (our targets)

1. **Smoother animation:** every frame is rendered, with squash and stretch, anticipation, overshoot and settle, plus blinks and breathing on every character in every shot.
2. **More expressive faces:** a bigger expression set (happy, shocked, scared, screaming, bored, annoyed, and more), with brows and eye-shape changes, swapped right on the beat.
3. **Richer lighting:** golden hour → dusk → moonlit night with coloured accents (pumpkin orange, fog green, purple, moon blue), rim lights and bloom, while faces stay clearly lit.
4. **A joke in every step:** no list-only sentences, and every step ends on a gag or reaction shot (John's facepalm as a running gag).
5. **A sound effect on every action,** a music stop at midnight, and a sting on the payoff.
6. **Hidden ghost** easter eggs to reward re-watching, and a perfect loop where the last shot matches the first.
