# Why Your Cat Sits On Your Laptop — cute cat reel

Vertical Instagram reel (1080×1920, 30 fps, 25.0 s, H.264 + AAC) built entirely in
Blender 4.5 LTS with Python (`bpy`) and rendered with EEVEE. ffmpeg adds the captions,
watermark and audio.

| File | What it is |
| --- | --- |
| `cat_laptop_reel.mp4` | The finished reel |
| `cat_laptop.blend` | Full scene: room, owner, laptop, cat, 15 cameras, effects |
| `cute_cat.blend` | The reusable **CuteCat** (use this same cat in every reel) |
| `scripts/` | Everything that builds, renders and assembles the reel |
| `assets/` | CC0 assets (Poly Haven), font, voiceover, generated screen video + SFX cues |

## The CuteCat (`cute_cat.blend`)

Chibi orange tabby made only from primitives (quad-spheres, lofted rings, curves),
smooth shaded with Subdivision Surface:

* big round head with mochi cheeks, small chubby body, short legs, fluffy thick tail
* huge glossy green eyes: big black pupils + 2 white highlights each
* pink triangle nose, tiny "ω" mouth, pink inner ears, blush, white muzzle, chest, paws
* procedural tabby stripes (forehead "M", cheeks, back, legs, tail rings) + fine fur noise

**Rig `CatRig`**: `root, body, head, ear.L/R, eye.L/R, lid.L/R, mouth, mouth_w,
leg_f.L/R, leg_b.L/R, paw_*, tail.1-4`.

**Actions** (on muted NLA tracks, so they come along when you append the collection):
`walk_cycle`, `sit`, `look_around`, `tail_swish`, `blink`, `hiss`.

Extra controls:

* `CatRig["spiral_eyes"]` 0→1: rainbow hypno spiral eyes (spinning).
* `lid.L/R` bones: location Y = blink, location X = slit pupils, rotation Z = angry lids.

### Using the cat in a new reel

```python
with bpy.data.libraries.load("cute_cat.blend", link=False) as (src, dst):
    dst.collections = ["CuteCat"]
bpy.context.scene.collection.children.link(dst.collections[0])
```

Or from Python, `scripts/catlib.py` has the pose API used for this reel
(`walk_state`, `sit_state`, `hiss_state`, `blink_value`, `apply_state`, `key_state`).

## Rebuild / re-render

```bash
blender -b --python scripts/build_cat.py -- cute_cat.blend        # the cat asset
python3 scripts/make_screen.py assets/generated/screen.mp4         # laptop screen video
blender -b --python scripts/build_reel.py -- cat_laptop.blend      # scene + animation (+ events.json)
scripts/render_all.sh /path/to/render 2 721                        # EEVEE frames 1..721 (2 workers)
python scripts/make_audio.py assets/voiceover.mp3 assets/generated/events.json mix.wav
python3 scripts/make_video.py /path/to/render/frames mix.wav cat_laptop_reel.mp4
```

`make_audio.py` needs `numpy` + `scipy`; `make_video.py` needs Pillow and ffmpeg.

## Scenes (timed to the voiceover)

| Time | Shot |
| --- | --- |
| 0.0–2.6 s | Cozy living room, owner typing on the sofa, cat walks in on the wood floor/rug |
| 2.6–4.5 s | Owner close-up, annoyed look at the cat |
| 4.5–7.3 s | Cat close-up, eyes turn into colourful spinning spirals, slow zoom |
| 7.3–11.3 s | Thermal camera: blue room, laptop glowing orange/red with heat waves |
| 11.3–16.5 s | Black-and-white flashback: owner stares at the screen while the clock spins; cat meows, red "?" pops |
| 16.5–19.8 s | Laptop glows RED (enemy), cat glows GREEN (good), laptop shakes |
| 19.8–22.4 s | Cat jumps onto the keyboard, sits proudly, screen fills with "ffffff", slow happy blink |
| 22.4–25.0 s | Owner's hand reaches, quick cut to the worried face, cat hisses — freeze frame |

## Assets & credits (all CC0)

* [Poly Haven](https://polyhaven.com): HDRI *Suburban Garden*; textures *Wood Floor*,
  *Poly Wool Herringbone*, *Beige Wall 001*, *Painted Plaster Wall*, *Velour Velvet*,
  *Wood Table 001*, *Walnut Veneer*, *Cotton Jersey*, *Denim Fabric*; models *Shelf 01*,
  *ArmChair 01*, *Potted Plant 01/02/04*, *Ceramic Vase 01*, *Book Encyclopedia Set 01*,
  *Fancy Picture Frame 01*, *Hanging Picture Frame 02*, *Wall Clock*, *Industrial Wall Lamp*,
  *Modern Ceiling Lamp 01* (*Sofa 01* was tried; the green velvet sofa is modeled instead).
* Kenney's site was not reachable from the build machine, so the laptop, sofa, coffee
  table, side table, lamps, cat bed and the owner are built from primitives.
* Font: *Special Elite* (Google Fonts, Apache 2.0).
* Music and all sound effects are synthesized in code (`scripts/make_audio.py`).
