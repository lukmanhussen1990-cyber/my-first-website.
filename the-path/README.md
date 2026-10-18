# THE PATH

An unofficial Duolingo spec advertisement rendered entirely in code (Python, NumPy, Pillow, OpenCV, FFmpeg): one continuous camera flight through one 3D world, where a single Feather Green line does every job.

Portfolio piece only. Not affiliated with, sponsored by, or endorsed by Duolingo. Duolingo, its logo and Duo are trademarks of Duolingo, Inc.

## Status

| Phase | State |
|---|---|
| 1. Brief | Delivered: [`BRIEF.md`](BRIEF.md), awaiting approval |
| 2. Assets | Not started |
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
- `tools/plan_brief.py`: validates the timeline, solves the camera flight, renders the diagrams and regenerates the tables in `BRIEF.md`:

```
python3 the-path/tools/plan_brief.py
```

Official brand artwork and licensed fonts live in git-ignored folders (`assets/brand/`, `assets/fonts/`) and are never committed.
