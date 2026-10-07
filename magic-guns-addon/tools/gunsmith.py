"""
gunsmith.py - tiny toolkit that turns a list of boxes into a Bedrock geometry
file, an HD per-face texture atlas, and rendered inventory icons.

Models are authored in *Blockbench space* (right handed, +Y up, the barrel
points to -Z / "north").  Export follows Blockbench's own Bedrock codec
(x is mirrored, X/Y rotations are negated, up/down UVs are flipped) so the
geometry looks in game exactly like the preview renders made here.
"""

import json
import math
import os

import numpy as np
from PIL import Image

FACES = ("north", "south", "east", "west", "up", "down")


# ---------------------------------------------------------------- noise utils

def _smooth_noise(rng, h, w, cell):
    """Value noise in [0,1] of shape (h,w) with roughly `cell`-pixel blobs."""
    gh = max(2, int(math.ceil(h / cell)) + 2)
    gw = max(2, int(math.ceil(w / cell)) + 2)
    grid = rng.random((gh, gw))
    ys = np.linspace(0, gh - 2, h, endpoint=False) if h > 1 else np.zeros(1)
    xs = np.linspace(0, gw - 2, w, endpoint=False) if w > 1 else np.zeros(1)
    y0 = np.floor(ys).astype(int)
    x0 = np.floor(xs).astype(int)
    fy = ys - y0
    fx = xs - x0
    fy = fy * fy * (3 - 2 * fy)
    fx = fx * fx * (3 - 2 * fx)
    a = grid[y0][:, x0]
    b = grid[y0][:, x0 + 1]
    c = grid[y0 + 1][:, x0]
    d = grid[y0 + 1][:, x0 + 1]
    top = a + (b - a) * fx[None, :]
    bot = c + (d - c) * fx[None, :]
    return top + (bot - top) * fy[:, None]


def _fbm(rng, h, w, cell=8, octaves=3):
    out = np.zeros((h, w))
    amp, tot = 1.0, 0.0
    for _ in range(octaves):
        out += amp * _smooth_noise(rng, h, w, max(1, cell))
        tot += amp
        amp *= 0.5
        cell = max(1, cell // 2)
    return out / tot


def _c(rgb):
    return np.array(rgb, dtype=float)


def _mix(a, b, t):
    t = np.asarray(t, dtype=float)
    if t.ndim == 2:
        t = t[..., None]
    return a + (b - a) * t


def _grid(h, w):
    yy, xx = np.mgrid[0:h, 0:w]
    return yy.astype(float), xx.astype(float)


def _edge_dist(h, w):
    """Texel distance to the top, bottom, left and right edge of a face."""
    yy, xx = _grid(h, w)
    return yy, (h - 1) - yy, xx, (w - 1) - xx


def _dilate(m):
    out = m.copy()
    out[1:, :] = np.maximum(out[1:, :], m[:-1, :])
    out[:-1, :] = np.maximum(out[:-1, :], m[1:, :])
    out[:, 1:] = np.maximum(out[:, 1:], m[:, :-1])
    out[:, :-1] = np.maximum(out[:, :-1], m[:, 1:])
    return out


def _voronoi(rng, h, w, cell):
    """Distance to the nearest / second nearest feature point and the cell id
    of every texel (facets, cracks, pebbled leather...)."""
    n = max(2, int(round(h * w / float(cell * cell))) + 1)
    py = rng.random(n) * (h + 2) - 1
    px = rng.random(n) * (w + 2) - 1
    yy, xx = _grid(h, w)
    d = np.sqrt((yy[..., None] + 0.5 - py) ** 2 + (xx[..., None] + 0.5 - px) ** 2)
    order = np.argsort(d, axis=-1)[..., :2]
    ds = np.take_along_axis(d, order, axis=-1)
    return ds[..., 0], ds[..., 1], order[..., 0], n


def _draw_line(m, y0, x0, y1, x1, val=1.0):
    n = int(max(abs(y1 - y0), abs(x1 - x0))) + 1
    ys = np.round(np.linspace(y0, y1, n)).astype(int)
    xs = np.round(np.linspace(x0, x1, n)).astype(int)
    ok = (ys >= 0) & (ys < m.shape[0]) & (xs >= 0) & (xs < m.shape[1])
    m[ys[ok], xs[ok]] = np.maximum(m[ys[ok], xs[ok]], val)


# ------------------------------------------------------------------ materials
#
# Each material paints an (h, w, 3) RGB float image plus an (h, w) glow mask
# in [0,1].  `ctx` tells the painter about the face: which texture axis runs
# along the cube's longest dimension (for grain / brushing direction) and
# whether it is a side, top or bottom face (for bevel lighting).
#
# Face texture orientation (Blockbench space, barrel towards -Z):
#   east (+X, the side shown by icons): u runs rear -> muzzle, v top -> bottom
#   west (-X): u runs muzzle -> rear, v top -> bottom
#   north / south: u across X, v top -> bottom;  up / down: u across X, v along Z

_NORMAL_AXIS = {"north": 2, "south": 2, "east": 0, "west": 0, "up": 1, "down": 1}


class FaceCtx:
    def __init__(self, face, w, h, grain_along_u, cube_size, seed):
        self.face = face
        self.w = w
        self.h = h
        self.grain_along_u = grain_along_u
        self.cube_size = cube_size
        self.rng = np.random.default_rng(seed)
        self.is_side = face in ("north", "south", "east", "west")
        self.is_up = face == "up"
        self.is_down = face == "down"
        size = np.asarray(cube_size, dtype=float)
        self.normal_axis = _NORMAL_AXIS[face]
        self.long_axis = int(np.argmax(size))
        # the face looks down the cube's long axis (end grain, coil ends...)
        self.end_face = self.normal_axis == self.long_axis and size[self.long_axis] > 1.25 * np.sort(size)[1]

    def axis_dir(self, axis):
        """'u' or 'v' when model axis `axis` runs along this face's texture
        u or v, None when the face is perpendicular to it."""
        f = self.face
        if axis == 2:
            return "u" if f in ("east", "west") else ("v" if f in ("up", "down") else None)
        if axis == 0:
            return "u" if f in ("north", "south", "up", "down") else None
        return "v" if f in ("north", "south", "east", "west") else None

    def axis_coord(self, axis):
        """Texel coordinate running along model axis `axis` on this face (None
        when the face is perpendicular to it).  Along Z it always counts from
        the rear toward the muzzle."""
        d = self.axis_dir(axis)
        if d is None:
            return None
        yy, xx = _grid(self.h, self.w)
        if d == "u":
            return (self.w - 1) - xx if (axis == 2 and self.face == "west") else xx
        return yy


def _streaks(ctx, cell_across=1.5, strength=1.0):
    """Brushed-metal / grain streaks running along the long axis."""
    rng = ctx.rng
    if ctx.grain_along_u:
        line = _smooth_noise(rng, ctx.h, 1, cell_across)[:, 0]
        n = np.repeat(line[:, None], ctx.w, axis=1)
        n = n + 0.25 * _smooth_noise(rng, ctx.h, ctx.w, max(2, ctx.w // 3))
    else:
        line = _smooth_noise(rng, 1, ctx.w, cell_across)[0]
        n = np.repeat(line[None, :], ctx.h, axis=0)
        n = n + 0.25 * _smooth_noise(rng, ctx.h, ctx.w, max(2, ctx.h // 3))
    return (n / 1.25 - 0.5) * strength


def _bevel(img, ctx, light=0.18, dark=0.22):
    """Lighten the top edge, darken the bottom edge -> chunky machined look."""
    h, w = ctx.h, ctx.w
    out = img.copy()
    if h >= 3 and w >= 3:
        if ctx.is_side:
            out[0, :] = out[0, :] + light
            out[-1, :] = out[-1, :] - dark
            out[:, 0] = out[:, 0] - dark * 0.35
            out[:, -1] = out[:, -1] - dark * 0.35
        elif ctx.is_up:
            out[0, :] += light * 0.6
            out[-1, :] += light * 0.6
            out[:, 0] += light * 0.6
            out[:, -1] += light * 0.6
        else:
            out[0, :] -= dark * 0.5
            out[-1, :] -= dark * 0.5
    return out


def _spec_band(ctx, pos=0.3, width=0.18, strength=0.25):
    """Soft horizontal highlight on side faces (polished metal reflection)."""
    if not ctx.is_side or ctx.h < 3:
        return np.zeros((ctx.h, ctx.w))
    v = (np.arange(ctx.h) + 0.5) / ctx.h
    band = np.exp(-((v - pos) ** 2) / (2 * width ** 2)) * strength
    return np.repeat(band[:, None], ctx.w, axis=1)


def _ao(img, ctx, strength=0.25, width=1.6):
    """Ambient occlusion: darken toward the edges where parts meet (mostly
    the bottom of side faces and the ends of long faces)."""
    h, w = ctx.h, ctx.w
    if h < 3 or w < 3 or strength <= 0:
        return img
    t, b, l, r = _edge_dist(h, w)

    def e(d):
        return np.exp(-d / width)
    if ctx.is_side:
        occ = 0.3 * e(t + 1) + 1.0 * e(b) + 0.55 * e(np.minimum(l, r))
    elif ctx.is_up:
        occ = 0.35 * e(np.minimum(np.minimum(t, b), np.minimum(l, r)))
    else:
        occ = 0.9 * e(np.minimum(np.minimum(t, b), np.minimum(l, r)))
    return img * (1 - strength * np.clip(occ, 0, 1))[..., None]


def _wear(img, ctx, bare, amount=0.5):
    """Scuffed, lighter bare metal chipped along exposed edges."""
    h, w = ctx.h, ctx.w
    if amount <= 0 or h < 3 or w < 3:
        return img
    t, b, l, r = _edge_dist(h, w)
    rng = ctx.rng
    clump = _smooth_noise(rng, h, w, 2.5)
    speck = rng.random((h, w))
    if ctx.is_side:
        rim = (t < 1) * 1.0 + (np.minimum(l, r) < 1) * 0.55 + ((t >= 1) & (t < 2)) * 0.3
    elif ctx.is_up:
        rim = (np.minimum(np.minimum(t, b), np.minimum(l, r)) < 1) * 0.85
    else:
        rim = (np.minimum(t, b) < 1) * 0.25
    m = np.clip(rim, 0, 1) * (clump > 0.42) * (speck > 0.18)
    return _mix(img, bare, m * amount)


def _scratches(ctx, density=1.0):
    """A few hairline scratches, mostly along the long axis."""
    h, w = ctx.h, ctx.w
    m = np.zeros((h, w))
    if h < 4 or w < 4 or density <= 0:
        return m
    rng = ctx.rng
    n = int(rng.poisson(density * h * w / 150.0))
    base_ang = 0.0 if ctx.grain_along_u else math.pi / 2
    for _ in range(n):
        y0, x0 = rng.uniform(0, h), rng.uniform(0, w)
        ln = rng.uniform(2, 6)
        ang = base_ang + rng.normal(0, 0.35) + (math.pi / 2 if rng.random() < 0.15 else 0.0)
        _draw_line(m, y0, x0, y0 + ln * math.sin(ang), x0 + ln * math.cos(ang), rng.uniform(0.5, 1.0))
    return m


def metal(base, hi=None, streak=0.10, band=0.22, noise=0.05, wear=0.6, scratch=1.0, grad=0.18, polish=0.5):
    """Machined metal: brushed along the long axis, polished reflection band
    over a darker "horizon" line, hairline scratches, AO toward the seams and
    scuffed bright edges."""
    base = _c(base)
    hi = _c(hi) if hi is not None else np.minimum(base * 1.6 + 0.08, 1)
    bare = np.minimum(hi * 0.85 + 0.12, 1)

    def paint(ctx):
        h, w = ctx.h, ctx.w
        img = np.empty((h, w, 3))
        img[:] = base
        if ctx.is_side and h >= 3:
            v = (np.arange(h) + 0.5) / h
            img *= (1 + grad * 0.5 - grad * v)[:, None, None]
        img += _streaks(ctx, 1.2, streak)[..., None]
        img += (_fbm(ctx.rng, h, w, 4) - 0.5)[..., None] * noise
        img = _mix(img, hi, _spec_band(ctx, 0.28, 0.2, 1.0) * band)
        if polish and ctx.is_side and ctx.h >= 5:
            img = _mix(img, hi, _spec_band(ctx, 0.2, 0.07, 1.0) * band * polish)
            img *= (1 - _spec_band(ctx, 0.56, 0.08, 1.0) * 0.22 * polish)[..., None]
        if scratch:
            img = _mix(img, bare, _scratches(ctx, scratch) * 0.3)
        img = _ao(img, ctx, 0.28)
        if ctx.is_down:
            img *= 0.8
        img = _bevel(img, ctx)
        img = _wear(img, ctx, bare, wear)
        return img, np.zeros((h, w))
    return paint


def wood(base, dark, rings=5.0, pores=1.0, sheen=0.14):
    """Oiled hardwood: growth rings with cathedral figure, open pores along
    the grain, end grain rings on the faces that look down the long axis."""
    base, dark = _c(base), _c(dark)
    light = np.minimum(base * 1.2 + 0.03, 1)

    def paint(ctx):
        rng = ctx.rng
        h, w = ctx.h, ctx.w
        yy, xx = _grid(h, w)
        if ctx.end_face:
            cy = rng.uniform(-0.8, 1.8) * h
            cx = rng.uniform(-0.8, 1.8) * w
            ring = np.sqrt((yy - cy) ** 2 + (xx - cx) ** 2) + (_smooth_noise(rng, h, w, 3) - 0.5) * 1.6
        else:
            along, across = (xx, yy) if ctx.grain_along_u else (yy, xx)
            length = float(w if ctx.grain_along_u else h)
            warp = (_smooth_noise(rng, h, w, max(5.0, length / 2.0)) - 0.5) * 2.6
            c0 = rng.uniform(0.25, 0.75) * length
            arch = ((along - c0) / max(length, 1.0)) ** 2 * rng.uniform(2, 6) * (1 if rng.random() < 0.5 else -1)
            ring = across + warp + arch
        phase = (ring / rings + rng.random()) % 1.0
        late = np.clip(1 - phase / 0.24, 0, 1) ** 1.8
        t = np.clip(late * 0.62 + (1 - phase) * 0.2, 0, 1)
        img = _mix(np.broadcast_to(light, (h, w, 3)), dark, t)
        img += _streaks(ctx, 1.0, 0.05)[..., None]
        img += (_fbm(rng, h, w, 3) - 0.5)[..., None] * 0.03
        if pores and h >= 3 and w >= 3:
            pm = np.zeros((h, w))
            for _ in range(int(h * w / 22 * pores)):
                y0, x0 = int(rng.integers(0, h)), int(rng.integers(0, w))
                ln = int(rng.integers(1, 4))
                if ctx.end_face:
                    pm[y0, x0] = 1
                elif ctx.grain_along_u:
                    pm[y0, x0:x0 + ln] = 1
                else:
                    pm[y0:y0 + ln, x0] = 1
            img = _mix(img, dark * 0.8, pm * 0.2)
        img = _mix(img, np.minimum(light * 1.25 + 0.05, 1), _spec_band(ctx, 0.3, 0.18, 1.0) * sheen)
        img = _ao(img, ctx, 0.3)
        if ctx.is_down:
            img *= 0.85
        img = _bevel(img, ctx, 0.07, 0.12)
        img = _wear(img, ctx, np.minimum(light * 1.15, 1), 0.3)
        return img, np.zeros((h, w))
    return paint


def cloth(base, dark):
    """Woven twill (coat sleeves): diagonal weave + soft folds."""
    base, dark = _c(base), _c(dark)

    def paint(ctx):
        rng = ctx.rng
        h, w = ctx.h, ctx.w
        yy, xx = _grid(h, w)
        twill = ((xx + yy) % 4 < 2).astype(float)
        img = _mix(np.broadcast_to(base, (h, w, 3)), dark, twill * 0.35)
        folds = _smooth_noise(rng, h, w, max(3, min(h, w) // 2 + 2))
        img *= (0.88 + 0.24 * folds)[..., None]
        img += (rng.random((h, w)) - 0.5)[..., None] * 0.04
        img = _ao(img, ctx, 0.2)
        img = _bevel(img, ctx, 0.05, 0.1)
        return img, np.zeros((h, w))
    return paint


def leather(base, dark, stitch=None):
    """Pebbled leather (gloves): fine grain, soft creases, optional stitching."""
    base, dark = _c(base), _c(dark)
    stitch = _c(stitch) if stitch is not None else None

    def paint(ctx):
        rng = ctx.rng
        h, w = ctx.h, ctx.w
        img = np.empty((h, w, 3))
        img[:] = base
        if h >= 3 and w >= 3:
            d1, d2, _, _ = _voronoi(rng, h, w, 1.8)
            img = _mix(img, dark, np.clip(1 - (d2 - d1) / 0.7, 0, 1) * 0.45)
        img *= (0.9 + 0.2 * _fbm(rng, h, w, 4))[..., None]
        img = _mix(img, np.minimum(base * 2.2 + 0.08, 1), _spec_band(ctx, 0.3, 0.2, 1.0) * 0.12)
        if stitch is not None and ctx.is_side and h >= 8 and w >= 6:
            img[2, 1:-1:2] = stitch
        img = _ao(img, ctx, 0.22)
        img = _bevel(img, ctx, 0.06, 0.1)
        return img, np.zeros((h, w))
    return paint


def leather_wrap(base, dark, period=4):
    """Grip wrapped in diagonal leather straps: each strap rounded and lit
    on its upper edge, dark gaps between the turns, pebbled grain."""
    base, dark = _c(base), _c(dark)
    hi = np.minimum(base * 1.45 + 0.05, 1)

    def paint(ctx):
        h, w = ctx.h, ctx.w
        yy, xx = _grid(h, w)
        along, across = (xx, yy) if ctx.grain_along_u else (yy, xx)
        phase = ((along + across * 0.7) % period) / period
        strap = np.sin(np.pi * np.clip(phase * period / max(1, period - 1), 0, 1)) ** 0.6
        img = _mix(np.broadcast_to(dark, (h, w, 3)), base, strap)
        img = _mix(img, hi, np.clip(1 - np.abs(phase - 0.3) * 6, 0, 1) * 0.35)
        gap = phase >= (period - 1) / period
        img[gap] = dark * 0.7
        img += (ctx.rng.random((h, w)) - 0.5)[..., None] * 0.05
        img = _ao(img, ctx, 0.25)
        img = _bevel(img, ctx, 0.06, 0.1)
        return img, np.zeros((h, w))
    return paint


def knurl(base, hi, cell=4):
    """Diamond checkering: little lit pyramids between dark grooves."""
    base, hi = _c(base), _c(hi)

    def paint(ctx):
        h, w = ctx.h, ctx.w
        yy, xx = _grid(h, w)
        a = (xx + yy) % cell
        b = (xx - yy) % cell
        groove = (a == 0) | (b == 0)
        half = cell / 2.0
        s = (half - a) / half * 0.6 + (half - b) / half * 0.25
        img = np.empty((h, w, 3))
        img[:] = base
        img = np.where(s[..., None] > 0, _mix(img, hi, np.clip(s, 0, 1) * 0.8), img * (1 + np.clip(s, -1, 0) * 0.5)[..., None])
        img[groove] = base * 0.45
        img = _ao(img, ctx, 0.25)
        img = _bevel(img, ctx, 0.1, 0.12)
        return img, np.zeros((h, w))
    return paint


def bone(base=(0.88, 0.85, 0.74), crack=(0.45, 0.40, 0.32)):
    """Old bone: long fibres, pores, yellow-brown grime in the crevices and a
    hairline crack or two."""
    base, crack = _c(base), _c(crack)
    grime = crack * 1.25

    def paint(ctx):
        rng = ctx.rng
        h, w = ctx.h, ctx.w
        n = _fbm(rng, h, w, 6, 4)
        img = _mix(np.broadcast_to(base, (h, w, 3)), base * 0.8, n * 0.8)
        img += _streaks(ctx, 1.0, 0.07)[..., None]
        if h >= 3 and w >= 3:
            t, b, l, r = _edge_dist(h, w)
            occ = np.exp(-np.minimum(np.minimum(t + 1, b), np.minimum(l, r)) / 1.4)
            img = _mix(img, grime, occ * 0.45)
            pits = rng.random((h, w)) > 0.965
            img[pits] = img[pits] * 0.72
            if h >= 6 and w >= 6:
                cm = np.zeros((h, w))
                for _ in range(1 + int(h * w > 160)):
                    y, x = rng.uniform(0, h), rng.uniform(0, w)
                    ang = rng.uniform(0, 2 * math.pi)
                    for _ in range(int(min(h, w) * 0.9)):
                        ang += rng.normal(0, 0.6)
                        y2, x2 = y + math.sin(ang), x + math.cos(ang)
                        _draw_line(cm, y, x, y2, x2)
                        y, x = y2, x2
                img = _mix(img, crack, cm * 0.75)
        img = _bevel(img, ctx, 0.08, 0.18)
        return img, np.zeros((h, w))
    return paint


def obsidian(base=(0.07, 0.04, 0.11), fleck=(0.36, 0.16, 0.55), sheen=(0.55, 0.45, 0.75)):
    """Volcanic glass: conchoidal facets with bright ridges, purple sheen,
    a crisp reflection and a few glittering flecks."""
    base, fleck, sheen = _c(base), _c(fleck), _c(sheen)

    def paint(ctx):
        rng = ctx.rng
        h, w = ctx.h, ctx.w
        img = np.empty((h, w, 3))
        img[:] = base
        yy, xx = _grid(h, w)
        if h >= 3 and w >= 3:
            d1, d2, cid, n = _voronoi(rng, h, w, 4.0)
            tone = rng.random(n)[cid]
            grad = np.clip(d1 / 3.0, 0, 1)  # each chip darkens toward its centre
            img = img * (1.0 + tone[..., None] * 1.3 + (1 - grad)[..., None] * 0.3)
            ridge = np.clip(1 - (d2 - d1) / 0.8, 0, 1)
            img = _mix(img, fleck * 0.9, ridge * 0.4)
        diag = np.clip(xx / max(1, w) * 0.6 + yy / max(1, h) * 0.4, 0, 1)
        img = _mix(img, fleck, (1 - diag) * 0.18)
        img = _mix(img, sheen, _spec_band(ctx, 0.24, 0.1, 1.0) * 0.32)
        f = rng.random((h, w)) > 0.95
        img[f] = _mix(img[f], np.minimum(fleck * 1.8, 1), 0.8)
        img = _ao(img, ctx, 0.2)
        img = _bevel(img, ctx, 0.14, 0.04)
        return img, np.zeros((h, w))
    return paint


def patina(copper=(0.72, 0.43, 0.29), green=(0.29, 0.62, 0.52)):
    """Copper gone green: verdigris pooling in the crevices and blotches,
    rubbed bright copper on the exposed edges."""
    copper, green = _c(copper), _c(green)
    base_paint = metal(copper, (0.98, 0.74, 0.56), streak=0.06, band=0.28, wear=0.7)
    verd_hi = np.minimum(green * 1.35 + 0.08, 1)

    def paint(ctx):
        rng = ctx.rng
        h, w = ctx.h, ctx.w
        img, g = base_paint(ctx)
        n = _fbm(rng, h, w, 5, 3)
        amt = np.clip((n - 0.52) * 3.5, 0, 1)
        if h >= 3 and w >= 3:
            t, b, l, r = _edge_dist(h, w)
            occ = np.exp(-np.minimum(b, np.minimum(l, r)) / 1.1)
            amt = np.clip(amt + occ * 0.6, 0, 1)
            if ctx.is_side:
                amt[0, :] *= 0.15
        verd = _mix(np.broadcast_to(green, (h, w, 3)), verd_hi, (rng.random((h, w)) > 0.8) * 0.6)
        img = _mix(img, verd, amt * 0.9)
        return img, g
    return paint


def trimmed(inner_paint, trim_paint, border=1, scroll=True, gem=None):
    """Plate with an inlaid border of another material and deliberate,
    mirror-symmetric filigree: a scroll vine along big side faces, corner
    fleurons, and an optional little glowing gem in a diamond setting."""
    gem = _c(gem) if gem is not None else None

    def paint(ctx):
        a, ga = inner_paint(ctx)
        b, gb = trim_paint(ctx)
        h, w = ctx.h, ctx.w
        m = np.zeros((h, w))
        gm = np.zeros((h, w))
        if h > 2 * border + 1 and w > 2 * border + 1:
            m[:border, :] = 1
            m[-border:, :] = 1
            m[:, :border] = 1
            m[:, -border:] = 1
            # engraved step just inside the inlay
            a = a.copy()
            a[border, border:w - border] *= 0.72
            a[border:h - border, border] *= 0.85
            big = h >= 2 * border + 6 and w >= 2 * border + 9
            if big:
                for (y, x, dy, dx) in ((border + 1, border + 1, 1, 1), (border + 1, w - border - 2, 1, -1),
                                       (h - border - 2, border + 1, -1, 1), (h - border - 2, w - border - 2, -1, -1)):
                    m[y, x] = 1
                    m[y + dy, x + dx] = 0.8
            if scroll and ctx.is_side and big:
                mid = (h - 1) / 2.0
                cx = (w - 1) / 2.0
                amp = 1.0 if h < 11 else 2.0
                period = 8.0
                gap = 3 if gem is not None else 1
                for x in range(border + 3, w - border - 3):
                    dx = abs(x - cx)
                    if dx < gap:
                        continue
                    y = mid + amp * math.sin(2 * math.pi * (dx - gap) / period)
                    yi = int(round(y))
                    m[yi, x] = max(m[yi, x], 0.9)
                    # curl / leaf at every crest
                    ph = ((dx - gap) / period) % 1.0
                    if abs(ph - 0.25) < 0.07 or abs(ph - 0.75) < 0.07:
                        yl = yi + (-1 if ph < 0.5 else 1)
                        if 0 < yl < h - 1:
                            m[yl, x] = max(m[yl, x], 0.7)
                cyi, cxi = int(round(mid)), int(round(cx))
                for (dy, dx) in ((-1, 0), (1, 0), (0, -1), (0, 1)):
                    m[cyi + dy, cxi + dx] = 1
                if gem is not None:
                    gm[cyi, cxi] = 1
                else:
                    m[cyi, cxi] = 1
            elif ctx.is_up and big:
                cy, cx = h // 2, w // 2
                m[cy, cx] = 1
        img = _mix(a, b, m)
        glow_m = ga * (1 - m) + gb * m
        if gem is not None and gm.any():
            img[gm > 0] = np.minimum(gem * 1.2 + 0.2, 1)
            glow_m = np.maximum(glow_m, gm)
        return img, glow_m
    return paint


def glow(core, edge=None, facets=True, sparkle=True, lines=None, style="veins"):
    """Emissive crystal / energy material.  Whole face glows.  `facets`
    cuts it like a gem (radial facets, a bright table, a diagonal glint),
    `lines` adds bright veins (magma cracks, "veins") or zigzag bolts."""
    core = _c(core)
    edge = _c(edge) if edge is not None else core * 0.55

    def paint(ctx):
        rng = ctx.rng
        h, w = ctx.h, ctx.w
        yy, xx = _grid(h, w)
        cy, cx = (h - 1) / 2.0, (w - 1) / 2.0
        ny = (yy - cy) / max(1.0, h / 2.0)
        nx = (xx - cx) / max(1.0, w / 2.0)
        r = np.sqrt(ny ** 2 + nx ** 2)
        t = np.clip(r / 1.3, 0, 1)
        img = _mix(np.broadcast_to(np.minimum(core * 1.25 + 0.15, 1), (h, w, 3)), edge, t)
        if facets and h >= 4 and w >= 4:
            ang = np.arctan2(ny, nx)
            fid = np.floor((ang + math.pi) / (math.pi / 4.0))
            ftone = np.cos((fid + 0.5) * (math.pi / 4.0) - math.pi + math.radians(135))
            img = img * (1.0 + 0.13 * ftone)[..., None]
            table = (np.abs(ny) < 0.38) & (np.abs(nx) < 0.38)
            img[table] = np.minimum(img[table] * 1.08 + 0.04, 1)
            glint = np.abs((xx + 0.5) / w + (yy + 0.5) / h - 0.62) < 0.07
            img = _mix(img, np.ones(3), glint * (r < 1.1) * 0.45)
            rim = np.zeros((h, w), bool)
            rim[0, :] = rim[-1, :] = rim[:, 0] = rim[:, -1] = True
            img[rim] = img[rim] * 0.82
        img += (_fbm(rng, h, w, 3) - 0.5)[..., None] * 0.1
        if lines is not None:
            lc = _c(lines)
            if style == "bolt":
                lm = np.zeros((h, w))
                for _ in range(max(1, (h * w) // 120)):
                    y, x = rng.uniform(0, h), rng.uniform(0, w * 0.2)
                    while x < w:
                        y2 = np.clip(y + rng.uniform(-2.5, 2.5), 0, h - 1)
                        x2 = x + rng.uniform(1.5, 3.0)
                        _draw_line(lm, y, x, y2, x2)
                        y, x = y2, x2
                img = _mix(img, lc, lm * 0.9)
            elif h >= 3 and w >= 3:
                d1, d2, _, _ = _voronoi(rng, h, w, 3.2)
                vein = np.clip(1 - (d2 - d1) / 0.9, 0, 1)
                img = _mix(img, lc, vein * 0.85)
        if sparkle and h >= 3 and w >= 3:
            for _ in range(max(1, (h * w) // 90)):
                sy, sx = int(rng.integers(0, h)), int(rng.integers(0, w))
                img[sy, sx] = np.minimum(img[sy, sx] + 0.45, 1)
                for (dy, dx) in ((-1, 0), (1, 0), (0, -1), (0, 1)):
                    yy2, xx2 = sy + dy, sx + dx
                    if 0 <= yy2 < h and 0 <= xx2 < w:
                        img[yy2, xx2] = np.minimum(img[yy2, xx2] + 0.18, 1)
        return img, np.ones((h, w))
    return paint


# hand-drawn sigils (mirror symmetric, one-texel strokes): 5x5 for big faces,
# 3x3 for slim ones
_GLYPHS5 = [
    "#.#.# .###. ..#.. ..#.. ..#..",   # elk / ward
    "#...# .#.#. ..#.. .#.#. #...#",   # gift
    "#...# ##.## #.#.# ##.## #...#",   # day
    "..#.. .#.#. #.#.# #...# #####",   # eye of the pyramid
    "..#.. .#.#. #.#.# .#.#. ..#..",   # seed
    "#.#.# #.#.# .###. ..#.. ..#..",   # trident
    "##### .#.#. ..#.. .#.#. #####",   # hourglass
    "..#.. #.#.# .###. #.#.# ..#..",   # star
    "#...# #.#.# .###. ..#.. .###.",   # chalice
    ".###. #.#.# ##### #.#.# .###.",   # sun wheel
    "#...# ##.## #.#.# #...# #...#",   # twin pillars
    ".###. #...# #.#.# #...# #...#",   # arch
]
_GLYPHS3 = ["#.# .#. #.#", ".#. ### .#.", "### .#. .#.", ".#. #.# .#.", "#.# ### #.#", "#.# .#. ###"]


def _glyph(s):
    return np.array([[ch == "#" for ch in row] for row in s.split()], dtype=float)


_G5 = [_glyph(s) for s in _GLYPHS5]
_G3 = [_glyph(s) for s in _GLYPHS3]


def runes(metal_paint, rune_rgb, density=0.5, channel=True):
    """Metal engraved with a band of glowing sigils.  Glyphs come from a
    hand-drawn library, sit evenly spaced and centred in an engraved channel
    along the long axis, with a faint tinted bleed around the strokes."""
    rune_rgb = _c(rune_rgb)
    hot = np.minimum(rune_rgb * 1.15 + 0.18, 1)
    core = np.minimum(rune_rgb * 0.6 + 0.55, 1)

    def paint(ctx):
        img, g = metal_paint(ctx)
        img = img.copy()
        h, w = ctx.h, ctx.w
        rng = ctx.rng
        mask = np.zeros((h, w))
        horiz = ctx.grain_along_u or w >= h
        span, thick = (w, h) if horiz else (h, w)
        lib = None
        if thick >= 7 and span >= 7:
            lib, gs = _G5, 5
        elif thick >= 5 and span >= 5:
            lib, gs = _G3, 3
        if lib is not None:
            step = gs + 2
            count = max(1, (span - 2) // step)
            total = count * step - 2
            start = (span - total) // 2
            c0 = (thick - gs) // 2
            if channel and thick >= gs + 2:
                lo, hi_ = max(0, c0 - 1), min(thick, c0 + gs + 1)
                s0, s1 = max(0, start - 1), min(span, start + total + 1)
                if horiz:
                    img[lo:hi_, s0:s1] *= 0.62
                    if lo > 0:
                        img[lo - 1, s0:s1] *= 0.8
                    if hi_ < h:
                        img[hi_, s0:s1] = np.minimum(img[hi_, s0:s1] * 1.2 + 0.03, 1)
                else:
                    img[s0:s1, lo:hi_] *= 0.62
            for i in range(count):
                p = start + i * step
                if rng.random() < density + 0.35:
                    gl = lib[int(rng.integers(len(lib)))]
                else:
                    gl = np.zeros((gs, gs))
                    gl[gs // 2, gs // 2] = 1
                if horiz:
                    mask[c0:c0 + gs, p:p + gs] = np.maximum(mask[c0:c0 + gs, p:p + gs], gl)
                else:
                    mask[p:p + gs, c0:c0 + gs] = np.maximum(mask[p:p + gs, c0:c0 + gs], gl)
        elif thick >= 2 and span >= 6:
            k = np.arange(span)
            dash = ((k % 4) < 2) & (k > 0) & (k < span - 1)
            mid = thick // 2
            if horiz:
                mask[mid, dash] = 1
            else:
                mask[dash, mid] = 1
        if mask.any():
            bleed = _dilate(mask) * (1 - mask)
            img = _mix(img, rune_rgb * 0.75, bleed * 0.35)
            dense = (np.roll(mask, 1, 0) + np.roll(mask, -1, 0) + np.roll(mask, 1, 1) + np.roll(mask, -1, 1)) * mask
            img = _mix(img, hot, mask)
            img = _mix(img, core, (dense >= 3) * 0.55)
        return img, np.maximum(g, mask)
    return paint


def coil(metal_paint, glow_rgb, period=4, axis=2):
    """Windings around model axis `axis` (z = the barrel): each turn is
    rounded and lit on one side, a thin glowing gap between the turns, and
    the end faces show a glowing ring around the dark bore."""
    glow_rgb = _c(glow_rgb)
    hot = np.minimum(glow_rgb * 1.2 + 0.25, 1)

    def paint(ctx):
        img, g = metal_paint(ctx)
        img = img.copy()
        g = g.copy()
        h, w = ctx.h, ctx.w
        yy, xx = _grid(h, w)
        t = ctx.axis_coord(axis)
        if t is None:
            if h >= 5 and w >= 5:
                ry = np.abs(yy - (h - 1) / 2.0) / (h / 2.0)
                rx = np.abs(xx - (w - 1) / 2.0) / (w / 2.0)
                r = np.maximum(ry, rx)
                ring = (r > 0.5) & (r < 0.72)
                img[r <= 0.5] = img[r <= 0.5] * 0.35
                img[ring] = _mix(img[ring], hot, 0.9)
                g[ring] = 1
            return img, g
        ph = t % period
        gap = ph >= period - 1
        k = ph / max(1, period - 1)
        img = img * (1.18 - 0.42 * k)[..., None]
        img[gap] = glow_rgb
        if h >= 3 and w >= 3:
            across = yy - (h - 1) / 2.0 if ctx.axis_dir(axis) == "u" else xx - (w - 1) / 2.0
            n_across = h if ctx.axis_dir(axis) == "u" else w
            img[gap & (np.abs(across) <= n_across * 0.3)] = hot
        g = np.maximum(g, gap.astype(float))
        return img, g
    return paint


def skull_face(bone_paint, eye_rgb, facing="south"):
    """Bone skull looking toward `facing` ("south" = at the wielder, "north" =
    down the barrel): that face gets the full face, the flanks a matching
    profile (eye socket + teeth at the facing edge, temple hollow behind), the
    top and the back of the cranium suture lines.  Eye sockets glow."""
    eye_rgb = _c(eye_rgb)
    hot = np.minimum(eye_rgb * 1.1 + 0.35, 1)

    def socket(img, g, y0, x0, eh, ew):
        y1, x1 = y0 + eh, x0 + ew
        img[y0:y1, x0:x1] = eye_rgb
        g[y0:y1, x0:x1] = 1
        # rounded corners -> dark
        for (yy, xx) in ((y0, x0), (y0, x1 - 1), (y1 - 1, x0), (y1 - 1, x1 - 1)):
            if eh >= 3 and ew >= 3:
                img[yy, xx] = img[yy, xx] * 0.25
                g[yy, xx] = 0
        cy, cx = y0 + eh // 2, x0 + ew // 2
        img[cy, cx] = hot
        # dark brow ridge above the socket
        if y0 - 1 >= 0:
            img[y0 - 1, x0:x1] *= 0.6

    def paint(ctx):
        img, g = bone_paint(ctx)
        img = img.copy()
        g = g.copy()
        h, w = ctx.h, ctx.w
        f = ctx.face
        if f == facing and h >= 6 and w >= 6:
            ew = max(2, int(round(w * 0.3)))
            eh = max(2, int(round(h * 0.3)))
            ey = max(1, int(round(h * 0.28)))
            gapx = max(1, w - 2 * ew - 2 * max(1, int(round(w * 0.1))))
            ex0 = (w - (2 * ew + gapx)) // 2
            socket(img, g, ey, ex0, eh, ew)
            socket(img, g, ey, ex0 + ew + gapx, eh, ew)
            # nose: small inverted triangle
            ny = ey + eh
            nx = w // 2
            if ny + 1 < h:
                img[ny, nx - 1:nx + 1] *= 0.3
                img[ny + 1, nx - 1:nx + 1] *= 0.5
            # cheek shadows -> narrower jaw
            img[ny:, 0] *= 0.55
            img[ny:, -1] *= 0.55
            # teeth
            ty = h - 2
            if ty > ny + 1:
                img[ty - 1, 1:-1] *= 0.45
                img[ty, 1:-1:2] *= 0.5
                img[ty, 2:-1:2] = np.minimum(img[ty, 2:-1:2] * 1.12, 1)
        elif f in ("east", "west") and h >= 6 and w >= 6:
            eh = max(2, int(round(h * 0.3)))
            ew = max(2, int(round(w * 0.28)))
            ey = max(1, int(round(h * 0.28)))
            # east u runs rear -> front, west front -> rear
            face_right = (f == "east") == (facing == "north")
            x0 = w - 1 - ew if face_right else 1
            socket(img, g, ey, x0, eh, ew)
            # cheekbone ridge + temple hollow
            cyb = ey + eh
            if cyb < h - 2:
                xs = range(1, w - 1)
                for x in xs:
                    img[cyb, x] = img[cyb, x] * 0.7
                back = range(0, max(1, w // 3)) if face_right else range(w - max(1, w // 3), w)
                for x in back:
                    img[cyb + 1:, x] *= 0.62
            # teeth at the front of the jaw
            ty = h - 2
            tx = range(w - 1 - max(2, w // 2), w - 1) if face_right else range(1, 1 + max(2, w // 2))
            for x in tx:
                img[ty, x] = img[ty, x] * (0.5 if x % 2 else 1.08)
                img[ty - 1, x] *= 0.6
        elif f in ("up", "north", "south") and h >= 6 and w >= 6:
            cxm = w // 2
            sut = np.zeros((h, w))
            _draw_line(sut, 1, cxm, h - 2, cxm + 0.5)
            _draw_line(sut, h * 0.35, 1, h * 0.4, w - 2)
            img = _mix(img, img * 0.6, sut * 0.8)
        return img, g
    return paint


def flat(rgb, glow_on=False):
    rgb = _c(rgb)

    def paint(ctx):
        img = np.empty((ctx.h, ctx.w, 3))
        img[:] = rgb
        return img, np.ones((ctx.h, ctx.w)) if glow_on else np.zeros((ctx.h, ctx.w))
    return paint


# --------------------------------------------------- detail decals (wrappers)
#
# These wrap another painter and cut machined details into chosen faces.
# `rect` = (u0, v0, u1, v1) as fractions of the face, given for the EAST face
# (u = rear -> muzzle); on the west face it is mirrored so features line up
# on both flanks.  On up/down faces u runs across X, v from muzzle to rear.

def _face_rect(ctx, rect):
    u0, v0, u1, v1 = rect
    if ctx.face == "west":
        u0, u1 = 1 - u1, 1 - u0
    x0 = int(round(u0 * ctx.w))
    x1 = max(x0 + 1, int(round(u1 * ctx.w)))
    y0 = int(round(v0 * ctx.h))
    y1 = max(y0 + 1, int(round(v1 * ctx.h)))
    return max(0, y0), min(ctx.h, y1), max(0, x0), min(ctx.w, x1)


def _recess(img, g, y0, y1, x0, x1, inner, glow_rgb=None):
    """Cut a recessed window: dark (or glowing) inside, shadowed upper lip,
    bright lower lip."""
    if glow_rgb is not None:
        hot = np.minimum(glow_rgb * 1.2 + 0.25, 1)
        img[y0:y1, x0:x1] = glow_rgb
        if y1 - y0 >= 3 and x1 - x0 >= 3:
            img[y0 + 1:y1 - 1, x0 + 1:x1 - 1] = hot
        elif y1 - y0 >= 3:
            img[y0 + 1:y1 - 1, x0:x1] = hot
        g[y0:y1, x0:x1] = 1
        img[y0:y1, x0:x1][0] = glow_rgb * 0.7
    else:
        img[y0:y1, x0:x1] = img[y0:y1, x0:x1] * 0.25 + inner * 0.75
        img[y0, x0:x1] = img[y0, x0:x1] * 0.5
    if y1 < img.shape[0]:
        img[y1, x0:x1] = np.minimum(img[y1, x0:x1] * 1.25 + 0.06, 1)
    if y0 - 1 >= 0:
        img[y0 - 1, x0:x1] *= 0.75


def slots(paint_fn, n=4, rect=(0.15, 0.3, 0.85, 0.7), faces=("east", "west"), along="u", glow_rgb=None,
          inner=(0.03, 0.03, 0.04)):
    """A row of `n` cut slots (vents, cooling ports, slide serrations).  With
    `glow_rgb` the slots show the magic burning inside."""
    glow_rgb = _c(glow_rgb) if glow_rgb is not None else None
    inner = _c(inner)

    def paint(ctx):
        img, g = paint_fn(ctx)
        img, g = img.copy(), g.copy()
        if ctx.face not in faces or ctx.h < 3 or ctx.w < 3:
            return img, g
        y0, y1, x0, x1 = _face_rect(ctx, rect)
        span = (x1 - x0) if along == "u" else (y1 - y0)
        k = min(n, max(1, (span + 1) // 2))
        sw = max(1, int((span + 1) / (2 * k - 1) * 0.999)) if k > 1 else span
        pitch = (span - sw) / max(1, k - 1) if k > 1 else 0
        for i in range(k):
            p = int(round(i * pitch))
            if along == "u":
                _recess(img, g, y0, y1, x0 + p, min(x1, x0 + p + sw), inner, glow_rgb)
            else:
                _recess(img, g, y0 + p, min(y1, y0 + p + sw), x0, x1, inner, glow_rgb)
        return img, g
    return paint


def inset(paint_fn, rect, faces=("east", "west"), inner=(0.03, 0.03, 0.04), glow_rgb=None):
    """One recessed window (ejection port, magazine window, sight notch...)."""
    glow_rgb = _c(glow_rgb) if glow_rgb is not None else None
    inner = _c(inner)

    def paint(ctx):
        img, g = paint_fn(ctx)
        img, g = img.copy(), g.copy()
        if ctx.face not in faces or ctx.h < 2 or ctx.w < 2:
            return img, g
        y0, y1, x0, x1 = _face_rect(ctx, rect)
        _recess(img, g, y0, y1, x0, x1, inner, glow_rgb)
        return img, g
    return paint


def holes(paint_fn, spots, size=2, faces=("north",), inner=(0.03, 0.03, 0.04), glow_rgb=None):
    """Round-ish bores / chambers (size x size texels) centred on (u, v)
    fractions.  With `glow_rgb` they burn with the gun's magic."""
    glow_rgb = _c(glow_rgb) if glow_rgb is not None else None
    inner = _c(inner)

    def paint(ctx):
        img, g = paint_fn(ctx)
        img, g = img.copy(), g.copy()
        h, w = ctx.h, ctx.w
        if ctx.face not in faces or h < size or w < size:
            return img, g
        for (u, v) in spots:
            if ctx.face == "west":
                u = 1 - u
            x0 = int(np.clip(round(u * w - size / 2.0), 0, w - size))
            y0 = int(np.clip(round(v * h - size / 2.0), 0, h - size))
            _recess(img, g, y0, y0 + size, x0, x0 + size, inner, glow_rgb)
            if size >= 3:  # knock the corners off -> rounder bore
                for (yy, xx) in ((y0, x0), (y0, x0 + size - 1), (y0 + size - 1, x0), (y0 + size - 1, x0 + size - 1)):
                    img[yy, xx] = img[yy, xx] * 0.6 + (glow_rgb * 0.4 if glow_rgb is not None else inner * 0.4)
        return img, g
    return paint


def feathers(base, dark, tip=None):
    """Feather plates: lit vane with a pale shaft down the middle, fine
    diagonal barbs, darker edges and an optional gilded tip."""
    base, dark = _c(base), _c(dark)
    tip = _c(tip) if tip is not None else None
    shaft_c = np.minimum(base * 1.1 + 0.08, 1)

    def paint(ctx):
        h, w = ctx.h, ctx.w
        yy, xx = _grid(h, w)
        along, across = (xx, yy) if ctx.grain_along_u else (yy, xx)
        span = float(h if ctx.grain_along_u else w)
        c = (span - 1) / 2.0
        d = np.abs(across - c) / max(1.0, span / 2.0)
        # vane: lit, slightly cupped, with a soft shadow along the lower edge
        low = np.clip((across - c) / max(1.0, span / 2.0), 0, 1)
        img = _mix(np.broadcast_to(base, (h, w, 3)), dark, np.clip(d, 0, 1) ** 3 * 0.35 + low ** 2 * 0.3)
        barbs = ((along + np.abs(across - c)) % 3) < 1
        img = img * (1 - barbs * 0.06)[..., None]
        if span >= 3:
            shaft = np.abs(across - c) < 0.6
            img[shaft] = shaft_c * 0.92
        if tip is not None and ctx.is_side and not ctx.grain_along_u and h >= 6:
            k = max(2, int(h * 0.24))
            img[:k] = _mix(img[:k], tip, 0.85)
        img = _ao(img, ctx, 0.18)
        img = _bevel(img, ctx, 0.08, 0.12)
        return img, np.zeros((h, w))
    return paint


def rail(paint_fn, period=4, axis=2):
    """Picatinny-style rail: raised cross ridges on the top face and matching
    notches along the top edge of the flanks."""
    def paint(ctx):
        img, g = paint_fn(ctx)
        img = img.copy()
        t = ctx.axis_coord(axis)
        if t is None:
            return img, g
        slot = (t % period) >= period / 2.0
        lead = (t % period) == 0
        if ctx.is_up:
            img[slot] = img[slot] * 0.42
            img[lead] = np.minimum(img[lead] * 1.25 + 0.08, 1)
        elif ctx.is_side and ctx.h >= 3:
            rows = slice(0, min(2, ctx.h - 1))
            sub = img[rows]
            s = slot[rows]
            sub[s] = sub[s] * 0.42
            img[rows] = sub
        return img, g
    return paint


def screws(paint_fn, faces=("east", "west"), spots=((0.12, 0.5), (0.88, 0.5))):
    """Slotted screw heads at the given (u, v) fractions (east orientation)."""
    def paint(ctx):
        img, g = paint_fn(ctx)
        img = img.copy()
        h, w = ctx.h, ctx.w
        if ctx.face not in faces or h < 4 or w < 4:
            return img, g
        for (u, v) in spots:
            if ctx.face == "west":
                u = 1 - u
            x = int(np.clip(round(u * w - 0.5), 1, w - 3))
            y = int(np.clip(round(v * h - 0.5), 1, h - 3))
            c = img[y:y + 2, x:x + 2].mean(axis=(0, 1))
            img[y - 1:y + 3, x - 1:x + 3] = img[y - 1:y + 3, x - 1:x + 3] * 0.6  # countersink ring
            img[y, x] = np.minimum(c * 1.6 + 0.12, 1)
            img[y, x + 1] = np.minimum(c * 1.25 + 0.06, 1)
            img[y + 1, x] = c * 0.95
            img[y + 1, x + 1] = c * 0.55
        return img, g
    return paint


# --------------------------------------------------------------------- model

class Cube:
    def __init__(self, frm, to, mat, rotation=None, pivot=None, inflate=0.0, faces=None, name=None):
        self.frm = np.array(frm, dtype=float)
        self.to = np.array(to, dtype=float)
        assert np.all(self.to > self.frm), (name, frm, to)
        self.mat = mat
        self.rotation = rotation
        self.pivot = None if pivot is None else np.array(pivot, dtype=float)
        if rotation is not None and pivot is None:
            self.pivot = (self.frm + self.to) / 2.0
        self.inflate = inflate
        self.faces = faces or FACES
        self.name = name
        self.uv = {}  # face -> (u, v, w, h) in atlas pixels


class Bone:
    def __init__(self, name, parent=None, pivot=(0, 0, 0), rotation=None):
        self.name = name
        self.parent = parent
        self.pivot = np.array(pivot, dtype=float)
        self.rotation = rotation
        self.cubes = []


class Model:
    def __init__(self, name, materials, density=4, atlas_width=128):
        self.name = name
        self.materials = materials
        self.density = density
        self.atlas_width = atlas_width
        self.bones = []
        self._bone_by_name = {}
        self.atlas = None

    # -- authoring helpers (Blockbench space)
    def bone(self, name, parent=None, pivot=(0, 0, 0), rotation=None):
        b = Bone(name, parent, pivot, rotation)
        self.bones.append(b)
        self._bone_by_name[name] = b
        return b

    def box(self, bone, frm, to, mat, **kw):
        if isinstance(bone, str):
            bone = self._bone_by_name[bone]
        c = Cube(frm, to, mat, **kw)
        bone.cubes.append(c)
        return c

    def mirror_x(self, bone, frm, to, mat, **kw):
        """Add a box and its mirror image across x=0."""
        self.box(bone, frm, to, mat, **kw)
        f2 = (-to[0], frm[1], frm[2])
        t2 = (-frm[0], to[1], to[2])
        kw2 = dict(kw)
        if kw2.get("rotation") is not None:
            r = kw2["rotation"]
            kw2["rotation"] = (r[0], -r[1], -r[2])
        if kw2.get("pivot") is not None:
            p = kw2["pivot"]
            kw2["pivot"] = (-p[0], p[1], p[2])
        self.box(bone, f2, t2, mat, **kw2)

    # -- texture atlas
    def _face_px(self, cube, face):
        s = cube.to - cube.frm
        if face in ("north", "south"):
            fw, fh = s[0], s[1]
        elif face in ("east", "west"):
            fw, fh = s[2], s[1]
        else:
            fw, fh = s[0], s[2]
        d = self.density
        return max(1, int(round(fw * d))), max(1, int(round(fh * d)))

    @staticmethod
    def _grain_along_u(cube, face):
        s = cube.to - cube.frm
        longest = int(np.argmax(s))
        if face in ("north", "south"):
            return longest == 0 or (longest == 2 and s[0] >= s[1])
        if face in ("east", "west"):
            return longest == 2 or (longest == 0 and s[2] >= s[1])
        return longest == 0 or (longest == 1 and s[0] >= s[2])

    def build_atlas(self, pad=1, seed=1):
        items = []
        for b in self.bones:
            for ci, c in enumerate(b.cubes):
                for f in c.faces:
                    w, h = self._face_px(c, f)
                    items.append((h, w, b, c, f))
        items.sort(key=lambda t: (-t[0], -t[1]))
        W = self.atlas_width
        x = y = 0
        row_h = 0
        placements = []
        for h, w, b, c, f in items:
            pw, ph = w + 2 * pad, h + 2 * pad
            if pw > W:
                raise ValueError("face wider than atlas: %s" % self.name)
            if x + pw > W:
                x = 0
                y += row_h
                row_h = 0
            placements.append((x + pad, y + pad, w, h, b, c, f))
            x += pw
            row_h = max(row_h, ph)
        total_h = y + row_h
        H = 16
        while H < total_h:
            H *= 2
        rgb = np.zeros((H, W, 3))
        glow = np.zeros((H, W))
        used = np.zeros((H, W), dtype=bool)
        for i, (u, v, w, h, b, c, f) in enumerate(placements):
            ctx = FaceCtx(f, w, h, self._grain_along_u(c, f), c.to - c.frm, seed * 7919 + i * 31)
            img, g = self.materials[c.mat](ctx)
            img = np.clip(img, 0, 1)
            # extrude a 1px border so mipmaps / filtering never bleed
            ext = np.pad(img, ((pad, pad), (pad, pad), (0, 0)), mode="edge")
            gext = np.pad(g, ((pad, pad),), mode="edge")
            rgb[v - pad:v + h + pad, u - pad:u + w + pad] = ext
            glow[v - pad:v + h + pad, u - pad:u + w + pad] = gext
            used[v - pad:v + h + pad, u - pad:u + w + pad] = True
            c.uv[f] = (u, v, w, h)
        self.atlas = (rgb, glow, used)
        return self.atlas

    def atlas_image(self, glow_alpha):
        """RGBA atlas.  `glow_alpha(glow_mask)->alpha` encodes the emissive mask."""
        rgb, glow, used = self.atlas
        a = np.where(used, glow_alpha(glow), 0.0)
        img = np.dstack([rgb, a])
        return Image.fromarray((np.clip(img, 0, 1) * 255 + 0.5).astype(np.uint8), "RGBA")

    # -- Bedrock export (mirrors Blockbench's compileCube / compileGroup)
    def cube_glows(self, cube):
        _, glow, _ = self.atlas
        for f, (u, v, w, h) in cube.uv.items():
            if (glow[v:v + h, u:u + w] > 0.5).any():
                return True
        return False

    def to_bedrock(self, identifier, binding=None, visible=(3, 3, (0, 1, 0)), root_bone=None,
                   offset=(0, 0, 0), split_glow=False):
        """Bedrock geometry.  `offset` moves the whole model (Blockbench space,
        root pivot excluded).  With `split_glow`, cubes that contain glowing
        texels move to a child bone "glow_<bone>" so a render controller can
        give them an emissive material."""
        rgb, _, _ = self.atlas
        H, W = rgb.shape[:2]
        off = np.array(offset, dtype=float)
        bones = []

        def emit_bone(name, parent, pivot, rotation, cube_list, is_root):
            jb = {"name": name}
            if parent:
                jb["parent"] = parent
            p = np.array(pivot, dtype=float) + (0 if is_root else off)
            p[0] *= -1
            jb["pivot"] = _r(p)
            if rotation is not None and any(rotation):
                r = list(rotation)
                jb["rotation"] = _r([-r[0], -r[1], r[2]])
            if binding and is_root:
                jb["binding"] = binding
            cubes = [self._cube_json(c, off) for c in cube_list]
            if cubes:
                jb["cubes"] = cubes
            bones.append(jb)

        for b in self.bones:
            is_root = b.name == root_bone
            if split_glow:
                plain = [c for c in b.cubes if not self.cube_glows(c)]
                lit = [c for c in b.cubes if self.cube_glows(c)]
            else:
                plain, lit = b.cubes, []
            emit_bone(b.name, b.parent, b.pivot, b.rotation, plain, is_root)
            if lit:
                emit_bone("glow_" + b.name, b.name, b.pivot, None, lit, False)
        desc = {"identifier": identifier, "texture_width": W, "texture_height": H}
        if visible is not None:
            vw, vh, voff = visible
            desc.update({"visible_bounds_width": vw, "visible_bounds_height": vh,
                         "visible_bounds_offset": list(voff)})
        return {"format_version": "1.16.0", "minecraft:geometry": [{"description": desc, "bones": bones}]}

    def _cube_json(self, c, off):
        size = c.to - c.frm
        origin = c.frm.copy() + off
        origin[0] = -(origin[0] + size[0])
        jc = {"origin": _r(origin), "size": _r(size)}
        if c.inflate:
            jc["inflate"] = c.inflate
        if c.rotation is not None and any(c.rotation):
            pv = c.pivot.copy() + off
            pv[0] *= -1
            jc["pivot"] = _r(pv)
            r = list(c.rotation)
            jc["rotation"] = _r([-r[0], -r[1], r[2]])
        uv = {}
        for f in c.faces:
            u, v, w, h = c.uv[f]
            if f in ("up", "down"):
                uv[f] = {"uv": [u + w, v + h], "uv_size": [-w, -h]}
            else:
                uv[f] = {"uv": [u, v], "uv_size": [w, h]}
        jc["uv"] = uv
        return jc


def cube_center(cube):
    c = (cube.frm + cube.to) / 2.0
    if cube.rotation is not None and any(cube.rotation):
        M = _rot_matrix(cube.rotation)
        c = (c - cube.pivot) @ M.T + cube.pivot
    return c


def _r(v):
    out = []
    for x in v:
        x = round(float(x), 4)
        out.append(int(x) if x == int(x) else x)
    return out


# ------------------------------------------------------------------ renderer
#
# Small z-buffered software rasterizer working directly from Bedrock JSON
# (re-imported with Blockbench's parse rules), so previews validate what we
# actually ship.

def _rot_matrix(deg):
    rx, ry, rz = [math.radians(a) for a in deg]
    cx, sx = math.cos(rx), math.sin(rx)
    cy, sy = math.cos(ry), math.sin(ry)
    cz, sz = math.cos(rz), math.sin(rz)
    Rx = np.array([[1, 0, 0], [0, cx, -sx], [0, sx, cx]])
    Ry = np.array([[cy, 0, sy], [0, 1, 0], [-sy, 0, cy]])
    Rz = np.array([[cz, -sz, 0], [sz, cz, 0], [0, 0, 1]])
    return Rz @ Ry @ Rx  # three.js Euler order 'ZYX'


def bedrock_to_quads(geo, extra_bone_rot=None, hide=()):
    """Return list of (corners[4,3], uv_rect(u,v,w,h), normal) in Blockbench space.
    Bones whose name (or any ancestor's name) is in `hide` are skipped."""
    g = geo["minecraft:geometry"][0]
    bones = {b["name"]: b for b in g["bones"]}
    extra_bone_rot = extra_bone_rot or {}

    def hidden(name):
        while name:
            if name in hide:
                return True
            name = bones[name].get("parent")
        return False

    def bone_chain(name):
        chain = []
        while name:
            chain.append(bones[name])
            name = bones[name].get("parent")
        return chain

    quads = []
    for b in g["bones"]:
        if hidden(b["name"]):
            continue
        for c in b.get("cubes", []):
            o = np.array(c["origin"], float)
            s = np.array(c["size"], float)
            inf = c.get("inflate", 0)
            frm = np.array([-(o[0] + s[0]), o[1], o[2]]) - inf
            to = np.array([-o[0], o[1] + s[1], o[2] + s[2]]) + inf
            X0, Y0, Z0 = frm
            X1, Y1, Z1 = to
            # Blockbench vertex order
            V = np.array([
                [X1, Y1, Z1], [X1, Y1, Z0], [X1, Y0, Z1], [X1, Y0, Z0],
                [X0, Y1, Z0], [X0, Y1, Z1], [X0, Y0, Z0], [X0, Y0, Z1],
            ])
            idx = {"north": [1, 4, 6, 3], "east": [0, 1, 3, 2], "south": [5, 0, 2, 7],
                   "west": [4, 5, 7, 6], "up": [4, 1, 0, 5], "down": [7, 2, 3, 6]}
            if "rotation" in c:
                r = c["rotation"]
                pv = np.array(c["pivot"], float)
                pv[0] *= -1
                M = _rot_matrix([-r[0], -r[1], r[2]])
                V = (V - pv) @ M.T + pv
            for bb in bone_chain(b["name"]):
                rot = bb.get("rotation")
                er = extra_bone_rot.get(bb["name"])
                if er is not None:
                    rot = [x + y for x, y in zip(rot or [0, 0, 0], er)]
                if rot:
                    pv = np.array(bb.get("pivot", [0, 0, 0]), float)
                    pv[0] *= -1
                    M = _rot_matrix([-rot[0], -rot[1], rot[2]])
                    V = (V - pv) @ M.T + pv
            for f, fd in c["uv"].items():
                u, v = fd["uv"]
                w, h = fd["uv_size"]
                if f in ("up", "down"):  # undo the export flip
                    u, v, w, h = u + w, v + h, -w, -h
                q = V[idx[f]]
                n = np.cross(q[3] - q[0], q[1] - q[0])  # outward
                nn = np.linalg.norm(n)
                if nn == 0:
                    continue
                quads.append((q, (u, v, w, h), n / nn))
    return quads


def render(geo, tex_rgba, size=512, yaw=30, pitch=20, roll=0, light=(0.6, 0.9, -0.25),
           margin=0.08, glow_mask=None, bg=(0, 0, 0, 0), extra_bone_rot=None, outline=False, hide=()):
    """Orthographic render.  Camera looks from +X towards -X (barrel points right)."""
    quads = bedrock_to_quads(geo, extra_bone_rot, hide)
    tex = np.asarray(tex_rgba).astype(float) / 255.0
    TH, TW = tex.shape[:2]
    gm = np.zeros((TH, TW)) if glow_mask is None else np.asarray(glow_mask, float)
    # view rotation: start looking from +X (screen right = -Z, up = +Y)
    R = _rot_matrix([0, 0, roll]) @ _rot_matrix([pitch, 0, 0]) @ _rot_matrix([0, yaw, 0])
    base = np.array([[0, 0, -1], [0, 1, 0], [-1, 0, 0]], float)  # rows: screen x, y, depth(toward cam = +)
    view = base @ R
    allp = np.concatenate([q for q, _, _ in quads]) @ view.T
    mn, mx = allp[:, :2].min(0), allp[:, :2].max(0)
    span = (mx - mn).max() * (1 + 2 * margin)
    center = (mn + mx) / 2
    scale = size / span
    L = np.array(light, float)
    L /= np.linalg.norm(L)
    img = np.zeros((size, size, 4))
    img[:] = np.array(bg, float) / 255.0 if max(bg) > 1 else bg
    zbuf = np.full((size, size), -1e9)
    for q, (u, v, w, h), n in quads:
        P = q @ view.T
        nz = (n @ view.T)[2]
        if nz >= 0:  # back-face (normal pointing away from camera)
            continue
        sx = (P[:, 0] - center[0]) * scale + size / 2
        sy = size / 2 - (P[:, 1] - center[1]) * scale
        depth = -P[:, 2]
        uvc = np.array([[u, v], [u + w, v], [u + w, v + h], [u, v + h]], float)
        shade = 0.5 + 0.5 * max(0.0, float(n @ L))
        for tri in ((0, 1, 2), (0, 2, 3)):
            _raster_tri(img, zbuf, sx[list(tri)], sy[list(tri)], depth[list(tri)], uvc[list(tri)],
                        tex, gm, TW, TH, shade)
    if outline:
        a = img[..., 3] > 0.5
        edge = np.zeros_like(a)
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            edge |= np.roll(a, (dy, dx), (0, 1)) & ~a
        img[edge] = [0.05, 0.04, 0.06, 0.85]
    return Image.fromarray((np.clip(img, 0, 1) * 255 + 0.5).astype(np.uint8), "RGBA")


def _raster_tri(img, zbuf, xs, ys, zs, uvs, tex, gm, TW, TH, shade):
    size = img.shape[0]
    x0, x1 = int(max(0, math.floor(xs.min()))), int(min(size - 1, math.ceil(xs.max())))
    y0, y1 = int(max(0, math.floor(ys.min()))), int(min(size - 1, math.ceil(ys.max())))
    if x1 < x0 or y1 < y0:
        return
    yy, xx = np.mgrid[y0:y1 + 1, x0:x1 + 1]
    px, py = xx + 0.5, yy + 0.5
    (ax, bx, cx), (ay, by, cy) = xs, ys
    den = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy)
    if abs(den) < 1e-9:
        return
    l1 = ((by - cy) * (px - cx) + (cx - bx) * (py - cy)) / den
    l2 = ((cy - ay) * (px - cx) + (ax - cx) * (py - cy)) / den
    l3 = 1 - l1 - l2
    inside = (l1 >= -1e-6) & (l2 >= -1e-6) & (l3 >= -1e-6)
    if not inside.any():
        return
    z = l1 * zs[0] + l2 * zs[1] + l3 * zs[2]
    u = l1 * uvs[0, 0] + l2 * uvs[1, 0] + l3 * uvs[2, 0]
    v = l1 * uvs[0, 1] + l2 * uvs[1, 1] + l3 * uvs[2, 1]
    ui = np.clip(np.floor(u).astype(int), 0, TW - 1)
    vi = np.clip(np.floor(v).astype(int), 0, TH - 1)
    texel = tex[vi, ui]
    zb = zbuf[y0:y1 + 1, x0:x1 + 1]
    # alpha in our atlas encodes glow, so treat any used texel as opaque
    ok = inside & (z > zb)
    if not ok.any():
        return
    zb[ok] = z[ok]
    col = texel[..., :3].copy()
    g = gm[vi, ui]
    sh = shade + (1.0 - shade) * g
    region = img[y0:y1 + 1, x0:x1 + 1]
    region[ok, :3] = np.clip(col[ok] * sh[ok][:, None], 0, 1)
    region[ok, 3] = 1.0


def save_json(path, data):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)
        f.write("\n")


def render_first_person(geo, tex_rgba, glow_mask, eye, fov=70.0, size=(640, 360), bg=(110, 160, 220, 255),
                        light=(0.4, 0.9, 0.3), near=0.3):
    """Perspective preview from `eye` (Blockbench space) looking down -Z, like
    the first-person camera looking along the barrel."""
    quads = bedrock_to_quads(geo)
    tex = np.asarray(tex_rgba).astype(float) / 255.0
    TH, TW = tex.shape[:2]
    gm = np.asarray(glow_mask, float)
    W, H = size
    img = np.zeros((H, W, 4))
    img[:] = np.array(bg, float) / 255.0
    zbuf = np.full((H, W), -1e9)
    f = (H / 2) / math.tan(math.radians(fov) / 2)
    E = np.array(eye, float)
    L = np.array(light, float)
    L /= np.linalg.norm(L)
    for q, (u, v, w, h), n in quads:
        P = q - E
        depth = -P[:, 2]
        if (depth < near).any():
            continue
        center = P.mean(0)
        if n @ (-center) <= 0:
            continue
        sx = W / 2 + f * P[:, 0] / depth
        sy = H / 2 - f * P[:, 1] / depth
        uvc = np.array([[u, v], [u + w, v], [u + w, v + h], [u, v + h]], float)
        shade = 0.5 + 0.5 * max(0.0, float(n @ L))
        for tri in ((0, 1, 2), (0, 2, 3)):
            t = list(tri)
            _raster_tri_rect(img, zbuf, sx[t], sy[t], -depth[t], uvc[t], tex, gm, TW, TH, shade)
    return Image.fromarray((np.clip(img, 0, 1) * 255 + 0.5).astype(np.uint8), "RGBA")


def _raster_tri_rect(img, zbuf, xs, ys, zs, uvs, tex, gm, TW, TH, shade):
    H, W = img.shape[:2]
    x0, x1 = int(max(0, math.floor(xs.min()))), int(min(W - 1, math.ceil(xs.max())))
    y0, y1 = int(max(0, math.floor(ys.min()))), int(min(H - 1, math.ceil(ys.max())))
    if x1 < x0 or y1 < y0:
        return
    yy, xx = np.mgrid[y0:y1 + 1, x0:x1 + 1]
    px, py = xx + 0.5, yy + 0.5
    (ax, bx, cx), (ay, by, cy) = xs, ys
    den = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy)
    if abs(den) < 1e-9:
        return
    l1 = ((by - cy) * (px - cx) + (cx - bx) * (py - cy)) / den
    l2 = ((cy - ay) * (px - cx) + (ax - cx) * (py - cy)) / den
    l3 = 1 - l1 - l2
    inside = (l1 >= -1e-6) & (l2 >= -1e-6) & (l3 >= -1e-6)
    if not inside.any():
        return
    z = l1 * zs[0] + l2 * zs[1] + l3 * zs[2]
    u = l1 * uvs[0, 0] + l2 * uvs[1, 0] + l3 * uvs[2, 0]
    v = l1 * uvs[0, 1] + l2 * uvs[1, 1] + l3 * uvs[2, 1]
    ui = np.clip(np.floor(u).astype(int), 0, TW - 1)
    vi = np.clip(np.floor(v).astype(int), 0, TH - 1)
    zb = zbuf[y0:y1 + 1, x0:x1 + 1]
    ok = inside & (z > zb)
    if not ok.any():
        return
    zb[ok] = z[ok]
    col = tex[vi, ui][..., :3]
    g = gm[vi, ui]
    sh = shade + (1.0 - shade) * g
    region = img[y0:y1 + 1, x0:x1 + 1]
    region[ok, :3] = np.clip(col[ok] * sh[ok][:, None], 0, 1)
    region[ok, 3] = 1.0
