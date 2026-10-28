# They Never Died: delivery

Episode 26 of Grace in Motion, a one-time GPT Image test.

## Files

| File | What it is |
|---|---|
| `out/reel_never-died.mp4` | The finished reel (sent in chat, and kept out of git: GitHub refuses files over 100 MB) |
| `out/animatic_never-died.mp4` | Half-size animatic with full audio and light effects (also outside git) |
| `out/cover_never-died.png` | Cover: Elijah rising in the whirlwind with "2 MEN NEVER DIED" |
| `out/caption_never-died.txt` | Instagram caption: hook line, short summary, comment question, hashtags |
| `out/stills/*.jpg` | The 10 check stills (hook, Enoch, the two walking, chariot, red X, whirlwind, cloak, mountain, promise card, end card) |
| `audio/final_mix.wav` | The final mix |
| `KJV_CHECK.md` | Every quote, card and label checked against the KJV |
| `../../ideas_used.md` | Episode list (this one is marked "GPT Image test") |

## Checks on the final reel

| Check | Result |
|---|---|
| Picture | 1080×1920, 30 fps, H.264 High, yuv420p, 2201 frames |
| Sound | AAC LC, 48 kHz, stereo |
| Length | 73.37 s (target 60–90 s) |
| Loudness | −14.0 LUFS integrated, loudness range 2.6 LU, true peak −1.3 dB |
| Captions | The 166 subtitle words match the approved script word for word |

## How to rebuild

```bash
npm run audio                 # music + effects + voice mix -> audio/final_mix.wav (deterministic)
./tools/render_final.sh       # full reel in resumable chunks -> out/reel_never-died.mp4
./tools/render_extras.sh      # cover, 10 stills, animatic
node tools/stills.mjs <dir> t=12.5,t=40   # quick look-dev stills
```

Rendering uses SwiftShader on the CPU (`--gl=swangle`). On this 4-core machine the full reel takes
about 45 minutes. A machine with a GPU can use `--gl=angle` and runs much faster.
