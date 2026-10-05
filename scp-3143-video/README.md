# SCP-3143 Explained: motion-graphics video

**[`SCP-3143-explained.mp4`](SCP-3143-explained.mp4)** is a roughly 5-minute narrated motion-graphics explainer for
**SCP-3143, "Murphy Law in… The Foundation Always Rings Twice!"**, in 1080p30 noir style. Soft English subtitles are
embedded, and the same subtitles are in [`SCP-3143-explained.srt`](SCP-3143-explained.srt).

It covers what the anomaly is, how it works, containment, history, the three interview logs, the Level 4 email
twist, and the in-article credits.

## Credits & license

- Based on [SCP-3143](https://scp-wiki.wikidot.com/scp-3143) by **The Great Hippo**, SCP Wiki, licensed
  [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/). Quotes on screen are from that article.
- This video, and the code in this folder, are an adaptation released under **CC BY-SA 3.0**.
- Narration: synthetic voice ([Kokoro TTS](https://github.com/thewh1teagle/kokoro-onnx), Apache 2.0, voice `am_michael`).
- Music and sound effects are synthesized by `mix.py`. No third-party audio is used.
- Fonts: Courier Prime, Bebas Neue, Abril Fatface, Playfair Display, Oswald (SIL OFL 1.1); Special Elite (Apache 2.0).

## How it's built

| Step | File | Output |
| --- | --- | --- |
| Narration script (captions + phonetic TTS text) | `narration.json` | |
| Text-to-speech, one clip per line | `tts.py` | `build/voice/*.wav`, `build/voice.json` |
| Word timestamps (to sync animation to speech) | `align.py` | `build/words.json` |
| Timeline, SFX cues, subtitles | `node render.js plan` | `build/plan.json`, `build/subs.srt` |
| Soundtrack (voice + rain + music + SFX) | `mix.py` | `build/mix.wav` |
| Frames → H.264 (parallel workers) | `node render.js video 4` | `build/video.mp4` |
| Final mux (+ loudness normalization, subtitles) | `node render.js mux` | `SCP-3143-explained.mp4` |

Scenes live in `scenes.js` and drawing helpers in `gfx.js`. Each scene receives its narration timing (including
the time each word is spoken) and returns a pure `draw(ctx, t)` function plus its sound-effect cues.

```bash
./fetch-assets.sh                      # fonts + TTS model
npm install
pip install -r requirements.txt
python tts.py && python align.py
node render.js plan && python mix.py
node render.js video 4 && node render.js mux
node render.js still 120               # preview one frame (seconds)
```

Requires Node 18+, Python 3.10+, and ffmpeg with libx264.
