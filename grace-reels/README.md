# grace-reels

GRACE IN MOTION reels as 100% code: Remotion + React + a WebGL shader + a Node synth.
There is no stock footage, no downloaded images or music, and no AI images.

## 1K thank-you (5 s)

| File | What it is |
| --- | --- |
| `out/thank-you-1k_vertical.mp4` | 1080×1920, for Reels and Stories |
| `out/thank-you-1k_square.mp4` | 1080×1080, for a feed post |
| `out/caption_thank-you-1k.txt` | Instagram caption |
| `reference/thanks_style_notes.md` | Motion-language notes from the style reference |

### Rebuild

```bash
npm install
npm run audio            # scripts/synth.mjs → public/audio/thank-you-1k.wav (−14 LUFS, ≤ −1 dBTP)
npm run stills           # 8 check stills → out/stills/
npm run render:vertical
npm run render:square
npm run studio           # live preview
```

On a machine with a GPU, swap `--gl=swangle` for `--gl=angle` (it is much faster).

### Where things live

- `src/brand/`: palette, fonts (from npm `@fontsource`), easing, `GraceLogo`, `EndCard`. These are reusable for every reel.
  The handle and verse text are in `src/brand/brand.ts`.
- `src/thankyou/`: the 1K scenes (`cloudShader.ts` is the fbm cloud sea, god rays and organic mask).
- `scripts/synth.mjs`: all sound, made in code and frame-synced to the picture.
