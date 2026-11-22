# Episode 2: "Larry & Dale"

This is a 51-second vertical short (1080×1920, 24 fps) cut to the user's voiceover (`dale_larru.mp3`, 49.7 s). It has 35 shots, plus a 1.5-second tail for the final sting.

## Status: done (2026-11-19)

Rendered and delivered to the user:
- `larry_ep2_final.mp4`: captions burned in.
- `larry_ep2_clean.mp4`: no captions.

Both are 1080×1920 at 24 fps, 51 s long, with −14 LUFS audio. Render outputs live in `$LARRY_WORK/ep2/` and are not committed.

- **Audio: voiceover only.** The user asked to remove the sound effects and music. Build the track with `audio.py <vo.mp3> <out.wav> voice-only`; without that argument you get the SFX version.
- **Dale:** redesigned from the user's reference stills of the viral "Dale" shorts. He's a slim Black man of average height with slicked-back `short04` hair. He wears `male_casualsuit05` (grey utility jacket over a dark striped shirt, plus jeans) and brown `shoes01`. For the matching T-shirts he wears `male_casualsuit06` (white tee and jeans). All are CC0 MakeHuman system assets, pinned in `scripts/build_character.py`.
- **Larry:** built unchanged from his Episode 1 recipe.
- **Restricted-network setup.** This session couldn't reach Blender, MPFB or CMU, so it used `../setup_env_restricted.sh` instead:
  - the `bpy==4.5.16` wheel with a `blender` command-line stand-in;
  - MPFB 2.0.18 uploaded by the user;
  - CMU clips rebuilt from Hugging Face by `../scripts/glb2amc.py`.

  Rendering took about 13 s per frame per worker, with 2 workers.

## Re-rendering

```bash
bash animation/larry/setup_env.sh        # or setup_env_restricted.sh <mpfb zip> when those hosts are blocked
export LARRY_WORK=~/larry_work; B=/opt/blender-4.5.16-linux-x64/blender
for c in you larry you_sun you_pj dale dale_tee larry_tee you_old; do
  $B -b --python animation/larry/scripts/build_character.py -- $c $LARRY_WORK/chars/$c.blend; done
$B -b --python animation/larry/scripts/lookdev.py -- $LARRY_WORK/chars/you.blend $LARRY_WORK/ep2/you_face.png closeup
python3 animation/larry/scripts/make_decals.py $LARRY_WORK/decals $LARRY_WORK/ep2/you_face.png     # episode-1 sets
python3 animation/larry/ep2/make_decals.py $LARRY_WORK/ep2/decals $LARRY_WORK/ep2/you_face.png
python3 -I animation/larry/ep2/audio.py $LARRY_WORK/vo.mp3 $LARRY_WORK/ep2/mix_raw.wav voice-only
bash animation/larry/ep2/normalize.sh $LARRY_WORK/ep2/mix_raw.wav $LARRY_WORK/ep2/mix.wav
W=2 bash animation/larry/ep2/preview_all.sh          # 3 stills per shot, check them
bash animation/larry/ep2/render_all.sh 2 4           # resume a killed shot: render_shot.py ... full 4 <f0> <f1>
bash animation/larry/ep2/assemble.sh $LARRY_WORK/ep2/larry_ep2_final.mp4 final captions
bash animation/larry/ep2/assemble.sh $LARRY_WORK/ep2/larry_ep2_clean.mp4 final clean
```

## Shot list

| Shot | Time | Voiceover | Picture |
|---|---|---|---|
| sh01 | 0.00 | You just want a normal life. | Sunny living room. You smile, slow push-in. |
| sh02 | 2.55 | But Larry from accounting | (Episode 1 callback) Larry's head rises over his cubicle wall. |
| sh03 | 3.80 | is obsessed with you. | A shrine of your polaroids on red string. Larry cradles one, lovestruck. |
| sh04 | 5.25 | And so is Dale from IT. | Blue server room. Dale rises behind three monitors and waves creepily. |
| sh05 | 7.25 | So you take a different bus to work. | Street. A city bus ("42 NOT YOUR USUAL BUS") glides into the stop. |
| sh06 | 9.15 | GENIUS! | Seated on the bus: smug, low-angle hero close-up. |
| sh07 | 10.25 | But the bus driver… is | Push down the aisle toward the driver's back (mustard polo, cap). |
| sh08 | 11.55 | LARRY. | Over the wheel, Larry turns into the lens. Honk. |
| sh09 | 12.62 | And the guy sitting on your lap… is | Wide: a lanky stranger sits on your lap. You, deadpan. |
| sh10 | 14.25 | DALE. | Dale slowly turns his face to yours, inches away. Boing. |
| sh11 | 15.35 | So you quit your job. | You storm out with your box of desk stuff. |
| sh12 | 16.65 | CLEVER! | Bright "Totally New Corp" office ("no larrys"): smug close-up. |
| sh13 | 17.55 | But your new boss… is | The high-back CEO chair, turned away. Creak. |
| sh14 | 18.85 | LARRY. | The chair spins: Larry, fingers steepled. "LARRY · CEO · YOUR NEW BOSS". |
| sh15 | 19.90 | And the guy inside the vending machine… is | Break room: you punch B3. Beep beep. |
| sh16 | 21.88 | DALE. | Through the glass: Dale folded up between the snack rows. Thunk. |
| sh17 | 22.85 | So you move to another country. | Arrivals hall: you (sunglasses outfit) walk in with your suitcase. Plane overhead. |
| sh18 | 24.55 | PERFECT! | Sunglasses grin under the ARRIVALS sign. |
| sh19 | 25.50 | But the guy stamping your passport… is | Insert: your passport gets two heart stamps: "WELCOME HOME — LARRY". |
| sh20 | 27.45 | LARRY. | Larry in the booth in an officer's cap, stamp by his cheek. Ding. |
| sh21 | 28.52 | And the dog sniffing your bags… is | Low wide: a "dog" in a K-9 vest sniffs your suitcase. Sniff sniff. |
| sh22 | 30.35 | DALE. | It's Dale on all fours, tongue out, delighted. Woof. |
| sh23 | 31.38 | So you make them fight over you. | Boxing ring, "FIGHT NIGHT · LARRY vs DALE". You in the centre. Ding ding. |
| sh24 | 33.10 | MUCH BETTER! | You in the spotlight, smug. |
| sh25 | 34.18 | But they team up instead. | They high-five over your head. You, deadpan. |
| sh26 | 35.80 | Matching T-shirts. | Both in white tees printed with your face in a heart and "OUR BOY". |
| sh27 | 37.10 | With YOUR FACE. | Push in on the prints, then tilt up to their grins. |
| sh28 | 38.80 | Seventy years later, | Hospital at sunset: very old you, the monitor beeping. |
| sh29 | 40.00 | you finally die. | The monitor flatlines on "die". |
| sh30 | 41.55 | Peace at last. | Heaven: you walk the clouds toward the golden gates. Harp, choir. |
| sh31 | 43.15 | But the angel at heaven's gate… is | Over your shoulder: an angel at the gate, back to us. |
| sh32 | 44.95 | LARRY. | The angel turns: halo, wings, Larry. The choir cuts dead. |
| sh33 | 46.00 | And the other angel… is | Pan to a second, much taller angel. |
| sh34 | 47.22 | DALE. | Dale turns, same grin. |
| sh35 | 48.25 | "We've been waiting for you." | Both say it into the lens as the gates swing open. Sting, snap zoom, and the grade turns hell-red. |
