# Larry & The Mall Fountain

A 71-second vertical (1080×1920, 30 fps) isometric true-crime parody, narrated by `assets/voiceover.mp3`.

**Final video:** [`larry_and_the_mall_fountain.mp4`](larry_and_the_mall_fountain.mp4)

Open `index.html` through a local web server (for example `python3 -m http.server`) to play the animation live in the browser, in sync with the mixed soundtrack.

## Story beats (synced to the voiceover)

| Time | Scene |
|------|-------|
| 0:00 | Outside the closed mall. Police lights, crime-scene tape around the fountain, Larry in handcuffs, a green smell cloud. |
| 0:05 | VHS rewind to 2:04 AM. Your phone buzzes on the nightstand with "bro emergency 🚨". You sleep through it. |
| 0:12 | Fast-forward to the police station front desk. The desk officer's portrait pops up. The police file appears with a $50 fine. |
| 0:18 | Interrogation room. You walk in and sit down, and the door slams shut. Larry's "I just dropped my phone" statement card appears. |
| 0:28 | Evidence: CAM 3 · MALL FOUNTAIN · 2:11 AM. The footage zooms in ("ENHANCE"), Larry gets circled, and he looks left, then right. |
| 0:38 | The file is stamped **$500**. |
| 0:41 | Close-up of you: sweat drop, slow blink, and a thought bubble of the locked mall toilets. |
| 0:45 | The detective leans in. A FALSE STATEMENT card says up to $1,000, and it gets stamped. |
| 0:54 | Split screen. Larry's face is squished against the glass, mouthing "PLEASE". Your phone gets "don't tell them anything 😭". |
| 1:03 | A CAM 3 replay, then the 🔵 SHOW THE TEXT / 🔴 PROTECT LARRY buttons. The frame freezes on "COMMENT 🔵 OR 🔴". |

## How it's built

- **Renderer:** plain HTML5 Canvas 2D. All art is vector-drawn in code: isometric rooms, characters, portraits, cards and HUD.
  - `js/engine.js`: easing, keyframes, isometric projection, shapes, and the smell-cloud gag.
  - `js/characters.js`: small isometric characters (walk / sit / lean / blink / sweat / lip-sync) and big portrait busts.
  - `js/scenes_a.js`, `js/scenes_b.js`, `js/scenes_c.js`: mall, bedroom, front desk, interrogation room, CCTV footage, close-ups.
  - `js/overlays.js`: clock HUD, police-file folder, word-by-word captions, phone, evidence and violation cards, buttons.
  - `js/main.js`: master timeline, camera moves, impact shakes, transitions, and the split screen.
- **Timing:** `data/script.json` holds every caption word with its timestamp, taken from a Whisper transcription of the voiceover and refined against the audio energy. It also holds every sound-effect cue. `data/vo_env.json` is the voice loudness per frame, which drives the lip-sync.
- **Audio:** `tools/make_audio.py` synthesizes all sound effects procedurally:
  - stamp, ding, gasp, phone buzz, water splash, door slam, footsteps, heartbeat, risers, and others;
  - plus a dark music bed.

  Each effect is calibrated to a loudness target relative to the narration. The mix is normalized to about −14 LUFS.

## Re-rendering

```bash
# voice envelope (lip-sync) and soundtrack
python3 tools/analyze_vo.py assets/voiceover.mp3 data/vo_env.json
python3 tools/make_audio.py                 # needs numpy, scipy, pyloudnorm; writes assets/final_mix.wav

# frames (needs Node + Playwright with Chromium) and encode
node tools/capture.js frames /tmp/frames 4
ffmpeg -framerate 30 -i /tmp/frames/f_%05d.png -i assets/final_mix.wav \
  -c:v libx264 -preset slow -crf 18 -pix_fmt yuv420p -c:a aac -b:a 192k -shortest \
  -movflags +faststart larry_and_the_mall_fountain.mp4

# quick stills for review
node tools/capture.js stills /tmp/stills 0.5,28.5,38.4,70
```
