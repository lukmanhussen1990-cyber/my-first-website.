# John Powers the City — code-rendered 3D Instagram Reel

A 66-second vertical Reel (1080×1920, 30 fps, H.264 + AAC) made entirely with code:
a Three.js scene rendered frame-by-frame in headless Chromium, code-synthesized sound effects,
a narrator voice, and word-by-word burned-in subtitles. **No music** (by request): the soundtrack is
voice + sound effects only. At the twist, all sound cuts to silence the moment the battery hits empty,
then a single sad power-down sound plays.

## Deliverables

| File | What it is |
|---|---|
| `output/john_powers_the_city.mp4` | **The final Reel** — H.264 High + AAC 256 kbps, 1080×1920, 30 fps, 66.0 s, −14 LUFS, ~93 MB |
| `output/clean_plate_no_subs.part1.mp4`, `part2.mp4` | The 3D render only (no subtitles, no audio), split at 33.4 s to stay under GitHub's 100 MB file limit — used for re-exports |
| `voice/lines/line_01.wav … line_10.wav` | One narration file per script line |
| `voice/timings/line_XX.json` | Word-level timings for each line (drive the subtitles) |
| `script/voiceover.json` | The script (text, scene windows, sync anchors, emphasised words) |
| `output/subtitles.ass` / `.srt` | The subtitle files that were burned in |
| `audio/stems/sfx.flac` | All synthesized sound effects (used in the Reel) |
| `audio/stems/music.flac` | Synthesized score — **not used**; add it with `tools/export.py --with-music` if ever wanted |

## Swapping in the ElevenLabs voice later (one command)

The ElevenLabs account reachable from this session had **0 credits**, so the current narration
is the local fallback voice (Piper TTS, `en_US-norman-medium`, deep male, lightly processed).

To replace it with ElevenLabs — new voice, new subtitle timing, same 3D picture (no re-render):

```bash
cd reel
ELEVENLABS_API_KEY=sk_your_key ./swap_voice_elevenlabs.sh
# or put ELEVENLABS_API_KEY=... into reel/.env and run ./swap_voice_elevenlabs.sh
# optional: choose a voice   ./swap_voice_elevenlabs.sh --voice-id <voice_id>
```

Requirements: `python3` and `ffmpeg` (with libass, which standard builds include). Nothing else.

What it does:
1. `voice/make_voice_elevenlabs.py` generates all 10 lines with the `/with-timestamps` endpoint
   (default voice: *Don – Movie Trailers*; falls back to the premade *Adam* voice if your account
   can't use it), converts them to `voice/lines/*.wav`, and writes exact word timings from
   ElevenLabs' character alignment to `voice/timings/*.json`. If anything fails (no key, an API
   error, no credits) it stops **without** touching the current voice. The previous voice is kept
   in `voice/backup_<date>/`.
2. `tools/export.py` re-places each line in its scene (each line's "anchor" word lands on its
   visual event, e.g. "So" on the moment the generator snaps in; lines that would overflow their
   scene are gently time-compressed), rebuilds the subtitles from the new timings, re-mixes
   (sound effects duck slightly under the voice, loudness normalised to −14 LUFS / −3 dBTP), and encodes
   `output/john_powers_the_city.mp4` over the subtitle-free render
   (`output/clean_plate_no_subs.part1.mp4` + `part2.mp4`, joined automatically).

## How it is built

```
src/timeline.js        master timeline: scenes, events, speed/power/storm curves (shared by video + audio)
src/main.js            renderer, lights, post-processing, camera path, per-frame animation
src/world.js           sky shader, cut-away soil, lawn + ~55k wind-driven grass blades, street, neighbours, city
src/house.js           two-storey beige house with blue shutters, cut open like a dollhouse
src/machines.js        wooden wheel, stand, cut-away generator, belt, gears, battery, cooling rig, fishing rod
src/characters.js      John, Dad, neighbours (toy-like, expressive faces)
src/fx.js              cables with flowing electricity dots, rain, smoke/steam/sparks, lightning
src/textures.js        all textures generated procedurally (wood, soil strata, copper wire, knit fabric…)
tools/render.mjs       renders exact frames in headless Chromium (stills or lossless video segments)
audio/make_audio.py    synthesizes every sound effect (and an optional, unused score) from the timeline
voice/make_voice_local.py   offline narrator (Piper) with exact phoneme-based word timings
tools/export.py        voice placement, subtitles, mix and final encode (stdlib Python + ffmpeg)
```

Look: physically based materials, soft PCF shadows, half-resolution GTAO ambient occlusion,
hemisphere/environment bounce light, bloom, ACES filmic tone mapping, colour grade with vignette
and slight chromatic aberration, 4× MSAA. Every frame is rendered from its exact time (no screen
recording), so motion is perfectly smooth.

### Full rebuild (≈4.5 h on a 4-core CPU, software WebGL)

```bash
cd reel
npm install                                  # three.js + playwright (uses the system Chromium)
node tools/dump_timeline.mjs                 # timeline -> build/timeline.json (for audio)
python3 audio/make_audio.py                  # sound-effect stem (+ unused music stem)
python3 voice/make_voice_local.py            # local narrator (needs: pip install piper-tts onnx soundfile,
                                             #  and the en_US-norman-medium voice in build/piper/)
tools/render_all.sh                          # 1980 frames -> build/seg/*.mkv (lossless)
tools/make_plate.sh                          # -> output/clean_plate_no_subs.part1/2.mp4
python3 tools/export.py                      # -> output/john_powers_the_city.mp4
```

Font: Fredoka (SIL Open Font License, see `assets/fonts/`).
