#!/usr/bin/env python3
"""Generate the security house .mcfunction files.

Everything is emitted with ~ relative coordinates, so the house is built around
whoever runs `/function house/build`. The player ends up standing in the middle
of the ground floor.

Run from the repo root:  python3 tools/make_house.py

Layout, looking down (the entrance faces south / +z):

    +-------------------------------  lava moat            r = 14
    |  +----------------------------  anti-climb lip       r = 13
    |  |  +-------------------------  perimeter wall x2    r = 11..12
    |  |  |  +----------------------  patrol corridor      r = 8..10
    |  |  |  |  +-------------------  house wall           r = 7
    |  |  |  |  |  +----------------  interior 13x13       r = 0..6

Vertically (y is relative to the player's feet):

    y +9  iron bar parapet on the compound roof
    y +8  compound roof (seals the corridor and courtyard)
    y +7  perimeter wall top + overhang lip
    y +5  house ceiling
    y  0..+4  house interior, 5 blocks tall
    y -1  floor surface
    y -3..-2  solid foundation
"""

import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "SEC_BP", "functions", "house")

# --- palette -----------------------------------------------------------------
WALL = "sec:reinforced_wall"
FLOOR = "sec:security_floor"
VAULT = "sec:vault_wall"
GLASS = "sec:blast_glass"
LAMP = "sec:alarm_lamp"
AIR = "air"
BARS = "minecraft:iron_bars"
LAVA = "minecraft:lava"

# --- footprint ---------------------------------------------------------------
APRON = 16      # outer edge of the concrete platform
MOAT = 14       # lava trench ring
LIP = 13        # anti-climb overhang
PERIM_IN = 11   # perimeter wall, inner face
PERIM_OUT = 12  # perimeter wall, outer face
HOUSE = 7       # house wall
INT = 6         # interior half-width

FOUND_BOT = -3
FLOOR_Y = -1
WALL_TOP = 4
CEIL = 5
PERIM_TOP = 7
ROOF = 8
PARAPET = 9

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


def fill(x1, y1, z1, x2, y2, z2, block, mode=None):
    volume = (abs(x2 - x1) + 1) * (abs(y2 - y1) + 1) * (abs(z2 - z1) + 1)
    if volume > FILL_LIMIT:
        raise ValueError(f"fill of {volume} blocks exceeds the {FILL_LIMIT} limit: {block}")
    tail = f" {mode}" if mode else ""
    cmd(
        f"fill {rel(x1)} {rel(y1)} {rel(z1)} {rel(x2)} {rel(y2)} {rel(z2)} {block}{tail}"
    )


def setblock(x, y, z, block, states=""):
    # Bedrock takes block states as a separate argument, so keep the space.
    tail = f" {states}" if states else ""
    cmd(f"setblock {rel(x)} {rel(y)} {rel(z)} {block}{tail}")


def ring(inner, outer, y0, y1, block):
    """Square ring: every column whose max(|x|,|z|) falls in [inner, outer]."""
    fill(-outer, y0, -outer, outer, y1, -inner, block)          # north band
    fill(-outer, y0, inner, outer, y1, outer, block)            # south band
    fill(-outer, y0, -(inner - 1), -inner, y1, inner - 1, block)  # west band
    fill(inner, y0, -(inner - 1), outer, y1, inner - 1, block)    # east band


def door(x, y, z, direction, hinge=False):
    """Iron door: both halves. Iron doors need redstone, so pair with a lever."""
    common = f'"direction":{direction},"door_hinge_bit":{str(hinge).lower()},"open_bit":false'
    setblock(x, y, z, "minecraft:iron_door", f'[{common},"upper_block_bit":false]')
    setblock(x, y + 1, z, "minecraft:iron_door", f'[{common},"upper_block_bit":true]')


def lever(x, y, z):
    """Floor lever. Must sit orthogonally next to a door block to drive it."""
    setblock(x, y, z, "minecraft:lever", '["lever_direction":"up_north_south","open_bit":false]')


def arrow_trap(x):
    """Dispenser in the floor aiming straight up, with a plate on top of it.

    Load the dispensers with arrows yourself - Bedrock commands cannot put
    items into containers.
    """
    def build(px, pz):
        setblock(px, FLOOR_Y, pz, "minecraft:dispenser", '["facing_direction":1]')
        setblock(px, 0, pz, "minecraft:heavy_weighted_pressure_plate")
    return build


def flush(name, header):
    global _lines
    path = os.path.join(OUT, name + ".mcfunction")
    os.makedirs(OUT, exist_ok=True)
    body = "\n".join(["# " + header, ""] + _lines).rstrip() + "\n"
    with open(path, "w") as fh:
        fh.write(body)
    count = sum(1 for line in _lines if line and not line.startswith("#"))
    print(f"wrote {os.path.relpath(path, ROOT)} ({count} commands)")
    _lines = []


# =============================================================================
def gen_clear():
    note("Flatten everything in the build envelope, terrain and all.")
    fill(-APRON, FOUND_BOT, -APRON, APRON, 20, APRON, AIR)
    flush("clear", "Clears the build envelope. Called by house/build.")


def gen_foundation():
    note("Solid slab so nothing can tunnel or spawn underneath.")
    fill(-APRON, FOUND_BOT, -APRON, APRON, -2, APRON, WALL)
    note("Walking surface.")
    fill(-APRON, FLOOR_Y, -APRON, APRON, FLOOR_Y, APRON, FLOOR)

    blank()
    note("Lava moat: a one-deep trench so nothing wanders in from open ground.")
    ring(MOAT, MOAT, FLOOR_Y, FLOOR_Y, AIR)
    ring(MOAT, MOAT, -2, -2, LAVA)
    note("Causeway over the moat, lined up with the gate.")
    fill(-1, FLOOR_Y, MOAT, 1, FLOOR_Y, MOAT, FLOOR)
    flush("foundation", "Platform, floor and lava moat. Called by house/build.")


def gen_perimeter():
    note("Double-thickness outer wall, 8 blocks tall.")
    ring(PERIM_IN, PERIM_OUT, 0, PERIM_TOP, WALL)

    blank()
    note("Overhang at the top so spiders cannot climb over the outside face.")
    ring(LIP, LIP, PERIM_TOP, PERIM_TOP, WALL)

    blank()
    note("Roof over the whole compound - nothing drops or flies in.")
    fill(-PERIM_OUT, ROOF, -PERIM_OUT, PERIM_OUT, ROOF, PERIM_OUT, WALL)
    note("Bar parapet so the roof is safe to stand on.")
    ring(PERIM_OUT, PERIM_OUT, PARAPET, PARAPET, BARS)

    blank()
    note("Gate: 2-wide opening through both wall layers, double iron door.")
    fill(-1, 0, PERIM_IN, 0, 1, PERIM_OUT, AIR)
    door(-1, 0, PERIM_OUT, 1, hinge=False)
    door(0, 0, PERIM_OUT, 1, hinge=True)
    note("Levers - iron doors only move on redstone.")
    lever(0, 0, PERIM_IN)
    lever(-1, 0, LIP)
    flush("perimeter", "Outer wall, roof and gate. Called by house/build.")


def gen_shell():
    note("House wall and ceiling inside the compound.")
    ring(HOUSE, HOUSE, 0, WALL_TOP, WALL)
    fill(-HOUSE, CEIL, -HOUSE, HOUSE, CEIL, HOUSE, WALL)

    blank()
    note("Blast glass windows - 900 explosion resistance, same as the walls.")
    for a, b in ((-5, -3), (3, 5)):
        fill(a, 2, -HOUSE, b, 3, -HOUSE, GLASS)   # north
        fill(a, 2, HOUSE, b, 3, HOUSE, GLASS)     # south
        fill(-HOUSE, 2, a, -HOUSE, 3, b, GLASS)   # west
        fill(HOUSE, 2, a, HOUSE, 3, b, GLASS)     # east

    blank()
    note("Front door, in line with the gate.")
    fill(-1, 0, HOUSE, 0, 1, HOUSE, AIR)
    door(-1, 0, HOUSE, 1, hinge=False)
    door(0, 0, HOUSE, 1, hinge=True)
    lever(0, 0, INT)
    lever(-1, 0, HOUSE + 1)
    flush("shell", "House walls, windows and front door. Called by house/build.")


def gen_vault():
    note("Vault in the north-west corner: 3600 explosion resistance walls.")
    fill(-2, 0, -INT, -2, WALL_TOP, -2, VAULT)
    fill(-INT, 0, -2, -3, WALL_TOP, -2, VAULT)

    blank()
    note("Vault door.")
    fill(-4, 0, -2, -4, 1, -2, AIR)
    door(-4, 0, -2, 1, hinge=False)
    lever(-4, 0, -1)
    lever(-4, 0, -3)

    blank()
    note("Storage. Chests come empty.")
    for z in range(-INT, -2):
        setblock(-INT, 0, z, "minecraft:chest")
    for x in range(-5, -2):
        setblock(x, 0, -INT, "minecraft:chest")
    flush("vault", "Safe room inside the house. Called by house/build.")


def gen_interior():
    note("Workshop along the north wall.")
    for x, block in ((3, "crafting_table"), (4, "furnace"), (5, "blast_furnace"), (6, "smoker")):
        setblock(x, 0, -INT, "minecraft:" + block)

    blank()
    note("Tool bench along the east wall.")
    for z, block in ((-5, "anvil"), (-4, "grindstone"), (-3, "cartography_table"),
                     (-2, "stonecutter_block"), (-1, "loom")):
        setblock(INT, 0, z, "minecraft:" + block)

    blank()
    note("Enchanting corner: table ringed by bookshelves two blocks out.")
    setblock(4, 0, 3, "minecraft:enchanting_table")
    for x, z in ((2, 1), (2, 3), (2, 5), (4, 1), (4, 5), (6, 1), (6, 3), (6, 5)):
        setblock(x, 0, z, "minecraft:bookshelf")

    blank()
    note("Living quarters along the west wall.")
    setblock(-INT, 0, 4, "minecraft:bed", '["direction":0,"head_piece_bit":false,"occupied_bit":false]')
    setblock(-INT, 0, 3, "minecraft:bed", '["direction":0,"head_piece_bit":true,"occupied_bit":false]')
    setblock(-INT, 0, 1, "minecraft:cauldron")
    setblock(INT, 0, 5, "minecraft:brewing_stand")

    blank()
    note("General storage along the south wall, clear of the doorway.")
    for x in (-INT, -5, -4, -3, 5, INT):
        setblock(x, 0, INT, "minecraft:chest")
    flush("interior", "Furniture and workstations. Called by house/build.")


def gen_lights():
    note("Alarm lamps emit light 15. Full coverage means nothing spawns inside.")
    note("House ceiling.")
    for x in (-5, -2, 1, 4):
        for z in (-5, -2, 1, 4):
            setblock(x, CEIL, z, LAMP)

    blank()
    note("House floor.")
    for x in (-5, -1, 3):
        for z in (-5, -1, 3):
            setblock(x, FLOOR_Y, z, LAMP)

    blank()
    note("Patrol corridor - lamps in the roof and in the floor.")
    for t in range(-9, 10, 3):
        for x, z in ((t, -9), (t, 9), (-9, t), (9, t)):
            setblock(x, ROOF, z, LAMP)
            setblock(x, FLOOR_Y, z, LAMP)
    flush("lights", "Alarm lamps everywhere. Called by house/build.")


def gen_security():
    note("Arrow traps: dispenser in the floor facing up, pressure plate on top.")
    note("Deliberately off the entrance path so you do not shoot yourself.")
    place = arrow_trap(0)
    for x, z in ((9, 9), (-9, 9), (9, -9), (-9, -9),
                 (9, 0), (-9, 0), (0, -9),
                 (4, 9), (-4, 9)):
        place(x, z)

    blank()
    note("Entry alarm: plates just inside the gate power the lamps and note")
    note("blocks buried beside them, so anything coming through is loud and lit.")
    for x in (-1, 0):
        setblock(x, 0, 10, "minecraft:heavy_weighted_pressure_plate")
        setblock(x, FLOOR_Y, 11, "minecraft:noteblock")
    setblock(-2, FLOOR_Y, 10, "minecraft:redstone_lamp")
    setblock(1, FLOOR_Y, 10, "minecraft:redstone_lamp")
    flush("security", "Arrow traps and the entry alarm. Called by house/build.")


def gen_build():
    note("Builds the whole compound around you. Needs cheats enabled.")
    note("Stand where you want the middle of the living room to be.")
    for step in ("clear", "foundation", "perimeter", "shell", "vault",
                 "interior", "lights", "security"):
        cmd(f"function house/{step}")
    blank()
    cmd('tellraw @s {"rawtext":[{"text":"§aSecurity house built.§r Load the dispensers with arrows, and use the levers to work the iron doors."}]}')
    flush("build", "MAIN ENTRY POINT - run /function house/build")


def gen_remove():
    note("Wipes the whole envelope back to air. Same footprint as house/clear.")
    note("Anything you left in a chest goes with it.")
    fill(-APRON, FOUND_BOT, -APRON, APRON, 20, APRON, AIR)
    cmd('tellraw @s {"rawtext":[{"text":"§eSecurity house removed.§r"}]}')
    flush("remove", "Deletes the house - run /function house/remove")


def main():
    gen_build()
    gen_clear()
    gen_foundation()
    gen_perimeter()
    gen_shell()
    gen_vault()
    gen_interior()
    gen_lights()
    gen_security()
    gen_remove()


if __name__ == "__main__":
    main()
