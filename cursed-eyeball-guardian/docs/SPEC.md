# Cursed Floating Eyeball Guardian — Build Contract (SPEC)

This file is the single source of truth that every generator, pack file and
script must agree on. If you change an identifier here, change it everywhere.

Target: **Minecraft Bedrock 1.21.0.26 (Preview/Beta), Android, Mali-G57.**
Must also keep working on later 1.21.x releases.

Reference material (read-only, in the session scratchpad `ref/` folder):
- `ref/samples/` – Mojang `bedrock-samples` at tag `v1.21.0.26-preview` (vanilla RP JSON:
  entity, render_controllers, animations, animation_controllers, particles, models,
  sounds.json, sound_definitions.json, item_texture.json, attachables).
- `ref/samples/metadata/script_modules/@minecraft/server_1.10.0.json`,
  `server-ui_1.1.0.json` – **authoritative** script API surface for this build.
- `ref/samples/metadata/json_schemas/*` – item component schemas (1.20.50–1.20.80).
- `ref/samples/metadata/command_modules/mojang-commands.json` – command syntax.
- `ref/samples/metadata/vanilladata_modules/*` – vanilla entity/item/effect ids.
- `ref/vanilla_bp/`, `ref/vanilla_bp_1.21.0/` – vanilla behavior pack (entities,
  items, recipes, loot tables) from the 1.21.0.26 dedicated server.

## 0. Repo layout

```
cursed-eyeball-guardian/
  README.md                       install + usage guide (player facing)
  docs/SPEC.md                    this file
  packs/
    Cursed_Eyeball_Guardian_BP/   behavior pack (source of truth, committed)
    Cursed_Eyeball_Guardian_RP/   resource pack (source of truth, committed)
  tools/                          python/node generators + build + validation
  tests/                          type-check + node simulation harness
  dist/Cursed_Eyeball_Guardian.mcaddon   built artifact (committed)
```

Generated assets (PNG, OGG, geo/animation JSON) are produced by scripts in
`tools/` **and** committed into `packs/` so the repo is usable without Python.

## 1. Packs / manifests

| Pack | header uuid | module uuid(s) | name |
|---|---|---|---|
| BP | `7908374d-1c7b-4aa2-af5f-76aa33c217ed` | data `2b095ec2-2e53-4327-a4b9-571a94f1d331`, script `e836fbfe-b5f4-4ec2-86a9-d1edc1b0127e` | `Cursed Eyeball Guardian BP` |
| RP | `60958aba-15ae-4c05-8ff4-398050736e62` | resources `e4e61f1a-164c-427a-8cf1-1d6bde7d7c0d` | `Cursed Eyeball Guardian RP` |

- `format_version: 2`, `version: [1, 0, 0]` everywhere, `min_engine_version: [1, 21, 0]`.
- BP depends on RP (uuid + version) and on script modules
  `@minecraft/server` **`1.10.0`** and `@minecraft/server-ui` **`1.1.0`**
  (these are the *stable* versions in 1.21.0.26; 1.11.0/1.2.0 were rc/beta then —
  do NOT use them; no experiments required).
- Script module: `"type": "script", "language": "javascript", "entry": "scripts/main.js"`.
- RP depends on BP (uuid + version).
- Both packs: `pack_icon.png` (256×256), `texts/en_US.lang`, `texts/languages.json` (`["en_US"]`).
- Pack names/descriptions are given in lang via `pack.name` / `pack.description`
  keys; the manifest uses `"name": "pack.name", "description": "pack.description"`.

## 2. Namespace & identifiers

Namespace: **`ceg`**.

| Thing | Identifier | English name |
|---|---|---|
| Entity | `ceg:eyeball_guardian` | Cursed Floating Eyeball Guardian |
| Summoning item | `ceg:eyeball_summoner` | Cursed Summoning Eye |
| Upgrade item | `ceg:eyeball_upgrade` | Eyeball Upgrade Core |
| Ability control item | `ceg:eyeball_controller` | Eyeball Ability Controller |

Lang keys (RP `texts/en_US.lang`):
```
entity.ceg:eyeball_guardian.name=Cursed Floating Eyeball Guardian
item.spawn_egg.entity.ceg:eyeball_guardian.name=Spawn Cursed Eyeball Guardian
item.ceg:eyeball_summoner.name=Cursed Summoning Eye
item.ceg:eyeball_upgrade.name=Eyeball Upgrade Core
item.ceg:eyeball_controller.name=Eyeball Ability Controller
```

## 3. Entity (behavior side) — `BP/entities/eyeball_guardian.json`

`format_version: "1.21.0"` (fall back to `1.20.80` only if a component needs it),
`is_spawnable: true`, `is_summonable: true`, `is_experimental: false`.

### 3.1 Entity properties (`description.properties`, all `client_sync: true`)
| Property | Type | Range/values | Default | Meaning |
|---|---|---|---|---|
| `ceg:rage` | bool | – | false | rage visuals (brighter eye, faster spin, more particles) |
| `ceg:skin` | int | [0, 3] | 0 | 0 crimson, 1 void (purple), 2 frost (blue), 3 toxic (green) |
| `ceg:level` | int | [1, 5] | 1 | upgrade level (visual size + extra spikes) |
| `ceg:mode` | int | [0, 4] | 0 | 0 follow, 1 attack, 2 shield, 3 destroy, 4 passive |

Script sets them with `entity.setProperty(...)` (exists in server 1.10.0).

### 3.2 Component groups & events
- Groups `ceg:lvl_1` … `ceg:lvl_5`: each contains ONLY `minecraft:health`
  `{ "value": H, "max": H }` with H = 40, 55, 70, 85, 100.
  **Health lives only in these groups** (base components have no health).
- Group `ceg:despawn`: `minecraft:instant_despawn: {}`.
- Events:
  - `minecraft:entity_spawned` → add `ceg:lvl_1`.
  - `ceg:set_level_1` … `ceg:set_level_5` → remove the other 4 level groups,
    add `ceg:lvl_N`, `set_property` `ceg:level` = N.
  - `ceg:despawn` → add `ceg:despawn`.
  - `ceg:rage_on` / `ceg:rage_off` → `set_property ceg:rage` true/false (fallback path).
- Script calls `triggerEvent('ceg:set_level_N')` for levels and
  `triggerEvent('ceg:despawn')` to remove a guardian (then `entity.remove()` as fallback).

### 3.3 Base components (required)
- `minecraft:type_family`: `["ceg_guardian", "eyeball", "mob"]` (NOT `monster`, NOT `player`).
- `minecraft:collision_box`: width 0.9, height 1.0 (model eye centre sits at 0.5 blocks).
- `minecraft:physics`: `{ "has_gravity": false, "has_collision": true }`.
- `minecraft:movement` 0.3, `minecraft:flying_speed` 0.3, `minecraft:can_fly` {}.
- **No AI goals, no navigation, no `minecraft:movement.*` move-control** — the script
  moves the entity every tick with `clearVelocity()` + `applyImpulse()` and turns it
  with `setRotation()`. Do not add look_at / follow / random_stroll goals.
- `minecraft:knockback_resistance` 1.0, `minecraft:pushable`
  `{is_pushable:false, is_pushable_by_piston:true}`.
- `minecraft:persistent` {}, `minecraft:fire_immune` {}, `minecraft:nameable`
  `{always_show:false, allow_name_tag_renaming:true}`.
- `minecraft:breathable` that never suffocates/drowns (`breathes_water: true`,
  `breathes_air: true`, `suffocate_time: 0`, `total_supply: 15`).
- `minecraft:damage_sensor` triggers:
  - no damage from family `player` (owner can't accidentally hurt it),
  - no damage from causes `fall`, `suffocation`, `drowning`, `fire`, `fire_tick`,
    `lava`, `magma`, `fly_into_wall`, `freezing`, `contact`,
  - `entity_explosion` and `block_explosion` with `damage_multiplier: 0.5`.
- `minecraft:ambient_sound_interval` `{ value: 7, range: 10, event_name: "ambient" }`.
- `minecraft:loot` → `loot_tables/entities/eyeball_guardian.json`.
- `minecraft:conditional_bandwidth_optimization` {}.

### 3.4 Loot table `BP/loot_tables/entities/eyeball_guardian.json`
Drops on death: 2–5 `minecraft:redstone`, 50 % `minecraft:spider_eye`,
10 % `minecraft:ender_pearl`.

## 4. Items (behavior side) — `BP/items/*.json`

`format_version: "1.20.80"`. Components limited to ones that exist in the 1.20.50/
1.20.80 item schemas under `ref/samples/metadata/json_schemas` (check `Icon v1.20.60.json`
for the icon shape). `menu_category: { "category": "equipment" }`.

| File | id | icon key | stack | extras |
|---|---|---|---|---|
| `eyeball_summoner.json` | `ceg:eyeball_summoner` | `ceg_eyeball_summoner` | 1 | glint |
| `eyeball_upgrade.json` | `ceg:eyeball_upgrade` | `ceg_eyeball_upgrade` | 16 | glint |
| `eyeball_controller.json` | `ceg:eyeball_controller` | `ceg_eyeball_controller` | 1 | hand_equipped |

No custom-component / experimental item features. Names come from RP lang.

## 5. Recipes — `BP/recipes/*.json` (`format_version: "1.20.10"`, `tags: ["crafting_table"]`)

- Summoning Eye (shaped): `["RSR","SES","RGR"]` — R `minecraft:redstone`,
  S `minecraft:spider_eye`, E `minecraft:ender_pearl`, G `minecraft:gold_ingot`.
- Upgrade Core (shaped): `[" D ","RER"," D "]` — D `minecraft:diamond`,
  R `minecraft:redstone_block`, E `minecraft:ender_eye`.
- Ability Controller (shaped): `[" RE"," SR","S  "]` — R `minecraft:redstone`,
  E `minecraft:spider_eye`, S `minecraft:stick`.
Recipe identifiers: `ceg:eyeball_summoner`, `ceg:eyeball_upgrade`, `ceg:eyeball_controller`.

## 6. Geometry & textures (resource side)

- Geometry id `geometry.ceg.eyeball_guardian`, `format_version: "1.12.0"`,
  `texture_width: 64`, `texture_height: 64` (UV units). **PNG files are 128×128**
  (2× HD pixel art; UVs are normalised so this just doubles detail).
- Per-face UV mapping (planar projection per direction) so faces share texture regions.
- Model origin = entity feet. **Eye centre at (0, 8, 0)** in model pixels. Eye front = **−Z**.
- Sclera: voxel sphere of diameter 14 built from ~9 overlapping boxes.
- Iris: rounded disc ≈10 px wide protruding ≈0.5 px in front of the sclera; pupil 4×4
  in front of the iris. Glowing red iris + black pupil.
- Spikes: dark obsidian-like shards with glowing red tips radiating around the eye
  (ring around the edge tilted backwards + back cluster), never covering the iris.
- Bedrock rotation convention (verified from vanilla cow geometry): a **positive X
  rotation tilts +Y toward −Z (forward)**; use negative X to tilt spikes backwards.
  Use nested bones: parent rotates about Z (direction around the ring), child tilts about X.

Required bone names (animations depend on them):
`root` (pivot 0,8,0) → `eye` (look-at rotation) → children `sclera`, `iris` → `pupil`,
`spikes` (spin group, pivot 0,8,0) → `spike_00…spike_NN` (+ `_t` tilt child each),
`spikes_extra` (visible only when level ≥ 3). Locators on `eye`: `center` [0,8,0], `lens` [0,8,-8.5].

Entity textures (`RP/textures/entity/ceg/`), skin names in index order
`crimson, void, frost, toxic`:
- `eyeball_guardian_<skin>.png` – base (lit) layer.
- `eyeball_guardian_<skin>_glow.png` – emissive overlay (iris, veins, spike tips,
  cracks; everything else alpha 0).
- `eyeball_guardian_<skin>_rage.png` – brighter emissive overlay used while `ceg:rage`.

Skin colours (0–1 RGB) — shared by textures, particles (script passes them) and UI:
| idx | skin | primary | dark | hot |
|---|---|---|---|---|
| 0 | crimson | (1.00, 0.08, 0.08) | (0.45, 0.00, 0.02) | (1.00, 0.75, 0.65) |
| 1 | void | (0.72, 0.20, 1.00) | (0.30, 0.00, 0.50) | (0.95, 0.80, 1.00) |
| 2 | frost | (0.15, 0.60, 1.00) | (0.00, 0.22, 0.55) | (0.80, 0.95, 1.00) |
| 3 | toxic | (0.25, 1.00, 0.30) | (0.00, 0.40, 0.08) | (0.85, 1.00, 0.70) |

## 7. Client entity — `RP/entity/eyeball_guardian.entity.json`

- `format_version: "1.10.0"`, identifier `ceg:eyeball_guardian`.
- Render controllers: base lit layer (`controller.render.ceg.eyeball_guardian`),
  emissive glow layer with `ignore_lighting: true` (warden bioluminescent pattern), glow
  texture swaps to the rage texture when `query.property('ceg:rage')`.
  Texture arrays indexed by `query.property('ceg:skin')`.
- Visual scale: `0.85 + 0.05 * query.property('ceg:level')`.
- Animations (`RP/animations/eyeball_guardian.animation.json`), ids:
  - `animation.ceg.eyeball_guardian.float` (loop: bob + sway),
  - `animation.ceg.eyeball_guardian.look` (loop: `eye` rotation from `query.target_x_rotation` / `query.target_y_rotation`),
  - `animation.ceg.eyeball_guardian.spikes` (loop: tentacle wiggle, phase offset per spike),
  - `animation.ceg.eyeball_guardian.spin` (loop: slow spin of `spikes`, much faster in rage),
  - `animation.ceg.eyeball_guardian.iris` (loop: iris pulse, pupil dilation; slit pupil in rage),
  - `animation.ceg.eyeball_guardian.summon` (0.8 s, scale-in + spin; plays while `query.life_time < 0.8`),
  - `animation.ceg.eyeball_guardian.attack` (0.4 s recoil + iris flash; **played from script**
    via `entity.playAnimation('animation.ceg.eyeball_guardian.attack')`).
- Client animation controller `controller.animation.ceg.eyeball_guardian.fx`:
  default state emits bound looping particle `aura` at locator `center`; `rage` state
  (when `query.property('ceg:rage')`) emits `rage_aura` as well.
  `pre_effect_script: "variable.skin = query.property('ceg:skin');"` so bound particles can tint.
- `particle_effects`: `aura` → `ceg:aura`, `rage_aura` → `ceg:rage_aura`.
- `spawn_egg`: base colour `#E8E2DC`, overlay `#B3000C`.

## 8. Particles — `RP/particles/*.json` (`format_version: "1.10.0"`)

Single atlas `RP/textures/particle/ceg_particles.png` — 64×64 px, 4×4 grid of 16×16
cells (`texture_width/height: 64` in UVs):

| cell (col,row) | sprite |
|---|---|
| (0,0) | soft round glow (white centre, alpha falloff) |
| (1,0) | 4-point spark / star |
| (2,0) | thin ring |
| (3,0) | pixel heart |
| (0,1) | voxel cube shard (with shading) |
| (1,1) | dark smoke puff |
| (2,1) | rune circle (summon) |
| (3,1) | small square energy pixel |
| others | free |

Sprites are **white/greyscale** so tint controls colour.

Script-spawned particles get a `MolangVariableMap` with
`setColorRGB('variable.color', {red, green, blue})` → particles tint with
`variable.color.r/.g/.b`. Entity-bound particles tint from `variable.skin` (0–3).

| id | spawned by | description |
|---|---|---|
| `ceg:aura` | entity (looping, local space) | ~6/s glowing pixels/cubes drifting off the eye |
| `ceg:rage_aura` | entity (looping) | dense fiery sparks + dark smoke while raging |
| `ceg:laser_segment` | script, many points along the beam | glowing orb, ~0.25 s life |
| `ceg:laser_charge` | script at eye | particles converging into the lens, 0.3 s |
| `ceg:impact` | script at hit point | explosion-like burst: flash + sparks + ring + shards |
| `ceg:rage_burst` | script at eye | big burst when rage starts |
| `ceg:shield_dome` | script at owner centre (+1 y) | sphere-surface particles r≈1.4, 1 s life |
| `ceg:shield_hit` | script at owner | bright flash ring when shield absorbs a hit |
| `ceg:heal` | script at owner | rising hearts + sparkles |
| `ceg:teleport` | script at old & new position | dark-red swirl implosion |
| `ceg:summon` | script at spawn point | rune circle + rising column |
| `ceg:block_break` | script per destroyed block | red voxel shards scatter |
| `ceg:level_up` | script at eye | rising spiral |

All script particles must render sensibly with the colour map supplied; keep
`emitter_rate_instant` counts ≤ 40 and lifetimes ≤ 1.5 s (mobile budget).

## 9. Sounds — `RP/sounds/ceg/*.ogg` (Ogg Vorbis, mono, 44.1 kHz)

`RP/sounds/sound_definitions.json` (`format_version: "1.20.20"` or the vanilla 1.21
format), category `neutral` (UI ones `ui`), ids:

| id | files | use |
|---|---|---|
| `ceg.guardian.ambient` | ambient_1..3 | entity ambient (whispers / wet heartbeat / drone) |
| `ceg.guardian.hurt` | hurt_1..2 | entity hurt |
| `ceg.guardian.death` | death | entity death |
| `ceg.guardian.summon` | summon | summoned |
| `ceg.guardian.laser` | laser_1..2 | laser fire (charge whine + zap) |
| `ceg.guardian.impact` | impact | laser hit / explosion-like |
| `ceg.guardian.rage` | rage | rage starts (distorted screech) |
| `ceg.guardian.teleport` | teleport | teleport whoosh |
| `ceg.guardian.shield` | shield | shield pulse/activate |
| `ceg.guardian.shield_hit` | shield_hit | shield absorbs hit |
| `ceg.guardian.heal` | heal | eerie healing chime |
| `ceg.guardian.destroy` | destroy | block-destroy blast |
| `ceg.guardian.levelup` | levelup | upgrade |
| `ceg.guardian.mode` | mode | mode switch blip |
| `ceg.guardian.menu` | menu | menu open |

`RP/sounds.json` → `entity_sounds.entities["ceg:eyeball_guardian"]` events
`ambient`, `hurt`, `death` → the ids above.

## 10. Item / UI textures

- `RP/textures/items/ceg/eyeball_summoner.png`, `eyeball_upgrade.png`,
  `eyeball_controller.png` — 32×32 px pixel art; `RP/textures/item_texture.json`
  keys `ceg_eyeball_summoner`, `ceg_eyeball_upgrade`, `ceg_eyeball_controller`
  (`resource_pack_name` "ceg", `texture_name` "atlas.items").
- UI button icons `RP/textures/ceg/ui/<name>.png` (32×32): `follow`, `attack`, `shield`,
  `destroy`, `passive`, `teleport`, `night_vision`, `heal`, `look`, `status`, `fire`,
  `dismiss`, `summon`. Referenced from script as `textures/ceg/ui/<name>` (no extension).

## 11. Script contract (`BP/scripts/`)

Modules: `@minecraft/server` 1.10.0 and `@minecraft/server-ui` 1.1.0 **only** —
every API call must exist in `ref/samples/metadata/script_modules/@minecraft/server_1.10.0.json`
(notably: no `Dimension.playSound` → use `world.playSound`/`player.playSound`; no
`Block.setType` → use `dimension.runCommand('setblock x y z air destroy')`;
`Entity.isValid()` is a method; `applyKnockback(dirX, dirZ, horizontal, vertical)`;
no `Player.selectedSlot`; no tameable API).

Persistence:
- Player dynamic property `ceg:data` = JSON
  `{active, level, skin, mode, nv, heal, token, deadUntil, kills}`.
- Guardian dynamic properties `ceg:owner` (player id) and `ceg:token` (number).
  A guardian whose token ≠ its owner's current token, or whose owner is offline,
  is despawned when found (handles chunk reloads / duplicates).

Behaviour summary (details in script):
- Movement: hover at owner's right shoulder (+right 1.4, +up 1.9, bobbing); velocity
  steering each tick; obstacle avoidance via free-spot search; stuck detection;
  teleport when > 24 blocks or in another dimension (respawn in new dimension).
- Modes 0–4 as in §3.1. Follow: defends + attacks hostiles within 10 blocks.
  Attack: hunts hostiles within 20 blocks (leash 18). Shield: hovers above head,
  resistance II refresh + dome particles + 25 % damage refund. Destroy: like follow
  plus block breaking on command. Passive: never attacks.
- Hostiles = family `monster` except types `minecraft:enderman`,
  `minecraft:zombie_pigman`, `minecraft:piglin`, `minecraft:warden` (these only when
  they hurt the owner). Never target owner, players (unless they hurt the owner or
  are commanded), tamed mobs, other guardians.
- Laser stats by level 1–5: damage 6/8/10/12/15, cooldown ticks 30/26/22/18/14,
  range 16–20, knockback (0.6 h, 0.25 v). Rage (10 s after owner is hurt): damage ×1.5,
  cooldown ×0.5, speed ×1.6, 2.5-block splash at 50 %.
- Healing when owner ≤ 40 % hp: regeneration II 6 s + 4 hp; cooldown 30 s − 4 s·(level−1).
- Night vision: refresh every 100 ticks (420-tick duration, no particles) while enabled.
- Destroy: radius by level 0,plus,3³,3³,sphere r2; never break bedrock, barrier,
  command/structure/jigsaw blocks, end portal (frame), portals, end gateway,
  reinforced deepslate, light/border/allow/deny blocks; uses `setblock … destroy`.
- Items: summoner tap = summon or recall (sneak+tap = dismiss); upgrade tap = level up
  (consumes 1 via `clear @s ceg:eyeball_upgrade 0 1`); controller tap = ability menu,
  sneak+tap = command shot at what you look at (block in Destroy mode, entity otherwise).
- UI (`ActionFormData`): Follow / Attack / Shield / Destroy / Passive mode buttons,
  Teleport To Me, Night Vision toggle, Auto-Heal toggle, Change Look, Status,
  Fire Destroy Laser (destroy mode), Dismiss. Retry on `UserBusy`.
- `/scriptevent` commands (source must be a player): `ceg:menu`, `ceg:summon`,
  `ceg:recall`, `ceg:dismiss`, `ceg:mode <follow|attack|shield|destroy|passive>`,
  `ceg:level <1-5>`, `ceg:skin <0-3>`, `ceg:fire`, `ceg:status`.
