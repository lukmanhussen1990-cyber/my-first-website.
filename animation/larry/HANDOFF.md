# Larry series: handoff (read this first)

## START HERE (new account / new AI session)

You are continuing a finished, working pipeline. **Do not redesign anything and do not rewrite the pipeline.**
Episodes 1-8 are done. Every episode folder (`ep2/` … `ep8/`) is a complete, working example: copy the newest one.

**Step 1: get the code.** Either unzip the `larry_project.zip` the user gives you, or check out branch
`ccr-35ca5e9e-l7qz15` of the user's GitHub repo `my-first-website.`; the project is `animation/larry/`.

**Step 2: set up the machine (about 10-15 minutes).** The user will upload MPFB in two parts. Join and check them:
```bash
cat mpfb-2.0.18.zip.part0 mpfb-2.0.18.zip.part1 > add-on-mpfb-v2.0.18.zip
sha256sum add-on-mpfb-v2.0.18.zip   # must be c075b3e9b94b8e5556a5f03f4653602d02ea306de08126e8f55ed6dee28a2dad
bash animation/larry/setup_env_restricted.sh add-on-mpfb-v2.0.18.zip
```
This works even when download.blender.org / mocap.cs.cmu.edu are blocked (Blender comes from PyPI `bpy==4.5.16`,
mocap from Hugging Face). It also needs `pip install faster-whisper` into `/opt/whisper` for transcribing voiceovers.
Never try to get around network blocks (no fake User-Agents, no proxies): if something is blocked, tell the user.
- If `files.makehumancommunity.org` resets every connection (it did on 2026-11-22), fetch the same pack paths from the
  official second mirror `files2.makehumancommunity.org` (ask the user to allow it in the environment), put the zips in
  `/opt/mh_assets/packs/`, then run the script: it skips packs that are already there. The mirror is slow per
  connection (~50 KB/s); downloading the big packs in parallel byte ranges brings it to ~0.5 MB/s.
- If the whisper model download fails on `cas-server.xethub.hf.co`, run it with `HF_HUB_DISABLE_XET=1` (plain HTTPS
  through `huggingface.co`). More CMU clips: search `metadata.jsonl` of the HF mirror, then `scripts/glb2amc.py`.

**Step 3: rebuild the cast from the fixed recipes, then CHECK them against the reference pictures.**
```bash
export LARRY_WORK=~/larry_work; B=/opt/blender-4.5.16-linux-x64/blender; mkdir -p $LARRY_WORK/chars
for c in you larry dale dale_tee you_night you_casual you_work wife kid_boy kid_girl dale_jail you_astro larry_tee \
         you_pj you_sun larry_monk hr butcher; do
  xvfb-run -a $B -b --python animation/larry/scripts/build_character.py -- $c $LARRY_WORK/chars/$c.blend; done
xvfb-run -a $B -b --python animation/larry/scripts/lineup.py -- $LARRY_WORK/chars /tmp/lineup larry,dale,you_casual
```
Compare the lineup with `ref/characters.jpg`, `ref/faces_larry_dale_you_wife_kids.jpg`,
`ref/cast_family_larry_dale.jpg` and `ref/cast_you_work_dale_tee.jpg`. They must match exactly:
- **Larry**: short, chubby, older, mustard polo, brown trousers, moustache, round glasses, grey hair.
- **Dale**: slim Black man, slicked-back short hair, grey utility jacket over a striped shirt + jeans (`dale`),
  or white tee + jeans (`dale_tee`), or orange jumpsuit (`dale_jail`).
- **You**: young white man, short brown hair (several outfits: `you`, `you_casual`, `you_night`, `you_work`, ...).
If a character looks different, the setup went wrong (missing MPFB asset pack). Fix the setup; never edit the recipe.

**Step 4: make the episode** exactly like `ep8/` (see "Making an episode (episodes 2-8)" below).

## Making an episode (episodes 2-8)

1. `mkdir epN`; copy `audio.py normalize.sh render_shot.py preview_all.sh motion_all.sh render_all.sh assemble.sh
   render_sched.py` from `ep8/` and replace `ep8` with `epN` inside them.
2. Transcribe the user's voiceover (whisper `small.en`, word timestamps). Check quiet gaps with ffmpeg + numpy energy
   to place words whisper misses (GENIUS!/CLEVER! often).
3. `epN/cuts.py`: one shot per 1-2 s phrase. `epN/captions.py`: copy ep8's, rewrite `C` (W white / Y yellow
   interjection / R red emphasis / L huge last line). Keep captions under ~16 characters in R and ~20 in W, split
   longer ones. The **character name must be on screen in the first second** (the user's rule).
4. `epN/shots.py`: import the newest episode's shots module (each one imports the previous) and write one function
   per shot. Reuse sets/props/helpers; read the previous episodes' `shots.py` for examples.
5. `W=2 bash epN/preview_all.sh` (3 stills per shot), review EVERY shot with `scripts/tools/sheet.py`, fix, repeat.
   Then `bash epN/motion_all.sh` + `scripts/tools/motion_sheet.py` on the moving shots (catches lag and pops).
6. Render: `MODE=fast python3 epN/render_sched.py 2` (memory-aware, 2 workers; fast = 75 % res, 2 samples,
   ~5 s/frame, ~40-60 min). Full quality: `python3 epN/render_sched.py 4` (~3x slower).
7. Upscale fast frames to 720x1280 (PIL LANCZOS + light unsharp), then
   `bash epN/assemble.sh $LARRY_WORK/epN/larry_epN_final.mp4 final captions` and `... clean`.
8. Send both videos, a one-line post caption, and keep `CREDITS.md` credits for the description. Commit + push.
If the user asks for "what's done so far", run `python3 scripts/tools/partial_cut.py N /tmp/part` and encode it with
the mix and captions; never stop the running render.

## Working with this user (most important rules)
- Very short replies. "No other word" = output only the requested text.
- Audio is **voice only** (no music, no sound effects).
- Edgy, absurd humour; Larry and Dale never give up. Vary the final twist (they disliked a repeated funeral).
- They send screenshots of bugs: fix exactly what they point at, then check the rest.
- Memory: max 2 Blender workers; 6 characters in one shot need ~8.5 GB, so close-up subdivision only.


Everything needed to continue this series in a new session or on a new account. The code is on branch `ccr-35ca5e9e-l7qz15` (originally `claude/animation-video-blender-ideas-tdfyh9`, which is not on this remote), under `animation/larry/`.

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

> I'm continuing my "Larry & Dale" 3D animated shorts series (8 episodes done). Read `animation/larry/HANDOFF.md`
> first, especially "START HERE", and follow it step by step: set up with my MPFB zip, rebuild the cast and compare it
> with the pictures in `ref/` before doing anything else. Then make the next episode exactly like `ep8/`, with the
> voiceover I'm attaching. Same characters, same look, voice only, captions like before. Keep replies short.
