#!/usr/bin/env python3
"""Simulate the bunker mcfunctions block-by-block and sanity check the result."""
import re, sys, os
from collections import deque

BP = sys.argv[1]
FN = os.path.join(BP, "functions")

FILL_LIMIT = 32768
world = {}          # (x,y,z) -> block id
errors, warns = [], []

def natural(p):
    """Untouched world: solid below the surface, air at/above it."""
    return "stone" if p[1] < 0 else "air"

def get(p):
    return world.get(p, natural(p))

def coord(tok):
    assert tok.startswith("~"), f"non-relative coord {tok}"
    return int(tok[1:]) if len(tok) > 1 else 0

def strip_states(parts):
    """Drop ["a"=b] state blobs, returning bare tokens."""
    joined = " ".join(parts)
    joined = re.sub(r'\[[^\]]*\]', ' ', joined)
    return joined.split()

def run(name, depth=0):
    path = os.path.join(FN, name + ".mcfunction")
    if not os.path.exists(path):
        errors.append(f"missing function file: {name}.mcfunction")
        return
    for lineno, raw in enumerate(open(path), 1):
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        if line.startswith("/"):
            errors.append(f"{name}:{lineno} command starts with '/' (illegal in .mcfunction)")
            continue
        cmd = line.split()[0]
        if cmd == "function":
            run(line.split()[1], depth + 1)
        elif cmd == "fill":
            do_fill(name, lineno, line)
        elif cmd == "setblock":
            do_setblock(name, lineno, line)
        elif cmd in ("tellraw", "give", "say"):
            pass
        else:
            warns.append(f"{name}:{lineno} unchecked command '{cmd}'")

def do_fill(name, lineno, line):
    t = strip_states(line.split())
    x1, y1, z1, x2, y2, z2 = (coord(c) for c in t[1:7])
    block = t[7]
    mode = t[8] if len(t) > 8 else None
    old = t[9] if len(t) > 9 else None
    if mode and mode != "replace":
        warns.append(f"{name}:{lineno} fill mode '{mode}' not simulated")
    xs = range(min(x1, x2), max(x1, x2) + 1)
    ys = range(min(y1, y2), max(y1, y2) + 1)
    zs = range(min(z1, z2), max(z1, z2) + 1)
    vol = len(xs) * len(ys) * len(zs)
    if vol > FILL_LIMIT:
        errors.append(f"{name}:{lineno} fill volume {vol} exceeds {FILL_LIMIT}")
    for x in xs:
        for y in ys:
            for z in zs:
                p = (x, y, z)
                if old is None or get(p) == old:
                    world[p] = block

def do_setblock(name, lineno, line):
    t = strip_states(line.split())
    x, y, z = (coord(c) for c in t[1:4])
    world[(x, y, z)] = t[4]

# ---------------------------------------------------------------- checks
PASSABLE = {"air", "ladder", "wheat", "water"}

def flood(start, extra_passable=frozenset()):
    ok = PASSABLE | extra_passable
    seen, q = {start}, deque([start])
    while q:
        x, y, z = q.popleft()
        for d in ((1,0,0), (-1,0,0), (0,1,0), (0,-1,0), (0,0,1), (0,0,-1)):
            p = (x + d[0], y + d[1], z + d[2])
            if p in seen or p not in world:
                continue
            if get(p) in ok:
                seen.add(p)
                q.append(p)
    return seen

run("bunker/build")

# 1. the player's own block must stay clear
for p in [(0, 0, 0), (0, 1, 0)]:
    if get(p) not in PASSABLE:
        errors.append(f"player position {p} filled with {get(p)} - would suffocate")

# 2. ladders need a solid block to the north (facing_direction=3)
for p, b in world.items():
    if b == "ladder":
        back = (p[0], p[1], p[2] - 1)
        if get(back) in PASSABLE:
            errors.append(f"ladder at {p} has no wall behind it (found {get(back)})")

# 3. every room must be reachable from the boulder-top entrance
ENTRY = (0, 3, 4)
reach = flood(ENTRY)
ROOMS = {
    "landing":   (0, -19, 6),
    "corridor":  (0, -19, 10),
    "main hall": (0, -19, 13),
    "farm":      (-9, -19, 14),
    "workshop":  (10, -19, 14),
    "quarters":  (-11, -19, 21),
    "command":   (10, -19, 21),
    "esc tunnel":(20, -19, 20),
    "esc exit":  (30, 3, 20),
}
for label, p in ROOMS.items():
    if get(p) not in PASSABLE:
        errors.append(f"{label} test point {p} is solid ({get(p)})")
    elif p not in reach:
        errors.append(f"{label} at {p} is NOT reachable from the entrance")

# 4. the vault must be sealed until a bookshelf is broken
VAULT = (-11, -19, 26)
if VAULT in reach:
    errors.append("vault is reachable without breaking the bookshelf wall - not secret")
reach2 = flood(ENTRY, extra_passable={"bookshelf"})
if VAULT not in reach2:
    errors.append("vault unreachable even after breaking the bookshelf wall")

# 5. rooms must be fully enclosed: no air block of the complex may touch
#    untouched natural terrain (that would mean a hole in the shell)
leaks = 0
for p in reach:
    for d in ((1,0,0), (-1,0,0), (0,1,0), (0,-1,0), (0,0,1), (0,0,-1)):
        q = (p[0] + d[0], p[1] + d[1], p[2] + d[2])
        if q not in world and q[1] < -1:
            leaks += 1
if leaks:
    errors.append(f"{leaks} block faces open onto untouched terrain (shell has holes)")

# 6. every light must actually border a room it is meant to light,
#    otherwise it is buried in the shell doing nothing
for p, b in list(world.items()):
    if b != "sea_lantern":
        continue
    # light passes through bars and glass as well as open air
    lit = reach2 | {q for q, v in world.items() if v in ("iron_bars", "glass")}
    touching = any((p[0]+d[0], p[1]+d[1], p[2]+d[2]) in lit
                   for d in ((1,0,0), (-1,0,0), (0,1,0), (0,-1,0), (0,0,1), (0,0,-1)))
    if not touching:
        warns.append(f"sea_lantern at {p} is buried in solid rock (lights nothing)")

# 7. door frames must reach the floor
for z in (10, 11):
    for x in (-2, 2):
        if get((x, -19, z)) != "iron_block":
            warns.append(f"corridor frame at {(x,-19,z)} is {get((x,-19,z))}, expected iron_block")

print(f"blocks placed: {len(world)}")
print(f"reachable interior volume: {len(reach)}")
for w in warns:
    print("WARN ", w)
for e in errors:
    print("ERROR", e)
print("RESULT:", "FAIL" if errors else "PASS")
sys.exit(1 if errors else 0)
