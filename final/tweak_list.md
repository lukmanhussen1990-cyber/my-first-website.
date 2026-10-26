# Man in the Ice: tweak list

Tell me which line you want changed. Changes to text or sound are quick because the 3D doesn't need re-rendering. Changes to the picture mean re-rendering the 3D.

## Quick (a few minutes, no 3D re-render)

| What | Now | Where it lives |
|---|---|---|
| Caption size | 60 px (shrinks to 52 px before wrapping to 2 lines) | `src/overlay.js:122` |
| Caption position | centre x 490, y 1300 | `src/overlay.js:124` |
| Red words | listed per line | `"red": [...]` in `tools/script.json` |
| Watermark | `@garden_reels`, bottom left, 62% opacity | `src/overlay.js:8`, `watermark()` |
| Music volume | bed at -27 LUFS, faded to silence 1 s before the final crack | `tools/build_audio.py:88` (try -24 for louder) |
| Music ducking under the voice | threshold 0.035, ratio 6 | `tools/build_audio.py:143` |
| Scare hit strength | scene 1 "moved", scene 6 "open", scene 9, final crack | `bass_hit` calls in `tools/sfx.py` (:417, :494, :527, :543) |
| No music at all | `final/man_in_the_ice_nomusic.mp4` is already made | |

Text changes: `node tools/render.js --overlay`, then `python3 tools/finalize.py final 0.75`.
Sound changes: `python3 tools/sfx.py && python3 tools/build_audio.py && python3 tools/finalize.py audio` (the video stream is copied, so this takes about a minute).

## Re-render needed (about 1 hour for everything, 10–20 min for one scene)

| What | Now | Where it lives |
|---|---|---|
| Sharper picture | 3D rendered at 810x1440 and upscaled to 1080x1920 | `SCALE=1 WORKERS=3 tools/render_all.sh` (about 2x the time) |
| Scene 10 "No. 32" shot | a better three-quarter back framing is in the code, but it isn't in this render | `node tools/render.js --scenes 10 --scale 0.75`, then finalize |
| Brightness per shot | `P.exposure` in each scene function | `src/shots.js` |
| Grain, vignette, bloom | 0.03 / 0.55 / 0.5 | `src/shots.js:63` |
| Ice colour | blue-green tint by depth | `iceTint()` in `src/world/glacier.js:79` |

## Voice and timing (re-renders everything, because every scene moves)

- **Redo a voice part:** generate it in ElevenLabs, keep the same file name (`part01.mp3` … `part10.mp3`, `part07b_rescuer.mp3`) and send it to me. I run `tools/ingest_voice.py` and `tools/build_timeline.py`, then the full pipeline.
- **Pause between lines:** `lineGap` 0.28 s in `tools/script.json`.
- **Hold at the end of each scene:** `sceneTail` 0.4 s in `tools/script.json`.

## Music rights

The background track is the HBO "IT: Welcome to Derry" opening theme, which is copyrighted. Instagram may mute the audio, block the reel in some countries, or limit its reach. If that happens, post `man_in_the_ice_nomusic.mp4` and add a track from Instagram's own music library in the app.
