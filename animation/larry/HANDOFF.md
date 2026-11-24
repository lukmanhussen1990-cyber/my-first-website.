# Larry series: handoff (read this first)

## START HERE (new account / new AI session)

You are continuing a finished, working pipeline. **Do not redesign anything and do not rewrite the pipeline.**
Episodes 1-17 are done (list below). Every episode folder is a complete, working example: **copy the newest (`ep17/`).**

**Step 1: get the code.** Branch `claude/character-setup-lineup-4cq7u3` of the user's GitHub repo
`my-first-website.`; the project is `animation/larry/`. If you cannot reach the repo, the user uploads
`larry_project.zip` (the same folder): unzip it and work from there.

**Step 2: set up the machine (about 15-30 minutes).** The user uploads MPFB in two parts. Join and check them:
```bash
cat add-on-mpfb-v2.0.18.zip.part0 add-on-mpfb-v2.0.18.zip.part1 > add-on-mpfb-v2.0.18.zip
sha256sum add-on-mpfb-v2.0.18.zip   # must be c075b3e9b94b8e5556a5f03f4653602d02ea306de08126e8f55ed6dee28a2dad
bash animation/larry/setup_env_restricted.sh add-on-mpfb-v2.0.18.zip
pip install faster-whisper            # voiceover word timestamps (scripts/tools/words.py)
```
Blender comes from PyPI (`bpy==4.5.16`, plus a `blender` stand-in at `/opt/blender-4.5.16-linux-x64/blender`); mocap
comes from the Hugging Face mirror `codepawl/cmu-mocap-glb`. Hosts the environment must allow:
`files.makehumancommunity.org` (or the mirror `files2.makehumancommunity.org`), `huggingface.co`, `pypi.org` /
`files.pythonhosted.org`, `api.polyhaven.com` + `dl.polyhaven.org`, `fonts.googleapis.com` + `fonts.gstatic.com`.
**Never try to get around network blocks (no fake User-Agents, no proxies): if something is blocked, tell the user.**
- If `files.makehumancommunity.org` resets every connection, fetch the same pack paths from `files2.` (ask the user
  to allow it), put the zips in `/opt/mh_assets/packs/`, then rerun the script (it skips packs already there). The
  mirror is slow per connection; parallel byte ranges make it ~10x faster.
- Whisper model download failing on `cas-server.xethub.hf.co`: run it with `HF_HUB_DISABLE_XET=1`.
- More CMU clips: search `metadata.jsonl` of the HF mirror, then `scripts/glb2amc.py` (see the end of the setup script).
- A container restart keeps `/opt` and `~/larry_work` but wipes pip packages: re-run `pip install faster-whisper`.

**Step 3: rebuild the cast from the fixed recipes, then CHECK them against the reference pictures.**
```bash
export LARRY_WORK=~/larry_work; B=/opt/blender-4.5.16-linux-x64/blender; mkdir -p $LARRY_WORK/chars
for c in you you_casual you_night you_pj you_old larry dale dale_jail wife kid_boy kid_girl hr butcher cop bodyguard; do
  $B -b --python animation/larry/scripts/build_character.py -- $c $LARRY_WORK/chars/$c.blend; done
xvfb-run -a $B -b --python animation/larry/scripts/lineup.py -- $LARRY_WORK/chars /tmp/lineup larry,dale,you_casual
```
(Older episodes also use `dale_tee you_work you_astro larry_tee you_sun larry_monk soldier larry_soldier`.)
Compare the lineup with `ref/characters.jpg`, `ref/faces_larry_dale_you_wife_kids.jpg`,
`ref/cast_family_larry_dale.jpg` and `ref/cast_you_work_dale_tee.jpg`. They must match exactly:
- **Larry**: short, chubby, older man; mustard polo, brown trousers, moustache, glasses.
- **Dale**: slim Black man, slicked-back short hair, grey utility jacket over a striped shirt + jeans (`dale`),
  or white tee + jeans (`dale_tee`), or orange jumpsuit (`dale_jail`).
- **You**: young white man, short hair (`you` light-blue shirt + tie, `you_casual` light-blue shirt + jeans, `you_night` pyjamas).
If a character looks different, the setup went wrong (missing MPFB asset pack). Fix the setup; never edit the recipe.
Never create a new character or a new tool: costumes and props are scene objects made in the episode's `shots.py`
(e.g. Larry's wedding dress and veil, the priest's collar, the stepdad apron, the bald guy = `you` with the hair hidden).

**Step 4: wait for the user.** Don't make any episode, script or video until they give you an idea and a voiceover.

## The user's workflow (every episode)
1. They ask "top 5 idea(s)": give 5 short numbered premises with escalation + twist, then **wait** for their pick.
2. They pick one and say "give voiceover, no other word": write only the spoken script (no title, no notes; every word
   is read aloud by their TTS). ~45-55 s for Larry episodes, ~25 s for the stand-alone "If you..." shorts.
3. They record it with their TTS voice and upload the mp3, usually with "make": make the whole video.
4. While it renders they ask "Time left" (answer with a quick estimate) or "give what's done so far, don't stop the
   render" (`scripts/tools/so_far.sh`, send it, keep rendering) or a "144p preview" (`p144_all.sh` + `p144_mux.sh`).
5. Deliver: `*_final.mp4` (captions) and `*_clean.mp4`, then they ask "caption, no other word": one line + emoji +
   `#shorts #funny #animation`. Write `epN/UPLOAD.md` (caption, description, CC-BY credits), commit and push.

## Making an episode (episodes 9-17 workflow)
1. `mkdir epN`; copy `audio.py normalize.sh render_shot.py preview_all.sh motion_all.sh render_all.sh assemble.sh
   render_sched.py` from `ep17/` and replace `ep17`/`Episode 17` with `epN`/`Episode N` inside them.
2. Audio: `ffmpeg -i vo.mp3 -ac 1 -ar 16000 -f s16le vo16k.pcm; HF_HUB_DISABLE_XET=1 python3 scripts/tools/words.py
   vo16k.pcm words.json` (word timestamps; check quiet gaps with numpy energy for words whisper misses, e.g. "Mmmph!").
   `python3 -I epN/audio.py vo.mp3 $LARRY_WORK/epN/mix_raw.wav && bash epN/normalize.sh ... mix.wav` (voice only, -14 LUFS).
3. `epN/cuts.py`: one shot per 1-2 s phrase (end = VO length + ~0.1 s). `epN/captions.py`: copy, rewrite `C`
   (W white / Y yellow / R red / L huge last line), short chunks (~16 chars in R, ~20 in W).
4. `epN/make_decals.py` (Pillow signs, posters, cards) -> `$LARRY_WORK/epN/decals`.
5. `epN/shots.py`: `_load` the newest episode (each imports the previous chain) and write one function per shot,
   reusing sets/props/helpers (see "Helper map" below).
6. `MODE=fast W=2 bash epN/preview_all.sh` (3 stills per shot), then `python3 scripts/tools/overview.py
   $LARRY_WORK/epN/preview sheet.png mid` and LOOK at every shot; fix; re-preview the changed shots. Test single frames
   with `xvfb-run -a $B -b --python epN/render_shot.py -- shN <dir> fast 2 F F` before re-rendering a whole shot.
7. Final: `MODE=fast python3 epN/render_sched.py 2` (2 workers, 75 % res, 2 samples, ~4-8 s/frame/worker; a 50 s
   episode takes 60-120 min). Watch each finished shot with `scripts/tools/frames_sheet.py` and queue redos with
   `scripts/tools/redo_queue.sh`. Then `python3 -I scripts/tools/upscale.py $LARRY_WORK/epN/frames $LARRY_WORK/epN/frames720` and
   `FRAMES=.../frames720 bash epN/assemble.sh .../NAME_final.mp4 final captions` (and `... clean`).
8. **Background jobs are killed after 2 hours**: keep each chain under 2 h (render first; a separate finisher for
   redos/upscale/assemble). `render_sched.py` resumes partly rendered shots when re-run.

## Helper map (where things live)
- Face presets (SMILE, SMUG, CREEPY, SHOCK, DEADPAN, TADA, RAGE...) come from Episode 1 (`scripts/shots.py`, imported
  as `ep1shots`); `look_at` and the `Char` class are in `scripts/lib.py`.
- `ep2`: `face`, `lipsync`, `pose`, `sit`, `settle`, `on_bone`, `stare_at`, `chair`, `chest_print`, `heaven_set`,
  `angelify`, `newcorp_set` (office), `bus_interior_set`, `airport_set`, `hospital_set`.
- `ep3`: `kneel`/KNEEL. `ep4`: `house_exterior`, `bedroom_night`, `you_asleep`, `blanket_over`, `sootify`.
- `ep5`: `earth`, `stars`, `rocket`. `ep6`: `Car`, `family_in`, `larry_and_dale`, `wear_shades`, `coast_road`, `mirror_feed`.
- `ep7`: prison sets, `bedroom` with door. `ep9`: `garbage_truck`, `drive_truck`, `loop_move` (seamless run/walk),
  `face_light`, `spot`, `stamp` (rubber stamp on the lens). `ep10`: bathroom/theatre, toilet.
- `ep11`: `day_street`, `moms_house` (real doorway), `stepdad` apron, `tank_prop`, `muzzle_flash`, sun/moon/ocean/
  North Pole/hell sets, `lounger`. `ep12`: `look_keys` (keyed head look-at), `sit_level`, `follow_head`.
- `ep13`: `rocker` (whole-body pivot), `glue`, `rock`, `laugh`, `talk`, `hold`, `desk`, office meeting room.
- `ep14`: church set, `wedding_dress`, `priest_bits`, `cake`, `splat_on`, `fight_cloud`, `shards`, `confetti`, `vis`.
- `ep15`: `you_char`/`larry_char`/`dale_char`, `idle`, `tears`, `sob`, living room, shower, front door, `couch_sit`.
- `ep16`: `ak47`, `hold_rifle`, `shovel`+`dig`, `backyard` grave/mound/gravestone, `churn`, `in_bed_trio`, lightning.
- `ep17`: dining room + family table (`table_scene`, `seat`, `eating`), `explosion`, `rubble`, `puffs`,
  `tank_with_larry`, `flung`, `basement`.

## Review and delivery tools (`scripts/tools/`, usage line at the top of each)
- `words.py`: voiceover word timestamps. `overview.py`: one tile per shot from the preview stills.
- `sheet.py` / `motion_sheet.py` / `frames_sheet.py`: detail sheets of stills, motion frames or final frames (pop score).
- `so_far.sh`: "what's done so far" video from the fully rendered shots, without touching the running render.
- `partial_cut.py`: rendered frames where they exist, preview stills elsewhere (quick rough cut).
- `p144.py` + `p144_all.sh` + `p144_mux.sh`: 144p motion preview of the whole episode with voice and captions.
- `redo_queue.sh`: re-render fixed shots into `frames_fix` while the main render runs (then swap them in).
- `upscale.py`: MODE=fast frames (540x960) to 720x1280 before `assemble.sh` (which outputs 1080x1920).

## Smoothness and quality rules (learned the hard way in episodes 12-17)
- No finger close-ups: the hand rig moves all four fingers together (only FingerBase + HandFinger1 bones).
- Standing idle: `137_28` from frame **3700** (`ep15.idle`); the 2400 range turns the head 90 degrees to one side.
- Seated / kneeling / driving poses tip the head back ~34 degrees: add `{"lowerneck": rx 18, "upperneck": rx 16}`
  (`ep12.sit_level`, `ep12.SEATED`, `ep14.KNEEL_LEVEL`).
- Laughs, rocking, leaning, falling: rotate a pivot (`ep13.rocker`) and parent hand targets to it (`glue`).
- Head look-at must aim at a fixed empty at the other person's eye level (`look_keys`), never at their head bone:
  two heads tracking each other is a dependency cycle (frozen heads).
- Check where the camera is: inside a character, a veil, a wall or a door gives white or blank frames. Hide people
  who are off-screen in close-ups and point-of-view shots (also halves the render time with 5-6 people).
- Bright emission washes to white/peach under AgX: saturated colours, low strength; `face_light` energy ~15-40.
- Prop costumes (veil, bouquet, skirt) can block faces: hide them per shot (`ep15.hide_bouquet`).
- `upscale.py` skips frames whose upscaled copy is newer: after re-rendering a shot, delete `frames720/<shot>` first.
- Max 2 Blender processes at once (RAM); the full dinner table (6 people) is the heaviest kind of shot.

## Story so far (series canon, keep continuity)
- Ep 1-9: Larry from accounting and Dale from IT are obsessed with you; ep9 Dale escaped prison and "broke back in".
- Ep10 "The Show": Dale watches you on the toilet like a theatre show (front-row ticket, popcorn).
- Ep11 "Stepdad": you flee Dale everywhere (tank, sun, moon, ocean, North Pole, heaven, hell, a hitman he folds like a
  lawn chair); you run home to Mom: "Honey, meet your new stepdad." "Hi, son." (Dale in a WORLD'S BEST STEPDAD apron)
- Ep12 "Nose" and Ep13 "Head of Laughing": stand-alone shorts in the reference format ("If you ..., most people ...
  That's a mistake. You see, ... There are three steps. First ... Second ... Third ... because..."), bald guy = `you`.
- Ep14 "Husband and Husband": Dale kidnaps you in a garbage truck, tapes you to a chair at the altar; the priest is
  Dale in a fake moustache; Larry bursts in wearing a wedding dress; cake fight cloud; the real priest pronounces
  Larry and Dale husband and husband; "Honey... let's adopt."
- Ep15 "Missing" part 1: Dale missing 2 days; Larry (still in the dress) begs you for help; vote YES/NO (viewers: NO).
- Ep16 "Here Lies Dale" part 1: Dale was never missing (their cuddle plan); you shoot him (cut away on BANG), bury him
  in the garden, "HERE LIES DALE. FINALLY."; 3 days later the dirt moves; vote: is Dale really dead?
- Ep17 part 2: family dinner with your crush (`wife` model); Dale is at the table and only you can see him; he throws
  your crush out of the window; Larry blows up the house with a tank; they lock you in their basement and cuddle you.
- The user likes: start with annoyance; escalation; Larry and Dale never give up; varied twists (no repeated
  funerals); viewer-vote endings ("Comment YES or NO. Part 2 is up to you."); cartoon violence cut away, never gore.

## Working with this user (most important rules)
- Very short replies. "No other word" = output only the requested text.
- Audio is **voice only** (no music, no sound effects).
- Edgy, absurd humour; Larry and Dale never give up. Vary the final twist.
- They send screenshots or say "glitch": fix exactly what they point at, then check the rest.
- They hate visible glitches (they skipped episode 12 for that): preview everything, check every finished shot.
- Memory: max 2 Blender workers.

Everything below is the original reference (episodes 1-9); where it disagrees with the sections above, the sections above win. The code is on branch `claude/character-setup-lineup-4cq7u3` (earlier: `ccr-35ca5e9e-l7qz15`), under `animation/larry/`.

## What this is

This is a series of vertical 3D-animated comedy shorts for YouTube Shorts and TikTok. The recurring star is **Larry from accounting**, who is obsessed with "you": the narration is in second person and the viewer is the victim.

**The format** comes from viral "You just… But Dale keeps…" shorts:
- The voiceover is an escalation chain: "So you [solution]. GENIUS! But Larry [absurd counter]."
- The interjections GENIUS!, CLEVER!, PERFECT! and MUCH BETTER! appear as big yellow captions.
- There is a new shot every 1–2 seconds, with a sound effect on every cut.
- It ends on a twist.

**The look:**
- Realistic-ish MakeHuman 3D people driven by motion capture, with Poly Haven props and skies.
- Bright, punchy lighting.
- 1080×1920 at 24 fps.
- Bold Montserrat Black captions in the lower-middle of the frame, with yellow and red highlight words.

**Visual references in this repo:**
- `ref/episode1_frames.jpg`: 32 frames from episode 1, showing the shots, the caption style and the night-time finale.
- `ref/characters.jpg`: You and Larry. Larry wears glasses, a moustache and a mustard polo.

## Episodes

### Episode 1 "Larry" (done, 49 s, 31 shots)

Larry keeps touching you inappropriately, and it escalates like this:
1. You call the police, and he pays his bail with your wallet.
2. You get a restraining order (500 ft), and he buys a 501-foot stick.
3. You move to Egypt, and he mails himself to your new house.
4. You hire a bodyguard, and Larry still touches you.
5. You hire the army, with tanks and jets, and Larry is tackled in two seconds.

You finally sleep… but who's tucking you in? LARRY, now a soldier in the army.

The full voiceover text and timings are in `scripts/captions.py`. The cut list is in `scripts/cuts.py` and the shots are in `scripts/shots.py`.

### Episode 2 "Larry & Dale" (done: 51 s, 35 shots; see `ep2/README.md`)

- The final videos are 51 s long. The audio is **voice only**: the user asked to remove the SFX and music.
- Dale is designed from the user's reference (the viral "Dale" shorts) and is now pinned in `SPECS`.
- The render used `setup_env_restricted.sh`, because Blender, MPFB and CMU were unreachable from that session.

This is the approved script:

> You just want a normal life. But Larry from accounting is obsessed with you. And so is Dale from IT.
>
> So you take a different bus to work. Genius! But the bus driver… is Larry. And the guy sitting on your lap… is Dale.
>
> So you quit your job. Clever! But your new boss… is Larry. And the guy inside the vending machine… is Dale.
>
> So you move to another country. Perfect! But the guy stamping your passport… is Larry. And the dog sniffing your bags… is Dale.
>
> So you make them fight over you. Much better! But they team up instead. Matching T-shirts. With your face.
>
> Seventy years later, you finally die. Peace at last. But the angel at heaven's gate… is Larry. And the other angel… is Dale.
>
> "We've been waiting for you."

### Episode 3 "Larry's Meat" (done: 46.5 s, 31 shots; see `ep3/README.md`)

- Premise: Larry keeps begging you to "beat his meat" (literally a steak).
- The escalation runs HR → going vegan → a monastery → a professional butcher → faking your own death.
- Twist: at your funeral, Larry puts a steak in your hands and whispers "Just one last time."
- New supporting cast: `hr`, `butcher`, and the `larry_monk` variant.
- Audio is voice only.

### Episode 4 "Fresh Batch" (done: 52.6 s, 32 shots; see `ep4/README.md`)

- Premise: every night at 3 AM Larry and Dale fly in through your window to sniff your underwear.
- Escalation: lock the window → chimney (soot) → the UNDERWEAR VAULT safe → guard dog (it's Dale; Larry walks him) →
  no underwear (they sniff your jeans) → a concrete house with no windows, no chimney, no underwear.
- Twist: two faces smile up from your laundry hamper: "Fresh batch?"
- Voiceover: ElevenLabs "Mark". Audio is voice only.
- Workflow that caught the bugs: `preview_all.sh` stills, then `motion_all.sh` (every 3rd frame, 20%, 1 sample) and a
  144p preview cut for the user before the full render. Full render ~2.5 h with 2 workers.
- Lessons: alpha glass must not cast shadows (`visible_shadow = False`) or moonlight turns to grain; `hide_after` on an
  empty does not hide its children; hold cloth props with COPY_LOCATION so they hang, not as rigid Child Of boards.

### Episode 5 "Larry's Wood" (done: 46 s, 26 shots; see `ep5/README.md`)

- Premise: Larry begs you to "sit on my wood" (a hand-carved chair). Escalation: stop sitting → oak standing desk
  with a seat → bean bag full of Larry's wood chips → oak bus seats, Dale driving → astronaut.
- Twist: a knock on the airlock; Larry and Dale float in with a rocking chair. "Houston… he's gonna sit on my wood."
- Voiceover: ElevenLabs "Todd". The user rejected another funeral ending ("repetitive"): vary the final escape.

### Episode 6 "Road Trip" (done: 61 s, 35 shots; see `ep6/`)

- Larry and Dale tail your family car (wife + two kids); "LEAVE ME ALONE!" → they sniff your pants; forest
  picnic; gas-station car swap (Dale is the chauffeur); twist: captain Larry and co-pilot Dale, "Are we there yet?"
- New: procedural car kit (`Car` in ep6/shots.py), coast road, mirror feed, plane; cast `wife`, `kid_boy`, `kid_girl`.
- Memory: 6 characters ~8.5 GB with subdivision; Ep6 turns render subdivision off outside close-ups and uses
  `render_sched.py` (memory-aware). Shots 1-14ish at full quality, the rest in `MODE=fast` (75 %, 2 samples).

### Episode 7 "Group Hug" (done: 60 s, 30 shots; see `ep7/`)

- Dale in prison 5 years; Larry's breakouts fail (file in a cake, tunnel into the warden's office, fake guard);
  he spoons you; cat flap; teddy bear (Larry in a bear suit); hammock with nightlight; you get Dale released;
  twist: squeezed between them, "Group hug?". New cast `dale_jail` (orange jumpsuit). Rendered in `MODE=fast`.

### Episode 8 "Dale's Deck" (done: 40 s, 20 shots; see `ep8/`)

- Tool-invention format like the user's reference video: Dale begs you to oil his massive deck → bare hands
  (splinters) → home-made brush → it's huge → paint roller → drips → ribbed tray → back pain → extension pole →
  Dale's thumbs up. New cast `you_work` (blue work overalls); Dale is `dale_tee` (white tee, jeans).
- First-person shots: `head_off()` hides the head (Generated-Z cut on the body + head meshes) and `pov()` puts the
  camera at the eyes. `finger_pose()` makes a fist with the thumb up. Rendered in `MODE=fast`.

### Episode 9 "Broke Back In" (done: 57.6 s, 33 shots; see `ep9/`)

- Cold open the user asked for: midnight, you sprint down the street screaming, escaped Dale (jumpsuit, banana peel)
  and Larry behind you, to the police station; "Let me explain": you took Dale to court (5 years), he escaped in a
  garbage truck (the user's reference videos) and walked six days to your window → mom's house (Larry in the washing
  machine) → hotel (room service is Dale's head under the cloche) → your car (Dale in the trunk, Larry in the
  glovebox) → the police lock you up in maximum security → twist: a garbage truck pulls in, "We broke back in."
- `loop_move()` plays a seamless loop (09_01 sprint stride, 132_45 slow walk) in place and slides the rig at the
  clip's own measured pace: long runs with no foot skating. `face_light()` = soft key riding with the camera for
  night faces. Voiceover: ElevenLabs "Todd". Rendered in `MODE=fast`.

## Characters: keep them identical

Every character is a fixed recipe in `scripts/build_character.py` (`SPECS`). The recipe sets the body, skin, hair, clothes and colour tints.
- **Never redesign a character.** Always build it from its recipe:
  `blender -b --python scripts/build_character.py -- larry $LARRY_WORK/chars/larry.blend`
- **Larry:** short, chubby and older (age 0.78, weight 0.82, height 0.38).
  - Hair `short04`, grey eyes.
  - Mustard polo (tint 0.78, 0.52, 0.08) and brown pants.
  - Moustache `grinsegold_moustache` and library glasses `frankyaye_glasses_library_male`.
  - Variants: `larry_b` is a second copy, and `larry_soldier` is the army outfit.
- **You:** a young man with hair `short02`, a light-blue shirt and tie, and dark grey pants.
  - Variants: `you_sun` (white tee, jean shorts, sunglasses) and `you_pj` (white tee).
- **Dale from IT** (`dale`, `dale_tee`), designed from the user's reference stills of the viral "Dale" shorts:
  - A slim Black man of average height (race AFR, height 0.68) with slicked-back `short04` hair.
  - `male_casualsuit05`: grey utility jacket with chest pockets over a dark striped shirt, plus jeans.
  - Brown `shoes01`.
  - `dale_tee` wears `male_casualsuit06` (white tee and jeans).
  - All CC0. Never redesign him.
- **Supporting cast:** `cop`, `bodyguard`, `soldier`, `soldier2` (episode 1); `hr` (Brenda from HR) and `butcher` (Big Tony) (episode 3). Larry variants: `larry_b`, `larry_soldier`, `larry_tee`, `larry_monk`.

## Network (cloud sessions)

`setup_env.sh` downloads from these hosts:
- `download.blender.org`
- `extensions.blender.org`
- `files.makehumancommunity.org` and `files2.makehumancommunity.org`
- `mocap.cs.cmu.edu` (plain http)
- `fonts.googleapis.com` and `fonts.gstatic.com`
- `opengameart.org` (Episode 1's tank and jets only)
- Poly Haven (`api.polyhaven.com`, `dl.polyhaven.org`)
- Hugging Face (whisper model)

A cloud environment must allow them; otherwise run the pipeline on your own Linux machine.

**Hard-coded paths.** Episode 1's `scripts/*.sh` hard-code `/home/user/my-sec-wsb/...`. Episode 2's scripts resolve paths relative to themselves.

## Setup (fresh Linux machine or cloud session)

```bash
bash animation/larry/setup_env.sh          # Blender 4.5.16, MPFB 2.0.18 + MakeHuman packs, CMU mocap, fonts, props, whisper (~10-15 min)
export LARRY_WORK=~/larry_work             # (default) build files, frames and audio go here, outside git
B=/opt/blender-4.5.16-linux-x64/blender
mkdir -p $LARRY_WORK/chars
for c in you larry larry_b you_sun you_pj cop bodyguard soldier soldier2 larry_soldier dale dale_tee larry_tee you_old; do
  $B -b --python animation/larry/scripts/build_character.py -- $c $LARRY_WORK/chars/$c.blend; done
python3 animation/larry/scripts/make_decals.py $LARRY_WORK/decals    # signs/labels/posters (PIL)
```

## Making an episode

1. **Voiceover.** Get the mp3 from the user and transcribe it with word timestamps, using `/opt/whisper/bin/python` and faster-whisper `WhisperModel("small.en", device="cpu", compute_type="int8")`.
   - Decode the mp3 to 16 kHz mono numpy with ffmpeg first. Passing the file path directly hit a PyAV TypeError.
2. **Cut list.** Plan one shot per phrase (1–2 s). Episode 1's cut list is `scripts/cuts.py`.
3. **Shots.** Write one function per shot in the style of `scripts/shots.py`.
   - Episode 1's content lives in `cuts.py`, `shots.py`, `captions.py` and `audio.py`. For a new episode, copy those into an `ep2/` folder and reuse `lib.py`, `mocap.py` and `build_character.py` unchanged.
   - Helpers in `lib.py`:
     - `Char.clip`: mocap clips.
     - `Char.expr`: facial expressions (SMILE, SMUG, CREEPY, SHOCK, RAGE…).
     - `look_at`, `Char.ik`, `Char.attach`: props in hands.
     - `Cam.key` and camera shake.
     - Sets made from boxes, planes and Poly Haven models.
   - Find mocap clips in `/opt/cmu/index.json` (search `desc`). Download a new clip from `http://mocap.cs.cmu.edu/subjects/<subj>/<id>.amc` plus `<subj>.asf` into `/opt/cmu/amc`.
   - Check a clip on a character with `scripts/test_mocap.py` or `scripts/clip_strip.py`.
4. **Preview stills.** Run `scripts/preview_all.sh` and look at every shot before the full render.
5. **Render.** Run `scripts/render_all.sh 2 4 [shots…]` (2 workers, 4 samples).
   - Episode 1 was 1183 frames at about 13 s per frame per worker, so about 2.2 hours of wall time with 2 workers.
   - `render_shot.py` accepts a frame sub-range, which lets you resume a shot that was killed partway.
6. **Audio.** Run `python3 -I scripts/audio.py vo.mp3 mix_raw.wav`, then `scripts/normalize.sh mix_raw.wav $LARRY_WORK/mix.wav` (-14 LUFS).
   - Sound effects are synthesized in numpy inside `audio.py`: whoosh, slap, boing, thud, jets, tank, march, boom, sting, crickets.
7. **Captions.** Run `scripts/captions.py` to write an ASS subtitle file.
   - Style W is white, Y is yellow for interjections, R is red for emphasis, and L is the huge final name.
   - Take the timings from the whisper words.
8. **Assemble.**
   - With captions: `scripts/assemble.sh $LARRY_WORK/larry_final.mp4 final captions`
   - Without captions: `scripts/assemble.sh $LARRY_WORK/larry_clean.mp4 final clean`
   - `assemble.sh` also applies the night colour grade for the finale. Its time window is set inside the script.

## Lessons learned (these save hours)

**Memory**
- Run at most 2 Blender processes at once. Pair heavy shots (several close-up characters) with light ones.
- Don't use Poly Haven trees; they have millions of vertices. Use simple blob trees.
- Textures must be downscaled. `setup_env.sh` does this.

**Speed.** Shadows dominate render time. These Eevee settings worked:
- 4 samples.
- Subdivision only on close-ups.
- Sun-only shadows, with `shadow_resolution_scale` 0.5.
- Fast GI set to AO-only.
- AgX "Medium High Contrast".
- Rendering under `xvfb-run` (Mesa llvmpipe).

**Mocap**
- Many CMU clips have bent arms or tilted heads. Preview clips before using them.
- `mocap.retarget(face=True)` normalizes the heading, and neck/head damping keeps faces steady.

**Props and materials**
- Props in hands: `Char.attach` uses a Child Of constraint with `set_inverse_pending=False` and an identity inverse. Without this, props jump to the origin.
- Tinting MakeHuman clothes: the luminance is normalized first (the `tint` code), because raw textures are dark.
- A mirrored decal or banner needs rotation (90, 0, 0).

**Assets**
- The Poly Haven API needs a User-Agent header. `polyhaven.py` sends one.
- OpenGameArt tank: filter out the helper object `Cube.003`.
- OpenGameArt jets: use object `rafale_B` in `basic_replacements.blend`.

**Audio**
- Put the sting sound effect right after the punchline word, never on top of it.
- The user's TTS reads every word, so scripts must contain only spoken words. In episode 1 a stray "Final shot." was read aloud and had to be cut in the edit.
- The ElevenLabs connector had only 4 credits, so don't rely on it for sound effects. `audio.py` synthesizes them.

## Working with this user

- **Audio:** in Episode 2 they asked for **voiceover only** (no SFX, no music). Use `audio.py ... voice-only` unless they ask otherwise.

- **Keep replies short.** "No other word" means deliver only the requested text (a script, a caption) and nothing else.
- **Ideas:** they like "top 5" lists of escalation premises, each with a twist. The humour is edgy and absurd. Larry's obsession never ends: no redemption or "he gives up" endings.
- **Quality:** they want a high-quality look built from free asset characters, never primitive self-made models.
- **Deliverables:**
  - `larry_final.mp4` (captions burned in) and `larry_clean.mp4` (no captions), both 1080×1920.
  - A short post caption, e.g. "Larry from accounting is undefeated 💀 #shorts #funny #animation".
  - The CC-BY credits from `CREDITS.md` / `UPLOAD.md` must go in the video description.

## Kickoff prompt for a new session

> I'm continuing my "Larry & Dale" 3D animated shorts series (17 episodes done). Read `animation/larry/HANDOFF.md`
> first, especially "START HERE", and follow it step by step: set up with my MPFB zip, rebuild the cast and compare it
> with the pictures in `ref/` before doing anything else. Then wait for my idea and voiceover. Same characters, same
> look, voice only, captions like before, no glitches. Keep replies short.
