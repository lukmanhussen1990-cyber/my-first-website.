# kit-storybook

Reusable pieces for Grace in Motion reels in the soft storybook style (see `reference/style_notes_storybook.md`).
Everything is a pure function of the frame: no timers, no `Math.random()` (use `core/random.ts`).

| Module | What it gives you |
|---|---|
| `core/Camera.tsx` | `CameraRig` + `Layer depth={…}`: one 2.5D camera (x, y, zoom, rot, focus, aperture) with parallax per depth. |
| `core/time.ts` | `ramp`, `window01`, easings, `lerp`. |
| `core/random.ts` | Seeded `mulberry32`, `hash`, value noise, `fbm2`. |
| `paint/Baked.tsx` | `Baked`, `FocusBaked`: canvas layers painted once per tab, then only moved; sharp and blurred pairs for rack focus. |
| `paint/brush.ts` | Painterly helpers: gradients, glow, ridge, canopy (leaf dabs), trunk, leaf, leafFan, meadow, tallGrass, haze, grain. |
| `paint/sets.ts` | Set painters + palettes: Eden (dusk / evening), bedroom (night / dawn), Gethsemane, void. |
| `sets/Sets.tsx` | `EdenSet`, `RoomSet`, `GethSet`, `VoidSet`: stacked depth layers with a slot for your subject. |
| `gl/Sky.tsx` | WebGL sky: gradient, sun/moon glow, fbm clouds, stars. |
| `gl/Character.tsx` | A transparent character PNG on a WebGL mesh: breathing, sway, bones (arm/head), hair flutter, eyelid blinks, colour grade, rim light, depth blur, blend into glowing line art (`tools/lineart.py`). |
| `fx/*` | Dust, bokeh, god rays, orbs, bloom flash, vignette, grain, light beam, blame threads, torch, ghost outlines, glowing fruit, phone. |
| `text/*` | `TopText` (serif hook, one gold word), `Captions` (2–5 word phrases from the voice timeline), `QuoteCard` (builds word by word with the voice), `PlaceTag`, `Brand`, `EndCard` + `Logo`. |

## A new episode

1. Put character PNGs in `episodes/<slug>/public/chars/`; make line art with `python tools/lineart.py in.png out.png gold|white`.
2. Voice: align with `tools/align_vo.py`, then `tools/build_voice.py` (pauses, tempo, `timeline.json`).
3. Name your moments in `cue_spec.json`, then run `node tools/make_cues.mjs`.
4. Score: copy `episodes/adam-silent/score.mjs` (uses `tools/audio/dsp.mjs`), then mix with `tools/audio/mix.mjs` and run a two-pass loudnorm.
5. Write `src/episodes/<slug>/` shots from the cues and register the compositions in `src/Root.tsx`.
6. Render with `EPISODE_PUBLIC=./episodes/<slug>/public npx remotion render …` (`--gl=swangle` on CPU). Stills: `node tools/render_stills.mjs`.
