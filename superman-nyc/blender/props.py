"""Street furniture: signals (animatable lamps), lamps, hydrants, bins, subway entrance,
food cart, newsstand, bus shelter, sidewalk shed, plaza furniture, trash bags."""
import math
import random
import numpy as np
import bpy
from mathutils import Vector, Matrix, Euler

from city import MB
import timeline as TL

MIDBLOCK_Y = -31.0          # signalised mid-block crossing next to the plaza corner


def cyl(mb, c, r, z0, z1, mat, seg=12, cap=True):
    pts = [(c[0] + r * math.cos(a), c[1] + r * math.sin(a)) for a in np.linspace(0, 2 * math.pi, seg, endpoint=False)]
    for i in range(seg):
        p, q = pts[i], pts[(i + 1) % seg]
        mb.poly([(p[0], p[1], z0), (q[0], q[1], z0), (q[0], q[1], z1), (p[0], p[1], z1)], mat)
    if cap:
        mb.poly([(p[0], p[1], z1) for p in pts], mat)


def hcyl(mb, a, b, r, mat, seg=10):
    """Cylinder between two 3D points."""
    a, b = np.array(a, float), np.array(b, float)
    ax = b - a
    L = np.linalg.norm(ax)
    ax /= L
    tmp = np.array([0, 0, 1.0]) if abs(ax[2]) < 0.9 else np.array([1.0, 0, 0])
    u = np.cross(ax, tmp)
    u /= np.linalg.norm(u)
    v = np.cross(ax, u)
    ring = [(math.cos(t), math.sin(t)) for t in np.linspace(0, 2 * math.pi, seg, endpoint=False)]
    for i in range(seg):
        c0, s0 = ring[i]
        c1, s1 = ring[(i + 1) % seg]
        p0 = a + r * (c0 * u + s0 * v)
        p1 = a + r * (c1 * u + s1 * v)
        mb.poly([tuple(p0), tuple(p1), tuple(p1 + ax * L), tuple(p0 + ax * L)], mat)


def sphere(mb, c, r, mat, seg=10, rings=6, squash=1.0):
    verts = []
    for j in range(rings + 1):
        th = math.pi * j / rings
        row = []
        for i in range(seg):
            ph = 2 * math.pi * i / seg
            row.append((c[0] + r * math.sin(th) * math.cos(ph), c[1] + r * math.sin(th) * math.sin(ph),
                        c[2] + squash * r * math.cos(th)))
        verts.append(row)
    for j in range(rings):
        for i in range(seg):
            a, b = verts[j][i], verts[j][(i + 1) % seg]
            c2, d = verts[j + 1][(i + 1) % seg], verts[j + 1][i]
            mb.poly([a, d, c2, b], mat)


# ------------------------------------------------------------------------------ signals
def signal_head(coll, M, name, pos, facing, kind="car"):
    """One signal head as its own object (lamp states are animatable custom props)."""
    mb = MB()
    if kind == "car":
        mb.box((-0.17, -0.12, -0.5), (0.17, 0.12, 0.5), "black_plastic")
        mb.box((-0.27, 0.10, -0.62), (0.27, 0.13, 0.62), "black_plastic")      # backplate
        for k, (z, mat) in enumerate(((0.32, "sig_red"), (0.0, "sig_yel"), (-0.32, "sig_grn"))):
            ring = [(0.11 * math.cos(a), -0.121, z + 0.11 * math.sin(a)) for a in np.linspace(0, 2 * math.pi, 14, endpoint=False)]
            mb.poly(ring[::-1], mat)
            # visor
            mb.box((-0.14, -0.30, z + 0.11), (0.14, -0.12, z + 0.13), "black_plastic")
    else:   # pedestrian signal: hand / walking man in one box
        mb.box((-0.2, -0.14, -0.2), (0.2, 0.14, 0.2), "signal_body")
        mb.poly([(-0.15, -0.141, -0.15), (0.15, -0.141, -0.15), (0.15, -0.141, 0.15), (-0.15, -0.141, 0.15)][::-1],
                "ped_hand")
    ob = mb.build(name, coll, M)
    ob.location = pos
    ob.rotation_euler = (0, 0, facing)
    if kind == "car":
        ob["lamp_r"] = 0.0
        ob["lamp_y"] = 0.0
        ob["lamp_g"] = 1.0
    else:
        ob["lamp_hand"] = 1.0
        ob["lamp_walk"] = 0.0
    return ob


def signal_pole(coll, M, name, base, arm_dir=None, arm_len=0.0, heads=(), ped=(), signs=()):
    """Pole (+ optional mast arm). heads: [(dist along arm, facing)], ped: [(height, facing)]."""
    mb = MB()
    x, y = base
    z0 = TL.CURB_H
    cyl(mb, (x, y), 0.22, z0, z0 + 0.5, "metal_galv", 10)
    cyl(mb, (x, y), 0.11, z0, z0 + 7.2, "metal_galv", 10)
    objs = []
    pole = mb  # same builder
    if arm_dir is not None and arm_len > 0:
        d = np.array(arm_dir, float)
        a = (x, y, z0 + 6.4)
        b = (x + d[0] * arm_len, y + d[1] * arm_len, z0 + 6.4)
        hcyl(pole, a, b, 0.08, "metal_galv")
        hcyl(pole, (x, y, z0 + 5.6), (x + d[0] * 2.5, y + d[1] * 2.5, z0 + 6.4), 0.04, "metal_galv")
    for k, txt in enumerate(signs):
        dz = z0 + 4.2 + k * 0.32
        ang = 0.0 if k % 2 == 0 else math.pi / 2
        ca, sa = math.cos(ang), math.sin(ang)
        L, Hh = 0.75, 0.15
        P = lambda u, v, w: (x + ca * u - sa * w, y + sa * u + ca * w, dz + v)
        pole.poly([P(-L, -Hh, -0.13), P(L, -Hh, -0.13), P(L, Hh, -0.13), P(-L, Hh, -0.13)], txt,
                  uvs=[(0, 0), (1, 0), (1, 1), (0, 1)])
        pole.poly([P(L, -Hh, -0.15), P(-L, -Hh, -0.15), P(-L, Hh, -0.15), P(L, Hh, -0.15)], txt,
                  uvs=[(0, 0), (1, 0), (1, 1), (0, 1)])
    pob = pole.build(name, coll, M)
    pob.data.transform(Matrix.Translation((-x, -y, 0)))
    pob.location = (x, y, 0)
    inv = Matrix.Translation((x, y, 0)).inverted()
    objs.append(pob)
    for i, (dist, facing) in enumerate(heads):
        if arm_dir is not None:
            p = (x + arm_dir[0] * dist, y + arm_dir[1] * dist, z0 + 5.75)
        else:
            p = (x, y, z0 + 4.0 + 1.2 * i)
        h = signal_head(coll, M, f"{name}_head{i}", p, facing, "car")
        h.parent = pob
        h.matrix_parent_inverse = inv
        objs.append(h)
    for i, (hz, facing) in enumerate(ped):
        off = (0.28 * math.sin(facing), -0.28 * math.cos(facing))
        h = signal_head(coll, M, f"{name}_ped{i}", (x + off[0], y + off[1], z0 + hz), facing, "ped")
        h.parent = pob
        h.matrix_parent_inverse = inv
        objs.append(h)
    return objs


def build_signals(coll, M):
    """Signals at the hero intersection, the neighbouring ones and the mid-block crossing.
    facing: Z rotation; 0 means the lamps face -Y (south, toward northbound traffic)."""
    S = {}
    bx = TL.AVE_HALF + 0.9
    for c in (0.0, -TL.BLOCK, TL.BLOCK):
        ny, sy = c + TL.ST_HALF + 1.0, c - TL.ST_HALF - 1.0
        S[f"NW{c:+.0f}"] = signal_pole(coll, M, f"Sig_NW{c:+.0f}", (-bx, ny), (1, 0), 9.5,
                                       heads=[(4.0, 0.0), (8.5, 0.0)], ped=[(3.0, math.pi / 2), (3.0, 0.0)],
                                       signs=("st_w41", "st_6av"))
        S[f"NE{c:+.0f}"] = signal_pole(coll, M, f"Sig_NE{c:+.0f}", (bx, ny), None, 0,
                                       heads=[(0, 0.0)], ped=[(3.0, -math.pi / 2), (3.0, 0.0)])
        S[f"SW{c:+.0f}"] = signal_pole(coll, M, f"Sig_SW{c:+.0f}", (-bx, sy), None, 0,
                                       heads=[(0, math.pi / 2)], ped=[(3.0, math.pi / 2), (3.0, math.pi)],
                                       signs=("st_6av", "st_w41"))
        S[f"SE{c:+.0f}"] = signal_pole(coll, M, f"Sig_SE{c:+.0f}", (bx, sy), (0, 1), 6.0,
                                       heads=[(3.0, math.pi / 2), (5.5, math.pi / 2)],
                                       ped=[(3.0, -math.pi / 2), (3.0, math.pi)])
    # mid-block crossing by the plaza (this pole gets damaged in scenes 5-6)
    S["MidW"] = signal_pole(coll, M, "Sig_MidW", (-bx, MIDBLOCK_Y + 2.6), (1, 0), 7.5,
                            heads=[(3.5, 0.0), (7.0, 0.0)], ped=[(3.0, math.pi / 2)])
    S["MidE"] = signal_pole(coll, M, "Sig_MidE", (bx, MIDBLOCK_Y - 2.6), None, 0,
                            heads=[(0, 0.0)], ped=[(3.0, -math.pi / 2)])
    return S


def midblock_crosswalk(coll, M):
    mk = MB()
    z = 0.0045
    yc = MIDBLOCK_Y
    xx = -TL.AVE_HALF + 0.6
    while xx < TL.AVE_HALF - 0.6:
        mk.poly([(xx, yc - 2.0, z), (xx + 0.6, yc - 2.0, z), (xx + 0.6, yc + 2.0, z), (xx, yc + 2.0, z)], "paint_white")
        xx += 1.2
    mk.poly([(-4.8, yc - 3.6, z), (6.6, yc - 3.6, z), (6.6, yc - 3.0, z), (-4.8, yc - 3.0, z)], "paint_white")
    mk.build("MidblockCrosswalk", coll, M)


# ------------------------------------------------------------------------------ the rest
def street_lamp(mb, x, y, side):
    z0 = TL.CURB_H
    cyl(mb, (x, y), 0.2, z0, z0 + 0.6, "metal_galv", 10)
    cyl(mb, (x, y), 0.1, z0, z0 + 8.6, "metal_galv", 10)
    d = -side
    hcyl(mb, (x, y, z0 + 8.4), (x + d * 1.4, y, z0 + 9.2), 0.06, "metal_galv")
    hcyl(mb, (x + d * 1.4, y, z0 + 9.2), (x + d * 2.6, y, z0 + 9.3), 0.06, "metal_galv")
    sphere(mb, (x + d * 3.0, y, z0 + 9.2), 0.42, "metal_galv", squash=0.32)


def hydrant(mb, x, y):
    z0 = TL.CURB_H
    cyl(mb, (x, y), 0.16, z0, z0 + 0.12, "hydrant", 12)
    cyl(mb, (x, y), 0.12, z0, z0 + 0.62, "hydrant", 12)
    sphere(mb, (x, y, z0 + 0.62), 0.13, "hydrant", 12, 5)
    hcyl(mb, (x - 0.2, y, z0 + 0.45), (x + 0.2, y, z0 + 0.45), 0.06, "hydrant")
    hcyl(mb, (x, y, z0 + 0.45), (x, y - 0.2, z0 + 0.45), 0.07, "hydrant")


def trash_can(mb, x, y):
    z0 = TL.CURB_H
    cyl(mb, (x, y), 0.3, z0 + 0.05, z0 + 0.95, "shed_green", 14, cap=False)
    cyl(mb, (x, y), 0.31, z0 + 0.88, z0 + 0.95, "shed_green", 14, cap=False)
    mb.poly([(x + 0.28 * math.cos(a), y + 0.28 * math.sin(a), z0 + 0.7) for a in np.linspace(0, 2 * math.pi, 14, endpoint=False)], "dark")


def trash_bags(mb, x, y, n, rng):
    z0 = TL.CURB_H
    for i in range(n):
        cx, cy = x + rng.uniform(-0.5, 0.5), y + rng.uniform(-0.8, 0.8)
        sphere(mb, (cx, cy, z0 + 0.28), rng.uniform(0.3, 0.42), "metal_black", 10, 6, squash=0.7)


def subway_entrance(mb, x0, x1, y0, y1):
    z0 = TL.CURB_H
    mb.poly([(x0 + 0.1, y0 + 0.1, z0 + 0.002), (x1 - 0.1, y0 + 0.1, z0 + 0.002), (x1 - 0.1, y1 - 0.1, z0 + 0.002),
             (x0 + 0.1, y1 - 0.1, z0 + 0.002)], "dark")
    # stairs descending toward +y
    n = 8
    for i in range(n):
        ya = y0 + 0.2 + i * (y1 - y0 - 0.4) / n
        zz = z0 - 0.18 * (i + 1)
        mb.box((x0 + 0.15, ya, zz - 0.05), (x1 - 0.15, ya + 0.32, zz), "concrete")
    for x in (x0, x1):
        for y in np.linspace(y0, y1, 5):
            cyl(mb, (x, y), 0.03, z0, z0 + 1.05, "subway_green", 6)
        hcyl(mb, (x, y0, z0 + 1.05), (x, y1, z0 + 1.05), 0.035, "subway_green")
    hcyl(mb, (x0, y1, z0 + 1.05), (x1, y1, z0 + 1.05), 0.035, "subway_green")
    for x in (x0, x1):
        cyl(mb, (x, y0 - 0.05), 0.06, z0, z0 + 2.6, "subway_green", 8)
        sphere(mb, (x, y0 - 0.05, z0 + 2.85), 0.24, "globe", 12, 8)


def food_cart(mb, x, y, umbrella_mat):
    z0 = TL.CURB_H
    mb.box((x - 0.6, y - 1.2, z0 + 0.35), (x + 0.6, y + 1.2, z0 + 1.45), "metal_alu")
    mb.box((x - 0.62, y - 1.22, z0 + 1.45), (x + 0.62, y + 1.22, z0 + 1.52), "metal_galv")
    for yy in (y - 0.9, y + 0.9):
        hcyl(mb, (x - 0.66, yy, z0 + 0.3), (x - 0.56, yy, z0 + 0.3), 0.28, "rubber", 12)
        hcyl(mb, (x + 0.56, yy, z0 + 0.3), (x + 0.66, yy, z0 + 0.3), 0.28, "rubber", 12)
    # glass display + hood
    mb.box((x - 0.55, y - 1.1, z0 + 1.52), (x + 0.55, y + 1.1, z0 + 1.9), "storefront")
    mb.box((x - 0.6, y - 1.15, z0 + 1.9), (x + 0.6, y + 1.15, z0 + 1.96), "metal_alu")
    cyl(mb, (x, y), 0.025, z0 + 1.9, z0 + 2.9, "metal_alu", 6)
    # umbrella: octagonal cone
    seg = 8
    for i in range(seg):
        a0, a1 = 2 * math.pi * i / seg, 2 * math.pi * (i + 1) / seg
        mb.poly([(x + 1.25 * math.cos(a0), y + 1.25 * math.sin(a0), z0 + 2.55),
                 (x + 1.25 * math.cos(a1), y + 1.25 * math.sin(a1), z0 + 2.55),
                 (x, y, z0 + 2.95)], umbrella_mat if i % 2 == 0 else "sign_white")


def newsstand(mb, x, y):
    z0 = TL.CURB_H
    mb.box((x - 0.8, y - 1.6, z0), (x + 0.8, y + 1.6, z0 + 2.5), "shed_green")
    mb.box((x - 0.95, y - 1.75, z0 + 2.5), (x + 0.95, y + 1.75, z0 + 2.65), "shed_green")
    mb.box((x - 0.82, y - 1.4, z0 + 0.9), (x - 0.78, y + 1.4, z0 + 2.2), "intimg0")


def bus_shelter(mb, x, y):
    z0 = TL.CURB_H
    for (px, py) in ((x - 0.7, y - 2.4), (x + 0.7, y - 2.4), (x - 0.7, y + 2.4), (x + 0.7, y + 2.4)):
        cyl(mb, (px, py), 0.04, z0, z0 + 2.4, "metal_alu", 6)
    mb.box((x - 0.8, y - 2.5, z0 + 2.4), (x + 0.8, y + 2.5, z0 + 2.5), "metal_alu")
    mb.box((x + 0.68, y - 2.4, z0 + 0.2), (x + 0.72, y + 2.4, z0 + 2.3), "storefront")
    mb.box((x - 0.72, y + 0.6, z0 + 0.2), (x - 0.68, y + 2.4, z0 + 2.3), "intimg3")
    mb.box((x + 0.1, y - 2.0, z0 + 0.45), (x + 0.6, y + 0.0, z0 + 0.5), "metal_alu")


def sidewalk_shed(mb, x_out, x_in, y0, y1):
    z0 = TL.CURB_H
    for y in np.arange(y0, y1 + 0.01, 2.5):
        for x in (x_out,):
            mb.box((x - 0.06, y - 0.06, z0), (x + 0.06, y + 0.06, z0 + 3.3), "shed_green")
    mb.box((x_out - 0.1, y0, z0 + 3.3), (x_in, y1, z0 + 3.55), "shed_green")
    mb.box((x_out - 0.12, y0, z0 + 3.55), (x_out, y1, z0 + 4.4), "plywood")
    mb.box((x_out - 0.1, y0, z0 + 3.0), (x_out + 0.02, y1, z0 + 3.3), "shed_green")


def build_props(coll, M):
    rng = random.Random(77)
    out = {}
    out["signals"] = build_signals(coll, M)
    midblock_crosswalk(coll, M)
    mb = MB()
    for y in np.arange(-300, 300, 28.0):
        for side in (-1, 1):
            yy = y + (7 if side > 0 else 0)
            if any(abs(yy - c) < 9 for c in (0, -80, 80)) or abs(yy - MIDBLOCK_Y) < 4:
                continue
            street_lamp(mb, side * (TL.AVE_HALF + 0.55), yy, side)
    for (x, y) in ((-10.6, -17.5), (10.65, 22.0), (-10.6, 17.0), (10.6, -58.0), (-10.6, -66.0)):
        hydrant(mb, x, y)
    for (x, y) in ((-11.3, -11.8), (11.3, 11.8), (11.4, -11.7), (-11.3, 12.0), (-11.0, -45.0), (11.0, -40.0)):
        trash_can(mb, x, y)
    for (x, y, n) in ((-10.75, -52.0, 5), (10.8, 16.0, 4), (10.8, -14.5, 6), (-10.75, 24.0, 3), (-10.75, -60.0, 4)):
        trash_bags(mb, x, y, n, rng)
    subway_entrance(mb, 11.2, 13.8, -27.0, -20.5)
    food_cart(mb, -11.35, -14.6, "awning4")
    newsstand(mb, 13.2, 30.0)
    bus_shelter(mb, 11.6, 42.0)
    sidewalk_shed(mb, 13.0, TL.BLX, -69.5, -31.0)
    # plaza: granite paving, planters with shrubs, benches
    z0 = TL.CURB_H
    mb.poly([(-27, -63, z0 + 0.004), (-16, -63, z0 + 0.004), (-16, -33, z0 + 0.004), (-27, -33, z0 + 0.004)], "plaza",
            uvs=[(-27, -63), (-16, -63), (-16, -33), (-27, -33)])
    for (px, py) in ((-23.5, -55.0), (-23.5, -46.0), (-20.0, -59.5)):
        mb.box((px - 1.3, py - 1.3, z0), (px + 1.3, py + 1.3, z0 + 0.6), "granite")
        for k in range(5):
            sphere(mb, (px + rng.uniform(-0.7, 0.7), py + rng.uniform(-0.7, 0.7), z0 + 0.85), rng.uniform(0.45, 0.65),
                   "awning0", 10, 6)
    for (px, py) in ((-25.5, -40.0), (-25.5, -50.5)):
        mb.box((px - 0.3, py - 1.0, z0 + 0.4), (px + 0.3, py + 1.0, z0 + 0.47), "plywood")
        mb.box((px - 0.25, py - 0.9, z0), (px + 0.25, py - 0.8, z0 + 0.4), "metal_dark")
        mb.box((px - 0.25, py + 0.8, z0), (px + 0.25, py + 0.9, z0 + 0.4), "metal_dark")
    out["static"] = mb.build("StreetFurniture", coll, M)
    return out


def movable_props(coll, M, rng):
    """Light objects that get knocked over/blown around (separate objects, animated by fx)."""
    objs = {}
    z0 = TL.CURB_H
    # cafe chairs & tables in the plaza
    for i, (x, y) in enumerate(((-19.5, -40.5), (-21.5, -42.0), (-19.0, -44.0), (-22.0, -38.5))):
        mb = MB()
        cyl(mb, (0, 0), 0.32, 0.72, 0.75, "metal_galv", 14)
        cyl(mb, (0, 0), 0.03, 0.0, 0.72, "metal_galv", 6)
        cyl(mb, (0, 0), 0.25, 0.0, 0.02, "metal_galv", 10)
        ob = mb.build(f"CafeTable{i}", coll, M)
        ob.location = (x, y, z0)
        objs[ob.name] = ob
        for j in range(2):
            mb = MB()
            mb.box((-0.21, -0.21, 0.44), (0.21, 0.21, 0.47), "metal_galv")
            mb.box((-0.21, 0.18, 0.47), (0.21, 0.21, 0.88), "metal_galv")
            for (lx, ly) in ((-0.19, -0.19), (0.19, -0.19), (-0.19, 0.19), (0.19, 0.19)):
                mb.box((lx - 0.012, ly - 0.012, 0), (lx + 0.012, ly + 0.012, 0.44), "metal_galv")
            ob = mb.build(f"CafeChair{i}_{j}", coll, M)
            a = rng.uniform(0, 2 * math.pi)
            ob.location = (x + 0.6 * math.cos(a), y + 0.6 * math.sin(a), z0)
            ob.rotation_euler = (0, 0, a + math.pi / 2 + rng.uniform(-0.5, 0.5))
            objs[ob.name] = ob
    # A-frame sidewalk sign in front of the corner shop
    mb = MB()
    mb.poly([(-0.32, -0.25, 0), (0.32, -0.25, 0), (0.32, 0.0, 1.0), (-0.32, 0.0, 1.0)], "sign:CAFE",
            uvs=[(0, 0), (1, 0), (1, 1), (0, 1)])
    mb.poly([(0.32, 0.25, 0), (-0.32, 0.25, 0), (-0.32, 0.0, 1.0), (0.32, 0.0, 1.0)], "sign:CAFE",
            uvs=[(0, 0), (1, 0), (1, 1), (0, 1)])
    ob = mb.build("AFrameSign", coll, M)
    ob.location = (-15.3, -20.0, z0)
    ob.rotation_euler = (0, 0, math.pi / 2)
    objs[ob.name] = ob
    return objs
