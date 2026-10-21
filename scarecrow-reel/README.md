# The Scariest Scarecrow — a 50-second 3D Reel made with code

A vertical Instagram Reel (1080×1920, 9:16, 30 fps, ~50 s), made entirely with code.
A kid builds a scarecrow, the crows keep outsmarting it, and every problem gets a smart fix.
Then the crows move in.

**Final video:** `out/scarecrow_reel.mp4` (H.264 + AAC, subtitles burned in)

| What | Where |
|---|---|
| Final MP4 | `out/scarecrow_reel.mp4` |
| Clean master (no subtitles, no audio) | `out/master_no_subs.mp4`, used for re-exports |
| Voiceover script | `script/voiceover.json` (plus a plain copy in `script/voiceover_script.txt`) |
| Voice files (one per line) | `voices/line01_narrator.wav` … `voices/line07_kid.wav` |
| Word timestamps per voice file | `voices/*.words.json` |
| Sound cue sheet (exported from the 3D timeline) | `audio/cues.json` |

## How it is made

* **3D:** Three.js, rendered frame by frame in headless Chromium (software WebGL) with
  `render/render.mjs`. Every frame is computed from time alone, with no screen recording, so
  the motion is exactly smooth. Look: physically based materials with procedural textures
  (soil strata, burlap, plaid, straw weave, wood grain, feathers, leaves), soft PCF shadows,
  image-based bounce light, about 30,000 swaying grass blades, bloom on the glowing parts,
  an ACES filmic tone map, a vignette and 4× MSAA.
* **Cutaway diorama:** the garden is sliced open like a cake. The hole, the backfilled soil,
  the pole, the motor, the wires, the battery and the random chip all sit on the cut face.
* **Voices:** `tools/make_voices.py` uses ElevenLabs when a key is available. Otherwise it
  falls back to local Piper neural TTS and takes exact word timings from Piper's phoneme
  alignments.
* **Music and sound:** synthesized with numpy in `audio/synth.py`. That covers the sneaky
  background score, which stops dead before the twist, the speaker's dance track, every
  sound effect and the day/night ambience. Each effect is placed on the exact frame of its
  animation event (`audio/cues.json`).
* **Subtitles and export:** `tools/compose.py` mixes the voices, ducks the music under them,
  normalises loudness to −14 LUFS and burns in the word-by-word subtitles. Each word pops in
  with a small bounce; the kid's line is yellow and larger. It then encodes the MP4.

## Swap in the ElevenLabs voices later (one command, no 3D re-render)

```bash
cd scarecrow-reel
export ELEVENLABS_API_KEY=your_key_here     # or put ELEVENLABS_API_KEY=... in scarecrow-reel/.env
./remake_with_elevenlabs.sh
```

This regenerates all seven voice lines with ElevenLabs. The narrator is *Elena Wren* (neutral
accent) and the kid is *Piku* (kid character voice); the voice IDs are in
`script/voiceover.json`. Word timestamps come from ElevenLabs' `with-timestamps` endpoint, and
the subtitles are re-timed to match automatically. The script then re-mixes the audio and
re-exports `out/scarecrow_reel.mp4` from the clean master, without re-rendering the 3D.

* If a new take runs longer than its slot, it is sped up slightly, by at most 25 %
  (`start` / `end_by` per line in `script/voiceover.json`).
* To change a voice, edit `elevenlabs_voice_id` in `script/voiceover.json`. To change the
  delivery, edit `eleven_prompt` (bracketed audio tags such as `[warmly]` steer eleven_v3).
* To redo only one line: `./remake_with_elevenlabs.sh --only line07`
* If ElevenLabs fails (no key, an error, no credits), nothing is overwritten.
* Requirements: Python 3 with `numpy scipy pillow`, and `ffmpeg` on the PATH.

## Rebuild everything from scratch

```bash
python3 -m venv .venv && .venv/bin/pip install -r scarecrow-reel/requirements.txt
cd scarecrow-reel/render && npm install          # three.js + playwright (uses an installed Chromium)
node render.mjs --cues ../audio/cues.json        # export the sound cue sheet from the timeline
node render.mjs --stills 36,327,774,1395         # quick check frames -> build/stills
node render.mjs --range 0 1515 --workers 3       # full render -> build/video_clean.mp4 (resumable)
cd .. && ../.venv/bin/python tools/make_voices.py   # ElevenLabs if a key is set, else local Piper
../.venv/bin/python audio/synth.py && ../.venv/bin/python tools/compose.py
```

## Scenes

1. The kid digs a deep hole (shown in the cutaway), plants the scarecrow and packs the dirt down.
   The crows land on the fence, see the scarecrow and panic.
2. A calendar flips a few days. A crow pokes the scarecrow; nothing happens, so the gang
   lands on its arms and eats tomatoes. A motor snaps onto the pole underground and the
   scarecrow spins. The crows get flung off.
3. The crows nod to the spin rhythm and time their landing between spins. A RANDOM chip
   goes in, the scarecrow waves at random times, and the crows flap away confused.
4. Night falls. The crows tiptoe in. Glowing red eyes and a motion sensor with a glowing cone
   go in; a crow steps into the cone, the alarm trips, and they fly off squawking.
5. Day. The crows aren't scared any more (one even waves at the eyes). A speaker goes on the
   hat and plays a hawk screech, shown as glowing sound rings, and the crows dive into the bushes.
6. The kid admires the fully upgraded scarecrow while the camera pulls back over the garden
   at sunset.
7. A few days later: a nest of baby crows sits on the hat. A crow pecks the speaker button,
   the music cuts out, dance music plays and the whole family bobs to the beat.
   The kid shrugs: "...Okay, you can stay."

Fonts: Fredoka (SIL Open Font License, see `assets/fonts/`).
