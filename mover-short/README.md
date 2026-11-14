# Couch Crushers — vertical cartoon short (three.js, no Blender)

60 s, 1080×1920, 30 fps goofy 3D short: "you started a moving company".
Everything (characters, sets, camera, captions, comic SFX words, music, sound effects) is generated in code.

- `web/` – renderer: `main.js` (scene, lights, sky), `char.js` (blocky low-poly rig, faces, poses),
  `props.js`, `world.js` (street, room, stairwell, hill, gas station, studio), `story.js` (34 shots timed to the voice),
  `overlay.js` (word-by-word captions, comic words, flashes).
- `voice.mp3` + `work/words.json` – voiceover and its word timings.
- `render.mjs` – headless Chromium renderer (`stills` or `seg` mode); `render_all.sh` – parallel resumable segment render.
- `audio.py` – synthesized music bed + SFX, ducked under the voice → `mix_raw.wav`.
- `finish.sh` – concat, -14 LUFS loudness, H.264/AAC encode, QA (freeze/black detection, contact sheet).

Rebuild: `npm install && bash render_all.sh && python3 audio.py && bash finish.sh Couch-Crushers`
