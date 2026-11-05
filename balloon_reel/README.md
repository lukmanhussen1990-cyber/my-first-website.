# "You've been blowing it for ten minutes..." — semi genius balloon reel

Vertical funny reel, 1080x1920, 30 fps, 35.9 s (the user's start sound + voiceover), 20 shots (+9 cuts on words), made in
code in the SEMIGENIUS look: a clean beige room, plain low-poly people with simple faces, chunky uppercase captions that
turn yellow as the words are said, comic sound words, white timer boxes. The double meaning lives in the words only:
the action is just two guys blowing up a pink balloon. The opening is framed from behind (a misdirect) until "soft",
then the side view shows it's a balloon.
Final file: `balloon_reel/final.mp4` (+ a copy at the repo root: `balloon_genius_reel.mp4`), H.264 CRF 16, AAC 192k.

**Start sound:** the user's `he_1.mp3` (`audio/raw/intro.mp3`, 3.6 s, "Oh fuck. Oh fuck.") plays first, over the
wide view from behind (balloon hidden); its level is raised +8.1 dB to match the voice, nothing else changed. Its words get
captions too. The voiceover starts on the cut to the closer view.

**Voice:** the user's own recording (`audio/raw/my_voiceover.mp3`), unchanged. Word timing: faster-whisper (local,
free), matched to the script; whisper first heard "I'm a fucking genius" at the end, with more context both models
hear "Fucking genius." (= what is said; the captions show exactly that).

## Shots
1-3 from behind: the cowboy (hat, blue shirt, legs wide) and the kneeling guy (orange shirt, green pants, blue beanie)
blowing; the cowboy's bored face, 10:00; on "soft" the side view: a limp pink balloon · 4-5 he hands over a pink
hairdryer, VRRRR · 6 it gets hot (red) · 7 BOING! hard · 8 it melts a hole · 9 PFFFFFT! in his face, the beanie flies
off · 10-11 RIIIP tape, keep going, 3:47:00 · 12-13 pump pump pump, his arm is bigger than his leg (ARM / LEG) · 14 still
soft, SQUISH · 15 the leaf blower, VRRROOOM · 16 BOOM: rock hard in 0:01, the room is full · 17-19 the cat jumps on and
rides it around, then over the night city like Aladdin · 20 fucking genius.

## Files
`script.py`, `stt_parts.py`, `import_voiceover.py`, `plan.py` -> `shots.json`; `scene/room.js` (the room, the balloon
(soft / hot / hard / hole / tape), hairdryer, pump, leaf blower, the cat, air streaks), `scene/cast.js` (the cowboy with
a cowboy hat, the kneeling guy), `scene/shots.js`; `fx.py` + `render.py` + `overlays.py`; `make_captions.py`;
`make_sfx.py` (blowing, motor whines, sizzle, boing, the deflating raspberry, tape, pump, squish, leaf blower, boom,
meow, crash, a magic glissando, all made in code) + `mix.py`. Build: `./build_lo.sh` (quick) / `./build_full.sh`.
