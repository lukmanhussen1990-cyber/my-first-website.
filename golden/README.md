# Golden Toilet Reel

Vertical comedy reel (1080x1920, 30fps) whose length is exactly the voiceover's length.
Your own recording (`audio/my_voiceover.mp3`) is the only voice: it is gain-staged only,
never re-voiced, sped up or pitched.

```bash
cd golden
npm install                                   # three.js
python -m venv fw && fw/bin/pip install faster-whisper && fw/bin/python transcribe.py   # once, local
./make.sh preview --w 270 --h 480             # -> ../golden_toilet_reel_preview.mp4
./make.sh full                                # -> ../golden_toilet_reel.mp4
```

- `transcribe.py` — local faster-whisper word timestamps (free, no API) -> `audio/whisper_words.json`
- `align.py` — matches the script's words to whisper's (drops whisper's invented words) and snaps
  them onto the real speech segments in the audio -> `audio/words.json`
- `timeline.py` — captions (2-3 words, loud lines in BIG CAPS with a small shake) and sound cues;
  frame count = voiceover length x 30
- `sfx.py` / `mix.py` — code-made gate creak, phone ring, door creak, whistle, party noise,
  record scratch and camera shutter, kept quiet and ducked under the voice
- `scene/` — Three.js: faceted low-poly heads with pixel eyes (`chars.js`), pixel-textured sets
  (`sets.js`: home, mansion gate, marble hall + chandelier, golden bathroom, birthday party),
  `shots.js` (every cut on a word), `main.js` (renderer, golden lighting, censor mosaic, the
  framed "photo" rendered from a second camera)
