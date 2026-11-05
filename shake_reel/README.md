# "Your bed shakes so fucking loud..." — semi genius reel

Vertical funny reel, 1080x1920, 30 fps, 36.7 s, 25 shots, everything made in code in the look of the user's reference
(the "semi genius" squeaky-bed video): a bright dollhouse cutaway apartment building (the bedroom upstairs, the old
neighbors downstairs, the basement), plain low-poly people, chunky uppercase captions that turn yellow as the words are
said, comic sound words (SHAKE, BANG!, CLANK, RUMBLE, SCREEECH!, DING!, BOOM), a white counter box, a news screen.
Final file: `shake_reel/final.mp4` (+ a copy at the repo root: `bed_shake_reel.mp4`), H.264 CRF 16, AAC 192k, -14 LUFS.

**Audio:** the user's "yeah" clip (`audio/raw/intro_yeah.mp3`, 3.0 s) first, as they asked (no captions for it), then
the user's own voiceover (`audio/raw/my_voiceover.mp3`, 33.7 s, unchanged). Word timing: faster-whisper (local, free),
matched to the script word by word; the user says "And they dance" (captions show exactly that). The opening copies
the reference's first shot (the couple in bed from the side, the window behind, his flushed face), as the user asked.

## Shots
1 the bedroom, the bed rocking (intro clip) -> the couple in bed, close (SHAKE) · 2 closer, his red sweaty face ·
3 the cutaway: the neighbors jump off the sofa and run · 4-5 outside at night in their pajamas, x 247 ·
6 semi genius with a hammer · 7 BANG BANG: nails into the floor · 8 the whole floor shakes · 9-10 the chandelier does
the macarena · 11-12 a giant wrench, giant bolts through the building · 13 the whole building shakes (CRACK) ·
14 the news: EARTHQUAKE, epicenter apartment 2B, a seismograph · 15-16 he carries the bed to the basement ·
17-18 the subway screeches to a stop, SERVICE SUSPENDED · 19 Wait: DING · 20-21 the bed is a drum, 120 BPM ·
22-24 the neighbors stay in and dance, every floor dances, x 248 · 25 fucking genius.

## Files
`script.py`, `stt_parts.py`, `import_voiceover.py` (+ the intro clip), `plan.py` -> `shots.json`; `scene/house.js`
(the cutaway building, the street, the subway, props), `scene/cast.js` (HIM, HER, the old neighbors in pajamas, the
news anchor), `scene/shots.js`; `fx.py` + `render.py` + `overlays.py` (sound words, counter, news, seismograph, notes);
`make_captions.py` (karaoke yellow); `make_sfx.py` (bed knocks + squeaks, bangs, rumbles, macarena, train, screech,
drum beat, dance music, all made in code) + `mix.py`. Build: `./build_lo.sh` (quick) / `./build_full.sh` (final).
