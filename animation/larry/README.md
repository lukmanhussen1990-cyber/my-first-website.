# "Larry" — 3D animated short (Blender pipeline)

**Continuing in a new session or account? Read [`HANDOFF.md`](HANDOFF.md) first. To rebuild the tools on a fresh machine, run `setup_env.sh`.**

Vertical 1080x1920 short built from the voiceover `vo.mp3` (not committed) with:

- **Characters**: MakeHuman via the MPFB 2 Blender extension (CC0/CC-BY community assets) — `scripts/build_character.py`
- **Motion**: CMU Graphics Lab motion-capture (ASF/AMC) retargeted onto MPFB's `cmu_mb` rig — `scripts/mocap.py`
- **Props / textures / skies**: Poly Haven (CC0) — `scripts/polyhaven.py`; tank & jets from OpenGameArt (CC0)
- **Shots**: 31 shots timed to the voiceover — `scripts/shots.py` (cut list in `scripts/cuts.py`)
- **Render**: Eevee via software OpenGL (Xvfb + Mesa llvmpipe) — `scripts/render_shot.py`, `scripts/render_all.sh`
- **Audio**: voiceover edit + synthesised SFX + loudness normalise — `scripts/audio.py`
- **Captions**: ASS subtitles (Montserrat Black) — `scripts/captions.py`
- **Final**: `scripts/assemble.sh`

See `CREDITS.md` for asset licences.
