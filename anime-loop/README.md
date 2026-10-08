# Anime loop: meadow at sunset

`anime_loop_30s.mp4` is a 30-second seamless loop that animates the illustration in `src/source.png`.

- MP4, H.264 High, 1150×1380 (the source's 5:6 aspect ratio), 30 fps, exactly 900 frames, no audio
- Every motion repeats on a period that divides evenly into 30 s, so the last frame flows straight back into the first.

## How it's made

The original illustration is split into layers and animated directly; no frames are generated.

1. `segment.py` creates a character matte with the `isnet-anime` segmentation model.
2. `prep.py` builds the region weights: head, hair, dress, sky, meadow perspective and mist band.
3. `layers.py` cuts the man and the girl out as separate layers, completes his leg behind her hair, and
   inpaints a clean background with LaMa.
4. `flowers.py` detects about 1,470 individual white and orange flower heads.
5. `render.py` renders the loop. It includes:
   - **Man:** he leans toward her, tilts his head, sways and breathes. His head moves rigidly, so his face is unchanged.
   - **Girl:** a slow laughing bob, rocking, a head tilt, flowing hair and dress frills.
   - **Wind:** gusts travel left to right, with sway, rustle and a light sheen across the grass. Each flower nods and bends on its stem.
   - **Sky and background:** cloud drift (flow map), drifting mist, gently swaying trees, and a few drifting petals.
6. `check_loop.py` confirms the loop is seamless: the last→first frame step matches a normal frame step.

## Regenerate

Requires Python with `numpy opencv-python-headless scipy pillow onnxruntime`, plus `ffmpeg`.

```sh
cd anime-loop
mkdir -p models work out
curl -L -o models/isnet-anime.onnx https://github.com/danielgatis/rembg/releases/download/v0.0.0/isnet-anime.onnx
curl -L -o models/lama_fp32.onnx https://huggingface.co/Carve/LaMa-ONNX/resolve/main/lama_fp32.onnx

python3 scripts/segment.py models/isnet-anime.onnx src/source.png work
python3 scripts/prep.py .
python3 scripts/layers.py .
python3 scripts/flowers.py .
python3 scripts/render.py . test 0,3.75,7.5      # optional: still frames in test/
python3 scripts/render.py . full out/master.mkv  # lossless master (FFV1)
python3 scripts/check_loop.py out/master.mkv 1150 1380

ffmpeg -i out/master.mkv -an \
  -vf "scale=out_color_matrix=bt709:out_range=tv:flags=lanczos+accurate_rnd+full_chroma_int,format=yuv420p" \
  -c:v libx264 -preset veryslow -crf 14 -profile:v high -level:v 4.2 -tune film \
  -x264-params "aq-mode=3:aq-strength=0.9" -g 300 -keyint_min 30 \
  -color_primaries bt709 -color_trc bt709 -colorspace bt709 -color_range tv \
  -r 30 -frames:v 900 -movflags +faststart anime_loop_30s.mp4
```

You can tune the motion strength in `render.py`, in `man_map`, `girl_map` and `bg_maps` and the constants near them, for example `LEAN_PX` for wind gusts and the flower `amp`.
