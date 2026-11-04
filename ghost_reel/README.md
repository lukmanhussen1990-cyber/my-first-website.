# "My ghost girlfriend" reel (2 AM, the car dies, there's a ghost...)

Vertical funny reel, 1080x1920, 30 fps, 57.4 s (exactly the user's voiceover), 43 shots, everything made in code
(Three.js low-poly characters + sets rendered in headless Chromium, effects in Python, joined with ffmpeg).
Final file: `ghost_reel/final.mp4` (+ a copy at the repo root: `ghost_girlfriend_reel.mp4`), H.264 CRF 16, AAC 192k,
-14 LUFS. Quick check: `preview_140p.mp4`.

**Voice:** the user's own recording (`audio/raw/my_voiceover.mp3`), unchanged: no AI voice, nothing cut or sped up.
**Word timing:** faster-whisper (local, free) per speech part (`stt_parts.py`), matched to the script word by word
(`import_voiceover.py`). Whisper first invented "and the lights turn off" at 7.6 s; with more context both models
hear "The headlights flicker, and there's a ghost" = the script, so that part was corrected. Captions show every word
exactly as said, nothing censored, 2-4 words at a time (white Nunito Black, `make_captions.py`).

## Shots
1-4 2 AM: the convertible on the dark road, music loud (notes), everyone singing · 5-6 the engine coughs, the car
dies · 7 the headlights flicker · 8-9 a ghost in the beams, right in front of the car (hair over her face) ·
10 the friends scream · 11 everyone jumps out · 12-14 the tire iron, he walks at her and swings · 15 her hair parts:
a pretty glowing face · 16 "Oh fuck", the iron drops · 17-18 heart eyes, BA-DUM (a big beating heart) · 19 the
friends just stare · 20-23 WEEK 1: first date in a graveyard, she floats, he doesn't care · 24-27 MONTH 1:
candlelight dinner, the spaghetti falls through her, he eats for both · 28 the friends, still staring ·
29-31 MONTH 6: the bench, his hand goes right through hers · 32-36 1 YEAR: she proposes, the ring keeps falling
through his finger, yes anyway · 37-38 WEDDING DAY: the haunted castle, the clock at 3 AM (three bell dongs) ·
39-40 inside: candles, cobwebs, the priest faints · 41 three empty chairs · 42-43 the friends still on the same
road: cobwebs, grass, a rusty car, a bird nest, staring.

## Files
`script.py`, `stt_parts.py`, `import_voiceover.py`, `plan.py` (43 shots, cuts on words) -> `shots.json`;
`scene/ghostworld.js` (moonlit night, the road, the convertible, the ghost (translucent glow, hair curtain), the
graveyard, the dinner, the park, the proposal hill, the castle + clock, the hall, cobwebs), `scene/cast.js` (YOU,
the 3 friends, the ghost, the priest, YOU in a tux), `scene/shots.js`; `fx.py` + `render.py` + `overlays.py`
(music notes, hearts, the BA-DUM heart, sparkles, time cards, shakes, fade); `make_sfx.py` (code-made party music,
engine, sputter, flicker buzz, ghost sting, screams, doors, swing, heartbeat, crickets, owl, romantic piano, ring
clinks, bats, bell dongs, organ, thud) + `mix.py`. Build: `./build_lo.sh` (quick) / `./build_full.sh` (final).
