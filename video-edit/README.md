# Video edit: code-made animations + subtitles

Deliverables (repo root): `video_edited.mp4`, `subtitles.srt` (and `subtitles.ass`, the burned-in word-highlight version).

All new animations are 100% code (Python + pycairo + numpy + OpenCV), rendered as 1920x1080 PNG frames at
24000/1001 fps with 6-sample motion blur, then swapped in at the exact original frames:

| Part | Frames | Script |
|---|---|---|
| A name title (old title removed by motion-tracked patching) | 21-136 (title 27-130) | `clean_title.py`, `anim_A.py` |
| B paper tree | 326-496 | `anim_B.py` |
| C code lens | 762-908 | `anim_C.py` |
| D documents | 1227-1401 | `anim_D.py` |
| E infinite zoom | 1796-1925 | `anim_E.py` |
| F moon match-cut (radial dissolve, logo footage untouched after frame 1933) | 1926-1933 | `anim_E.py trans_full` |

Pipeline: `align.py` (pocketsphinx forced alignment of the transcript) -> `make_subs.py` -> `track_shot1.py` ->
`clean_title.py 21 136 110` -> `anim_*.py full` -> `assemble.py video_edited.mp4 subtitles.ass`.
Audio is stream-copied; all 2046 video timestamps match the original.
