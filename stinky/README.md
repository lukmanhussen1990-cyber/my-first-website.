# Stinky Date Reel

A 55-second vertical (1080x1920, 30fps) comedy reel built entirely with code:
Three.js low-poly characters and sets, canvas-drawn textures, a hand-made pixel font,
numpy sound effects and lo-fi music, rendered frame by frame with Playwright and joined with ffmpeg.

```bash
cd stinky
npm install                          # three.js only
./make.sh preview --w 270 --h 480    # quick check  -> ../stinky_date_reel_preview.mp4
./make.sh full                       # final        -> ../stinky_date_reel.mp4
```

## Pipeline
- `split.py` — cuts the provided voiceover (`audio/voiceover.mp3`) into one WAV per script line
  (`audio/lines/`), always cutting inside silences, and writes word timings to `audio/lines.json`.
  Optional `audio/whisper_words.json` (a local faster-whisper transcript) only refines word spacing
  inside a speech segment; without it, words are spread by letter count.
- `timeline.py` — places the lines with pauses, fits the total to ~55 s, builds 2-3 word captions,
  and fixes shared anchors (alarm, crack, brush, gargle, run, door bell, record scratch, spray).
- `sfx.py`, `music.py` — every sound and the lo-fi beat are synthesised with numpy.
- `mix.py` — voice + quiet SFX + ducked music (cut by the record scratch), ~ -15 LUFS.
- `scene/` — `font.js` (5x7 pixel font drawn in code), `chars.js` (YOU, CRUSH, waiter, patrons),
  `sets.js` (bedroom, bathroom, sunny street, cafe), `fx.js` (sweat, stink lines, mint cloud, hearts,
  bubbles), `shots.js` (every cut, anchored to the voice), `main.js` (deterministic `renderAt(t)`).
