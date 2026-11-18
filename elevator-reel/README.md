# "You've invented the elevator!" — goofy 3D reel (episode 2)

Same series pipeline as `washing-machine-reel/` (Blender 5.2 bpy + MPFB character, EEVEE).
Opening gag: tight chest-up shot of him straining with his hands out of frame, then the reveal —
he's hauling grandma's piano up the stairs with a strap.

Build: `build_elev.py` (sets/props) → `elev_shots.py` (24 shots keyed to VO word indices from `words.json`)
→ render → `compose_elev.py final out.mp4 mix.wav`.
`estimate_words.py` makes placeholder timing; when the real VO arrives, Whisper word timestamps replace it.
