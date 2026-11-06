# Cock Coop: 9:16 3D comedy short (Blender + bpy + ffmpeg)

`final.mp4` is 1080x1920, 30 fps, H.264 + AAC, and follows your voiceover (35.7 s). The captions are burned in, and quiet CC0 sound effects sit 18 dB under your voice.

It uses the same fully scripted pipeline as `../chair-sniff` and `../pregnant-man`: MakeHuman characters, ready-made sets and props, keyframed poses, per-line shots and cameras, EEVEE render, Whisper-timed captions and an effects bed.

## What's in this folder

| File | What it is |
|---|---|
| `final.mp4` | The finished short |
| `cock_coop.blend` | The Blender scene: the backyard, a bedroom and a living room, 26 shots with one camera per shot bound to timeline markers. Sketchfab-model textures are packed. Poly Haven and MakeHuman textures load from `assets/`: run `scripts/fetch_assets.py assets` once. |
| `captions/captions.ass` | Captions (Poppins ExtraBold, 1–3 words, hard cut on/off) |
| `voiceover.mp3` | Your voiceover (used untouched) |
| `script.txt` | Your narration, one line per shot group (14 lines) |
| `build/sfx.wav` | The sound-effects bed mixed under the voice |
| `assets_manifest.json` / `credits.txt` | Every third-party asset with source, author and licence |
| `scripts/` | The pipeline. `build_scene.py` builds the film; `animals.py` poses the rooster and fox rigs. |
| `make_video.sh` | Runs the whole pipeline |

## How the gags are built

- **Rooster and fox:** rigged Sketchfab models. Their bundled clips are only an idle and a mixed clip, so walking, running, pecking, wing flaps, sitting, squeezing and trotting are keyframed on their own bones (`scripts/animals.py`). The rooster is scaled wider to make it fat.
- **Fox grabs the rooster:** a Child Of constraint ties the rooster to the fox's head bone for the run-off shot.
- **Day, sunset and night:** three Poly Haven sky HDRIs, rotated so each sky's sun or moon matches the sun lamp. They are mixed and keyed per shot. Night is a blue-graded moonlit sky with a blue moon rim light and a warm porch light.
- **Wooden box:** Poly Haven crate with the lid removed, turned on its side. It flattens when the rooster sits on it.
- **Coop:** Sketchfab coop with a ramp. Its cloth door curtain is removed so the doorway is open. The wire-mesh door is the chain-link gate from Poly Haven's modular fence, hinged in the doorway. The latch is Poly Haven's gate latch, and its bar swings down to click shut.
- **Rope:** a ready-made straight rope bent along a curve from the rooster's leg to the bed frame.

## Re-render with a new voiceover

```bash
scripts/setup.sh                       # once: venv with bpy 5.2 + faster-whisper, installs MPFB2
cp /path/to/voiceover.mp3 voiceover.mp3
./make_video.sh                        # first run: assets, characters, scene, render, effects, encode
STEPS="transcribe timing scene render sfx encode" ./make_video.sh   # later voiceover changes
```

- Every shot is a fraction of its narration line, so the timing follows the voice automatically. The "Genius!" cut, the box collapse, the door opening and the latch click snap to their words.
- Rendering takes about 7 s per frame on a 4-core CPU with no GPU. Existing frames in `build/frames` are skipped, so a stopped render resumes.
- Delete `build/sfx.wav` before `encode` for a voice-only version.

## Assets and licences

- **Characters:** MakeHuman assets (CC0) through MPFB2: the main guy (white tee, jeans, black shoes; tee and briefs at night), the wife in a nightgown, and the little cousin. The tee, briefs and nightgown come from MakeHuman community CC0 packs.
- **Backyard dressing, crate, chain-link gate, latch, hammer, grass, furniture, textures, skies:** Poly Haven (CC0).
- **Rooster, fox, coop, fence, house, bed, rope, bedroom door:** Sketchfab models under CC-BY 4.0, downloaded through the public Objaverse mirror. They are credited in `credits.txt`.
- **Sound effects:** CC0 from SFXMint (AI-generated) and wyzowl sfx-kit (synthesised), both on Hugging Face. Wing flaps, pecks, hammering, the box crash, running feet, the gate and the latch are included. There are no rooster or fox calls, because no CC0 animal-voice source was reachable from this build.
- **Font:** Poppins ExtraBold (SIL OFL), in `fonts/`.
