# Sixth Dimension crayon lyric video

`output/sixth_dimension.mp4` recreates the reference clip: same 720×1280 frame,
30 fps, the same scenes, word timing and 10 fps crayon "boil", with the
original music copied in untouched (`assets/music.m4a`).

- `build_plates.py <reference.mp4>` learns clean artwork for each scene
  (`plates/`) plus the boil schedule and fade curve (`timeline.json`).
- `render.py` draws every frame with fresh crayon grain and muxes the music.
  `python3 render.py --png 10 300` writes preview frames instead.

The lettering in the reference is the Hi Melody font.
