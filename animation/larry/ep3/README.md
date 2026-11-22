# Episode 3: "Larry's Meat"

This is a 46.5-second vertical short (1080×1920, 24 fps) cut to the user's voiceover (ElevenLabs "Todd", 44.8 s). It has 31 shots. The audio is **voice only**.

**Status: done (2026-11-20).** Both videos were delivered to the user:
- `larry_ep3_final.mp4`: captions burned in.
- `larry_ep3_clean.mp4`: no captions.

Render outputs live in `$LARRY_WORK/ep3/` and are not committed.

## Cast

- `you` and `larry` (unchanged recipes).
- New supporting cast in `scripts/build_character.py`:
  - **`hr`**: Brenda from HR. Pinstripe suit, bob haircut.
  - **`larry_monk`**: Larry with his head shaved, still in his glasses and moustache, wearing a brown hooded top and trousers.
  - **`butcher`**: Big Tony. Huge, bald, in work overalls tinted white.

## Sets

All sets are in `shots.py`. Episode 1's office and Episode 2's helpers are reused.

| Set | What's in it |
|---|---|
| Office lunch | A table, a burger, Larry kneeling |
| HR office | Wall sign, nameplate, complaint form, meat tenderizer |
| GREEN LEAF vegan café | Salad bar of Poly Haven bowls, plus a NO MEAT sign |
| Mountain monastery | `fouriesburg_mountain_lookout` sky, castle-stone walls, prayer flags, a bronze bell in a timber frame |
| BIG TONY'S butcher shop | Hanging steaks, cutting board, price board |
| Funeral home | Coffin with a hinged lid and satin lining, candles, flowers, chairs, REST IN PEACE banner, your memorial portrait |

The props are procedural: a marbled raw steak, a meat tenderizer, a burger, the bell and the coffin.

## Re-rendering

Same steps as Episode 2 (see `../ep2/README.md`), using `ep3/`:

```bash
for c in you larry hr larry_monk butcher; do $B -b --python animation/larry/scripts/build_character.py -- $c $LARRY_WORK/chars/$c.blend; done
python3 animation/larry/ep3/make_decals.py $LARRY_WORK/ep3/decals $LARRY_WORK/ep2/you_face.png
python3 -I animation/larry/ep3/audio.py $LARRY_WORK/ep3/vo.mp3 $LARRY_WORK/ep3/mix_raw.wav
bash animation/larry/ep3/normalize.sh $LARRY_WORK/ep3/mix_raw.wav $LARRY_WORK/ep3/mix.wav
W=2 bash animation/larry/ep3/preview_all.sh && bash animation/larry/ep3/render_all.sh 2 4
bash animation/larry/ep3/assemble.sh $LARRY_WORK/ep3/larry_ep3_final.mp4 final captions
bash animation/larry/ep3/assemble.sh $LARRY_WORK/ep3/larry_ep3_clean.mp4 final clean
```

The render took about 1116 frames × 14 s ÷ 2 workers, roughly 2.2 hours.
