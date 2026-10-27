# Larry & John: "Larry's Haunted House"

A vertical (1080x1920, 30 fps) 3D comedy reel. Everything is made with code: every frame is rendered
by Three.js in headless Chromium, every sound effect and the music are synthesized with numpy.
No AI image/video generators, no stock footage, no downloaded sounds.

## Swap in your own voice (one command)

```bash
# from larry-john/
haunted-house/tools/swap_voice.sh path/to/your_voice.mp3                          # narration only
haunted-house/tools/swap_voice.sh path/to/your_voice.mp3 john_6.wav john_13.wav   # + separate "JOHN!" shouts
haunted-house/tools/swap_voice.sh path/to/your_voice.mp3 --preview                # quick 540x960 check first
```

What it does: copies your file (used as-is, never cut or sped up), finds every word's timing
(speech recognition + forced alignment against `script/script.json`), then re-times all 76 shots,
cuts, labels, one-word subtitles, sound effects and the music to your voice, re-renders the frames
and exports `out/reel_haunted-house.mp4`. The 3D scenes themselves don't need any changes.
A full 1080x1920 rebuild takes about 1.5 to 2 hours on a 4-core CPU (no GPU); `--preview` takes about 35 minutes.

## Folders

| Path | What |
|---|---|
| `script/script.json` | the 26 beats (exact text), the "JOHN!" beats and the yellow key words |
| `scene/` | the 3D reel: `world/` (backyard, shed inside, mansion estate, hallway), `cast.js`, `fx.js`, `looks.js` (lighting moods), `shots/` (76 shots for the 26 beats) |
| `overlay/` | subtitles (one word at a time) and the big 3D labels, rendered with transparency |
| `tools/align_voice.py` | word timings from the voice -> `build/timing.json` |
| `tools/make_audio.py` | effects + music + voice mix -> `build/audio/` (about -14 LUFS, peaks under -1 dBTP) |
| `tools/build_reel.py` | cues -> audio -> 3D frames -> overlay -> MP4 (`--size preview` or `--size final`) |
| `tools/qc_sheets.py` | one still per beat + side-by-side sheets with the reference |
| `tools/shot_stills.py` | test stills of any shot, e.g. `python3 tools/shot_stills.py 16b 18d@0.6` |
| `tools/make_temp_voice.py` | the temporary narrator (Piper TTS) used until the real voice arrives |
| `out/` | final deliverables (reel, cover, caption, script, voice, music) |

Shared, reusable parts live one level up: `../engine/` (renderer, toon rig, faces, materials, audio
DSP, sound-effect recipes, music, caption/label drawing) and `../characters/` (Larry, John, the ghost).

## Rebuild by hand

```bash
cd haunted-house
python3 tools/align_voice.py audio/voice_temp.wav       # or your file
python3 tools/build_reel.py --size preview              # build/preview/reel_preview.mp4
python3 tools/build_reel.py --size final                # out/reel_haunted-house.mp4
```

Needs: Node 18+ with `npm install` in `larry-john/` (three.js, fonts), Playwright's Chromium,
ffmpeg, Python 3 with numpy, scipy, soundfile, faster-whisper and torchaudio (for alignment).
