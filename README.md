# The Flush King

A vertical (1080×1920, 30 fps) animated short made entirely in code with **Remotion** + **React Three Fiber**.
Every character, building and prop is built from simple 3D shapes; faces are drawn on canvas textures.
The narration is `voiceover.mp3`; captions and scene timings come from Whisper word timestamps (`words.json`).
Sound effects were generated with ElevenLabs (see `public/sfx/`, takes in `out/sfx_elevenlabs/`).

## Output

- `out/final.mp4`: the finished video (H.264 + AAC)
- `out/preview/`: quick low-res previews
- `out/checkpoint1/`: character test images

## How it is built

| Step | Where |
| --- | --- |
| Word timings: Whisper (`faster-whisper`, medium.en) → fixed against the script | `scripts/transcribe.py`, `scripts/fix_words.py`, `words.json` |
| Scene timing (every scene starts on its first word) | `src/timing.ts` |
| Character builder (one builder, many people), canvas faces, poses | `src/characters/` |
| Places: town, bathroom, classroom, Grandpa's house, Stinky Hill, swamp, castle, basement, town square, toilet shop | `src/world/` |
| Props: bucket, Golden Throne, stink clouds, effects | `src/props/` |
| The 32 scenes (shots, cameras, animation; all driven by the frame number) | `src/scenes/` |
| One-word captions (Poppins ExtraBold, pop-in) | `src/Captions.tsx` |
| Sound-effect cue sheet | `src/SFX.tsx` |

## Render

```bash
npm install
# full video with audio (software WebGL; use --gl=angle on a machine with a GPU)
npx remotion render FlushKing out/final.mp4 --gl=swangle
# fast 144p preview
npx remotion render FlushKing out/preview.mp4 --gl=swangle --scale=0.13333333333333333 --props='{"previewScale":0.13333333333333333}'
```

In sandboxes where the internet is only reachable through `$HTTPS_PROXY`, set `RENDER_VIA_PROXY=1`
so the headless browser can load Google Fonts.

The final in this repo was rendered in two halves (`--frames=0-1715` and `--frames=1716-3720`, muted) and joined with
`scripts/assemble_final.sh`, which mixes the voice and sound effects with ffmpeg at the same cue times as `src/SFX.tsx`.
