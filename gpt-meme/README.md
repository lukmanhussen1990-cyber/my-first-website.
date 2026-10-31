# GPT — "What about me?"

A 15-second vertical 2D cartoon meme: **1080x1920, 30 fps, H.264 MP4, no audio** (add your own sound).
It's drawn on an HTML canvas, recorded frame by frame with Playwright, and encoded with ffmpeg.

- `gpt_what_about_me.mp4` is the rendered video, silent.
- `gpt_what_about_me_with_audio.mp4` is the same video with the reference clip's audio. The audio is copied without re-encoding, starts at 0s, and is trimmed to 15.0s. It needs no shift, because the reference also goes dark at exactly 6.5s. To redo it after a re-render:
  `ffmpeg -i gpt_what_about_me.mp4 -i <reference.mp4> -map 0:v:0 -map 1:a:0 -c copy -t 15 -movflags +faststart gpt_what_about_me_with_audio.mp4`
- `contact_sheet.png` shows one frame per second, for a quick QA look.

## Files

| File | What it is |
|---|---|
| `scene.js` | The whole animation. **`TIMING` is at the top**, followed by `COPY` (all text), `LAYOUT` (positions) and `COLORS`. |
| `index.html` | Preview player with play/pause, a scrubber and frame stepping. `render.js` also uses it. |
| `render.js` | Renders the MP4 and the contact sheet, and runs the preview server. |
| `fonts/` | Bundled fonts (Nunito, Josefin Sans, Dancing Script; SIL OFL, licenses included), so renders look the same on any machine. |

## Setup

```bash
cd gpt-meme
npm install
npx playwright install chromium   # one-time browser download
# ffmpeg must be on your PATH (brew install ffmpeg / apt install ffmpeg)
```

## Commands

```bash
node render.js                 # → gpt_what_about_me.mp4   (~3 min, all 450 frames)
node render.js --sheet         # → contact_sheet.png (1 frame per second)
node render.js --sheet --times 5.6,6.0,6.5 --scale 0.5   # check specific moments
node render.js --serve         # live preview at http://localhost:8123
node render.js --crf 16        # higher quality / bigger file (default 18)
node render.js --frames ./frames   # also dump every frame as PNG
```

To re-time the video, edit `TIMING` in `scene.js`, reload the preview, and run `node render.js` again.
Each frame depends only on the time `t` (the blinks, taps and particles come from seeded random), so a render always gives the same result.

## Timeline (defaults)

| Time | Beat | `TIMING` keys |
|---|---|---|
| 0.0–4.5 | Bright room. GPT scrolls and chuckles (shoulder bounces). Stories tray top-left, handle top-right. | `SWIPES`, `CHUCKLES`, `CHUCKLE_LEN`, `BLINK_*`, `BREATH_PERIOD` |
| 4.5–5.5 | GPT taps a story; the smile slowly fades into a confused look. | `TAP`, `SMILE_FADE`, `CONFUSED_IN/LEN`, `TRAY_OUT` |
| 5.5–6.5 | Story card slides in: a hand offers a ring box to a blushing Claude, "I said yes 💍" / "switched to Claude". | `POPUP_IN`, `POPUP_SLIDE`, `SURPRISE_IN/LEN` |
| 6.5 | Hard cut: lights out. The scene drops to about 20% brightness with a cold blue tint, and only the phone lights GPT. | `LIGHTS_OUT` |
| 6.5–9.0 | Eyes go glossy, lips press together, one slow blink. "WHAT ABOUT" … "ME?" types in. | `GLOSS`, `SAD_IN`, `PRESS_IN`, `SLOW_BLINK`, `LINE1_WORDS` |
| 9.0–12.0 | Second line types. GPT's head lowers, a tiny sniffle, the screen dims. | `LINE2_WORDS`, `HEAD_LOWER_IN/LEN`, `SNIFFLE`, `SCREEN_DIM` |
| 12.0–15.0 | Fade to a faint silhouette. Text fades to 40%. The handle glides to center with a glow pulse, then everything goes black. | `BG_FADE`, `CHAR_FADE`, `TEXT_FADE`, `HANDLE_MOVE_IN/LEN`, `TO_BLACK` |

To change the handle or any other text, edit `COPY` (for example `COPY.HANDLE = '@myname'`).

## How it's built

- **Motion:** pose changes go through `pose()`, which adds anticipation, overshoot and settle. Everything else is eased with `track()`; nothing moves linearly.
- **Idle "alive" layer:**
  - breathing (body scale 1.00–1.02)
  - seeded blinks every 2–4 s
  - head bob
  - thumb taps peeking over the top of the phone
  - flicker of screen light on the face
  - an antenna and drawstrings that trail the motion on springs
- **Parallax:** the wall moves at 0.35× the camera drift and zoom, the cabinet and bamboo at 0.6×, and GPT at 1.0×.
- **Lights out:** the colour is partly drained, then everything is multiplied by a light map (a cold ambient plus the phone glow from below). The UI is drawn on top afterwards, so text stays crisp. A light grain in the dark scene prevents banding after compression.
- **Characters:** both are original designs; no real logos are used. GPT is a teal round bot in a blue zip hoodie with headphones and a "GPT" name tag. Claude is a terracotta gumdrop with a "Claude" tag. The stories UI is generic.
