# Awards reel ("You just won the Oscar")

A 57.7 s vertical (1080x1920, 30 fps) goofy 3D reel built from the user's own voice recording
(`audio/voiceover_src.mp3`). The voice is not changed or replaced: only the pauses between lines are evened out
(`make_voiceover.py`). Everything you see and hear besides the voice is made with code.

Low-poly blocky 3D (three.js, rendered frame by frame in headless Chromium) + pixel captions in the centre.
The actor is made up (slick black hair, black tux). The award is a generic golden statue. There are no real people.
It is silly, not gross: he stays fully dressed. The only things on screen are a cartoon lump in the back of his
trousers that grows at every squish, plus green stink lines and green stage fog.

## Build

```bash
python3 make_voiceover.py       # once: user's recording -> audio/voiceover.wav + word times
./make_reel.sh                  # captions -> shot plan -> overlay -> sounds -> mix -> 3D frames -> final.mp4
JOBS=4 SCALE=0.75 ./make_reel.sh   # faster: render at 0.75 and upscale
```

## Files

| file | what |
| --- | --- |
| `script.json`, `make_voiceover.py`, `stt_words.py` | the lines, the user's recording -> timed voiceover + word times (faster-whisper) |
| `make_captions.py` | centre pixel captions (2-4 words) -> `audio/captions.ass` |
| `plan.py` -> `shots.json` -> `gen_plan_js.py` -> `web/plan.js` | the 40 shots and their event times (word onsets) |
| `make_overlay.py` | the corner stopwatch (0:31 ... 0:45) and the big countdown numbers 0:40 / 0:44 / 0:45, added to the captions |
| `make_sfx.py` | all the sounds, made with code (see below) -> `audio/sfx/*.wav` + `audio/sfx_cues.json` |
| `mix.py` | voice at -20 LUFS on top, effects ducked under it, master -14 LUFS / -2 dBTP |
| `web/layout.js` | where everything is (theatre, living room, outside) |
| `web/set_theatre.js` | golden theatre: stage, curtains, arch, footlights, orchestra pit, raked seats, instanced crowd (cheer / sniff / nose poses), TV crane with a red LIVE light, the giant LIVE screen; the theatre at night with searchlights |
| `web/set_home.js` | the living room (from the house reel) + a TV showing the same LIVE feed |
| `web/cast.js`, `char_geo.js`, `char_tex.js` | the people: the actor (with `lump` + `tailLift`), co-star, Mom, the director, conductor, violinist, trumpeter, cellist, two front-row stars, a TV family (dad, kid, grandma) |
| `web/props_oscar.js` | statue, baton, stopwatch, violin + bow, trumpet, cello + bow, popcorn, handkerchief, tissue |
| `web/shots_a.js`, `web/shots_b.js` | the 40 shots |

## The lump timeline (same in every shot)

| time | moment | lump | tux tails | stage fog | sound |
| --- | --- | --- | --- | --- | --- |
| 6.56 s | "pooped" (LUMP B) | small | - | light | squish |
| 17.62 s | "again" (LUMP C) | balloon | - | more | SQUISH |
| 20.49 s | "again" (LUMP D) | bigger | lifting | thick | SQUOOSH |
| 26.57 s | "more" (LUMP E) | huge, buttons pop | up | very thick | SQUOOOSH + gasp |

All the lump shots use the same camera (behind him, to his left), with a punch-in and a shake on the squish.

## Sounds (all code-made, all quieter than the voice)

These are the sounds, in the order they play:

- crowd cheer and applause; it cuts off at the first squish
- statue sparkle, stair steps and mic taps
- mic feedback squeal and a voice-crack squeak
- 4 squishes, each one louder
- the front row sniffing
- camera flashes
- crane whir and zoom servo
- buttons popping and a crowd gasp
- the "What you don't know" DUN
- stopwatch ticking, with big ticks on 0:40 / 0:44 / 0:45
- the baton whoosh
- the play-off orchestra music (brass, strings, pizzicato bass, timpani); it gets sloppy after "With one hand"
- penguin footsteps
- night crickets
