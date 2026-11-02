# You can't wipe (birthday reel)

A 35-second 3D reel (1080x1920, 30 fps): you're 30, you can't wipe, Mom isn't at the party, and the 6-year-old
birthday boy teaches you - for five dollars. Same engine and style as the handkerchief reel (three.js in headless
Chromium, frame by frame), with the user's own voiceover.

## How it was made
- **Voice:** the user's recording (`audio/voiceover_src.mp3`, "mom_poop.mp3"), cut into the 22 script lines with
  speech-to-text + silence detection, pauses evened (`make_voiceover.py`). `make_voiceover_tts.py` is the earlier
  stand-in voice made with local Piper TTS.
- **Captions:** white Pixelify Sans, 2-4 words, timed to the measured word onsets (`make_captions.py`), labels
  AGE 30 / 10 MINUTES LATER (`add_labels.py`).
- **Shots:** 24 shots (`plan.py` -> `shots.json` -> `web/plan.js`), written in `web/shots_a.js` + `web/shots_b.js`.
- **Places:** the party living room + bathroom (`web/set_house.js`), the starry void (`web/set_rest_void.js`).
- **People:** YOU, Mom, Dad, Uncle, Grandma and the birthday boy (`web/cast.js`; party hats + crown are new).
  Bathroom shots only ever show YOU from the chest up (legs hidden), everything else stays behind the door.
- **Sound:** `make_sfx.py` (a toy-xylophone "Happy Birthday" (public domain) cut by a record scratch on "MOM!",
  crickets, knocks, snore, door rattle, applause, ka-ching, ...) + `mix.py` (voice on top, -14 LUFS).

## Build
    python3 make_voiceover.py          # once, from the user's recording
    JOBS=4 SCALE=0.75 ./make_reel.sh   # captions, plan, sound, frames, final.mp4
