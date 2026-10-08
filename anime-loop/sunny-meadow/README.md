# Sunny meadow: 30 s loop

`sunny_meadow_loop_30s.mp4` animates `src/source.png` as a seamless 30-second loop: H.264, 1150×1380, 30 fps, 900 frames, no audio.

It uses the same layered approach as the sunset loop one folder up:

- **The man:** clearly sways on his feet and takes deep breaths, leaning back and tilting his head up with each one. His hair, jacket and trousers blow in the wind, and his face is unchanged.
- **The meadow:** strong, frequent wind gusts and rustle move the grass. About 630 flower heads are separate layers over a flower-free background, so they nod with the wind and never smear.
- **Sky and background:** sun rays pulse (brighten-only, no dark bands), clouds billow smoothly with the sun held still, mist drifts through the valley behind the trees, trees sway, and petals drift past.

## Regenerate

Run these from this folder, with `models/` holding the same two ONNX models listed in `../README.md`:

```sh
mkdir -p work out
python3 scripts/segment2.py models/isnet-anime.onnx src/source.png work 230 225 1030 1235
python3 scripts/m2_prep.py .
python3 scripts/m2_flowers.py .
python3 scripts/m2_flowers_v3.py .      # stricter flower heads used by the renderer
python3 scripts/m2_render.py . full out/master.mkv
python3 scripts/check_loop.py out/master.mkv 1150 1380
```

Encode `out/master.mkv` with the same ffmpeg command as in `../README.md`.
