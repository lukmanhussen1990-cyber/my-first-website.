# "MOM! I'M DONE!" — wedding reel

Instagram Reel, 1080x1920, 30 fps, 61.1 s, 36 shots. Same style and workflow as the last reels (airplane toilet /
Thanksgiving / bear): calm deadpan narrator telling the story to "YOU", low-poly PS1 / Roblox look, white
Pixelify Sans captions in the centre, green stink lines, sweat drops and tears.

Reference watched for style and pacing: the exam-hall reel uploaded with this request (same series and style
as the airplane-toilet reel; the airplane video file itself was never saved in the old branches). It has about
29 shots in 44.8 s (0.6–3.4 s each, about 1.5 s on average), hard cuts, slow push-ins with punch-ins on the
jokes, captions 2–4 words at a time in a white pixel font with a black outline, a little below the centre, and
an ending that slowly zooms out while green haze fills the room.

## Status

1. **Voiceover — done.** ElevenLabs, voice **Nassim - Corporate Narration** (`repzAAjoKlgcT2oOAIWt`), model
   `eleven_v4`, tags `[calm] [deadpan]` — the same voice and settings as `bear_reel/script.json` and
   `thanksgiving_reel/script.json`. The two yells ("MOM! I'M DONE!") are the same voice with `[shouting]`.
   ElevenLabs flow `eb7qlRn1EmAIRCBYfiKN`; 2 takes each. Narrator take A is used (take B dropped "crying"),
   yell take B is used (its second yell is louder and longer). The last word "DOOONE!" is stretched 1.35x.
   Pauses: 1.00 s before "What you don't know:", 1.25 s before "He throws scissors.", 1.10 s before the last
   line, 0.85 s of real silence after "Silence.", drum-beat gaps between "Rock. / Paper. / Scissors.".
   Script changes (allowed by the brief): added "Louder." after "You yell again." Opening line, twist fact
   and ending are unchanged.
2. **Shot plan + prompts — done.** `prompts.md`: character sheet prompt, 36 ChatGPT image prompts (same STYLE
   block), caption / effect / sound per shot, 6 key shots with Kling prompts.
3. **Build pipeline — ready and tested** end to end with placeholder pictures (61.07 s, 1832 frames, -13.9 LUFS).
   Sound effects: 27 ElevenLabs sound effects (same flow, 4 takes each, `audio/sfx_src/`; the take used for
   each sound is in `make_sfx.py` TAKES, picked from spectrograms) + code-made ones (whooshes, ding, womp,
   heartbeat, drip, pad, booms, the yell echoes, the war-drum pattern). 43 cues, every one placed on a word.
4. **Pictures made in code** (the user asked to build without waiting for the ChatGPT images): every shot is a
   low-poly 3D scene in `scene/` (three.js, rendered headless with Playwright + SwiftShader), using the character
   rig and textures from the Thanksgiving reel with a new wedding cast (YOU, groom, bride, three uncles, grandpa,
   DJ, waiter, baby, kids, guests), the wedding hall, hallway, marble bathroom and kids' bathroom.
   `node render_scene.mjs` writes `images/shot_XX.png` (1350x2400) and, for shots 5, 8, 17, 20, 31 and 33,
   real 3D animation clips `clips/shot_XX.mp4` (guests turning in sync, the chandelier swinging, the groom's
   slow walk...). It also measures where mouths, eyes and doors are on screen (`build/anchors/`), so the 2D
   effects (stink lines, sweat, tears, sound rings) sit on the right spot.
   If ChatGPT images / Kling clips arrive later, drop them into `images/` and `clips/` and run `./make_reel.sh`.
5. **Done: `final.mp4`** — 1080x1920, 30 fps, 61.07 s (1832 frames), H.264 + AAC, -13.9 LUFS, 36 MB.
   Checked: one frame of every shot (picture matches the line, captions in sync, effects on the right spot).
   `./make_reel.sh` rebuilds it; `./make_preview.sh` makes a quick half-size `preview.mp4`.

## Files

| | |
|---|---|
| `script.json` | the script lines, the voices (id, model, tags), the takes used, the pauses |
| `audio/raw/narr_*.mp3`, `yell_*.mp3` | the ElevenLabs takes + `*.words.json` (speech-to-text word times) |
| `stt_words.py` | speech-to-text check (faster-whisper): every script word must be heard |
| `make_voiceover.py` | cuts the takes at the real silences between lines and sets the pauses |
| `audio/voiceover.wav` / `.mp3` | the final timed voiceover (61.1 s) |
| `audio/vo_lines.json`, `audio/voiceover.words.json` | exact start/end of every line and word |
| `plan.py` → `shots.json`, `prompts.md` | the 36 shots (times, captions, effects, sound, Kling prompts) |
| `fonts/` | Pixelify Sans (same caption font as last time, OFL licence) |
| `align_words.py`, `make_captions.py` → `audio/captions.ass` | 2–4 word captions, forced-aligned to the voice (pocketsphinx) |
| `audio/word_onsets.json` | exact start of every spoken word (used for punch-ins, shakes and sound cues) |
| `audiolib.py`, `make_sfx.py` → `audio/sfx/`, `audio/sfx_cues.json` | sound effects and where they play |
| `mix.py` → `audio/mix_final.wav` | voice + effects (ducked under the voice), -14 LUFS, true peak ≤ -1.5 dBTP |
| `fx.py` | per-shot camera moves and effects (push, pan, punch-ins, shake, stink lines, sweat, tears, haze …) |
| `render.py` | renders each shot from its image / Kling clip (parallel) → `build/seg_XX.mp4` |
| `make_reel.sh` | the whole build → `final.mp4` (1080x1920, 30 fps, H.264 + AAC, captions burned in) |
| `scene/` (`shots.js`, `hall.js`, `cast.js`, …), `render_scene.mjs` | the code-made 3D pictures and clips (three.js 0.160, `npm install`) |

## Build the video

```bash
pip install numpy scipy soundfile faster-whisper pocketsphinx opencv-python-headless fonttools
npm install                        # three.js for the 3D scenes (Playwright + Chromium must be available)
node render_scene.mjs              # 3D pictures -> images/, clips/ (PREVIEW=0.4 for quick small previews)
./make_reel.sh                     # captions -> sound -> mix -> shots -> final.mp4
python3 render.py --stills out/    # 3 stills per shot for checking
```

## Rebuild steps 1–2

```bash
pip install numpy soundfile faster-whisper
python3 stt_words.py audio/raw/narr_A.mp3 audio/raw/yell_B.mp3   # word times + script check
python3 make_voiceover.py                                        # audio/voiceover.wav + timings
python3 plan.py                                                  # shots.json + prompts.md
```
