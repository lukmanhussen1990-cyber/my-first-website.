# Larry series: handoff (read this first)

Everything needed to continue this series in a new session or on a new account. The code is on branch `claude/animation-video-blender-ideas-tdfyh9`, under `animation/larry/`.

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

### Episode 2 (next): Larry AND Dale are both obsessed with you

The user records the voiceover with TTS and uploads it as an mp3. This is the approved script:

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
- **Dale from IT (new, design him at the start of episode 2):**
  - He must look instantly different from Larry in silhouette and colour. For example: tall and skinny, a ginger mullet or long hair, a beard, a hoodie or graphic tee with an IT lanyard, and cargo shorts.
  - Use assets from the MPFB data folder (`~/.config/blender/4.5/extensions/.user/user_default/mpfb/data`).
  - Check him with `scripts/lookdev.py` and `scripts/lineup.py`.
  - Once the user likes him, add `"dale"` to `SPECS` and commit, so he stays the same in every future episode. Also add his CC-BY credits, if any, to `CREDITS.md`.
- **Supporting cast:** `cop`, `bodyguard`, `soldier`, `soldier2`.

## Setup (fresh Linux machine or cloud session)

```bash
bash animation/larry/setup_env.sh          # Blender 4.5.16, MPFB 2.0.18 + MakeHuman packs, CMU mocap, fonts, props, whisper (~10-15 min)
export LARRY_WORK=~/larry_work             # (default) build files, frames and audio go here, outside git
B=/opt/blender-4.5.16-linux-x64/blender
mkdir -p $LARRY_WORK/chars
for c in you larry larry_b you_sun you_pj cop bodyguard soldier soldier2 larry_soldier; do
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

- **Keep replies short.** "No other word" means deliver only the requested text (a script, a caption) and nothing else.
- **Ideas:** they like "top 5" lists of escalation premises, each with a twist. The humour is edgy and absurd. Larry's obsession never ends: no redemption or "he gives up" endings.
- **Quality:** they want a high-quality look built from free asset characters, never primitive self-made models.
- **Deliverables:**
  - `larry_final.mp4` (captions burned in) and `larry_clean.mp4` (no captions), both 1080×1920.
  - A short post caption, e.g. "Larry from accounting is undefeated 💀 #shorts #funny #animation".
  - The CC-BY credits from `CREDITS.md` / `UPLOAD.md` must go in the video description.

## Kickoff prompt for a new session

> I'm continuing my "Larry" 3D animated shorts series. In this repo, check out branch `claude/animation-video-blender-ideas-tdfyh9` and read `animation/larry/HANDOFF.md` first. It has the characters, the pipeline, the setup script and the lessons learned. Run `animation/larry/setup_env.sh`, rebuild the characters, then make Episode 2 (Larry & Dale) with the voiceover I've attached, in exactly the same style as Episode 1. Keep Larry exactly as defined in `build_character.py`, and design Dale once, then save him there too.
