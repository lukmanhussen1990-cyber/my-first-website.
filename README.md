# Ghost of Tsushima — Main Menu

A recreation of the *Ghost of Tsushima* main menu, built from scratch as a
single self-contained `index.html`. No frameworks, no build step, no external
requests — open the file and it runs.

## Everything is drawn, not loaded

There are no images and no webfonts. The scene is generated at load time:

| Element | How it's made |
| --- | --- |
| Ridgelines | Midpoint-displacement fractals, seeded so the island looks the same every visit |
| Sakura in bloom | Recursive branch routine — dark mass, blossom clusters, then the few flowers still catching the sun |
| Overhanging bough | A second recursive branch leaning in from the corner, hung with five-petal blossoms |
| Katana | Hand-modelled SVG — ji and ha bevels split by the shinogi ridge, hamon temper line, yokote at the kissaki, indigo ito over ray skin, gold sakura menuki, and an openwork tsuba the sky shows through |
| Petals, leaves, grass, wind, birds | Canvas particle system driven by a gusting wind function — petals fall lighter and spin faster than ginkgo leaves |
| Sky, sun, haze | Layered CSS gradients |
| Film grain | An inline SVG turbulence filter |
| UI sounds | Synthesised with WebAudio — brown noise through a wandering band-pass for the wind, a taiko thump on select |

## Menu

Continue · New Game · Load Game · Legends · Options · Extras · Quit

Each opens a panel. Three settings do real work rather than posing as
settings:

- **Kurosawa Mode** (under Extras) — black and white, heavier grain, more contrast
- **Particle Density** — Low / Medium / High, for weaker devices
- **Animation** — stops the render loop entirely

Music, ambient wind, volume and Japanese labels are also togglable. Everything
persists to `localStorage`.

## Controls

| | |
| --- | --- |
| Navigate | `↑` `↓` or `W` `S` |
| Select | `Enter` / `Space` |
| Back | `Esc` |
| Touch | Tap an entry |

## Mobile

- Portrait, landscape and short-landscape each get their own layout — in
  landscape the title moves beside the menu so seven entries still fit
- Tap targets are at least 44 px
- Canvas is DPR-capped at 2× and the particle count scales with screen area
- Safe-area insets, `100dvh` with a `--vh` fallback, pinch-zoom preserved
- Honours `prefers-reduced-motion`

## Audio

The background track is embedded as a base64 data URI, which is what keeps the
project to one file — at the cost of a ~6.6 MB `index.html`. Browsers block
autoplay until you interact, so the track starts on your first tap or keypress;
a "Tap for sound" cue appears until then.

To serve the MP3 as a separate file instead, replace the `<audio>` element's
`src` with a path to the file.
