# Roses at sunset: 30 s loop

`roses_sunset_loop_30s.mp4` animates `src/source.png` as a seamless 30-second loop with strong motion: H.264, 1312×1200 (the source's 1199 rows plus one repeated edge row, since H.264 needs an even height), 30 fps, 900 frames, no audio.

- **The man:** he sways and leans toward her every 7.5 s, tilting his head down to her. He breathes, his hair blows, the bouquet sways in his hands, the red ribbon flutters, and his jacket hem moves. His face is unchanged.
- **The girl:** her long hair streams in the wind, along with the backlit flyaway strands, and her dress ruffles flutter. Her head turns up to him and she breathes.
- **The meadow:** strong wind gusts, sway and rustle move the grass, and the flower heads (separate layers) nod and bend.
- **The sky and air:** the clouds billow with the sun held still, the sun glow breathes, the sun rays brighten and fade, the valley fog drifts and the trees sway. Rose and daisy petals blow across, and golden glints twinkle.

## Regenerate

Run these from this folder, with `models/` holding the two ONNX models listed in `../README.md`:

```sh
mkdir -p work out
python3 scripts/segment2.py models/isnet-anime.onnx src/source.png work 120 0 1180 1199
python3 scripts/rose_prep.py .
python3 scripts/rose_render.py . full out/master.mkv
python3 scripts/check_loop.py out/master.mkv 1312 1200
```

Encode `out/master.mkv` with the ffmpeg command in `../README.md`.
