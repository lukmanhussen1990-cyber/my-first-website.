# "You broke the record" — plumber reel

Instagram Reel, 1080x1920, 30 fps, 57.9 s, 38 shots. Same style and workflow as the last reels (airplane toilet /
exam / wedding / Gardyloo): calm deadpan narrator telling the story to "YOU", low-poly PS1 / Roblox look, white
Pixelify Sans captions (2–4 words) in the centre, green wavy stink lines and sweat drops.

Reference for style and pacing: the airplane-toilet video file was never saved in the old branches, so (like the
wedding and Gardyloo reels) the exam-hall reel from the same series stands in: 28 shots in 44.8 s (0.5–3.4 s
each, about 1.6 s on average), hard cuts, slow push-ins and punch-ins on the jokes, white pixel captions in the
centre, an ending that slowly zooms out with stink lines. This reel: 38 shots, 0.57–2.58 s, 1.52 s on average.

Rules: silly, never gross, everyone fully dressed. The brief first said to hide the poop under a pixel censor
block; the user then asked to "add the big poop", so every bowl shot shows a comically huge cartoon poop in the
poop-emoji style (a shiny brown low-poly swirl with two dot eyes, much too big for the bowl; it blinks on "Looking
at you."), with green stink lines rising. The museum fossil is a small brown stone-like shape.

## Steps

1. **Voiceover — the user's own recording** (`audio/raw/user_voiceover.mp3`, 53.8 s), used as it is. Speech-to-text
   (`stt_words.py`, faster-whisper) heard all 138 script words in order. `import_voiceover.py` only adds silence in
   two existing pauses, as the brief asks: before "What you don't know" (0.70 → 1.15 s) and the dramatic pause after
   "Kid…" (0.52 → 1.47 s), cut at the quietest point with soft fades; plus 3.2 s of tail for the ending shot.
2. **Shot plan + prompts** — `plan.py` → `shots.json` + `prompts.md` (character sheet prompt, 38 ChatGPT image
   prompts with the same STYLE block, caption / effect / sound under each, Kling prompts for the 6 key shots 1, 12,
   22, 24, 34, 37). Captions: `align_words.py` + `make_captions.py` → `audio/captions.ass` (52 chunks, each shown
   on its word, at most ~45 ms early). The first line is shown exactly as spoken.
3. **Pictures made in code** (the user said "build yourself"): every shot is a low-poly 3D scene in `scene/`
   (three.js, rendered headless with Playwright + SwiftShader) — the character rig from the earlier reels with the
   new cast (YOU, FRIEND, HIS MOM, HIS DAD, LITTLE SISTER, GRANDMA in her wheelchair, the PLUMBER and his younger
   self, museum visitors and a guard) and new sets in `scene/sets.js` (yellow-tiled bathroom with the door, the
   upstairs hallway, the house + street at sunset with the plumber's van, the museum hall with the glass case, the
   flashback kitchen). `node render_scene.mjs` writes `images/shot_XX.png` (1350x2400) and real 3D animation clips
   `clips/shot_XX.mp4` for shots 1, 2, 5, 12, 21, 22, 24, 34 and 37 (straining, the picture falling, the swirl, the
   plunger snapping, the van, the hero walk, the cap, the measuring tape, the clapping). It also measures where the
   bowl, foreheads, the eye and the window are on screen (`build/anchors/`), so the stink lines and effects sit on
   the right spot.
4. **Sound** — `make_sfx.py` → 58 cues on words / cuts: straining grunt, light flicker buzz, picture rattle + crash,
   dun dun DUNNN, flush clicks + flush, sad gurgle, blink, horror sting, plunger squelch, creak + CRACK, knocks,
   heartbeat, phone dialing, clock ticks, tea slurp, van screech, heroic brass fanfare, drone, sad trumpet, projector
   rattle + music box, pipe spray, record scratches, shocked brass hit, museum footsteps + choir, ding, murmurs,
   measuring-tape zip, camera shutter + flash, piano, slow clapping into applause, birds, a far-away flush.
   All code-made except three ElevenLabs takes reused from the Gardyloo reel (weak flush, gurgle, choir).
   `mix.py`: every effect sits at least 10 dB under the voice (ducked), final -13.8 LUFS, true peak -1.7 dBTP.
5. **Edit** — `fx.py` (per-shot camera + effects: push-ins, punch-ins, shake, flicker, stink
   lines, sweat, veins, tear, speed lines, old-film sepia for the flashbacks and the museum, camera flash, end fade)
   + `render.py` → `build/seg_XX.mp4`; `./make_reel.sh` → `final.mp4`.

## Build

```bash
pip install numpy scipy soundfile faster-whisper pocketsphinx opencv-python-headless
npm install                        # three.js for the 3D scenes (Playwright + Chromium must be available)
python3 stt_words.py audio/raw/user_voiceover.mp3 && python3 import_voiceover.py && python3 plan.py
node render_scene.mjs              # 3D pictures -> images/, clips/ (PREVIEW=0.3 for small previews)
./make_reel.sh                     # captions -> sound -> mix -> shots -> final.mp4 (SKIP_AUDIO=1 reuses the audio)
```
