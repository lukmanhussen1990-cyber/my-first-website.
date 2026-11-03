# Spot the 5 Mistakes — child-safety reel

A 40-second vertical (1080×1920, 30 fps) animated short made entirely with code:
Three.js primitives (no images or 3D models), HTML/CSS captions, a Web Audio
soundtrack and your voiceover. Rendered to `output.mp4`.

> "He made 5 mistakes online. Can you spot them?" — Rohan, 10, games at midnight while
> his parents sleep. A stranger tricks him… then a safe replay shows what he should have done.

## Files

| File | What it is |
| --- | --- |
| `index.html` | The whole film: scene, characters, camera, overlays, music + SFX. All timings live in the `TIMELINE` object at the top of the script. |
| `render.js` | Renders `index.html?render` frame by frame with Playwright, writes `audio.wav`, encodes `output.mp4` with ffmpeg. |
| `voiceover.mp3` | Your recorded voiceover. It is cut into the 9 script lines and placed on the timeline. |
| `output.mp4` | The rendered reel (H.264 yuv420p, 30 fps, AAC). |
| `audio.wav` | The exported soundtrack (voiceover + generated music/SFX), 48 kHz stereo. |

## Preview (real time, with sound)

```bash
node render.js --serve            # then open the printed URL
# http://127.0.0.1:8080/index.html?preview      (add &t=24 to start at 24 s)
```

Click **PLAY**. Opening `index.html` straight from disk also works, but browsers block
loading `voiceover.mp3` from `file://`, so you'll only hear the music.

## Render the MP4

```bash
npm install                       # installs Playwright
npx playwright install chromium   # one-time browser download
node render.js                    # frames/ → audio.wav → output.mp4
```

Requires Node 18+ and `ffmpeg` on your PATH. Options:

- `--workers N` — parallel browsers (default 2). In software WebGL the CPU is the limit, so more workers rarely help.
- `--from 300 --to 450` — re-render only a range of frames, e.g. after editing one scene.
- `--no-encode` — stop after writing frames and `audio.wav`.
- `--check 2,16,27,35` — render single stills (seconds) into `checks/` for a quick look.

`window.renderFrame(n)` draws exactly frame `n` (3D scene + caption overlay) at time
`n / 30`. Nothing depends on wall-clock time or on the previous frame, so frames can be
rendered in any order or in parallel.

## Editing

Everything is in `TIMELINE` in `index.html`:

- `voiceover.lines`: each line has `at` (start on the timeline), `src` (which slice of
  `voiceover.mp3` to play) and `words` (caption word + seconds after `at`). The word timings
  come from a word-level transcription of your recording. Move a whole line by changing `at`.
- `overlay`: the hook, the mistake counter times (6, 11, 16, 21, 27 s), the green banner,
  and the highlighted words (`stranger`, `school`, `house`, `secret`, `alone`, `block`).
- `beats`: story events (card pop, tap, car drive-by, selfie flash, head turn, time skip, …).
- `camera`: keyframes `{ t, pos, look, fov }`, eased with easeInOutCubic.
- `audio`: music/duck levels. Your recording is quiet (about −29 LUFS), so `voiceover.gain` lifts it.

## Story beats

| Time | Scene |
| --- | --- |
| 0–4 s | Wide shot of the cut-away house at night; clock shows 11:30; push in to Rohan's room |
| 4–9 s | Friend request pops above the laptop, he taps Accept (🚩1); a dark car creeps past the gate |
| 9–14 s | "Which school do u go to?" bubble with a school icon; his school bag glows (🚩2) |
| 14–19 s | "Send a pic bro!" — selfie flash; the photo shows the glowing **24** behind him (🚩3) |
| 19–24 s | "Don't tell ur mom" — he glances at his door, nods (🚩4); mom turns in her sleep |
| 24–31 s | Next evening: sunset → night; he walks out of the gate alone toward the park where the car waits (🚩5); fade to black |
| 31–40 s | Safe replay: warm room, he shakes his head, takes the laptop to mom, **BLOCKED**, hug, pull back |
