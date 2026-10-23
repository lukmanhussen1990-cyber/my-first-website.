# Society vs You — stickman reel

13-second vertical stickman reel (1080×1920, 30 fps, H.264 + AAC soundtrack), drawn frame-by-frame
with pycairo and piped straight into ffmpeg.

- `stickman_society_vs_you.mp4` — the final video
- `stickman_society_vs_you_contact_sheet.png` — one frame per 0.5 s
- `stickman_society_vs_you.py` — the whole thing: config, rig, scene, story, renderer
- `reel_audio.mp3` — the soundtrack, cut to the story at render time

```bash
pip install pycairo                          # needs libcairo2-dev; ffmpeg on PATH
python3 stickman_society_vs_you.py --sheet   # contact sheet
python3 stickman_society_vs_you.py --video   # MP4 (with the soundtrack)
python3 stickman_society_vs_you.py --frame 9.5 --out-dir /tmp   # single frame PNG for debugging
python3 stickman_society_vs_you.py --sheet-times 2.5,9.5,12.2   # review sheet of chosen moments
```

New versions only need `CONFIG` at the top of the script: header text, labels (`text.crowd`,
`text.hero`), watermark, colors, layout (positions, sun, horizon), figure and rock sizes, the
story `beats` and the `audio` cut. No camera shake, glitch, flash or blur is used, so effects can be
added later.

## Soundtrack sync

The track (168 BPM, 11.06 s) starts 0.458 s in. When it runs out, its drop phrase (8.195–11.052 s)
repeats, crossfaded over 12 ms. The last 0.55 s fades out over the frozen final frame.

| video | music |
| --- | --- |
| 2.2 s, he strains on the rock | first 808 slide |
| 3.0 s, the whisper starts | bass stops |
| 5.06 s, Friends walks away | breakdown, bass drops out |
| 7.75 s, eyes snap angry | the drop |
| 7.88 s, he starts to stand | 808 |
| 8.6 s, the lift starts | 808 |
| 9.3 s, Friends turns back in shock | 808 |
| 10.02 s, rock pressed overhead | 808 |
| 10.6 s, he steps forward | the drop again (loop) |
| 10.73 s, the crowd steps back | 808 |
| 11.45 s, Relatives trips | 808 |
| 12.16 s, rock slams down | 808 |

To use another track, set `audio.file`, `audio.start` and `audio.loop` (seconds in the track). Set
`audio.file` to `None` for a silent video.
