# grace-reels

Code-built Instagram Reels for **Grace in Motion** (@GraceINMotion616): a low-poly 3D Bible world
seen like a miniature diorama, paper-cut people, word-by-word subtitles, KJV scripture cards,
narration, music and sound effects, all made in code. No stock footage, images or music.

## Make a reel (what was done for Q.01 THE MOUNTAIN)

| Step | Command | Output |
|---|---|---|
| 1. Script | write `episodes/<slug>/script.json` (beats with `*keywords*`, scene, camera, labels, card, sfx, mood) | script.json |
| 2. Voice | `/root/venvs/kokoro/bin/python tools/voice/tts_kokoro.py --script episodes/<slug>/script.json --out episodes/<slug>/audio/takes/kokoro --voice am_michael` | one clip per beat |
| | `python3 tools/voice/assemble.py --script episodes/<slug>/script.json --takes episodes/<slug>/audio/takes/kokoro --out episodes/<slug>` | `audio/voice.wav`, `timeline.json` (every word timed) |
| 3. Cues | `src/episodes/<slug>/cues.js` derives scenes, labels, cards and every sound cue from the words | one timing source for picture and sound |
| 4. Audio | `npm run audio` | `audio/final_mix.wav` (-14 LUFS, -1 dBTP), speech-to-text check |
| 5. Check quotes | `python3 tools/check_kjv.py episodes/<slug>` | every quote checked word for word |
| 6. Review | `npx remotion render src/index.ts KeyFrames out/stills/keys --sequence --gl=swangle` (other moments: `--props='{"times":[25.9,43.2]}'`) | review stills |
| 7. Render | `cp episodes/<slug>/audio/final_mix.wav public/audio/<slug>/` then `tools/render_parallel.sh TheMountain out/reel_<slug>.mp4 episodes/<slug>/audio/final_mix.wav 2` | the MP4 |
| 8. Cover | `npx remotion still src/index.ts CoverTheMountain out/cover_<slug>.png --gl=swangle` | grid cover |

Other voice engines: `tools/voice/tts_chatterbox.py` (local, MIT; several takes per line, the assembler picks the best),
`tools/voice/tts_edge.py` (free, online). Your own recording: `assemble.py --external input/voice.mp3`.

## Reusable parts

- `src/lib/`: seeded random and noise, easing, the pure `cameraAt` tools (`camera.ts`, shared by 3D and labels), moods.
- `src/world/`: low-poly terrain builder with exact ground height, model kit (rocks, trees, palms, bushes,
  thickets, clouds), props (donkey, ram, fire pot, altar, wood, tent, cross, light beam, gold dust, gold ring,
  sun, moon, stars), instanced `Scatter`, sky/sun/fog, and `Stage` (renders any `SceneDef`).
- `src/people/`: paper-cut figures drawn from flat parts (head with blink frame, robe, arms, legs, props),
  billboarding, walk cycle, breathing, blinking, head turns, cloth sway, sitting, and silhouette shadows.
  `cast.ts` holds the series cast (Abraham, Isaac, servants, Jesus, crowd generator).
- `src/graphics/`: brand (colours, fonts), logo, header, subtitles, hook title, labels, scripture cards,
  search bar, detail counter, DAY tag, title moment, two-choice CTA with comment box and hearts, end card,
  grain, vignette, grade, transitions.
- `src/post/`: render chain (MSAA, bloom, tilt-shift, ACES).
- `tools/audio/`: synth, sound-effect kit, mixer and checks (pure Node, seeded).

Everything is a pure function of the frame number: no timers, no `Math.random()`.
On a machine with a GPU, render with `GL=angle tools/render_parallel.sh ...` (much faster).
