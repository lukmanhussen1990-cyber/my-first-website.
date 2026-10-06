# georender — offline preview renderer for Bedrock entity geometry

`tools/georender/georender.py` renders Minecraft Bedrock `.geo.json` models to
PNG (and contact sheets / GIFs) without the game, so models, textures,
overlays and animations can be checked from the command line. It is a
software rasteriser (numpy + Pillow, Python 3.13), importable as a module and
usable as a CLI.

* Geometry: legacy `1.8.0`/`1.10.0` (`"geometry.name"` keys,
  `"geometry.child:geometry.parent"` inheritance, `neverRender`, `reset`,
  `bind_pose_rotation`) and modern `1.12.0`/`1.16.0`/`1.19.30+`
  (`"minecraft:geometry": [...]`, per-cube `rotation`/`pivot`, per-face UV
  objects including negative `uv_size`), box UV with `mirror`, `inflate`.
  Comments and trailing commas in JSON are tolerated (Mojang's own files have
  them).
* Rendering: per-pixel z-buffer, nearest-neighbour texels, alpha test,
  emissive-alpha mask, colour-mask (sheep wool), alpha blend, culling or
  two-sided, Minecraft-style face shading, perspective or orthographic camera
  with auto-framing, supersampling, transparent or coloured background,
  optional ground grid, pivot markers and an axis gizmo.
* Several layers in one image (base mob + inflated overlay), all posed by the
  same animations (matched by bone name).
* Animations: Bedrock animation JSON (`1.8.0`/`1.10.0`), static values,
  keyframes (linear, `pre`/`post`, `catmullrom`), `anim_time_update`,
  `blend_weight`, `loop`, `override_previous_animation`, evaluated by a
  built-in Molang interpreter.
* `entity` mode: renders a client entity the way the game composes it: its
  render controllers (geometry, texture arrays, materials per bone pattern,
  `part_visibility`), `scripts.initialize`/`pre_animation`, `scripts.animate`
  and legacy `animation_controllers`. This is best effort; see
  [Limitations](#limitations).

Run the tests with `python3 tools/georender/test_georender.py`. That runs 38
unit tests, and the vanilla-reference ones are skipped when the reference is
not present.

---

## Quick start

```bash
GR=tools/georender/georender.py
REF=/tmp/claude-0/-home-user-my-first-website-/6f33ccbb-4073-57f5-b83c-87aab56fa441/scratchpad/ref/bedrock-samples-1.21.0.26/resource_pack

# one image (default view: iso = three-quarter front-right, perspective)
python3 $GR render $REF/models/entity/cow.geo.json -g geometry.cow.v1.8 \
    -t $REF/textures/entity/cow/cow -o /tmp/cow.png

# 6-view contact sheet with axis gizmo (front,right,back,left,top,iso)
python3 $GR views $REF/models/entity/cow.geo.json -g geometry.cow.v1.8 \
    -t $REF/textures/entity/cow/cow --axes -o /tmp/cow_views.png

# walk cycle: 8 frames over 1 s, side view, + GIF
python3 $GR anim $REF/models/entity/cow.geo.json -g geometry.cow.v1.8 \
    -t $REF/textures/entity/cow/cow --anim $REF/animations \
    --play animation.cow.setup --play "animation.quadruped.walk@q.modified_move_speed" \
    -q "modified_distance_moved=t*9.43" -q modified_move_speed=0.7 \
    --times 0:1:8 --view right --ortho --gif /tmp/cow_walk.gif -o /tmp/cow_walk.png

# base mob + our inflated overlay as a second layer (same pose)
python3 $GR views $REF/models/entity/cow.geo.json -g geometry.cow.v1.8 -t $REF/textures/entity/cow/cow \
    --layer addon/resource_pack/models/entity/pas_infected_cow_overlay.geo.json \
            addon/resource_pack/textures/entity/pas/infected_cow_overlay.png \
    -o /tmp/infected_cow.png

# a whole client entity as the game composes it (our pack first, vanilla as fallback)
python3 $GR entity pas:infected_cow --rp addon/resource_pack --rp $REF --views front,right,back,iso -v -o /tmp/ic.png
python3 $GR entity minecraft:villager_v2 --rp $REF -q variant=5 -q mark_variant=4 -q trade_tier=2 \
    --views front,iso -o /tmp/snowy_librarian.png
python3 $GR entity minecraft:cow --rp $REF -q "modified_distance_moved=t*9.43" -q modified_move_speed=0.7 \
    --times 0,0.25,0.5,0.75 -o /tmp/cow_walk_entity.png

# texture painting aid: every face's UV rect over the texture (E/N/W/S/U/D, marker = UV origin corner)
python3 $GR uvmap $REF/models/entity/cow.geo.json -g geometry.cow.v1.8 -t $REF/textures/entity/cow/cow -o /tmp/cow_uv.png

# bone tree, pivots, bind poses and bounds of every geometry in a file
python3 $GR info $REF/models/entity/chicken.geo.json

# the asymmetric orientation test model (writes .geo.json + texture + view sheets)
python3 $GR testcube /tmp/orient
```

Paths in these examples that start with `addon/...pas_...` are placeholders
for whatever the artists create.

### Common options (`render`, `views`, `anim`, `entity`)

| option | meaning |
|---|---|
| `-g ID` | geometry identifier (default: first in the file) |
| `-t TEX` | texture; the extension may be omitted, as in client entity files. Without it, faces get debug colours |
| `--flags F,...` | layer-0 flags: `material=NAME`, `cull`, `two_sided`, `emissive`, `colormask`, `blend`, `noalpha`, `faces` (debug face colours), `tint=rrggbb`, `hide=bone/bone` |
| `--layer GEO[#ID] [TEX] [FLAGS]` | extra layer (repeatable); `-` as TEX means no texture |
| `--lib PATH` / `--rp ROOT` | extra geometry files/dirs for inheritance parents / resource pack roots used to resolve textures, models, animations, render controllers and materials (repeatable, first wins) |
| `--anim PATH` `--play ID[@WEIGHT]` | animation files/dirs, and animations to apply in order. WEIGHT is a number or Molang (`@q.modified_move_speed`) |
| `-q name=value` / `--var name=value` | query / variable overrides. Values may be Molang in which bare `t` (or `time`) is the frame time, e.g. `-q modified_distance_moved=t*4` |
| `--time T` / `--times a,b,c` or `start:end:count` | frame time(s) in seconds |
| `--view NAME` | `front back right left top bottom iso iso_left iso_back iso_back_left` (`right` = looking at the **entity's** right flank) |
| `--yaw D --pitch D` | orbit camera: yaw 0 = in front of the face, +90 = entity's right flank, 180 = behind; pitch + = from above |
| `--ortho` `--fov` `--distance` `--zoom` `--target x,y,z` `--ppu N` | projection; `--ppu` = fixed pixels per model unit (ortho), for same-scale comparisons |
| `--size N or WxH` `--ss N` `--bg transparent or rrggbb` | output size, supersampling (default 2), background |
| `--ground` `--pivots` `--axes` `--noshade` `--label TEXT` | ground checker (1 block squares at y=0), bone pivot markers, geo-axis gizmo, flat shading |

Molang names that were missing and evaluated as 0 are reported on stderr
(`note: Molang names evaluated as 0 ...`), so you know which `-q`/`--var` to
set.

### Python API

```python
import sys; sys.path.insert(0, "tools/georender")
import georender as g

lib  = g.load_geometries("cow.geo.json")                  # GeometryLibrary (+ extra=[parent files])
cow  = g.Layer(lib.get("geometry.cow.v1.8"), g.load_texture("textures/entity/cow/cow", roots=[REF]))
ovl  = g.parse_layer_flags(g.Layer(g.load_geometries("overlay.geo.json").get(), g.load_texture("overlay.png")),
                           "material=entity_alphatest")
anims = g.load_animations(REF + "/animations")
plays = [g.Play(anims.get("animation.cow.setup")),
         g.Play(anims.get("animation.quadruped.walk"), "q.modified_move_speed")]
q = {"modified_distance_moved": "t*9.43", "modified_move_speed": 0.7}

img = g.render([cow, ovl], g.Camera.view("iso"), size=512, plays=plays, time=0.25, queries=q)
img.save("out.png")
frames = g.render_frames([cow, ovl], [0, .125, .25, .375], g.Camera.view("right", ortho=True), plays=plays, queries=q)
g.contact_sheet(frames, cols=4).save("sheet.png"); g.save_gif([im for _, im in frames], "walk.gif")
g.contact_sheet(g.render_views([cow])).save("views.png")
print(g.molang_eval("math.cos(q.anim_time * 38.17) * 80", anim_time=0.1))
```

`render(..., info={})` fills `info` with the framing, the posed bounds,
pivot pixel positions and the Molang names that were missing.

---

## CONVENTIONS

These are the facts the artists rely on. Everything here is implemented in
`georender.py` and covered by `test_georender.py`.

### Units and origin

* **16 model units = 1 block.** The model origin `(0,0,0)` is the entity's
  position: on the ground, horizontally centred. `+Y` is up.
* A vanilla adult cow is about 24 units long and 25 tall; a villager is about
  34.5 tall.

### Axes in a `.geo.json` file ("geo space")

```
            +Y (up)
             |
             |      -Z = the entity's FRONT  ("north" face; heads/faces point here)
             |     /
             |    /
 +X  <-------+-------->  -X
 entity's    |           entity's RIGHT side
 LEFT side   |           (vanilla "rightArm" pivot x=-5, "rightLeg" x=-1.9)
             |
            +Z = the entity's BACK ("south" face; tails point here)
```

* **Front = −Z, back = +Z, entity's right = −X, entity's left = +X.**
  Vanilla examples: the cow head is at z −14..−8, the humanoid `rightArm` is
  at x −8..−4, and spider `leg0` (a right-hand leg) reaches to x = −19.
* This is a mirror image of a right-handed system. Blockbench and georender
  display it un-mirrored by negating X (`x_view = −x_geo`). In the game, an
  entity with body yaw 0 faces world **south (+Z)**: geo −Z (front) becomes
  world +Z, and geo −X (its right) becomes world west (−X).
* All `pivot` and `origin` values are **absolute model-space coordinates**,
  never relative to the parent bone. A cube's `origin` is its minimum corner
  before rotation, and it extends by `size` toward +X/+Y/+Z. `inflate` grows
  the box in every direction but does not change its UV.
* A cube `rotation` without a cube `pivot` rotates around the **centre of the
  cube**. With a `pivot`, it rotates around that point. The schema doc says
  1.12 cube pivots are "flipped upside-down". georender does **not** flip
  them: vanilla 1.12.0 files with cube pivots (goat head, armadillo ears,
  breeze rods, strider bristles) only look right unflipped.

### Rotations (bone `rotation`, cube `rotation`, `bind_pose_rotation`, animation `rotation`)

Rotations are in degrees and are applied **X first, then Y, then Z**, about
the pivot. Signs, as seen on the entity:

| channel | positive value does | examples |
|---|---|---|
| **x** | pitches the bone's front (−Z) **down** (nod / look down). The lower end of a hanging limb swings **backward**; a negative value swings it **forward** | `query.target_x_rotation` > 0 = looking down; zombie arms `x = −90` point forward; cow body `bind_pose_rotation [90,0,0]` lays the upright body cube horizontal with the udder at the rear |
| **y** | turns the front toward the **entity's right** (−X), i.e. clockwise seen from above. The tip of a limb sticking out to the right swings **backward** | spider rear-right `leg0` `y = +45` points backward |
| **z** | rolls the top toward the **entity's left** (+X), i.e. clockwise seen from the front. The lower end of a hanging limb moves to the **entity's right** (outward for the right arm) | humanoid idle arm sway `rightArm z ≥ 0` moves it outward; spider legs `z = −45` on the right side bend the leg tips down |

As matrices: in geo coordinates, with standard right-handed rotation matrices,
`R = Rz(−rz) · Ry(+ry) · Rx(−rx)`. In Blockbench / render space
(`x' = −x`) the same rotation is `Rz(rz) · Ry(−ry) · Rx(−rx)`.

**Hierarchy.**
`world(bone) = world(parent) · T(pivot) · T(anim position) · R(rotation) · S(scale) · T(−pivot)`.
* A parent's rotation carries its children around the parent's pivot.
* Animation `position` offsets are in the parent's (rotated) frame, in model
  units. They are additive, and the x sign is the geo sign (−x = toward the
  entity's right).
* `scale` multiplies about the pivot.

**`bind_pose_rotation`** (legacy geometry) rotates **only that bone's own
cubes**. It is not inherited by child bones, and it is not part of the value
animations see as `this`. Evidence: the cow, pig and sheep bodies have
`bind_pose [90,0,0]` while their legs and heads are children that must stay
upright. Rabbit and parrot follow the same pattern.

**Animations add up.** Each frame, the skeleton starts at the geometry pose.
Then, for each animation in order, every channel axis is **added** (rotation,
position) or **multiplied** (scale), weighted by the blend weight. Molang
`this` is the channel's current value:
* rotation starts at the bone's geometry `rotation` (not `bind_pose_rotation`);
* scale starts at 1;
* **position starts at the bone's pivot minus its parent's pivot, with root
  bones measured from (0,24,0)**. This is the old Java joint offset.
  Evidence: `animation.ocelot_v1.0.setup` (8 bones), `animation.wolf.setup`,
  `animation.sheep.setup` and `animation.villager.general.v1.0` all write
  `"<that value> - this"` for the default pose, and
  `animation.guardian.spikes` vs `.spikes.v1.0` differ by exactly the parent
  pivot difference between the two guardian geometries.

So `"X - this"` sets a channel to an absolute X, and plain numbers are
offsets. **Recommendation for our own animations: use plain offsets for
`position` and avoid `this` there.** Use `--position-this zero` to see the
other interpretation.

### Box UV (`"uv": [u, v]`) — which strip goes where

For a cube of size `w × h × d` (x × y × z, floored to integers, as
Blockbench does), with `(u, v)` at the top-left:

```
          u      u+d      u+d+w    u+d+2w   u+2d+2w
   v      +-------+--------+--------+
          |       |   up   |  down  |
          |       | (top)  |(bottom)|
   v+d    +-------+--------+--------+--------+
          | east  | north  |  west  | south  |
          |entity |(FRONT) | entity | (BACK) |
          | RIGHT |        |  LEFT  |        |
   v+d+h  +-------+--------+--------+--------+
            d        w        d        w
```

How each face is laid on the cube (left/right as seen from **outside**,
texture top = up):

* **north (front)**: the texture's left edge is on the entity's right side.
  Faces read normally when you look at the mob.
* **east (entity's right flank)**: left edge = back, right edge = front.
* **west (entity's left flank)**: left edge = front, right edge = back.
* **south (back)**: the left edge is on the entity's left side.
* **up**: the strip's top edge is at the **back** and its bottom edge at the
  front. Its left edge is on the entity's right. Seen from above with the
  mob's head toward you, it reads normally.
* **down**: same as up: top edge at the back, left edge on the entity's
  right. Seen from below, it appears flipped front/back.
* **`mirror: true`** (cube or bone): every strip is flipped horizontally, and
  east and west swap strips. A mirrored left leg is the mirror image of the
  unmirrored right leg. This applies to box UV only.

`uvmap` draws these rects over a texture, with a marker on the texel that
lands on each face's UV-origin corner.

### Per-face UV (`"uv": {"north": {"uv": [u,v], "uv_size": [w,h]}, ...}`)

* Face names refer to the **entity**: `north` = front (−Z), `south` = back,
  **`east` = the entity's RIGHT side (−X in the file)**, `west` = its LEFT
  (+X), `up`, `down`.
* The schema text says "east … faces the x axis". That describes the engine's
  internal, X-mirrored space. Blockbench (whose per-face models creators check
  in-game) maps `east` to the −X side of the file, and so does georender.
  Faces missing from the object are not drawn.
* `north`/`south`/`east`/`west`: `uv` is the top-left corner as seen from
  outside, same orientation as box UV.
* `up`: `uv` is the back corner on the entity's right. `u` runs toward the
  entity's left and `v` toward the front, so it equals the box-UV up rect
  `uv:[u+d, v], uv_size:[w, d]`.
* `down`: `uv` is the front corner on the entity's right. `u` runs left and
  `v` runs back, so box-UV down = `uv:[u+d+w, v+d], uv_size:[w, −d]`.
  `test_box_uv_equals_explicit_per_face` checks both equivalences
  pixel-for-pixel.
* A **negative `uv_size`** spans `[uv+size, uv]` and flips that axis.
  `uv_rotation` is not in the 1.21.0 schema and is ignored with a warning.
* `uv_size` defaults to the face's box dimensions.

### Geometry details

* A missing `texturewidth`/`texture_width` means **64×64**. Legacy sheep, snow
  golem and villager geometries rely on this. UVs are in geometry texture
  units, so a 2× texture is sampled at 2× automatically.
* `"geometry.child:geometry.parent"` merges bones by (case-insensitive) name.
  The child's fields override the parent's, and the child's **cubes are
  appended** to the parent's. That is how the sheep keeps its face under the
  wool and the witch keeps the villager nose. `"reset": true` drops the
  inherited cubes, and new bones are added. A parent defined in another file
  needs `--lib`.
* `neverRender: true` hides that bone's own cubes only; its children still
  render.

### How this relates to Blockbench ("Bedrock Entity" format)

* Blockbench shows the model with X negated (`x_bb = −x_geo`). The model
  faces Blockbench's north (−Z), and the entity's right side is toward +X
  (east). Face names in the UV editor are the same as in the file
  (`east` = entity's right).
* On import/export, Blockbench negates the X and Y rotation angles and keeps
  Z, for bones, cubes and rotation keyframes. It negates X of position
  keyframes, pivots and origins.
* The result: **what Blockbench shows = what georender shows = what the game
  shows.** If you type numbers into the JSON by hand, use the sign table
  above. If you pose in Blockbench, its gizmo signs differ for X and Y
  rotation, but the exported file is correct.
* Use **Box UV** for vanilla-style mob textures. Internally, Blockbench keeps
  up/down face UVs rotated 180° relative to the file and swaps the corners on
  import/export. A box-UV cube converted to per-face is exported as up
  `uv [u+d, v] size [w, d]` and down `uv [u+d+w, v+d] size [w, −d]`, the
  equivalence above. georender reads per-face files exactly as Blockbench
  does.
* Blockbench ignores `bind_pose_rotation`. The game and georender apply it.

### Materials (layer flags)

| preset (`--flags material=NAME`) | alpha | culling | notes |
|---|---|---|---|
| `entity_alphatest` **(default)** | discard α < 0.5 | none (two-sided) | typical mob/overlay material |
| `entity_alphatest_one_sided` | discard α < 0.5 | back faces culled | |
| `entity` | ignored (opaque) | culled | transparent texels render as their RGB |
| `entity_nocull` | ignored | none | |
| `entity_alphablend` | blended | culled | no depth write |
| `entity_emissive_alpha` | α = glow mask, all opaque | culled | low α = full-bright (spider eyes; blaze and glow squid use α≈90) |
| `entity_change_color` | α = tint mask, all opaque | culled | `tint=rrggbb` colours α=255 texels (sheep wool); low-α texels keep their colour (sheep face) |

In `entity` mode, materials come from the render controller's `materials`
(bone patterns, later entries win). Names are resolved through the packs'
`materials/*.material` files (`"name:base"`; `+defines ALPHA_TEST` and
`+states DisableCulling` are honoured), then through a small vanilla table
(`spider` → emissive alpha, `sheep` → change colour, `chicken_legs` →
alphatest, …). Unknown names default to `entity_alphatest`. **The vanilla
`entity.material` file is not part of bedrock-samples, so this table is
knowledge-based, not verified against 1.21.0.26.** Vanilla mobs render as in
the game with it: chicken legs, sheep face, strider bristles and skeleton
ribs all appear correctly.

### Shading

Shading is fixed per face, like Minecraft, in model space: top 1.0, bottom
0.5, front/back 0.8, left/right 0.6 (blended by the normal for rotated
faces). It is a preview, not the game's lighting. Turn it off with
`--noshade`.

---

## How the conventions were verified

1. **Source of the sign conventions.** Blockbench's Bedrock codec and cube UV
   code (fetched from GitHub master for reference; nothing was copied). It
   shows the X mirror, negated X/Y rotations, the box-UV face list
   (`east, west, up(−w,−d), down(−w,+d), south, north`), mirror handling, the
   up/down per-face corner swap, and `CubeFace.UVToLocal` (which corner of
   each face gets which UV).
2. **Cross-checks against vanilla data that only works one way.**
   * Cow body `bind_pose [90,0,0]`: the udder ends up rear-bottom.
   * Spider `default_leg_pose`: rear legs point back, front legs point
     forward, all tips down.
   * Villager v2 hat brim (`bind_pose [−90,0,0]`) sits at hat height, not at
     the chin.
   * Zombie `x = −90` arms point forward.
   * Wolf, sheep and ocelot setup animations keep the expected layout with
     the position-`this` rule.
3. **Visual checks.** Renders were inspected for cow, pig, sheep (wool and
   face), chicken (`geometry.chicken.v1.12`), villager_v2 (base, plains,
   librarian/snowy, farmer), zombie, spider, wolf, parrot, ocelot, goat,
   armadillo, strider, frog, camel and breeze. All 115 renderable vanilla
   client entities were rendered on one sheet; most match the in-game look.
   * A few depend on game state that is not simulated (blaze rods
     mid-orbit, iron golem missing a render controller in the samples,
     magma cube scale 0 at rest, ender dragon).
   * The cow walk cycle was rendered at 8 times: diagonal leg pairs are in
     phase, vertical at a quarter period, reversed at half a period.
4. **Orientation test model.** `testcube` builds an asymmetric model: a
   lettered face on each side, an arm only on the right, a nose in front, a
   tail behind. It renders from 8 views (per-face and box UV). The unit tests
   check, pixel by pixel, which texel lands in which quadrant of every face
   for box UV, mirror, per-face, negative `uv_size`, and box UV ≡ per-face.

These are offline renders compared against vanilla data and the known
in-game look of vanilla mobs. **Nothing here was compared side by side with a
screenshot from 1.21.0.26.**

## Limitations

* `poly_mesh` and `texture_meshes` are not rendered (a warning is printed).
* `uv_rotation` and per-face `material_instance` are ignored. `mirror` only
  affects box UV.
* Animation:
  * `relative_to` (e.g. `look_at_target` relative to the entity) is ignored.
  * The ordered single-axis rotation list (`[{"y":…},{"x":…}]`, squid) is
    approximated by summing per axis.
  * `loop: false` holds the last frame.
  * The position-`this` rule above is derived from vanilla data, not from a
    spec.
* Molang:
  * The `->` arrow operator and `for_each` evaluate to 0.
  * `math.random*` uses a fixed seed.
  * Queries are 0 unless overridden. Defaults: `is_alive`, `is_on_ground`
    = 1, `health`/`max_health` = 20, `delta_time` = 1/20.
* `entity` mode:
  * Animation controllers settle on the state reached by following true
    transitions from `initial_state`; blend transitions are not simulated.
  * Multi-texture render controllers are alpha-composited (an approximation
    of the masked multitexture materials).
  * Render-controller `color`/`overlay_color`/`is_hurt` tints and
    `uv_anim` are ignored.
  * The material table is a best guess (see above).
* Lighting is a fixed preview shade. Glint, fog, emissive bloom and the
  hurt tint are not rendered.
* Mojang textures are referenced from the reference checkout, never copied.
  Do not commit renders that contain Mojang textures.
