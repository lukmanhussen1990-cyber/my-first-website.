# Perfect Disguises

A Minecraft Bedrock add-on (`.mcaddon`) that lets you **disguise yourself as mobs**.
Use the **Disguise Wand**, pick a mob from a touch-friendly menu, and you turn into a
real-looking vanilla mob, with that mob's powers and weaknesses.

- Made for **Minecraft Bedrock 1.21.0** (including **Beta/Preview 1.21.0.26**) on **Android**.
  It also works on iOS, Windows and consoles.
- Behavior Pack + Resource Pack in one `.mcaddon` file.
- **No experimental toggles needed.** It only uses stable Script API modules:
  `@minecraft/server 1.10.0` and `@minecraft/server-ui 1.1.0`.
- No Java mods, Forge, Fabric or servers.

## Download and install (Android)

1. Download **[`dist/PerfectDisguises.mcaddon`](dist/PerfectDisguises.mcaddon)** (on GitHub, tap the file and then **Download raw file**).
2. Open the downloaded file and choose **Minecraft** (or Minecraft Preview).
   Minecraft says *"Successfully imported Perfect Disguises"* twice, once for each pack.
3. Create a world, or edit one: **Behavior Packs**, then **Available**, then activate
   **Perfect Disguises (Behavior)**. The resource pack is added automatically.
4. Play. On your first join you get a **Disguise Wand** automatically.

If the `.mcaddon` will not open, use the two fallback files in `dist/`:
`PerfectDisguises_BP.mcpack` and `PerfectDisguises_RP.mcpack` (open both).

> Put Perfect Disguises at the **top** of both pack lists. Other add-ons that also
> replace the player (`player.json` / `player.entity.json`) can block the disguise.
> If that happens, the game tells you in chat.

## How to play

| What you want | What to do |
|---|---|
| Open the disguise menu | Hold the **Disguise Wand** and tap the screen (or press the **Disguise** button on touch controls) |
| Become a mob | Tap the mob in the menu |
| Use your disguise's special ability | **Crouch + use the wand**, or tap the ability button at the top of the menu |
| Turn back into yourself | Menu, then **Remove Disguise** |
| See every mob's powers | Menu, then **Powers & Help** |
| Change options | Menu, then **Settings** |

**Crafting the wand:** 1 leather (top middle), 2 gold nuggets (left and right of the center), 2 sticks (center and bottom middle).

```
 . L .
 G S G
 . S .
```

You can also run `/function pd/give_wand` (cheats on) or find the wand in the creative inventory (Equipment tab).

### What a disguise does

- **Looks:** your player model is swapped for the real vanilla mob model, texture and
  animations: walking, head turning, attacks, the creeper swelling up, a bee's wings
  buzzing. Your armor, cape and held items are hidden. Zombies and skeletons still hold
  their weapon or bow. Your **name tag is hidden** too, so other players can't tell it's you.
  You can turn name hiding off in Settings.
- **Mobs are fooled:** while disguised you count as that mob for other mobs.
  Zombies ignore a zombie, creepers ignore a creeper, and most monsters ignore you entirely.
  Natural enemies still react:
  - iron golems and snow golems attack monster disguises
  - wolves hunt sheep and skeletons
  - foxes, ocelots and cats hunt chickens
  - zombies and illagers hunt villagers
  - villagers run from zombies
  - skeletons run from wolves

  Mobs that are **already chasing you** may keep chasing, so disguise before they see you!
- **Your movement and inventory stay normal.** Only the listed abilities change.
- **Remove Disguise** puts everything back instantly: your normal look, name, abilities and effects.
  If you die, the disguise falls off.

### The disguises

| Mob | Powers | Weaknesses |
|---|---|---|
| **Zombie** | Strength I; rotten flesh never makes you hungry; immune to poison; zombies and monsters ignore you | Burns in sunlight (a helmet, water, rain or shade keep you safe); golems attack; villagers flee |
| **Skeleton** | Your arrows slow targets; never drowns; immune to poison; monsters ignore you | Burns in sunlight; wolves hunt you (even tame ones); golems attack |
| **Creeper** | **Explode** (crouch + wand lights the fuse, use again to cancel); immune to explosions; struck by lightning, you become a **charged creeper** (double blast) | Cats and ocelots terrify you (slowness + weakness); 10 s recharge; snow golems attack |
| **Spider** | **Wall climbing** (walk into a wall; crouch or look down to hold on and slide down slowly); Speed I; night vision; **Web Shot** places a cobweb | Weak in bright daylight; golems attack |
| **Enderman** | **Teleport** up to 16 blocks where you look (3 s recharge); endermen never get angry at you | **Water and rain hurt you**; golems attack |
| **Villager** | Hero of the Village (trade discounts); iron golems are friendly | Zombies, illagers and vexes hunt you; Weakness I |
| **Pig** | Speed II while holding a carrot, potato or beetroot; monsters ignore you | Weakness I |
| **Cow** | Resistance I; **Milk Cleanse** removes bad effects (30 s recharge); monsters ignore you | Weakness I |
| **Sheep** | No fall damage; **Graze** on grass to heal; monsters ignore you | Wolves hunt you; fire hurts more; Weakness I |
| **Wolf** | Speed I + Strength I; **Howl** boosts nearby players and scares skeletons; skeletons flee from you | Always hungry (Hunger I); llamas spit at you |
| **Chicken** | Slow falling, no fall damage; **Lay Egg** (60 s recharge); monsters ignore you | Foxes, ocelots and cats hunt you; Weakness I |
| **Bee** | **Limited flight** (hold JUMP in the air; wing energy refills on the ground); slow falling; your hits **poison** | Fragile (+1 damage from every hit); can't fly in water or rain |

### Settings (per player)

- Hide my name tag while disguised (on)
- Make mob sounds while disguised (on): idle, hurt and death sounds of the mob
- Show ability timer and bee wings above the hotbar (on)
- Creeper explosions break blocks (off)

### Commands (cheats on) and command blocks

| Command | Effect |
|---|---|
| `/function pd/give_wand` | Get a Disguise Wand |
| `/function pd/menu` | Open the menu |
| `/function pd/disguise/zombie` (or skeleton, creeper, spider, enderman, villager, pig, cow, sheep, wolf, chicken, bee) | Disguise instantly |
| `/function pd/ability` | Use the current ability |
| `/function pd/remove` | Remove your disguise |
| `/function pd/remove_all` | Remove everyone's disguise |
| `/scriptevent pd:disguise <mob>` / `pd:remove` / `pd:menu` / `pd:ability` / `pd:give_wand` | Same, for command blocks: `/execute as @p run scriptevent pd:disguise pig` |

Disguised players get tags (`pd_disguised`, `pd_<mob>`) and the family `pd_disguised`,
so map makers can use selectors like `@a[tag=pd_creeper]`.

## Known limitations

- Your **hitbox and camera stay player-sized**. The model is the real mob size, but the
  game physics stay the same so your movement is not changed.
- In first person you still see your own arm, so you can use items and blocks normally.
- The add-on replaces the vanilla player files. Another add-on that also replaces them
  needs to be below Perfect Disguises in the pack list, or the disguise will not show.
- Mobs that are already attacking you may keep attacking after you disguise.

## For developers

```
perfect-disguises/
├── dist/                          ready-to-install .mcaddon and .mcpack files
├── packs/
│   ├── PerfectDisguises_BP/       behavior pack
│   │   ├── manifest.json
│   │   ├── entities/player.json       vanilla player + disguise groups/events (generated)
│   │   ├── items/disguise_wand.json
│   │   ├── recipes/disguise_wand.json
│   │   ├── functions/pd/...           command shortcuts
│   │   └── scripts/                   main.js, core.js, abilities.js, menu.js, disguises.js
│   └── PerfectDisguises_RP/       resource pack
│       ├── manifest.json
│       ├── entity/player.entity.json  vanilla player + disguise layer (generated)
│       ├── models/entity/pd_*.geo.json            mob models (generated)
│       ├── animations/pd_disguises.animation.json (generated)
│       ├── render_controllers/pd_disguises.render_controllers.json (generated)
│       ├── particles/  textures/  texts/
└── tools/
    ├── generate_from_vanilla.py   builds the generated files from Mojang's bedrock-samples
    ├── make_textures.py           draws the wand, menu icons and pack icons
    └── build_mcaddon.py           validates everything and builds dist/
```

### How it works

- `entities/player.json` is the exact vanilla 1.21.0.26 player plus one component group
  per disguise. Each group sets `minecraft:variant` (the disguise id) and swaps
  `minecraft:type_family`, which is what makes mobs see you as that mob. Extra sensors
  report water and rain to the script (`minecraft:skin_id`).
- `entity/player.entity.json` is the exact vanilla player client entity plus render
  controllers that draw the mob model when `query.variant` matches. The mob models are
  Mojang's own models with every bone renamed (`pd_*`). This means the player's own
  animations never touch them. Empty, zero-scaled bones with the player's bone names
  catch armor, capes and items so nothing floats around the mob.
- The script (`scripts/`) runs the wand menu (`@minecraft/server-ui` ActionFormData),
  the abilities and weaknesses, effects, name hiding and cleanup.

### Adding a disguise (for example an aquatic one)

1. `tools/generate_from_vanilla.py`: add the mob to `DISGUISES` (next free id),
   `MODELS`, `MATERIALS`, `TEXTURES`, `ANIMATE` (animations copied from the vanilla mob)
   and `RENDER_LIST`.
2. `packs/PerfectDisguises_BP/scripts/disguises.js`: add the entry with the same `key`/`id`.
   Water mobs only need **`aquatic: true`**. The script then gives Water Breathing and
   Conduit Power while disguised, and removes them with the disguise.
3. `tools/make_textures.py`: add an 8x8 face for the menu icon.
4. Run:

```sh
git clone --depth 1 --branch v1.21.0.26-preview https://github.com/Mojang/bedrock-samples.git /tmp/bedrock-samples
python3 tools/generate_from_vanilla.py /tmp/bedrock-samples
python3 tools/make_textures.py
python3 tools/build_mcaddon.py
```

---

Not an official Minecraft product. Not approved by or associated with Mojang or Microsoft.
Mob models and animations are derived from Mojang's
[bedrock-samples](https://github.com/Mojang/bedrock-samples) (© Mojang AB), and mob
textures are the game's own textures (referenced, not copied). The wand, icons and
pack art are original.
