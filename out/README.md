# HONEST QUESTIONS — THE ARK  ·  Grace in Motion

An original 1080×1920 / 30 fps reel (~76 s) in the style of the supplied "Honest Questions" references:
flat 2D cut-out characters living in a low-poly 3D world, word-by-word serif captions with coral
highlights, label pills, cream Scripture cards, golden light pillars, a Judgment/Mercy poll and a logo
outro. The glowing **door** is the visual thread (ark → hill → city → poll), and the last frame echoes
the first so the reel loops.

## Deliverables (this folder)
| file | what |
|---|---|
| `final_reel.mp4` | the reel — 76.4 s, 1080×1920, 30 fps, H.264 CRF 18 yuv420p, AAC 192 kbps 48 kHz, `+faststart`; −14.0 LUFS, −1.1 dBTP |
| `cover.jpg` | 1080×1920 cover: the hook question over the ark on dry land |
| `caption.txt` | Instagram caption + 15 hashtags |
| `ref_style_notes.md` | what was measured from the reference reels (pacing, palette, overlays…) |
| `characters.png` | character sheet (family, crowd, commuters, animals, faces & acting) |
| `storyboard.jpg` | one frame per shot |
| `preview_6s.mp4` | the 6-second check render made before the full render |
| `qc_contact.jpg` | QC contact sheet, one frame every 2 s |

## Re-render with one command
```bash
bash scripts/build.sh
```
That runs: voice (edge-tts) → SFX cue export → music/SFX/mix → frame render (Playwright Chromium,
`window.renderAt(t)`, 3 workers) → ffmpeg → storyboard / character sheet / QC.
On this 4-core cloud box the 2,293-frame render takes ~25 min (software WebGL, ~1.45 fps).

Handy partial runs:
```bash
python3 scripts/tts.py                       # voice + build/timings.json
node scripts/cues.cjs && python3 scripts/audio.py   # music + SFX + loudness-normalised mix
node scripts/render.cjs --from 0 --to 6 --out out/preview_6s.mp4   # quick preview
node scripts/render.cjs                      # full reel -> out/final_reel.mp4
node scripts/storyboard.cjs out/storyboard.jpg
python3 scripts/qc.py && node scripts/qc_overlay.cjs
```

## Swap in your own logo or voice
* **Logo:** your `grace-in-motion-pfp.png` was not attached, so a placeholder mark (`assets/logo.svg`,
  a glowing doorway with a dove) is used. Save your logo as `assets/grace-in-motion-pfp.png` and re-run;
  the top bar and the outro pick it up automatically.
* **Voice:** record the script in `scripts/script_lines.py` as `assets/voice.wav` and re-run
  `bash scripts/build.sh` — `tts.py` detects it and recovers word timings with faster-whisper, so
  captions and scene cuts follow your delivery.

## Notes
* Narration: Microsoft Edge neural TTS `en-US-AndrewMultilingualNeural`, rate −8 %, pitch −4 Hz
  (puts the median pitch at ~113 Hz, matching the reference narrator's ~111 Hz baritone), sentence-by-
  sentence with reference-matched pauses, light broadcast EQ/compression.
* One wording tweak: S17 says “The ark was never **only** about JUDGMENT” so it doesn't contradict the
  closing question (“Was the ark about JUDGMENT… or MERCY?”).
* Verses are KJV word-for-word (checked by `scripts/qc.py`): 1 Peter 3:20, John 10:9; pills cite
  2 Peter 2:5, Genesis 6:16, Genesis 7:16.
* Music and every sound effect are synthesized procedurally in `scripts/audio.py` (no samples).

## QC results (final render)
* Loudness −14.0 LUFS integrated, true peak −1.1 dBTP (ffmpeg ebur128); voice ducks the music by 8 dB.
* All 178 narrated words recognised by Whisper in the final mix; captions appear 38–80 ms before each word.
* 0 overlay elements outside the safe zone (x 60–960, y 220–1500) across 1,693 checks; 0 blank frames.
* The near-white thumbnail at 52 s in `qc_contact.jpg` is the intentional lightning-flash cut into the flood.
