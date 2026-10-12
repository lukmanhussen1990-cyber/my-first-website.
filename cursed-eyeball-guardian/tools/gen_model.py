#!/usr/bin/env python3
"""Generate the Cursed Floating Eyeball Guardian model assets.

    python3 tools/gen_model.py            (run from the add-on root or anywhere)

Writes (deterministic, fixed seeds):
  RP/models/entity/eyeball_guardian.geo.json         geometry.ceg.eyeball_guardian
  RP/textures/entity/ceg/eyeball_guardian_<skin>.png        base (lit) layer
  RP/textures/entity/ceg/eyeball_guardian_<skin>_glow.png   emissive overlay
  RP/textures/entity/ceg/eyeball_guardian_<skin>_rage.png   rage emissive overlay
  RP/animations/eyeball_guardian.animation.json      (bone names stay in sync)

Conventions (see tools/preview/bedrock_render.py, validated on vanilla models):
  * model pixels, eye centre C = (0, 8, 0), front of the eye = -Z;
  * bone rotation: positive X tilts +Y towards -Z, so spikes use NEGATIVE X
    rotations to lean backwards, away from the iris; a parent Z rotation picks
    the direction around the eye: direction = (sin a, cos a, 0) for rz = a;
  * per-face UVs, planar projection per face direction:
      north u+X v-Y | south u-X v-Y | east(-X face) u-Z v-Y | west(+X) u+Z v-Y
      up u+X v-Z    | down u+X v+Z
  * UV space 64x64, PNGs 128x128 (2 texels per UV unit).

Model (92 cubes, budget 110):
  * sclera: voxel sphere, diameter 14, built from z-layers of 1-px voxel discs
    (18 boxes).  The 9-box 14x8x8 / 12x12x8 / 12x10x10 set reads as a rounded
    cube (its corners reach r = 8.7-9.4 vs 7 on the axes), the layered discs
    keep every corner within ~0.4 px of the sphere.  Front cap radius 5 carries
    the iris; the back cap is radius 4 (rounder back).
  * iris: 9 px rounded disc (3 boxes) 0.5 px proud of the front cap, pupil 4x4
    0.25 px in front of it; 12 ring spikes + 5 back spikes + 1 pole spike
    (3 boxes each: obsidian base 3x3, shaft 2x2, glowing cap), 8 smaller
    level>=3 spikes under spikes_extra (2 boxes each).
  * sclera texels are painted from a 3D field (direction from the eye centre),
    so veins/cracks/shading continue across faces of every direction.
"""
import json
import math
import os

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, ".."))
RP = os.path.join(ROOT, "packs", "Cursed_Eyeball_Guardian_RP")
GEO_PATH = os.path.join(RP, "models", "entity", "eyeball_guardian.geo.json")
TEX_DIR = os.path.join(RP, "textures", "entity", "ceg")
ANIM_PATH = os.path.join(RP, "animations", "eyeball_guardian.animation.json")

GEO_ID = "geometry.ceg.eyeball_guardian"
UV = 64          # UV units
TS = 2           # texels per UV unit
TEX = UV * TS    # 128 px
C = np.array([0.0, 8.0, 0.0])
R_EYE = 7.0

# SPEC section 6 skin colours (0-1 RGB): primary, dark, hot
SKINS = [
    ("crimson", (1.00, 0.08, 0.08), (0.45, 0.00, 0.02), (1.00, 0.75, 0.65)),
    ("void", (0.72, 0.20, 1.00), (0.30, 0.00, 0.50), (0.95, 0.80, 1.00)),
    ("frost", (0.15, 0.60, 1.00), (0.00, 0.22, 0.55), (0.80, 0.95, 1.00)),
    ("toxic", (0.25, 1.00, 0.30), (0.00, 0.40, 0.08), (0.85, 1.00, 0.70)),
]

# --------------------------------------------------------------------------
# small colour helpers


def col(*rgb):
    return np.array(rgb, dtype=np.float32)


def mix(a, b, t):
    a, b = np.asarray(a, dtype=np.float32), np.asarray(b, dtype=np.float32)
    t = np.asarray(t, dtype=np.float32)
    if t.ndim:
        t = t[..., None]
    return a + (b - a) * t


BAYER4 = (np.array([[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]], dtype=np.float32) + 0.5) / 16.0


def hash01(*ints):
    """Deterministic per-texel noise in [0,1) from integer arrays."""
    h = np.uint64(1469598103934665603)
    out = np.full(np.broadcast(*ints).shape, h, dtype=np.uint64)
    for a in ints:
        out ^= np.asarray(a, dtype=np.int64).astype(np.uint64)
        out *= np.uint64(1099511628211)
        out ^= out >> np.uint64(29)
    return (out % np.uint64(1 << 24)).astype(np.float64) / float(1 << 24)


# --------------------------------------------------------------------------
# UV allocation (texel grid occupancy, 1 texel padding)


class Atlas:
    def __init__(self):
        self.occ = np.zeros((TEX, TEX), dtype=bool)

    def reserve(self, u, v, w, h):
        x0, y0 = int(round(u * TS)), int(round(v * TS))
        x1, y1 = x0 + int(math.ceil(w * TS)), y0 + int(math.ceil(h * TS))
        assert x1 <= TEX and y1 <= TEX, (u, v, w, h)
        assert not self.occ[max(0, y0 - 1):y1 + 1, max(0, x0 - 1):x1 + 1].any(), ("overlap", u, v, w, h)
        self.occ[y0:y1, x0:x1] = True
        return (u, v)

    def alloc(self, w, h):
        tw, th = int(math.ceil(w * TS)), int(math.ceil(h * TS))
        for y in range(1, TEX - th):          # keep 1 texel off the texture border
            for x in range(1, TEX - tw):
                if not self.occ[max(0, y - 1):y + th + 1, max(0, x - 1):x + tw + 1].any():
                    self.occ[y:y + th, x:x + tw] = True
                    return (x / TS, y / TS)
        raise RuntimeError("atlas full for %sx%s" % (w, h))


# --------------------------------------------------------------------------
# geometry definition


def disc_boxes(r, delta=0.3):
    """Half-extents (hx, hy) of nested rectangles whose union is the 1-px
    voxel disc of radius r (cells whose centre lies within r + delta)."""
    rows = []
    for j in range(int(math.ceil(r + 1))):
        yc = j + 0.5
        rem = (r + delta) ** 2 - yc * yc
        if rem < 0.25:
            break
        hw = int(math.floor(math.sqrt(rem) - 0.5)) + 1  # cells with centre <= sqrt(rem)
        rows.append(hw)
    boxes = []
    for j, hw in enumerate(rows):
        if j + 1 < len(rows) and rows[j + 1] == hw:
            continue
        boxes.append((hw, j + 1))
    return boxes


# voxel sphere (diameter 14) built from z layers of pixel discs; the front cap
# (radius 5) carries the iris, the back cap is a little smaller (rounder back)
SCLERA_LAYERS = [(-7, -5, 5.0), (-5, -3, 6.0), (-3, 3, 7.0), (3, 5, 6.0), (5, 7, 4.0)]
SCLERA_BOXES = []  # (x0, x1, y0, y1, z0, z1) relative to C
for _z0, _z1, _r in SCLERA_LAYERS:
    for _hx, _hy in disc_boxes(_r):
        SCLERA_BOXES.append((-_hx, _hx, -_hy, _hy, _z0, _z1))

IRIS_FRONT = -7.5     # iris front plane (sclera front cap is -7)
IRIS_BACK = -6.5
IRIS_BOXES = [(4.5, 2.5), (3.5, 3.5), (2.5, 4.5)]  # half extents -> 9 px rounded disc
IRIS_R = 4.5
PUPIL_HALF = 2.0
PUPIL_FRONT, PUPIL_BACK = -7.75, -7.4

# spikes: (name, rz, tilt(x), kind)  kind -> piece lengths along +Y from C
SPIKE_KINDS = {
    # base 3x3 from r0, shaft 2x2, cap 2x2 (inflated, glowing)
    "long": dict(r0=4.5, base=4.0, shaft=4.5, cap=1.5),
    "short": dict(r0=4.5, base=3.5, shaft=2.5, cap=1.5),
    "back": dict(r0=4.5, base=4.0, shaft=3.0, cap=1.5),
    "pole": dict(r0=4.5, base=4.0, shaft=4.5, cap=1.5),
    # level >= 3 extras: base 2x2, cap 1x1
    "extra": dict(r0=5.0, base=5.0, shaft=0.0, cap=1.5),
}


def spike_list():
    main = []
    for i in range(12):  # ring around the eye edge, alternating long/short
        main.append((i * 30.0, -12.0 if i % 2 == 0 else -30.0, "long" if i % 2 == 0 else "short"))
    for i in range(5):  # backward diagonal ring
        main.append((36.0 + i * 72.0, -60.0, "back"))
    main.append((0.0, -90.0, "pole"))  # straight back (on the spin axis)
    extra = []
    for i in range(8):  # level >= 3: framing spikes between the ring spikes
        extra.append((15.0 + i * 45.0, 16.0 if i % 2 == 0 else -42.0, "extra"))
    return main, extra


# --------------------------------------------------------------------------
# texture "painters": each region gets a function returning per-texel
# (base_rgba, glow_rgba, rage_rgba) for a given skin.


class Region:
    def __init__(self, name, u, v, w, h, painter):
        self.name, self.u, self.v, self.w, self.h, self.painter = name, u, v, w, h, painter


def face_uv(u, v, w, h):
    return {"uv": [round(u, 4), round(v, 4)], "uv_size": [round(w, 4), round(h, 4)]}


# ----- sclera (3D field so all face directions agree) ---------------------


def sphere_dir(phi_deg, theta_deg):
    p, t = math.radians(phi_deg), math.radians(theta_deg)
    return np.array([math.sin(p) * math.cos(t), math.sin(p) * math.sin(t), -math.cos(p)])


def grow_veins(rng, n, phi0, width0, steps, branch_p, theta_off=0.0, jitter=1.0):
    segs = []  # (p0, p1, half_width)

    def width_at(phi, w):
        # hair-thin at the iris, thickest around the equator, tapering at the end
        grow_in = 0.5 + 0.5 * min(1.0, max(0.0, (phi - phi0) / 35.0))
        taper = min(1.0, max(0.45, (150.0 - phi) / 30.0))
        return max(0.27, w * grow_in * taper)

    def grow(phi, theta, w, nsteps, depth):
        prev = C + R_EYE * sphere_dir(phi, theta)
        dtheta = rng.normal(0, 5)
        for _ in range(int(nsteps)):
            phi += rng.uniform(3.0, 5.0)
            dtheta = 0.7 * dtheta + rng.normal(0, 2.6) * jitter
            theta += dtheta
            if phi > 150:
                break
            cur = C + R_EYE * sphere_dir(phi, theta)
            segs.append((prev, cur, width_at(phi, w)))
            prev = cur
            if depth < 1 and rng.random() < branch_p:
                grow(phi, theta + rng.choice([-1, 1]) * rng.uniform(18, 40), w * 0.7,
                     nsteps * rng.uniform(0.3, 0.6), depth + 1)

    for i in range(n):
        theta = theta_off + i * 360.0 / n + rng.uniform(-10, 10)
        grow(phi0 + rng.uniform(-2, 2), theta, width0 * rng.uniform(0.8, 1.15), steps * rng.uniform(0.7, 1.1), 0)
    return segs


def grow_cracks(rng, n, phi_range):
    segs = []
    for _ in range(n):
        phi = rng.uniform(*phi_range)
        theta = rng.uniform(0, 360)
        prev = C + R_EYE * sphere_dir(phi, theta)
        heading = rng.uniform(0, 360)
        for _ in range(int(rng.integers(5, 9))):
            heading += rng.choice([-1, 1]) * rng.uniform(25, 60)
            phi += math.cos(math.radians(heading)) * 6 + 2.5
            theta += math.sin(math.radians(heading)) * 9
            cur = C + R_EYE * sphere_dir(min(phi, 175), theta)
            segs.append((prev, cur, 0.5))
            prev = cur
    return segs


def seg_distance(points, segs):
    """min distance from points (N,3) to segments; returns (dist, width_at_min)."""
    if not segs:
        return np.full(len(points), np.inf), np.zeros(len(points))
    a = np.array([s[0] for s in segs])
    b = np.array([s[1] for s in segs])
    w = np.array([s[2] for s in segs])
    ab = b - a
    ab2 = np.maximum((ab * ab).sum(1), 1e-9)
    best = np.full(len(points), np.inf)
    best_w = np.zeros(len(points))
    for k in range(0, len(segs), 64):
        sl = slice(k, k + 64)
        ap = points[:, None, :] - a[None, sl, :]
        t = np.clip((ap * ab[None, sl, :]).sum(2) / ab2[None, sl], 0, 1)
        d = np.linalg.norm(ap - t[..., None] * ab[None, sl, :], axis=2)
        # normalise by width so the "most covering" segment wins
        score = d / w[None, sl]
        idx = np.argmin(score, axis=1)
        sc = score[np.arange(len(points)), idx]
        upd = sc < (best / np.maximum(best_w, 1e-9))
        best = np.where(upd, d[np.arange(len(points)), idx], best)
        best_w = np.where(upd, w[sl][idx], best_w)
    return best, best_w


RNG_VEINS = np.random.default_rng(20240626)
VEINS = grow_veins(RNG_VEINS, 7, 36.0, 0.40, 24, 0.05)
RAGE_VEINS = grow_veins(np.random.default_rng(777), 7, 37.0, 0.30, 18, 0.05, theta_off=25.0, jitter=1.2)
CRACKS = grow_cracks(np.random.default_rng(4242), 5, (78, 118))
BACK_CRACKS = grow_cracks(np.random.default_rng(99), 6, (128, 150))


FACE_NORMALS = {"north": (0, 0, -1), "south": (0, 0, 1), "east": (-1, 0, 0),
                "west": (1, 0, 0), "up": (0, 1, 0), "down": (0, -1, 0)}


def sclera_layers(points, tx, ty, skin, face_normal=(0, 0, -1)):
    """points: (N,3) visible voxel surface points; tx,ty texel ints for noise.
    face_normal: direction of the faces this region is painted for; texels
    where the ideal sphere turns away from it get darker (pillow shading),
    which makes the flat voxel faces read as a round ball."""
    _, P, D, H = skin
    P, D, H = col(*P), col(*D), col(*H)
    d = points - C
    d /= np.maximum(np.linalg.norm(d, axis=1, keepdims=True), 1e-9)
    phi = np.degrees(np.arccos(np.clip(-d[:, 2], -1, 1)))
    n = len(points)
    noise = hash01(tx, ty, 3)
    noise2 = hash01(tx, ty, 11)
    bay = BAYER4[ty % 4, tx % 4]

    # --- sclera tone ramp (5-step pixel-art palette, pinkish shadows)
    ramp = [col(1.00, 0.97, 0.95), col(0.95, 0.91, 0.89), col(0.88, 0.82, 0.81),
            col(0.79, 0.70, 0.70), col(0.65, 0.53, 0.55)]
    shade = 0.25 + 0.55 * np.clip((phi - 40) / 100, 0, 1) - 0.12 * d[:, 1] + 0.18 * (noise - 0.5)
    shade += 0.18 * np.clip((40 - phi) / 6, 0, 1)             # occlusion ring under the iris lip
    turn = 1.0 - np.clip(d @ np.asarray(face_normal, dtype=np.float64), 0, 1)
    shade += 0.75 * turn                                       # pillow shading per face
    idx = np.clip(np.floor(shade * 4 + (bay - 0.5) * 0.9), 0, 4).astype(int)
    base = np.stack([ramp[i] for i in range(5)])[idx]
    # faint inflamed blush near the iris
    blush = np.clip((60 - phi) / 25, 0, 1) * 0.10
    base = mix(base, mix(col(0.93, 0.62, 0.60), P, 0.25), blush)
    # pink speckles (capillaries)
    speck = (noise2 > 0.965) & (phi > 45) & (phi < 120)
    base[speck] = mix(base[speck], mix(col(0.9, 0.45, 0.45), P, 0.4), 0.55)

    glow = np.zeros((n, 4), dtype=np.float32)
    rage = np.zeros((n, 4), dtype=np.float32)
    # rage: whole sclera faintly inflamed near the iris
    inflame = np.clip((95 - phi) / 50, 0, 1) * 0.2
    rage[:, :3] = mix(P, H, 0.15)
    rage[:, 3] = inflame

    # --- veins (thicker near the iris)
    sp = C + R_EYE * d
    vd, vw = seg_distance(sp, VEINS)
    vein = vd < vw
    core = (vd < vw * 0.4) & (vw > 0.42)
    vcol = mix(D, P, 0.7)
    vcol_core = mix(D, P, 0.25)
    thin = vw < 0.31
    base[vein] = np.where(thin[vein, None], mix(base[vein], mix(P, D, 0.2), 0.8), vcol)
    base[core & ~thin] = vcol_core
    galpha = np.clip(0.2 + 0.6 * vw, 0.3, 0.6)
    glow[vein, :3] = mix(P, D, 0.25)
    glow[vein, 3] = galpha[vein]
    rage[vein, :3] = mix(P, H, 0.25)
    rage[vein, 3] = np.clip(galpha[vein] + 0.35, 0, 1)

    # rage-only veins (appear only in the rage glow overlay)
    rd, rw = seg_distance(sp, RAGE_VEINS)
    rv = (rd < rw) & ~vein
    rage[rv, :3] = mix(P, H, 0.1)
    rage[rv, 3] = 0.85

    # --- dark corruption towards the back pole (rotationally symmetric so the
    # spinning spike crown always emerges from it)
    corr = np.clip((phi - 118) / 22, 0, 1)
    cdither = corr > (bay * 0.85 + noise * 0.3)
    obs = mix(col(0.11, 0.06, 0.13), D, 0.18)
    obs2 = mix(col(0.20, 0.12, 0.24), D, 0.15)
    base[cdither] = np.where((noise[cdither] > 0.6)[:, None], obs2, obs)
    edge = (corr > 0.05) & ~cdither & (noise > 0.55)
    base[edge] = mix(base[edge], obs2, 0.6)

    # --- cracks: dark outline with a glowing core
    for segs, outer, inner in ((CRACKS, 0.42, 0.2), (BACK_CRACKS, 0.5, 0.24)):
        cd, _ = seg_distance(sp, segs)
        dark = cd < outer
        hot = cd < inner
        base[dark & ~hot] = mix(col(0.07, 0.03, 0.08), D, 0.2)
        base[hot] = mix(D, P, 0.6)
        glow[hot, :3] = P
        glow[hot, 3] = 0.9
        rage[hot, :3] = mix(P, H, 0.45)
        rage[hot, 3] = 1.0
        rdark = dark & ~hot
        rage[rdark, :3] = D
        rage[rdark, 3] = np.maximum(rage[rdark, 3], 0.5)

    base_rgba = np.concatenate([base, np.ones((n, 1), dtype=np.float32)], axis=1)
    return base_rgba, glow, rage


# visible surface depth per projection direction (exact for this star-shaped union)


def sclera_surface(axis, sign, a, b):
    """Return the outermost coordinate along `axis` (sign +1/-1) for the voxel
    union at the two in-plane coordinates (a, b) (relative to C), or nan.
    Exact for this shape: every column through it is solid out to its surface."""
    best = np.full(np.shape(a), np.nan)
    others = [i for i in range(3) if i != axis]
    for bx in SCLERA_BOXES:
        lo = (bx[0], bx[2], bx[4])
        hi = (bx[1], bx[3], bx[5])
        inside = ((a >= lo[others[0]] - 1e-6) & (a <= hi[others[0]] + 1e-6)
                  & (b >= lo[others[1]] - 1e-6) & (b <= hi[others[1]] + 1e-6))
        val = hi[axis] if sign > 0 else lo[axis]
        cur = np.where(inside, val, np.nan)
        if sign > 0:
            best = np.where(np.isnan(best), cur, np.where(np.isnan(cur), best, np.maximum(best, cur)))
        else:
            best = np.where(np.isnan(best), cur, np.where(np.isnan(cur), best, np.minimum(best, cur)))
    return best


def make_sclera_painter(direction):
    """direction in north/south/east/west/up/down; region is 14x14 units."""

    def painter(lx, ly, tx, ty, skin):
        # lx, ly: texel-centre coordinates inside the region in UV units [0,14)
        if direction == "north":
            x, y = lx - 7, 7 - ly
            z = sclera_surface(2, -1, x, y)
            pts = np.stack([x, y, z], -1)
        elif direction == "south":
            x, y = 7 - lx, 7 - ly
            z = sclera_surface(2, +1, x, y)
            pts = np.stack([x, y, z], -1)
        elif direction == "east":   # -X face, u -> -Z
            zc, y = 7 - lx, 7 - ly
            x = sclera_surface(0, -1, y, zc)
            pts = np.stack([x, y, zc], -1)
        elif direction == "west":   # +X face, u -> +Z
            zc, y = lx - 7, 7 - ly
            x = sclera_surface(0, +1, y, zc)
            pts = np.stack([x, y, zc], -1)
        elif direction == "up":     # u -> +X, v -> -Z
            x, zc = lx - 7, 7 - ly
            y = sclera_surface(1, +1, x, zc)
            pts = np.stack([x, y, zc], -1)
        else:                       # down: u -> +X, v -> +Z
            x, zc = lx - 7, ly - 7
            y = sclera_surface(1, -1, x, zc)
            pts = np.stack([x, y, zc], -1)
        valid = ~np.isnan(pts).any(-1)
        pts = np.where(valid[..., None], pts, 0.0) + C
        shape = lx.shape
        b, g, r = sclera_layers(pts.reshape(-1, 3), tx.ravel(), ty.ravel(), skin, FACE_NORMALS[direction])
        b, g, r = (a.reshape(shape + (4,)) for a in (b, g, r))
        return b, g, r, valid

    return painter


# ----- iris / pupil ----------------------------------------------------------


def iris_colors(x, y, tx, ty, skin, rage_mode=False):
    _, P, D, H = skin
    P, D, H = col(*P), col(*D), col(*H)
    r = np.hypot(x, y)
    th = np.degrees(np.arctan2(y, x))
    noise = hash01(tx, ty, 21)
    sector = np.floor((th + 360) / 22.5 + noise * 0.6).astype(int) % 2
    hot_r = 1.8 if rage_mode else 1.5
    if rage_mode:  # brighter, more saturated: the dark bands lift towards primary
        D = mix(D, P, 0.45)
    c = np.zeros(r.shape + (3,), dtype=np.float32)
    bands = [
        (hot_r, mix(H, col(1, 1, 1), 0.15) if rage_mode else H),
        (hot_r + 0.7, mix(H, P, 0.5)),
        (3.5, P),
        (3.85, mix(P, D, 0.35)),
        (4.2, mix(P, D, 0.75)),
        (99, mix(D, col(0.04, 0.0, 0.01), 0.6)),
    ]
    lo = -1
    for hi, colour in bands:
        m = (r > lo) & (r <= hi)
        c[m] = colour
        lo = hi
    stria = (r > hot_r + 0.5) & (r < 3.9)
    c[stria & (sector == 1)] *= 0.86
    hi = stria & (sector == 0) & (noise > 0.72)
    c[hi] = mix(c[hi], H, 0.3)
    if rage_mode:
        c = np.clip(c * 1.25, 0, 1)
    return c


def iris_front_painter(lx, ly, tx, ty, skin):
    x, y = lx - 5, 5 - ly
    inside = np.zeros(x.shape, dtype=bool)
    for hx, hh in IRIS_BOXES:
        inside |= (np.abs(x) <= hx) & (np.abs(y) <= hh)
    base = iris_colors(x, y, tx, ty, skin)
    rage = iris_colors(x, y, tx, ty, skin, rage_mode=True)
    one = np.ones(x.shape + (1,), dtype=np.float32)
    b = np.concatenate([base, one], -1)
    g = np.concatenate([np.clip(base * 1.05, 0, 1), one], -1)
    r = np.concatenate([rage, one], -1)
    return b, g, r, np.ones(x.shape, dtype=bool)


def iris_side_painter(lx, ly, tx, ty, skin, along_u):
    """Iris rim faces: front edge (z=-7.5) glows, back is the dark limbus."""
    _, P, D, H = skin
    P, D = col(*P), col(*D)
    depth = lx if along_u else ly  # 0 at front lip .. 1 at the back
    c = np.where((depth < 0.5)[..., None], mix(D, P, 0.35), mix(D, col(0.05, 0, 0.01), 0.5))
    one = np.ones(lx.shape + (1,), dtype=np.float32)
    b = np.concatenate([c, one], -1)
    ga = np.where(depth < 0.5, 0.8, 0.0)[..., None].astype(np.float32)
    g = np.concatenate([mix(D, P, 0.5) * np.ones_like(c), ga], -1)
    r = np.concatenate([mix(D, P, 0.8) * np.ones_like(c), np.where(depth < 1.0, 1.0, 0.4)[..., None].astype(np.float32)], -1)
    return b, g, r, np.ones(lx.shape, dtype=bool)


def pupil_front_painter(lx, ly, tx, ty, skin):
    x, y = lx - 2, 2 - ly
    r = np.hypot(x, y)
    _, P, D, H = skin
    P, D = col(*P), col(*D)
    c = np.zeros(x.shape + (3,), dtype=np.float32) + col(0.035, 0.01, 0.02)
    rim = (r > 1.55) & (r <= 2.05)
    c[rim] = mix(col(0.03, 0, 0.01), D, 0.55)
    outside = r > 2.05
    ic = iris_colors(x, y, tx, ty, skin)
    c[outside] = ic[outside]
    hl = (np.abs(x + 0.75) < 0.5) & (np.abs(y - 0.75) < 0.5)   # 2x2 texel highlight
    c[hl] = col(0.86, 0.82, 0.82)
    hl2 = (np.abs(x - 0.75) < 0.25) & (np.abs(y + 0.75) < 0.25)  # faint second glint
    c[hl2] = col(0.30, 0.20, 0.22)
    one = np.ones(x.shape + (1,), dtype=np.float32)
    b = np.concatenate([c, one], -1)
    ga = np.where(outside, 1.0, np.where(hl, 0.7, 0.0))[..., None].astype(np.float32)
    g = np.concatenate([c, ga], -1)
    rc = iris_colors(x, y, tx, ty, skin, rage_mode=True)
    rr = np.where(outside[..., None], rc, c)
    r_ = np.concatenate([rr, ga], -1)
    return b, g, r_, np.ones(x.shape, dtype=bool)


def solid_painter(rgb, glow_a=0.0, rage_a=0.0, glow_rgb=None):
    def painter(lx, ly, tx, ty, skin):
        c = rgb(skin) if callable(rgb) else col(*rgb)
        gc = (glow_rgb(skin) if callable(glow_rgb) else c) if glow_rgb is not None else c
        shp = lx.shape
        b = np.concatenate([np.broadcast_to(c, shp + (3,)), np.ones(shp + (1,), np.float32)], -1)
        g = np.concatenate([np.broadcast_to(gc, shp + (3,)), np.full(shp + (1,), glow_a, np.float32)], -1)
        r = np.concatenate([np.broadcast_to(gc, shp + (3,)), np.full(shp + (1,), rage_a, np.float32)], -1)
        return b, g, r, np.ones(shp, dtype=bool)
    return painter


# ----- spikes (obsidian) ------------------------------------------------------


def obsidian(skin, tx, ty, s_frac, salt):
    """Faceted obsidian; s_frac = across-the-face position 0..1."""
    _, P, D, H = skin
    D = col(*D)
    o0 = mix(col(0.06, 0.035, 0.08), D, 0.12)
    o1 = mix(col(0.13, 0.08, 0.17), D, 0.12)
    o2 = mix(col(0.22, 0.15, 0.28), D, 0.10)
    o3 = mix(col(0.36, 0.28, 0.44), D, 0.08)
    n = hash01(tx, ty, salt)
    c = np.where((s_frac < 0.34)[..., None], o2, np.where((s_frac > 0.67)[..., None], o0, o1))
    c = np.where((n > 0.86)[..., None], o3, c)
    c = np.where((n < 0.10)[..., None], o0, c)
    return c


def spike_side_painter(kind_len, salt, crack_rows):
    """Side faces of a spike piece: lx across (0..w), ly along (0 = outer end)."""

    def painter(lx, ly, tx, ty, skin):
        _, P, D, H = skin
        P, D, H = col(*P), col(*D), col(*H)
        w = max(lx.max() + 0.25, 1.0)
        c = obsidian(skin, tx, ty, lx / w, salt)
        shp = lx.shape
        glow = np.zeros(shp + (4,), np.float32)
        rage = np.zeros(shp + (4,), np.float32)
        n = hash01(tx, 7 * salt, 5)               # per-column crack choice
        n2 = hash01(tx // 1, ty // 2, salt + 1)    # 2-texel dashes
        # thin glowing red cracks running along the spike, denser near the tip
        crack = (n > 0.62) & (ly < crack_rows) & (n2 > 0.35 + 0.25 * (ly / max(crack_rows, 0.1)))
        c[crack] = mix(D, P, 0.75)
        glow[crack, :3] = P
        glow[crack, 3] = 0.85
        rage[crack, :3] = mix(P, H, 0.4)
        rage[crack, 3] = 1.0
        # rage: the whole outer half of the shaft smoulders
        sm = (ly < kind_len * 0.5) & ~crack
        rage[sm, :3] = D
        rage[sm, 3] = 0.45
        b = np.concatenate([c, np.ones(shp + (1,), np.float32)], -1)
        return b, glow, rage, np.ones(shp, dtype=bool)

    return painter


def spike_cap_painter(top):
    def painter(lx, ly, tx, ty, skin):
        _, P, D, H = skin
        P, D, H = col(*P), col(*D), col(*H)
        w = lx.max() + 0.25
        shp = lx.shape
        if top:
            cx = np.abs(lx - w / 2) < w / 4 + 0.01
            cy = np.abs(ly - w / 2) < w / 4 + 0.01
            c = np.where((cx & cy)[..., None], mix(P, H, 0.7), np.where((cx | cy)[..., None], mix(P, H, 0.3), P))
        else:
            # bright tip end (ly small) fading to blood red towards the shaft
            c = np.where((ly < 0.5)[..., None], mix(P, H, 0.3), np.where((ly < 1.0)[..., None], P, mix(P, D, 0.35)))
            c = np.where((lx < 0.5)[..., None], mix(c, H, 0.2), c)
        one = np.ones(shp + (1,), np.float32)
        b = np.concatenate([c, one], -1)
        g = np.concatenate([np.clip(c * 1.05, 0, 1), one], -1)
        r = np.concatenate([np.clip(c * 1.2, 0, 1), one], -1)
        return b, g, r, np.ones(shp, dtype=bool)
    return painter


def base_top_painter(lx, ly, tx, ty, skin):
    c = obsidian(skin, tx, ty, lx / 3.0, 31)
    shp = lx.shape
    b = np.concatenate([c, np.ones(shp + (1,), np.float32)], -1)
    z = np.zeros(shp + (4,), np.float32)
    return b, z, z.copy(), np.ones(shp, dtype=bool)


# --------------------------------------------------------------------------
# build everything


def build():
    atlas = Atlas()
    regions = []

    def region(name, w, h, painter, at=None):
        u, v = atlas.reserve(at[0], at[1], w, h) if at else atlas.alloc(w, h)
        regions.append(Region(name, u, v, w, h, painter))
        return u, v

    # sclera: six 14x14 projections
    sc = {}
    for i, dname in enumerate(("north", "south", "east", "west")):
        sc[dname] = region("sclera_" + dname, 14, 14, make_sclera_painter(dname), at=(0.5 + i * 14.5, 0.5))
    sc["up"] = region("sclera_up", 14, 14, make_sclera_painter("up"), at=(0.5, 15))
    sc["down"] = region("sclera_down", 14, 14, make_sclera_painter("down"), at=(15, 15))
    iris_uv = region("iris_front", 10, 10, iris_front_painter, at=(29.5, 15))
    iris_h_uv = region("iris_rim_h", 10, 1, lambda *a: iris_side_painter(*a, along_u=False), at=(29.5, 25.5))
    iris_v_uv = region("iris_rim_v", 1, 10, lambda *a: iris_side_painter(*a, along_u=True), at=(40, 15))
    pupil_uv = region("pupil_front", 4, 4, pupil_front_painter, at=(43, 15))
    pupil_side_uv = region("pupil_side", 1, 1, solid_painter((0.03, 0.01, 0.02)), at=(43, 19.5))

    piece_regions = {}

    def piece(name, width, length, crack_rows, salt):
        side = region(name + "_side", width, length, spike_side_painter(length, salt, crack_rows))
        top = region(name + "_top", width, width, base_top_painter)
        piece_regions[name] = (side, top)

    piece("base3", 3, 4, 0.0, 41)
    piece("shaft_long", 2, 4.5, 2.5, 43)
    piece("shaft_short", 2, 3, 2.0, 47)
    piece("base2", 2, 5, 2.0, 53)
    for cname, wdt, ln in (("cap2", 2, 2), ("cap1", 1, 2)):
        side = region(cname + "_side", wdt, ln, spike_cap_painter(False))
        top = region(cname + "_top", wdt, wdt, spike_cap_painter(True))
        piece_regions[cname] = (side, top)

    # ---------------- geometry
    def cube(x0, y0, z0, x1, y1, z1, uvs, inflate=None):
        c = {"origin": [x0, y0, z0], "size": [round(x1 - x0, 4), round(y1 - y0, 4), round(z1 - z0, 4)], "uv": uvs}
        if inflate:
            c["inflate"] = inflate
        return c

    def sclera_cube(bx):
        x0, x1 = bx[0], bx[1]
        y0, y1 = 8 + bx[2], 8 + bx[3]
        z0, z1 = bx[4], bx[5]
        sx, sy, sz = x1 - x0, y1 - y0, z1 - z0
        uvs = {
            "north": face_uv(sc["north"][0] + x0 + 7, sc["north"][1] + 15 - y1, sx, sy),
            "south": face_uv(sc["south"][0] + 7 - x1, sc["south"][1] + 15 - y1, sx, sy),
            "east": face_uv(sc["east"][0] + 7 - z1, sc["east"][1] + 15 - y1, sz, sy),
            "west": face_uv(sc["west"][0] + z0 + 7, sc["west"][1] + 15 - y1, sz, sy),
            "up": face_uv(sc["up"][0] + x0 + 7, sc["up"][1] + 7 - z1, sx, sz),
            "down": face_uv(sc["down"][0] + x0 + 7, sc["down"][1] + z0 + 7, sx, sz),
        }
        return cube(x0, y0, z0, x1, y1, z1, uvs)

    def iris_cube(hx, hh):
        x0, x1 = -hx, hx
        y0, y1 = 8 - hh, 8 + hh
        z0, z1 = IRIS_FRONT, IRIS_BACK
        w, h, d = x1 - x0, y1 - y0, z1 - z0
        front = face_uv(iris_uv[0] + x0 + 5, iris_uv[1] + 13 - y1, w, h)
        uvs = {
            "north": front,
            "south": front,
            # east (-X face): u -> -Z so the front lip is at the u end
            "east": face_uv(iris_v_uv[0] + d, iris_v_uv[1] + 13 - y1, -d, h),
            "west": face_uv(iris_v_uv[0], iris_v_uv[1] + 13 - y1, d, h),
            # up: v -> -Z  (front lip at the v end); down: v -> +Z
            "up": face_uv(iris_h_uv[0] + x0 + 5, iris_h_uv[1] + d, w, -d),
            "down": face_uv(iris_h_uv[0] + x0 + 5, iris_h_uv[1], w, d),
        }
        return cube(x0, y0, z0, x1, y1, z1, uvs)

    def pupil_cube():
        hp = PUPIL_HALF
        side = face_uv(pupil_side_uv[0], pupil_side_uv[1], 1, 1)
        uvs = {"north": face_uv(pupil_uv[0], pupil_uv[1], 4, 4), "south": side,
               "east": side, "west": side, "up": side, "down": side}
        return cube(-hp, 8 - hp, PUPIL_FRONT, hp, 8 + hp, PUPIL_BACK, uvs)

    def spike_piece(r0, r1, half, side_reg, top_reg, inflate=None):
        """Box along +Y (local) from C+r0 to C+r1, square cross-section."""
        w = 2 * half
        ln = r1 - r0
        su, sv = side_reg
        # all four sides share the same region; v = 0 at the outer end
        side = face_uv(su, sv, w, ln)
        top = face_uv(top_reg[0], top_reg[1], w, w)
        uvs = {"north": side, "south": side, "east": side, "west": side, "up": top, "down": top}
        return cube(-half, 8 + r0, -half, half, 8 + r1, half, uvs, inflate)

    def spike_cubes(kind):
        k = SPIKE_KINDS[kind]
        r = k["r0"]
        out = []
        if kind == "extra":
            out.append(spike_piece(r, r + k["base"], 1.0, piece_regions["base2"][0], piece_regions["base2"][1]))
            r += k["base"]
            out.append(spike_piece(r, r + k["cap"], 0.5, *piece_regions["cap1"], inflate=0.1))
            return out
        out.append(spike_piece(r, r + k["base"], 1.5, *piece_regions["base3"]))
        r += k["base"]
        sreg = piece_regions["shaft_long" if k["shaft"] > 3.0 else "shaft_short"]
        out.append(spike_piece(r, r + k["shaft"], 1.0, *sreg))
        r += k["shaft"]
        out.append(spike_piece(r, r + k["cap"], 1.0, *piece_regions["cap2"], inflate=0.15))
        return out

    bones = [
        {"name": "root", "pivot": [0, 8, 0]},
        {"name": "eye", "parent": "root", "pivot": [0, 8, 0],
         "locators": {"center": [0, 8, 0], "lens": [0, 8, -8.5]}},
        {"name": "sclera", "parent": "eye", "pivot": [0, 8, 0],
         "cubes": [sclera_cube(b) for b in SCLERA_BOXES]},
        {"name": "iris", "parent": "eye", "pivot": [0, 8, IRIS_FRONT],
         "cubes": [iris_cube(*b) for b in IRIS_BOXES]},
        {"name": "pupil", "parent": "iris", "pivot": [0, 8, -7.6], "cubes": [pupil_cube()]},
        {"name": "spikes", "parent": "eye", "pivot": [0, 8, 0]},
        {"name": "spikes_extra", "parent": "eye", "pivot": [0, 8, 0]},
    ]
    main, extra = spike_list()
    spike_names = []
    for i, (rz, tilt, kind) in enumerate(main):
        n = "spike_%02d" % i
        spike_names.append(n)
        bones.append({"name": n, "parent": "spikes", "pivot": [0, 8, 0], "rotation": [0, 0, rz]})
        bones.append({"name": n + "_t", "parent": n, "pivot": [0, 8, 0], "rotation": [tilt, 0, 0],
                      "cubes": spike_cubes(kind)})
    extra_names = []
    for i, (rz, tilt, kind) in enumerate(extra):
        n = "spike_x%02d" % i
        extra_names.append(n)
        bones.append({"name": n, "parent": "spikes_extra", "pivot": [0, 8, 0], "rotation": [0, 0, rz]})
        bones.append({"name": n + "_t", "parent": n, "pivot": [0, 8, 0], "rotation": [tilt, 0, 0],
                      "cubes": spike_cubes(kind)})
    # drop empty rotation keys for tidiness
    for b in bones:
        if "rotation" in b and not any(b["rotation"]):
            del b["rotation"]

    geo = {
        "format_version": "1.12.0",
        "minecraft:geometry": [{
            "description": {
                "identifier": GEO_ID,
                "texture_width": UV,
                "texture_height": UV,
                "visible_bounds_width": 3,
                "visible_bounds_height": 3,
                "visible_bounds_offset": [0, 0.5, 0],
            },
            "bones": bones,
        }],
    }
    return geo, regions, spike_names, extra_names


# --------------------------------------------------------------------------
# painting


def fill_invalid(arr, valid):
    """Copy the nearest valid texel into invalid ones (iterative 4-neighbour dilation)."""
    arr = arr.copy()
    ok = valid.copy()
    while not ok.all():
        grown = ok.copy()
        for dy, dx in ((0, 1), (0, -1), (1, 0), (-1, 0)):
            src_ok = np.roll(np.roll(ok, dy, 0), dx, 1)
            src = np.roll(np.roll(arr, dy, 0), dx, 1)
            # do not wrap around the region edges
            if dy == 1:
                src_ok[0, :] = False
            if dy == -1:
                src_ok[-1, :] = False
            if dx == 1:
                src_ok[:, 0] = False
            if dx == -1:
                src_ok[:, -1] = False
            take = ~grown & src_ok
            arr[take] = src[take]
            grown |= take
        if (grown == ok).all():
            break
        ok = grown
    return arr


def paint(regions, skin):
    base = np.zeros((TEX, TEX, 4), np.float32)
    glow = np.zeros((TEX, TEX, 4), np.float32)
    rage = np.zeros((TEX, TEX, 4), np.float32)
    written = np.zeros((TEX, TEX), bool)
    for rg in regions:
        x0, y0 = int(round(rg.u * TS)), int(round(rg.v * TS))
        w, h = int(math.ceil(rg.w * TS)), int(math.ceil(rg.h * TS))
        tx, ty = np.meshgrid(np.arange(x0, x0 + w), np.arange(y0, y0 + h))
        lx = (tx - x0 + 0.5) / TS
        ly = (ty - y0 + 0.5) / TS
        b, g, r, valid = rg.painter(lx, ly, tx, ty, skin)
        # texels outside the visible surface: copy nearest valid (bleed guard)
        if not valid.all() and valid.any():
            b, g, r = (fill_invalid(a, valid) for a in (b, g, r))
        base[y0:y0 + h, x0:x0 + w] = b
        glow[y0:y0 + h, x0:x0 + w] = g
        rage[y0:y0 + h, x0:x0 + w] = r
        written[y0:y0 + h, x0:x0 + w] = True
    # 1-texel bleed guard around every region (copy edge texels outward)
    for img in (base, glow, rage):
        src = img.copy()
        for dy, dx in ((0, 1), (0, -1), (1, 0), (-1, 0), (1, 1), (-1, -1), (1, -1), (-1, 1)):
            sh = np.roll(np.roll(src, dy, 0), dx, 1)
            shw = np.roll(np.roll(written, dy, 0), dx, 1)
            # no wrap-around at the texture border
            if dy == 1:
                shw[0, :] = False
            if dy == -1:
                shw[-1, :] = False
            if dx == 1:
                shw[:, 0] = False
            if dx == -1:
                shw[:, -1] = False
            fill = ~written & shw
            img[fill] = sh[fill]
        # glow layers: colour of fully transparent texels doesn't matter, keep 0
    return base, glow, rage


def to_png(arr, path, keep_rgb_when_transparent=False):
    a = np.clip(arr, 0, 1)
    if not keep_rgb_when_transparent:
        a = a.copy()
        a[a[..., 3] <= 0.0, :3] = 0.0
    img = Image.fromarray((a * 255 + 0.5).astype(np.uint8), "RGBA")
    img.save(path, optimize=True)


# --------------------------------------------------------------------------
# animations (SPEC section 7) - bone names come from the generated geometry


def animations(spike_names, extra_names):
    def f(x):
        return round(x, 3)

    spikes_bones = {}
    for i, n in enumerate(spike_names + extra_names):
        ph = (i * 47) % 360
        amp = 4.0 if n.startswith("spike_x") else 6.0
        spikes_bones[n + "_t"] = {
            "rotation": [
                "math.sin(variable.t * 140.0 + %d.0) * (%s + 5.0 * variable.rage_blend)" % (ph, f(amp)),
                0.0,
                "math.cos(variable.t * 105.0 + %d.0) * %s" % ((ph * 3) % 360, f(amp * 0.6)),
            ]
        }
    return {
        "format_version": "1.8.0",
        "animations": {
            "animation.ceg.eyeball_guardian.float": {
                "loop": True,
                "bones": {
                    "root": {
                        "position": [
                            "math.sin(variable.t * 47.0) * 0.5",
                            "math.sin(variable.t * 90.0) * 1.2",
                            "math.cos(variable.t * 61.0) * 0.4",
                        ],
                        "rotation": [
                            "math.sin(variable.t * 65.0 + 40.0) * 3.0",
                            "math.sin(variable.t * 38.0) * 4.0",
                            "math.sin(variable.t * 52.0) * 5.0",
                        ],
                    }
                },
            },
            "animation.ceg.eyeball_guardian.look": {
                "loop": True,
                "bones": {
                    "eye": {"rotation": ["query.target_x_rotation", "query.target_y_rotation", 0.0]}
                },
            },
            "animation.ceg.eyeball_guardian.spikes": {
                "loop": True,
                "bones": spikes_bones,
            },
            "animation.ceg.eyeball_guardian.spin": {
                "loop": True,
                "bones": {
                    "spikes": {"rotation": [0.0, 0.0, "variable.spin"]},
                    "spikes_extra": {"rotation": [0.0, 0.0, "-variable.spin * 1.5"]},
                },
            },
            "animation.ceg.eyeball_guardian.iris": {
                "loop": True,
                "bones": {
                    "iris": {
                        "scale": [
                            "1.0 + math.sin(variable.t * 200.0) * 0.03 + variable.rage_blend * 0.06",
                            "1.0 + math.sin(variable.t * 200.0) * 0.03 + variable.rage_blend * 0.06",
                            1.0,
                        ]
                    },
                    "pupil": {
                        "scale": [
                            "math.lerp(0.92 + math.sin(variable.t * 70.0) * 0.12, 0.32, variable.rage_blend)",
                            "math.lerp(0.92 + math.sin(variable.t * 70.0) * 0.12, 1.3, variable.rage_blend)",
                            1.0,
                        ]
                    },
                },
            },
            "animation.ceg.eyeball_guardian.summon": {
                "animation_length": 0.8,
                "bones": {
                    "root": {
                        "scale": {
                            "0.0": [0.05, 0.05, 0.05],
                            "0.45": [1.18, 1.18, 1.18],
                            "0.65": [0.94, 0.94, 0.94],
                            "0.8": [1.0, 1.0, 1.0],
                        },
                        "rotation": {"0.0": [0.0, -540.0, 0.0], "0.6": [0.0, 0.0, 0.0]},
                    },
                    "spikes": {"scale": {"0.0": [0.2, 0.2, 0.2], "0.35": [0.2, 0.2, 0.2], "0.7": [1.1, 1.1, 1.1], "0.8": [1.0, 1.0, 1.0]}},
                },
            },
            "animation.ceg.eyeball_guardian.attack": {
                "animation_length": 0.4,
                "bones": {
                    "eye": {"position": {"0.0": [0.0, 0.0, 0.0], "0.06": [0.0, 0.0, 2.0], "0.4": [0.0, 0.0, 0.0]}},
                    "iris": {"scale": {"0.0": [1.0, 1.0, 1.0], "0.06": [1.3, 1.3, 1.0], "0.4": [1.0, 1.0, 1.0]}},
                    "pupil": {"scale": {"0.0": [1.0, 1.0, 1.0], "0.06": [0.45, 0.45, 1.0], "0.4": [1.0, 1.0, 1.0]}},
                    "spikes": {"scale": {"0.0": [1.0, 1.0, 1.0], "0.08": [1.15, 1.15, 1.15], "0.4": [1.0, 1.0, 1.0]}},
                },
            },
        },
    }


def verify(geo, regions):
    """Every face must sample inside one painted region; stay within budget."""
    n = 0
    for bone in geo["minecraft:geometry"][0]["bones"]:
        for c in bone.get("cubes", []):
            for face, fv in c["uv"].items():
                u, v = fv["uv"]
                su, sv = fv["uv_size"]
                u0, u1 = sorted((u, u + su))
                v0, v1 = sorted((v, v + sv))
                ok = any(r.u - 1e-6 <= u0 and u1 <= r.u + r.w + 1e-6 and r.v - 1e-6 <= v0 and v1 <= r.v + r.h + 1e-6
                         for r in regions)
                assert ok, ("face UV outside every painted region", bone["name"], face, fv)
                n += 1
    assert count_cubes(geo) <= 110, count_cubes(geo)
    return n


def count_cubes(geo):
    return sum(len(b.get("cubes", [])) for b in geo["minecraft:geometry"][0]["bones"])


def main():
    geo, regions, spike_names, extra_names = build()
    nfaces = verify(geo, regions)
    os.makedirs(os.path.dirname(GEO_PATH), exist_ok=True)
    os.makedirs(TEX_DIR, exist_ok=True)
    os.makedirs(os.path.dirname(ANIM_PATH), exist_ok=True)
    with open(GEO_PATH, "w") as fh:
        json.dump(geo, fh, indent=1)
        fh.write("\n")
    for skin in SKINS:
        base, glow, rage = paint(regions, skin)
        to_png(base, os.path.join(TEX_DIR, "eyeball_guardian_%s.png" % skin[0]), keep_rgb_when_transparent=True)
        to_png(glow, os.path.join(TEX_DIR, "eyeball_guardian_%s_glow.png" % skin[0]))
        to_png(rage, os.path.join(TEX_DIR, "eyeball_guardian_%s_rage.png" % skin[0]))
    with open(ANIM_PATH, "w") as fh:
        json.dump(animations(spike_names, extra_names), fh, indent=1)
        fh.write("\n")
    print("geometry: %d bones, %d cubes, %d faces (UVs verified) -> %s" % (
        len(geo["minecraft:geometry"][0]["bones"]), count_cubes(geo), nfaces, GEO_PATH))
    print("textures: %d PNGs -> %s" % (len(SKINS) * 3, TEX_DIR))
    print("animations ->", ANIM_PATH)


if __name__ == "__main__":
    main()
