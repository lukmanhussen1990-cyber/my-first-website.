# I Can See Lies — animated story reel

A 64.5-second vertical reel (720x1280, 30 fps, H.264 + AAC) in the flat 2D "story reel" style:
vector anime-style school characters, first-person narration, gold-keyword subtitles, stat cards
and a "Comment A or B" ending. Everything is made with code: HTML + SVG + CSS for the pictures,
Playwright to record them, ElevenLabs for the voice, numpy for music and sound effects, ffmpeg to assemble.

**Final video:** `out/final.mp4` · **Thumbnail:** `out/cover.png` (scene 1 at 3 s)

## Make a new story

Edit two files, then run `./build.sh`:

1. **`script.txt`**: one line per scene, in order. It is both the voice and the subtitles, so they always match word for word.
   - `*word*` shows a word in gold
   - ` / ` starts a new subtitle page (2 short lines max)
   - `{president}` at the start of a page means another voice speaks it (voices are listed in `plan.json`)
2. **`plan.json`**: the scene plan. It holds the cast (hair, eye colour, glasses, badge…), the voices, the timing rules,
   and every scene as a list of layers, for example:
   ```json
   {"type": "actor", "char": "president", "x": 250, "y": 1190, "h": 880, "face": "smile", "lie": "p2+0.3"}
   ```
   Times are seconds or refer to subtitle pages (`"p2"` = when page 2 starts speaking, `"p2+0.3"`, `"end-1"`),
   so pictures stay in sync with whatever the voice does.

Layer types (each one is a small `L_<type>` function in `make_scenes.py`):
`hallway`, `classroom`, `board`, `memory` (flashback frame with a sign), `dreamy`, `void`, `burst`, `spotlight`,
`actor`, `desks` (a row of seated students), `silhouette`, `lasers`, `crowd`, `eyeband`, `stat`, `profile`, `ab`,
`hearts`, `sparkles`, `dust`, `redflash`, `vignette`. Scene options: `zoom` (Ken Burns), `origin`,
`whoosh` (whoosh text on the cut), `copy` + `layers+` (reuse an earlier scene as a blurred background), `blur`, `dim`,
`lead`, `hold`.

Faces: `neutral`, `smile`, `smirk`, `grin`, `happy`, `shock`, `knowing`, `cold`. Characters blink on their own and
move their mouth when given `"talk": "<voice name>"`; `"lie": ...` grows a red line out of their mouth.

## Build

```bash
pip install playwright numpy          # Chromium must be available to Playwright
cp .env.example .env                  # add ELEVENLABS_API_KEY
./build.sh                            # everything -> out/final.mp4 + out/cover.png
./build.sh 3 7                        # re-record only scenes 3 and 7, then re-assemble
python3 render.py --snap 3@2.5        # quick still of scene 3 at 2.5 s -> out/snaps/
```

Preview a scene in the browser with live animation: `python3 -m http.server` and open
`http://localhost:8000/scenes/scene03.html` (click to replay).

| Step | Script | Output |
|---|---|---|
| Narration | `tts.py` | `audio/clips/*.mp3` (one per subtitle page, cached in `manifest.json`), `audio/sceneNN.mp3`, `audio/voice.wav`, `audio/timings.json` |
| Characters | `characters.py` | `characters/*.svg` (narrator, president, kai, ren, hana, yuna) |
| Scenes | `make_scenes.py` | `scenes/scene01.html … scene10.html`, `scenes/timeline.json` |
| Music + SFX | `sound.py` | `audio/music.wav` (dark piano bed), `audio/sfx.wav` (whoosh on every cut, ding on stat cards, zap, boom) |
| Recording | `render.py` | `out/scenes/sceneNN.mp4` |
| Assembly | `build.sh` | `out/final.mp4`, `out/cover.png` |

Shared look and motion: `style.css` (fonts, subtitles, cards, expressions, keyframes) and `anim.js`
(runtime that lets `render.py` step every frame exactly).

## Voice and timing

- Narrator: ElevenLabs "Adam – Calm and Emotionally Neutral" (calm, low, slightly cold); the class president's one
  quoted line: "Jade – Elegant, Calm". Model `eleven_multilingual_v2`, speed 0.95, stability 0.6.
- Clips are only generated when their text, voice or settings change (`audio/clips/manifest.json`), so re-builds are free.
- Scene length = voice + 0.8 s (0.3 s lead-in, 0.5 s tail), with a 6-second minimum so the reel lands in the
  60–90 s range (`timing.min_scene` in `plan.json`; set it to 0 for pure voice + 0.8 s). The final card holds ~3 s.
- Mix: music at −18 dB under the voice, light voice compression, loudness-normalised to −14 LUFS (−1.5 dBTP).
  To use your own royalty-free track instead of the generated one, save it as `assets/music.mp3`.

Fonts: Playfair Display and Montserrat (SIL Open Font License), stored in `assets/fonts/`.
