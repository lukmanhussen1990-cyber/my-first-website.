# John vs. the Cheetah: a code-only 3D Instagram Reel

A 55.5-second vertical reel (1080x1920, 30 fps, H.264 + AAC). John races a
cheetah in the new Roadster: suction fan, cold-gas thrusters, a river flip,
and a stowaway twist.

Everything is made with code:

- the 3D models, materials, animation and camera;
- the offline renderer;
- the music and sound effects;
- the subtitles and the mix.

Every frame is rendered on its own (no screen recording).

**Final video:** `out/cheetah_race_reel.mp4`

| Deliverable | Where |
|---|---|
| Final reel | `out/cheetah_race_reel.mp4` |
| Script (exact text, delivery tags, voices, timing anchors) | `script/script.json` |
| Voice lines, one file each | `voices/01_narrator.wav` … `voices/08_john.wav` (+ `*.words.json` word timings) |
| Swap in ElevenLabs voices (one command, no 3D re-render) | `./remake_with_elevenlabs.sh`, see [SWAP_VOICES.md](SWAP_VOICES.md) |

## Notes

- **Car color.** The car is pearl white, matching the reference images, even
  though scene 1's text says "red Roadster". To render it red, change the
  `paint` color in `render/js/car.js` and re-render.
- **No logos.** The car has no Tesla logo or badges.
- **Voices.** The voices are local Kokoro-82M. ElevenLabs had no credits left
  when the reel was made. See [SWAP_VOICES.md](SWAP_VOICES.md).

## How it is built

**Renderer**

- three.js runs in headed Chromium (Playwright, Xvfb, ANGLE on Mesa llvmpipe).
- `render/js/main.js` renders each output frame as the average of 6 sub-frames,
  which gives:
  - jittered sub-pixel anti-aliasing,
  - 180-degree shutter motion blur,
  - soft shadows (sun jitter).
- `render/js/post.js` then applies:
  - thresholded mip-chain bloom,
  - heat shimmer from the thrusters,
  - ACES filmic tone mapping,
  - a grade, a soft vignette and dither.

**Determinism.** Everything is a pure function of the video time `t`, so any
frame can be rendered alone, in any order. The slow motion over the river is a
time warp, `tau = W(t)`, in `render/js/timeline.js`.

**Scene modules**

| Module | Contents |
|---|---|
| `car.js` | The Roadster, built from rails. Glass canopy, light bar, aero wheels, rear suction fan, thruster nozzles (back, sides, front), cabin. |
| `cheetah.js`, `charmat.js`, `poses.js` | The cheetah. Shell fur with procedural spots and tear marks, IK legs, rudder tail, expressive eyes and mouth. |
| `john.js` | John: messy brown hair, red hoodie, racing goggles, seatbelt. |
| `terrain.js` | The diorama slice: sand track, cake-cut soil strata with stones, river with a water cross-section. |
| `grass.js`, `trees.js`, `sky.js` | Golden grass, acacias and the sunset. |
| `fx.js` | Particles (sand, dust, water, mist, cartoon cloud), thruster jets and glowing force arrows. |
| `timeline.js`, `choreo.js` | Story beats, motion, poses and the camera. Camera framing keeps the action clear of the subtitle band. |

**Audio and export (`tools/`)**

| Tool | What it does |
|---|---|
| `make_voices_local.py` | Local TTS. |
| `align_words.py` | CTC forced alignment for the word timings. |
| `layout_voice.py` | Places each sentence on its animation anchor. |
| `make_subs.py` | Word-by-word ASS subtitles: Fredoka bold, white with a thick black outline and soft shadow, a small pop-in bounce, John's line in larger yellow. |
| `export_timeline.mjs`, `make_audio.py` | The synthesized score and effects, timed from the same timeline as the animation. |
| `finalize.py` | Ducks the music under the voice, normalizes to -14 LUFS, burns in the subtitles and encodes. |

## Commands

```bash
npm install                     # three, playwright
# re-export only (uses the committed master + stems):
python3 tools/layout_voice.py && python3 tools/make_subs.py && python3 tools/finalize.py
# rebuild the soundtrack stems from the animation timeline:
node tools/export_timeline.mjs && python3 tools/make_audio.py
# full 3D render of the silent master (about 2 h on 4 CPU cores, resumable):
DISPLAY=:99 node render/render_film.mjs --workers 2 --shadow 2048   # needs Xvfb :99
# one still for checking a moment:
DISPLAY=:99 node render/stills.mjs "mode=film&w=1080&h=1920" still.png 23.2
```

The committed `work/master/master.mp4` is an 11.5 Mbps copy of the silent
master, so it fits GitHub's 100 MB file limit. A fresh render writes the full
quality version (CRF 15, about 260 MB) to the same path.

Requirements:

- Node 20+
- Python 3 with numpy, scipy and fontTools
- ffmpeg with libass
- Chromium (Playwright) with an X server (e.g. Xvfb)

The local voice and alignment models (`.cache/`) are downloaded separately and
are not part of the repository.
