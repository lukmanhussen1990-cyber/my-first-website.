YOUR MODULE: the WORLD — src/world/environment.js (+ any src/world/*.js) and test scene src/test/world.js.
Build buildWorld(stage) per DESIGN.md (layout coordinates are binding: seats, river, tree, castle, sun direction). Match the
reference landscape (full_2.png, full_14.png, full_20.png, full_58.png, full_63.png) and push the polish: saturated lime grass
with pixel-dither texture and gentle low-poly undulation away from the acting area, grass/flower tufts and small blocky plants
(InstancedMesh), a bright cyan river with an animated scrolling pixel water texture, white foam lines along banks and around
stones, dark stepping/shore stones, subtle specular sparkle; the knight's mossy purple-grey faceted rock seat and Jesus's lower
flatter rock (moss patches as pixel texture/vertex colour); a big autumn tree behind them (thick trunk, blocky leaf-cluster
canopy in yellow/olive/orange like the reference, slowly swaying), more trees and bushes, low-poly faceted green hills fading into
white mist, a stone castle with towers and conical slate/plum roofs on a hill across the river (+Z far), soft sky gradient with a
few stylised clouds, distance fog. Floating particles: drifting white dust motes, small pink/yellow pixel petals/pollen and 2-3
butterflies, deterministic motion from t. Lighting: sun DirectionalLight with soft shadows (focusShadow(center, radius) refits the
shadow camera for a shot), hemisphere sky/ground light, scene.environment from makeEnvMap (src/core/stage.js) matching the sky;
mood (0 = bright soft day, 1 = golden hour) smoothly changes sun elevation/colour/intensity, sky & fog colours, adds warm
volumetric-looking light shafts (additive soft planes/sprites) and warmer particles. Also set renderer exposure if needed.
Test scene src/test/world.js params: shot = wide | medium | reverse | aerial | closeup_seat and mood = 0..1, with capsule
proxies (knight-sized dark grey at the knight seat, cream at Jesus seat) for scale. Camera presets: wide = camera (3.2, 1.7, 10.5)
looking at (0, 0.7, 0) fov 40; medium = camera (0.2, 1.25, 3.6) looking at (0.1, 0.9, 0) fov 35; reverse = camera (0.0, 1.6, -3.2)
looking at (2, 1.2, 40) fov 45 (sees the characters' backs, river and the castle across it); aerial = camera (-6, 7, 12) looking
at (0, 0, 0); closeup_seat = camera (-0.3, 1.2, 1.6) looking at (-0.55, 0.8, 0). Check frame time stays within budget at
1080x1920 (render one full-res frame and report the time printed by shoot.mjs).
