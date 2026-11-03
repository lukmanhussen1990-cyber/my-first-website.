# "Gardyloo?" reel

Instagram Reel, 1080x1920, 30 fps, 66.4 s, 40 shots. Same style and workflow as the last reels (airplane toilet /
exam / wedding): calm deadpan narrator telling the story to "YOU", low-poly PS1 / Roblox look, white Pixelify Sans
captions (2–4 words) in the centre, green wavy stink lines and sweat drops.

Reference for style and pacing: the airplane-toilet video file was never saved in the old branches, so (like the
wedding reel) the exam-hall reel from the same series stands in: 28 shots in 44.8 s (0.5–3.4 s each, 1.6 s on
average), hard cuts, slow push-ins with punch-ins on the jokes, white pixel captions with a black outline in the
centre. This reel: 40 shots, 0.84–3.24 s, 1.66 s on average.

Rules kept: silly, never gross. The poop is only ever a small white toilet-paper bundle (with a pink bow); on the
dad only one small brown cartoon smudge on his suit shoulder, with stink lines. Everyone stays fully dressed.

## Status

1. **Voiceover — done.** ElevenLabs, voice **Nassim - Corporate Narration** (`repzAAjoKlgcT2oOAIWt`), model
   `eleven_v4`, tags `[calm] [deadpan]`: the same voice and settings as `wedding_reel` / `bear_reel`. The last
   line "…Gardyloo?" is the same voice with `[whispering]`. No `.env` / API key exists in the repo, so the
   connected ElevenLabs account was used (same as the last reels). 2 takes each; narrator take B and whisper
   take A are used (`script.json` "takes").
   Pauses: 1.0 s before "What you don't know:", 1.7 s awkward pause before "…Gardyloo?", 0.9 s before "And you
   whisper:", short beats around "Nothing." / "Splat." / "You duck.".
   Script changes (allowed by the brief): added "You even add a bow." and "His best suit."; the Edinburgh fact is
   one sentence. Opening, twist fact and the "Gardyloo?" ending are unchanged.
2. **Shot plan + prompts — done.** `prompts.md`: character sheet prompt, then 39 ChatGPT image prompts (same STYLE
   block, each ending "Vertical portrait image, subject in the center, no text."), caption / effect / sound under
   each, 6 key shots (9, 12, 17, 18, 24, 33) with Kling prompts. Shot 20 is a black screen ("Splat." / "And a
   scream.").
3. **Sound — done.** 60 cues, every one placed on a word or a cut. ElevenLabs sound effects (`audio/sfx_src/`,
   2 takes each, the take used is in `make_sfx.py` TAKES): doorbell, failed flush, gurgle, choir, paper rustle,
   splat, western music. Code-made: flush clicks, whooshes, falling whistle, the scream, ducking thud, the
   medieval lute + flute tune, crowd panic, record scratch, cutlery, clock ticks, fly buzz, drips, heartbeat,
   crow, crickets, dog bark, birds, wind, footsteps, creak, sad trombone, sparkles. All effects sit under the
   voice (ducked); final mix -14 LUFS, true peak -1.6 dBTP. `audio/mix_preview.mp3` = voice + effects.
4. **Pictures made in code** (the user said "build yourself" instead of sending ChatGPT images): every shot is a
   low-poly 3D scene in `scene/` (three.js, rendered headless with Playwright + SwiftShader), using the character
   rig and textures of the wedding reel with the new Gardyloo cast (YOU, girlfriend, her dad in a pinstripe suit
   and at dinner with wet hair + towel, mom with glasses + apron, little brother, the bonnet woman and old
   Edinburgh people) and new sets (`scene/sets.js`: the yellow house + street at sunset and at night, upstairs
   hallway, mint-green bathroom with the little window, dining room with the wall clock, old Edinburgh street with
   the castle). `node render_scene.mjs` writes `images/shot_XX.png` (1350x2400) and, for shots 3, 9, 12, 17, 18,
   24, 29, 33 and 37, real 3D animation clips `clips/shot_XX.mp4` (walking, water rising, the window glowing, the
   throw, the flight, the dad looking up, people running, the eyebrow, the clock ticking). It also measures where
   foreheads, the bundle, the smudge and the window are on screen (`build/anchors/`), so the 2D effects sit on
   the right spot. ChatGPT images / Kling clips can still replace any shot: drop them into `images/` / `clips/`.
5. `./make_reel.sh` → `final.mp4`; `./make_preview.sh` → quick half-size preview.

## Files

| | |
|---|---|
| `script.json` | the script lines, the voices (id, model, tags), the takes used, the pauses |
| `audio/raw/narr_*.mp3`, `whisper_*.mp3` | the ElevenLabs takes + `*.words.json` (speech-to-text word times) |
| `stt_words.py` | speech-to-text check (faster-whisper): every script word must be heard |
| `make_voiceover.py` | cuts the takes at the real silences between lines and sets the pauses |
| `audio/voiceover.wav` / `.mp3` | the final timed voiceover (66.4 s) |
| `audio/vo_lines.json`, `audio/voiceover.words.json` | exact start/end of every line and word |
| `plan.py` → `shots.json`, `prompts.md` | the 40 shots (times, captions, effects, sound, Kling prompts) |
| `fonts/` | Pixelify Sans (same caption font as last time, OFL licence) |
| `align_words.py`, `make_captions.py` → `audio/captions.ass` | 2–4 word captions, forced-aligned to the voice |
| `audio/word_onsets.json` | exact start of every spoken word (punch-ins, shakes and sound cues use it) |
| `audiolib.py`, `make_sfx.py` → `audio/sfx/`, `audio/sfx_cues.json` | sound effects and where they play |
| `mix.py` → `audio/mix_final.wav` | voice + effects (ducked under the voice), -14 LUFS, true peak ≤ -1.5 dBTP |
| `scene/` (`shots.js`, `sets.js`, `cast.js`, …), `render_scene.mjs` | the code-made 3D pictures and clips (three.js 0.160) |
| `fx.py` | per-shot camera and effects: push, pan, tilt-up, whip-down, punch-ins, shake, stink lines, sweat, sparkles, window glow, speed lines, fly, old-film sepia (grain, scratches, flicker, 12 fps jitter), western bars + tint, end fade |
| `render.py` | renders each shot from its image / clip (parallel) → `build/seg_XX.mp4`; light PS1 pixel look (`PIXEL=2`) |
| `make_reel.sh` | full build → `final.mp4` (`SKIP_AUDIO=1` reuses the audio) |
| `make_preview.sh` | quick half-size `preview.mp4` |

## Build the video

```bash
pip install numpy scipy soundfile faster-whisper pocketsphinx opencv-python-headless
npm install                        # three.js for the 3D scenes (Playwright + Chromium must be available)
node render_scene.mjs              # 3D pictures -> images/, clips/ (PREVIEW=0.3 for quick small previews)
SKIP_AUDIO=1 ./make_reel.sh        # shots -> final.mp4 (drop SKIP_AUDIO to rebuild captions, sound and mix)
python3 render.py --stills out/    # 3 stills per shot for checking
```
