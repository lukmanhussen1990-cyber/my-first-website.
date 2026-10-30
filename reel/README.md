# Waiting for October — Instagram reel

12 s vertical reel (1080x1920, 30 fps, H.264 + AAC). Only the painted background
(`assets/background.png`) is an image; the skeleton, suitcase, ticket, train,
steam, leaves, lights, grain, text and the whole soundtrack are generated in code.

Final video: `output/waiting_for_october.mp4`

## Rebuild

```sh
python3 prepare_assets.py   # upscale background + foreground mask (train passes behind it)
python3 audio.py            # synthesize build/audio.wav
node render.js video        # render frames in headless Chromium -> build/video_noaudio.mp4
ffmpeg -y -i build/video_noaudio.mp4 -i build/audio.wav -map 0:v -map 1:a -c:v copy \
  -c:a aac -b:a 192k -shortest -movflags +faststart output/waiting_for_october.mp4
```

`node render.js preview 3.9 7.2` writes single frames to `build/preview/` for checking.

## Files

- `scene.js` – the animation: camera, jointed skeleton rig (IK walk, keyed acting), props,
  train with perspective + motion blur, leaves, glows, grading, text, watermark
- `audio.py` – wind, leaf rustle, birds, foley, train clack/rumble and soft whistle
- `prepare_assets.py` – background upscale and the occlusion mask polygons
- Font: Gloria Hallelujah (SIL Open Font License, Google Fonts)
