# The Corners (Idea 73) — 100% code

Everything in this reel is made in code: characters (SVG rig), the wheat-field world (Three.js), music, sound effects and the mix. The only outside input is the creator's own voiceover (`audio/user_voice_god_rech_poor.mp3`).

## Rebuild
```bash
npm install
# 1) voice timeline (needs Python + sherpa-onnx; see audio/tools/build_timeline.py header)
python -I audio/tools/build_timeline.py "$PWD" <zipformer-model-dir>   # writes public/voice.wav + public/timeline.json
# 2) music + sound effects + final mix (-14 LUFS, -1 dBTP)
npm run audio                                                          # writes audio/final_mix.wav + public/final_mix.wav (or just copy audio/final_mix.wav into public/)
# 3) preview / render
npx remotion studio
npx remotion render TheCorners out/reel_the-corners.mp4 --codec=h264 --crf=18
npx remotion still Cover out/cover_the-corners.png
```

## Notes
- `src/cues.mjs` is the single cue sheet: the audio builder and every scene read the same story beats, so sound hits land on the same frame as the picture.
- No GPU here: `remotion.config.ts` uses software WebGL through `tools/chrome-swiftshader.sh` (Chromium needs `--enable-unsafe-swiftshader`). On a GPU machine use `--gl=angle` and set `REMOTION_BROWSER` to your Chrome.
- Post-processing (bloom, vignette, SMAA) lives in `src/three/PostFX.tsx`; it builds its composer up front so the first frame of every render tab is not black.
- Layout rule: captions y 240–600, tracker y≈650, scripture cards from y≈712, characters in the lower band; nothing important below y 1450 or right of x 960.
