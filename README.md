# Minecraft Bedrock Addons (Pocket Edition friendly)

Five standalone addons for Minecraft Bedrock Edition, built for **Android and
iOS** (they work on Windows, console and Realms too). Install any one of them, or
all five — they share no files and never conflict.

| Addon | Download | What it is |
| --- | --- | --- |
| **Natural Disasters** | `NaturalDisasters.mcaddon` | Tornadoes, earthquakes, meteors, tsunamis, wildfires and lightning storms, with a Disaster Wand and a Disaster Detector |
| **Parasite** | `Parasite.mcaddon` | A creature that eats everything around it the moment it spawns — items, mobs, players and the blocks themselves — then grows and splits in two |
| **Legendary Weapons** | `LegendaryWeapons.mcaddon` | Six weapons with real abilities: call lightning, freeze the battlefield, fire explosive bolts, blink through enemies, slam the ground, open a black hole |
| **Kaiju Rampage** | `KaijuRampage.mcaddon` | An 11 block tall Godzilla-style monster that levels terrain and buildings just by walking, stomps craters, sweeps its tail, roars and fires an atomic breath |
| **Extreme Blizzard** | `ExtremeBlizzard.mcaddon` | A killing winter. Outside freezes you to death in about 5 seconds — the only safe place is a sealed room with a fire in it |

All five require **Minecraft Bedrock 1.21.0 or newer** and need **no
experimental toggles**.

## Using the items on a phone

Touch controls treat a quick tap as an *attack*, not a *use*. To trigger any item
in these addons:

- **Tap and hold** the screen for a moment while holding the item, **or**
- point at the ground/a block and tap it (that always counts as a use), **or**
- with **"Auto-Jump"/classic touch**, press and hold on the world, not on the
  hotbar.

Every item here uses a 2 second use duration so the press registers reliably; the
ability fires the instant you press, so you do not have to hold it down.

If an item still does nothing, run `/scriptevent wm:help` (or `nd:help`,
`pm:help`, `kj:help`, `sw:help`) in chat — the same actions are available as commands, and
`/scriptevent wm:use thunder_blade` fires an ability directly so you can tell a
control problem apart from a pack problem.

---

# Part 1 — Natural Disasters

Tornadoes, earthquakes, meteors, tsunamis, wildfires and lightning storms for
Minecraft Bedrock Edition, built for **Android and iOS** (works on Windows,
console and Realms too).

- **Disaster Wand** — tap to open a touch menu and start any disaster
- **Disaster Detector** — hold it to see what is coming, from where, and in how long
- **Random disasters** — they also happen on their own while you play, with warnings
- Custom items, entities, models, animations, particles, sounds and UI icons

Requires **Minecraft Bedrock 1.21.0 or newer**. No experimental toggles needed —
the Script API modules used here (`@minecraft/server` 1.11.0 and
`@minecraft/server-ui` 1.1.0) are stable releases.

---

## 1. Install on a phone (the short version)

1. Download **`NaturalDisasters.mcaddon`** from this repository
   ([direct link](NaturalDisasters.mcaddon)) onto your phone.
2. Open the file (tap it in your Downloads / Files app).
   - **Android:** Files → Downloads → tap `NaturalDisasters.mcaddon` → *Open with
     Minecraft*.
   - **iOS:** Files → Downloads → tap the file → *Share* → *Copy to Minecraft*.
3. Minecraft opens and shows **"Importing…"**, then **"Successfully imported
   Natural Disasters"**.
4. Create or edit a world → **Behavior Packs** → **Natural Disasters (Behavior)**
   → *Activate*.
   The resource pack is pulled in automatically because the behavior pack
   depends on it. If you want to check, look under **Resource Packs** — *Natural
   Disasters (Resources)* should be active.
5. In the world settings, make sure **Cheats / Experiments** are left as they
   are — nothing needs to be switched on.
6. Play. Craft the wand (see below) or, in creative, find both items in the
   **Equipment** tab of the inventory.

If the file does not open in Minecraft, rename it so it ends in exactly
`.mcaddon` (some browsers save it as `.zip`), then tap it again.

### Building the `.mcaddon` yourself

```bash
python3 tools/generate_textures.py            # optional, regenerates every PNG
python3 tools/build_mcaddon.py                # validates the JSON, writes both .mcaddon files
python3 tools/build_mcaddon.py natural_disasters   # just this one
node    tools/test_scripts.mjs                # optional, runs the scripts against a fake world
```

To install manually instead, copy `natural_disasters_BP` into
`games/com.mojang/behavior_packs/` and `natural_disasters_RP` into
`games/com.mojang/resource_packs/` on the device.

---

## 2. How to play

### Getting the items

| Item | Recipe (crafting table) |
| --- | --- |
| **Disaster Wand** | Nether star on top, blaze rod in the middle, stick at the bottom (single column) |
| **Disaster Detector** | Clock in the centre, redstone in the 4 edge slots, iron ingots in the 4 corners |

In creative both items are in the **Equipment** tab. Or run
`/scriptevent nd:give` to get both.

### Disaster Wand

Hold the wand and **tap and hold the screen** (right‑click on a keyboard) to open
the menu:

- one button per disaster — it starts about 18 blocks in front of you, in the
  direction you are looking
- **Surprise Me** — a random one
- **Stop All Disasters** — stops everything and cleans up
- **Settings** — random events on/off, how often, block damage, player damage,
  warning times

### Disaster Detector

Hold it and watch the action bar above your hotbar:

| Readout | Meaning |
| --- | --- |
| `✔ All clear · next event in ~7m 20s` | nothing running |
| `⚠ Incoming: Meteor 38s North-East (74m)` | a disaster is being prepared — beeps get faster as it approaches |
| `⚠ Tornado 41m South-West` | a disaster is running right now, with live distance and direction |

Tapping with the detector opens a summary screen with a button to bring the next
random event forward.

### The six disasters

| Disaster | What it does |
| --- | --- |
| **Tornado** | A funnel wanders across the ground, sucks in mobs, players and dropped items, spirals them upwards and rips light blocks out of the ground. ~70 seconds. |
| **Earthquake** | Shakes everyone's screen, tears fissures through the ground, crumbles blocks off buildings and hurts anything standing on it. ~22 seconds. |
| **Meteor** | A burning rock plus a shower of four smaller ones fall from the sky and explode on impact, leaving fire and magma in the crater. |
| **Tsunami** | A 29 block wide, 6 block tall wall of water rolls 70 blocks across the landscape, carrying everything with it — then drains away completely. |
| **Wildfire** | Fire races outwards from a starting point far faster than vanilla fire, up to a 30 block radius, and sets mobs alight. ~75 seconds. |
| **Lightning Storm** | The sky turns to thunder and bolts hammer a 30 block area every half second, some of them hunting the players. ~45 seconds. |

### Commands (optional, for command blocks and admins)

```
/scriptevent nd:start <disaster> [x y z]   start one (tornado, earthquake, meteor,
                                           tsunami, wildfire, lightning_storm)
/scriptevent nd:stop                       stop everything and clean up
/scriptevent nd:status                     what is running
/scriptevent nd:next                       time until the next random event
/scriptevent nd:soon [seconds]             bring the next event forward
/scriptevent nd:random on|off              turn random disasters on or off
/scriptevent nd:give                       give yourself the wand and the detector
/scriptevent nd:settings                   open the settings screen
/scriptevent nd:help                       print all of this in chat
```

---

## 3. Folder structure

```
NaturalDisasters.mcaddon          <- the installable file (BP + RP zipped together)
package.json                      <- dev scripts only, not part of the addon
README.md

natural_disasters_BP/             BEHAVIOR PACK
├── manifest.json                 header + data module + script module + RP dependency
├── pack_icon.png
├── entities/
│   ├── tornado.json              nd:tornado       (funnel marker entity)
│   ├── meteor.json               nd:meteor        (falling rock entity)
│   └── tsunami_wave.json         nd:tsunami_wave  (wave crest entity)
├── items/
│   ├── disaster_wand.json        nd:disaster_wand
│   └── disaster_detector.json    nd:disaster_detector
├── recipes/
│   ├── disaster_wand.json
│   └── disaster_detector.json
├── scripts/                      Minecraft Script API (@minecraft/server 1.11.0)
│   ├── main.js                   entry point: events, item taps, /scriptevent
│   ├── config.js                 settings (saved in the world) + tuning values
│   ├── util.js                   safe wrappers around every world API call
│   ├── sounds.js                 custom + vanilla sound ids
│   ├── registry.js               master tick loop for running disasters
│   ├── scheduler.js              random disasters and their warnings
│   ├── detector.js               Disaster Detector readout
│   ├── ui.js                     Disaster Wand menus (@minecraft/server-ui)
│   └── disasters/
│       ├── index.js              the list of disasters
│       ├── tornado.js
│       ├── earthquake.js
│       ├── meteor.js
│       ├── tsunami.js
│       ├── wildfire.js
│       └── lightning_storm.js
└── texts/
    ├── en_US.lang                item names, entity names, pack name
    └── languages.json

natural_disasters_RP/             RESOURCE PACK
├── manifest.json
├── pack_icon.png
├── entity/                       client entity definitions
│   ├── tornado.entity.json
│   ├── meteor.entity.json
│   └── tsunami_wave.entity.json
├── models/entity/                geometry
│   ├── tornado.geo.json          8 segment funnel
│   ├── meteor.geo.json           lumpy rock + flame shell
│   └── tsunami_wave.geo.json     wall + crest + foam
├── animations/
│   ├── tornado.animation.json    spin, sway, spawn
│   ├── meteor.animation.json     tumble, spawn
│   └── tsunami_wave.animation.json  roll, spawn
├── animation_controllers/
│   ├── tornado.animation_controllers.json
│   ├── meteor.animation_controllers.json
│   └── tsunami_wave.animation_controllers.json
├── render_controllers/
│   └── natural_disasters.render_controllers.json
├── particles/
│   ├── tornado_debris.particle.json     nd:tornado_debris
│   ├── tornado_core.particle.json       nd:tornado_core
│   ├── earthquake_dust.particle.json    nd:earth_dust
│   ├── meteor_trail.particle.json       nd:meteor_trail
│   ├── tsunami_spray.particle.json      nd:water_spray
│   ├── wildfire_ember.particle.json     nd:fire_ember
│   └── storm_spark.particle.json        nd:storm_spark
├── sounds/
│   ├── sound_definitions.json    17 custom sound events
│   └── natural_disasters/        drop your own .ogg files here (see its README)
├── textures/
│   ├── item_texture.json
│   ├── items/                    nd_disaster_wand.png, nd_disaster_detector.png
│   ├── entity/natural_disasters/ tornado.png, meteor.png, wave.png
│   ├── particle/                 nd_debris, nd_core, nd_dust, nd_ember, nd_spray, nd_spark
│   └── ui/                       9 menu button icons
└── texts/
    ├── en_US.lang
    └── languages.json

tools/                            development helpers (never shipped in the addon)
├── generate_textures.py          draws every PNG from scratch
├── build_mcaddon.py              validates JSON + UUIDs, writes the .mcaddon
└── test_scripts.mjs              runs the scripts against a fake world
```

### UUIDs

| Pack | Part | UUID |
| --- | --- | --- |
| BP | header | `81dbb53a-3ec8-435c-83b1-b69d8ac983c4` |
| BP | data module | `c56b45f3-318c-44cb-a82b-f5238ee99a79` |
| BP | script module | `9b11154a-2fdf-4a42-bd69-bb9c3bff5b3d` |
| RP | header | `43c1cc2b-7bd7-43a6-acd6-8ded1a8dbc1b` |
| RP | resources module | `bae57f92-4453-4721-8ae6-2f1325d2f41e` |

The behavior pack lists the resource pack header UUID as a dependency, so
activating the behavior pack turns the resource pack on automatically.
**If you publish your own version, generate fresh UUIDs** (`python3 -c "import
uuid; print(uuid.uuid4())"`) — two addons must never share a UUID.

---

## 4. Notes for phones

- Block edits are capped at 120 per tick and disasters are capped at 3 at once,
  so nothing runs away on older devices. Both limits are in
  `natural_disasters_BP/scripts/config.js` (`TUNING`).
- Chests, furnaces, beds, spawners, command blocks, portals and bedrock are never
  destroyed — see `TUNING.protectedBlocks`.
- The tsunami removes every block of water it placed, so worlds are not left
  flooded.
- Turn off **"Disasters may break blocks"** in the wand settings to play with the
  visuals and physics but no terrain damage at all.
- Every disaster plays a custom sound id **and** a vanilla one, so the addon is
  audible even before you add your own audio. Drop `.ogg` files into
  `natural_disasters_RP/sounds/natural_disasters/` (names are listed in that
  folder's README) to replace them with your own.

## 5. Adding your own disaster

1. Copy `natural_disasters_BP/scripts/disasters/wildfire.js` to a new file.
2. Change `key`, `name`, `color`, `description`, `warning` and rewrite `create()`
   — it returns `{ getLocation(), tick(age), stop() }` and `tick` returns `true`
   when the disaster is over.
3. Add it to `natural_disasters_BP/scripts/disasters/index.js`.
4. Optionally add tuning values to `TUNING` in `config.js` and an icon in
   `natural_disasters_RP/textures/ui/`.

Everything else — the wand menu, the detector, the random scheduler and the
`/scriptevent` commands — picks it up automatically.

---

# Part 2 — Parasite

A single creature that treats the world as food. **The moment a parasite exists
— spawn egg, `/summon`, a cave spawn, the Parasite Sample or a split — it starts
eating everything within reach.** For the first three seconds it feeds in a
frenzy, which is why a fresh spawn strips its surroundings almost instantly.

Install `Parasite.mcaddon` exactly the same way as the disasters addon (section
1 above): tap the file, then activate **Parasite (Behavior)** in your world. The
resource pack follows automatically.

## What it eats, in this order

1. **Dropped items and XP orbs** in range — swallowed whole
2. **Anything alive that is not a parasite** — players, animals, villagers, other
   monsters; it bites on top of its normal melee attack
3. **The blocks around it** — it burrows a crater into whatever it is standing
   on and leaves **Infested Flesh** behind

Everything it eats becomes *biomass*, and biomass makes it grow:

| Stage | Reached at | Size | Health | Damage | Feeding radius |
| --- | --- | --- | --- | --- | --- |
| Small | spawn | 0.65× | 20 | 4 | 3.0 blocks |
| Large | 45 biomass | 1.0× | 44 | 7 | 4.5 blocks |
| **Apex** | 110 biomass | 1.7× | 90 | 12 | 6.5 blocks |

An **Apex Parasite** splits off a new parasite every 25 seconds while it keeps
feeding, until the population cap is reached. It is also fire immune and barely
flinches when hit.

It hunts everything within 26 blocks, climbs walls, swims, and never despawns.

## Safety rails (all adjustable in game)

- **Population cap** — 25 parasites per world by default. Anything spawned past
  the cap is removed immediately.
- **Never eaten** — bedrock, barriers, command blocks, portals, spawners,
  reinforced deepslate, water and lava.
- **Chests, furnaces, hoppers, beacons and shulker boxes are protected too**,
  unless you turn on "They may eat chests and furnaces".
- **Purge** — one button, or `/scriptevent pm:purge`, removes every parasite in
  the world.
- Turn off "Parasites eat blocks" to keep the monster but save your terrain.

## The Parasite Sample

Craft it with 8 glass around a spider eye and a rotten flesh
(spider eye top middle, rotten flesh centre, glass everywhere else), or run
`/scriptevent pm:give`. In creative it is in the **Equipment** tab. It is a
reusable tool — using it does not consume it.

- **Tap** → releases one parasite 5 blocks in front of you
- **Sneak + tap** → opens the menu: Release One, Release a Swarm (5), Purge
  Nearby (32 blocks), Purge Everything, Settings

A spawn egg is also available in the creative inventory.

While a parasite is within 18 blocks, your action bar shows how close it is:

```
Parasite 11m · it is feeding
APEX PARASITE 6m · it is feeding
```

## Commands

```
/scriptevent pm:spawn [count]     release parasites in front of you (max 20)
/scriptevent pm:purge             kill every parasite in the world
/scriptevent pm:purge near        kill the ones within 32 blocks
/scriptevent pm:status            population report by stage
/scriptevent pm:cap <number>      set the population cap
/scriptevent pm:eat on|off        block eating on or off
/scriptevent pm:breed on|off      growing and splitting on or off
/scriptevent pm:give              give yourself a Parasite Sample
/scriptevent pm:settings          open the settings screen
/scriptevent pm:help              print this in chat
```

## Folder structure

```
Parasite.mcaddon                  <- the installable file

parasite_BP/                      BEHAVIOR PACK
├── manifest.json
├── pack_icon.png
├── blocks/
│   └── infested_flesh.json       pm:infested_flesh (custom block)
├── entities/
│   └── parasite.json             pm:parasite, 3 growth stages as component groups
├── items/
│   └── parasite_sample.json      pm:parasite_sample
├── loot_tables/
│   ├── blocks/infested_flesh.json
│   └── entities/parasite.json
├── recipes/
│   └── parasite_sample.json
├── spawn_rules/
│   └── parasite.json             rare natural spawns underground (weight 3)
├── scripts/
│   ├── main.js                   events, item taps, /scriptevent, proximity warning
│   ├── config.js                 settings + tuning + protected block lists
│   ├── util.js                   safe wrappers around every world API call
│   ├── sounds.js                 custom + vanilla sound ids
│   ├── swarm.js                  feeding, growth, splitting, population cap
│   └── ui.js                     Parasite Sample menus
└── texts/
    ├── en_US.lang
    └── languages.json

parasite_RP/                      RESOURCE PACK
├── manifest.json
├── pack_icon.png
├── blocks.json                   block sound mapping
├── entity/
│   └── parasite.entity.json      3 textures selected by growth stage
├── models/entity/
│   └── parasite.geo.json         body, spiked back, jaws, mandibles, tail, 6 legs
├── animations/
│   └── parasite.animation.json   idle, walk, chew (jaws never stop moving)
├── animation_controllers/
│   └── parasite.animation_controllers.json
├── render_controllers/
│   └── parasite.render_controllers.json
├── particles/
│   ├── parasite_spore.particle.json   pm:parasite_spore
│   ├── parasite_feed.particle.json    pm:parasite_feed
│   └── parasite_gore.particle.json    pm:parasite_gore
├── sounds/
│   ├── sound_definitions.json    9 custom sound events
│   └── parasite/                 drop your own .ogg files here (see its README)
├── textures/
│   ├── item_texture.json
│   ├── terrain_texture.json
│   ├── items/pm_parasite_sample.png
│   ├── blocks/pm_infested_flesh.png
│   ├── entity/parasite/          parasite_small.png, parasite_large.png, parasite_apex.png
│   ├── particle/                 pm_spore.png, pm_bit.png, pm_gore.png
│   └── ui/                       5 menu button icons
└── texts/
    ├── en_US.lang
    └── languages.json
```

### UUIDs

| Pack | Part | UUID |
| --- | --- | --- |
| BP | header | `26085580-7dea-4df7-83b8-0675b59717f6` |
| BP | data module | `17c6d235-1914-498d-a0a9-85b730d1d179` |
| BP | script module | `7d80ac0c-0e46-4271-9204-dcd7c8bd5061` |
| RP | header | `d21c3359-6d33-4643-afe1-7204b29b1491` |
| RP | resources module | `506acdfa-d4c1-4704-89c5-e36c856cc040` |

## Tuning it

`parasite_BP/scripts/config.js` holds everything:

- `SETTINGS_DEFAULTS` — what the in-game menu changes (eating, breeding, cap,
  bite rate, flesh trail)
- `TUNING.radius` / `TUNING.growth` / `TUNING.splitCost` — how fast it grows and
  multiplies
- `TUNING.protectedBlocks` / `TUNING.containerBlocks` — what it may never eat
- `TUNING.tickInterval` — how often the swarm loop runs (5 ticks; raise it to 10
  on very old phones)

To stop parasites appearing naturally in caves, delete
`parasite_BP/spawn_rules/parasite.json` and rebuild.

---

# Development

```bash
python3 tools/generate_textures.py            # Natural Disasters PNGs
python3 tools/generate_parasite_textures.py   # Parasite PNGs
python3 tools/generate_weapon_textures.py     # Legendary Weapons PNGs
python3 tools/generate_kaiju_model.py         # Kaiju geometry + UV atlas map
python3 tools/generate_kaiju_textures.py      # Kaiju PNGs (paints against that map)
python3 tools/generate_blizzard_textures.py   # Extreme Blizzard PNGs
python3 tools/build_mcaddon.py                # validate + pack all three .mcaddon files
python3 tools/build_mcaddon.py weapons        # just one addon
node    tools/test_scripts.mjs                # Natural Disasters: 37 checks
node    tools/test_parasite.mjs               # Parasite: 23 checks
node    tools/test_weapons.mjs                # Legendary Weapons: 44 checks
node    tools/test_kaiju.mjs                  # Kaiju Rampage: 30 checks
node    tools/test_blizzard.mjs               # Extreme Blizzard: 35 checks
```

Both test files stub `@minecraft/server` and `@minecraft/server-ui` and run the
real behavior pack scripts against a fake world, so script errors show up here
instead of as a silent "script pack failed to load" on a phone.

---

# Part 3 — Legendary Weapons

Six weapons, each with an **active ability** (tap while holding it) and a
**passive** that fires on every melee hit. Every ability runs on a real cooldown,
shown by the vanilla cooldown sweep on the item.

Install `LegendaryWeapons.mcaddon` the same way as the others: tap the file, then
activate **Legendary Weapons (Behavior)** in your world.

## The weapons

| Weapon | Melee | Cooldown | Ability (tap) | Passive (on hit) |
| --- | --- | --- | --- | --- |
| **Thunder Blade** §e | 9 | 6s | **Call Lightning** — a bolt lands where you look, then arcs to 3 more enemies nearby | Every hit chains lightning to up to 3 nearby enemies |
| **Frost Scythe** | 8 | 8s | **Frost Nova** — a 7 block ring of ice: 6 damage, slowness III, weakness and mining fatigue for 7s | Hits chill: slowness + weakness for 4s |
| **Inferno Cannon** | 4 | 3s | **Fire Blast** — a bolt of fire up to 40 blocks that explodes on impact (10 direct + 6 splash, sets fire) | Melee hits set the target on fire |
| **Void Ripper** | 7 | 4s | **Blink Strike** — teleport up to 12 blocks forward, cutting everything you pass through for 8 | Steals health equal to 30% of the damage you deal |
| **Earthshaker** | 12 | 7s | **Ground Slam** — 9 block shockwave: 12 damage, launches everything, shakes the screen | Heavy knockback on every hit |
| **Singularity Staff** | 3 | 12s | **Singularity** — a black hole that drags everything within 13 blocks in for 3 seconds, then implodes for 16 | Weak in melee. It is not a club. |

Abilities never hit you, and by default they do **not** break blocks — turn that
on in the settings if you want the craters.

## Controls

- **Tap** with a weapon → use its ability (or a "ready in 2.4s" message if it is
  still cooling down)
- **Sneak + tap** → open the **Weapon Codex**: every weapon's stats, ability and
  passive, plus the settings screen

## Crafting

Everything starts with a **Weapon Core**:

```
Weapon Core:      A D A      A = amethyst shard
                  D N D      D = diamond
                  A D A      N = netherite ingot
```

Then, with the core in the middle and a stick as the handle:

| Weapon | Top of the recipe |
| --- | --- |
| Thunder Blade | 1 copper block |
| Frost Scythe | 3 packed ice across the top row |
| Inferno Cannon | 5 blaze rods (top row + both sides of the core) |
| Void Ripper | 1 echo shard |
| Earthshaker | 5 obsidian (top row + both sides of the core) |
| Singularity Staff | 1 nether star |

In creative all seven items are in the **Equipment** tab (the core is under
**Items**), or run `/scriptevent wm:give` for the full set. Each weapon is
repairable on an anvil with its own material and takes enchantments normally.

## Settings

Sneak + tap → **Settings**, or use the commands below:

- **Ability power** — 25% to 300% damage multiplier on every ability
- **Abilities may break blocks** — off by default, protects your builds
- **Abilities may hit other players** — turn off for co-op worlds
- **Abilities cost durability** — 3 durability per cast
- **Show ability name on screen**

## Commands

```
/scriptevent wm:give [weapon|core|all]   give yourself weapons
/scriptevent wm:use <weapon>             fire an ability without tapping
/scriptevent wm:codex [weapon]           open the codex
/scriptevent wm:settings                 open the settings screen
/scriptevent wm:power <percent>          ability damage multiplier (10-500)
/scriptevent wm:blocks on|off            let abilities break blocks
/scriptevent wm:pvp on|off               let abilities hit other players
/scriptevent wm:list                     list the weapon ids
/scriptevent wm:help                     print this in chat
```

## Folder structure

```
LegendaryWeapons.mcaddon           <- the installable file

weapons_BP/                        BEHAVIOR PACK
├── manifest.json
├── pack_icon.png
├── items/                         6 weapons + wm:weapon_core
│   ├── thunder_blade.json         damage, durability, enchantable, cooldown
│   ├── frost_scythe.json
│   ├── inferno_cannon.json
│   ├── void_ripper.json
│   ├── earthshaker.json
│   ├── singularity_staff.json
│   └── weapon_core.json
├── recipes/                       one per weapon, plus the core
├── scripts/
│   ├── main.js                    taps, cooldowns, melee passives, /scriptevent
│   ├── config.js                  the weapon table: stats, cooldowns, tuning
│   ├── util.js                    safe API wrappers + a hand written raycast
│   ├── sounds.js                  custom + vanilla sound ids
│   ├── abilities.js               all six abilities and all six passives
│   └── ui.js                      codex and settings screens
└── texts/
    ├── en_US.lang
    └── languages.json

weapons_RP/                        RESOURCE PACK
├── manifest.json
├── pack_icon.png
├── particles/
│   ├── thunder_arc.particle.json       wm:thunder_arc
│   ├── frost_shard.particle.json       wm:frost_shard
│   ├── inferno_bolt.particle.json      wm:inferno_bolt
│   ├── void_rift.particle.json         wm:void_rift
│   ├── quake_dust.particle.json        wm:quake_dust
│   └── singularity_core.particle.json  wm:singularity_core
├── sounds/
│   ├── sound_definitions.json     15 custom sound events
│   └── weapons/                   drop your own .ogg files here (see its README)
├── textures/
│   ├── item_texture.json
│   ├── items/                     7 weapon sprites
│   ├── particle/                  6 particle textures
│   └── ui/                        7 codex icons
└── texts/
    ├── en_US.lang
    └── languages.json
```

### UUIDs

| Pack | Part | UUID |
| --- | --- | --- |
| BP | header | `f9a45432-a6a4-4171-9921-681ab38c0231` |
| BP | data module | `b9974b74-9456-402c-b21a-1888635a8f7a` |
| BP | script module | `987e288c-82d2-4dae-abbd-62650f0d1a86` |
| RP | header | `1b556013-1c42-477c-9b48-4a5d52c24bd9` |
| RP | resources module | `43fa6066-be87-4bb5-9b40-e2dcae48922c` |

## Adding your own weapon

1. Add an entry to `WEAPONS` in `weapons_BP/scripts/config.js` (stats, cooldown,
   ability text and a `tuning` block).
2. Add a handler with the same key to `ACTIVE` in `abilities.js`, and a case in
   `onHit()` if it needs a passive.
3. Copy an item JSON in `weapons_BP/items/`, a recipe, an icon in
   `weapons_RP/textures/items/` and the matching `item_texture.json` entry.

The codex, the cooldown handling, the settings and the `/scriptevent` commands
pick it up automatically.

---

# Part 4 — Kaiju Rampage

An **11 block tall** monster in the Godzilla mould that treats the landscape as
scenery to be flattened. **It destroys constantly — not only when it attacks.**
Anything its body occupies is ground to rubble as it walks, so it carves its own
path through hills, forests and whatever you built.

> The creature is called **Kaiju** rather than a trademarked name. If you want it
> named something else, change one line — `entity.kj:kaiju.name=` in
> `kaiju_BP/texts/en_US.lang` — and rebuild.

Install `KaijuRampage.mcaddon` the same way as the others, then activate
**Kaiju Rampage (Behavior)** in your world.

## What it does

| Attack | Effect |
| --- | --- |
| **Walking** | Every block its body passes through is smashed, with a little rubble left behind. Hills, trees and buildings all go. |
| **Stomp** | Every few footfalls: a 4.5 block shockwave, 14 damage, cracks the ground two blocks deep, launches everything into the air and shakes screens for 45 blocks. |
| **Tail Sweep** | Every 9 seconds when something is close: 9 block radius, 26 damage, hurls everything away and knocks chunks out of the surroundings. |
| **Atomic Breath** | Every 22 seconds: the dorsal plates glow blue for 3 seconds, then a beam carves a burning 46 block trench through the world — 55 damage, scorched magma, a 4 power detonation at the far end. |
| **Roar** | Every 30 seconds: 55 block radius, heavy screen shake, nausea, slowness and weakness for everything nearby. |

**Health 1500, melee damage 40, immune to fall, fire, lava, lightning and
drowning, and it cannot be knocked back.** Below **half health it enrages**: it
turns scorched black with molten cracks, moves faster, hits for 60 and its
cooldowns drop by nearly half.

Its skin changes with its state — charcoal when calm, glowing atomic blue while
charging its breath, black and molten when enraged.

## Waking one

Craft the **Kaiju Horn** (nether star in the centre, 4 iron, 4 obsidian), or run
`/scriptevent kj:give`. It is also a creative spawn egg.

- **Tap** the horn → a kaiju rises 22 blocks in front of you
- **Sneak + tap** → menu: Wake the Kaiju, Banish Them All, Settings

It drops **Kaiju Scales**, **Atomic Cores**, diamonds and netherite scrap, plus
500 XP. Killing one is a real fight: 1500 health that regenerates.

## Keeping it under control

Default limits, all adjustable in the settings screen:

- **2 kaiju maximum** — extras are removed the moment they spawn
- **140 block edits per tick**, shared between all kaiju, so phones stay playable
  (lower it if your device struggles)
- **Never destroyed**: bedrock, barriers, command blocks, portals, spawners,
  reinforced deepslate, and water/lava are left alone
- **Destruction scale** 25–200%
- Block smashing, atomic breath, roar and hunting players can each be turned off
- **Banish Them All** removes every kaiju instantly

## Commands

```
/scriptevent kj:summon [count]     wake kaiju in front of you (max 5)
/scriptevent kj:kill               remove every kaiju
/scriptevent kj:status             what is awake, and how hurt
/scriptevent kj:destroy on|off     block smashing on or off
/scriptevent kj:hunt on|off        whether it targets players
/scriptevent kj:power <percent>    destruction scale, 10 to 400
/scriptevent kj:cap <number>       how many may exist at once
/scriptevent kj:give               give yourself a Kaiju Horn
/scriptevent kj:settings           open the settings screen
/scriptevent kj:help               print this in chat
```

## Folder structure

```
KaijuRampage.mcaddon               <- the installable file

kaiju_BP/                          BEHAVIOR PACK
├── manifest.json
├── pack_icon.png
├── entities/
│   └── kaiju.json                 kj:kaiju, three states as component groups
├── items/
│   ├── kaiju_horn.json            kj:kaiju_horn
│   ├── kaiju_scale.json           kj:kaiju_scale
│   └── atomic_core.json           kj:atomic_core
├── recipes/kaiju_horn.json
├── loot_tables/entities/kaiju.json
├── scripts/
│   ├── main.js                    events, horn taps, /scriptevent, warnings
│   ├── config.js                  settings, tuning, protected block list
│   ├── util.js                    safe API wrappers, raycast, block breaking
│   ├── sounds.js                  custom + vanilla sound ids
│   ├── rampage.js                 the destruction engine
│   └── ui.js                      Kaiju Horn menus
└── texts/en_US.lang, languages.json

kaiju_RP/                          RESOURCE PACK
├── manifest.json
├── pack_icon.png
├── entity/kaiju.entity.json       three skins chosen by state
├── models/entity/kaiju.geo.json   35 cubes, generated (see tools/)
├── animations/kaiju.animation.json    idle, walk, charge, roar
├── animation_controllers/kaiju.animation_controllers.json
├── render_controllers/kaiju.render_controllers.json
├── particles/                     atomic charge + beam, stomp dust, rubble,
│                                  roar wave, smoke
├── sounds/
│   ├── sound_definitions.json     13 custom sound events
│   └── kaiju/                     drop your own .ogg files here
├── textures/
│   ├── item_texture.json
│   ├── items/                     horn, scale, atomic core
│   ├── entity/kaiju/              kaiju_calm, kaiju_charging, kaiju_enraged
│   ├── particle/                  6 particle textures
│   └── ui/                        3 menu icons
└── texts/en_US.lang, languages.json
```

The model and its texture are both generated, and share a UV atlas map so they
can never drift apart:

```bash
python3 tools/generate_kaiju_model.py      # writes the .geo.json + tools/kaiju_uv_map.json
python3 tools/generate_kaiju_textures.py   # paints the three skins against that map
```

### UUIDs

| Pack | Part | UUID |
| --- | --- | --- |
| BP | header | `6a867c80-c6d0-42ca-93bf-f81bff3131aa` |
| BP | data module | `82b2d9ba-9794-44af-8088-3c79324401ce` |
| BP | script module | `b64daa19-f3c9-4125-bc05-269bb59a3f1a` |
| RP | header | `acd5b6e2-c994-4b47-ae22-95805b507598` |
| RP | resources module | `7e7e2ad7-4f2e-43ce-a7d9-20806e1a2cf8` |

## Tuning it

`kaiju_BP/scripts/config.js`:

- `TUNING.body` — how much of the world its hitbox grinds up
- `TUNING.stomp` / `TUNING.tail` / `TUNING.breath` / `TUNING.roar` — every
  cooldown, radius and damage number
- `TUNING.enrageAtHealthFraction` and `enrageCooldownScale`
- `SETTINGS_DEFAULTS.maxBlockOpsPerTick` — the single most useful dial for
  performance on older phones

---

# Part 5 — Extreme Blizzard

A winter that kills. When the storm is up, **anything caught outside freezes to
death in about five seconds** — you, your animals, every mob. There is exactly
one way to survive it: **a sealed room with a fire burning inside**.

Install `ExtremeBlizzard.mcaddon` like the others, then activate
**Extreme Blizzard (Behavior)** in your world.

## The one rule

Your body heat is a bar on the action bar, 100% down to 0%. Where you are
standing decides which way it moves:

| Where you are | Body heat | Outcome |
| --- | --- | --- |
| **Sealed room + a fire in it** | **+22%/s** | Safe. This is the only real shelter. |
| Sealed room, no fire | −4%/s | Buys you a couple of minutes, nothing more. |
| Outside (or a room with any gap) | **−25%/s** | 4 seconds to zero, dead about 1.5 seconds later. |
| Outside next to a campfire | slowed, can even hold | Enough to work outdoors briefly. |

At 55% you start to slow down. At 0% you take 16 damage a second and the screen
goes white. Leather armour (or netherite) slows the whole thing down by 12% a
piece, up to 60%.

## What counts as "sealed"

The pack does not just check for a roof. It **flood fills the air around you**:
if that pocket of air closes within 160 blocks, you are inside; if it keeps
going — an open door, a gap in the roof, a missing floor block, the open world —
you are outside and freezing, no matter how much wall is around you.

Then it looks for **heat touching that same air**: a Heater, campfire, lit
furnace, torch, lantern, glowstone, lava, fire. One is enough.

Not sure? **Sneak + tap the Weather Stone**, or run `/scriptevent sw:check`.
It tells you exactly which of the two you are missing:

```
✔ SAFE            sealed (48 blocks of air) with 4 heat nearby
⚠ SEALED BUT COLD the room is closed in, but there is no fire in it
✘ NOT SHELTERED   the air around you runs straight to the outside
```

## Building a house that works

1. Four walls, a floor and a **complete roof** — no gaps, no open doorway.
2. A **door** in the frame (a hole counts as outdoors).
3. **A fire inside**: a Heater, a campfire, a lit furnace, or even a torch.
4. Check it with `/scriptevent sw:check` before the storm arrives.

You get a **one minute warning** before every storm.

## Items

| Item | Recipe | What it does |
| --- | --- | --- |
| **Heater** | 6 iron, 1 magma block, 1 coal block | The best heat source, worth 4 heat. Lights the room too. |
| **Weather Stone** | 4 packed ice, 4 snowballs, 1 amethyst shard | Tap: start/stop the storm. Sneak + tap: menu, shelter check, settings. |
| **Hand Warmer** | 3 iron, 1 coal, 1 redstone | Tap for +35% body heat, 25 second cooldown. |
| **Hot Cocoa** | Cocoa beans + milk bucket + sugar | Drink for +60% body heat. |

Or run `/scriptevent sw:give` for the whole kit.

## The storm

Runs on a cycle: **6 minutes calm, 8 minutes storm** by default. During a storm
snow piles up over the world, standing water freezes to ice, the wind howls and
the sky closes in. Turn on **endless winter** in the settings for a world that
never thaws.

## Commands

```
/scriptevent sw:storm on|off        start or stop the blizzard now
/scriptevent sw:status              storm state and everyone's body heat
/scriptevent sw:check               is the room you are in actually safe?
/scriptevent sw:harsh <percent>     how fast you freeze, 25 to 200
/scriptevent sw:endless on|off      never ending winter
/scriptevent sw:lethal on|off       whether the cold can kill at all
/scriptevent sw:warm                fill your body heat back up
/scriptevent sw:give                heater, weather stone, warmer, cocoa
/scriptevent sw:settings            open the settings screen
/scriptevent sw:help                print this in chat
```

## Folder structure

```
ExtremeBlizzard.mcaddon             <- the installable file

blizzard_BP/                        BEHAVIOR PACK
├── manifest.json
├── pack_icon.png
├── blocks/heater.json              sw:heater
├── items/
│   ├── weather_stone.json          sw:weather_stone
│   ├── hand_warmer.json            sw:hand_warmer
│   └── hot_cocoa.json              sw:hot_cocoa
├── recipes/                        one per item, plus the heater
├── loot_tables/blocks/heater.json
├── scripts/
│   ├── main.js                     items, /scriptevent, storm forecast
│   ├── config.js                   settings, tuning, heat source table
│   ├── util.js                     safe API wrappers
│   ├── sounds.js                   custom + vanilla sound ids
│   ├── shelter.js                  the sealed-and-heated flood fill
│   ├── blizzard.js                 storm cycle, freezing, mobs, snow
│   └── ui.js                       Weather Stone menus
└── texts/en_US.lang, languages.json

blizzard_RP/                        RESOURCE PACK
├── manifest.json
├── pack_icon.png
├── blocks.json
├── fogs/blizzard.json              the whiteout fog (sw:blizzard)
├── particles/                      snow flurry, frost, heat shimmer
├── sounds/
│   ├── sound_definitions.json      9 custom sound events
│   └── blizzard/                   drop your own .ogg files here
├── textures/
│   ├── item_texture.json
│   ├── terrain_texture.json
│   ├── items/                      weather stone, hand warmer, hot cocoa
│   ├── blocks/                     heater top and side
│   ├── particle/                   snow, frost, ember
│   └── ui/                         4 menu icons
└── texts/en_US.lang, languages.json
```

### UUIDs

| Pack | Part | UUID |
| --- | --- | --- |
| BP | header | `c7ebb08f-8cc9-4fac-b2f1-2b15949608a6` |
| BP | data module | `b30dd6d7-60e2-49b8-a21c-f97ace1c894b` |
| BP | script module | `9cc57e00-8f9a-4ec4-8d45-466999d6ea26` |
| RP | header | `a95b7cfc-914c-4d23-b6e5-b71a9d0dd89e` |
| RP | resources module | `77bc46e6-f39c-4e22-94b2-a831461f6b02` |

## Tuning it

`blizzard_BP/scripts/config.js`:

- `TUNING.temperature` — every rate: how fast you freeze, how fast you warm up,
  when the damage starts and how hard it hits
- `TUNING.shelter.maxRoomCells` — how big a room may be and still count as
  sealed (160 blocks of air by default)
- `TUNING.heatSources` — which blocks count as heat, and how much each is worth
- `TUNING.coldImmune` — mobs the cold ignores
- `SETTINGS_DEFAULTS.harshnessPercent` — one dial for the whole difficulty
