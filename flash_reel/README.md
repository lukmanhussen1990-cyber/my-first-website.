# "POV: your girlfriend texts she's home alone" — rainy-night speedster reel

Vertical funny reel, 1080x1920, 30 fps, 16.93 s, 16 shots, everything made in code (Three.js low-poly characters
rendered with Playwright, effects in Python, joined with ffmpeg). No voiceover: only the user's song, the sound
effects, the POV text and the phone message.
Final file: `flash_reel/final.mp4` (+ a copy at the repo root: `flash_pov_reel.mp4`), H.264 CRF 16, AAC 192k.
Quick check: `preview_140p.mp4`.

**Song:** the user's `my_song.mp3` (not committed; the video only uses a short clip of it). Speed and pitch are not
changed. `find_drop.py` runs faster-whisper (local, free) on the whole song: "drink for me" starts at about 78.7 s.
`analyze_song.py` uses librosa (89.1 BPM, a beat every 0.673 s) and puts the drop on the beat at **78.963 s**, where
the vocal starts (whisper word starts come a little early). The clip starts 7 beats before it (74.273 s), so
**the transformation hits at 4.690 s** in the video. The song fades in (0.35 s) and stops when her dad opens the door
(14.675 s): from there only the rain is heard, with a short fade at the end.

**Beats:** every cut, lightning flash, wet footstep, zoom and knock sits on a beat (`audio/beats.json`, `plan.py`,
`events.py`).

**The look:** the reference video was not in the upload, so the low-poly blocky style of the earlier reels is used
(faceted heads, pixel eyes, blocky hands), a dark rainy night with a thunderstorm: heavy rain, lightning in the sky
on the beats, wet shiny streets with reflections. White pixel font (Pixelify Sans) with a black outline.

**The hero costume is original:** a red suit with a simple yellow zigzag bolt (no circle, no emblem), a gold belt, a
long dark cape and glowing eyes. No mask, helmet or logo of any real comic hero.

## Shots

1 couch, bored, scrolling · 2 phone buzz: "Babe ❤" — "I'm home alone 🙂" · 3 slow zoom on his face, eyes go wide, he
looks at the camera · 4 on "drink for me": BOOM, red lightning strikes him from the sky, he stands up slowly, rain swirls
round him, the hoodie drops on the couch, the cape appears · 5 glowing eyes · 6 cape in the wind · 7–8 slow-motion walk
toward the camera through the rain, chin up, calm evil smile, one step per beat · 9–13 city zoom with a lightning trail,
one shot per beat: past cars, up a building, over the bridge, leaves fly and a man's hat blows off, round the corner ·
14 screech stop at her door, smoke, fixes his hair, big smile, knocks · 15 her dad opens the door, arms crossed,
staring (his view of you: the music and the thunder stop, only rain) · 16 freeze on his face: the smile drops, a
sweat drop slides down, the lightning fizzles out with a small spark.

## Files

`find_drop.py` + `analyze_song.py` (drop + beats) → `audio/beats.json`; `plan.py` → `shots.json`; `events.py` (key
moments); `make_text.py` (POV text) → `audio/captions.ass`; `make_sfx.py` (rain, thunder, phone buzz, god rise,
crackle, wind, wet steps, whooshes, zaps, screech, knocks, door creak, fizzle, all made in code) + `mix_reel.py` (song
clip + sfx, -14 LUFS) → `audio/mix_final.wav`; `scene/storm.js` (storm sky, lightning bolts, living room, wet streets,
cars, lamps, the tall building, the bridge, her house with the porch light), `scene/cast.js` (YOU in a hoodie, the
hero, HER DAD), `scene/shots.js` (16 shots); `fx.py` + `render.py` (camera moves, rain, bolts, swirl, sparks, sweat,
flashes, fade).

Build: `python3 find_drop.py && python3 analyze_song.py && python3 plan.py`, then `./build_full.sh`
(3D clips in 4 groups → 2D effects → `make_reel.sh` → `final.mp4`).
