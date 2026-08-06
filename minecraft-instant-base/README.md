# 🏠 Instant Base — Minecraft Bedrock Add-On (BP + RP)

One tap builds a **complete, finished starter base** around you — house, workshop, storage,
enchanting corner, beds, basement, mine tunnel, fenced yard, watered farm and an animal pen
with animals already inside.

For **Minecraft Bedrock / Pocket Edition 1.21.x** (target: `1.21.0.26`, Android).

![base blueprint](docs/preview.png)

---

## 📲 Install and use (simple steps)

1. Download **`dist/InstantBase.mcaddon`**.
2. Tap the file → **Open with Minecraft** → "Successfully imported".
3. World settings → **Behavior Packs** → **Instant Base [Behavior]** → **Activate** (say Yes to the resource pack).
4. In game, type in chat: `/scriptevent base:give` — you get a **Base Blueprint**.
5. **Stand on flat open ground** where you want the base.
6. Hold the blueprint and **long press** the screen. Wait about 8 seconds — it builds around you.

> ⚠️ **It replaces the ground around you** (about 17 blocks wide, 24 blocks long, from your feet up).
> Never use it on top of something you already built. Use it on empty land.

No blueprint needed? Just run `/scriptevent base:build`.

---

## 🏡 What you get

```
                 north / front
      ┌───────────────────────────────┐
      │  farm (wheat,   │  animal pen │   fenced yard
      │  carrots,       │  cow, sheep,│   + lanterns
      │  potatoes,      │  chicken    │   + gate + path
      │  beetroot)      │  + water    │
      ├──────────── door ─────────────┤
      │ storage │   kitchen  │ work-  │
      │ 8 chests│   campfire │ shop   │   15 x 13 house
      │ + barrel│   table    │ wall   │   5 blocks tall
      │         │            │        │   stepped gable roof
      │ enchant │   beds x2  │        │
      │ + books │            │ stairs │──→ down to basement
      └───────────────────────────────┘
                 south / back
```

| Area | What is in it |
|------|----------------|
| **Workshop wall** | Crafting table, 2 furnaces, blast furnace, smoker, stonecutter, anvil, grindstone, cartography table |
| **Storage wall** | 8 chests + a barrel. The **first chest holds a starter kit**: iron pickaxe/axe/shovel/sword, 32 bread, 64 torches, 64 cobblestone, 32 logs, 32 coal, water bucket, 2 spare beds, seeds |
| **Enchanting corner** | Enchanting table ringed by 14 bookshelves, brewing stand, cauldron |
| **Bedroom** | 2 beds with a lantern between them |
| **Kitchen** | Campfire, composter, barrel, small table |
| **Basement** | Reached by stairs inside the house: 5 chests, 3 barrels, furnace, crafting table, lanterns |
| **Mine tunnel** | A lit 3×3 tunnel already dug west from the basement — start mining straight away |
| **Yard** | Fenced, lit with lanterns, gravel path to a gate |
| **Farm** | 5×7 farmland, already watered, fully grown wheat, carrots, potatoes and beetroot |
| **Animal pen** | Fenced with a gate and water, 2 cows, 2 sheep, 2 chickens |

The house is fully enclosed and lit, so **no mobs can spawn inside**. When the build finishes you are
placed at the front door and **your respawn point is set to the house**.

### Chat commands

| Command | What it does |
|---------|--------------|
| `/scriptevent base:give` | Gives you a Base Blueprint |
| `/scriptevent base:build` | Builds the base right where you stand |
| `/scriptevent base:help` | Explains everything in chat |

### Crafting recipe

```
P P P      P = Paper
P C P      C = Crafting Table
P P P
```

---

## 🔨 How it works

`BP/scripts/main.js` writes a list of ~185 `fill` / `setblock` / `replaceitem` commands and runs
**24 of them per tick**, so even a phone stays smooth while the base appears. Every command is
wrapped in its own `try/catch`, so an unsupported block on your version just gets skipped instead
of stopping the build (the count of skipped steps is reported in chat at the end).

The roof is built from full blocks and slabs in steps rather than stairs, so it can never render
facing the wrong way on any version.

## 🗂️ Project layout

```
minecraft-instant-base/
├── BP/manifest.json           min_engine_version 1.21.0, @minecraft/server 1.11.0
├── BP/items/blueprint.json    the Base Blueprint item
├── BP/recipes/blueprint.json  crafting recipe
├── BP/scripts/main.js         the whole build plan
├── RP/                        blueprint texture + item name
├── tools/make_textures.py     regenerates the PNGs (pure stdlib)
├── tools/build.sh             rebuilds dist/*.mcaddon and dist/*.mcpack
└── dist/                      ready-to-import files
```

## ⚙️ Notes

* Works alongside the [God Abilities](../minecraft-god-abilities/) and
  [Gojo Abilities](../minecraft-gojo-abilities/) packs — different namespaces, no conflict.
* If a door or bed ends up facing an odd way on your version, break it and place it again —
  that is one block, everything else is orientation-free by design.
* Best used on flat ground. On a steep hill the ground is levelled with stone, which works but
  looks less tidy.
