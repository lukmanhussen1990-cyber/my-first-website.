# Friend: delivery

Episode 44 of Grace in Motion, made from GPT Image pictures.

## Files

| File | What it is |
|---|---|
| `out/reel_friend.mp4` | The finished reel (sent in chat, and kept out of git: GitHub refuses files over 100 MB) |
| `out/animatic_friend.mp4` | Half-size animatic with full audio and light effects (also outside git) |
| `out/cover_friend.png` | Cover: Jesus kneeling with the basin at Judas's feet, the pouch glinting, "HE KNEW… AND WASHED HIS FEET ANYWAY" |
| `out/caption_friend.txt` | Instagram caption: hook line, three short lines, Zechariah 11:12, the yes/no question, hashtags |
| `out/stills/*.jpg` | The 10 check stills (hook kiss, rewind, towel, 12 dots, Jesus at Judas's feet, coin counter, scale, spinning coin, FRIEND, feast) and a contact sheet |
| `audio/final_mix.wav` | The final mix (voice, music and effects) |
| `KJV_CHECK.md` | Every quote, card and label checked against the KJV |
| `../../ideas_used.md` | Episode list (this one is marked "GPT Image") |

## Checks on the final reel

| Check | Result |
|---|---|
| Picture | 1080×1920, 30 fps, H.264 High, yuv420p, 2156 frames (CRF 18) |
| Sound | AAC LC, 48 kHz, stereo |
| Length | 71.87 s (target 60–90 s) |
| Loudness | −13.9 LUFS integrated, loudness range 2.5 LU, true peak −1.6 dB |
| Safe zones | All text sits above y = 1450 and left of x = 960 |
| Captions | The subtitle words come straight from the voice's word timings |
| File size | About 486 MB: CRF 18 keeps the film grain, and Instagram re-encodes on upload |

## How it was made

- **Voice:** edge-tts "Andrew" (en-US-AndrewMultilingualNeural) at −5% speed, with the pauses from the
  script. The subtitles use the word timings that come with the voice.
- **Pictures:** the 28 GPT Image sheets were cut into 113 sprites (characters, poses, props) and 8 background
  layers. The two missing pictures were covered in code: Peter and John are two of the seated disciples,
  and the olive branches come from the other garden layers.
- **Animation:** rig method 2 for every character (a pose image per moment, mesh warps for breathing,
  leaning and head tilts, a 2-frame smear when the pose changes) and blinks painted in code over the eyes.
- **World:** 2.5D layers at real depths with a long-lens camera, so the camera moves give parallax. Water,
  flames, embers, dust, coins and the scale are animated in code.
- **Music and sound:** made in code (D minor, turning to D major at "That's who Jesus is"), mixed under the
  voice to −14 LUFS.

## How to rebuild

```bash
npm run audio                 # music + effects + voice mix -> audio/final_mix.wav (deterministic)
./tools/render_final.sh       # full reel in resumable chunks -> out/reel_friend.mp4
./tools/render_extras.sh      # cover and the 10 check stills
npm run animatic              # half-size animatic -> out/animatic_friend.mp4
node tools/stills.mjs <dir> t=12.5,t=40   # quick look-dev stills
```

Rendering uses SwiftShader on the CPU (`--gl=swangle`). On this 4-core machine the full reel takes about
80 minutes. A machine with a GPU can use `--gl=angle` and runs much faster.
