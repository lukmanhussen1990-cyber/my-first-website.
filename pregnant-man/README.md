# Pregnant Man: 9:16 3D comedy short (Blender + bpy + ffmpeg)

`final.mp4` is 1080x1920, 30 fps, H.264 + AAC, and follows your voiceover (33.6 s). The captions are burned in, and quiet CC0 sound effects sit 18 dB under your voice.

It uses the same fully scripted pipeline as `../chair-sniff`: MakeHuman characters, sets, props, keyframed body poses, per-line shots and cameras, EEVEE render, Whisper-timed captions and an effects bed.

## What's in this folder

| File | What it is |
|---|---|
| `final.mp4` | The finished short |
| `pregnant_man.blend` | The Blender scene: a living room and a clinic, 19 shots with one camera per shot bound to timeline markers. Sketchfab-model textures are packed. Poly Haven and MakeHuman textures load from `assets/`: run `scripts/fetch_assets.py assets` once. |
| `captions/captions.ass` | Captions (Poppins ExtraBold, 1–3 words, hard cut on/off) |
| `voiceover.mp3` | Your voiceover (used untouched) |
| `script.txt` | Your narration, one line per shot group (13 lines) |
| `build/sfx.wav` | The sound-effects bed mixed under the voice |
| `build/baby_poster.png` | The baby poster: a render of a MakeHuman (CC0) baby |
| `assets_manifest.json` / `credits.txt` | Every third-party asset with source, author and licence |
| `make_video.sh` | Runs the whole pipeline |

## How the gags are built

- **Pillow bump:** the main guy has a second version built with MakeHuman's own `stomach-pregnant` body target, with the shirt fitted over it. The scene swaps to it when the pillow goes in and back when it falls out.
- **Watermelon, belt, harness straps, motor, stethoscope:** ready-made Sketchfab models attached to the characters' spine and neck bones. The watermelon bursts into red and green chunk particles.
- **Silicone belly:** a smooth sphere with a skin-tone material, as the brief allows. It wobbles, slides down to the knees, and kicks with scale pulses.

## Re-render with a new voiceover

```bash
scripts/setup.sh                       # once: venv with bpy 5.2 + faster-whisper, installs MPFB2
cp /path/to/voiceover.mp3 voiceover.mp3
./make_video.sh                        # first run: assets, characters, poster, scene, render, effects, encode
STEPS="transcribe timing scene render sfx encode" ./make_video.sh   # later voiceover changes
```

- Every shot is a fraction of its narration line, so the timing follows the voice automatically. The "Genius!" cut snaps to that word.
- Rendering takes about 7 s per frame on a 4-core CPU with no GPU. Existing frames in `build/frames` are skipped, so a stopped render resumes.

## Assets and licences

- **Characters:** MakeHuman system assets (CC0) through MPFB2: the main guy, the doctor (suit recoloured white), the little cousin, and the baby on the poster.
- **Living room, clinic dressing, textures, outdoor HDRI:** Poly Haven (CC0).
- **Watermelon, belt, harness, motor, stethoscope, exam table, front door, monitor, chair:** Sketchfab models under CC-BY 4.0, downloaded through the public Objaverse mirror. They are credited in `credits.txt`.
- **Sound effects:** CC0 from SFXMint (AI-generated) and wyzowl sfx-kit (synthesised), both on Hugging Face.
- **Animation:** keyframed stiff, Mixamo-style poses on the MPFB2 *Mixamo* skeleton. Mixamo itself needs an Adobe login.
