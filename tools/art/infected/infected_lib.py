"""Shared building blocks for the infected-creature overlay generator.

Everything here is original code; no Mojang asset is read or written by this
module.  The vanilla cube boxes used by gen_infected.py are small derived data
(coordinates only) so the overlay cubes line up with the vanilla models.

Model space ("geo space") follows tools/georender/README.md CONVENTIONS:
16 units = 1 block, +Y up, front = -Z, the entity's right = -X.

Pieces
------
* Noise3            deterministic 3D value noise / fBm (numpy)
* Part, Bone, Model overlay geometry description -> 1.12.0 geometry JSON with
                    box-UV (and per-face UV for glow quads) packed into one texture
* TexelSet          every texel of a set of parts with its 3D position, normal and
                    face-local coordinates, so textures can be painted in 3D
                    (seamless veins / patches across cube edges)
* SurfaceWalker     random walks over a box surface (veins that wrap round edges)
"""
from __future__ import annotations

import json
import math
import os
import sys
from dataclasses import dataclass, field
from typing import Callable, Iterable, Sequence

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
sys.path.insert(0, os.path.join(REPO, "tools", "georender"))
import georender as g  # noqa: E402  (UV layout + face corner conventions, verified there)


# ---------------------------------------------------------------------------
# colours
# ---------------------------------------------------------------------------

def hexc(s: str, a: int = 255) -> tuple[int, int, int, int]:
    s = s.lstrip("#")
    return (int(s[0:2], 16), int(s[2:4], 16), int(s[4:6], 16), a)


# Palette shared with the parasite creature (tools/icons/make_icons.py jar icon:
# pale head e2b6a0/b8806b, white eyes, mouth 4a0707, crimson b3271d/741612, brown 5c2716).
PAL = {
    "pale": hexc("e2b6a0"), "pale_hi": hexc("efcbb5"), "pale_sh": hexc("b8806b"), "pale_dk": hexc("94604e"),
    "eye": hexc("ffffff"), "mouth": hexc("4a0707"), "tooth": hexc("efe4cc"), "tooth_sh": hexc("c9b99a"),
    "crimson": hexc("b3271d"), "crimson_hi": hexc("d2443a"), "crimson_dk": hexc("741612"), "crimson_xdk": hexc("4e0d0b"),
    "brown": hexc("5c2716"), "brown_dk": hexc("3f1a0f"), "brown_red": hexc("6e2a1a"),
    "flesh": hexc("c23a2c"), "flesh_hi": hexc("e0675a"), "flesh_dk": hexc("8a1a14"), "flesh_xdk": hexc("5a0e0b"),
    "vein": hexc("7a0f10"), "vein_dk": hexc("4f0708"), "vein_hi": hexc("a3201a"),
    "blood": hexc("8c0f0c"), "blood_dk": hexc("560808"), "blood_fresh": hexc("b5180f"),
    "sore": hexc("d23a26"), "sore_rim": hexc("5a0a0a"), "pus": hexc("d9c37e"),
    "bone": hexc("e8dcc4"), "bone_sh": hexc("bfae8e"),
    "glow_white": hexc("ffffff"), "glow_red": hexc("ff3020"),
}

GLOW_ALPHA = 3   # vanilla spider.tga eyes use alpha 3 with the emissive "spider" material


# ---------------------------------------------------------------------------
# noise
# ---------------------------------------------------------------------------

class Noise3:
    """Value noise on an integer lattice with smoothstep interpolation."""

    def __init__(self, seed: int):
        rng = np.random.default_rng(seed)
        self.perm = np.concatenate([rng.permutation(256)] * 2).astype(np.int64)
        self.vals = rng.random(256)

    def _h(self, x, y, z):
        p = self.perm
        return self.vals[p[(p[(p[x & 255] + y) & 255] + z) & 255]]

    def value(self, P: np.ndarray) -> np.ndarray:
        P = np.asarray(P, dtype=float)
        i = np.floor(P).astype(np.int64)
        f = P - i
        u = f * f * (3 - 2 * f)
        x, y, z = i[:, 0], i[:, 1], i[:, 2]
        out = 0.0
        for dx in (0, 1):
            wx = u[:, 0] if dx else 1 - u[:, 0]
            for dy in (0, 1):
                wy = u[:, 1] if dy else 1 - u[:, 1]
                for dz in (0, 1):
                    wz = u[:, 2] if dz else 1 - u[:, 2]
                    out = out + wx * wy * wz * self._h(x + dx, y + dy, z + dz)
        return out

    def fbm(self, P: np.ndarray, freq: float = 0.2, octaves: int = 3, gain: float = 0.5,
            offset=(0.0, 0.0, 0.0)) -> np.ndarray:
        P = np.asarray(P, dtype=float) + np.asarray(offset)
        amp, tot, acc = 1.0, 0.0, 0.0
        for o in range(octaves):
            acc = acc + amp * self.value(P * freq * (2 ** o) + 17.3 * o)
            tot += amp
            amp *= gain
        return acc / tot


# ---------------------------------------------------------------------------
# geometry description
# ---------------------------------------------------------------------------

@dataclass
class Part:
    """One cube.  origin/size are in the cube's own unrotated frame (model space
    for skin copies).  Box UV unless ``glow_face`` is set (then a zero-depth
    quad drawn only on that face via per-face UV)."""
    origin: tuple
    size: tuple
    inflate: float = 0.0
    kind: str = "skin"              # skin | head | stalk | tendril | claw | jaw | tooth | glow | mush
    tag: str = ""                   # free label used by painters (e.g. "body", "head", "robe")
    paint: Callable | None = None   # painter(part, texel-set view, tex, ctx)
    glow_face: str | None = None
    uv: tuple | None = None         # assigned by Model.pack()
    meta: dict = field(default_factory=dict)

    def box_dims(self) -> tuple[int, int, int]:
        return tuple(int(math.floor(abs(float(s)) + 1e-7)) for s in self.size)

    def footprint(self) -> tuple[int, int]:
        w, h, d = self.box_dims()
        if self.glow_face:
            if self.glow_face in ("north", "south"):
                return max(w, 1), max(h, 1)
            if self.glow_face in ("east", "west"):
                return max(d, 1), max(h, 1)
            return max(w, 1), max(d, 1)
        return 2 * d + 2 * w, d + h

    @property
    def lo(self) -> np.ndarray:
        return np.array(self.origin, dtype=float)

    @property
    def hi(self) -> np.ndarray:
        return np.array(self.origin, dtype=float) + np.array(self.size, dtype=float)


@dataclass
class Bone:
    name: str
    pivot: tuple
    parent: str | None = None
    rotation: tuple = (0.0, 0.0, 0.0)
    parts: list[Part] = field(default_factory=list)


class Model:
    def __init__(self, identifier: str, tex_w: int, tex_h: int, visible=(3.0, 3.0, (0.0, 1.25, 0.0))):
        self.identifier = identifier
        self.tex_w, self.tex_h = tex_w, tex_h
        self.bones: list[Bone] = []
        self.visible = visible

    def bone(self, name: str, pivot, parent: str | None = None, rotation=(0.0, 0.0, 0.0)) -> Bone:
        for b in self.bones:
            if b.name == name:
                raise ValueError(f"duplicate bone {name}")
        b = Bone(name, tuple(float(x) for x in pivot), parent, tuple(float(x) for x in rotation))
        self.bones.append(b)
        return b

    def get(self, name: str) -> Bone:
        for b in self.bones:
            if b.name == name:
                return b
        raise KeyError(name)

    def parts(self) -> list[tuple[Bone, Part]]:
        return [(b, p) for b in self.bones for p in b.parts]

    # -- UV packing ---------------------------------------------------------
    def pack(self) -> None:
        pack_parts([p for _, p in self.parts()], self.tex_w, self.tex_h, self.identifier)

    # -- JSON ---------------------------------------------------------------
    def to_json(self) -> dict:
        bones = []
        for b in self.bones:
            jb: dict = {"name": b.name}
            if b.parent:
                jb["parent"] = b.parent
            jb["pivot"] = [_r(v) for v in b.pivot]
            if any(abs(v) > 1e-9 for v in b.rotation):
                jb["rotation"] = [_r(v) for v in b.rotation]
            cubes = []
            for p in b.parts:
                c: dict = {"origin": [_r(v) for v in p.origin], "size": [_r(v) for v in p.size]}
                if abs(p.inflate) > 1e-9:
                    c["inflate"] = _r(p.inflate)
                if "uv_json" in p.meta:
                    c["uv"] = p.meta["uv_json"]
                elif p.glow_face:
                    fw, fh = p.footprint()
                    c["uv"] = {p.glow_face: {"uv": [p.uv[0], p.uv[1]], "uv_size": [fw, fh]}}
                else:
                    c["uv"] = [p.uv[0], p.uv[1]]
                cubes.append(c)
            if cubes:
                jb["cubes"] = cubes
            bones.append(jb)
        vw, vh, vo = self.visible
        return {
            "description": {
                "identifier": self.identifier,
                "texture_width": self.tex_w,
                "texture_height": self.tex_h,
                "visible_bounds_width": vw,
                "visible_bounds_height": vh,
                "visible_bounds_offset": [_r(v) for v in vo],
            },
            "bones": bones,
        }


def pack_parts(parts: Sequence[Part], tex_w: int, tex_h: int, what: str = "") -> None:
    """Shelf-pack every part's box-UV footprint (tallest first) into one texture."""
    items = sorted([p for p in parts if "uv_json" not in p.meta],
                   key=lambda p: (-p.footprint()[1], -p.footprint()[0]))
    x = y = shelf_h = 0
    for p in items:
        w, h = p.footprint()
        if x + w > tex_w:
            x = 0
            y += shelf_h
            shelf_h = 0
        if y + h > tex_h:
            raise ValueError(f"{what}: texture {tex_w}x{tex_h} too small")
        p.uv = (x, y)
        x += w
        shelf_h = max(shelf_h, h)


def _r(v: float):
    v = round(float(v), 4)
    return int(v) if v == int(v) else v


def write_geometry_file(path: str, models: Sequence[Model]) -> None:
    data = {"format_version": "1.12.0", "minecraft:geometry": [m.to_json() for m in models]}
    write_json(path, data)


def write_json(path: str, data) -> None:
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8", newline="\n") as f:
        f.write(json.dumps(data, indent=2) + "\n")


# ---------------------------------------------------------------------------
# texels in 3D
# ---------------------------------------------------------------------------

FACE_NORMAL_GEO = {
    "north": (0.0, 0.0, -1.0), "south": (0.0, 0.0, 1.0),
    "east": (-1.0, 0.0, 0.0), "west": (1.0, 0.0, 0.0),   # east = entity's right = -X
    "up": (0.0, 1.0, 0.0), "down": (0.0, -1.0, 0.0),
}


def face_frames(part: Part) -> dict[str, dict]:
    """Per drawn face: UV rect and the geo-space corners C0 (lx,ly)=(0,0), C1=(1,0), C3=(0,1)
    following georender's box-UV / per-face conventions."""
    o = np.array(part.origin, dtype=float)
    s = np.array(part.size, dtype=float)
    f = np.array([-(o[0] + s[0]), o[1], o[2]])
    t = np.array([-o[0], o[1] + s[1], o[2] + s[2]])
    if part.glow_face:
        fw, fh = part.footprint()
        cube = g.Cube(origin=tuple(o), size=tuple(s), uv={part.glow_face: {"uv": list(part.uv), "uv_size": [fw, fh]}})
        rects = g.face_rects(cube, False)
    else:
        rects = g.box_uv_rects(part.size, part.uv, mirror=False)
    out = {}
    for face, rect in rects.items():
        u0, v0, u1, v1 = rect
        if abs(u1 - u0) < 1e-9 or abs(v1 - v0) < 1e-9:
            continue
        c = g._face_corners(face, f, t)
        c[:, 0] *= -1.0   # render space -> geo space
        out[face] = {"rect": rect, "C0": c[0], "C1": c[1], "C3": c[3]}
    return out


@dataclass
class Texels:
    """Flat arrays describing texels of one or more parts."""
    u: np.ndarray
    v: np.ndarray
    P: np.ndarray        # (N,3) geo position on the nominal (un-inflated) box
    n: np.ndarray        # (N,3) outward normal (geo)
    face: np.ndarray     # (N,) face name
    fx: np.ndarray       # face-local x (0 = left as seen from outside)
    fy: np.ndarray       # face-local y (0 = top as seen from outside)
    fw: np.ndarray       # face width in texels
    fh: np.ndarray       # face height in texels
    part: np.ndarray     # (N,) index into the parts list
    parts: list

    def __len__(self):
        return len(self.u)

    def subset(self, mask: np.ndarray) -> "Texels":
        return Texels(self.u[mask], self.v[mask], self.P[mask], self.n[mask], self.face[mask], self.fx[mask],
                      self.fy[mask], self.fw[mask], self.fh[mask], self.part[mask], self.parts)


def texels_of(parts: Sequence[Part]) -> Texels:
    U, V, P, N, F, FX, FY, FW, FH, PI = ([] for _ in range(10))
    for pi, part in enumerate(parts):
        for face, fr in face_frames(part).items():
            u0, v0, u1, v1 = fr["rect"]
            umin, umax = int(round(min(u0, u1))), int(round(max(u0, u1)))
            vmin, vmax = int(round(min(v0, v1))), int(round(max(v0, v1)))
            C0, C1, C3 = fr["C0"], fr["C1"], fr["C3"]
            for iv in range(vmin, vmax):
                for iu in range(umin, umax):
                    lx = (iu + 0.5 - u0) / (u1 - u0)
                    ly = (iv + 0.5 - v0) / (v1 - v0)
                    p = C0 + lx * (C1 - C0) + ly * (C3 - C0)
                    U.append(iu); V.append(iv); P.append(p); N.append(FACE_NORMAL_GEO[face]); F.append(face)
                    FX.append(iu - umin); FY.append(iv - vmin); FW.append(umax - umin); FH.append(vmax - vmin)
                    PI.append(pi)
    if not U:
        z = np.zeros(0)
        return Texels(z.astype(int), z.astype(int), np.zeros((0, 3)), np.zeros((0, 3)), np.array([], dtype=object),
                      z.astype(int), z.astype(int), z.astype(int), z.astype(int), z.astype(int), list(parts))
    return Texels(np.array(U), np.array(V), np.array(P), np.array(N, dtype=float), np.array(F, dtype=object),
                  np.array(FX), np.array(FY), np.array(FW), np.array(FH), np.array(PI), list(parts))


def point_to_texel(part: Part, P: np.ndarray, normal: np.ndarray) -> tuple[int, int] | None:
    """Texel of ``part`` under a geo-space surface point with the given outward normal."""
    frames = face_frames(part)
    best = None
    for face, fr in frames.items():
        fn = np.array(FACE_NORMAL_GEO[face])
        if float(np.dot(fn, normal)) < 0.7:
            continue
        best = (face, fr)
        break
    if best is None:
        return None
    face, fr = best
    C0, C1, C3 = fr["C0"], fr["C1"], fr["C3"]
    e1, e2 = C1 - C0, C3 - C0
    lx = float(np.dot(P - C0, e1) / max(np.dot(e1, e1), 1e-12))
    ly = float(np.dot(P - C0, e2) / max(np.dot(e2, e2), 1e-12))
    lx = min(max(lx, 0.0), 0.9999)
    ly = min(max(ly, 0.0), 0.9999)
    u0, v0, u1, v1 = fr["rect"]
    u = u0 + lx * (u1 - u0)
    v = v0 + ly * (v1 - v0)
    umin, umax = min(u0, u1), max(u0, u1)
    vmin, vmax = min(v0, v1), max(v0, v1)
    iu = int(math.floor(min(max(u, umin), umax - 1e-6)))
    iv = int(math.floor(min(max(v, vmin), vmax - 1e-6)))
    return iu, iv


# ---------------------------------------------------------------------------
# surface walks (veins)
# ---------------------------------------------------------------------------

def box_normal_at(P: np.ndarray, lo: np.ndarray, hi: np.ndarray) -> np.ndarray:
    d = np.concatenate([P - lo, hi - P])     # distances to the 6 planes
    k = int(np.argmin(d))
    n = np.zeros(3)
    if k < 3:
        n[k] = -1.0
    else:
        n[k - 3] = 1.0
    return n


def surface_walk(lo, hi, start, direction, length: float, rng: np.random.Generator, wiggle: float = 0.35,
                 step: float = 0.3, blocked: Callable | None = None) -> list[tuple[np.ndarray, np.ndarray]]:
    """Random walk on the surface of box [lo,hi] (geo).  Returns (point, normal) samples.
    Crossing an edge continues on the neighbouring face ("unfolding")."""
    lo = np.asarray(lo, float)
    hi = np.asarray(hi, float)
    p = np.clip(np.asarray(start, float), lo, hi)
    n = box_normal_at(p, lo, hi)
    d = np.asarray(direction, float)
    d = d - n * np.dot(d, n)
    if np.linalg.norm(d) < 1e-6:
        d = np.cross(n, [0.3, 0.7, 0.2])
    d /= np.linalg.norm(d)
    out = [(p.copy(), n.copy())]
    travelled = 0.0
    while travelled < length:
        # wiggle: rotate d about n
        ang = rng.normal(0.0, wiggle)
        c, s = math.cos(ang), math.sin(ang)
        b = np.cross(n, d)
        d = c * d + s * b
        q = p + d * step
        over_axes = [(i, q[i] - hi[i]) for i in range(3) if q[i] > hi[i] + 1e-9] + \
                    [(i, lo[i] - q[i]) for i in range(3) if q[i] < lo[i] - 1e-9]
        if over_axes:
            i, over = max(over_axes, key=lambda t: t[1])
            newn = np.zeros(3)
            newn[i] = 1.0 if q[i] > hi[i] else -1.0
            q[i] = min(max(q[i], lo[i]), hi[i])
            q = q - n * over
            d = -n
            n = newn
        q = np.clip(q, lo, hi)
        p = q
        if blocked is not None and blocked(p):
            break
        out.append((p.copy(), n.copy()))
        travelled += step
    return out


# ---------------------------------------------------------------------------
# texture helpers
# ---------------------------------------------------------------------------

class Canvas:
    def __init__(self, w: int, h: int):
        self.a = np.zeros((h, w, 4), dtype=np.uint8)

    def put(self, u, v, col):
        self.a[v, u] = col

    def put_many(self, U: np.ndarray, V: np.ndarray, cols):
        cols = np.asarray(cols, dtype=np.uint8)
        if cols.ndim == 1:
            cols = np.broadcast_to(cols, (len(U), 4))
        self.a[V, U] = cols

    def get_alpha(self, U, V):
        return self.a[V, U, 3]


def pick(cols: Sequence[tuple], idx: np.ndarray) -> np.ndarray:
    arr = np.array(cols, dtype=np.uint8)
    return arr[np.clip(idx, 0, len(cols) - 1)]


def rot_matrix_geo(r) -> np.ndarray:
    """3x3 rotation of a bone rotation [rx,ry,rz] in GEO space (see georender README:
    R_geo = Rz(-rz) . Ry(+ry) . Rx(-rx), standard right-handed matrices)."""
    rx, ry, rz = (math.radians(float(a)) for a in r)

    def Rx(a):
        c, s = math.cos(a), math.sin(a)
        return np.array([[1, 0, 0], [0, c, -s], [0, s, c]])

    def Ry(a):
        c, s = math.cos(a), math.sin(a)
        return np.array([[c, 0, s], [0, 1, 0], [-s, 0, c]])

    def Rz(a):
        c, s = math.cos(a), math.sin(a)
        return np.array([[c, -s, 0], [s, c, 0], [0, 0, 1]])
    return Rz(-rz) @ Ry(ry) @ Rx(-rx)
