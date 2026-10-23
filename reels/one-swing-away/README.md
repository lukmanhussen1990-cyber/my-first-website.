# One Swing Away — stickman reel

A 17-second vertical (1080×1920, 30 fps) 2D stickman reel: two miners dig toward buried gold,
one quits one swing short, the other breaks through — then the quitter sees the glow, and his
regret turns into a red, ultra-instinct-style rage. End card: **THE GOLD WAS / ONE SWING AWAY.**

- `reel.html` — the whole animation **and** its sound design in one file (HTML5 canvas + Web Audio).
- `render.mjs` — renders it frame-by-frame in headless Chromium (Playwright) and stitches the
  frames and the synthesized SFX track into an MP4 with ffmpeg.
- `out/one-swing-away.mp4` — the final render (H.264 yuv420p CRF 18, AAC 192k stereo).
- `contact-sheet.png` — one frame per second, for reviewing the look.

## Preview

Open `reel.html` in a browser. `Space` plays/pauses, `←`/`→` step one frame, the slider scrubs,
**SAFE ZONE** shows the Instagram UI clearances, **SOUND** plays the synthesized mix in sync.

## Render

Needs Node 18+, ffmpeg, and Playwright's Chromium (`npm install && npx playwright install chromium`).

```bash
node render.mjs --sheet              # contact-sheet.png (1 frame per second)
node render.mjs                      # out/one-swing-away.mp4 with sound
node render.mjs --no-audio           # silent MP4
node render.mjs --audio-only         # just out/one-swing-away.wav
node render.mjs --sheet --times 8.2,11.3,14.7 --name beats   # sheet of chosen moments
```

Other flags: `--workers 4` (parallel pages), `--out path.mp4`, `--keep-frames`, `--guides`
(burns the safe-zone overlay in).

## Making the next reel

Everything you would normally tweak is in the `CONFIG` object at the top of `reel.html`:

| Key | What it controls |
| --- | --- |
| `text` | labels above each character (`labelA` / `labelB` as `[time, text]` lists), `card` lines, `watermark`, sizes and letter spacing |
| `days` | day-counter keyframes `[time, day]` |
| `scenes`, `beats` | the story timeline: jump, hits, wipe, quit, reveal, final swing, pan, rage, fade, card |
| `colors` | palette: sky, strata, tunnels, lantern, gold, rage aura, text |
| `world` | tunnel positions/width, depths, where B stops, the depth curve of the dig |
| `figure`, `style` | stickman proportions, rim glow, eye size, lid lines |
| `audio` | master level, reverb, stereo positions of the two diggers, per-group gains |

Code layout inside `reel.html`:

1. **CONFIG**
2. **Math / easing / seeded random**
3. **Timeline + tracks** — `Track` (keyframes with per-segment easing, interpolates numbers,
   arrays and pose objects), monotone `Spline`, `Timeline` scene registry, typewriter text
4. **Particles** — closed-form (analytic) motion, so any frame renders identically in any order
5. **Stickman** — joint skeleton (FK legs, 2-bone IK arms), named pose keyframes (`POSES`),
   eye-shape expressions (`FACES`), rim glow, hair, steam, sweat, anger vein, rage aura, held pickaxe
6. **World** — strata, rocks, roots, fossils, sky, tunnels, rope, lantern, treasure, cracks
7. **Lighting, camera, HUD** — darkness layer with light holes, god rays, labels, day counter, card
8. **Choreography** — this reel's story assembled from `CONFIG`
9. **Sound** — a small synth library (`SFX`) and the cue sheet, built from the same beat data
10. **Renderer + preview player**

Rendering is deterministic: no `Math.random`, no wall-clock time — `renderFrame(t)` is a pure
function of `t`, which is what lets the renderer split frames across parallel pages.

## Timeline

| Time | Beat |
| --- | --- |
| 0–1.5s | Both jump into their holes, determined — `DIGGING` |
| 1.5–6s | Synced digging montage, lanterns follow them down, DAY 1 → 50 → 120 → 200 |
| 6–8.5s | B slows, wipes sweat, slumps — `TIRED` → `WHAT'S THE POINT`, DAY 290 |
| 8.5–10s | B drops the pickaxe and climbs out — `QUIT`; the camera reveals the gold one thin layer below |
| 10–12.5s | DAY 300: A's last swing cracks the floor, golden light bursts up, he celebrates |
| 12.5–14s | Crane up the shaft to B at the surface: he sees the glow leaking up his own hole, wide eyes → regret |
| 14–15s | Regret turns to fury: anger vein, he stands, red rage aura ignites (pillar, shockwave, cracks) |
| 15–17s | Fade to the card: THE GOLD WAS / ONE SWING AWAY. |
