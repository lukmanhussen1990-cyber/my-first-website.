#!/usr/bin/env python3
"""Generate the secret bunker .mcfunction files.

UNFINISHED. This script has never been run and the BNK_BP / BNK_RP packs it
targets do not exist yet - there are no manifests, no pack icons, no verifier,
and tools/build.py does not know about them. Nothing here is wired into the
build, so it neither ships nor breaks anything. Work stopped at the user's
request before any of that was done.

Hard rules for this pack, because the previous build did not work on the
user's version:

  1. Vanilla blocks only. No custom blocks means no block format_version to
     be rejected, so there is nothing here that can fail to register.
  2. No block states anywhere. No doors, no beds, no levers, no ladders -
     every one of those needs a "direction"-style state whose valid values
     move between versions. Everything is a bare `fill` or `setblock`.
  3. Nothing above y-2 except the two hatch blocks, so from the surface
     there is nothing to see.
  4. Starter gear comes from /give, not from chests, because Bedrock
     commands cannot put items into a container.

Run from the repo root:  python3 tools/make_bunker.py
"""

import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "BNK_BP", "functions", "bunker")

# --- palette: every one of these has existed since 1.17 or earlier ----------
SHELL = "minecraft:obsidian"            # blast proof, and cheap to fill
FLOOR = "minecraft:polished_deepslate"
CEIL = "minecraft:deepslate_tiles"
WALL = "minecraft:deepslate_bricks"
LAMP = "minecraft:sea_lantern"          # light 15, no state
HATCH = "minecraft:dirt"                # blends into most ground
AIR = "air"

# --- geometry --------------------------------------------------------------
STEPS = 18          # stair cells; also how far below the surface the floor is
INT_X = 6           # interior half width  -> 13 wide
ROOM_NEAR = -18     # interior z nearest the stair
ROOM_FAR = -30      # interior z furthest away
FLOOR_Y = -19       # floor blocks; the player stands on top of these at -18
STAND_Y = FLOOR_Y + 1
CEIL_Y = -14
ROOM_TOP = CEIL_Y - 1      # highest interior air
SHELL_LO = FLOOR_Y - 1
SHELL_HI = CEIL_Y + 1

FILL_LIMIT = 32768
_lines = []


def rel(v):
    return "~" if v == 0 else f"~{v}"


def cmd(text):
    _lines.append(text)


def note(text):
    _lines.append("# " + text)


def blank():
    _lines.append("")


def fill(x1, y1, z1, x2, y2, z2, block):
    volume = (abs(x2 - x1) + 1) * (abs(y2 - y1) + 1) * (abs(z2 - z1) + 1)
    if volume > FILL_LIMIT:
        raise ValueError(f"fill of {volume} blocks exceeds the {FILL_LIMIT} limit")
    cmd(f"fill {rel(x1)} {rel(y1)} {rel(z1)} {rel(x2)} {rel(y2)} {rel(z2)} {block}")


def setblock(x, y, z, block):
    cmd(f"setblock {rel(x)} {rel(y)} {rel(z)} {block}")


def flush(name, header):
    global _lines
    os.makedirs(OUT, exist_ok=True)
    path = os.path.join(OUT, name + ".mcfunction")
    body = "\n".join(["# " + header, ""] + _lines).rstrip() + "\n"
    with open(path, "w") as fh:
        fh.write(body)
    count = sum(1 for line in _lines if line and not line.startswith("#"))
    print(f"wrote {os.path.relpath(path, ROOT)} ({count} commands)")
    _lines = []


# The stair runs straight along -z, one block down per block along.
# Cell k sits at z = -k, its floor block at y = -2-k, and the player stands
# in the two blocks above that.
def stair_floor(k):
    return -2 - k


# =============================================================================
def gen_shell():
    note("Room shell. Obsidian so creepers, TNT and ghasts cannot open it.")
    fill(-INT_X - 1, SHELL_LO, ROOM_FAR - 1, INT_X + 1, SHELL_HI, ROOM_NEAR + 1, SHELL)

    blank()
    note("Hollow it out and face the surfaces.")
    fill(-INT_X, STAND_Y, ROOM_FAR, INT_X, ROOM_TOP, ROOM_NEAR, AIR)
    fill(-INT_X, FLOOR_Y, ROOM_FAR, INT_X, FLOOR_Y, ROOM_NEAR, FLOOR)
    fill(-INT_X, CEIL_Y, ROOM_FAR, INT_X, CEIL_Y, ROOM_NEAR, CEIL)
    fill(-INT_X - 1, STAND_Y, ROOM_FAR, -INT_X - 1, ROOM_TOP, ROOM_NEAR, WALL)
    fill(INT_X + 1, STAND_Y, ROOM_FAR, INT_X + 1, ROOM_TOP, ROOM_NEAR, WALL)
    fill(-INT_X, STAND_Y, ROOM_FAR - 1, INT_X, ROOM_TOP, ROOM_FAR - 1, WALL)
    fill(-INT_X, STAND_Y, ROOM_NEAR + 1, INT_X, ROOM_TOP, ROOM_NEAR + 1, WALL)
    flush("shell", "Bunker room shell. Called by bunker/build.")


def gen_stairs():
    note("Encase the stairwell first, then carve the steps out of it.")
    note("The casing stops at y-2 so the surface is left untouched.")
    fill(-1, stair_floor(STEPS - 1) - 1, -(STEPS - 1), 1, -2, 1, SHELL)

    blank()
    note(f"{STEPS} steps down, one block per block. Walk down, jump back up.")
    for k in range(STEPS):
        floor = stair_floor(k)
        head_top = min(-k, -2)      # never carve the surface layer at y-1
        if floor + 1 <= head_top:
            fill(0, floor + 1, -k, 0, head_top, -k, AIR)

    blank()
    note("Seal the hatch. Two blocks: the one you stand on and the one behind.")
    note("Both are needed - the second step needs head room at surface level.")
    setblock(0, -1, 0, HATCH)
    setblock(0, -1, -1, HATCH)
    flush("stairs", "Hidden stairwell. Called by bunker/build.")


def gen_rooms():
    note("Ceiling lights. Sea lanterns are light 15 and have no block state.")
    for x in (-5, -2, 1, 4):
        for z in range(ROOM_FAR + 1, ROOM_NEAR, 3):
            setblock(x, CEIL_Y, z, LAMP)

    blank()
    note("Workshop along the far wall.")
    for x, block in ((-2, "crafting_table"), (-1, "furnace"), (0, "blast_furnace"),
                     (1, "smoker"), (2, "anvil")):
        setblock(x, STAND_Y, ROOM_FAR, "minecraft:" + block)

    blank()
    note("Storage down both sides. These come empty - see the /give below.")
    for z in range(ROOM_FAR + 2, ROOM_NEAR - 1, 2):
        setblock(-INT_X, STAND_Y, z, "minecraft:chest")
        setblock(INT_X, STAND_Y, z, "minecraft:barrel")

    blank()
    note("Enchanting corner, bookshelves two blocks out from the table.")
    setblock(-3, STAND_Y, -24, "minecraft:enchanting_table")
    for x, z in ((-5, -26), (-3, -26), (-1, -26), (-5, -24),
                 (-1, -24), (-5, -22), (-3, -22), (-1, -22)):
        setblock(x, STAND_Y, z, "minecraft:bookshelf")

    blank()
    note("Brewing bench.")
    setblock(3, STAND_Y, -26, "minecraft:brewing_stand")
    setblock(4, STAND_Y, -26, "minecraft:cauldron")
    flush("rooms", "Lights and furniture. Called by bunker/build.")


def gen_supplies():
    note("Bedrock commands cannot fill chests, so hand the kit over directly.")
    note("A bed is given rather than placed - beds need a block state.")
    for item, count in (("bed", 1), ("torch", 32), ("bread", 16),
                        ("iron_pickaxe", 1), ("oak_planks", 32)):
        cmd(f"give @s minecraft:{item} {count}")
    flush("supplies", "Starter kit. Called by bunker/build.")


def gen_build():
    note("Builds the bunker under you. Needs cheats on.")
    note("Stand on open, flat ground - the stairwell drops straight down.")
    for step in ("shell", "stairs", "rooms", "supplies"):
        cmd(f"function bunker/{step}")
    blank()
    cmd('tellraw @s {"rawtext":[{"text":"§aBunker ready.§r Use §e/function bunker/open§r to lift the hatch and §e/function bunker/close§r to seal it."}]}')
    flush("build", "MAIN ENTRY POINT - run /function bunker/build")


def gen_open():
    note("Lift the hatch. Both blocks, or the second step has no head room.")
    setblock(0, -1, 0, AIR)
    setblock(0, -1, -1, AIR)
    cmd('tellraw @s {"rawtext":[{"text":"§eHatch open.§r Drop in."}]}')
    flush("open", "Opens the hatch - run /function bunker/open")


def gen_close():
    note("Seal the hatch. Run this standing on the surface, not in the hole.")
    setblock(0, -1, 0, HATCH)
    setblock(0, -1, -1, HATCH)
    cmd('tellraw @s {"rawtext":[{"text":"§eHatch sealed.§r Nothing to see up here."}]}')
    flush("close", "Seals the hatch - run /function bunker/close")


def gen_fog():
    note("Close, dark fog for the underground. Comes from the resource pack.")
    cmd("fog @s push bunker:deep bunkerfog")
    flush("fog_on", "Underground fog on - run /function bunker/fog_on")

    note("Back to normal fog.")
    cmd("fog @s remove bunkerfog")
    flush("fog_off", "Underground fog off - run /function bunker/fog_off")


def gen_help():
    for line in (
        "§6Secret Bunker§r",
        "§e/function bunker/build§r - build it where you stand",
        "§e/function bunker/open§r - lift the hatch",
        "§e/function bunker/close§r - seal the hatch",
        "§e/function bunker/fog_on§r / §e/function bunker/fog_off§r - underground fog",
    ):
        cmd('tellraw @s {"rawtext":[{"text":"%s"}]}' % line)
    flush("help", "Lists the commands - run /function bunker/help")


def main():
    gen_build()
    gen_shell()
    gen_stairs()
    gen_rooms()
    gen_supplies()
    gen_open()
    gen_close()
    gen_fog()
    gen_help()


if __name__ == "__main__":
    main()
