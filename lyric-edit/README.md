# Lyric edit: "She's a lady"

A square (1:1) lyric video made from four illustrations. The subtitles copy the
reference clip: the same lyrics, the same letter-by-letter timing, the same type
style and the same layout (text placed in the empty space next to the character).

## Files

| File | What it is |
| --- | --- |
| `output/lyric_edit_no_audio.mp4` | 1080×1080, 30 fps, 28.9 s, silent. Add the song inside Instagram/TikTok. |
| `output/stills/*.png` | 2160×2160 still of every scene with its full lyric |
| `render.py` | Renders the video, the stills and a layout check |
| `images/` | The four source illustrations (never edited) |
| `fonts/` | Archivo variable font (SIL Open Font License, see `fonts/OFL.txt`) |

The version with the song (`output/lyric_edit.mp4`) is not committed: this repository
is public and the song is copyrighted. Re-create it with the command below.

## Subtitle style (measured from the reference clip)

- **Type:** Archivo at weight 850 and width 114. This wide, heavy grotesque matches the reference letter
  widths to within 1%. Solid black, with no outline, shadow or box.
- **Size:** cap height 48 px at 1080 (the reference has 32 px at 720), line spacing 77 px.
- **Animation:** typewriter. Every letter appears on the same frame as in the reference
  (all 122 letters were checked against the rendered video: 0 frames off) and fades in over 3 frames.
- **Layout:** the lines are stacked beside or above the character, as in the reference: a staircase for "She's a lady",
  left-aligned for "And I am just a boy", top-left plus centred for "Just a line without a hook",
  top-left plus right-aligned for the hug and the sunset.
- **Transitions:** at each of the reference's cut points the picture fades up from white over 10 frames.
  There is a 4-frame dip to white before each cut, and a 28-frame fade to white at the end so the clip
  loops cleanly. The reference's closing Instagram watermark was not copied.

The illustrations are only scaled and placed. The three white-background pictures sit on a canvas
of their own white (254, 254, 254), so no edge shows. The sunset picture fills the frame, with the
lyrics in its open sky. The layout check keeps every lyric at least 32 px from any artwork.

## Scenes

| # | Time | Picture | Lyrics |
| --- | --- | --- | --- |
| 1 | 0.00–3.70 s | girl | She's a / She's a / Lady |
| 2 | 3.70–7.90 s | boy | And / I am / Just a / Boy |
| 3 | 7.90–11.33 s | girl | She's a / She's a / Lady |
| 4 | 11.33–15.43 s | boy | And I am / Just a Line / Without / hook |
| 5 | 15.43–20.77 s | hug | Oh baby / I am a wreck / When i am / Without / You |
| 6 | 20.77–28.93 s | sunset | I need you / Here to / Stay |

## Re-rendering

Needs Python 3 with Pillow and NumPy, and `ffmpeg` on the PATH.

```sh
python3 render.py video --audio path/to/reference.mp4   # with the song from the reference clip
python3 render.py video                                  # silent
python3 render.py stills                                 # 2160x2160 PNGs
python3 render.py preview                                # final frame of each scene + spacing check
```

Layout positions and the per-letter reveal frames are all in the `SCENES` table at the top of `render.py`.
