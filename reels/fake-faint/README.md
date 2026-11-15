# Fake Faint reel

Low-poly 3D animated reel (1080x1920, 30 fps, ~25 s) built with three.js, rendered frame-by-frame in headless Chromium.

- `fake-faint-reel.mp4`: final video (voiceover sped up 1.3x, synthesized SFX + music bed)
- `src/scene.js`: the scene, characters, shots, captions and 2D effects
- `src/render.js`: Playwright frame renderer
- `src/sfx.py`: sound effects and music synthesis (numpy)
- `src/words.json`: word timings of the original voiceover (for captions)

Re-render:

```bash
cd src && npm install
python3 -m http.server 8765 --bind 127.0.0.1 &
node render.js all frames 3
ffmpeg -framerate 30 -i frames/f_%05d.jpg -i mix.wav -c:v libx264 -crf 18 -pix_fmt yuv420p -c:a aac -b:a 192k -shortest out.mp4
```
