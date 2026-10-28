# The Face of God: delivery

Episode 60 of Grace in Motion (idea 60), made from GPT Image character pictures.

## Files

| File | What it is |
|---|---|
| `out/reel_face-of-god.mp4` | The finished reel, the CRF 18 master (kept out of git: GitHub refuses files over 100 MB) |
| `out/reel_face-of-god_20mb.mp4` | A copy under 20 MB (1080×1920, 30 fps, 2-pass video, AAC 128 kbps) for chat and apps with a 20 MB limit |
| `out/preview_face-of-god.mp4` | The quick preview: half size, 15 fps, light effects, full sound |
| `out/cover_face-of-god.png` | Cover: Moses on the stormy ledge, his hand raised into the light breaking through, "HE ASKED TO SEE / GOD'S FACE", "EXODUS 33:20" |
| `out/caption_face-of-god.txt` | Instagram caption: hook line, three short lines, 2 Corinthians 4:6, the question, hashtags |
| `out/stills/*.jpg` | The 10 check stills: storm opening, the sea split, the kneel, the river of light at the cleft, the trails of light, the shining face walking down, the camp stepping back, Jesus with Philip, the split screen, the call to action. `contact_sheet.jpg` shows all 10; `tools/render_extras.sh` makes full-size PNGs |
| `audio/final_mix.wav` | The final mix (your voice, music and effects) |
| `KJV_CHECK.md` | Every quote, card and label checked against the KJV |
| `../../ideas_used.md` | Episode list (this one is marked "GPT Image") |

## Checks on the final reel

| Check | Result |
|---|---|
| Picture | 1080×1920, 30 fps, H.264 High, yuv420p, 1952 frames (CRF 18) |
| Sound | AAC LC, 48 kHz, stereo |
| Length | 65.07 s (target 60–90 s) |
| Loudness | −13.9 LUFS integrated, loudness range 2.9 LU, true peak −1.2 dB |
| Opening | The voice starts on frame 1: no logo, no intro, no fade from black |
| Loop | The last frames flow back into the storm of the first shot |
| Safe zones | All text sits above y = 1450 and left of x = 960 (the cover's text sits inside y 240–1680) |
| Captions | The subtitle words come straight from the word timings of your recording |
| File size | Master 312 MB (CRF 18 keeps the grain; Instagram re-encodes on upload); the 20 MB copy is 18.8 MB |

## How it was made

- **Voice:** your recording `moses.mp3`, cut at its own pauses and put back together with the pauses from
  the brief (0.3 s between sentences, 0.7 s after "you will die", 0.8 s before "But notice", 0.6 s after
  "That was just from being near God", 0.6 s before the last line). The subtitles use the word timings of
  your recording.
- **Pictures:** the 6 GPT Image sheets you sent (Moses poses A and B, the parts sheet, the glowing Moses,
  Aaron, the Israelites) were cut into sprites. Reused from "Friend": Jesus (seated and the close-up), the
  nine disciples (Philip is d4), the six hillside guests, the upper room painting and its props. Every
  background and prop is built in code: the storm on Sinai, the burning bush, the frogs and hail, the
  parting sea, the cleft in the rock, the morning ridge path, the camp tents, the Galilee hillside and lake.
- **God's glory:** only light, made in code: the opening in the storm clouds, god rays, bloom and shimmer,
  the river of light past the cleft, the trails of light fading away. The covering in the cleft is a soft
  shade with no shape. God is never drawn as a person, a face or a hand.
- **Animation:** rig method 2 for every character (a pose image per moment, mesh warps for breathing,
  leaning, the robe and hair in the wind, a 2-frame smear when the pose changes) and blinks painted in code
  over the eyes. Everything is a pure function of the frame number (seeded random, no timers).
- **Camera and effects:** Remotion with @remotion/three; HDR render targets per shot, bloom, god rays from
  a bright point, grade, grain, motion transitions (whip, light, streak, split screen).
- **Music and sound:** made in code (tense storm, tender, a D major lift at "Now here's the best part",
  warmest at the face of Jesus), voice-led mix, two-pass loudness to −14 LUFS, true peak −1 dB.

## How to rebuild

```bash
npm run audio                 # music + effects + voice mix -> audio/final_mix.wav (deterministic)
./tools/render_final.sh       # full reel in resumable chunks -> out/reel_face-of-god.mp4
./tools/render_extras.sh      # cover and the 10 check stills
npx remotion render Draft out/preview_face-of-god.mp4 --gl=swangle   # quick preview
node tools/stills.mjs <dir> t=12.5,t=40                              # quick look-dev stills
```

Rendering uses SwiftShader on the CPU (`--gl=swangle`). A machine with a GPU can use `--gl=angle` and runs
much faster.
