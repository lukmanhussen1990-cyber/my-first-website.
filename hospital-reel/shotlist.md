# Hospital waiting room reel - shot list

Voice: ElevenLabs Dan (`BHr135B5EUBtaWheVj8S`), `eleven_v4`, `[calm, deadpan]`.
Video: 1080x1920, 30 fps, 71.6 s, 40 shots, all rendered in 3D (three.js, blocky low-poly).

| Shot | Time | Caption(s) | What happens |
|---|---|---|---|
| 01 | 0.00-1.24 | You came to visit / your friend. | He walks in through the glass doors with flowers, happy. |
| 02 | 1.24-3.20 | At a psychiatric hospital. | Wide bright waiting room: woman reading, two men playing cards, man watering plants. |
| 03a | 3.20-4.53 | And you just | Side view, sitting normally with flowers. |
| 03b | 4.53-5.34 | pooped your pants. | SAME camera: lump in his jeans, stain, stink lines, head turns, wide eyes. Punch-in + shake + squish. |
| 04 | 5.34-7.28 | In the waiting room. | Front: big stink lines to the ceiling, card player politely turns to look. |
| 05 | 7.28-8.92 | You try to act normal. | Holding a magazine upside down, stiff grin. |
| 06 | 8.92-9.84 | You walk sideways. | Crab-walk sideways along the wall, lump out. |
| 07 | 9.84-12.02 | Very slowly. | Extremely long hallway, he is tiny and barely moving. Sneaky music. |
| 08 | 12.02-13.52 | You whisper to yourself: | Whispering to himself against the wall. |
| 09 | 13.52-15.70 | "It's fine. / It's fine." | ECU: "It's fine", eye twitching, sweat pouring. |
| 10 | 15.70-16.80 | You sweat. | Sweat drops rolling. |
| 11 | 16.80-17.96 | A lot. | Sweat sprays like a sprinkler, the plant perks up. |
| 12 | 17.96-19.54 | A doctor / is watching you. | Over his shoulder: doctor watching over his glasses (zoom). |
| 13 | 19.54-21.08 | He writes something down. | Doctor writes on the clipboard. |
| 14 | 21.08-22.82 | Then he underlines it. | Clipboard ECU: red underline, twice. |
| 15 | 22.82-24.15 | You smile at him. | Small awkward smile. |
| 16 | 24.15-25.71 | That makes it worse. | Huge creepy grin, zoom hits on dun-dun-DUN. |
| 17 | 25.71-26.99 | He walks over. | Low angle: doctor walks over. |
| 18 | 26.99-29.05 | "How are you / feeling today?" / You say: | Doctor leans in, kind: "How are you feeling today?" |
| 19 | 29.05-30.93 | "I just need / a bathroom." | Begging: "I just need a bathroom." |
| 20 | 30.93-32.23 | He nods. / And hands you | Doctor nods, holds up a wristband. |
| 21 | 32.23-33.19 | a wristband. | Slow-mo ECU: wristband snaps shut, click. |
| 22 | 33.19-35.46 | It already has / your name on it. | He stares at the wristband ("YOU" label). |
| 23 | 35.46-38.02 | What you don't know: | Old 1970s projector (sepia, film grain). |
| 24 | 38.02-40.16 | in 1973, / a scientist sent | 1973 scientist, finger raised. |
| 25 | 40.16-43.24 | healthy people / into psychiatric hospitals. | 1970s people walk into a hospital. |
| 26 | 43.24-44.70 | They all got admitted. | 1970s nurse gives them wristbands, surprised faces. |
| 27 | 44.70-47.86 | Some couldn't get out / for almost two months. | Bored 70s guy with a long beard by the window, leaves falling. |
| 28 | 47.86-48.78 | Week one. | Calendar: pages fly off, WEEK 1. |
| 29 | 48.78-51.24 | You keep telling them / you're fine. | Thumbs up to the nurse, "I'm fine". |
| 30 | 51.24-52.28 | Week two. | Calendar: WEEK 2. |
| 31 | 52.28-55.15 | You still haven't / changed your pants. | Slumped, tired, big stink lines, plant wilted. |
| 32 | 55.15-56.21 | Week three. | Calendar: WEEK 3. |
| 33 | 56.21-57.15 | Your file / is very thick. | Nurse wobbles carrying a giant file. |
| 34 | 57.15-58.11 |  | BOOM on the desk: dust and papers fly. |
| 35 | 58.11-60.91 | Every page says / the same thing: | Sitting in a huge pile of paperwork holding a page. |
| 36 | 60.91-63.37 | "Patient talks / about poop a lot." | Pages flip, each says "Patient talks about poop a lot." |
| 37 | 63.37-65.05 | Your friend / gets discharged. | Friend walks out into the sunshine, waving. |
| 38 | 65.05-67.25 | He waves goodbye. | He waves sadly behind the glass door. |
| 39 | 67.25-71.56 | Enjoy your stay. | Sunset, stink lines from one window, slow zoom out. |

## Rebuild
```
python3 make_shots.py
cd render && node render.js frames ../out/frames   # 3D frames
python audio/mix.py                                 # sound (numpy, soundfile, librosa)
python3 compose.py final.mp4                        # captions, effects, encode
```
`compose_images.py` + `prompts.md` are the alternative path if you want to use ChatGPT images instead.
