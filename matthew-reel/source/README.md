# Source for `matthew_reel_GraceInMotion.mp4`

Everything in the reel is drawn with code (pycairo vector shapes, HarfBuzz-shaped text). The music and sound effects are synthesized in `audio.py`.

## Rebuild

Requirements: Python 3.11+, ffmpeg, and these Python packages: `pycairo uharfbuzz numpy scipy fonttools pyloudnorm edge-tts`.

```bash
python3 setup_fonts.py /tmp/fonts_work   # Plus Jakarta Sans, Playfair Display, Cinzel (OFL) -> ~/.fonts
./build.sh /tmp/reel_out                  # -> /tmp/reel_out/matthew_reel_GraceInMotion.mp4 (~75 s on 4 cores)
python3 cover.py /tmp/reel_out/cover.png
python3 verify.py /tmp/reel_out/matthew_reel_GraceInMotion.mp4   # watermark / caption-sync / safe-zone checks
```

## Files

| File | What it does |
|---|---|
| `script_data.py` | Voiceover lines and caption markup: `{g:..}` gold, `{r:..}` red, `{n:..}` green, ` / ` line break, ` \| ` new caption page |
| `gen_vo.py` | Generates the voice with edge-tts (`en-US-AndrewNeural`, rate -8%) plus word timestamps, saved to `vo/` (already committed) |
| `timeline.py` | Places the voice clips, sets the pauses and builds the caption pages, written to `timeline.json` |
| `gfx.py` | Style primitives: palette, easing, characters, hands, props, labels, titles |
| `room.py` | The painting room (scenes 2-9 and 13): gallery frame, zoom, magnifier, hand detail, the Creation of Adam flash |
| `scenes.py` | Scenes 1 (hook), 10 (doctor), 11 (Oscar Wilde) and 12 (Bible) |
| `captions.py` | Karaoke captions, caption panel, watermark |
| `render.py` | Compositor: scene crossfades, loop fade, chunked H.264 encoding |
| `audio.py`, `master_audio.py` | Music, sound effects and mix, mastered to -14 LUFS |

To change a line of dialogue, edit `script_data.py`, then run `gen_vo.py` and `timeline.py`. All animation timings follow the voice, so the visuals re-sync automatically. The voice service only offers 24 kHz MP3. The committed clips were made with a copy of `edge_tts` patched to request `audio-24khz-96kbitrate-mono-mp3`; set `EDGE_TTS_PATH` to use such a copy.
