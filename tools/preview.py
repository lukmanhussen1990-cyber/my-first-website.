#!/usr/bin/env python3
"""Run the build functions against a virtual world and draw the result.

Nothing here talks to Minecraft: the commands are replayed into a dictionary of
blocks, which is then rendered as floor plans (docs/plan_*.png) and printed as
ASCII. It is the quickest way to see that the stairs line up, the pool holds
water and no room ended up without a floor.

Run:  python3 tools/preview.py
"""

import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from make_assets import write_png  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FUNCTIONS = os.path.join(ROOT, "behavior_packs", "luxury_house_bp", "functions")
DOCS = os.path.join(ROOT, "docs")

COORD = re.compile(r"^~(-?\d+)?$")

COLORS = {
    "minecraft:air": None,
    "minecraft:stone": (110, 110, 110),
    "minecraft:dirt": (120, 85, 58),
    "minecraft:grass_block": (85, 145, 70),
    "minecraft:water": (52, 122, 200),
    "minecraft:oak_log": (108, 84, 50),
    "minecraft:oak_leaves": (72, 130, 60),
    "minecraft:quartz_block": (236, 236, 232),
    "minecraft:smooth_quartz": (226, 224, 218),
    "minecraft:quartz_pillar": (244, 242, 236),
    "minecraft:chiseled_quartz_block": (240, 235, 220),
    "minecraft:quartz_stairs": (214, 212, 206),
    "minecraft:quartz_slab": (220, 218, 212),
    "minecraft:white_concrete": (250, 250, 250),
    "minecraft:black_concrete": (28, 30, 34),
    "minecraft:light_gray_carpet": (170, 172, 176),
    "minecraft:red_carpet": (150, 42, 42),
    "minecraft:polished_blackstone": (55, 52, 60),
    "minecraft:gold_block": (232, 190, 70),
    "minecraft:glass": (188, 220, 236),
    "minecraft:glass_pane": (200, 228, 240),
    "minecraft:sea_lantern": (255, 246, 200),
    "minecraft:lantern": (240, 200, 120),
    "minecraft:dark_oak_planks": (74, 52, 30),
    "minecraft:dark_oak_stairs": (88, 62, 36),
    "minecraft:dark_oak_slab": (96, 68, 40),
    "minecraft:dark_oak_fence": (82, 58, 34),
    "minecraft:dark_oak_door": (110, 78, 44),
    "minecraft:bed": (190, 60, 60),
    "minecraft:chest": (150, 110, 60),
    "minecraft:barrel": (140, 104, 58),
    "minecraft:furnace": (120, 120, 120),
    "minecraft:blast_furnace": (100, 100, 108),
    "minecraft:smoker": (110, 96, 80),
    "minecraft:crafting_table": (150, 108, 62),
    "minecraft:cauldron": (80, 80, 84),
    "minecraft:brewing_stand": (150, 130, 100),
    "minecraft:enchanting_table": (120, 60, 120),
    "minecraft:bookshelf": (160, 122, 70),
    "minecraft:jukebox": (100, 72, 44),
    "minecraft:campfire": (200, 110, 50),
    "minecraft:flower_pot": (170, 100, 70),
    "minecraft:ladder": (150, 120, 70),
}

ASCII = {
    "minecraft:air": " ", "minecraft:water": "~", "minecraft:glass": "o",
    "minecraft:glass_pane": "'", "minecraft:sea_lantern": "*",
    "minecraft:dark_oak_door": "D", "minecraft:bed": "B", "minecraft:chest": "C",
}


def parse(token):
    match = COORD.match(token)
    if not match:
        raise ValueError("not a tilde coordinate: %r" % token)
    return int(match.group(1) or 0)


def split_command(line):
    tokens, depth, current = [], 0, ""
    for char in line:
        if char == "[":
            depth += 1
        elif char == "]":
            depth -= 1
        if char == " " and depth == 0:
            if current:
                tokens.append(current)
            current = ""
        else:
            current += char
    if current:
        tokens.append(current)
    return tokens


class World(dict):
    def set(self, x, y, z, block, keep=False):
        if keep and self.get((x, y, z), "minecraft:air") != "minecraft:air":
            return
        if block == "minecraft:air":
            self.pop((x, y, z), None)
        else:
            self[(x, y, z)] = block

    def at(self, x, y, z):
        return self.get((x, y, z), "minecraft:air")


def run(world, name, depth=0):
    path = os.path.join(FUNCTIONS, name + ".mcfunction")
    with open(path) as handle:
        for raw in handle:
            line = raw.strip()
            if not line or line.startswith("#"):
                continue
            tokens = split_command(line)
            head = tokens[0]
            if head == "function":
                run(world, tokens[1], depth + 1)
            elif head == "setblock":
                x, y, z = (parse(t) for t in tokens[1:4])
                world.set(x, y, z, tokens[4])
            elif head == "fill":
                x1, y1, z1, x2, y2, z2 = (parse(t) for t in tokens[1:7])
                block = tokens[7]
                mode = [t for t in tokens[8:] if not t.startswith("[")]
                keep = mode and mode[0] == "keep"
                for x in range(min(x1, x2), max(x1, x2) + 1):
                    for y in range(min(y1, y2), max(y1, y2) + 1):
                        for z in range(min(z1, z2), max(z1, z2) + 1):
                            world.set(x, y, z, block, keep=keep)


def bounds(world):
    xs = [key[0] for key in world]
    ys = [key[1] for key in world]
    zs = [key[2] for key in world]
    return (min(xs), max(xs)), (min(ys), max(ys)), (min(zs), max(zs))


def plan_png(world, y, path, scale=14):
    (x1, x2), _, (z1, z2) = bounds(world)
    rows = []
    for z in range(z1, z2 + 1):
        row = []
        for x in range(x1, x2 + 1):
            color = None
            shade = 1.0
            for depth in range(0, 8):
                block = world.at(x, y - depth, z)
                if block != "minecraft:air":
                    color = COLORS.get(block, (255, 0, 255))
                    shade = 1.0 if depth == 0 else max(0.45, 0.8 - depth * 0.05)
                    break
            if color is None:
                color = (18, 20, 26)
            row.extend([tuple(int(channel * shade) for channel in color)] * scale)
        rows.extend([row] * scale)
    write_png(path, rows)


def plan_ascii(world, y, x_range, z_range):
    lines = []
    for z in range(z_range[0], z_range[1] + 1):
        line = ""
        for x in range(x_range[0], x_range[1] + 1):
            block = world.at(x, y, z)
            if block in ASCII:
                line += ASCII[block]
            elif block == "minecraft:air":
                line += "." if world.at(x, y - 1, z) != "minecraft:air" else " "
            else:
                line += "#"
        lines.append(line)
    return lines


                                                                          # noqa: E305
# --- can you actually walk from the front door to every room? ----------------

OX, OZ = -15, -31

PASSABLE = {
    "minecraft:air", "minecraft:red_carpet", "minecraft:light_gray_carpet",
    "minecraft:flower_pot", "minecraft:dark_oak_door", "minecraft:ladder",
    "minecraft:water",
}

# local (x, y, z) spots the player must be able to reach from the front steps
LANDMARKS = [
    ("kitchen", (17, 1, 8)),
    ("dining room", (17, 1, 17)),
    ("lounge", (7, 1, 18)),
    ("guest bathroom", (6, 1, 8)),
    ("utility room", (6, 1, 11)),
    ("upstairs landing", (12, 6, 7)),
    ("master bedroom", (11, 6, 17)),
    ("spa bathroom", (6, 6, 8)),
    ("library", (17, 6, 8)),
    ("guest bedroom", (17, 6, 19)),
    ("balcony", (12, 6, 22)),
    ("roof terrace", (16, 11, 20)),
    ("hot tub", (19, 11, 16)),
    ("pool deck", (25, 0, 20)),
    ("fountain", (7, 0, 24)),
    ("back garden", (9, 0, 2)),
]

START = (12, 1, 22)  # standing on the front porch


def passable(world, x, y, z):
    return world.at(x, y, z) in PASSABLE


def standable(world, x, y, z):
    return (passable(world, x, y, z)
            and passable(world, x, y + 1, z)
            and not passable(world, x, y - 1, z))


def reachable(world, start):
    """Flood fill of everywhere a player can walk, stepping up or down one block."""
    sx, sy, sz = start[0] + OX, start[1], start[2] + OZ
    if not standable(world, sx, sy, sz):
        # let the start settle onto the ground
        for drop in range(1, 5):
            if standable(world, sx, sy - drop, sz):
                sy -= drop
                break
    seen = {(sx, sy, sz)}
    queue = [(sx, sy, sz)]
    while queue:
        x, y, z = queue.pop()
        for dx, dz in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            for dy in (1, 0, -1, -2, -3):
                nx, ny, nz = x + dx, y + dy, z + dz
                if (nx, ny, nz) in seen or not standable(world, nx, ny, nz):
                    continue
                if dy == 1 and not passable(world, x, y + 2, z):
                    continue  # no headroom to climb
                seen.add((nx, ny, nz))
                queue.append((nx, ny, nz))
    return seen


def check_routes(world):
    seen = reachable(world, START)
    print("\n== walkable check == (from the front porch, %d reachable spots)" % len(seen))
    failures = 0
    for name, (lx, ly, lz) in LANDMARKS:
        spot = (lx + OX, ly, lz + OZ)
        ok = spot in seen
        if not ok:
            # a landmark one block off is still fine, look at the neighbours
            ok = any((spot[0] + dx, spot[1] + dy, spot[2] + dz) in seen
                     for dx in (-1, 0, 1) for dz in (-1, 0, 1) for dy in (-1, 0, 1))
        print("   %-18s %s" % (name, "reachable" if ok else "NOT REACHABLE"))
        failures += 0 if ok else 1
    return failures


def main():
    world = World()
    run(world, "lux/build")
    (x1, x2), (y1, y2), (z1, z2) = bounds(world)
    print("%d blocks placed" % len(world))
    print("bounds x %d..%d  y %d..%d  z %d..%d" % (x1, x2, y1, y2, z1, z2))

    os.makedirs(DOCS, exist_ok=True)
    plan_png(world, 2, os.path.join(DOCS, "plan_ground_floor.png"))
    plan_png(world, 7, os.path.join(DOCS, "plan_upper_floor.png"))
    plan_png(world, 12, os.path.join(DOCS, "plan_roof.png"))
    plan_png(world, 0, os.path.join(DOCS, "plan_grounds.png"))

    for label, y in (("ground floor (y+2)", 2), ("upper floor (y+7)", 7), ("roof (y+12)", 12)):
        print("\n== %s ==   # solid  . floor  o glass  D door  B bed  * light" % label)
        for line in plan_ascii(world, y, (-12, 6), (-27, -8)):
            print("  " + line)

    return 1 if check_routes(world) else 0


if __name__ == "__main__":
    sys.exit(main())
