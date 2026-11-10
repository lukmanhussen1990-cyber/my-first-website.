# Family group chat reel

3D animated Instagram reel (1080×1920, 60 fps) built entirely in code.

- `grace_family_groupchat_1080p.mp4` — final video (H.264 High + AAC)
- `src/` — Three.js scene: low-poly character rig, bedroom, phone chat UI, props, shot timeline, captions, post pipeline
- `render.mjs` — headless Chromium (Playwright) frame-by-frame renderer piping raw frames to ffmpeg
- `render_all.sh` — resumable chunked render of all 2,152 frames
- `audio/make_audio.py` — procedural sound effects, ducked under the voiceover
- `assets/` — voiceover, whisper word timestamps (`words.json`), loudness envelope (`env.json`)

Rebuild:

```bash
npm install
./render_all.sh 1 60            # -> out/video_lossless.mp4 (software GL, ~2.5 h on 4 cores)
python3 audio/make_audio.py     # -> out/mix.wav
ffmpeg -i out/video_lossless.mp4 -i out/mix.wav -vf format=yuv420p -c:v libx264 -crf 16 -maxrate 13M -bufsize 26M -c:a aac -b:a 256k grace_family_groupchat_1080p.mp4
```

Quick stills: `node render.mjs --stills 0.5,12.0,27.6 --ss 1 --msaa 4 --scale 0.5`
