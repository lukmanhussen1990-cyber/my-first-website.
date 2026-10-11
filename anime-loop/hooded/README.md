# Hooded character: 30 s loop

`hooded_loop_30s.mp4` animates `src/source.png` as a seamless 30-second loop: H.264, 1254×1254, 30 fps, 900 frames, no audio.

- **Character:** the head, face, mask, hand and forehead text move together as one rigid unit, so they look exactly as drawn. The head tilts and nods slowly, the body breathes and rocks gently, the spiky hair strands blow in wind gusts, the hood edge ripples, and the drawstring swings.
- **Background:** the night background (inpainted behind him with LaMa) drifts slowly for depth. A soft light passes across it every 15 s, dust motes rise and fade, and a few out-of-focus specks float at the bottom-left.

## Regenerate

Run these from this folder, with `models/` holding the two ONNX models listed in `../README.md`:

```sh
mkdir -p work out
python3 scripts/segment2.py models/isnet-anime.onnx src/source.png work 0 0 1254 1254
python3 scripts/hood_prep.py .
python3 scripts/hood_render.py . full out/master.mkv
python3 scripts/check_loop.py out/master.mkv 1254 1254
```

Encode `out/master.mkv` with the ffmpeg command in `../README.md`.
