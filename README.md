# Natural Disasters — Minecraft Bedrock Addon (Pocket Edition friendly)

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
python3 tools/generate_textures.py   # optional, regenerates every PNG
python3 tools/build_mcaddon.py       # validates the JSON and writes NaturalDisasters.mcaddon
node    tools/test_scripts.mjs       # optional, runs the scripts against a fake world
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
