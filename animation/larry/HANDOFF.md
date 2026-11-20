# Larry series: handoff (read this first)

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

> I'm continuing my "Larry" 3D animated shorts series. In this repo, check out branch `ccr-35ca5e9e-l7qz15` and read `animation/larry/HANDOFF.md` first. It has the characters, the pipeline, the setup script and the lessons learned. Run `animation/larry/setup_env.sh`, rebuild the characters, then make Episode 2 (Larry & Dale) with the voiceover I've attached, in exactly the same style as Episode 1. Keep Larry exactly as defined in `build_character.py`, and design Dale once, then save him there too.
