# Episode 2: "Larry & Dale"

This is a 51-second vertical short (1080×1920, 24 fps) cut to the user's voiceover (`dale_larru.mp3`, 49.7 s). It has 35 shots, plus a 1.5-second tail for the final sting.

## Status

| Step | State |
|---|---|
| Voiceover transcription (faster-whisper `small.en`, word timestamps) | **Done.** Timings are in `captions.py`. Whisper missed "Genius!" (9.30–10.00 s), so it was placed by voice energy. |
| Cut list: 35 shots, one per phrase, with a separate beat for every "…is" pause before a reveal | **Done:** `cuts.py` |
| Captions: Montserrat Black, W/Y/R/L styles as in Episode 1 | **Done:** `captions.py`, checked burned in |
| Sound effects and mix: `audio.py` (Episode 1 recipes plus 14 new ones), −14 LUFS | **Done.** Checked by measurement and spectrogram only, not by ear. |
| In-world graphics: `make_decals.py` (25 images: signs, badges, vending front, passport, heart stamp, T-shirt print, ECG screens) | **Done.** Re-run it with the `you` portrait render (step 3 below) so the T-shirt, polaroids and passport show your real face. |
| Shots: `shots.py` | **Written, but not rendered yet.** All 35 run cleanly against a mocked Blender. Prop offsets and the new sit, squat and all-fours poses still need the preview pass. |
| Dale's design: draft `dale` / `dale_tee` recipes in `scripts/build_character.py` | **Draft.** Needs lookdev and lineup, then user approval, then the picked assets get pinned. |
| Render and assemble | **Blocked in the session that wrote this.** Its network policy didn't allow `download.blender.org`, `extensions.blender.org`, `files2.makehumancommunity.org` or `mocap.cs.cmu.edu`, and `files.makehumancommunity.org` reset every connection. |

`larry_ep2_animatic.mp4` (made with `animatic.py`) is a storyboard-card animatic of this exact edit: the final mix and captions over one card per shot. Use it to approve timing before spending about 2.5 hours on the render.

## Finishing it (needs a machine or session that can reach the hosts above)

```bash
bash animation/larry/setup_env.sh                      # Blender 4.5.16, MPFB, MakeHuman packs, CMU clips, fonts, whisper
export LARRY_WORK=~/larry_work; B=/opt/blender-4.5.16-linux-x64/blender
mkdir -p $LARRY_WORK/chars $LARRY_WORK/ep2
cp dale_larru.mp3 $LARRY_WORK/vo.mp3                   # the user's voiceover (not committed)
# 1. cast (Larry etc. are unchanged recipes; dale/dale_tee/larry_tee/you_old are new)
for c in you larry you_sun you_pj dale dale_tee larry_tee you_old; do
  $B -b --python animation/larry/scripts/build_character.py -- $c $LARRY_WORK/chars/$c.blend; done
# 2. Dale look-dev: show the user, iterate on SPECS["dale"], then pin the PICKED asset names and commit
$B -b --python animation/larry/scripts/lookdev.py -- $LARRY_WORK/chars/dale.blend /tmp/dale.png full
$B -b --python animation/larry/scripts/lineup.py -- $LARRY_WORK/chars /tmp/lineup.png you,larry,dale
# 3. graphics with your real face (portrait render of "you")
$B -b --python animation/larry/scripts/lookdev.py -- $LARRY_WORK/chars/you.blend $LARRY_WORK/ep2/you_face.png closeup
python3 animation/larry/ep2/make_decals.py $LARRY_WORK/ep2/decals $LARRY_WORK/ep2/you_face.png
# 4. audio + captions (deterministic; same result as committed)
python3 -I animation/larry/ep2/audio.py $LARRY_WORK/vo.mp3 $LARRY_WORK/ep2/mix_raw.wav
bash animation/larry/ep2/normalize.sh $LARRY_WORK/ep2/mix_raw.wav $LARRY_WORK/ep2/mix.wav
# 5. preview stills for every shot -> look at them all, fix offsets/poses
bash animation/larry/ep2/preview_all.sh
# 6. render (2 workers, 4 samples; ~1224 frames ≈ 2.3 h) and assemble both deliverables
bash animation/larry/ep2/render_all.sh 2 4
bash animation/larry/ep2/assemble.sh $LARRY_WORK/ep2/larry_ep2_final.mp4 final captions
bash animation/larry/ep2/assemble.sh $LARRY_WORK/ep2/larry_ep2_clean.mp4 final clean
```

### Things to check in the preview pass (first guesses in the code)

- **New static poses.** `pose()` edits one CMU frame. These conventions were taken from the CMU data:
  - femur rx < 0 swings the thigh forward;
  - tibia rx > 0 bends the knee;
  - root rx > 0 pitches the body forward.

  Check `SIT` (bus, driver, boss chair, booth), `SQUAT` (Dale in the vending machine) and `ALL_FOURS` (sniffer-dog Dale). If one comes out mirrored, flip the sign.
- **Bone-space prop offsets (`on_bone`).** These are the caps, halos, wings, the K-9 vest, the T-shirt prints and Dale's badge. They assume the cmu_mb convention used in Episode 1 (bone +Y runs along the bone, +Z faces forward).
- **Hand IK targets.** These cover the steering wheel, the steepled fingers, the vending keypad, the boxing guard, the high five and the arms around the shoulders.
- **Dale's look.** Check that his long ginger hair and beard tint correctly. Hair materials may not be Principled; the build log prints `NO_BSDF` if so.

## Shot list

| Shot | Time | Voiceover | Picture |
|---|---|---|---|
| sh01 | 0.00 | You just want a normal life. | Sunny living room. You smile, slow push-in. |
| sh02 | 2.55 | But Larry from accounting | (Episode 1 callback) Larry's head rises over his cubicle wall. |
| sh03 | 3.80 | is obsessed with you. | A shrine of your polaroids on red string. Larry cradles one, lovestruck. |
| sh04 | 5.25 | And so is Dale from IT. | Blue server room. Tall Dale rises behind three monitors and waves creepily. Keyboard clatter. |
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
