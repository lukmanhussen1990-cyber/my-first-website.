# "You're a fucking genius" — salt reel

Vertical funny reel, 1080x1920, 30 fps, 28.3 s (exactly the length of the user's voiceover), 21 shots.
Final file: `salt_genius_reel.mp4` (repo root) = `salt_reel/final.mp4`. Quick checks: `preview_144p.mp4`, `preview_140p.mp4`.

- **Voice:** only the user's own recording (`audio/raw/my_voiceover.mp3`), not changed (no speed/pitch change, no cuts,
  no AI voice). **Word times:** faster-whisper (local, free; `stt_parts.py` transcribes each of the 16 speech parts
  on its own). Captions show every word as said, uncensored. Checked again with medium.en + small.en: "Fuck." (both
  hear it); the leaf-blower noise is spelled by whisper as a long vowel ("HAAAAA"), so it is shown with the user's own
  spelling: "VRRRRR!". "40" is shown as said: "FORTY MINUTES". All 30 captions start 10–40 ms before their word.
- **Look** (no ketchup reference was uploaded; the earlier mannequin reference was used): smooth low-poly mannequin,
  black rectangle eyes, bright pastel kitchen; bold uppercase captions in the lower middle, each word turning yellow
  as it is said; comic words (SHAKE SHAKE!, SLAP!, POP!, FWOOSH!, POKE!, TICK TOCK, VRRRRR!, BOOM!); white labels with
  arrows ("2 MIN", "HOLES", "40 MIN", "MAX"); a new shot every ~1.3 s.
- **Shot 1 (the user's request):** his strained face above the table and, under the table, only his hand furiously
  shaking the salt shaker; shot 2 shows it's just salt over his fries. He stays fully dressed, the shaker is always
  visible.
- `scene/kitchen.js` (kitchen, fries, salt shaker with the falling lid, needle, cat, wall clock, leaf blower with the
  MIN–MAX dial, `whiten()` = everything turns white after the BOOM), `scene/shots.js` (21 shots), `cast.js` (YOU in a
  blue t-shirt; `youSalt` = YOU all white). `render.py` effects: salt stream, BOOM burst + fog, salt snow, ice cube
  icon, sweat, speed lines, shakes, fade out. `make_words.py`: comic words + arrow labels. `make_sfx.py`: 40 quiet
  code-made sounds (salt rattle, slap, pop, salt pouring, needle tinks, spinning clock ticks, sad trombone, duct tape,
  dial clicks, leaf blower roar, BOOM, salt settling, blinks, the fry). `mix.py`: the voice stays the main sound, -14 LUFS.

Build: `python3 stt_parts.py audio/raw/my_voiceover.mp3 && python3 import_voiceover.py && python3 plan.py`,
`NO_STILLS=1 node render_scene.mjs`, `./make_reel.sh`.
