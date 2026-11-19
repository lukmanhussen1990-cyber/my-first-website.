# Engine Reel — "Suck, Squeeze, Bang, Blow"

A 1080×1920 / 30 fps 3D explainer reel built with **Remotion + React Three Fiber**.
Every shape is procedural (extrusions, lathes, custom half-pipes); there are no external models or HDRIs.
The voiceover is baked into the render.

## Commands

```bash
cd engine-reel
npm install

# Live preview with a scrubbable timeline
npm run studio            # → http://localhost:3000

# Final render → out/engine-reel.mp4 (1080×1920, H.264, voiceover included)
npm run render

# Quick half-res preview of a slice (frames 0–149 = first 5 s)
npx remotion render EngineReel out/preview.mp4 --frames=0-149 --scale=0.5 --crf=26

# Single frame
npx remotion still EngineReel out/still.png --frame=300
```

**No GPU?** On a server or CI box, use the CPU WebGL backend:
`REMOTION_GL=swangle npm run render`. It's slower, but the output is identical.

## Where things live

| File | What it does |
|---|---|
| `src/timeline.ts` | **The TIMELINE.** All scene boundaries, word-synced events, crank-stroke keys, camera keys, shakes, captions, label pills, stickers. Times are in seconds of the voiceover. |
| `src/lib/kinematics.ts` | Slider-crank math `y = r·cosθ + √(L² − (r·sinθ)²)`, crank angle over time, valve lift and cam profiles (all driven by θ) |
| `src/lib/engineGeometry.ts` | Procedural cutaway block, ports, piston, rod, crank, valves, cams, spark plug |
| `src/components/Engine.tsx` | Engine assembly |
| `src/components/Particles.tsx` | Air/fuel charge and exhaust fumes. Every position is a pure function of time. |
| `src/components/Combustion.tsx` | Spark arc, flame kernel, layered fireball, flashes |
| `src/components/CameraRig.tsx` | Keyframed orbit camera, hook sway, shake impulses |
| `src/components/Lighting.tsx` | Moody hook → studio snap → daylight road. Also holds the procedural reflection environments. |
| `src/components/Workshop.tsx` | Teal tiled wall and floor, plus the hook mist |
| `src/components/CarSet.tsx` | Toy car, road, trees, tailpipe smoke |
| `src/components/Overlays.tsx` | Captions (Montserrat 900, 64% from top), pills, stroke badge, stickers, vignette |

## Re-timing to a new voiceover

1. Drop the file in `public/voiceover.mp3` and update `VOICEOVER.durationSec` / `DURATION_SEC`.
2. Get word timings with `python scripts/transcribe.py <audio.f32> words.json`. It uses faster-whisper and takes 16 kHz mono float32 input:
   `ffmpeg -i public/voiceover.mp3 -ac 1 -ar 16000 -f f32le vo.f32`.
3. Nudge the seconds in `src/timeline.ts`. Nothing else hard-codes a time.

Look-dev helper: `node scripts/stills.mjs 1.5 12 26.4` renders those timestamps to `out/stills/`.

Montserrat is © The Montserrat Project Authors, SIL Open Font License (`public/fonts/OFL-Montserrat.txt`).
