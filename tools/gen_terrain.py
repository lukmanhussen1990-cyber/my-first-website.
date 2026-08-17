#!/usr/bin/env python3
"""Island terrain builder for Lost Island: Abandoned.

Emits /fill and /setblock commands into small step functions that the in-game
build dispatcher runs one per tick, so the island appears over about 20 seconds
without ever hitching the client. Everything is derived from a seeded value-noise
heightmap, so the island is identical for every player.

Sea level 62 (water top), island footprint x/z -160..160, build volume y 30..140.
"""
import json
import math
import os
import random
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import palette as P

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
STEP_DIR = os.path.join(ROOT, "build", "Lost_Island_BP", "functions", "li_build", "t")
OUT = os.path.join(ROOT, "tools", "out")

R = 168               # clear/ocean radius (square half-extent)
ISLE = 160            # island half-extent
SEA = 62              # water surface y
Y_MIN, Y_MAX = 30, 140
MAX_FILL = 32768      # Bedrock hard limit per /fill
MAX_CMDS = 150        # per step function

SEED = 20240521

# location anchors (SPEC.md section 2) - each gets a flattened build pad
ANCHORS = [
    (1, "wreck_beach", 6, 63, 138), (2, "south_camp", -28, 64, 126),
    (3, "fishing_shacks", -86, 64, 118), (4, "ranger_station", 62, 66, 96),
    (5, "village", -10, 66, 66), (6, "supermarket", 8, 66, 58),
    (7, "gas_station", 34, 66, 74), (8, "motel", -40, 66, 46),
    (9, "hospital", -18, 67, 26), (10, "police", 6, 67, 20),
    (11, "fire_station", 24, 67, 30), (12, "radio_tower", 78, 84, 40),
    (13, "swamp_huts", -112, 63, 20), (14, "campsites", 46, 68, 8),
    (15, "lighthouse", 132, 66, 112), (16, "broken_bridge", -52, 64, -6),
    (17, "dam", 96, 78, -30), (18, "mine", 122, 92, -54),
    (19, "harbour", 108, 63, -124), (20, "shipwreck", 140, 62, -150),
    (21, "checkpoint", 52, 70, -92), (22, "military_camp", 84, 72, -108),
    (23, "airstrip", -70, 70, -118), (24, "lab", -20, 70, -132),
]

# ---------------------------------------------------------------------------
# command sink
# ---------------------------------------------------------------------------
MAX_STEP_VOLUME = 140000   # blocks touched per tick, tuned for mobile


class Sink:
    def __init__(self):
        self.cmds = []          # list of (command, volume)
        self.pending_label = None
        self.labels = {}
        self.max_vol = 0

    def label(self, text):
        self.pending_label = text

    def steps(self):
        """Group commands into steps bounded by BOTH command count and total
        blocks touched, so no single tick does too much work."""
        out, cur, vol = [], [], 0
        for c, v in self.cmds:
            if cur and (len(cur) >= MAX_CMDS or vol + v > MAX_STEP_VOLUME):
                out.append(cur)
                cur, vol = [], 0
            cur.append(c)
            vol += v
        if cur:
            out.append(cur)
        return out

    def fill(self, x0, y0, z0, x1, y1, z1, block, mode=None):
        x0, x1 = min(x0, x1), max(x0, x1)
        y0, y1 = min(y0, y1), max(y0, y1)
        z0, z1 = min(z0, z1), max(z0, z1)
        vol = (x1 - x0 + 1) * (y1 - y0 + 1) * (z1 - z0 + 1)
        assert vol <= MAX_FILL, "fill too big: %d" % vol
        assert Y_MIN <= y0 and y1 <= Y_MAX, (y0, y1)
        assert -R <= x0 and x1 <= R and -R <= z0 and z1 <= R
        self.max_vol = max(self.max_vol, vol)
        c = "fill %d %d %d %d %d %d %s" % (x0, y0, z0, x1, y1, z1, block)
        if mode:
            c += " " + mode
        self._add(c, vol)

    def setblock(self, x, y, z, block):
        assert Y_MIN <= y <= Y_MAX, y
        assert -R <= x <= R and -R <= z <= R
        self._add("setblock %d %d %d %s" % (x, y, z, block), 1)

    def _add(self, cmd, vol):
        if self.pending_label is not None:
            self.labels[len(self.cmds)] = self.pending_label
            self.pending_label = None
        self.cmds.append((cmd, vol))

    def big_fill(self, x0, y0, z0, x1, y1, z1, block):
        """Split a large box into legal <=32768 chunks."""
        for xa in range(x0, x1 + 1, 32):
            xb = min(x1, xa + 31)
            for za in range(z0, z1 + 1, 32):
                zb = min(z1, za + 31)
                for ya in range(y0, y1 + 1, 31):
                    yb = min(y1, ya + 30)
                    self.fill(xa, ya, za, xb, yb, zb, block)


S = Sink()

# ---------------------------------------------------------------------------
# value noise
# ---------------------------------------------------------------------------
class Noise:
    def __init__(self, seed):
        self.p = [random.Random(seed + i).random() for i in range(4096)]
        self.seed = seed

    def _v(self, xi, zi):
        h = (xi * 374761393 + zi * 668265263 + self.seed * 144665) & 0x7FFFFFFF
        h = (h ^ (h >> 13)) * 1274126177 & 0x7FFFFFFF
        return self.p[h % 4096]

    def at(self, x, z, freq):
        fx, fz = x * freq, z * freq
        x0, z0 = math.floor(fx), math.floor(fz)
        tx, tz = fx - x0, fz - z0
        # smoothstep for continuous slopes
        tx = tx * tx * (3 - 2 * tx)
        tz = tz * tz * (3 - 2 * tz)
        v00 = self._v(x0, z0)
        v10 = self._v(x0 + 1, z0)
        v01 = self._v(x0, z0 + 1)
        v11 = self._v(x0 + 1, z0 + 1)
        a = v00 + (v10 - v00) * tx
        b = v01 + (v11 - v01) * tx
        return a + (b - a) * tz

    def fbm(self, x, z, freq, octaves=4):
        total, amp, norm = 0.0, 1.0, 0.0
        for _ in range(octaves):
            total += self.at(x, z, freq) * amp
            norm += amp
            amp *= 0.5
            freq *= 2.0
        return total / norm


N1 = Noise(SEED)
N2 = Noise(SEED + 991)
N3 = Noise(SEED + 5077)

PAD = {}          # (anchor x,z) -> y, used to flatten build sites


def pad_influence(x, z):
    """Returns (y, weight) pulling terrain toward a location's pad height."""
    best = None
    for i, _n, ax, ay, az in ANCHORS:
        if i in (20,):
            continue
        d = max(abs(x - ax), abs(z - az))
        if d <= 30:
            w = 1.0 if d <= 20 else (30 - d) / 10.0
            if best is None or w > best[1]:
                best = (ay, w)
    return best


def height(x, z):
    """Island heightmap: radial falloff + ridged mountains in the north-east."""
    d = math.sqrt(x * x + z * z)
    # coastline wobble so the island is not a circle
    wob = (N3.fbm(x, z, 1 / 90.0, 2) - 0.5) * 46
    edge = ISLE - 14 + wob
    if d > edge:
        return None                       # ocean
    t = 1.0 - (d / edge)                  # 0 at shore, 1 at centre
    base = SEA + 1 + 34 * (t ** 1.35)
    base += (N1.fbm(x, z, 1 / 58.0, 4) - 0.5) * 22
    base += (N2.fbm(x, z, 1 / 17.0, 3) - 0.5) * 6

    # mountains: east / north-east
    mx = (x - 100) / 80.0
    mz = (z + 40) / 70.0
    m = max(0.0, 1.0 - (mx * mx + mz * mz))
    if m > 0:
        ridge = abs(N1.fbm(x, z, 1 / 40.0, 3) - 0.5) * 2
        base += (m ** 1.4) * (34 + 30 * (1.0 - ridge))

    # swamp basin: west
    sx = (x + 108) / 60.0
    sz = (z - 18) / 48.0
    sw = max(0.0, 1.0 - (sx * sx + sz * sz))
    if sw > 0:
        base = base * (1 - sw * 0.85) + (SEA + 1.4) * (sw * 0.85)

    # forbidden zone plateau: north-centre, flat and dead
    px_ = (x + 20) / 70.0
    pz_ = (z + 128) / 42.0
    pl = max(0.0, 1.0 - (px_ * px_ + pz_ * pz_))
    if pl > 0:
        base = base * (1 - pl * 0.8) + 70.0 * (pl * 0.8)

    # beaches: flatten near the shore so sand reads as a real beach
    if t < 0.10:
        base = SEA + 1 + (base - SEA - 1) * (t / 0.10) ** 0.6

    pad = pad_influence(x, z)
    if pad:
        py, w = pad
        base = base * (1 - w) + py * w

    h = int(round(base))
    # quantise to 3 so run-length encoding produces long spans (this is the
    # single biggest lever on total command count)
    if not pad:
        h = (h // 3) * 3
    return max(SEA - 6, min(Y_MAX - 22, h))


HEIGHTS = {}


def build_heightmap():
    for z in range(-ISLE, ISLE + 1):
        for x in range(-ISLE, ISLE + 1):
            h = height(x, z)
            if h is not None:
                HEIGHTS[(x, z)] = h


def region_of(x, z, h):
    """Surface material selection by region and elevation."""
    if h <= SEA + 1:
        return "shore"
    if h >= 104:
        return "peak"
    if h >= 88:
        return "alpine"
    if -160 <= x <= -55 and -25 <= z <= 60 and h <= SEA + 4:
        return "swamp"
    if z >= 90:
        return "south"
    if x >= 45 and -85 <= z <= 5:
        return "mountain"
    if z <= -95:
        return "north"
    return "forest"


SURFACE = {
    "shore":    (P.SAND, P.SAND),
    "south":    (P.GRASS, P.DIRT),
    "forest":   (P.GRASS, P.DIRT),
    "swamp":    (P.MUD, P.MUD),
    "mountain": (P.STONE, P.STONE),
    "alpine":   (P.ANDESITE, P.STONE),
    "peak":     (P.STONE, P.STONE),
    "north":    (P.GRAVEL, P.DIRT),
}


# ---------------------------------------------------------------------------
# passes
# ---------------------------------------------------------------------------
def pass_clear():
    S.label("Clearing the region")
    # everything above sea level becomes air, so the island can be built into
    # any existing world
    S.big_fill(-R, SEA + 1, -R, R, Y_MAX, R, P.AIR)
    S.label("Filling the ocean")
    S.big_fill(-R, 34, -R, R, SEA, R, P.WATER)
    S.big_fill(-R, Y_MIN, -R, R, 33, R, P.STONE)


def pass_landmass():
    S.label("Raising the island")
    for z in range(-ISLE, ISLE + 1):
        runs = []
        x = -ISLE
        while x <= ISLE:
            h = HEIGHTS.get((x, z))
            if h is None:
                x += 1
                continue
            key = (h, region_of(x, z, h))
            x0 = x
            while x + 1 <= ISLE and HEIGHTS.get((x + 1, z)) == h and \
                    region_of(x + 1, z, h) == key[1]:
                x += 1
            runs.append((x0, x, h, key[1]))
            x += 1
        for (x0, x1, h, reg) in runs:
            top, sub = SURFACE[reg]
            soil = reg in ("south", "forest", "swamp", "north")
            body_top = h - 3 if soil else h - 1
            if body_top >= 34:
                for xa in range(x0, x1 + 1, 32):
                    xb = min(x1, xa + 31)
                    S.fill(xa, 34, z, xb, body_top, z, P.STONE)
            if soil:
                S.fill(x0, max(34, h - 2), z, x1, h - 1, z, sub)
            S.fill(x0, h, z, x1, h, z, top)
            # clear any water left sitting on the new land
            if h < SEA:
                S.fill(x0, h + 1, z, x1, SEA, z, P.WATER)


def sphere_air(cx, cy, cz, r, block=P.AIR):
    """Carve a rough sphere as a stack of z-rows (cheap, few commands)."""
    for dy in range(-r, r + 1):
        rr = int(math.sqrt(max(0, r * r - dy * dy)))
        if rr <= 0:
            continue
        y = cy + dy
        if not (Y_MIN <= y <= Y_MAX):
            continue
        S.fill(max(-R, cx - rr), y, max(-R, cz - rr),
               min(R, cx + rr), y, min(R, cz + rr), block)


def pass_caves():
    S.label("Carving caves")
    rnd = random.Random(SEED + 3)
    mouths = []
    # three surface-connected cave systems in the mountains
    starts = [(96, -20), (124, -50), (66, -6)]
    for (sx, sz) in starts:
        h = HEIGHTS.get((sx, sz), 80)
        mouths.append((sx, h, sz))
        # entrance shaft down from the surface
        for y in range(h + 1, h - 10, -1):
            S.fill(sx - 2, y, sz - 2, sx + 2, y, sz + 2, P.AIR)
        x, y, z = sx, h - 10, sz
        for _ in range(26):
            x += rnd.randint(-7, 7)
            z += rnd.randint(-7, 7)
            y -= rnd.randint(0, 3)
            x = max(-150, min(150, x))
            z = max(-150, min(150, z))
            y = max(38, min(h - 6, y))
            sphere_air(x, y, z, rnd.randint(3, 5))
            if rnd.random() < 0.25:
                S.setblock(x, y - 1, z, rnd.choice(
                    [P.COAL_ORE, P.IRON_ORE, P.COPPER_ORE, P.GOLD_ORE,
                     P.REDSTONE_ORE, P.LAPIS_ORE]))
            if rnd.random() < 0.15:
                S.setblock(x, y + 1, z, P.DRIPSTONE)
    # a long ravine across the eastern highlands
    S.label("Splitting the ravine")
    for i, x in enumerate(range(62, 132, 2)):
        z = -14 + int(10 * math.sin(i * 0.35))
        h = HEIGHTS.get((x, z), 84)
        w = 3 + (i % 3)
        S.fill(x, max(38, h - 30), z - w, x + 1, h, z + w, P.AIR)
    # abandoned tunnel: mountains -> forbidden zone, left raw for decoration
    S.label("Opening the old tunnel")
    for z in range(-60, -130, -2):
        S.fill(28, 40, z, 32, 44, z + 1, P.AIR)
        if z % 16 == 0:
            S.setblock(30, 44, z, P.LI_LIGHT)
    # cave mouth for the tunnel's south end
    S.fill(28, 40, -58, 32, 46, -56, P.AIR)
    return mouths


def pass_water():
    S.label("Cutting rivers and lakes")
    # two rivers, each a chain of flat pools so water never flows
    rivers = [
        [(88, -34), (74, -18), (58, -6), (40, 4), (18, 10), (-6, 8),
         (-30, 2), (-52, -6), (-74, -12), (-96, -14)],
        [(112, -40), (104, -18), (96, 4), (86, 26), (72, 46), (56, 66),
         (40, 88), (26, 110), (16, 130)],
    ]
    for chain in rivers:
        for i in range(len(chain) - 1):
            (ax, az), (bx, bz) = chain[i], chain[i + 1]
            steps = max(abs(bx - ax), abs(bz - az))
            for s in range(steps + 1):
                x = ax + (bx - ax) * s // steps
                z = az + (bz - az) * s // steps
                h = HEIGHTS.get((x, z))
                if h is None:
                    continue
                wy = max(SEA, min(h - 1, h - 1))
                w = 3
                S.fill(x - w, wy - 3, z - w, x + w, wy + 6, z + w, P.AIR)
                S.fill(x - w, wy - 3, z - w, x + w, wy, z + w, P.WATER)
                S.fill(x - w - 1, wy - 4, z - w - 1, x + w + 1, wy - 4,
                       z + w + 1, P.CLAY)
    # lakes
    for (lx, lz, lr) in ((-120, 44, 11), (36, 44, 9), (-64, 96, 8)):
        h = HEIGHTS.get((lx, lz), SEA + 4)
        wy = max(SEA, h - 2)
        for dz in range(-lr, lr + 1):
            rr = int(math.sqrt(max(0, lr * lr - dz * dz)))
            if rr <= 0:
                continue
            S.fill(lx - rr, wy - 4, lz + dz, lx + rr, wy + 4, lz + dz, P.AIR)
            S.fill(lx - rr, wy - 4, lz + dz, lx + rr, wy, lz + dz, P.WATER)
        for i in range(10):
            S.setblock(lx - lr + i * 2, wy, lz, P.WATERLILY)
    # two waterfalls down cliff faces
    S.label("Hanging the waterfalls")
    for (wx, wz, top, bot) in ((118, -66, 104, 78), (58, 12, 92, 70)):
        S.fill(wx, bot, wz, wx + 1, top, wz + 1, P.AIR)
        S.fill(wx, bot, wz, wx + 1, top, wz + 1, P.WATER)
        S.fill(wx - 2, bot - 2, wz - 2, wx + 3, bot - 1, wz + 3, P.WATER)


# The shipwreck is deliberately offshore: it must stay in open water, so it
# gets no levelled pad.
NO_PAD = {20}


def pass_pads():
    S.label("Levelling the build sites")
    for (i, _n, ax, ay, az) in ANCHORS:
        if i in NO_PAD:
            continue
        x0, x1 = max(-R, ax - 20), min(R, ax + 20)
        z0, z1 = max(-R, az - 20), min(R, az + 20)
        S.fill(x0, ay + 1, z0, x1, ay + 18, z1, P.AIR)
        S.fill(x0, ay - 3, z0, x1, ay - 1, z1, P.DIRT)
        reg = region_of(ax, az, ay)
        top = SURFACE[reg][0]
        S.fill(x0, ay, z0, x1, ay, z1, top)


def pass_roads():
    S.label("Laying the dirt roads")
    route = [(6, 132), (0, 116), (-6, 96), (-10, 78), (-10, 66), (2, 60),
             (8, 58), (20, 62), (34, 70), (34, 74), (46, 62), (58, 52),
             (70, 46), (78, 42), (86, 20), (92, 0), (96, -24), (96, -30),
             (84, -46), (70, -60), (60, -78), (52, -88), (52, -92),
             (36, -104), (10, -112), (-20, -120), (-20, -128), (-46, -122),
             (-70, -118)]
    spurs = [
        [(96, -30), (104, -60), (108, -90), (108, -120)],           # harbour
        [(78, 42), (96, 60), (114, 86), (128, 104), (132, 110)],    # lighthouse
        [(-10, 66), (-24, 56), (-40, 48)],                          # motel
        [(-10, 66), (-16, 40), (-18, 28)],                          # hospital
        [(-10, 78), (-52, -4)],                                     # bridge road
    ]
    gaps = [(-52, -6), (-30, 2)]      # broken bridges over the rivers

    def draw(chain):
        for i in range(len(chain) - 1):
            (ax, az), (bx, bz) = chain[i], chain[i + 1]
            steps = max(abs(bx - ax), abs(bz - az))
            if steps == 0:
                continue
            for s in range(steps + 1):
                x = ax + (bx - ax) * s // steps
                z = az + (bz - az) * s // steps
                if any(abs(x - gx) < 7 and abs(z - gz) < 7 for gx, gz in gaps):
                    continue
                h = HEIGHTS.get((x, z))
                if h is None:
                    continue
                blk = P.COARSE_DIRT if (x + z) % 7 else P.GRAVEL
                S.fill(x - 1, h, z - 1, x + 1, h, z + 1, blk)
                S.fill(x - 1, h + 1, z - 1, x + 1, h + 2, z + 1, P.AIR)

    draw(route)
    for sp in spurs:
        draw(sp)


TREE_SPECS = {
    "palm":   (P.JUNGLE_LOG, P.JUNGLE_LEAVES, (5, 8)),
    "oak":    (P.OAK_LOG, P.OAK_LEAVES, (4, 7)),
    "dark":   (P.DARK_OAK_LOG, P.DARK_OAK_LEAVES, (5, 8)),
    "mang":   (P.MANGROVE_LOG, P.MANGROVE_LEAVES, (4, 7)),
    "spruce": (P.SPRUCE_LOG, P.SPRUCE_LEAVES, (6, 10)),
    "birch":  (P.BIRCH_LOG, P.BIRCH_LEAVES, (5, 7)),
}


def tree(x, z, h, kind, rnd):
    log, leaf, (lo, hi) = TREE_SPECS[kind]
    th = rnd.randint(lo, hi)
    top = h + th
    if top > Y_MAX - 6:
        return 0
    S.fill(x, h + 1, z, x, top, z, log)
    n = 1
    if kind == "spruce":
        S.fill(x - 2, top - 4, z - 2, x + 2, top - 3, z + 2, leaf)
        S.fill(x - 1, top - 2, z - 1, x + 1, top - 1, z + 1, leaf)
        S.setblock(x, top + 1, z, leaf)
        n += 3
    elif kind == "palm":
        S.fill(x - 2, top, z - 1, x + 2, top, z + 1, leaf)
        S.fill(x - 1, top, z - 2, x + 1, top, z + 2, leaf)
        S.setblock(x, top + 1, z, leaf)
        n += 3
    else:
        S.fill(x - 2, top - 2, z - 2, x + 2, top - 1, z + 2, leaf)
        S.fill(x - 1, top, z - 1, x + 1, top, z + 1, leaf)
        n += 2
    if rnd.random() < 0.22:
        S.setblock(x + 1, top - 3, z, P.VINE)
        n += 1
    return n


def near_anchor(x, z, pad=16):
    for (_i, _n, ax, _ay, az) in ANCHORS:
        if abs(x - ax) < 20 + pad and abs(z - az) < 20 + pad:
            return True
    return False


def pass_vegetation():
    S.label("Growing the forest")
    rnd = random.Random(SEED + 77)
    # densities per region: central forest is deliberately the thickest
    plan = [
        ("forest", 3, ("oak", "oak", "dark", "birch")),
        ("south", 7, ("palm", "palm", "oak")),
        ("swamp", 5, ("mang", "dark")),
        ("mountain", 10, ("spruce",)),
        ("north", 11, ("spruce", "birch")),
        ("alpine", 18, ("spruce",)),
    ]
    step = {r: s for r, s, _k in plan}
    kinds = {r: k for r, _s, k in plan}
    placed = 0
    for z in range(-ISLE + 4, ISLE - 3, 2):
        for x in range(-ISLE + 4, ISLE - 3, 2):
            h = HEIGHTS.get((x, z))
            if h is None or h <= SEA + 1 or h > 108:
                continue
            reg = region_of(x, z, h)
            if reg not in step:
                continue
            if near_anchor(x, z):
                continue
            if (x * 31 + z * 17 + rnd.randint(0, 5)) % step[reg]:
                continue
            placed += tree(x + rnd.randint(-1, 1), z + rnd.randint(-1, 1),
                           h, rnd.choice(kinds[reg]), rnd) and 1 or 0
    # ground cover, mushrooms, reeds, moss and deadwood
    S.label("Scattering undergrowth")
    for z in range(-ISLE + 6, ISLE - 5, 7):
        for x in range(-ISLE + 6, ISLE - 5, 7):
            h = HEIGHTS.get((x, z))
            if h is None or h <= SEA or near_anchor(x, z, 4):
                continue
            reg = region_of(x, z, h)
            r = rnd.random()
            if reg in ("forest", "south"):
                if r < 0.42:
                    S.setblock(x, h + 1, z, P.TALLGRASS)
                elif r < 0.5:
                    S.setblock(x, h + 1, z, P.BROWN_MUSHROOM)
                elif r < 0.56:
                    S.fill(x, h, z, x + 1, h, z + 1, P.MOSS)
            elif reg == "swamp":
                if r < 0.3:
                    S.setblock(x, h + 1, z, P.SUGAR_CANE)
                elif r < 0.45:
                    S.setblock(x, h + 1, z, P.RED_MUSHROOM)
                elif r < 0.62:
                    S.setblock(x, h, z, P.MUDDY_MANGROVE_ROOTS)
            elif reg in ("north", "mountain"):
                if r < 0.2:
                    S.setblock(x, h + 1, z, P.DEADBUSH)
            elif reg == "alpine" and r < 0.5:
                S.setblock(x, h + 1, z, P.SNOW)
    return placed


def pass_cliffs():
    S.label("Cutting the sea cliffs")
    # reinforce the north and east coasts into real cliff faces
    for z in range(-ISLE + 6, -96, 3):
        for x in range(-ISLE + 6, ISLE - 5, 6):
            h = HEIGHTS.get((x, z))
            if h is None or h < SEA + 6 or h > 96:
                continue
            nb = HEIGHTS.get((x, z - 4))
            if nb is None:
                S.fill(x - 2, SEA - 2, z - 3, x + 2, h, z, P.STONE)
    # a rock arch off the east coast
    ax, az = 150, 60
    S.fill(ax, SEA, az - 6, ax + 3, SEA + 10, az - 4, P.STONE)
    S.fill(ax, SEA, az + 4, ax + 3, SEA + 10, az + 6, P.STONE)
    S.fill(ax, SEA + 10, az - 6, ax + 3, SEA + 12, az + 6, P.STONE)


def main():
    os.makedirs(STEP_DIR, exist_ok=True)
    os.makedirs(OUT, exist_ok=True)
    for f in os.listdir(STEP_DIR):
        os.remove(os.path.join(STEP_DIR, f))

    build_heightmap()
    pass_clear()
    pass_landmass()
    pass_pads()
    mouths = pass_caves()
    pass_water()
    pass_roads()
    trees = pass_vegetation()
    pass_cliffs()

    # write step files (volume-aware grouping)
    groups = S.steps()
    # map "command index" labels onto "step index" labels
    step_of_cmd, n = {}, 0
    for si, g in enumerate(groups):
        for _ in g:
            step_of_cmd[n] = si
            n += 1
    labels = {}
    for ci, text in sorted(S.labels.items()):
        labels[str(step_of_cmd.get(ci, 0))] = text

    for si, g in enumerate(groups):
        with open(os.path.join(STEP_DIR, "s%03d.mcfunction" % si), "w") as f:
            f.write("\n".join(g) + "\n")
    steps = len(groups)

    index = {"count": steps, "prefix": "li_build/t/s", "commands": len(S.cmds),
             "labels": labels}
    with open(os.path.join(OUT, "terrain_index.json"), "w") as f:
        json.dump(index, f, indent=2)

    with open(os.path.join(OUT, "terrain_notes.md"), "w") as f:
        f.write("# Terrain generation notes\n\n")
        f.write("- Island footprint: x/z -%d..%d (%d x %d blocks)\n"
                % (ISLE, ISLE, ISLE * 2 + 1, ISLE * 2 + 1))
        f.write("- Sea level: y=%d (water surface), build volume y=%d..%d\n"
                % (SEA, Y_MIN, Y_MAX))
        f.write("- Land columns: %d\n" % len(HEIGHTS))
        f.write("- Highest point: y=%d\n" % max(HEIGHTS.values()))
        f.write("- Trees planted: %d\n" % trees)
        f.write("- Commands: %d in %d step functions (<=%d each)\n"
                % (len(S.cmds), steps, MAX_CMDS))
        f.write("- Largest single fill volume: %d (limit %d)\n"
                % (S.max_vol, MAX_FILL))
        f.write("- Step budget: <=%d commands AND <=%d blocks touched per "
                "tick\n" % (MAX_CMDS, MAX_STEP_VOLUME))
        f.write("\n## Cave mouths (surface entrances)\n")
        for (x, y, z) in mouths:
            f.write("- %d %d %d\n" % (x, y, z))
        f.write("\n## Notes\n")
        f.write("- Rivers and lakes are placed as flat, fully-enclosed water "
                "boxes so no flow updates occur (a major mobile performance "
                "win).\n")
        f.write("- Heights are quantised to 2 blocks outside build pads so "
                "run-length encoding along X keeps the command count low.\n")
        f.write("- Ambiguous flattened block IDs are avoided; see "
                "tools/palette.py for the verified whitelist.\n")

    print("terrain steps  : %d" % steps)
    print("terrain cmds   : %d" % len(S.cmds))
    print("land columns   : %d" % len(HEIGHTS))
    print("trees          : %d" % trees)
    print("max fill vol   : %d" % S.max_vol)


if __name__ == "__main__":
    main()
