# You pooped on the college bus (bus crush reel)

A 32-second vertical 3D reel (1080x1920, 30 fps) -> `bus_crush_reel.mp4`. Low-poly blocky characters made with
three.js, rendered frame by frame in headless Chromium (Playwright), joined with ffmpeg.

## Voice + timing
- The user's own recording (`audio/voiceover_src.mp3`, college_bus.mp3) is used exactly as recorded: no cuts, no
  re-timing, no other voice. The video is as long as the recording.
- Word times: faster-whisper (local, free) -> `make_voiceover.py`; captions (`make_captions.py`) are snapped to the
  measured word onsets; every shot change starts 0.12 s before the word that opens it (`plan.py`).

## Pieces
- `web/set_bus.js`: the bus (blue seats, metal poles + straps, big sliding windows, doors, the driver's mirror as a
  real mirror), the crowd, and the sunny tree-lined street it drives along (`busZ(t)` in `web/layout.js`).
- `web/cast.js`: ME (COLLEGE shirt, backpack), CRUSH (bangs, pink clip, cream sweater, small backpack, big shiny
  eyes), the DRIVER (moustache, cap) and 9 passengers.
- `web/shots_a.js`, `web/shots_b.js`: the 21 shots. Effects: sweat drops, green stink lines, the growing green smell
  cloud, pink sparkles, bus shake.
- `make_sfx.py` + `mix.py`: small sounds made with code only (engine following the bus speed, door hiss, brake
  screech, window slide, wind, chimes, footsteps), kept 10-20 dB under the voice.

## Build
    python3 make_voiceover.py
    JOBS=4 SCALE=0.75 ./make_reel.sh && mv final.mp4 bus_crush_reel.mp4
