# What If the Moon Disappeared? (Instagram Reel)

A 37-second, 9:16 (1080×1920, 30 fps) 3D-animated science explainer with bold kinetic captions,
a cinematic electronic score and synchronized sound effects. **No narration, dialogue or vocals.**

Final video: [`what-if-the-moon-disappeared.mp4`](what-if-the-moon-disappeared.mp4)
(1080×1920, 30 fps, 37.0 s, H.264 High / BT.709, AAC 48 kHz stereo, -14 LUFS integrated, -1.3 dBTP true peak, 35 MB)

Every frame is rendered from real 3D scenes (Three.js / WebGL in headless Chromium). The soundtrack is
synthesized procedurally in Python. Both read the same timing table ([`src/events.json`](src/events.json)),
so each impact, whoosh and text pop lands on its visual cue.

## Scenes

| Time | Scene | On-screen text |
| --- | --- | --- |
| 0–4 s | Earth and Moon; fast camera push to the Moon, which pinches to a point and vanishes (impact, then a beat of silence) | WHAT IF THE MOON / DISAPPEARED? |
| 4–8 s | Rapid pull-back to Earth alone; a dashed outline marks where the Moon was; dive into the night side | THE MOON IS / GONE! |
| 8–12 s | Coastal city, mountains and bay at night; a before/after divider compares moonlit and moonless versions (city lights stay on, sky and land go dark) | NIGHTS BECOME / DARKER · WITH MOONLIGHT / WITHOUT MOONLIGHT |
| 12–18 s | Top-down tidal diagram: blue arrows and an exaggerated ocean bulge toward the Moon; the Moon vanishes and a smaller Sun-driven bulge remains. Then daytime tide gauges: big range with the Moon vs. smaller Sun-only range | EARTH'S TIDES / BECOME WEAKER · THE SUN STILL MAKES SMALLER TIDES · WITH MOON / WITHOUT MOON |
| 18–22 s | Moonless beach: a sea turtle crawls out of the surf; whip-tilt to a great horned owl under the Milky Way, bats overhead | WILDLIFE LOSES AN / IMPORTANT NATURAL CUE · SOME SPECIES USE THE MOON FOR: NAVIGATION · FEEDING · BREEDING |
| 22–26 s | Tilted Earth spinning with a glowing rotation arrow, axis line and a 24 h clock | EARTH'S ROTATION / COULD CHANGE · SLOWLY, OVER MILLIONS OF YEARS |
| 26–32 s | Backlit Earth on its glowing orbit with a dashed ring where the Moon's orbit was and the Sun's pull as an arrow; pull-back reveals the inner solar system | BUT EARTH WON'T / FLY AWAY! → EARTH WILL KEEP / ORBITING THE SUN |
| 32–37 s | Earth alone among the stars, slow zoom-out, music resolves | WOULD YOU / MISS THE MOON? |

## Science notes

- **Nights:** only moonlight is removed. Artificial lights stay on, and more stars become visible in the darker sky.
- **Tides:** the Sun's tidal force is roughly 46% of the Moon's, so tides weaken rather than vanish. The gauges use that ratio. There are no floods or giant waves.
- **Wildlife:** the wording is "some species". Examples include hatchling sea turtles that head for the brighter horizon over the sea, predators and prey whose activity shifts with moonlight, and corals and fish that time spawning to lunar cycles.
- **Rotation:** lunar tides slowly brake Earth's spin. Without the Moon that braking would mostly stop and Earth's axial tilt would be less stable, but these changes play out over very long timescales. Nothing changes overnight, and days do not instantly get shorter.
- **Orbit:** Earth's orbit is set by the Sun's gravity, so it carries on unchanged.
- Sizes and distances in the space shots are exaggerated for readability, as is standard in explainers.

## Rebuild

Requires Node 18+, Python 3.10+, ffmpeg and Playwright with Chromium
(`npm i -g playwright && npx playwright install chromium`). No GPU is needed; WebGL runs on SwiftShader.

```bash
./build.sh        # npm/pip deps, NASA assets, frames, soundtrack, final MP4
```

Partial renders while iterating:

```bash
node render.mjs --stills 0.5,9.8,16.6 --scale 0.5     # PNG stills in out/stills
node render.mjs --from 8 --to 12 --out out/city.mkv  # one segment
python3 audio/make_audio.py out/soundtrack.wav       # soundtrack only
```

Layout: `src/shots/` (one module per scene), `src/world/` (Earth, Moon, Sun, stars, creatures, effects),
`src/core/` (post-processing, captions), `audio/make_audio.py` (score and sound effects).

## Credits

- Earth imagery: NASA Visible Earth, Blue Marble Next Generation (Reto Stöckli, NASA Earth Observatory), Black Marble 2016 and Blue Marble clouds. Public domain.
- Moon imagery: NASA Scientific Visualization Studio CGI Moon Kit (LRO / LROC color mosaic and LOLA elevation). Public domain.
- Elevation helper map from the [three-globe](https://github.com/vasturiano/three-globe) examples (NASA-derived).
- Font: Montserrat (SIL Open Font License) via @fontsource.
- Music and sound effects: original, procedurally synthesized for this project.
