# Night Passenger

A cinematic 3D late-night drive through a misty forest, seen entirely from the back seat. You can't drive — you can only watch, and notice what's out there.

## Play

ES modules don't load from `file://`, so serve the folder and open the address it prints:

```sh
npx serve .            # or: python3 -m http.server
```

It also works as-is on GitHub Pages. Three.js loads from the jsDelivr CDN; everything else (textures, sound, music) is generated in code.

## Controls

| Input | Action |
| --- | --- |
| Mouse / drag | Look around |
| Q / E (or A / D) | Lean left / right |
| W / S | Lean forward / back |
| R | Change radio station |
| V | Roll the window down / up |
| C | Captions on / off |
| H | Hide on-screen text |
| M | Mute |
| F | Fullscreen |
| Esc | Pause (quality, volume, sensitivity) |

The drive takes about nine minutes. Strange things happen along Route 9; look at them long enough and you'll notice them — the ending tells you how many you saw.

## What's inside

- `js/world` — procedural road, terrain, forest, props, sky, lights and rain
- `js/car` — the cabin, the driver, instruments, rear-view mirror reflection, wipers, car motion and camera shake
- `js/render` — HDR pipeline: wet-road planar reflections, raymarched volumetric fog with headlight and moonlight shadows, raindrops on glass, depth of field, bloom, grading
- `js/game` — the scripted journey, events, gaze-based "witness" system, input and UI
- `js/audio` — procedural Web Audio: engine, tyres on wet asphalt, rain on the roof, wind, forest, radio music, tension score
