# Lost Island: Abandoned

A survival-adventure add-on for **Minecraft Bedrock 1.21.0 (Beta 1.21.0.26)**, built and
tuned for Android.

> Survive. Discover what happened. Find a way home.

**Deliverable:** `dist/Lost_Island_Abandoned.mcaddon`
(0.53 MB, 746 files, one behaviour pack + one resource pack)

---

## Install (Android)

1. Copy `Lost_Island_Abandoned.mcaddon` to your phone.
2. Tap the file. Minecraft opens and imports both packs.
3. **Create a new world.** In *Behaviour Packs* activate **Lost Island: Abandoned [BP]** —
   the resource pack is pulled in automatically by the dependency.
4. Recommended world settings: Survival, Normal difficulty. Cheats are **not** required.
5. Join the world. You are handed the **Start Kit** item with instructions.

### Starting the island

Hold-tap the **Start Kit**. The island builds itself over about 18 seconds with a progress
bar, then teleports you to the wreck on the southern beach and Chapter 1 begins.

The build is a deliberate, explicit action rather than something automatic, because it
rewrites terrain across x/z −168..168 (y 30..140). **Use a fresh world.** If you lose the
Start Kit, `/function li_kit` gives you another; `/function li_help` lists every command.

---

## The island

One handcrafted island, **321 × 321 blocks**, sea level y=62, generated deterministically
from a seeded heightmap so it is identical for everyone. 66,966 land columns, 975 trees,
6 regions:

| Region | Where | Character |
|---|---|---|
| Southern Coast | z 90..160 | safe start, beaches, palm-like trees, camps |
| Central Forest | z 5..90 | the densest part of the island, ruins, roads |
| Swamp | x −160..−55, z −25..60 | mud, dark water, stilt huts, heavy fog |
| Mountains | x 45..160, z −85..5 | rock, snow line, caves, the mine, the dam |
| Northern Coast | z −160..−95 | harbour, military ruins, cliffs |
| Forbidden Zone | x −160..40, z −160..−95 | the airstrip, the lab, and what is underneath |

Also: 2 rivers built as stepped, fully-enclosed pools (so nothing flows and nothing lags),
3 lakes, 2 waterfalls, 3 connected cave systems with surface mouths, a ravine, a 120-block
abandoned tunnel, sea cliffs, a rock arch, and a dirt-road network with two collapsed
river crossings.

## 26 locations, all with real interiors

Wrecked boat · south camp · fishing shacks and jetty · ranger station with lookout ·
abandoned village (9 houses, well, gardens) · supermarket · gas station · motel ·
hospital (2 floors, gated pharmacy) · police station (cells, gated armoury) · fire station ·
radio tower · swamp huts · forest campsites · lighthouse · destroyed bridge · dam with
maintenance corridor · abandoned mine · harbour with half-sunk ferry · offshore shipwreck ·
military checkpoint · military camp · airstrip and hangar · research laboratory ·
underground bunker · secret research complex.

Plus **8 secrets** (hidden caves, buried caches, unexpected survivor camps), carved symbol
sites, and 2 easter eggs. **54 readable notes** are scattered across them, telling the story
in fragments: the island had a normal population, a research organisation arrived, incidents
began, the north was quarantined, the evacuation was stopped at the gangway, and the last
answers are underneath the facility.

---

## Survival systems

Normal Minecraft survival, plus three layers driven entirely by functions and scoreboards.
The HUD is a single actionbar line: `Water 84%  Temp Comfortable  Torch 62%`.

**Thirst** — 1200 points, draining 3 every 6 seconds, so roughly 40 minutes from full to
empty. Thirsty → Dehydrated (weakness, mining fatigue) → Critical (wither). Drink
**Dirty Water** (+250, ~45% chance of poison and nausea), **Clean Water** (+400) or
**Purified Water** (+600, made by boiling either in a furnace). Empty bottles come back.

**Temperature** — a −100..100 scale shown as Freezing / Cold / Comfortable / Hot /
Overheating. Night, storms, altitude above y=96 and standing in water push it down;
campfires, torches and emergency lights push it up; low ground in daylight pushes it up.
It always drifts back toward comfortable, so it nudges rather than nags.

**Exhaustion** — rises with time and with low thirst, and falls when you rest by a campfire
or on bedding. High exhaustion gives mining fatigue, then slowness.

*Honest note:* Bedrock's command syntax cannot detect sprinting or damage taken without the
Script API, so exhaustion is driven by what commands *can* observe — time awake, thirst,
temperature extremes, and whether you are resting. It is a real working meter, not a
sprint-tracker.

## The flashlight

**Flashlight** + **Battery**. Hold-tap to toggle; each battery adds 40% charge, and a full
charge lasts about 8 minutes of continuous use. When it dies it switches itself off with a
click. Bedrock 1.21.0 has no per-item dynamic lighting, so a lit torch held in your main
hand grants night vision — the closest reliable equivalent on this version, and it is
genuinely what makes caves and the facility navigable.

## Day, night and weather

An invisible per-player sensor entity reads the time of day (Bedrock commands cannot),
so night is a real game state: colder, fog pushed in, ambient thunder, and hostile
encounters switch on. Dawn clears the fog and refunds exhaustion. A weather director rolls
about every 5 minutes for clear / rain / storm, and the systems know when a storm is running
because they started it.

## Creatures

| Creature | HP | Damage | Where |
|---|---|---|---|
| Feral Survivor | 24 | 4 | forest and village, any light |
| Island Stalker | 18 | 5 | night, dark places; seeks shade by day |
| Cave Crawler | 14 | 3 | underground, y<52, climbs |
| The Watcher | 30 | 0 | very rare, flees when you get within 12 blocks, then vanishes |
| Alpha Stalker | 60 | 8 | Forbidden Zone only — drops the Research Keycard |
| Island Boar | 10 | 2 | neutral wildlife, drops porkchop and leather |
| Island Bird | 4 | 0 | coastal ambience |

All seven have original low-poly models, hand-written animations, textures painted from the
same cube UV data the geometry uses, spawn conditions, loot and vanilla-sound voices.

## Chapters

1. **Stranded** — find shelter and supplies before nightfall
2. **Signs of Life** — discover the abandoned village
3. **No Signal** — reach the radio tower
4. **The Evacuation** — search the harbour
5. **Restricted** — force the military checkpoint
6. **Below** — get into the underground complex
7. **The Truth** — reach the sealed room
8. **Escape** — repair the lighthouse radio

The ending needs five components: Radio Component (radio tower), Battery (common or
crafted), Fuel Can (airstrip), Mechanical Component (harbour ferry) and Navigation
Equipment (shipwreck). Carry all five to the lighthouse lamp room and the bench shows your
progress until it fires: **SIGNAL RECEIVED — You survived Lost Island.** The world stays
open afterwards.

Every critical-path item is placed by a dedicated guaranteed loot table, so progression can
never be blocked by a bad random roll. The crowbar that opens the checkpoint is both
craftable and guaranteed at the fire station; the keycard is guaranteed at the military camp
and the bunker key at the airstrip.

## Loot

18 chest tables across common / uncommon / rare tiers. Dangerous places pay better; several
tables can roll nothing at all, and `chests/empty` exists on purpose, so not every container
is worth the walk.

## Creative and testing

All 25 custom items and every custom block appear in the Creative menu, and all seven
creatures have spawn eggs. `/function li_dev/giveall` gives one of everything.
The **Debug Wand** refills your meters and advances one chapter — useful for checking the
ending without a full playthrough, and it touches nothing during normal survival.

---

## Built for a phone

- **No Script API at all.** No `scripts/` folder, no script module in the manifest. That
  removes every `@minecraft/server` version risk on a beta build, and it is why this add-on
  targets 1.21.0 honestly rather than approximately.
- The per-tick cost while idle is **3 commands**. `tick.json` runs one small function that
  counts to 10 and hands off; each subsystem then runs on its own countdown (thirst every
  6s, temperature 3s, encounters 10s, atmosphere 5s).
- Trigger volumes for 54 notes and 26 discoveries are split into 5 rotating groups, so only
  about 16 volume tests run per half-second.
- The island build is spread across 348 steps of **at most 150 commands and 140,000 blocks
  touched per tick**, so it never stalls the client.
- Encounters add **one** hostile at a time and only when nothing hostile is already within
  26 blocks. Spawn-rule density limits are 2–3. Every hostile carries
  `minecraft:despawn`, so nothing accumulates.
- No `@e` selector is unbounded, no radius exceeds 64, rivers and lakes are sealed water
  boxes that never trigger flow updates, and every texture is 16×16 (32×32 for signage,
  64×64 for creatures, one 128×128 for the Alpha Stalker).

## Deliberate limitations

These are substitutions, not stubs — everything described above actually works.

- **No custom audio.** No OGG encoder was available, so rather than ship a
  `sound_definitions.json` pointing at files that do not exist, every sound is an existing
  vanilla Bedrock sound event, chosen for the mood (`mob.warden.heartbeat` for dehydration,
  `raid.horn` for the rescue ship, `ambient.cave` underground).
- **No dynamic light** from the flashlight — night vision instead, as described above.
- **Signage is painted block textures**, not sign text. Bedrock cannot write sign text with
  commands, and shipping unverifiable `.mcstructure` NBT would have been worse.
- **Terrain is quantised to 3-block steps** outside build pads. This is what keeps the
  command count survivable, and it reads as natural stepped ground in Minecraft.
- `naturalregeneration` is turned **off** when the island builds, which is what makes
  bandages and first aid kits matter.

## Rebuilding from source

```sh
sh tools/build_all.sh
```

Regenerates every texture, item, block, entity, function and step file from scratch, runs
the validator, and repackages the `.mcaddon`. Everything is deterministic — the same island,
the same art, the same archive.

`tools/validate.py` is the gate and must report zero errors. It checks that every JSON
parses; both manifests (format 2, unique UUIDs, `min_engine_version [1,21,0]`, mutual
dependencies, no script module); every item icon, block texture, entity texture, geometry,
animation, animation controller and render controller reference resolves; every loot table,
recipe, spawn rule, `using_converts_to` target, summoned entity and `hasitem` item exists;
every `function` call resolves; every command is one that exists in Bedrock 1.21.0 and none
is on the banned list; every sound event and effect name is verified; no fill exceeds
Bedrock's 32,768-block limit; no `@e` selector is unbounded; and — by replaying all 35,875
build commands in execution order — that the spawn point is breathable, every progression
barricade exists, and all 11 ladder shafts are unobstructed.

That last check earned its place: it caught five real defects, including a lighthouse lamp
room sealed behind its own floor (which would have made the ending unreachable) and the
lab-to-bunker lift shaft being concreted over by the bunker built after it.

Block identifiers were verified against the
[Bedrock Edition Flattening](https://minecraft.wiki/w/Bedrock_Edition_Flattening) timeline —
new-style IDs are only used where their introduction version is at or before 1.21.0
(`oak_log` 1.20.0, `oak_leaves` 1.20.70, `oak_planks` 1.20.50, `grass_block` 1.20.70,
`oak_fence` 1.19.80, `andesite` 1.20.50), and anything unconfirmed uses the original
pre-flattening identifier, which is always valid. See `tools/palette.py`.

## Repository layout

```
build/Lost_Island_BP/   behaviour pack: 25 items + 22 use-markers, 10 blocks,
                        8 entities, 5 spawn rules, 13 recipes, 25 loot tables,
                        548 functions
build/Lost_Island_RP/   resource pack: 44 textures, 8 models, animations,
                        animation controllers, render controllers, 4 fogs,
                        sounds.json, lang
tools/                  the generators, the validator and the packager
dist/                   Lost_Island_Abandoned.mcaddon
SPEC.md                 the build contract: version rules, identifiers, budgets
```

All art and text are original to this project. No assets from other games.
