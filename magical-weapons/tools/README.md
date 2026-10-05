# Tools

Everything in `behavior_pack/` and `resource_pack/` is generated from the Python in `tools/gen/` (standard library
only, Python 3.8+), except the hand-written scripts in `behavior_pack/scripts/`. The Node.js tools are optional
developer aids; you don't need them to rebuild the add-on.

```sh
python3 tools/build_assets.py   # weapons -> models, textures, animations, items, recipes, manifests, icons
python3 tools/build_addon.py    # run the checks, then zip into MagicalWeapons.mcaddon (deterministic)
```

## Layout

| Path | What it is |
| --- | --- |
| `gen/weapons/<id>.py` | One file per weapon: `build()` returns the 3D model, `SPEC` holds stats, recipe, poses and choreography. |
| `gen/modelkit.py`, `gen/parts.py`, `gen/pngkit.py` | Model/UV/texture authoring (box models, texture atlas packer, procedural painters) and a tiny PNG writer. |
| `gen/anim.py` | Key poses + easing → dense linear keyframes. |
| `gen/kinematics.py` | Player-skeleton hand kinematics: camera-space weapon poses → exact `root` bone tracks. |
| `gen/emit.py` | JSON emitters: manifests, items, recipes, attachables, animations, render controllers. |
| `gen/icons.py`, `gen/packicon.py` | 16×16 inventory icons and the pack icon. |
| `build_assets.py`, `build_addon.py` | The two build steps. |
| `validate.py` | Dependency-free checks, run by `build_addon.py` (JSON, manifests, cross references, UVs, Molang allow-list). |
| `test/` | Script-logic tests against an in-memory mock of `@minecraft/server`. Node 18+, no npm packages. |
| `typecheck/` | Type-check of the scripts against the exact typings of this build. |
| `deep_validate.mjs` | Stricter validation against Mojang's own data for this build. |
| `preview/` | Software renderer that produces the images in `docs/previews/`. |

`build_addon.py` always runs `validate.py`. If Node is installed it also runs the script tests, and the type-check
and deep validator when their setup below is done; what's missing is reported as *skipped*. Any failure stops the
build before the `.mcaddon` is touched.

### A weapon's `SPEC`

| Key | Meaning |
| --- | --- |
| `id`, `name`, `title` | Item id (`mw:<id>`), plain name, and the coloured display name (`§` codes). |
| `damage`, `durability`, `enchant`, `repair` | Melee damage, max durability, enchantability, anvil repair items. |
| `cooldown`, `cast_len` | Cooldown in **seconds**; length of the cast animation in seconds. |
| `hold` | Idle pose per view: `[pitch, lean, roll, (right, up, forward)]`, degrees and pixels, in camera space. |
| `flicker`, `spin` | Glowing parts that pulse (`(bone, hz, amp, phase)`) or rotate (`(bone, axis, deg/s, phase)`). |
| `fp_swing`, `fp_cast` | First-person choreography: lists of `Pose(t, pitch, lean, roll, off, ease)`. |
| `tp_swing`, `tp_cast` | Third-person choreography: per-bone `Key(t, rot, pos, ease)` deltas on top of the vanilla arm. |
| `recipe`, `icon` | Shaped recipe, and a function that paints the inventory icon. |

The spell behaviour lives in `behavior_pack/scripts/abilities.js` (`WEAPONS` table: delay, durability wear, spell,
passive). `delay` is the tick of the animation's strike frame, so spell and swing land together.

## How the animation works

* **Binding.** Each weapon is an attachable whose root bone is bound with `q.item_slot_to_bone_name(c.item_slot)`.
  Models are built upright (+Y tip, −Z front edge, X = flat faces) with the grip centre on the pivot `(0, 24, 0)`.
* **Swing clock.** `pre_animation` copies the holder's swing progress with `c.owning_entity->v.attack_time` (a
  technique documented by the community, e.g. the
  [mcblend attachables tutorial](https://mcblend.readthedocs.io/en/v9.4.0.1/attachables_and_1st_person_animations/);
  it isn't in Mojang's own docs). The swing animations use it as `anim_time_update`, so they follow the real
  swing speed.
* **Cast clock.** Tapping fires `itemUse`/`itemUseOn`; the script calls `ItemCooldownComponent.startCooldown`, and the
  attachable derives `v.mw_cast_t = cooldown − q.cooldown_time_remaining(...)`. Both documented forms of the query
  (cooldown category and equipment slot) are combined with `math.max`.
* **First person** is choreographed in camera space with `Pose` keys. `kinematics.solve_track` converts every
  frame into an absolute `root` position/rotation that cancels the vanilla arm motion (`override_previous_animation`).
  **Third person** keys the weapon bone relative to the vanilla swinging arm.
* **Glow.** A second render controller (`controller.render.mw_glow`) draws bones named `glow*` with
  `ignore_lighting`; the solid controller hides them.
* **Conventions** (calibrated against vanilla items): a bone's Euler angles `(x, y, z)` map to
  `Rz(−z)·Ry(y)·Rx(−x)`; file space is the X-mirror of the world; a bound bone's world transform is
  `Hand · T(−6, 15, 1) · T(0, −24, 0) · L_bone`, where `(−6, 15, 1)` is the item locator pivot of the player
  geometry.
* **Stable API only.** The scripts use only `@minecraft/server` 1.11.0 (declared in the manifest), so no Beta APIs
  experiment is needed. Sounds use `Dimension.runCommand('playsound …')`.

## Checks

| Check | Command | Needs |
| --- | --- | --- |
| Basic validation (always run by the build) | `python3 tools/validate.py` | Python only |
| Script logic: all seven spells, passives, walls, cooldowns, durability, tap on ground (81 checks) | `node tools/test/run.mjs` | Node 18+ |
| Type-check against the typings of this build | `cd tools/typecheck && npm install && npx tsc -p tsconfig.json` | Node, npm |
| Deep validation (below) | `BEDROCK_SAMPLES=… node tools/deep_validate.mjs` | `npm install` in `tools/`, bedrock-samples |

`typecheck/` pins `@minecraft/server` **1.11.0-rc.1.21.0-preview.26**, the stable module for this preview build, so
using a member that only exists in the beta module (for example `Player.spawnParticle`) is a type error. Don't loosen
the version range: `^` would pull the newest typings and the check would stop meaning anything.

`deep_validate.mjs` needs a checkout of Mojang's samples at the matching tag:

```sh
git clone --depth 1 --branch v1.21.0.26-preview https://github.com/Mojang/bedrock-samples
cd tools && npm install
BEDROCK_SAMPLES=/path/to/bedrock-samples node deep_validate.mjs
```

It parses every Molang expression and checks queries and math functions against the engine docs, validates item
components against Mojang's JSON schemas, checks recipe ingredients and sound/particle ids against vanilla data, and
verifies that scripts only import names, events and `world`/`system` members that exist in the 1.11.0 module metadata.

Not covered by any tool: how it looks and feels on a real device.

## Previews

`preview/` re-implements enough of Bedrock (player skeleton, attachable binding, Molang evaluation, animation clocks)
in three.js to render the weapons from the actual pack files, headless. It was calibrated against vanilla items
such as the trident and is meant for iterating on poses without launching the game. It is not the game.

```sh
cd tools && npm install                       # three, molang, playwright-core, ajv
export BEDROCK_SAMPLES=/path/to/bedrock-samples   # vanilla player model and animations
python3 tools/preview/make_previews.py        # writes docs/previews/*.png (about 30 s)
python3 tools/preview/make_previews.py frostbite --out /tmp/p   # one weapon, elsewhere
```

It needs a Chromium that Playwright can launch (`CHROMIUM_PATH` overrides the lookup in `PLAYWRIGHT_BROWSERS_PATH`
and `~/.cache/ms-playwright`). Rendering uses software GL, so no GPU is required. The `molang` package mishandles
`!` on booleans, which the viewer works around; the game itself is unaffected.
