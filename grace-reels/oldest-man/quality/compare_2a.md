# Quality loop 2 — pass A: wide world shot (lighting/graphics track)

`compare_2a.png`: left = reference `wides/wide_3.png` (ref A 55.5 s, village from high up), right = our lab wide
(`src/three/sets/_lab.js` station `wide`, frame 310830, no overlay). Both are scaled to 720×1280.

Pixel samples (sRGB): our lit sand is `#c8ac6a` and the ref's is `#aa814b`. Our shadowed sand is `#887145` (ref shadows: hue kept, about ×0.8).
Our far ground is `#a58751` and the ref's top haze is `#b89b6e`.

## Five places where ours is weaker

1. **Washed out, low contrast, yellow veil over everything.** Several layers stack up: height fog (0.012), linear fog (60–420 m), post haze (0.22 over the top 55 %) and split-tone highlights (`#ffcf7a`).
   - On top of that, the key + fill is about 2.9× albedo, so lit sand saturates to pale `#c8ac6a` (ref `#aa814b`).
   - Mid-tones lose saturation in ACES, and nothing in the frame reads as a clean colour.
2. **Muddy grey-olive shadows and large, blurry dark blotches.** The shadows of off-screen palms (top right, bottom left) dominate the frame.
   - The tilt-shift band (bottom 16 %, 0.6) smears them into dark smudges.
   - The fog veil turns them grey instead of a hue-kept multiply like the ref.
3. **Set dressing reads as noise, not richness.** About 700 grass tufts render as near-black "burnt sticks": the vertex gradient root `#5d6236` × instance colour is too dark.
   - The 420 pebbles are invisible (too small).
   - The terrain's olive patches and the worn paths are lost under the veil, so the ground still reads as one flat colour.
4. **No colour accents: the scene is monochrome mud.** Houses, roofs and ground are all the same sand-brown, and the flat roofs read as empty trays.
   - The ref separates every house with a strong roof colour (which we must not copy). We have nothing to play that role: no awnings, rugs, door cloths, greenery or roof clutter.
5. **Figures are lost.** At 95 m / 17° they are about 4.5 % of frame height (ref about 7 %). Thick dark outlines plus the veil make them dark blobs.
   - Chromatic aberration (0.004) adds red/blue fringes to every dark tuft near the frame edges.

## Fixes for pass B

1. **Exposure and veil.**
   - Calibrate the day light: key 2.2, fill 0.7, exposure 0.92, sat 1.12.
   - Lower the height fog to 0.005 and move the linear fog out to 140–700 m.
   - Post haze becomes a real top band: new `post.hazeTop` (default 0.62), haze 0.16.
   - Lower the split highlights to 0.12.
2. **Shadows.**
   - Warm the hemisphere ground bounce so shadows keep their hue.
   - Tilt-shift on wides: bottom band 0.1, strength 0.42.
   - Remove the palm placed just off-frame.
3. **Props.**
   - Brighter tuft gradient: root `#8f8a58`, olive tips `#a8a457`; bigger tufts in clumps.
   - Bigger, lighter pebbles.
   - Stronger olive and path contrast in the terrain colour function.
4. **Colour accents (new kit options).**
   - `makeMudHouse({ awning, curtain, roofClutter })`: a striped awning, a door cloth, jars, a rug and firewood on the roof.
   - New `makeRug()` and `makeBush()`: rugs drying in the yards, faceted olive bushes.
   - Tents in our own palette: indigo/ochre and terracotta/cream.
5. **Figures.**
   - Camera to 72 m (figures about 7.5 % of frame height).
   - CA default 0.004 → 0.0025, which also removes the edge fringes.
