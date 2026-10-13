# Claude — motion graphics promo

A ~33 second, 1920×1080 motion-graphics promo about Claude, built in the style of a
reference product teaser (same scene structure, pacing and techniques, all-new content).

**Final video:** `out/claude-promo.mp4`

## Storyboard

| Time | Scene |
| --- | --- |
| 0:00 | Dreamy blurred silhouette, scan lines, "Imagine a mind that thinks with you" types in with a glowing colour sweep |
| 0:02.4 | Pixelated wipe to ivory |
| 0:03 | `{ at every step }` builds word by word with animated selection handles |
| 0:04.5 | `{ intro▢▢▢ducing }` — a carousel of Claude-made artifacts slides through the word |
| 0:06.3 | 3D studio (Three.js): stone desk, monitor showing a Claude home screen; pink → orange → natural grade, push-in |
| 0:10 | Halftone sky with a serif "Claude" wordmark; the prompt "Build a landing page for my coffee brand." is typed (with close-ups) and sent |
| 0:14.2 | "Building artifact" — Thinking / Researching / Writing / Assembling, with a "Brewing…" shimmer |
| 0:16.7 | Dots assemble into a dot-matrix of the finished landing page |
| 0:18 | 3D card cascade of artifacts — **think / deeper**, **build / faster** |
| 0:24.3 | Warm gradient; "The AI collaborator for your best work" in selection brackets |
| 0:28 | The prompt card flips in (artifact preview, prompt, `Claude · Extended thinking · Artifact`) |
| 0:30.2 | End card: Claude spark + wordmark |

The "artifacts" (landing page, mobile app, dashboard, code editor, Claude Code terminal,
brand doc, poster, chat, brand sheet, spreadsheet, menu, email, research brief, slides) are
designed in HTML for a fictional coffee brand, *Ember & Oat*, and rendered to PNG.

## How it's made

- `src/assets.html` — the artifact card designs → `render/render-assets.cjs` → `assets/*.png`
- `src/index.html` + `src/main.js` — the composition. Every frame is a pure function of time
  (`window.renderFrame(t)`), so frames can be rendered in any order / in parallel.
- `render/render-video.cjs` — drives headless Chromium (Playwright) frame by frame and encodes with ffmpeg.
  Also exports the audio cue list (`--cues`) and review stills (`--stills=1.5,12,20`).
- `render/audio.py` — synthesizes the sound design (glitches, whooshes, booms, typing, UI beeps,
  card hits, pads, bells) from the cue list with numpy/scipy. No samples or stock audio.

## Rebuild

Requires Node 18+, Playwright (Chromium), Python 3 with numpy + scipy, and ffmpeg.

```bash
./build.sh            # assets -> frames -> audio -> out/claude-promo.mp4
WORKERS=8 ./build.sh  # more parallel render workers
```

Fonts: Inter (system), Newsreader and JetBrains Mono (`src/fonts`, SIL Open Font License).

*Fan-made promo; Claude is a product of Anthropic.*
