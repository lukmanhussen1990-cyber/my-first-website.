# NPC Kingdom — Minecraft Bedrock Add-On

Rule a living kingdom. Found a Kingdom Core, recruit 13 kinds of NPC, watch your
settlement grow from **Camp → Village → Town → City → Kingdom**, and defend it
from bandits, undead armies and bosses.

Built for **Bedrock 1.21.0+ / Android**. **No experimental features required.**

## Install (mobile)

1. Download **`dist/NPC_Kingdom.mcaddon`**.
2. Tap the file. Minecraft opens and imports it.
3. Create/edit a world → **Behavior Packs** → activate *NPC Kingdom*.
   → **Resource Packs** → activate *NPC Kingdom Resources*.
4. Play. Craft or grab a **Kingdom Core** and place it.

Cheats are **not** required — everything runs off `tick.json`, item use and
NPC tapping.

## Quick start

| Action | How |
|---|---|
| Found the kingdom | Place the **Kingdom Core** item on the ground |
| Recruit an NPC | Tap it holding an **emerald** (recruited NPCs can follow you) |
| Give one NPC an order | Tap it with the **Royal Command Staff** (cycles through 12 orders) |
| Order everyone nearby | Tap an NPC with the **Royal Command Banner** |
| Talk | Tap an NPC with an empty hand. **Advisors** read out the full report |
| Report + collect taxes | Tap the Core with the **Royal Ledger** |
| Celebrate / declare war | Tap the Core with the **Celebration Horn** / **War Horn** |
| Sit on the throne | Tap the throne once the Throne Room is built (level 5) |

Orders: `work, follow, stay, patrol, defend, attack, retreat, gather, build,
repair, home, celebrate`.

Backup commands (if you prefer chat):

```
/function npck/help
/function npck/setup
/function npck/give_kit
/function npck/kingdom/status
/function npck/orders/follow      (any order name)
/function npck/kingdom/repair
```

## How it works

* **Resources** — Food, Wood, Stone, Iron, Gold, Emeralds live on the
  `npck.res` scoreboard and are shown on the sidebar. Farmers, lumberjacks,
  miners, builders, blacksmiths, merchants and advisors contribute every 10s.
  Lumberjacks really fell logs, miners really break ore, farmers plant and
  harvest crops.
* **Upgrades** — when storage meets the requirement the kingdom levels up on
  its own, with a chat announcement and fireworks.
* **Buildings** — 20 structures across 5 levels. They are placed **one at a
  time, ~8 seconds apart**, and only while a Builder is present, so a level-up
  never drops a lag spike on a phone.
* **Raids** — from level 2, waves attack roughly every 6–7 minutes from a
  rotating compass direction, scaling with your level. Every third wave brings
  a boss with a real boss health bar. Soldiers switch to *defend* and workers
  to *retreat* automatically.
* **Day/night** — the Core carries an environment sensor. At dusk workers walk
  home and sleep; soldiers switch to patrol. At dawn everyone resumes work.
* **Persistence** — all state is scoreboards, entity tags and the Core entity,
  so a kingdom survives closing and reopening the world.
* **Safety** — NPCs never target players, villagers, pets, iron golems or each
  other. Their `hurt_by_target` is filtered to hostiles only, so hitting one by
  accident will not turn it on you.

## Roles

Builder, Farmer, Miner, Lumberjack, Guard, Archer, Knight, Healer, Merchant,
Blacksmith, Royal Guard, General, Advisor — each with its own skin, spawn egg
and job. Merchants and Blacksmiths have real trade tables.

Enemies: Bandit, Raider, Dark Knight, Undead Soldier, Enemy Archer, Enemy
Wizard. Bosses: Bandit King, Dark Wizard, Undead Emperor.

## Folder structure

```
NPC_Kingdom.mcaddon
├── NPC_Kingdom_BP/
│   ├── manifest.json, pack_icon.png
│   ├── entities/          23 mobs + core + markers + throne seat
│   ├── items/             10 custom items
│   ├── functions/
│   │   ├── tick.json
│   │   └── npck/          sys · kingdom · npc · orders · raid · build · struct
│   ├── loot_tables/       entities/ + equipment/
│   ├── trading/           merchant + blacksmith
│   ├── recipes/           10 shaped recipes
│   ├── spawn_rules/
│   └── texts/
└── NPC_Kingdom_RP/
    ├── manifest.json, pack_icon.png
    ├── entity/            client entities + spawn-egg colours
    ├── models/entity/     humanoid, core, royal gear
    ├── animations/        idle walk work build attack hurt sleep celebrate
    ├── animation_controllers/, render_controllers/
    ├── attachables/       crown + royal armour
    ├── textures/          22 skins, 10 item icons, armour sheets
    └── texts/
```

## Rebuilding

Everything — including every texture — is generated, with no third-party
dependencies:

```
python3 tools/build.py
```

It regenerates `packs/` and repacks `dist/NPC_Kingdom.mcaddon`, validating that
every JSON file parses first. UUIDs are fixed, so a rebuild upgrades an
installed copy instead of duplicating it.

## Known limits

* Buildings are placed at the Core's ground level, so found your kingdom on
  reasonably flat ground. Each structure lays its own 4-block foundation and
  clears the air above, which absorbs gentle slopes.
* Sounds are vanilla Minecraft events (`/playsound`) — no bundled audio, so
  nothing copyrighted ships with the pack.
