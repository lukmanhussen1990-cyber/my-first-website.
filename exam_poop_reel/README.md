# "She never checks pencil boxes again" — exam reel

Vertical funny reel, 1080x1920, 30 fps, 56.0 s, 43 shots, everything made in code (no images, no AI images).
Final file: `exam_poop_reel/final.mp4` (+ a copy at the repo root: `exam_pencil_box_reel.mp4`). Quick check: `preview_140p.mp4`.

**Voice:** the user's own recording (`audio/raw/my_voiceover.mp3`, 51.3 s), as they asked ("use my voiceover") —
no ElevenLabs, no AI voice, the voice itself is not changed. As the brief asks, `import_voiceover.py` only adds pure
silence inside existing pauses: +0.6 s before "What you don't know", +0.35 s before each of the last five lines, and a
2.6 s tail for the ending shot. **Word timing:** faster-whisper (local, free), each of the 29 speech parts transcribed
on its own (`stt_parts.py`); the recording matches the script word for word.

**Characters:** YOU and the classmates are grown-up college students (a college final exam): since he is naked +
blurred in the poop moment, nobody in this video is a child. The story is unchanged.

**The poop moment (non-sexual, silly):** shots 6–9 only from behind / the side: he half-stands over his chair with his
trousers down round his ankles (plain blocky mannequin legs, no body detail) and a BIG pixel mosaic over his hips,
like the semi-genius shower reference (`render.py` `apply_mosaic`, the regions come from the 3D scene every frame:
`S.mosaic` → `build/anchors/shot_XX_mosaic.json`). The little brown blob has its own small mosaic, PLOP. From shot 10
he is fully dressed. The bundle is a white wrapped package with a bow; when the teacher opens the box there is a
mosaic over the inside, green glow and stink lines.

## Shots

1 the quiet exam hall (fans, wall clock, everyone writing) · 2–3 his sweaty face, the leg shaking under the desk,
RRRUMBLE · 4–5 flashback: the teacher points at the sign (a toilet icon with a red cross, no text) · 6–9 the poop
moment (mosaic, PLOP) · 10 slow pan: everyone writing · 11 one guy in the back row slowly turns his head ·
12–14 wrapping the bundle (CRINKLE), tight, a little bow · 15–16 into the pencil box, CLICK · 17 a tiny proud nod ·
18–19 the teacher rises, glasses glint, sting · 20–22 "Everyone, open your pencil boxes. I'm checking for cheat
chits." (every box opens at once) · 23–26 her heels STOMP down the row, box by box, his face sweating more, faint stink
lines · 27 "What you don't know" · 28–33 old England in sepia + old-film filter: miners dig into a hill and find a
giant glowing lump of graphite · 34–35 his pencil box glows green, his face lit green · 36 she stops at his desk, a
big shadow · 37 CREAK: she lifts the lid, green glow on her face · 38 one eye twitches · 39 SNAP · 40 she walks away,
stiff, never looking back · 41–42 days later she avoids the pencil boxes and takes the long way round his desk ·
43 the school at sunset, green stink lines out of one window, slow zoom out.

## Files

`stt_parts.py`, `import_voiceover.py`, `plan.py` (43 shots, caption chunks) → `shots.json`; `align_words.py` +
`make_captions.py` (Pixelify Sans, centred, 2–4 words) + `make_words.py` (pop-up words: RRRUMBLE, PLOP, CRINKLE, CLICK,
STOMP, CREAK, SNAP) → `audio/captions.ass`; `events.py` (shared key moments); `scene/school.js` (exam hall, desks,
pencil boxes, toilet paper bundle, ceiling fans, clock, sign, old England hill + graphite lump, the school at sunset),
`scene/cast.js` (YOU, YOU with trousers down, the teacher, classmates, miners), `scene/shots.js` (43 shots);
`fx.py` + `render.py` (camera moves, mosaic, stink lines, sweat drops, glow, sparkles, old film, fade out);
`make_sfx.py` (39 code-made sounds: hall ambience, clock ticks, rumble, plop, crinkle, click, sting, heels, tense
music, medieval music, crack, creak, snap, sad piano, evening birds) + `mix.py` (voice on top, -14 LUFS).

Build: `python3 stt_parts.py audio/raw/my_voiceover.mp3 && python3 import_voiceover.py && python3 plan.py`,
`NO_STILLS=1 node render_scene.mjs`, `./make_reel.sh` (runs captions, words, sounds, mix, shots → `final.mp4`).
