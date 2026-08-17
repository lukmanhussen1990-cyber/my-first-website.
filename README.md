# my-first-website

An animated recreation of the "Someone in your life feels better because you
exist btw" rooftop illustration — an 8-second continuous shot, vertical 9:16,
built entirely from vector art and code. No video file, no image assets.

Open `index.html` in a browser. It works offline; nothing is fetched at runtime.

## The shot

Eight seconds, one continuous take, no cuts:

| Element | Motion |
| --- | --- |
| Camera | 3% push-in, eased, centred on the figure |
| The man | Breathing, ~2 slow breaths |
| Sweater | Barely-there cloth sway |
| Hair | ±0.45° drift |
| Rain | ~170 drops, softly angled, brighter inside the lamp cone |
| Puddles | Ripples expanding where drops land, plus ambient rings |
| City windows | A slow twinkle on ~22% of lit windows |
| Streetlight | One soft flicker at ~3.0s |
| Text | Nothing. It is a locked overlay. |

Every looping animation has a period that divides 8s, so the shot closes on
itself. The camera is the deliberate exception: it runs `alternate`, so the
first 8 seconds are the push-in as specified, and the following 8 ease back
out. On-screen playback therefore never jumps, and a recording of the first
8 seconds is the shot on its own.

## The locked text

The four lines live in `.type`, which is a **sibling** of `.camera`, not a
child. The push-in scales the scene underneath them and cannot touch them.
Nothing in the overlay animates, and the glyphs are live text — not paths,
not an image — so they stay sharp at any resolution.

This is verifiable rather than merely intended: with the scene layer removed,
screenshots of the text at t = 0, 1, 2, 3.2, 4, 6 and 8s are **byte-identical**,
and the four bounding boxes are identical to four decimal places across the
whole shot.

## How it is put together

Layers, back to front — all but the last inside `.camera`:

1. `#baked` — every static element, rasterised **once** into a bitmap
2. the skyline SVG — the twinkling windows
3. `.hush` — soft dusk behind the figure so his silhouette reads
4. the front SVG — reflections, lamplight, the man
5. `#rain` — rain and ripples on a canvas
6. `.type` — the locked lettering, outside the camera

The hand-drawn quality comes from SVG `feTurbulence` + `feDisplacementMap`,
which nudges every straight line off true. That filter is expensive, and
because anything animating inside an SVG dirties the whole thing, it was
being re-evaluated 60 times a second. So the static art is serialised, drawn
into a canvas once, and only composited after that. The paper grain and
corner vignette are composited into the same bitmap for the same reason — a
full-frame `mix-blend-mode` layer cost more per frame than the entire rest of
the scene.

The character keeps a live (much lighter) wobble filter: he is the focal
point, and staying vector means he is crisp at any resolution. His face uses
a lighter filter still — too much displacement tilts the eyebrows into an
expression the original does not have.

Measured effect, software-rendered headless Chromium at 1080×1920:

```
18.8 fps  →  42.6 fps
```

## Recording it

Hover the frame for two controls, which stay invisible otherwise so they
never appear in a capture:

- **Replay 8s** — resets every animation to t=0
- **Pause** — freezes the scene, including the rain

For a clean export, size the browser window to the aspect you want, hit
Replay, and screen-record for 8 seconds.

## Font

`fonts/PatrickHand-latin.woff2` — Patrick Hand by Patrick Wagesreiter,
[SIL Open Font License 1.1](https://openfontlicense.org/). Latin subset,
self-hosted so the page needs no network access.
