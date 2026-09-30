# Logo SVG contract

The animation renderer (`src/`) rasterizes each named group of the logo SVG
into its own layer so it can glow, animate and depth-sort them separately.
Any logo design must follow this contract exactly.

## File

- Plain SVG, `xmlns="http://www.w3.org/2000/svg"`, `viewBox="0 0 1000 1000"`,
  `width="1000" height="1000"`, transparent background.
- Only vector shapes (`path`, `circle`, `ellipse`, `rect`, `polygon`) and
  `linearGradient` / `radialGradient` in `<defs>`. No `<text>`, no `<filter>`,
  no `<image>`, no masks/clipPaths referencing other files, no CSS classes,
  no external references. Gradients must use `gradientUnits="userSpaceOnUse"`
  so a group rendered on its own looks identical.
- Every visible shape lives inside exactly one of these top-level groups
  (in this paint order, back to front):

| group id    | what it is                                                  |
|-------------|-------------------------------------------------------------|
| `head`      | the dark face silhouette (partially hidden under the hat)   |
| `hat`       | the whole hat: crown, band/ribbon, brim, highlights          |
| `eye-left`  | round dot eye (viewer's left)                               |
| `eye-right` | four-point sparkle eye (viewer's right)                     |
| `smile`     | the crescent smile                                          |

## Composition (in 1000-unit space)

Matches the reference's final frame, scaled from 1080 px to 1000 units:

- Hat + head together occupy roughly x 150-850, y 130-650, horizontally
  centred on x = 500.
- Eyes sit around y = 500; smile bottom around y = 640.
- Keep y > 660 empty: the renderer draws the curved name text and the
  orbiting stars there.

## Palette (sampled from the reference video)

- Hat: vertical lavender gradient, darker mauve at the top `#7e6b91` /
  `#9a86ab` to pale lavender at the bottom `#e9d6fa`.
- Head: dark plum-grey `#3a333f` fading to `#2e2a33` at the chin. It is only
  a little lighter than the background; the renderer's backlight glow is what
  makes it read.
- Eyes: near-white with a faint pink-lavender tint `#fdf1fd`.
- Smile: white `#ffffff` at the bottom of the crescent fading toward
  `#bdb6c6` at the tips.
- Accents (e.g. a hat band) may use deeper purples like `#4b3d5c` / `#5d4d70`.

The style is flat, soft and rounded: big simple shapes, no outlines, no
texture, generous curves, smooth gradients.

## Tools

- Preview a design in context (dark bg + glow), optionally side by side with
  a reference frame:

      node tools/preview-logo.mjs design/candidates/<name>.svg out/<name>.png \
        --compare <reference-frame.png>
