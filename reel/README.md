# Sofa Divorce Reel

A 60-second vertical (1080x1920, 30fps) comedy reel: blocky low-poly characters made with Three.js,
rendered frame by frame with Playwright, joined with ffmpeg.

## Build

```bash
cd reel
npm install                      # three + Pixelify Sans font
./make.sh preview --w 144 --h 256   # quick low-res check -> ../sofa_divorce_reel_preview.mp4
./make.sh full                      # final 1080x1920      -> ../sofa_divorce_reel.mp4
```

`make.sh` runs: `timeline.py` (fits the edit to 58-62 s) -> `sfx.py` (synthesised sound effects)
-> `mix.py` (voice + quiet SFX, -16 LUFS) -> `render.js` (Playwright frames -> ffmpeg) -> mux.

## Voice (ElevenLabs, generated once)

- `audio/NN_<speaker>.mp3` — one file per script line, `eleven_flash_v2_5`, one take each.
  These files are reused forever; nothing in the pipeline calls ElevenLabs again.
- `audio/lines.json` — word timings for the captions, computed locally with faster-whisper
  (`align.py`) because the voices were generated through the ElevenLabs connector, which has
  no with-timestamps option.
- Voices: Justin (narrator), The Doc (dad), Sarah (wife), Grandma Muffins Oxley (mom).

## Files

- `script.json` — lines, speakers, caption chunks (2-4 words), pauses and stretchable beats
- `scene/` — Three.js scene: `chars.js` (cast), `sets.js` (bedroom, front door, living room),
  `fx.js` (sweat, stink lines, smell cloud, tears, sparkles...), `shots.js` (every cut, anchored
  to line/word times), `main.js` (deterministic `renderAt(t)`)
