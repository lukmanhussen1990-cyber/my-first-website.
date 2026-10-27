# Larry & John (code-made 3D comedy reels)

Vertical 3D cartoon reels made entirely with code. The "Larry & John" cast, the toon renderer
and the sound tools are shared by every episode; each reel lives in its own folder.

| Path | What |
|---|---|
| `haunted-house/` | episode 1, "Larry's Haunted House" (see its README for building and swapping the voice) |
| `characters/` | reusable characters: `larry.js` (plus his bedsheet costume), `john.js`, `ghost.js`; `sheet.html` renders the character sheet |
| `engine/toon/` | toon renderer: stage (lighting looks, soft shadows, AO, bloom, depth of field, motion blur), rig and poses, sticker faces, clay materials, geometry helpers, easing/springs |
| `engine/overlay/` | one-word subtitles and chunky 3D labels (2D canvas, transparent) |
| `engine/audio/` | DSP toolkit, code-made sound-effect recipes (`sfxlib.py`), cartoon voices (`voice.py`), music (`music.py`), loudness |
| `engine/render.cjs` | frame-by-frame renderer: headless Chromium -> raw frames -> ffmpeg (no screen recording) |
| `reference/` | style study of the reference reel (`style_notes.md`); only its style, pace and formula are used |
| `assets/fonts/` | Fredoka, Titan One, Lilita One, Permanent Marker, Luckiest Guy (OFL / Apache licences included) |

Setup: `npm install` here, plus ffmpeg and Python 3 (numpy, scipy, soundfile; faster-whisper and
torchaudio for voice alignment).
