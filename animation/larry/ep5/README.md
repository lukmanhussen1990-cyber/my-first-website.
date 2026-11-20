# Episode 5: "Larry's Wood"

A 46-second vertical short (1080×1920, 24 fps) cut to the user's voiceover (ElevenLabs "Todd", 44.7 s). It has 26 shots and 1104 frames. The audio is **voice only**.

Larry spends six months carving you a chair and keeps asking "Will you sit on my wood?" You stop sitting down (he carves a standing desk with a seat), buy a bean bag (it's full of Larry's wood chips), take the bus (oak seats; Dale is driving) and finally become an astronaut. Then there's a knock on the airlock: Larry and Dale float in with a wooden rocking chair. "Houston… he's gonna sit on my wood."

**Status: done (2026-11-20).** Both videos were delivered to the user:
- `larry_ep5_final.mp4`: captions burned in.
- `larry_ep5_clean.mp4`: no captions.

## Cast

- `you`, `larry`, `dale` (unchanged).
- New in `scripts/build_character.py`: **`you_astro`** (navy polo, khaki cargo pants, boots).

## Sets

| Set | What's in it |
|---|---|
| Larry's garage workshop | Brick walls, bench, pegboard, sawhorses, shavings, the DAY 183 calendar |
| Episode 1 office | Your cubicle, Larry's oak standing desk (HANDMADE BY LARRY) with a swing-out seat, a red bean bag |
| Street + bus | Episode 2's bus kit; every seat re-made in carved oak with a heart; Dale in the driver's cap |
| Launch pad | Procedural rocket ("NO SEATS"), service tower, exhaust billows |
| Space station | Module with racks, rails, porthole, NO SITTING ZONE sign, the airlock hatch; procedural Earth + station exterior |

Procedural props: oak grain material, Larry's carved chair (heart + FOR YOU), rocking chair, saw, wood-chip sack, bursting wood chips, Earth with clouds and atmosphere.

## Re-rendering

```bash
for c in you larry dale you_astro; do $B -b --python animation/larry/scripts/build_character.py -- $c $LARRY_WORK/chars/$c.blend; done
python3 animation/larry/ep5/make_decals.py $LARRY_WORK/ep5/decals
python3 -I animation/larry/ep5/audio.py $LARRY_WORK/ep5/vo.mp3 $LARRY_WORK/ep5/mix_raw.wav
bash animation/larry/ep5/normalize.sh $LARRY_WORK/ep5/mix_raw.wav $LARRY_WORK/ep5/mix.wav
W=2 bash animation/larry/ep5/preview_all.sh && W=2 bash animation/larry/ep5/motion_all.sh
bash animation/larry/ep5/render_all.sh 2 4
bash animation/larry/ep5/assemble.sh $LARRY_WORK/ep5/larry_ep5_final.mp4 final captions
bash animation/larry/ep5/assemble.sh $LARRY_WORK/ep5/larry_ep5_clean.mp4 final clean
```

The render took about 2 h 25 min with 2 workers.
