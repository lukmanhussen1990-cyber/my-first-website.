# What If Mars Appeared in Earth's Sky? — 45-second science reel

- `What_If_Mars_Appeared_in_Earths_Sky.mp4`: the finished vertical reel. It is 1080×1920 at 30 fps, exactly 45.0 s, with H.264 video and AAC 48 kHz stereo audio. The voiceover, burned-in subtitles, music and sound effects are all mixed in.
- `SCIENCE_NOTES.txt`: one-page calculations, assumptions and uncertainty labels.
- `QC_REPORT.md`: results of the final QC checklist.
- `src/`: the code that produced the reel. Physics is in `science.py`, 3D scene geometry in `geometry.py`, cartoon maps in `cartoon_maps.py`, the renderer in `planet.py` and `ground.py`, scenes in `scenes.py`, text in `overlay.py`, voice edit and alignment in `vo_edit.py` and `align.py`, score and mix in `audio.py`, and QC in `qc.py`.

The style is cartoon (cel-shaded, flat colours, outlines). The planet maps are derived from real NASA data, so surface features sit in their true places.
