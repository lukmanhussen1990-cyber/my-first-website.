# "You've Invented the Dunk Tank!" — 3D reel

Vertical 1080×1920, 30 fps, 29.5 s. Made entirely in **Blender 4.5 LTS**, rendered with EEVEE from Python.
The characters are **MakeHuman** models built with the **MPFB 2.0.18** add-on and posed on the MPFB default rig.
The voiceover is the creator's own file (`suno_tank.mp3`).

**Final video:** [`dunk_tank_reel.mp4`](dunk_tank_reel.mp4): 1080×1920, 30 fps, H.264 + AAC, −14 LUFS, with captions and the @theoddtilt2.0 watermark.

## Pipeline (scripts/)

| Step | Script | What it does |
|---|---|---|
| Characters | `build_characters.py` | MPFB: YOU (slim, black `short04` hair, `male_casualsuit01`) and FRIEND (heavy, brown `short02` hair, `male_casualsuit06` MakeHuman-logo tee), default rig, face-unit shape keys, "wet" material control |
| Textures | `gen_textures.py` | leaf atlas, hedge, grass, bullseye, baseball, splat |
| Set | `setbuild.py` | asphalt court and lines, blue-grey shed, orange fence, hedge, trees, hoop, bench, bush, sky, cooling tower |
| Props | `propbuild.py` | binoculars, water balloons, A-frame and bucket, dunk tank (hinged seat, lever, target), baseballs, puddles, FX prototypes |
| Assemble | `build_master.py` | builds `master.blend` = characters + set + props |
| Posing | `rigtools.py`, `poses.py` | FK helpers in the rest-armature frame, plus the pose and expression library |
| Shots | `shotlib.py`, `shots.py`, `fx.py` | 21 shots timed to the voiceover, cameras, shakes, splashes and drips |
| Render | `render_shot.py`, `renderq.py` | per-shot renders, with a resumable two-worker queue |
| Audio | `audio.py`, `mix_audio.sh` | procedural SFX and a light background track mixed under the voiceover (−14 LUFS) |
| Edit | `compose.py` | captions (Montserrat ExtraBold), binocular mask, @theoddtilt2.0 watermark, mux |

Rebuild:

```bash
blender -b --python scripts/build_characters.py -- /opt/work/chars.blend
python scripts/gen_textures.py /opt/work/tex
blender -b /opt/work/chars.blend --python scripts/build_master.py -- /opt/work/master.blend
python scripts/renderq.py 1 S01a,S01b,...,S14 final   # run 2 workers
python scripts/audio.py /opt/work/audio && scripts/mix_audio.sh suno_tank.mp3 /opt/work/audio
python scripts/compose.py final dunk_tank_reel.mp4 /opt/work/audio/mix.wav
```
