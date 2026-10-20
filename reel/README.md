# John drives the new Roadster through the Earth — 55 s Instagram Reel

Everything here is made from code: the 3D world, the car, the characters, the
animation, the music and every sound effect. No stock footage, no samples, no
screen recording — each of the 1,668 frames is rendered on its own.

## What's in this folder

| File | What it is |
|---|---|
| `out/roadster_through_the_earth.mp4` | **The final Reel.** 1080×1920, 30 fps, 55.6 s, H.264 + AAC, subtitles burned in |
| `script.json` | **The script.** Every spoken word (shown in the subtitles exactly as written), plus the voice choices |
| `voices/n1.wav` … `voices/n7.wav` | **Narrator lines**, one file per line |
| `voices/j1.wav` | **John's line** ("Hi... is there a charger around here?") |
| `voices/*.timing.json` | Word timings for each line (used for the subtitles) |
| `out/clean_video.mp4` | The 3D picture only (no text, no sound), used to re-export without re-rendering |
| `remake_with_elevenlabs.sh` | One command: new ElevenLabs voices → new mix → new subtitle timing → new MP4 |

## Voices: swapping in ElevenLabs later

The brief asked for ElevenLabs voices. When this was made there was no
`ELEVENLABS_API_KEY` (no environment variable, no `.env` file), and the
connected ElevenLabs account had **0 credits left** (every request was refused:
"exceeds your quota of 10000. You have 0 credits remaining"). So, as the brief
said, the video was finished with a local text-to-speech voice instead
(Kokoro, offline): a warm female narrator (`af_heart`) and a young male voice
for John (`am_puck`).

To replace them with ElevenLabs voices, run **one command** from this folder:

```bash
export ELEVENLABS_API_KEY=your_key        # or put ELEVENLABS_API_KEY=... in a .env file
./remake_with_elevenlabs.sh               # model eleven_multilingual_v2
./remake_with_elevenlabs.sh eleven_v3     # or v3, which also uses the [audio tags] in script.json
```

It makes all eight lines with ElevenLabs (narrator and John use different
voices), takes the word timings from ElevenLabs' own timestamps, rebuilds the
music/effects mix around the new voices, regenerates the word-by-word
subtitles with the new timing, and writes a new `out/roadster_through_the_earth.mp4`.
The 3D is **not** re-rendered (it reuses `out/clean_video.mp4`). It takes about a
minute. If anything fails (no key, no credits, network), your current voices
are left untouched.

- Voices are set in `script.json`: narrator **Elena Wren** (friendly, neutral
  accent, `N2MNNfQ4izkc8hqG3xMa`) and John **Will – Relaxed Optimist**
  (`bIHbv24MWmeRgasZH58o`). Elena Wren is a Voice Library voice: add it to
  "My Voices" in your ElevenLabs account first, otherwise the script falls back
  to the premade voice "Sarah". To use any other voice:
  `ELEVEN_NARRATOR_VOICE=<voice_id> ELEVEN_JOHN_VOICE=<voice_id> ./remake_with_elevenlabs.sh`.
- Each line keeps its sync point with the picture (for example "dig" lands on
  the hole opening, "shield" on the shield wrapping round the car). A line that
  comes out longer than its slot is sped up a little to fit.
- John's mouth movements are part of the 3D picture, timed to the current
  voice. The new line starts at the same moment, so it still lines up closely,
  but the mouth won't follow a new delivery word for word unless the 3D is
  re-rendered (`node tools/render_segments.mjs`, about 40 minutes).

Needs: Python 3 with `numpy scipy soundfile pillow`, and `ffmpeg` built with
libass (standard on most Linux and Homebrew builds).

## How it was made

1. **3D, frame by frame** — [three.js](https://threejs.org) scenes rendered in
   headless Chromium (software Vulkan, so no GPU is needed). `render/` holds the
   whole film: the procedural Roadster (`car.js`), the cutaway Earth with its
   soil, rock, glowing mantle and sun-like core (`earth.js`), the backyard, the
   beach, the toy-like characters, every effect (`fx.js`: dirt, sparks, concrete
   rings, heat shield, frost, icy vents, thruster jets, hologram, sand), and the
   post-processing (bloom, heat haze, light streaks, ACES filmic tone map,
   vignette). Animation is a pure function of time (`director.js`,
   `acting.js`, `timeline.json`), so any frame can be rendered alone and nothing
   flickers.
2. **Voices** — `tools/voices_local.py` (Kokoro, offline) or
   `tools/voices_elevenlabs.py`; `tools/align_words.py` turns either into word
   timings.
3. **Sound** — `tools/mix_audio.py` synthesizes the music (soft and
   adventurous, quiet under the voice, and it stops dead right before John's
   line) and all the effects (digging, spinning tyres, drill whine, concrete
   ring thunks, rock crunch, sizzling heat, icy hiss, thruster roar, the big
   whoosh through the core, the sand burst, waves, seagulls, the ice-cream
   plop …), each keyed to the same timeline events as the animation.
4. **Subtitles** — `tools/subtitles.py` writes one word at a time (Fredoka
   Bold, white with a thick black outline and soft shadow, a tiny pop-in
   bounce; John's line in yellow and a little bigger), placed a little above
   the middle, clear of the bottom 20% and the right edge.
5. **Export** — `tools/export_final.py` normalises the sound to −14 LUFS and
   burns the subtitles in.

Re-render the 3D from scratch: `npm install`, then `node tools/render_segments.mjs`
(one scene per segment; `--only 3` re-renders just scene 3), then
`python3 tools/mix_audio.py && python3 tools/subtitles.py && python3 tools/export_final.py`.
Preview single frames: `node tools/render.mjs --stills 0,360,900 --w 540 --h 960 --out stills/look`.

## Notes

- **Car colour:** the brief's scene 1 says "the red Roadster", but it also says to
  match the reference photos *including colour*, and those show a pearl-white
  car with a bronze glass roof — so the car is white everywhere. To make it red,
  change the paint colour in `render/car.js` (`makeCarMaterials`, the `paint`
  material) and re-render.
- No Tesla logo or badges anywhere.
- Font: Fredoka (SIL Open Font License, `assets/fonts/Fredoka-OFL.txt`).
