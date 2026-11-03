# "Genius content creator" reel

Instagram Reel, 1080x1920, 30 fps, 35.2 s, 26 shots (1.35 s average). Everything is made in code: the voice
(ElevenLabs), the 3D scenes and animation (three.js, rendered frame by frame in headless Chromium), the pixel-mosaic
censor, the captions, the pop-up sound words, the LIVE view counter and all the sounds.

Look and format copied from the "semi-genius" reference (the shower reel the user sent): a dumb problem, a "genius"
fix that keeps escalating (live → TV show → stadium big screen → helicopter poop drop → news anchor), fast cuts,
plain mannequin-style people, bright simple rooms, pixel-mosaic blur, a proud ending line.

- **Voice**: ElevenLabs, the same voice as the last reels (Nassim, `repzAAjoKlgcT2oOAIWt`, `eleven_v4`,
  `[calm] [deadpan] [fast-paced]`), take `audio/raw/narr_A.mp3` (flow `d5ZQUBWg0UI79JC9MVoB`). `import_voiceover.py`
  adds a short pause before "One billion views." and plays it 8 % faster (same pitch) to fit 25–35 s.
- **YOU** is a plain brown-skinned mannequin with no clothes and no body details (as the user asked); his private
  area is covered by the pixel mosaic in every shot he is in, front and back. The poop is a small brown blob, and
  every blob / splat is also covered by the mosaic. The mosaic spots are measured on every frame by the 3D renderer
  (`build/anchors/shot_XX_mosaic.json`) and pixelated in `render.py`.
- **Overlays** (`overlays.py`): red LIVE badge + view counter (1,000 → 1,000,000 → 50,000,000 → 1,000,000,000),
  comic pop-up words (PLOP, DING!, SQUISH, FWOOSH!, SPLAT!, THWAP!, THWAP!, SPLAT!, KA-CHING!), the notification flood.
  `events.py` holds the key moments shared by the sounds, the pop-ups and the camera.
- **Sound** (`make_sfx.py`, all code-made): tumbleweed wind, bulb flicker, go-live blip, plop, dings, squish, audience
  gasp, stadium crowd + "ooooh", helicopter blades, gulp, fwoosh, heroic music, umbrella pops, splats, wiper thwaps,
  whizz, newsroom music, blink, ka-ching, notification pings, trumpet fanfare. Every effect sits under the voice;
  final mix -13.8 LUFS.

Build: `python3 stt_words.py audio/raw/narr_A.mp3 && python3 import_voiceover.py && python3 plan.py`,
`npm install && NO_STILLS=1 node render_scene.mjs`, `./make_reel.sh` → `final.mp4`.
