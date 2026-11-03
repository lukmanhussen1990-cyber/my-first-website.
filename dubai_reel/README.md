# Rich aunty from Dubai (dubai aunty reel)

A 57-second vertical 3D reel (1080x1920, 30 fps) -> `dubai_aunty_reel.mp4`. Same engine and look as the birthday reel
(low-poly blocky three.js people, pixel textures, warm indoor light), rendered with Playwright, joined with ffmpeg.

- **Voice:** the user's own recording (`audio/voiceover_src.mp3`, mom_yell.mp3). No ElevenLabs, no AI voice. The words
  are unchanged; only the pauses between the 32 lines were set so the video is 57.0 s (`make_voiceover.py`).
- **Captions:** faster-whisper word times + pocketsphinx alignment + energy snapping (`make_captions.py`), white pixel
  font, black outline, centred, 2-3 words; yells in BIG CAPS ("MOM!", "I'M DOOONE!"); labels 10 MINUTES / 1 HOUR /
  2 HOURS LATER (`add_labels.py`).
- **Shots:** 42 shots (`plan.py`, `web/shots_a.js`, `web/shots_b.js`): yells with motion arcs + screen shake, sweat
  drops, tears, stink lines, Zzz, gold sparkles, pins-and-needles stars.
- **Set:** `web/set_house.js` (American family house: blue-tile bathroom with a door that has no lock, living room
  with sofa, tea + cookies, front door + doorbell, kitchen with the pressure cooker, dining table).
- **People:** `web/cast.js` (YOU, MOM, the rich AUNTY from Dubai, GRANDPA). Props: `web/props_dubai.js`.
- **Sound:** `make_sfx.py` (all code-made: doorbell, mug drop splash, cooker whistle, clock ticks, door creaks, ...)
  + `mix.py` (voice on top).

Build:  `python3 make_voiceover.py && JOBS=4 SCALE=0.75 ./make_reel.sh && mv final.mp4 dubai_aunty_reel.mp4`
