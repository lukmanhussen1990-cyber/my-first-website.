# Angry Bird — music into the ear

Animated version of the "bird cupping its ear" artwork: the painted music notes were
removed from the still image and replaced with animated ones that stream **into** the
ear, while a few drift back **out** of it. The provided track is muxed in as audio.

Final render: [`angry_bird_music_ear.mp4`](angry_bird_music_ear.mp4) — 1156×778, 25 fps,
3:31 (full length of the audio), H.264 + AAC.

## How it was built

| Step | Script | Output |
| --- | --- | --- |
| 1. Strip the painted notes/staff lines off the background | `clean.py` | `assets/plate_notes_removed.png` |
| 2. Render a 6 s seamless animation loop | `render.py` | `loop.mp4` |
| 3. Loop the video for the length of the track and mux the audio | `ffmpeg` (below) | `angry_bird_music_ear.mp4` |

### 1. Clean plate

`clean.py` masks the bright cream strokes (notes + staff) in the background region left of
the ear and fills them with a normalized-convolution pyramid inpaint plus a little grain so
the patch matches the painterly texture. The streaks inside the ear cup are left alone —
they read as part of the ear.

### 2. Animation

`render.py` composites, per frame:

- **Notes flying in** — 8 emitters off the left edge follow quadratic Bézier paths to the
  ear opening at `(392, 272)`, shrinking to ~28 % and fading as they enter the canal.
- **Notes flying out** — 5 emitters start small at the ear and grow as they drift away.
- **Glow** — a blurred warm copy of the note layer screened over the plate, plus a pulsing
  halo at the ear.
- **Sparkles** — twinkles placed on the artwork's existing sparkles.
- **Ken Burns** — a 1.2 % breathing zoom with a slow drift.

Everything is periodic over `T = 6 s`, so the clip loops without a visible seam.

```bash
python3 clean.py              # writes clean.png (the plate)
python3 render.py test        # 5 preview stills
python3 render.py             # writes loop.mp4 (6 s, no audio)
```

### 3. Mux

```bash
ffmpeg -stream_loop -1 -t 211.21 -i loop.mp4 -i src.mp4 \
       -map 0:v:0 -map 1:a:0 -c:v copy -c:a aac -b:a 128k -t 211.21 \
       -movflags +faststart angry_bird_music_ear.mp4
```

`-t` is set explicitly on both input and output: with `-c:v copy`, `-shortest` does not stop
an infinitely looped video stream.

## Requirements

`python3` with `pillow` and `numpy`, and `ffmpeg` with `libx264`.
