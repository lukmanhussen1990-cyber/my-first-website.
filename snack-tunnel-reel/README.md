# The Secret Snack Tunnel: Instagram Reel

Vertical 9:16 reel (1080x1920, 30 fps, 56 s, H.264 + AAC): a kid digs a secret
tunnel from the backyard to the kitchen for midnight snacks, one smart fix at a
time, at night, as a 3D cutaway diorama, until Mom is waiting in the kitchen.

## How it is made

| Part | How |
| --- | --- |
| 3D animation | [three.js](https://threejs.org) in headless Chromium, every frame rendered (no screen capture), accumulated over sub-frames (sub-pixel jitter, soft moonlight, occluded sky light, motion blur), then bloom, an AgX filmic grade and a soft vignette. See [`DESIGN.md`](DESIGN.md). |
| Timing | [`src/timeline.js`](src/timeline.js): the voice slots, every animation beat and camera key; [`tools/export_timeline.mjs`](tools/export_timeline.mjs) hands it to the sound and subtitle tools. |
| Script | [`script.json`](script.json): every line, who says it, and the voices for each engine. |
| Voices | [`tools/voices.py`](tools/voices.py) makes one file per line in `assets/vo/<id>.wav` with word timings in `assets/vo/<id>.words.json`. It uses ElevenLabs when a key is available and falls back to a local voice otherwise. **The current takes are local [Kokoro](https://github.com/thewh1teagle/kokoro-onnx) voices** (narrator `am_michael`, Mom `af_heart`): the ElevenLabs account had no credits left. |
| Subtitles | [`tools/captions.py`](tools/captions.py): one word at a time, a little above the middle, Fredoka Bold white with a thick black outline and a soft shadow, a tiny bounce on each word; Mom's line in yellow and bigger. Spelling straight from the script. |
| Sound | [`tools/audio.py`](tools/audio.py): everything synthesised in code. Soft, sneaky pizzicato / marimba / celesta music that stops dead right before "Looking for these?"; digging thuds, falling dirt, wooden knocks, the loud clang on the rock, the dog's collar, the tiny spoon, calendar pages, the tape measure, the tile cutter, hinges, the squeaky pulley, the fridge light, crunchy chips, crickets. Mixed under the voice, -14 LUFS, true peak under -1 dBTP. |

## Files

- `snack-tunnel.mp4`: the reel.
- `assets/vo/<id>.wav`, `assets/vo/<id>.words.json`: the voice lines and their word timings; `script.json`: the script.
- `render/clean.mp4`: the 3D render with no sound and no subtitles, kept so voices and subtitles can be redone without re-rendering.

## Rebuild

```bash
npm install                                   # three.js
pip install numpy scipy soundfile pillow faster-whisper kokoro-onnx
./make_reel.sh                                # sound, subtitles, 3D frames (SPP=5 JOBS=3), export
```

`make_reel.sh` uses the voice files that are already in `assets/vo`. Each render
job needs about 3 GB of memory at full size, so keep `JOBS` to what fits.
Quick looks: `node render.mjs stills 3,23.6,53.6 --spp 2 --scale 0.5` (PNG stills).

## Swap in the ElevenLabs voices later

1. Get an ElevenLabs API key with credits and either export it
   (`export ELEVENLABS_API_KEY=...`) or put `ELEVENLABS_API_KEY=...` in a `.env` file
   in this folder (it is git-ignored).
2. Optional: pick the voices in `script.json` under `voices.narrator.elevenlabs` and
   `voices.mom.elevenlabs` (`voice_id`, `model_id`, `voice_settings`). They are set to
   "Holden - Warm Midwest Narrator" and "Hollie Sue - Expressive, Warm, & Witty".
3. Run **`./revoice.sh`**. It remakes every line with ElevenLabs (with exact word
   timings from the API), rebuilds the mix and the subtitles from the new timings and
   exports `snack-tunnel.mp4` from `render/clean.mp4`. The 3D is not re-rendered.

Each line keeps its slot in the reel. A new take that runs longer than its slot is
sped up slightly (at most 1.12x) and reported. The previous voice files are copied
to `assets/vo/previous/` first. Nothing is overwritten unless every line was
voiced, so a wrong key or no credits leaves the reel as it was.
`ENGINE=kokoro ./revoice.sh` re-voices with the local engine instead, and
`python tools/test_voices.py` checks the ElevenLabs path offline.

Local voices: `pip install kokoro-onnx`, then put `kokoro-v1.0.onnx` and
`voices-v1.0.bin` from the
[kokoro-onnx releases](https://github.com/thewh1teagle/kokoro-onnx/releases/tag/model-files-v1.0)
in `$KOKORO_DIR` (default `/home/user/tts-models`). Piper and espeak-ng also work as
fallbacks (see `tools/voices.py`).

Font: [Fredoka](https://fonts.google.com/specimen/Fredoka) (SIL Open Font License 1.1).
