# "You've Invented the Bouncy Castle!" — 3D reel

**Final video:** [`bouncy_castle_reel.mp4`](bouncy_castle_reel.mp4): 1080×1920, 30 fps, 24.85 s (voiceover + 0.5 s),
H.264 + AAC. The audio is the creator's own voiceover only (no music or sound effects), loudness-normalised with
speed and pitch untouched. It has 1–3 word captions synced to the voice and the @theoddtilt2.0 watermark.

Made entirely in **Blender 4.5 LTS** (EEVEE, rendered from Python) in the same backyard and series style as the
dunk tank reel. Both characters are **MakeHuman** models built with **MPFB 2.0.18** and posed on the MPFB default rig:
YOU is identical to the reference, and the crush is a new curvy MakeHuman woman with long brown hair, the white
MakeHuman-logo tee, jeans and white sneakers.

## Pipeline (scripts/)

| Step | Script |
|---|---|
| Characters (MPFB) | `build_characters.py` |
| Set and props (air mattress, foot pump, blower, inflatable castle, phone) | `setbuild.py`, `propbuild.py`, `build_master.py` |
| Posing and shots (19 shots timed to the voiceover word timestamps) | `rigtools.py`, `poses.py`, `shotlib.py`, `shots.py` |
| Render (resumable queue, motion blur) | `render_shot.py`, `renderq.py` |
| QA (feet on ground, wall/mattress clipping) | `qa_feet.py`, `qa_clip.py` |
| Audio (voice only) | `vo_only.sh` |
| Edit (captions, binocular mask, watermark, grade) | `compose.py` |
