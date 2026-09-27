# Ancient Ruins Expedition (Minecraft Bedrock add-on)

Explore **Jungle Temples**, **Desert Crypts** and **Sunken Ships**: solve glyph puzzles,
survive traps, fight guardians and a boss, then loot the vault under the altar.

- **Download:** [`dist/Ancient_Ruins_Expedition.mcaddon`](dist/Ancient_Ruins_Expedition.mcaddon) (about 110 KB)
- **Made for:** Minecraft Bedrock **1.21.0.26 beta** on Android. It should also work on 1.21.0 and newer.
- **No experimental toggles needed.** It only uses stable features: Script API `@minecraft/server` 1.10.0 and `@minecraft/server-ui` 1.1.0.

## Install on Android

1. Download `Ancient_Ruins_Expedition.mcaddon`. On GitHub, open the file and tap **Download raw file**.
2. Open the downloaded file and choose **Minecraft**. You should see "Successfully imported" for both packs.
3. Create a **new world**, or explore brand-new land in an old one, because ruins only appear in newly generated chunks.
   Under **Behavior Packs**, activate **Ancient Ruins Expedition BP**. The resource pack is added automatically.
4. Leave **Command blocks enabled** switched on (it's on by default). Each ruin has a hidden core that adds it to your map
   when you come near. If command blocks are off, a ruin is still added as soon as you walk onto its floor.

If the import fails, import `Ancient_Ruins_Expedition_BP.mcpack` and `Ancient_Ruins_Expedition_RP.mcpack`
one at a time instead.

## The ruins

| Ruin | Where | Size | Puzzle | Traps | Guardian | Boss (150 HP) |
|---|---|---|---|---|---|---|
| Jungle Temple | Jungle biomes, on the surface | 21×16×23 | 4 levers on glyph pillars | Arrow corridor, collapsing floor pit, poison-spore tunnel, arrow shrine | Temple Guardian (30 HP) | **Jade Idol**: heavy slam + *Seismic Stomp* (damage and knockback all around it) |
| Desert Crypt | Deserts, mostly underground (look for a sandstone gate with gold tips, or a flat sandstone square in the sand) | 23×14×23 | 4 pressure plates on glyph pedestals | Arrow antechamber, collapsing sand floor, poison gas tomb, arrow trap in the canopic chamber | Crypt Mummy (26 HP, causes hunger) | **Sand Pharaoh**: withering strikes + *Curse of the Sands* (raises mummies, sandstorm blindness) |
| Sunken Ship | Ocean floor (not frozen oceans) | 11×12×27 | 4 levers in the captain's cabin | Arrow trap at the cabin door, rotten deck that collapses | Drowned Captain (36 HP, swims) | **Abyssal Admiral**: heavy strikes + *Tidal Pull* (drags you in and slows you) |

Every boss has a health bar. At half health it becomes **enraged**: it moves faster and uses its special attack more often.

### How to play

1. **Get a Ruin Compass.** Craft one or find one in ruin chests. Hold it in either hand, and the bar above your hotbar
   shows the direction and distance to the nearest ruin you have found but not yet beaten. Tap or use it to show a trail and the coordinates.
2. **Ruins are added to your map automatically** once they load near you (about 60 blocks away) or when you step inside one.
   Guardians wake up when you get close.
3. **Solve the glyph puzzle.** Each boss room has a mural of 4 glyphs, read left to right. Pull the lever (temple, ship) or
   step on the pressure plate (crypt) next to each matching glyph stone, in that order. If you get it wrong, the puzzle resets and a small curse hits you.
4. **Fight the boss.** It rises from the altar.
5. **Open the vault.** When the boss dies, the 3×3 hatch under the altar opens, with two treasure chests below.

Tip: the Sunken Ship is underwater. Its chests often hold Potions of Water Breathing.

### Relic items

| Item | How to use | How to get it |
|---|---|---|
| **Ruin Compass** | Hold it in either hand to see an arrow, distance and ruin name. Tap to show coordinates and a trail. | Crafting (below), ruin chests |
| **Ancient Map** | **Crouch while holding it**, or tap a block with it. It lists every ruin you've found and whether it's beaten, lets you pick which one the compass follows, and has a lore and hints page. | Crafting (below), ruin chests, every boss, rare guardian drop |
| **Cursed Ring** | Hold it in your main hand or off-hand: **Speed II**, but your health is capped at **6 hearts (−4)**. | Every boss drops one, and it's rare in vaults |

**Recipes** (crafting table):

```
Ruin Compass            Ancient Map (shapeless)
 .  G  .                Empty Map + Gold Ingot + Ink Sac
 G  C  G
 .  M  .                G = Gold Ingot, C = Compass, M = Mossy Cobblestone
```

## Mobile optimization

- Textures are 16×16 for blocks and items and 64×64 for mobs. The whole add-on is about 110 KB.
- Few particles: 4 per gas puff, and at most 14 per boss shockwave.
- Mob animations are simple formulas with no keyframes or animation controllers. Models use fewer than 10 cubes.
- Scripts run one loop every 5 ticks, checking only the block under each player. Puzzles and traps react to lever and
  pressure plate events. Scripts don't tick any mob; boss specials come from a built-in timer on the mob.
- Guardians despawn when you're far away, and natural spawns are capped per area. Only bosses stay loaded.

## Folder structure

```
ancient-ruins-expedition/
├── dist/                          ready-to-import packages
│   ├── Ancient_Ruins_Expedition.mcaddon
│   ├── Ancient_Ruins_Expedition_BP.mcpack
│   └── Ancient_Ruins_Expedition_RP.mcpack
├── packs/
│   ├── AncientRuins_BP/           behavior pack
│   │   ├── manifest.json
│   │   ├── blocks/                25 custom blocks (glyphs, altars, traps, floors)
│   │   ├── entities/              3 guardians, 3 bosses, ruin marker
│   │   ├── items/                 ruin_compass, cursed_ring, ancient_map
│   │   ├── features/  feature_rules/   world generation (structure_template_feature)
│   │   ├── structures/ancient_ruins/   jungle_temple, desert_crypt, sunken_ship (.mcstructure)
│   │   ├── loot_tables/           ruin chests, vaults, mob drops
│   │   ├── spawn_rules/  recipes/  texts/
│   │   └── scripts/               main.js + modules (puzzles, traps, bosses, items, registry)
│   └── AncientRuins_RP/           resource pack
│       ├── manifest.json
│       ├── entity/  models/entity/  animations/  render_controllers/
│       ├── particles/             gas, sparks, shockwave, dust, compass trail
│       ├── textures/              blocks, items, entity (+ terrain/item atlases)
│       ├── blocks.json  sounds.json  texts/
├── tools/                         Python generators and the build/validator
└── tests/                         Node test run against a mock Script API
```

## Rebuilding from source

Requires Python 3 and, for the tests, Node 18+ (no extra packages).

```
python3 tools/build.py                              # regenerate JSON, textures, structures; validate; zip
node --import ./tests/register.mjs tests/run_tests.mjs   # scenario tests
```

Passing `--ref DIR` to `build.py` also checks vanilla block states, items and sounds against reference data
(PrismarineJS `bedrock/1.21.0/blockStates.json` and Mojang bedrock-samples `sound_definitions.json` and `mojang-items.json`).

## Troubleshooting

- **No ruins?** They only generate in *new* chunks, in jungles, deserts and oceans. They're rare by design:
  about one per 120 jungle chunks, 150 desert chunks and 180 ocean chunks.
- **The compass says "the needle spins"**: you haven't found a ruin yet. The compass can only point to ruins that have loaded
  near you, because Bedrock doesn't let add-ons locate unexplored custom structures.
- **List found ruins** (cheats on): `/scriptevent ancient_ruins:list`. Reset the list: `/scriptevent ancient_ruins:reset`.
- Custom blocks and spawn eggs for all mobs are in the creative inventory, so you can build your own puzzle rooms.
  Any lever on a glyph stone, pressure plate on a glyph pedestal, or plate on a Trap Mechanism works anywhere.
