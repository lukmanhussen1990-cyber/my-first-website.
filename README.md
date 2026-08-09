# my-first-website.

## What Is an Ecosystem? — an interactive animated lesson

`index.html` is a complete Grade 8 science lesson built as a single, self-contained
file. Open it in any browser — no server, no internet, no libraries.

**How to use it:** open `index.html`, press *START THE LESSON*, and follow the
13 chapters. Tap anything in the world at any time to learn what it does.

### What is inside

| Chapter | What the student does |
| --- | --- |
| 1. A Living World | Watches the ecosystem, sees living vs non-living highlighted |
| 2. Explore | Taps trees, animals, water, sun, soil… and gets an info card + animation |
| 3. Biotic & Abiotic | Watches the world split into living and non-living halves |
| 4. Energy Flows | Follows glowing energy: Sun → grass → grasshopper → frog → snake → eagle |
| 5. Three Jobs | Producers, consumers and decomposers, each animated |
| 6. Interactions | Six short animated stories (deer eats grass, frog catches insect, …) |
| 7. What If? | Removes sunlight / water / plants / insects / predators and watches the cascade |
| 8. Not Only Forests | Goes underwater, then compares forest, pond, ocean, desert, grassland |
| 9. Day & Night | Drags a slider and watches the whole world change |
| 10. Weather | Switches sun, rain and wind |
| 11. Connections | Draws the whole living network as glowing links |
| 12. Mini Challenge | Six questions — several answered by tapping the world itself |
| 13. Summary | Recaps everything, then hands the world over to free exploring |

### Technical notes

- One file: HTML + CSS + JavaScript, Canvas 2D rendering, Web Audio ambience.
- Works offline. No images, fonts, libraries or network requests of any kind.
- Touch, mouse and keyboard: drag to pan, pinch or scroll to zoom, `Tab` to cycle
  through objects, `Enter`/`Space` to select or advance, `M` to mute, `Esc` to close.
- Responsive from small phones to desktops; the camera frames the scene by height
  so plants and animals stay the same readable size on every screen.
- Performance: device-pixel-ratio cap, a quality tier chosen from device hints, and
  an adaptive step-down if the frame rate stays low.
