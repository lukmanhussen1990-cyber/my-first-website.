# রাজাল ডিজিটাল স্টোর — Bengali motion-graphics promo

`rajal-digital-store.mp4` — 30 s, 1920×1080, 30 fps, H.264 + AAC. Bengali voice-over, synthesized music and sound effects.

**Story:** welcome → **PAN card** → **flight ticket booking** → "আজই চলে আসুন" at **উত্তর ফুলবাড়ি** → logo + tagline.

## How it is made

| Piece | File | What it does |
|---|---|---|
| Narration | `script.json`, `tools/make_voiceover.py` | Bengali neural voice (edge-tts, `bn-IN-TanishaaNeural`), one clip per sentence, with word timestamps |
| Timeline | `tools/make_timeline.py` | Places sentences, snaps scene cuts to the beat, writes `build/timeline.js` |
| Animation | `index.html`, `styles.css`, `animation.js` | HTML/SVG + GSAP. Every frame is a function of time; cues are locked to spoken words. Open `index.html` in a browser to preview (Play / scrub). |
| Frames | `tools/render_frames.cjs` | Headless Chromium (Playwright) → lossless frames; also exports the sound-effect cue list |
| Audio | `tools/build_audio.py` | Music bed + SFX synthesized with numpy, ducked under the voice |
| Final | `tools/mux.py` | H.264/AAC encode with loudness normalisation |

```bash
pip install edge-tts numpy scipy && npm i playwright && npx playwright install chromium   # one-time
python tools/make_voiceover.py && python tools/make_timeline.py
node tools/render_frames.cjs --video build/silent.mkv --workers 4
python tools/build_audio.py && python tools/mux.py rajal-digital-store.mp4
```

## Easy edits
- **Words spoken** → `script.json` (then re-run the commands above).
- **On-screen text, colours, logo** → `index.html` / `styles.css`.
- **Male voice** → `VO_VOICE=bn-IN-BashkarNeural python tools/make_voiceover.py`.
- **Phone number / address line** → add to the outro scene in `index.html` (none was provided, so none is shown).
