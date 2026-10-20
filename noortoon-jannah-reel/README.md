# How BIG is Jannah? — NoorToon Instagram Reel

A 45-second, 9:16 Islamic reel made **100% with code**. Every picture is painted on an HTML
`<canvas>` and every sound is synthesized with numpy. No AI image/video/voice tools, no stock
images, no downloaded sounds. All randomness is seeded, so every build is identical.

## Deliverables (`output/`)

| File | What it is |
| --- | --- |
| `NoorToon_How_BIG_is_Jannah.mp4` | The reel: 1080×1920, 30 fps, exactly 45 s, H.264 (CRF 18, yuv420p, BT.709) + AAC 192 kbps / 48 kHz stereo, `+faststart` |
| `cover.png` | Cover image from the title scene (1080×1920) |
| `caption.txt` | Instagram caption with 10 hashtags, ending with "Comment Ameen" |
| `check_stills.jpg` | The ten check frames at 1.5, 5, 10, 14, 19, 23, 28, 33, 37 and 43 s |
| `audio.mp3` | The sound track on its own (the browser preview plays it in sync) |

## Source

| File | Role |
| --- | --- |
| `index.html` | The whole film. `render(t)` draws the exact frame for time `t` (seconds). Also the browser preview (Play button + scrub bar) and the audio cue sheet. |
| `render_frames.mjs` | Headless Chromium (Playwright): waits for `document.fonts.ready`, then for frame *i* calls `render(i/30)` and saves a PNG. Also exports the cover, the check stills and `build/cues.json`. |
| `make_audio.py` | numpy synthesizer: drone bed, whooshes, typing ticks, count-up risers and one effect per scene, timed from `build/cues.json`; mastered to −14 LUFS with true peaks ≤ −1 dBTP. |
| `build.sh` | Runs everything and joins frames + audio with ffmpeg. |
| `fonts/` | Cormorant Garamond, Patrick Hand, Amiri — SIL Open Font License 1.1 (licenses included). |

## Watch it in the browser

Open `index.html` in Chrome, Edge or Firefox (or serve the folder: `npx serve .` /
`python3 -m http.server`). **Play** / **Space** plays, the scrub bar seeks, **←/→** steps one
frame. Sound comes from `output/audio.mp3`.

## Rebuild the video

Needs Node 18+, Python 3 with numpy, and ffmpeg.

```bash
npm install
npx playwright install chromium   # first time only
./build.sh                        # frames -> audio -> output/NoorToon_How_BIG_is_Jannah.mp4
```

Single steps: `node render_frames.mjs --stills` (check stills), `--cover`, `--cues`,
`--times 3.2,8.9` (any frames you like), `--frames --range 300,390` (part of the film).

## Timeline

| Time | Scene | Picture (one movement) | Sound |
| --- | --- | --- | --- |
| 0:00–0:03 | Title | Indigo night, golden arch and «الجنة»; a far golden light rises and brightens | Deep soft swell |
| 0:03–0:07.5 | A whip's space | Brass balance: the whole Earth vs a glowing whip-long strip of Jannah ground; it tips down on the Jannah side | Wooden creak, then a gentle thud |
| 0:07.5–0:12 | The pearl tent | A pearl glows, grows and settles into a pearl tent while a measuring line stretches; **60 MILES WIDE** | Shimmer + rising tone |
| 0:12–0:16.5 | The giant tree | Close on a tiny light under a branch; the camera pulls back to a tree whose shade covers the screen; **100 YEARS** | Wind through leaves + rising tone |
| 0:16.5–0:21 | One gate | Golden doors open on an old parchment map; a dotted line runs from Makkah (bottom) to Busra (top) | Heavy door rumble, then open air |
| 0:21–0:25.5 | 100 levels | Glowing terraces stack upward as the camera rises; **100 LEVELS** | Whooshes climbing in pitch + rising tone |
| 0:25.5–0:30 | As wide as the heavens | From the Earth, a fast zoom out to a sky of stars and galaxies | One long deep whoosh into space air |
| 0:30–0:35 | The last person | The Earth, then ten glowing worlds pop in one by one; **×10** pops in at 1.5 s | A soft pop per world, each higher |
| 0:35–0:39.5 | Beyond imagination | A closed door leaking light opens; white light floods the screen | Swell into bright airy shimmer |
| 0:39.5–0:45 | Ending | Night, faint stars, golden glow above; du'a and "Comment Ameen" | Soft air, fading out |

Every scene fades in from black (0.3 s) and out to black (0.3 s); the title is fully visible on
frame 0. Text stays inside x = 140–940 px and above y = 1540 px, clear of Instagram's buttons.

## Checks on the delivered MP4

| Check | Result |
| --- | --- |
| Length / frames | 45.000 s video and audio, 1350 frames, both streams start at 0 |
| Picture | 1080×1920, 30 fps, H.264 High, yuv420p, BT.709 tags, `moov` before `mdat` (faststart) |
| Sound | AAC-LC 48 kHz stereo, ~194 kbps |
| Loudness (ffmpeg `ebur128`) | −14.1 LUFS integrated, true peak −1.3 dBTP, loudness range 4.6 LU |
| Levels inside the mix | drone bed ≈ −27 dBFS RMS, letter ticks ≈ −35 dBFS peak |
| Sync | the AAC track lines up with the master WAV to the sample; every sound is placed from the same timeline that draws the frames |
| Clicks | every sound has a smooth attack and release; the largest sample jumps are the high shimmer grains, not discontinuities |
| Text | every line, number, label and source checked programmatically against the brief: exact match |
| Repeatability | re-rendered frames are pixel-identical to the frames in the video |

The ten check frames are in `output/check_stills.jpg`.
