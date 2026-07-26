# Secret Underground Bunker — Minecraft Bedrock Add-On

Builds a hidden, fully lit underground bunker anywhere you stand, with one command.
Made for **Minecraft Bedrock on mobile** — uses only block IDs and command
syntax valid in **1.21.0** (your build: `1.21.0.26 beta`, Android).

Download: **`SecretBunker.mcaddon`** (in this repo)

---

## Install on your phone

1. Download `SecretBunker.mcaddon` to your phone.
2. Tap the file. Minecraft opens and imports it. Both packs go in at once.
3. Open (or create) a world → **Settings**.
4. **Behaviour Packs** → *Secret Underground Bunker BP* → **Activate**.
5. **Resource Packs** → *Secret Underground Bunker RP* → **Activate**.
6. In the same settings screen turn **Cheats** → **ON**. This is required —
   functions are commands, they will not run without it.
7. Play. Stand on flat open ground and type in chat:

```
/function bunker/build
```

Wait about a second. Done.

### Other commands

| Command | What it does |
| --- | --- |
| `/function bunker/build` | Builds the bunker where you stand |
| `/function bunker/help` | Shows the room list and where the secrets are |
| `/function bunker/supplies` | Starter kit: beds, torches, food, iron tools |
| `/function bunker/remove` | Fills it back in (stand on the same block you built from) |

---

## What gets built

Everything is placed **relative to you** — the bunker runs **south (+Z)** and
**down**, roughly 20 blocks below the surface.

```
                        surface
        [ boulder ]                    [ boulder ]   <- exit, ~30 blocks east
             |                              |
          ladder                         ladder
             |                              |
   +---------+---------+                    |
   |      AIRLOCK      |                    |
   +---------+---------+                    |
             |                              |
   +------+--+------+----------+            |
   | FARM |   HALL  | WORKSHOP |            |
   +------+         +----------+            |
   |QUARTERS| HALL  | COMMAND  |------------+  escape tunnel
   +------+--+------+----------+
   | VAULT |  <- hidden behind the bookshelves
   +-------+
```

- **Airlock** — where the ladder lands. Furnace, crafting table, chests.
- **Main hall** — iron blast-door frames, deepslate pillars, a caged sea-lantern core.
- **Farm** — irrigated wheat field, fully grown, with composter and hay.
  Sea lanterns give light level 15, so it keeps growing underground.
- **Workshop / armoury** — anvil, grindstone, smithing + cartography table,
  furnaces, blast furnace, smoker, chest row.
- **Living quarters** — bookshelf walls, enchanting table, brewing stand,
  cauldron, jukebox.
- **Command room** — iron console with a redstone-lamp bank, lectern, chest row.

Every room is lit to level 15, so **nothing spawns inside**.

## The secrets

**1. The entrance.** It is a mossy boulder. From ground level it looks like a
rock — the hole is in the **top face**, so you have to climb onto it to find it.
Six decoy rocks are scattered around so one boulder does not stand out.

**2. The vault.** The south wall of the living quarters is a bookshelf wall.
Only the **middle three shelves** have a vault behind them; the rest are solid
rock. Break through, and place a bookshelf back to seal yourself in. Inside:
five chests, an ender chest, gold/diamond/emerald blocks.

**3. The escape tunnel.** Out of the east wall of the command room, 16 blocks
east, then a ladder up into a second boulder about 30 blocks from your front
door.

---

## Why this one works

The house add-on that failed last time probably died on one of these. Each is
handled here:

- **Block names.** Bedrock renamed a lot of blocks (`stone_bricks`,
  `oak_leaves`, `light_gray_concrete`…) in versions *after* 1.21.0. Those names
  do not exist in your build, and every command using one fails silently. This
  pack only uses IDs valid in 1.21.0 — deepslate, iron, cobblestone, sea lanterns.
- **No redstone doors.** Pistons, levers and doors placed by commands need exact
  rotation values and end up sideways or half-broken. There are none here — the
  entrance is a hollow rock and a ladder, which cannot misplace.
- **No entities, no scripting, no experimental toggles.** Nothing to switch on,
  nothing to break on a game update.
- **Sealed shell.** The bunker is carved out of one solid box, so no room can
  open into a cave, aquifer or lava pocket.
- **Zip layout.** The two pack folders sit at the root of the `.mcaddon`. Nested
  one level deeper, Minecraft imports the file and then shows nothing in the list.
- **Fill limits.** Bedrock refuses any `/fill` over 32768 blocks. The largest
  fill here is 6786.

## Building from source

```bash
./build.sh
```

Runs the validator, then zips the two folders into `SecretBunker.mcaddon`.

`tools/validate_build.py` replays every `fill` and `setblock` into a voxel model
of the world and checks that:

- no fill exceeds Bedrock's 32768-block limit,
- you do not get sealed inside your own build,
- every ladder has a solid wall behind it to attach to,
- all nine areas are actually reachable from the entrance hole,
- the vault is **not** reachable until a bookshelf is broken,
- no interior face opens onto untouched terrain (no leaks),
- every sea lantern actually borders a room.
