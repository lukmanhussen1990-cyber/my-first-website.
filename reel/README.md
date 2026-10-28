# Big Questions About Allah — How Big Is Allah's Mercy?

Vertical reel (1080×1920, 30 fps, 68 s, H.264 + AAC). Everything is drawn and
synthesised in code: HTML canvas for the visuals, numpy/scipy for the sound.
No image files or AI images.

**Deliverables:** `out/reel.mp4` and `out/cover.png`

## Rebuild

```bash
./build.sh
```

Steps (all inside `build.sh`):

1. `plan.py` cuts `voiceover.mp3` into sentences and places them on a 68 s
   timeline with breathing room between lines. It also maps each script word to
   its spoken time (from `whisper_words.json`) and writes `timeline.json`,
   `js/timeline.js` and `vo_edit.wav`.
2. `make_lnum.py` makes a copy of Cormorant Garamond with lining numerals, so
   the counter reads 100 / 99.
3. `render.js` opens `index.html` in headless Chromium (Playwright) and captures
   every frame. It runs `renderFrame(t)` in `js/scene.js`, which draws the
   silhouettes from `js/sil.js`.
4. `audio.py` synthesises the wind, whoosh, plip and boom, heartbeat, birdsong
   and the rising swell, then mixes them under the voice.
5. `encode.sh` joins frames and sound with ffmpeg, loudness-normalised to about
   -14 LUFS.

To redo the word timestamps:

```bash
ffmpeg -i voiceover.mp3 -ar 16000 -ac 1 -f f32le vo16k.f32
python3 transcribe.py vo16k.f32
```

Useful checks:

- `node render.js times 8.6,22,33 preview` renders stills.
- `test_sil.html?n=horse&lift=1` shows a silhouette test sheet.

Fonts are from Google Fonts (SIL OFL): Cormorant Garamond, Amiri and Aref Ruqaa.
