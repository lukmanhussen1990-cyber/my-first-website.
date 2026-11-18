# "You've invented the washing machine!" — goofy 3D reel

Vertical 1080x1920 / 30 fps comedy reel built entirely from Python in Blender (bpy 5.2.4 LTS, EEVEE),
timed to the supplied ElevenLabs voice-over (used unchanged).

## Pipeline
| Step | Script | Notes |
|---|---|---|
| Transcribe VO | `scripts/transcribe.py` | faster-whisper `medium.en`, word timestamps (audio wording followed over typed script) |
| Main character | `scripts/build_you.py`, `scripts/mh_common.py` | MakeHuman via MPFB 2.0.18: short04 hair, male_casualsuit01, shoes01, game_engine rig + custom IK, 52 ARKit face units interpolated to brows/lashes/eyes/teeth |
| Workers | `scripts/build_workers.py` | 6 MPFB variants in male_worksuit01, instanced x100 |
| Set / props / FX | `scripts/build_set.py`, `build_props.py`, `build_fx.py`, `build_pit.py`, `build_master.py` | Poly Haven CC0: WoodenTable_01, hanging_industrial_lamp, bleach_bottle (recoloured). Everything else modelled procedurally |
| Animation + cameras | `scripts/anim_lib.py`, `scripts/shots.py` | 34 cuts synced to word timestamps; markers bind cameras |
| Render | `scripts/render_final.py` | EEVEE, 4 samples, CPU (Mesa llvmpipe via EGL) |
| Captions | `post/compose.py` | Montserrat ExtraBold, black outline + soft shadow, bounce-in on "Clever!" and the ending |
| Sound | `post/sfx.py`, `post/mix.py` | procedurally synthesised SFX, ducked under VO, mastered to -14 LUFS / -1.2 dBTP |

Build order: `build_you.py` → `build_workers.py` → `build_master.py` → `shots.py` → `render_final.py -- 1 1658` → `post/mix.py` → `post/compose.py`.
