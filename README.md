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

---

# Birthday (second short)

A sweet, warm vertical short (1080×1920, 30 fps, 109.83 s = voiceover + 1 s) about a town where nobody
knows what a birthday is, and a kid who throws one for Grandpa's 90th. Everything is made in code:
no AI images, video, voices, stock images, downloaded models or downloaded sounds.

- **Voiceover**: `birthday/voiceover.mp3`, used exactly as recorded (gain 1.0, not cut, not sped up).
- **Timing**: Whisper word timestamps → `birthday/words.json` (also `src/birthday/words.json`); every scene,
  shot and caption is timed from it (`src/birthday/timing.ts`).
- **Characters**: the same builder as above, plus new faces (curious, confused, lonely, surprised,
  eyes-closed smile, puffed cheeks), poses (knock, stir, carry cake, cover eyes, blow, kneel) and props
  (apron, party hats). Cast in `src/birthday/cast.ts`.
- **Places**: plain town + old bakery (`src/birthday/world/Town.tsx`), porch, attic, kitchen, bakery inside
  (`Rooms.tsx`), night square (`Square.tsx`), and the old photo, a little 3D scene rendered to a texture
  with a sepia old-photo look (`Photo.tsx`).
- **Captions**: one word at a time, Poppins ExtraBold, pop 0.85 → 1.03 → 1 over 5 frames (`src/birthday/Captions.tsx`).
- **Sound**: music box lullaby (original melody), knock, oven ding, candle whoosh, cheer and clapping are all
  synthesised with numpy in `scripts/birthday_audio.py`; `scripts/birthday_mix.py` puts them far under the
  voice and ducks them further while the voice speaks.

```bash
./scripts/birthday_render.sh                 # renders, mixes and writes birthday/out/final.mp4
python3 scripts/birthday_qa.py birthday/out/final.mp4 birthday/out/qa 2   # contact sheets + voice checks
```
