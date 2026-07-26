# Minecraft Bedrock Addons

Two mobile-ready Bedrock addons (Android / iOS / Windows / Console). Each one ships as
a behavior pack + resource pack, bundled into a single `.mcaddon` you tap to import.

| Addon | Download | What it is |
| --- | --- | --- |
| **One Punch Man** | [`dist/OnePunchMan.mcaddon`](https://github.com/lukmanhussen1990-cyber/my-first-website./raw/claude/one-punch-man-minecraft-mod-3fps55/dist/OnePunchMan.mcaddon) | Normal Punch and Serious Punch items |
| **Security House** | [`dist/SecurityHouse.mcaddon`](https://github.com/lukmanhussen1990-cyber/my-first-website./raw/claude/one-punch-man-minecraft-mod-3fps55/dist/SecurityHouse.mcaddon) | One command builds a fortified one-floor house |

### Installing (same for both)

1. Download the `.mcaddon` onto your phone (on GitHub: open the file → **Download raw file**).
2. Open it. Android offers "Open with Minecraft"; on iOS use **Share → Copy to Minecraft**.
3. Minecraft imports both packs automatically.
4. In your world settings → **Behavior Packs** → activate it. The matching resource pack
   comes along as a dependency.

No experimental toggles and no scripting in either addon. If a browser saves the file as
`.zip`, rename it back to `.mcaddon`.

---

# 1. One Punch Man

| Item | How you use it | What it does |
| --- | --- | --- |
| **Normal Punch** | Tap/hold to throw the shockwave, or hit a mob directly | 25 melee damage. Fires a fist shockwave that flies straight and detonates on impact — 30 impact damage plus a TNT-sized crater. 0.75s cooldown. |
| **Serious Punch** | Same, but hold on to something | 120 melee damage. Fires a wave that **carves a tunnel of explosions through the terrain as it flies**, then finishes with a huge blast on impact (200 impact damage). Chews through obsidian and bedrock. 8s cooldown. |

Both are throwable *and* melee weapons, never break, and sit in the creative inventory
under **Equipment → Sword**.

```
/give @s opm:normal_punch
/give @s opm:serious_punch
```

Survival crafting — **Normal Punch** is 4 leather around an iron block; **Serious Punch**
is 4 diamond blocks + 4 netherite ingots around a Normal Punch:

```
 L          DND
LIL         NPN
 L          DND
```

### Tuning the destruction

Everything lives in the `minecraft:explode` components. Higher `power` = bigger crater.

| What you want | File | Change |
| --- | --- | --- |
| Bigger normal punch crater | `OPM_BP/entities/normal_punch_wave.json` | `power` (currently `3.5`, TNT is `4`) |
| Bigger serious punch finish | `OPM_BP/entities/serious_punch_wave.json` | `power` (currently `8`) |
| Denser destruction tunnel | `OPM_BP/entities/serious_blast.json` | `power` (currently `3.5`) |
| Longer destruction tunnel | `OPM_BP/entities/serious_punch_wave.json` | `minecraft:timer` `time` (currently `3.0`s of flight) |
| More blasts along the tunnel | `OPM_BP/entities/serious_punch_wave.json` | `min_wait_time` / `max_wait_time` (currently `0.2`s apart) |
| **Stop it eating obsidian and bedrock** | `serious_punch_wave.json` + `serious_blast.json` | delete the `"max_resistance": 5.0` lines |

Two things before you crank the numbers:

- **`max_resistance: 5.0` on the Serious Punch is deliberate.** It caps every block's blast
  resistance at 5, which is what lets it blow through obsidian, ancient debris and
  **bedrock** — including the world floor and the Nether roof. Series-accurate, but it
  will punch holes in terrain you may care about.
- **Mobile performance.** Blocks destroyed scale roughly cubically with `power`. Power `8`
  is already thousands of blocks per blast, and the serious punch fires ~15 trail blasts on
  top of that. Past ~12 a phone will stutter badly. Raise it in small steps.

---

# 2. Security House

One command drops a fully sealed, blast-proof compound around you.

```
/function house/build      build it where you stand
/function house/remove     delete it again
```

Needs **cheats enabled** (that's what `/function` requires — nothing else). Stand where you
want the middle of the living room, on flat-ish ground, and run it. The command clears
terrain in a 33×33 footprint first, so don't run it inside a base you like.

### What you get

`#` reinforced wall · `V` vault wall · `D` iron door · `l` lever · `p` pressure plate
`c` chest · `b` bed · `B` bookshelf · `E` enchanting table · `o` workstation

```
    #########################
    #########################        outer wall, 2 blocks thick, 8 tall
    ##                     ##
    ## p        p        p ##        patrol corridor, roofed over
    ##                     ##
    ##   ###############   ##
    ##   #ccccV    oooo#   ##        vault (top left) + workshop
    ##   #c   V       o#   ##
    ##   #c   V       o#   ##
    ##   #c l V       o#   ##
    ##   #VVDVV       o#   ##        vault door
    ##   #  l         o#   ##
    ## p #             # p ##        <- you stand here
    ##   #o       B B B#   ##
    ##   #             #   ##
    ##   #b       B E B#   ##        bed + enchanting corner
    ##   #b            #   ##
    ##   #        B B o#   ##
    ##   #cccc  l    cc#   ##
    ##   ######DD#######   ##        front door
    ##         l           ##
    ## p    p       p    p ##
    ##         pp          ##        entry alarm
    ########### l###########
    ###########DD###########         main gate
                l
```

Security, layer by layer from the outside in:

1. **Lava moat** — a one-deep trench ringing the whole platform, with a single causeway
   lined up with the gate.
2. **Anti-climb overhang** — the perimeter wall's top row juts out one block, so spiders
   can't come over the outside face.
3. **Double perimeter wall** — 2 blocks thick, 8 tall, 1200 explosion resistance. Creeper
   and TNT proof.
4. **Roofed compound** — the whole 25×25 area is capped at head height +8, so nothing
   drops, flies or shoots in. An iron-bar parapet makes the roof safe to walk.
5. **Patrol corridor** — a lit ring between the outer wall and the house, seeded with
   **9 arrow traps** (dispenser in the floor facing up, pressure plate on top).
6. **Entry alarm** — plates just inside the gate light redstone lamps and sound note
   blocks, so anything coming through is loud and visible.
7. **Iron doors at every threshold** — gate, front door, vault. Iron doors can't be opened
   by hand or by mobs; each one has a lever on both sides.
8. **The house** — 13×13 interior, 900-resistance walls, blast glass windows, sealed
   ceiling.
9. **Vault** — 4×4 safe room in the corner behind its own iron door, walls at 3600
   explosion resistance, lined with chests.
10. **Solid foundation** — two full layers under the floor, so nothing tunnels or spawns
    from below.
11. **Alarm lamps everywhere** — 66 of them in the floors and ceilings at light level 15,
    so there is nowhere dark enough to spawn in.

Fitted out with: bed, crafting table, furnace, blast furnace, smoker, anvil, grindstone,
cartography table, stonecutter, loom, brewing stand, cauldron, enchanting table ringed by
bookshelves, and 15 chests.

### Two things you have to do yourself

- **Load the arrow traps.** Bedrock commands cannot put items into containers, so the nine
  dispensers are placed but empty. Drop arrows in them.
- **Chests come empty**, for the same reason.

### The blocks

All five are craftable and usable on their own, in the creative menu under Construction.

| Block | Mining | Blast resistance | Notes |
| --- | --- | --- | --- |
| Reinforced Wall | 12.5s | 1200 | main structure |
| Security Floor | 9.0s | 900 | floors |
| Vault Wall | 20.0s | 3600 | toughest block in the pack |
| Blast Glass | 6.0s | 900 | see-through, still blast proof |
| Alarm Lamp | 3.0s | 900 | light level 15 |

For reference, vanilla obsidian is 1200 and stone is 6.

### Resizing the house

`tools/make_house.py` is the source of truth — the `.mcfunction` files are generated from
it. The footprint constants sit at the top:

```python
APRON = 16      # outer edge of the platform
MOAT  = 14      # lava trench ring
PERIM_IN, PERIM_OUT = 11, 12   # perimeter wall
HOUSE = 7       # house wall
INT   = 6       # interior half-width
```

Change them, then:

```bash
python3 tools/make_house.py     # regenerate the commands
python3 tools/verify_house.py   # prove the result is still sealed
python3 tools/build.py          # revalidate and rebuild dist/
```

`fill` refuses more than 32768 blocks per command, and `make_house.py` raises if a change
pushes a fill over that.

---

## Repository layout

```
OPM_BP/ OPM_RP/     One Punch Man behavior + resource pack
SEC_BP/ SEC_RP/     Security House behavior + resource pack
  SEC_BP/blocks/           the five custom blocks
  SEC_BP/functions/house/  build.mcfunction and the steps it calls
dist/               the two .mcaddon bundles
tools/
  make_textures.py        One Punch Man item icons
  make_house_textures.py  Security House block textures
  make_house.py           generates the house .mcfunction files
  verify_house.py         replays the build in a voxel grid, proves it is sealed
  build.py                validates every pack, rebuilds both .mcaddon files
```

`build.py` checks that every JSON parses, that pack UUIDs are unique, that each item's
`projectile_entity` exists, that every custom entity has a client-side definition, that
every icon and block texture resolves to a real PNG, and that no `.mcfunction` references
a block or function that doesn't exist.

`verify_house.py` replays `house/build` into a voxel grid and asserts you aren't entombed,
that the ceiling and roof have no holes, that flood fill from open ground reaches neither
the corridor nor the living room, and that every lever is adjacent to a door it can drive.

## Compatibility

- One Punch Man: stable formats (items `1.20.30`, entities `1.16.0`, recipes `1.20.10`),
  `min_engine_version` `1.20.0`.
- Security House: blocks use format `1.21.0`, `min_engine_version` `1.21.0`.
- Neither needs experimental toggles or scripting, so both work on mobile, on Realms and
  in multiplayer.

One consequence of running both at once: the Serious Punch's `max_resistance: 5.0` caps
*every* block's blast resistance, so it goes through the security house too. Nothing in
Minecraft stops Saitama.

## Status / what wasn't verified

Both addons are structurally validated by `tools/build.py`, and the house geometry is
verified by simulation in `tools/verify_house.py`. Neither has been launched in an actual
Minecraft client from this environment — there is no Bedrock client here — so damage
numbers, explosion sizes and block-state rotations are design targets, not measured
results.

Specifically worth checking in game, because they are the parts a simulation can't prove:

- **Door and bed rotations.** Iron doors and beds carry a `direction` block state. If one
  lands facing an odd way, break it and place it again — the geometry around it is right.
- If Minecraft reports a content error on import, **Settings → Creator → Content Log**
  names the exact file.
