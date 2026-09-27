# Lumina Graphics — PC-style visuals for Minecraft Bedrock on mobile

A graphics add-on (`.mcaddon`) for **Minecraft Bedrock 1.21.0 and newer** (checked against
the 1.21.0.26 beta's scripting API) that makes the game look closer to PC with shaders. It works on
an ordinary phone and needs **no patched app, no shader loader and no experimental
toggles**.

**Download:** [`dist/Lumina_Graphics_v1.0.0.mcaddon`](dist/Lumina_Graphics_v1.0.0.mcaddon)

## What it adds

| Effect | Pack | Notes |
| --- | --- | --- |
| Cinematic distance fog, per biome | Visuals (RP) | Blue haze on plains, humid green in jungles, warm dust in deserts, murky swamps, pink cherry groves, thick red nether haze… |
| Rain & snowstorm fog | Visuals (RP) | Visibility drops when it rains, like shader weather |
| Clearer, bluer water | Visuals (RP) | Colors and transparency for each biome. See further underwater, and tropical oceans turn turquoise |
| Smooth animated water texture | Visuals (RP) | Calm ripples replace the noisy vanilla texture |
| Sun with bloom halo | Visuals (RP) | Round sun with a soft glow around it |
| Glowing moon with 8 real phases | Visuals (RP) | Soft terminator and craters |
| Puffier clouds, nebula End sky | Visuals (RP) | |
| **Light bloom** around torches, lanterns, campfires, glowstone, sea lanterns, froglights, soul fire, redstone torches, candles, end rods, portals… | Effects (BP) | Colored glow per light type. Torches flicker, and unlit campfires and candles stay dark |
| **Sun & moon glints on water** | Effects (BP) | Sparkles, mostly on the side of the water facing the sun, like reflections. Golden at sunrise/sunset, blue under the moon |
| **Fireflies** | Effects (BP) | Blinking fireflies over grass at night |
| **Falling leaves** | Effects (BP) | Drift down from trees and settle on the ground (birch/spruce/dark oak get their own tint) |
| **Sunlight dust motes** | Effects (BP) | Floating specks outdoors during the day |
| **Underwater particles** | Effects (BP) | Drifting particles in the water around you |
| **Morning mist** | Effects (BP) | Rolls in before sunrise and burns off by mid-morning. About 2 in 5 mornings are properly foggy |

## Install on Android / iOS

1. Download `Lumina_Graphics_v1.0.0.mcaddon` on your phone.
   (On GitHub: open the file → **⋯** / **Download raw file**.)
2. Tap the downloaded file and choose **Minecraft**. It says *Import started…* then
   *Successfully imported "Lumina Graphics"* **twice**, once for each pack.
3. Open your world → **Edit** (pencil) → **Behavior Packs** → **Available** →
   activate **Lumina Graphics (Effects)**. The game will offer to also activate the
   **Visuals** resource pack. Say **yes**.
4. Play. You don't need to turn on any experiments.

> **Only want the look without effects?** Activate just **Lumina Graphics (Visuals)**
> under *Settings → Global Resources*. It then works in every world, even on
> servers and Realms. The effects in the table marked *Effects (BP)* need the
> behavior pack in the world.

### Quality presets

In the world's **Resource Packs** screen, tap the **gear ⚙** on *Lumina Graphics
(Visuals)* and move the slider:

- **Performance**: half the ambient particles
- **Balanced**: recommended, good for mid-range phones like a Realme with Mali-G57
- **Ultra**: twice the particles

The effects script also slows down its block scanning by itself when your phone is
busy, so it shouldn't cause lag.

## Recommended video settings

`Settings → Video`: **Fancy Graphics ON**, **Beautiful Skies ON**, **Smooth
Lighting ON**, **Fancy Leaves ON**, **Fancy Bubbles ON**, **Render Clouds ON**,
Render Distance **10–14 chunks** (the fog is based on your render distance, so it
always fades nicely into the horizon), Field of View **70–80**.

## Good to know

- **Achievements:** any behavior pack turns off achievements for that world (a
  Minecraft rule). Use the Visuals pack alone if you care about achievements.
- **What it can't do:** real shadows, waving plants and screen-space reflections
  need a custom shader. Mojang blocks custom shaders on mobile since the
  RenderDragon engine (1.16.200). Anything that claims to do this on vanilla
  mobile needs a patched app. This add-on gets as close as possible without one.
- **Want real shaders?** Update to **Minecraft 1.21.90 or newer** and turn on
  **Vibrant Visuals** in *Settings → Video* if your phone supports it. That's
  Mojang's official shader mode with real shadows and reflections. Lumina's
  particles and bloom still work on top of it.

## For developers

Everything except the effects script is generated:

```
pip install pillow numpy
python3 build.py          # regenerates packs/ and dist/*.mcaddon
```

- `build.py`: textures (sun, moon, clouds, End sky, water, particle sprites, icon),
  fog definitions, `biomes_client.json`, particles, subpacks and manifests
- `packs/Lumina_Graphics_BP/scripts/main.js`: the only hand-written pack file,
  using the stable `@minecraft/server` **1.11.0** API
