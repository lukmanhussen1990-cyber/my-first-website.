# my-first-website.

## The Living Brain

An interactive 3D brain animation built with [three.js](https://threejs.org/). The brain is generated entirely in code (no 3D model files), and about 1,100 simulated neurons fire across its surface.

- **Drag** to turn the brain. **Scroll** (or pinch) to zoom.
- **Click** the brain, or press **Spark a thought**, to set off a wave of firing neurons.
- **Hover** a lobe, or pick one from the list, to see what that part of the brain does.
- **Color regions** paints each lobe like an anatomy atlas. **Pause** freezes the animation.

It works on phones too, and it calms the motion down for people who have "reduce motion" turned on.

### View it

The whole site is one file: `index.html`.

- **On your computer:** double-click `index.html` to open it in Chrome, Firefox, Safari or Edge. It needs an internet connection, because three.js loads from a CDN.
- **On the web with GitHub Pages:** in this repository, open **Settings → Pages**, choose **Deploy from a branch**, pick your branch and the `/ (root)` folder, then save. GitHub shows the site's link after a minute or two.

### How it works

| Piece | What it does |
| --- | --- |
| Procedural anatomy | Each part (two hemispheres, two temporal lobes, the cerebellum and the brainstem) starts as a sphere that is bent into shape. Warped noise carves the folds (gyri and sulci), and the cerebellum gets thin stacked folds called folia. |
| Cortex shader | Lights the folds, shades the deep grooves, adds the rim glow, colors the lobes and draws the amber "thought" ripples. |
| Neural network | Neurons sit on the folds and connect to their nearest neighbors. A firing neuron sends pulses down its connections, and each pulse can make the next neuron fire, so activity spreads in small avalanches. |
| Post-processing | Bloom makes the activity glow, and a faint grain keeps the dark background smooth. |

### Make it yours

- **Colors:** edit the CSS variables at the top of `index.html`, such as `--cortex`, `--signal`, `--wave` and the six region colors.
- **Activity:** in the script, the `rate` passed to `network.update` sets how often neurons fire on their own, and `network.ignite(..., 9)` sets how far a spark spreads.
- **A different brain:** change the seed in `mulberry32(86e9)` to grow a new pattern of folds.
