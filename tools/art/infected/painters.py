"""Procedural pixel-art painters for the infected overlays (original art).

All painters work on texel sets (infected_lib.Texels) so features are placed in
3D model space: veins and patches continue across cube edges, and eyes / mouths
land exactly on the vanilla feature positions (given as model-space boxes).
"""
from __future__ import annotations

import math
from dataclasses import dataclass, field
from typing import Sequence

import numpy as np

from infected_lib import (GLOW_ALPHA, PAL, Canvas, Noise3, Part, Texels, box_normal_at, pick, point_to_texel,
                          surface_walk, texels_of)

CLEAR = (0, 0, 0, 0)


# ---------------------------------------------------------------------------
# configuration of the skin pass
# ---------------------------------------------------------------------------

@dataclass
class Site:
    """An infection focus (where a parasite burst out)."""
    c: tuple
    r: float
    flesh: bool = True          # exposed flesh patch
    veins: int = 5              # veins radiating from it
    vein_len: float = 9.0


@dataclass
class Eye:
    """A vanilla eye position on a head's front face: x0..x1, y0..y1 (model units) at z (front plane).
    ``inner`` = which end is toward the face centre (+1: the x1 end, -1: the x0 end)."""
    x0: float
    x1: float
    y0: float
    y1: float
    z: float
    inner: int = 0


@dataclass
class Mouth:
    """Blood around a mouth: an axis-aligned model-space box; texels inside get blood,
    and some drips run down the faces below it."""
    lo: tuple
    hi: tuple
    drips: int = 4
    max_drip: int = 3


@dataclass
class SkinConfig:
    seed: int
    sites: list = field(default_factory=list)
    eyes: list = field(default_factory=list)
    mouths: list = field(default_factory=list)
    mottle: float = 0.30            # 0..1 coverage of brown-red mottling
    mottle_freq: float = 0.16
    vein_walks: int = 10            # extra random veins (besides those from sites)
    vein_len: float = 7.0
    sores: int = 10
    base_level: float = 0.15
    brows: bool = True
    tears: bool = True
    clean_boxes: list = field(default_factory=list)   # model boxes kept transparent (e.g. eyes)
    vein_tags: tuple | None = None  # restrict random veins to parts with these tags
    no_paint_tags: tuple = ()       # parts that only receive features, no random noise
    fur_dark: bool = False          # host is dark (cow): use lighter flesh accents
    calm_tags: tuple = ("head", "face", "nose", "snout", "beak", "wattle", "horn")  # less random noise here
    rim: bool = False               # darker rim around mottling patches


def _in_box(P, lo, hi, pad=0.0):
    lo = np.asarray(lo) - pad
    hi = np.asarray(hi) + pad
    return np.all((P >= lo) & (P <= hi), axis=1)


def paint_skin(canvas: Canvas, T: Texels, cfg: SkinConfig) -> None:
    """The infection pass on the inflated skin copies."""
    if len(T) == 0:
        return
    rng = np.random.default_rng(cfg.seed)
    nz = Noise3(cfg.seed)
    nz2 = Noise3(cfg.seed + 101)
    P = T.P
    tags = np.array([T.parts[i].tag for i in T.part], dtype=object)
    paintable = np.array([t not in cfg.no_paint_tags for t in tags])

    # infection intensity
    I = np.full(len(T), cfg.base_level)
    for s in cfg.sites:
        d = np.linalg.norm(P - np.asarray(s.c), axis=1)
        I = I + np.exp(-(d / (s.r * 2.2)) ** 2)
    I = np.clip(I, 0, 1.5)

    # 1) brown-red mottling
    m1 = nz.fbm(P, freq=cfg.mottle_freq, octaves=3)
    m2 = nz2.fbm(P, freq=0.55, octaves=2)
    calm = np.array([t in cfg.calm_tags for t in tags])
    thr = np.quantile(m1, 1.0 - cfg.mottle) - 0.08 * I + 0.12 * calm
    mott = (m1 > thr) & paintable
    shade = np.where(m2 > 0.6, 2, np.where(m2 < 0.4, 1, 0))
    cols = pick([PAL["brown"], PAL["brown_dk"], PAL["brown_red"]], shade)
    # a few crimson specks inside patches
    speck = mott & (nz2.value(P * 1.7 + 3.3) > 0.83)
    cols[speck] = PAL["crimson_dk"]
    canvas.put_many(T.u[mott], T.v[mott], cols[mott])
    # darker rim around patches (1-texel feel): texels just under threshold
    rim = (m1 > thr - 0.035) & ~mott & paintable & cfg.rim
    canvas.put_many(T.u[rim], T.v[rim], np.broadcast_to(np.array(PAL["brown_red"], np.uint8), (int(rim.sum()), 4)))

    # 2) exposed flesh at burst sites
    for s in cfg.sites:
        if not s.flesh:
            continue
        d = np.linalg.norm(P - np.asarray(s.c), axis=1) / s.r
        d = d + (nz.value(P * 0.9 + 7.0) - 0.5) * 0.55
        core = d < 1.0
        ring = (d >= 1.0) & (d < 1.32)
        st = nz2.value(np.c_[P[:, 0] * 1.4, P[:, 1] * 0.35, P[:, 2] * 1.4] + 11.0)
        fc = np.where(st > 0.62, 2, np.where(st < 0.38, 1, 0))
        fcols = pick([PAL["flesh"], PAL["flesh_dk"], PAL["flesh_hi"]], fc)
        deep = d < 0.45
        fcols[deep & (st < 0.5)] = PAL["flesh_xdk"]
        canvas.put_many(T.u[core], T.v[core], fcols[core])
        rcols = pick([PAL["blood_dk"], PAL["crimson_dk"]], (st[ring] > 0.5).astype(int))
        canvas.put_many(T.u[ring], T.v[ring], rcols)

    # 3) veins (surface random walks) from sites and random spots
    def vein(part: Part, start, direction, length, thick_start=True):
        lo, hi = part.lo, part.hi
        pts = surface_walk(lo, hi, start, direction, length, rng, wiggle=0.45, step=0.33)
        branch_budget = 2
        for k, (p, n) in enumerate(pts):
            tx = point_to_texel(part, p, n)
            if tx is None:
                continue
            frac = k / max(len(pts) - 1, 1)
            col = PAL["vein_dk"] if frac < 0.35 else (PAL["vein"] if frac < 0.8 else PAL["vein_hi"])
            canvas.put(tx[0], tx[1], col)
            if branch_budget and k > 4 and rng.random() < 0.06:
                branch_budget -= 1
                b = np.cross(n, rng.normal(size=3))
                for (bp, bn) in surface_walk(lo, hi, p, b, length * 0.4, rng, wiggle=0.5, step=0.33):
                    t2 = point_to_texel(part, bp, bn)
                    if t2 is not None:
                        canvas.put(t2[0], t2[1], PAL["vein"])

    skin_parts = [p for p in T.parts if p.tag not in cfg.no_paint_tags]
    for s in cfg.sites:
        # parts whose box is close to the site
        cands = []
        for p in skin_parts:
            q = np.clip(np.asarray(s.c, float), p.lo, p.hi)
            dist = float(np.linalg.norm(q - np.asarray(s.c, float)))
            if dist < s.r * 1.5:
                cands.append((dist, p, q))
        cands.sort(key=lambda t: t[0])
        for dist, p, q in cands[:3]:
            for _ in range(s.veins):
                dirn = rng.normal(size=3)
                vein(p, q, dirn, s.vein_len * (0.6 + 0.6 * rng.random()))
    vparts = [p for p in skin_parts if cfg.vein_tags is None or p.tag in cfg.vein_tags]
    if vparts:
        areas = np.array([max(1.0, float(np.prod(np.sort(p.size)[1:]))) for p in vparts])
        for _ in range(cfg.vein_walks):
            p = vparts[rng.choice(len(vparts), p=areas / areas.sum())]
            start = p.lo + rng.random(3) * (p.hi - p.lo)
            ax = rng.integers(3)
            start[ax] = p.lo[ax] if rng.random() < 0.5 else p.hi[ax]
            vein(p, start, rng.normal(size=3), cfg.vein_len * (0.5 + rng.random()))

    # 4) sores
    idx_of = {(int(u), int(v)): i for i, (u, v) in enumerate(zip(T.u, T.v))}
    w = (I + 0.05) * paintable * np.where(calm, 0.25, 1.0)
    if w.sum() > 0 and cfg.sores:
        chosen = rng.choice(len(T), size=min(cfg.sores, int((w > 0).sum())), replace=False, p=w / w.sum())
        for i in chosen:
            u, v = int(T.u[i]), int(T.v[i])
            canvas.put(u, v, PAL["pus"] if rng.random() < 0.3 else PAL["sore"])
            for du, dv in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                j = idx_of.get((u + du, v + dv))
                if j is None or T.part[j] != T.part[i] or T.face[j] != T.face[i]:
                    continue
                if rng.random() < 0.75:
                    canvas.put(u + du, v + dv, PAL["sore_rim"] if rng.random() < 0.7 else PAL["sore"])

    # 5) mouths: blood + drips
    for m in cfg.mouths:
        inb = _in_box(P, m.lo, m.hi)
        bc = pick([PAL["blood"], PAL["blood_dk"], PAL["blood_fresh"]], (nz2.value(P * 2.1) * 3).astype(int))
        canvas.put_many(T.u[inb], T.v[inb], bc[inb])
        # drips: start at the lowest blood texels of side faces, run down in face space
        side = inb & np.isin(T.face, ["north", "east", "west", "south"])
        cand = np.nonzero(side)[0]
        if len(cand):
            rng.shuffle(cand)
            done = 0
            for i in cand:
                if done >= m.drips:
                    break
                u, v = int(T.u[i]), int(T.v[i])
                ln = int(rng.integers(1, m.max_drip + 1))
                ok = False
                for k in range(1, ln + 1):
                    j = idx_of.get((u, v + k))
                    if j is None or T.part[j] != T.part[i] or T.face[j] != T.face[i]:
                        break
                    canvas.put(u, v + k, PAL["blood"] if k < ln else PAL["blood_dk"])
                    ok = True
                done += ok

    # 6) eyes: sockets, angry brows, tears; the eye texels stay clear for the glow quads
    for e in cfg.eyes:
        front = (np.abs(P[:, 2] - e.z) < 0.01) & (T.face == "north")
        x, y = P[:, 0], P[:, 1]
        eye = front & (x > e.x0) & (x < e.x1) & (y > e.y0) & (y < e.y1)
        ring = front & ~eye & (x > e.x0 - 1) & (x < e.x1 + 1) & (y > e.y0 - 1) & (y < e.y1 + 1)
        # sockets: darker below/sides, keep the corners lighter so it reads as a squint
        canvas.put_many(T.u[ring], T.v[ring], np.broadcast_to(np.array(PAL["crimson_xdk"], np.uint8), (int(ring.sum()), 4)))
        if cfg.brows:
            # angry brow: one texel above the outer end, dropping to the eye top at the inner end
            ew = e.x1 - e.x0
            for k in range(int(round(ew)) + 2):
                if e.inner > 0:
                    bx = e.x0 - 0.5 + k        # outer end at x0
                    by = e.y1 + 1.5 - (1.0 if k >= (ew + 1) / 2 else 0.0)
                else:
                    bx = e.x1 + 0.5 - k
                    by = e.y1 + 1.5 - (1.0 if k >= (ew + 1) / 2 else 0.0)
                sel = front & (np.abs(x - bx) < 0.5) & (np.abs(y - by) < 0.5)
                canvas.put_many(T.u[sel], T.v[sel], np.broadcast_to(np.array(PAL["vein_dk"], np.uint8), (int(sel.sum()), 4)))
        if cfg.tears:
            tx = e.x0 + 0.5 if e.inner > 0 else e.x1 - 0.5
            for k in range(1, 4):
                sel = front & (np.abs(x - tx) < 0.5) & (np.abs(y - (e.y0 - k + 0.5)) < 0.5)
                canvas.put_many(T.u[sel], T.v[sel], np.broadcast_to(np.array(PAL["blood_fresh"] if k < 3 else PAL["blood_dk"], np.uint8), (int(sel.sum()), 4)))
        canvas.put_many(T.u[eye], T.v[eye], np.broadcast_to(np.array(CLEAR, np.uint8), (int(eye.sum()), 4)))

    for (lo, hi) in cfg.clean_boxes:
        sel = _in_box(P, lo, hi)
        canvas.put_many(T.u[sel], T.v[sel], np.broadcast_to(np.array(CLEAR, np.uint8), (int(sel.sum()), 4)))


# ---------------------------------------------------------------------------
# growth parts
# ---------------------------------------------------------------------------

def paint_glow(canvas: Canvas, part: Part, cols: Sequence[tuple]) -> None:
    """Glow quad: colour per texel column (left->right as seen from the front)."""
    T = texels_of([part])
    for u, v, fx in zip(T.u, T.v, T.fx):
        c = cols[min(int(fx), len(cols) - 1)]
        canvas.put(int(u), int(v), (c[0], c[1], c[2], GLOW_ALPHA))


def paint_parasite_head(canvas: Canvas, part: Part, seed: int) -> None:
    """Small blocky pale parasite head: crimson blotches, white eyes, dark red maw with teeth."""
    T = texels_of([part])
    nz = Noise3(seed)
    P = T.P - part.lo
    base = nz.fbm(P, freq=0.6, octaves=2)
    cols = pick([PAL["pale"], PAL["pale_hi"], PAL["pale_sh"]], np.where(base > 0.62, 1, np.where(base < 0.4, 2, 0)))
    # shading: bottom darker
    cols[T.face == "down"] = PAL["pale_sh"]
    blot = nz.fbm(P + 9.1, freq=0.55, octaves=2) > 0.6
    cols[blot] = PAL["crimson"]
    cols[blot & (base < 0.45)] = PAL["crimson_dk"]
    br = (nz.value(P * 1.3 + 4.4) > 0.8) & ~blot
    cols[br] = PAL["brown"]
    w, h, d = part.box_dims()
    front = T.face == "north"
    fx, fy = T.fx, T.fy
    # face layout (as seen from the front): eyes on row 1, maw below
    ey = 1 if h >= 4 else 0
    left_eye = 1 if w >= 4 else 0
    right_eye = w - 2 if w >= 4 else w - 1
    eyes = front & (fy == ey) & ((fx == left_eye) | (fx == right_eye))
    cols[front & (fy == ey - 1) & ((fx == left_eye) | (fx == right_eye))] = PAL["crimson_dk"] if ey > 0 else cols[0]
    cols[eyes] = PAL["eye"]
    my0 = ey + 1
    maw = front & (fy >= my0) & (fy <= h - 1) & (fx >= 1) & (fx <= w - 2) if w >= 4 else front & (fy >= my0)
    cols[maw] = PAL["mouth"]
    teeth = maw & (((fy == my0) & (fx % 2 == 1)) | ((fy == h - 1) & (fx % 2 == 0)))
    cols[teeth] = PAL["tooth"]
    # lips: crimson around the maw on the bottom row edges
    cols[front & (fy == h - 1) & ((fx == 0) | (fx == w - 1))] = PAL["crimson_dk"]
    canvas.put_many(T.u, T.v, cols)


def paint_flesh_rod(canvas: Canvas, part: Part, seed: int, style: str = "tendril") -> None:
    """Stalks / tendril segments: crimson with dark rings and brown mottling, paler tip for claws."""
    T = texels_of([part])
    nz = Noise3(seed)
    P = T.P - part.lo
    L = max(part.size)
    ax = int(np.argmax(part.size))
    t = P[:, ax] / max(L, 1e-6)
    n1 = nz.fbm(P, freq=0.7, octaves=2)
    if style == "claw":
        cols = pick([PAL["bone"], PAL["bone_sh"], PAL["pale_sh"]], (n1 * 3).astype(int))
        cols[t < 0.35] = PAL["crimson_dk"]
    elif style == "stalk":
        cols = pick([PAL["crimson"], PAL["crimson_dk"], PAL["flesh_hi"]], np.where(n1 > 0.62, 2, np.where(n1 < 0.42, 1, 0)))
        ring = (np.floor(P[:, ax]) % 2 == 0) & (n1 < 0.5)
        cols[ring] = PAL["flesh_dk"]
    else:
        cols = pick([PAL["crimson_dk"], PAL["crimson"], PAL["brown"]], np.where(n1 > 0.6, 1, np.where(n1 < 0.35, 2, 0)))
        seg = (np.floor(P[:, ax]) % 3 == 0)
        cols[seg] = PAL["crimson_xdk"]
        hi = (T.face == "up") | (T.face == "west")
        cols[hi & (n1 > 0.55)] = PAL["crimson_hi"]
    if style != "claw":
        cap_faces = {0: ("east", "west"), 1: ("up", "down"), 2: ("north", "south")}[ax]
        caps = np.isin(T.face, cap_faces)
        cols[caps] = PAL["crimson_xdk"]
    canvas.put_many(T.u, T.v, cols)


def paint_jaw(canvas: Canvas, part: Part, seed: int) -> None:
    """Parasitic lower jaw: dark maw on top, tooth row along the front edge, raw flesh outside."""
    T = texels_of([part])
    nz = Noise3(seed)
    P = T.P - part.lo
    n1 = nz.fbm(P, freq=0.8, octaves=2)
    cols = pick([PAL["flesh_dk"], PAL["crimson"], PAL["flesh_xdk"]], np.where(n1 > 0.6, 1, np.where(n1 < 0.4, 2, 0)))
    w, h, d = part.box_dims()
    top = T.face == "up"
    cols[top] = PAL["mouth"]
    # 'up' face: fy=0 is the back edge, fy=d-1 the front edge (see georender README)
    front_row = top & (T.fy == d - 1)
    cols[front_row & (T.fx % 2 == 0)] = PAL["tooth"]
    cols[top & (T.fy == d - 2) & (T.fx % 3 == 1)] = PAL["blood_fresh"]
    side_teeth = (T.face == "north") & (T.fy == 0) & (T.fx % 2 == 0)
    cols[side_teeth] = PAL["tooth"]
    cols[(T.face == "north") & (T.fy == 0) & (T.fx % 2 == 1)] = PAL["blood_dk"]
    drip = (T.face == "north") & (T.fy >= 1) & (nz.value(np.c_[T.fx * 3.1, T.fx * 0.0, T.fx * 0.0] + 2.0) > 0.6)
    cols[drip & (T.fy <= 1)] = PAL["blood"]
    canvas.put_many(T.u, T.v, cols)


def paint_tooth(canvas: Canvas, part: Part) -> None:
    T = texels_of([part])
    cols = np.empty((len(T), 4), np.uint8)
    cols[:] = PAL["tooth"]
    cols[(T.face == "down")] = PAL["tooth_sh"]
    cols[(T.face == "east") | (T.face == "south")] = PAL["tooth_sh"]
    cols[(T.face == "up")] = PAL["blood"]
    canvas.put_many(T.u, T.v, cols)


def paint_flat(canvas: Canvas, part: Part, col) -> None:
    T = texels_of([part])
    canvas.put_many(T.u, T.v, np.broadcast_to(np.array(col, np.uint8), (len(T), 4)))
