# One Token at a Time

A 65-second motion graphics film, with an original score and sound design, about
how an AI language model writes.

**Watch:** [`how-ai-writes.mp4`](how-ai-writes.mp4) (1920×1080, 60 fps, H.264 + AAC stereo)

The film follows one prompt, *"The sky is"*, through a language model in four steps:

| Time | Chapter | What you see |
| --- | --- | --- |
| 0:00 | Cold open | A cursor, a human typing a prompt, and the question: *what comes next?* |
| 0:06 | 01 Tokens | The sentence splits into tokens (leading spaces included), and each token becomes an ID number. |
| 0:14 | 02 Embeddings | Each ID unfolds into a vector, then lands on a map of meaning where *sky* sits near *blue*. |
| 0:26 | 03 Attention | *is* looks back at *sky* and *The* and absorbs context, then the row folds into a stack of layers. |
| 0:38 | 04 Prediction | A probability distribution over the vocabulary. The model picks *blue*, then writes the rest of the sentence one token at a time. |
| 0:50 | Training text | The camera pulls back until that sentence is one line among countless others, all written by people. |
| 0:54 | Ending | *No magic. Just prediction.* / **One token at a time.** |

## How it was made

No stock footage, no samples, and no generative image, video or music models.

- **Picture:** every frame is drawn in code on an HTML canvas
  ([`scene/scene.js`](scene/scene.js)). Each frame is a pure function of time,
  `renderFrame(t)`, so the film renders identically every time and can be
  rendered in parallel. Headless Chromium captures the frames.
- **Sound:** every note and effect is synthesized from oscillators and filtered
  noise ([`tools/audio.py`](tools/audio.py)). The score is in D major at
  120 BPM, the same grid the picture is cut to. The scene exports a cue sheet
  (`getCues()`), so each visual event (a keystroke, a token popping into a chip,
  an attention arc, a probability bar) triggers its own sound, panned to where it
  appears on screen.
- **Type:** Inter Display and JetBrains Mono (both SIL Open Font License,
  included in `scene/fonts`).
- **Palette:** ink `#0c0c0d`, paper `#eeebe5`, and one accent, `#ff5a2c`. The
  accent consistently marks the model's own work: token IDs, attention, and the
  words it generates. Human input stays paper-white.

## Rebuild it

Requirements: Node 18+ with [Playwright](https://playwright.dev) (Chromium),
Python 3 with `numpy` and `scipy`, and `ffmpeg` with libx264.

```sh
tools/build.sh how-ai-writes.mp4                 # full render, about 3–5 minutes on 4 cores
node tools/render.mjs stills /tmp/stills 12.5,40 # single frames for checking a moment
```

To watch the animation live (silent), open `scene/index.html` in a browser.
