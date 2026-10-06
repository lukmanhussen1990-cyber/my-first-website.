# Parasite Apocalypse Survival — Minecraft Bedrock add-on

A behavior pack and resource pack, delivered as one `.mcaddon`, for **Minecraft Bedrock Beta/Preview 1.21.0.26 on Android**. It was built for and checked against Mojang's reference data for exactly that build.

**Download:** `dist/ParasiteApocalypseSurvival.mcaddon`. The separate `.mcpack` files in `dist/` are an alternative if your phone won't open the `.mcaddon`.

| Item | What it does |
|---|---|
| **Tactical Torchlight** | Tap **Toggle Light**. While it is on and held, invisible light blocks follow where you look and light up caves and dark rooms. It is a 3D flashlight in your hand, and the lens glows when on. |
| **Luxury Base Spawner** | Tap the ground. It builds a two-floor quartz and dark-oak villa with its entrance facing you, layer by layer over about 7 s. |
| **Parasite Outbreak** | Tap the ground to release the first parasite. This is the only way an outbreak starts. |
| **Outbreak Control** | Opens a touch menu with status, pause/resume, settings, cure everything, clean up, and cure me. |

All four items are in the **Creative inventory** (search "Torchlight", "Luxury", "Parasite", "Outbreak"). They are also given once as a **starting kit** the first time each player joins a world with the add-on.

## Install on Android (Minecraft Beta/Preview 1.21.0.26)

1. Download `ParasiteApocalypseSurvival.mcaddon` to the phone.
2. Open it from the Files app or the browser's downloads, and choose **Open with → Minecraft**.
   * Minecraft starts and shows *Import started…* then *Successfully imported* twice: once for the behavior pack and once for the resource pack.
   * If Android won't open the `.mcaddon`, open `ParasiteApocalypseSurvival_BP.mcpack` and then `ParasiteApocalypseSurvival_RP.mcpack` the same way.
3. In Minecraft, go to **Play → Create New** (or edit an existing world: pencil icon).
4. Under **Behavior Packs → Available**, select **Parasite Apocalypse Survival BP** and tap **Activate**. Accept the prompt to also activate the resource pack. If there is no prompt, activate **Parasite Apocalypse Survival RP** under **Resource Packs**.
5. Create or play the world.

### World settings

| Setting | Value |
|---|---|
| Experiments | **None.** Leave every experiment off, including "Beta APIs". The scripts use the non-beta `@minecraft/server` 1.11.0 and `@minecraft/server-ui` 1.1.0. |
| Difficulty | **Easy, Normal or Hard** (Normal recommended). On Peaceful, mobs can't damage players, so players can't be infected. |
| Game mode | **Survival** for player infection. Creative is fine for trying the items, but parasites ignore Creative players. |
| Cheats | Not required. Only needed for the optional `/scriptevent pas:outbreak status\|pause\|resume\|cleanup\|cure\|start`. |

## Using it

* **Torchlight:**
  * Hold it and tap **Toggle Light**.
  * While it is on and held in either hand, light blocks of level 15, 13 and 11 follow your view up to 24 blocks away.
  * They are placed only in empty air; nothing is ever overwritten.
  * They are removed when you switch items, turn it off, die, leave, change dimension or reload.
* **Luxury Base:**
  * Tap the ground where you want the front steps. The house is about 18 × 15 blocks and 13 high, and it extends away from you.
  * If something is in the way, or there is water or not enough solid ground, you get a message with the blocking block and its coordinates, and you keep the item.
  * **Ground floor:** foyer, living room, kitchen and dining, storage (4 chests plus barrels), and a crafting room with an enchanting table and bookshelves.
  * **Upper floor:** 2 bedrooms (3 beds), a lounge, and the full-width balcony.
  * 9 working doors and lighting throughout.
* **Outbreak:**
  * One parasite starts it. Every 30 s, each parasite makes one offspring: 1 → 2 → 4 → 8 …
  * The cap is 64, counting parasites and infected creatures together.
  * Parasites and infected creatures infect villagers, wandering traders, cows, mooshrooms, pigs, sheep, chickens and Survival players.
  * Infected mobs turn into infected versions after 20 s and spread the infection further. Infected creatures never fight each other.
  * Infected players spread it with their own hits. When an infected player dies, an "Infected ‹name›" humanoid spawns.
  * Timers, settings and incubation counts are configurable in the Outbreak Control menu, and everything survives saving and reloading.

## Limitations

* **Light is not a real flashlight beam.** This build and device give scripts no dynamic lights, spotlights or shadows. The light is invisible light blocks: block-sized steps, a maximum level of 15, light spreading in all directions, and three points along your view updated 10 times a second. There is no light under water.
* **Infected players can't be taken over by AI.** Bedrock can't do that, so the infected-humanoid NPC after death is the fallback. It uses the Steve skin.
* **The look won't match your screenshot exactly.** Your reference image used shaders; on the phone the parasite looks flatter, and only its eyes are full-bright at night.
* **Cure can't restore everything.** It cannot restore trades, inventories, saddles or nitwit villagers.
* **Only loaded areas are processed.** Creatures in unloaded chunks are frozen by the game.

## What was verified, and what was not

**Run:**
* Everything was checked against Mojang's `bedrock-samples` tagged **v1.21.0.26-preview** (script API, block states, item and entity formats).
* **184 automated tests** run against a mock of the 1.21.0.26 script API, and all pass. They cover:
  * the torchlight;
  * house placement in 4 facings and blocked cases;
  * doubling 1→2→4→8 at 30/60/90 s;
  * the cap;
  * a 3-hop infection chain;
  * player infection and the NPC;
  * pause, cleanup and cure;
  * save/reload;
  * the menus.
* TypeScript typecheck against the exact preview typings: 0 errors. The resource and behavior reference validator: 0 errors.
* The house structure was re-read with an independent parser: walkable to every room, lit to level ≥ 9 everywhere.
* The creature behaviors were run on Mojang's real **Bedrock Dedicated Server 1.21.0.26 preview**: 90 of 90 checks passed.

**Not tested — please check on the phone:**
* Visuals: models, textures, glow, animations, particles, and how the flashlight sits in first person.
* Real touch input.
* Whether infected sheep keep their wool colour.
* Whether the creatures' attack lunge animation plays. Attacks and infection work either way.

## Building from source

```bash
npm install && npm run typecheck && npm test
python3 tools/build.py   # writes dist/*.mcaddon and *.mcpack
```

Sources: `addon/behavior_pack` and `addon/resource_pack`, with generators in `tools/`. Design docs are in `docs/`.
