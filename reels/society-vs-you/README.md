# Society vs You — stickman reel

13-second vertical stickman reel (1080×1920, 30 fps, H.264, no audio), drawn frame-by-frame
with pycairo and piped straight into ffmpeg.

- `stickman_society_vs_you.mp4` — the final video
- `stickman_society_vs_you_contact_sheet.png` — one frame per 0.5 s
- `stickman_society_vs_you.py` — the whole thing: config, rig, scene, story, renderer

```bash
pip install pycairo                          # needs libcairo2-dev; ffmpeg on PATH
python3 stickman_society_vs_you.py --sheet   # contact sheet
python3 stickman_society_vs_you.py --video   # MP4
python3 stickman_society_vs_you.py --frame 9.5 --out-dir /tmp   # single frame PNG for debugging
python3 stickman_society_vs_you.py --sheet-times 2.5,9.5,12.2   # review sheet of chosen moments
```

New versions only need `CONFIG` at the top of the script: header text, labels (`text.crowd`,
`text.hero`), watermark, colors, layout (positions, sun, horizon), figure and rock sizes, and the
story `beats`. No camera shake, glitch, flash or blur is used, so effects can be added later.
