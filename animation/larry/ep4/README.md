# Episode 4: "Fresh Batch"

A 52.6-second vertical short (1080×1920, 24 fps) cut to the user's voiceover (ElevenLabs "Mark"). It has 32 shots and 1262 frames. The audio is **voice only**.

Every night at 3 AM, Larry and Dale fly in through your window to sniff your underwear. You lock the window, hide your boxers in a safe, get a guard dog, stop wearing underwear, and finally move into a concrete house with no windows and no chimney. That night you open your laundry hamper and two faces smile up at you: "Fresh batch?"

**Status: done (2026-11-20).** Both videos were delivered to the user:
- `larry_ep4_final.mp4`: captions burned in.
- `larry_ep4_clean.mp4`: no captions.

Render outputs live in `$LARRY_WORK/ep4/` and are not committed.

## Cast

- `larry` and `dale` (unchanged). Dale doubles as the "guard dog" (all fours, red collar, kennel named DALE).
- New in `scripts/build_character.py`:
  - **`you_night`**: you in a plain white tee and pyjama trousers.
  - **`you_casual`**: you in a casual suit and shoes (daytime, the bunker move).

## Sets

All sets are in `shots.py`. Episode 1's bedroom and the Episode 2–3 helpers are reused.

| Set | What's in it |
|---|---|
| Night bedroom | Opening window, moon sky, dresser with a drawer, red LED alarm clock (2:59 → 3:00) |
| House at night | Exterior with chimney, front yard, kennel, BEWARE OF DOG sign |
| Living room | Fireplace that Larry and Dale climb out of in a soot cloud |
| The vault | A hinged UNDERWEAR VAULT safe with a dial and Larry's sticky note |
| The bunker | Concrete cube: NO WINDOWS / NO CHIMNEY / NO UNDERWEAR sign |
| Bunker room | Bed with a draped duvet, bare bulb, big wicker laundry hamper full of clothes |

Procedural props: heart-print boxers, collar and leash, soot cloud, safe, kennel, hamper (tileable wicker texture from `make_decals.py`), crumpled laundry, a duvet draped from the sleeping body's shape.

New helpers in `shots.py`:
- `pose_seq(ch, [(frame, overrides), ...], n)`: an animated edited-mocap pose (eased between keys), e.g. leaning in, then straightening up.
- `clip_below(ch, z)`: hides a character below a height (the two men buried in the hamper).
- `blanket_over(ch, ...)`: drapes a duvet over a lying character.

## Checks

- `preview_all.sh`: 3 stills per shot at 50%.
- `motion_all.sh`: every 3rd frame at 20%, 1 sample, to catch lag, pops and jitter before the full render.

## Re-rendering

Same steps as Episode 2 (see `../ep2/README.md`), using `ep4/`:

```bash
for c in you_night you_casual larry dale; do $B -b --python animation/larry/scripts/build_character.py -- $c $LARRY_WORK/chars/$c.blend; done
python3 animation/larry/ep4/make_decals.py $LARRY_WORK/ep4/decals
python3 -I animation/larry/ep4/audio.py $LARRY_WORK/ep4/vo.mp3 $LARRY_WORK/ep4/mix_raw.wav
bash animation/larry/ep4/normalize.sh $LARRY_WORK/ep4/mix_raw.wav $LARRY_WORK/ep4/mix.wav
W=2 bash animation/larry/ep4/preview_all.sh && W=2 bash animation/larry/ep4/motion_all.sh
bash animation/larry/ep4/render_all.sh 2 4
bash animation/larry/ep4/assemble.sh $LARRY_WORK/ep4/larry_ep4_final.mp4 final captions
bash animation/larry/ep4/assemble.sh $LARRY_WORK/ep4/larry_ep4_clean.mp4 final clean
```

The render took 1262 frames × ~12–33 s (bedroom night shots are the slow ones) ÷ 2 workers, about 2.5 hours.
