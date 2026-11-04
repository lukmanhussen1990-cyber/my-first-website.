# "What if your balls doubled in size every minute?" — reel (work in progress)

Vertical funny reel, 1080x1920, 30 fps, ~45 s, 31 shots, everything made in code in the look of the user's reference
video (low-poly faceted people, bright daylight city with pale grey buildings and green grass, tan spheres, white
lowercase captions with a soft outline, small dark labels with gold pointer lines, a news screen with a red LIVE tag
and a yellow ticker, a new shot every ~1-1.5 s with the camera further back as things get bigger).

**Status:** the visuals are built and checked (`preview_140p.mp4` = silent, placeholder timing). Waiting for the
user's voiceover (`my_voiceover.mp3`): the video length will be exactly the recording, every caption and cut synced
to the voice (faster-whisper word times, local + free). The voice is used unchanged (no AI voice).
The reference video belongs to another creator: it is only kept locally for study (`ref/`, not committed).

**Cartoon rule (silly, non-sexual, like the reference):** first two round bulges inside his blue jeans, then two
smooth plain tan low-poly spheres with no details.

## Shots
1 HIM with his phone · 2 HIM + FRIEND, she looks down · 3-4 kitchen scale: 40 g · 5 FRIEND shocked · 6 walking funny:
MELON SIZE · 7-8 platform scale 41 kg next to a cement bag · 9-10 he can't stand up, falls, the floor cracks ·
11-12 sitting on two giant spheres next to a small car: 1.3 TONS · 13-15 tanks + soldiers, chains, nothing moves ·
16 DAMAGE: 0% · 17-18 taller than an 11-story building, HIM a tiny dot on top · 19 news: BALL-POCALYPSE, LIVE,
EVACUATE NOW · 20-21 the traffic jam, MOM · 22-23 crushed mountains · 24-25 8 BILLION PEOPLE vs the spheres ·
26 the Earth orbits HIM (SOMEWHERE) · 27 gravity wins · 28 white flash · 29 black hole · 30 empty street ·
31 HIM back to normal, staring at us.

## Files
`script.py` (the lines), `stt_parts.py` + `import_voiceover.py` (word times of the user's recording), `plan.py`
(31 shots, 2-4 word captions) -> `shots.json`; `scene/world.js` (city, scales, cement bag, cars, tanks, chains, far
city, highway, mountains, balance scale, space, Earth, black hole), `scene/cast.js` (HIM with the bulges, FRIEND,
NEWS ANCHOR, SOLDIERS), `scene/shots.js` (31 shots); `overlays.py` (labels, news header + ticker, white flash),
`fx.py` + `render.py` (camera moves, hits); `make_captions.py` (Nunito Black); `make_sfx.py` (code-made sounds:
scale beeps, floor crack, tank engines, chains, news alarm, car horns, rumbles, the black-hole whoosh) + `mix.py`.
Fonts: Nunito + Lilita One (SIL Open Font License, via fontsource). `fake_vo.py` = dev-only placeholder timing.
