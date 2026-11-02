# Wedding poop reel - shot list

Voice: ElevenLabs **Dan** (`BHr135B5EUBtaWheVj8S`), model `eleven_v4`, `[calm, deadpan]`.
Video: 1080x1920, 30 fps, 65.1 s, 34 shots. All visuals rendered in 3D (three.js, blocky low-poly).

| Shot | Time | Caption(s) | What happens |
|---|---|---|---|
| 01 | 0.00-1.52 | You're getting married. | Wide: beautiful outdoor wedding, flower arch, guests, slow push-in. Romantic music. |
| 02 | 1.52-3.64 | Three hundred guests / are watching. | Guests in their chairs, all looking at camera. Slow pan. |
| 03 | 3.64-5.42 | You're saying your vows. | Two-shot at the altar: groom, bride, priest under the arch. |
| 04a | 5.42-6.23 | And you just | Groom at the altar holding her hands, normal (side view). |
| 04b | 6.23-7.68 | pooped your pants. | SAME camera: big round lump in his trousers, brown stain, green stink lines, wide eyes. Punch-in + shake + squish, music record-scratch stop. |
| 05 | 7.68-9.20 | You keep talking. | Close-up groom, forced grimace, sweat drops. |
| 06 | 9.20-11.14 | "I promise / to love you..." | Closer: groom trembling, "I promise to love you..." |
| 07 | 11.14-12.70 | Your voice / is shaking. | Extreme close-up, mouth shaking (screen shake). |
| 08 | 12.70-13.72 | "...forever." | Bride close-up, sweet happy smile, blush. |
| 09 | 13.72-15.32 | The priest leans in. | Priest slowly leans in toward the groom. |
| 10 | 15.32-16.48 | He sniffs. | Extreme close-up priest nose: big sniff. |
| 11 | 16.48-17.80 | He leans back. | Priest leans back, disgusted, glasses slide. |
| 12 | 17.80-19.86 | The photographer / moves closer. | Photographer crouch-walks toward the couple (groom lump visible). |
| 13 | 19.86-20.89 | Close-up. | Photographer crouched between them, camera in the groom's face. |
| 14 | 20.89-23.01 | Click. / Click. Click. / Click. Click. Click. | POV through his lens: Click x3, white flash each click, groom squints. |
| 15 | 23.01-24.66 | She holds your hands. | Joined hands (black sleeves + white sleeves). |
| 16 | 24.66-26.12 | She starts crying. | Bride starts crying (blue blocky tears grow). |
| 17 | 26.12-27.28 | Happy tears. | Happy tears streaming, slow zoom. |
| 18 | 27.28-28.62 | Then she sniffs. | Slow zoom onto her nose, sniff. |
| 19 | 28.62-29.96 | The tears stop. | Tears stop. Frozen face. Crowd gasp. |
| 20 | 29.96-32.28 | The flower girl / stops throwing flowers. | Flower girl frozen mid-throw, petals falling in slow motion. |
| 21 | 32.28-34.41 | The ring bearer / covers his nose. | Ring bearer pinching his nose, ring pillow shaking. |
| 21b | 34.41-35.96 |  | Close-up: ring bouncing on the shaking pillow (pause). |
| 22 | 35.96-37.28 | What you don't know: | Giant hand pops in ("boing"). |
| 23 | 37.28-39.14 | we wear the ring / on the fourth finger | Fingers count 1-2-3-4, ring finger glows. |
| 24 | 39.14-40.92 | because the ancient / Romans believed | Sepia ancient Rome: Roman in toga, finger raised. |
| 25 | 40.92-44.00 | a vein ran straight / from it to the heart. | Sepia: glowing red vein grows from the ring finger to a cartoon heart. |
| 26 | 44.00-46.14 | Right now, / her heart is fine. | Bride portrait, cartoon heart beating on her chest (heartbeat sound). |
| 27 | 46.14-47.46 | Her nose is not. | Extreme close-up: her nose twitching, stink lines. |
| 28 | 47.46-50.08 | "Do you take this man?" | Priest pinching his nose: "Do you take this man?" |
| 29 | 50.08-57.34 | Long pause. / Very long pause. | Silent hold, only crickets. Slow push-in from wide to her face. |
| 30 | 57.34-58.48 | "I do." | Bride holding the bouquet over her nose: "I do." |
| 31 | 58.48-61.13 | From five metres away. | High wide reveal: she is 5 m away down the aisle, everyone pinching noses. |
| 32 | 61.13-65.12 | Congratulations. | Wide: confetti, green stink lines rising over the arch, church bells. |

## How to rebuild
```
python3 make_shots.py                      # shot + caption timing from audio/timeline.json
cd render && node render.js frames ../out/frames   # 3D frames (headless Chromium)
python audio/mix.py                         # music + SFX + voice (needs numpy, soundfile, librosa)
python3 compose.py final.mp4                # captions, effects, encode
```
