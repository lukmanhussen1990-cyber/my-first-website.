# THE PATH

An unofficial Duolingo spec advertisement rendered entirely in code (Python, NumPy, Pillow, OpenCV, FFmpeg): one continuous camera flight through one 3D world, where a single Feather Green line does every job.

Portfolio piece only. Not affiliated with, sponsored by, or endorsed by Duolingo. Duolingo, its logo and Duo are trademarks of Duolingo, Inc.

## Status

| Phase | State |
|---|---|
| 1. Brief | Approved: [`BRIEF.md`](BRIEF.md) |
| 2. Assets | Delivered: [`assets/MANIFEST.md`](assets/MANIFEST.md), awaiting approval |
| 3. Voice | Not started |
| 4. Engine | Not started |
| 5. First preview | Not started |
| 6. Fixes | Not started |
| 7. Portrait | Not started |
| 8. Finals | Not started |

## Layout

- `BRIEF.md`: the creative and technical brief (frame-exact).
- `brief/timeline.json`: every timed event, the VO placement map, the music map and the SFX cue sheet (single source of truth).
- `brief/camera_16x9.json`: world stations, home poses and camera keys for the 16:9 flight.
- `brief/diagrams/`: generated timeline and camera-path diagrams.
- `engine/`: SVG reader/rasterizer (`svg.py`), Duo rig (`duo.py`), supporting graphics (`graphics.py`).
- `audio/`: synthesis primitives (`synth.py`) and the 114-cue SFX library with the original hero sounds (`sfx.py`).
- `tools/plan_brief.py`: validates the timeline, solves the camera flight, renders the diagrams and regenerates the tables in `BRIEF.md`:

```
python3 the-path/tools/plan_brief.py
```

Official brand artwork lives in the git-ignored `assets/brand/` folder and is never committed; restore it with `tools/fetch_brand.sh` (checksum-verified). Licensed fonts go in the git-ignored `assets/fonts/licensed/`; the open-licensed Nunito stand-in is committed.

Environment: `python3 -m venv --system-site-packages .venv && .venv/bin/pip install -r requirements.txt`. Review boards and audio are regenerated into the git-ignored `out/review/` by `tools/brand_sheets.py`, `tools/type_specimen.py`, `tools/graphics_board.py` and `tools/sfx_reel.py`.
