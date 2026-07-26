#!/usr/bin/env python3
"""Simulate house/build in a voxel grid and assert the compound is actually sealed.

Reads the generated .mcfunction files, replays every fill/setblock into a dict,
then flood-fills from the player's feet. If air escapes the build envelope, the
house has a hole in it.

Run from the repo root:  python3 tools/verify_house.py
"""

import collections
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FUNCS = os.path.join(ROOT, "SEC_BP", "functions")

# Blocks a player or mob can move through.
PASSABLE = {
    "air",
    "minecraft:air",
    "minecraft:lever",
    "minecraft:heavy_weighted_pressure_plate",
}

BOUND = 20        # the build envelope only reaches +-16 horizontally
APRON_EDGE = 16   # outer edge of the platform, i.e. open ground
Y_LO, Y_HI = -6, 24


def parse_rel(token):
    if token == "~":
        return 0
    if not token.startswith("~"):
        raise ValueError(f"expected a relative coordinate, got {token!r}")
    return int(token[1:])


def run(name, world, seen=None):
    seen = seen if seen is not None else set()
    if name in seen:
        raise ValueError(f"recursive function call: {name}")
    seen.add(name)

    path = os.path.join(FUNCS, name + ".mcfunction")
    with open(path) as fh:
        for raw in fh:
            line = raw.strip()
            if not line or line.startswith("#"):
                continue
            parts = line.split()
            verb = parts[0]
            if verb == "function":
                run(parts[1], world, seen)
            elif verb == "fill":
                x1, y1, z1, x2, y2, z2 = (parse_rel(t) for t in parts[1:7])
                block = parts[7]
                for x in range(min(x1, x2), max(x1, x2) + 1):
                    for y in range(min(y1, y2), max(y1, y2) + 1):
                        for z in range(min(z1, z2), max(z1, z2) + 1):
                            world[(x, y, z)] = block
            elif verb == "setblock":
                x, y, z = (parse_rel(t) for t in parts[1:4])
                world[(x, y, z)] = parts[4]
            elif verb in ("tellraw", "say"):
                continue
            else:
                raise ValueError(f"{name}: unhandled command {verb!r}")
    return world


def is_open(world, pos):
    return world.get(pos, "air") in PASSABLE


def flood(world, start):
    """Reachable open cells from start. Returns (cells, escaped)."""
    seen = {start}
    queue = collections.deque([start])
    escaped = False
    while queue:
        x, y, z = queue.popleft()
        if max(abs(x), abs(z)) > BOUND or y < Y_LO or y > Y_HI:
            escaped = True
            continue
        for dx, dy, dz in ((1, 0, 0), (-1, 0, 0), (0, 1, 0), (0, -1, 0), (0, 0, 1), (0, 0, -1)):
            nxt = (x + dx, y + dy, z + dz)
            if nxt in seen or not is_open(world, nxt):
                continue
            seen.add(nxt)
            queue.append(nxt)
    return seen, escaped


def main():
    world = run("house/build", {})
    errors = []

    # 1. The player must not be entombed.
    for pos in ((0, 0, 0), (0, 1, 0)):
        if not is_open(world, pos):
            errors.append(f"player space {pos} is {world.get(pos)!r}, expected air")

    # 2. Standing on something solid.
    if is_open(world, (0, -1, 0)):
        errors.append("no floor under the player at (0,-1,0)")

    # 3. Interior flood must stay inside the house wall (doors count as closed).
    inside, escaped = flood(world, (0, 0, 0))
    if escaped:
        errors.append("LEAK: interior air reaches outside the build envelope")
    stray = [p for p in inside if max(abs(p[0]), abs(p[2])) > 6 or p[1] > 4 or p[1] < -1]
    if stray:
        sample = sorted(stray)[:5]
        errors.append(f"interior air escapes the house shell, e.g. {sample}")

    # 4. The patrol corridor must also be sealed from the outside world.
    corridor, escaped = flood(world, (9, 0, 9))
    if escaped:
        errors.append("LEAK: patrol corridor reaches outside the build envelope")
    # The gate recess tunnels through the 2-thick wall; the doors at z=12 close it.
    recess = {(x, y, z) for x in (-1, 0) for y in (0, 1) for z in (11, 12)}
    stray = [p for p in corridor if p not in recess and (max(abs(p[0]), abs(p[2])) > 10 or p[1] > 7)]
    if stray:
        sample = sorted(stray)[:5]
        errors.append(f"corridor air escapes the perimeter wall, e.g. {sample}")

    # 4b. The whole point: from open ground you cannot walk in.
    outside, _ = flood(world, (0, 0, APRON_EDGE))
    if (0, 0, 0) in outside:
        errors.append("BREACH: open ground connects straight to the living room")
    if (0, 0, 9) in outside:
        errors.append("BREACH: open ground connects straight to the patrol corridor")

    # 5. The corridor and the interior must not be one connected space -
    #    if they are, the front door failed to place.
    if (0, 0, 0) in corridor:
        errors.append("interior and corridor are connected - the front door is missing")

    # 6. Every interior column needs a solid ceiling overhead.
    for x in range(-6, 7):
        for z in range(-6, 7):
            if is_open(world, (x, 5, z)):
                errors.append(f"hole in the house ceiling at ({x},5,{z})")

    # 7. Every corridor column needs the compound roof overhead.
    for x in range(-12, 13):
        for z in range(-12, 13):
            if is_open(world, (x, 8, z)):
                errors.append(f"hole in the compound roof at ({x},8,{z})")

    # 8. Doors, levers and traps landed where they should.
    counts = collections.Counter(world.values())
    expected = {
        "minecraft:iron_door": 10,   # 2 gate + 2 front + 1 vault, two halves each
        "minecraft:lever": 6,
        "minecraft:dispenser": 9,
        "minecraft:heavy_weighted_pressure_plate": 11,
        # 73 lamps are placed; house/security later overwrites 7 corridor
        # floor lamps with arrow-trap dispensers.
        "sec:alarm_lamp": 66,
    }
    for block, want in expected.items():
        if counts[block] != want:
            errors.append(f"expected {want} x {block}, found {counts[block]}")

    # 9. Every lever must sit next to a door, or the iron doors are dead weight.
    doors = {p for p, b in world.items() if b == "minecraft:iron_door"}
    for pos, block in world.items():
        if block != "minecraft:lever":
            continue
        x, y, z = pos
        neighbours = {(x + 1, y, z), (x - 1, y, z), (x, y, z + 1), (x, y, z - 1)}
        if not neighbours & doors:
            errors.append(f"lever at {pos} is not adjacent to any door")

    # 10. Levers need a solid block underneath.
    for pos, block in world.items():
        if block == "minecraft:lever" and is_open(world, (pos[0], pos[1] - 1, pos[2])):
            errors.append(f"lever at {pos} has nothing to sit on")

    if errors:
        print("FAILED house verification:")
        for err in errors:
            print("  -", err)
        return 1

    solid = sum(1 for b in world.values() if b not in PASSABLE)
    print(f"house verified: {solid} blocks placed, interior sealed, corridor sealed")
    print(f"  {counts['sec:reinforced_wall']} reinforced wall, "
          f"{counts['sec:vault_wall']} vault wall, "
          f"{counts['sec:blast_glass']} blast glass, "
          f"{counts['sec:alarm_lamp']} alarm lamps")
    return 0


if __name__ == "__main__":
    sys.exit(main())
