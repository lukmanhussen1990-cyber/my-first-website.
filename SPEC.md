# Lost Island: Abandoned — Build Contract (Bedrock Beta 1.21.0.26)

**Every agent working on this project MUST follow this document exactly.**
It is the interface contract between parallel workstreams. Do not invent
identifiers, paths, or format versions that are not listed here. If you need a
new shared identifier, add it to this file in your own section only.

---

## 0. Hard version rules (Beta 1.21.0.26, Android)

Target engine: **1.21.0** (beta build .26, released May 2024).

### FORBIDDEN — do not use any of these
- **Script API (`@minecraft/server`) — completely banned.** No `scripts/`
  folder, no `script` module in the manifest. Every system is data-driven
  (functions + scoreboards + entity JSON). This removes all API-version risk.
- `minecraft:item` **`minecraft:icon` object-with-`textures` form** (1.21.40+).
  Use `"minecraft:icon": { "texture": "<short_name>" }`.
- Item components added after 1.21.0: `minecraft:custom_components`,
  `minecraft:rarity` (as a component), `minecraft:storage_item`,
  `minecraft:bundle_interaction`, `minecraft:dyeable`.
- Block components after 1.21.0: `minecraft:item_visual`,
  `minecraft:liquid_detection`, `minecraft:destruction_particles`,
  `minecraft:redstone_conductivity` (1.21.10+).
- Entity components after 1.21.0: `minecraft:body_rotation_blocked`,
  `minecraft:behavior.wither_random_attack_pos_goal` changes,
  `minecraft:transient`, `minecraft:behavior.random_sitting` (1.21.20+ additions).
- Commands not in 1.21.0: `/tickingarea` is fine, but NOT
  `/inputpermission camera` extras, NOT `/hud`, NOT `/dialogue` `on_open`
  extras, NOT `/execute if items` (that is 1.21.20+ — use `hasitem` selector),
  NOT `/damage ... entity_attack` with extra args, NOT `/place`,
  NOT `/random`, NOT `/scoreboard players operation` on non-existent fake
  players (must be initialised first).
- Java Edition anything: no `data merge`, no `/give item{nbt}`, no advancements,
  no datapacks, no Forge/Fabric, no `.mcfunction` Java syntax
  (`execute at @p run` is fine — it is also Bedrock syntax; but no
  `$(macro)` lines, no `#macro`, no `function ... with storage`).
- Java-only selectors: no `@a[nbt=...]`, no `[scores={x=1..}]` — Bedrock uses
  `[scores={x=1..}]`. That one IS valid Bedrock. Do NOT use `limit=`; Bedrock
  uses `c=`. Do NOT use `distance=`; Bedrock uses `r=`/`rm=`.

### Bedrock selector syntax reminders (1.21.0)
| Purpose | Bedrock | NOT (Java) |
|---|---|---|
| max count | `c=1` | `limit=1` |
| radius | `r=8`, `rm=2` | `distance=..8` |
| box | `x=,y=,z=,dx=,dy=,dz=` | same-ish, keep Bedrock form |
| name | `name="X"` | ok |
| has item | `hasitem={item=li:rope,quantity=1..}` | `nbt=` |
| scores | `scores={li_chapter=3}` | ok |
| tag | `tag=li_x`, `tag=!li_x` | ok |
| type | `type=li:stalker` | ok |

`/execute` MUST use the 1.19.50+ modern chained form:
`execute as @a at @s if score @s li_chapter matches 2 run <cmd>`
(no legacy `execute @a ~ ~ ~ <cmd>`).

### Format versions to use (do not deviate)
| Content | `format_version` |
|---|---|
| `manifest.json` | `2` (integer) |
| BP entity (`entities/*.json`) | `"1.20.60"` |
| BP item (`items/*.json`) | `"1.20.50"` |
| BP block (`blocks/*.json`) | `"1.20.50"` |
| BP spawn rules | `"1.8.0"` |
| BP recipes | `"1.20.10"` |
| BP loot tables | *(no format_version key)* |
| BP `functions/*.mcfunction` | plain text |
| BP `functions/tick.json` | `{"values":[...]}` (no format_version) |
| RP `entity/*.json` (client entity) | `"1.10.0"` |
| RP `models/entity/*.json` | `"1.12.0"` |
| RP `animations/*.json` | `"1.8.0"` |
| RP `animation_controllers/*.json` | `"1.10.0"` |
| RP `render_controllers/*.json` | `"1.0.0"` |
| RP `particles/*.json` | `"1.10.0"` |
| RP `sounds/sound_definitions.json` | `"1.14.0"` |
| RP `textures/*_texture.json` | *(no format_version; `resource_pack_name`, `texture_name`, `texture_data`)* |

`min_engine_version`: `[1, 21, 0]` in **both** manifests.

### Audio policy (IMPORTANT — no fabrication)
No OGG encoder exists in the build environment, so this add-on ships
**zero custom audio files**. All sound is delivered by referencing **vanilla
Bedrock sound events** from entity `minecraft:sound_effects`? — NO. Use these
two supported routes only:
1. Entity JSON `"minecraft:ambient_sound_interval"` + RP `sounds.json`
   `entity_sounds` mapping to **existing vanilla sound event names**.
2. `/playsound <vanilla_event> @a[r=..] x y z volume pitch` from functions.

Never add a `sound_definitions.json` entry that points at a `.ogg` file that
does not exist in the pack. Allowed vanilla events (verified to exist in
1.21.0): `ambient.cave`, `ambient.weather.thunder`, `ambient.weather.rain`,
`mob.wolf.growl`, `mob.wolf.bark`, `mob.wolf.hurt`, `mob.wolf.death`,
`mob.husk.ambient`, `mob.zombie.say`, `mob.zombie.hurt`, `mob.zombie.death`,
`mob.spider.say`, `mob.spider.death`, `mob.silverfish.say`,
`mob.silverfish.hurt`, `mob.enderman.idle`, `mob.enderman.portal`,
`mob.enderman.scream`, `mob.ravager.ambient`, `mob.ravager.roar`,
`mob.ravager.hurt`, `mob.ravager.death`, `mob.warden.heartbeat`,
`mob.villager.idle`, `mob.villager.hurt`, `mob.pig.say`, `mob.chicken.say`,
`mob.cow.say`, `mob.rabbit.hurt`, `random.click`, `random.pop`, `random.burp`,
`random.drink`, `random.eat`, `random.orb`, `random.levelup`, `random.anvil_use`,
`random.break`, `random.explode`, `random.fizz`, `random.glass`,
`random.bowhit`, `note.bass`, `note.harp`, `note.pling`, `beacon.activate`,
`beacon.deactivate`, `beacon.ambient`, `portal.portal`, `portal.travel`,
`fire.ignite`, `fire.fire`, `bucket.fill_water`, `bucket.empty_water`,
`item.trident.thunder`, `dig.stone`, `dig.wood`, `dig.gravel`, `dig.grass`,
`step.stone`, `use_attack.nodamage`, `open.iron_door`, `close.iron_door`,
`open.iron_trapdoor`, `tile.piston.out`, `tile.piston.in`,
`respawn_anchor.charge`, `conduit.activate`, `conduit.ambient`,
`elytra.loop`, `raid.horn`, `mob.warden.nearby_close`,
`mob.warden.listening`, `record.13`, `record.11`.

---

## 1. Namespace and pack layout

Namespace for **everything** custom: `li`.

```
build/Lost_Island_BP/   behaviour pack
build/Lost_Island_RP/   resource pack
tools/                  python generators (not shipped)
dist/Lost_Island_Abandoned.mcaddon
```

Manifest UUIDs (already fixed — never regenerate):
- BP header `f7c4be07-eacf-4986-996a-a6c552fbb7bd`, module `995df94e-15db-4f69-8132-f959aab065f7`
- RP header `b17e94ca-514b-4518-ad13-b3e8486a73a1`, module `e7290b05-801c-46fa-8b5d-e0a284253ef8`

---

## 2. World coordinate map (authoritative)

Island is built by a function-driven builder around origin `(0, *, 0)`.
Sea level **y = 62** (water surface 62, first land block 63).
Island footprint: **x −160..160, z −160..160** (321 × 321). Build volume
y = 30..140.

North = −z. South = +z. East = +x. West = −x.

| Region | Bounds | Notes |
|---|---|---|
| Southern Coast | z 90..160 | safe start, beaches, palms, camps |
| Central Forest | z 5..90 | dense forest, ruins, roads, village |
| Swamp | x −160..−55, z −25..60 | dark, foggy, huts |
| Mountains | x 45..160, z −85..5 | rock, caves, mine, dam |
| Northern Coast | z −160..−95, x 45..160 | harbour, military ruins |
| Forbidden Zone | x −160..40, z −160..−95 | lab, airstrip, bunker |

**Player spawn / wreck beach: `(6, 63, 138)`** (facing north).

Location coordinate table — **buildings agent owns these, must not move them**:

| # | Location | Anchor (x y z) |
|---|---|---|
| 1 | Wrecked boat + starter beach | 6 63 138 |
| 2 | Abandoned campfire camp (south) | −28 64 126 |
| 3 | Fishing shacks (south-west) | −86 64 118 |
| 4 | Ranger station | 62 66 96 |
| 5 | Abandoned village (centre-south) | −10 66 66 |
| 6 | Supermarket (village) | 8 66 58 |
| 7 | Gas station | 34 66 74 |
| 8 | Motel | −40 66 46 |
| 9 | Hospital | −18 67 26 |
| 10 | Police station | 6 67 20 |
| 11 | Fire station | 24 67 30 |
| 12 | Radio tower (hill) | 78 84 40 |
| 13 | Swamp huts | −112 63 20 |
| 14 | Campsites (forest) | 46 68 8 |
| 15 | Lighthouse (south-east point) | 132 66 112 |
| 16 | Destroyed bridge (river) | −52 64 −6 |
| 17 | Dam | 96 78 −30 |
| 18 | Abandoned mine entrance | 122 92 −54 |
| 19 | Harbour | 108 63 −124 |
| 20 | Shipwreck (offshore north) | 140 62 −150 |
| 21 | Military checkpoint | 52 70 −92 |
| 22 | Military camp | 84 72 −108 |
| 23 | Airstrip | −70 70 −118 |
| 24 | Research laboratory (surface) | −20 70 −132 |
| 25 | Underground bunker | −22 34 −132 |
| 26 | Secret research complex (deep) | −24 18 −140 |

---

## 3. Scoreboard objectives (create in `li_core/init`)

Objective names must be ≤ 16 chars.

| Objective | Holder | Range | Meaning |
|---|---|---|---|
| `li_sys` | fake players | — | system counters (`#tick`, `#sec`, `#build`, `#grp`, `#enc`, `#atmo`) |
| `li_chapter` | player | 0..8 | story chapter |
| `li_thirst` | player | 0..1200 | thirst points; 1200 = full. Display band computed from this |
| `li_temp` | player | −100..100 | 0 = comfortable |
| `li_exh` | player | 0..100 | exhaustion |
| `li_bat` | player | 0..100 | flashlight charge (percent) |
| `li_flag` | player | bitless | generic per-player counter for one-shot logic |
| `li_esc` | player | 0..6 | escape components collected |
| `li_obj` | player | 0..99 | sub-objective index within chapter |
| `li_tmp` | player | — | scratch |

Tags (per player): `li_init`, `li_torch_on`, `li_indoors`, `li_night`,
`li_ch1_done`… `li_ch8_done`, `li_note_<n>` (note read), `li_loc_<n>`
(location discovered), `li_built` (island built by this player).

---

## 4. Tick architecture (mobile-critical)

`functions/tick.json` contains exactly **one** entry: `li_core/tick`.

`li_core/tick.mcfunction` is at most 4 commands:
```
scoreboard players add #tick li_sys 1
execute if score #tick li_sys matches 10.. run function li_core/half_sec
execute if score #build li_sys matches 1.. run function li_build/dispatch
```
`li_core/half_sec` resets `#tick` to 0, increments `#sec`, and fans out to
subsystems on a **modulo schedule** so no subsystem runs more than it needs:

| Subsystem | Period | Function |
|---|---|---|
| player join/init | 1 s | `li_core/players` |
| item-use detection | 0.5 s | `li_items/detect` |
| objectives / zones | 1 s (5 rotating groups) | `li_story/zones_<g>` |
| thirst tick | 6 s | `li_surv/thirst` |
| temperature | 3 s | `li_surv/temp` |
| exhaustion | 2 s | `li_surv/exh` |
| HUD actionbar | 1 s | `li_surv/hud` |
| flashlight | 1 s | `li_items/flashlight` |
| night/atmosphere | 5 s | `li_atmo/tick` |
| encounters | 10 s | `li_mobs/encounters` |

**Hard performance rules**
- No command may use a radius larger than `r=48`.
- Never use `@e` without a `type=` filter.
- Every `@e[type=...]` scan must be bounded by `c=` or `r=`.
- Encounter spawner must check a global entity budget before summoning:
  max 6 hostile custom mobs alive per player.
- No particle commands on a period faster than 5 s, and never `r>24`.
- No `fill` larger than 32768 blocks (Bedrock hard limit), builder steps
  ≤ 200 commands each.

---

## 5. Custom items (namespace `li`) — items agent owns

Activation pattern (**the only supported no-script route**):
every usable item has
```json
"minecraft:food": { "nutrition": 0, "saturation_modifier": "poor",
                    "can_always_eat": true, "using_converts_to": "li:<x>_used" }
"minecraft:use_modifiers": { "use_duration": 0.8, "movement_modifier": 0.35 }
```
and a companion marker item `li:<x>_used` (hidden from creative,
`max_stack_size` 1). `li_items/detect` finds holders with
`@a[hasitem={item=li:<x>_used}]`, runs the effect function, then
`clear @s li:<x>_used`.

| Identifier | Display name | Icon (short name) | Behaviour |
|---|---|---|---|
| `li:clean_water` | Clean Water | `li_clean_water` | +thirst 400, sound `random.drink` |
| `li:dirty_water` | Dirty Water | `li_dirty_water` | +thirst 250, 45 % poison 6 s / nausea |
| `li:boiled_water` | Purified Water | `li_boiled_water` | +thirst 600 |
| `li:canned_beans` | Canned Beans | `li_canned_beans` | food 6, +thirst 40 |
| `li:canned_meat` | Canned Meat | `li_canned_meat` | food 8, +thirst 20 |
| `li:bandage` | Bandage | `li_bandage` | heal 4 hp, clear poison |
| `li:first_aid` | First Aid Kit | `li_first_aid` | heal 12 hp, regen 8 s, clear poison/wither |
| `li:cloth` | Cloth | `li_cloth` | crafting only (no food component) |
| `li:rope` | Rope | `li_rope` | crafting only |
| `li:scrap` | Scrap Metal | `li_scrap` | crafting only |
| `li:battery` | Battery | `li_battery` | +40 flashlight charge |
| `li:flashlight_off` | Flashlight | `li_flashlight_off` | toggle → `li:flashlight_on` |
| `li:flashlight_on` | Flashlight (On) | `li_flashlight_on` | night-vision while held, drains `li_bat` |
| `li:crowbar` | Crowbar | `li_crowbar` | tool, opens barricades (see story) |
| `li:keycard` | Research Keycard | `li_keycard` | opens lab door zone |
| `li:bunker_key` | Bunker Key | `li_bunker_key` | opens bunker |
| `li:radio_part` | Radio Component | `li_radio_part` | escape component 1 |
| `li:fuel_can` | Fuel Can | `li_fuel_can` | escape component 3 |
| `li:mech_part` | Mechanical Component | `li_mech_part` | escape component 4 |
| `li:nav_gear` | Navigation Equipment | `li_nav_gear` | escape component 5 |
| `li:flare` | Emergency Flare | `li_flare` | throwable-by-use: light + sound + scares mobs |
| `li:documents` | Research Documents | `li_documents` | reads a story page (rotating) |
| `li:matches` | Matches | `li_matches` | lights a campfire block under player |
| `li:setup_tool` | Lost Island — Start Kit | `li_setup_tool` | builds island + starts Chapter 1 |
| `li:debug_tool` | Lost Island — Debug Wand | `li_debug_tool` | dev menu (chapter skip, refill) |

Creative menu: `"menu_category": { "category": "items", "group": "itemGroup.name.miscFood" }`
for consumables, `"category": "equipment"` for tools/keys, `"category": "items"`
for materials. Marker `*_used` items: `"category": "none"`.

## 6. Custom blocks (`li:` — blocks agent owns)
`li:warning_sign_quarantine`, `li:warning_sign_keepout`,
`li:warning_sign_handwritten`, `li:notice_board`, `li:rusted_metal`,
`li:damaged_concrete`, `li:mossy_concrete`, `li:emergency_light`
(`minecraft:light_emission: 9`), `li:lab_panel`, `li:lab_vent`.
All are plain full cubes (omit `minecraft:geometry`), `material_instances`
with `"render_method": "opaque"`, `"minecraft:destructible_by_mining": {"seconds_to_destroy": 1.5}`,
`"minecraft:map_color"`. Textures registered in
`RP/textures/terrain_texture.json`.

## 7. Custom entities (`li:` — entities agent owns)

| Identifier | HP | Attack | Spawn | Notes |
|---|---|---|---|---|
| `li:feral_survivor` | 24 | 4 | forest/village, any light | primitive weapon look, ranged-less melee |
| `li:island_stalker` | 18 | 5 | night only, dark | fast (0.32), avoids light |
| `li:cave_crawler` | 14 | 3 | y<50 caves | fast in caves, climbs |
| `li:watcher` | 30 | 0 | very rare, event-only | flees when player within 10 blocks, despawns |
| `li:alpha_stalker` | 60 | 8 | Forbidden Zone only | boss-ish, slower but tanky |
| `li:island_boar` | 10 | 2 | forest, day | passive/neutral wildlife, drops raw porkchop |
| `li:island_bird` | 4 | 0 | coast, day | ambience, flees |

All hostiles: `minecraft:despawn` with `min_range_inclusive` so they clean up;
`minecraft:physics`, `minecraft:collision_box` small; no `minecraft:navigation.walk`
`can_path_over_water: true` unless needed. Every entity needs
`"is_summonable": true`, `"is_spawnable": true` (spawn eggs for creative),
`"is_experimental": false`.
Loot table path convention `loot_tables/entities/<name>.json`.
Spawn egg colours defined in RP `entity/*.json` via
`"spawn_egg": { "base_colour": "#RRGGBB", "overlay_colour": "#RRGGBB" }`.

## 8. Loot tables (loot agent owns)
```
loot_tables/entities/<entity>.json
loot_tables/chests/common_house.json
loot_tables/chests/supermarket.json
loot_tables/chests/medical.json
loot_tables/chests/police.json
loot_tables/chests/military.json
loot_tables/chests/research.json
loot_tables/chests/survivor_stash.json
loot_tables/chests/empty.json            (genuinely empty — required by design)
loot_tables/chests/mine.json
loot_tables/chests/harbour.json
```
Chest placement in builder functions uses
`loot replace block <x> <y> <z> slot.container 0 loot "chests/<name>"`
**AFTER** the chest block is set. (Bedrock command:
`/loot replace block <pos> slot.container <slot> <count?> loot <table>` —
supported since 1.18.10.)

## 9. Story / functions naming (story agent owns)
```
functions/li_core/…      init, tick, half_sec, players, player_init, reset
functions/li_build/…     dispatch, group_*, step_*  (generated — do not hand-edit)
functions/li_surv/…      thirst, temp, exh, hud, drink_*, effects
functions/li_items/…     detect, use_*, flashlight
functions/li_story/…     chapter_1..8, zones_0..4, note_*, objective, escape_*
functions/li_mobs/…      encounters, spawn_*, night_pressure
functions/li_atmo/…      tick, night_start, night_end, storm
functions/li_dev/…       debug_*, giveall
```
Chapter advance always via `function li_story/chapter_<n>` which:
1. sets `li_chapter`, 2. `titleraw` the chapter card, 3. `tellraw` the
objective, 4. `playsound random.levelup @s`.

## 10. Text style
- Chapter card: `titleraw @s title {"rawtext":[{"text":"§eCHAPTER <n>"}]}`
  + subtitle chapter name.
- Objective line: `tellraw @s {"rawtext":[{"text":"§6▸ OBJECTIVE §f<text>"}]}`
- Note/journal: `§7§o` italic grey, prefixed `§8[§7torn page§8]§r`.
- HUD actionbar: `titleraw @s actionbar` single line combining thirst/temp/
  battery, e.g. `§bWater §f▮▮▮▮▯  §cTemp §fCold  §eTorch §f62%`.

## 11. Validation gate
`tools/validate.py` must pass with zero errors before packaging. It checks:
JSON parse, UUID uniqueness, manifest schema, min_engine_version, texture path
existence, entity/item/loot/spawn-rule cross-references, function references,
banned-feature grep, command whitelist, fill volume limits, and packaging shape.
