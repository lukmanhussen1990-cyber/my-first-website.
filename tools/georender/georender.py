#!/usr/bin/env python3
"""georender - offline preview renderer for Minecraft Bedrock entity geometry.

Renders Bedrock ``.geo.json`` models (legacy 1.8.0/1.10.0 and modern
1.12.0+ ``minecraft:geometry``) to PNG with a small numpy software
rasteriser, optionally posed by Bedrock animation JSON evaluated with a
small Molang interpreter.  Importable module and CLI (see README.md).

Coordinate conventions (see README.md "CONVENTIONS" for the full story):

* Geometry files ("geo space"): +Y up, the entity's FRONT points to -Z
  ("north"), the entity's RIGHT side is -X, its LEFT side is +X.
  16 units = 1 block.  All pivots/origins are absolute model-space values.
* Internally everything is converted to "render space" (RS), which is the
  space Blockbench displays: x_rs = -x_geo, y and z unchanged.  RS is a
  normal right-handed space in which the model is not mirrored.
* A Bedrock rotation [rx, ry, rz] (bone, cube, bind pose or animation) is
  the right-handed RS matrix  Rz(rz) * Ry(-ry) * Rx(-rx)  (X applied first).
  Equivalently: +rx pitches the bone's front (-Z) DOWN, +ry turns the front
  toward the entity's RIGHT (clockwise seen from above), +rz rolls the top
  toward the entity's LEFT (clockwise seen from the front).
"""
from __future__ import annotations

import argparse
import copy
import glob
import json
import math
import os
import random
import re
import sys
from dataclasses import dataclass, field
from typing import Any, Iterable, Sequence

import numpy as np
from PIL import Image, ImageDraw, ImageFont

__all__ = [
    "load_json", "GeometryLibrary", "Geometry", "Bone", "Cube", "load_geometries",
    "Molang", "MolangContext", "molang_eval", "Animation", "load_animations",
    "AnimationLibrary", "Play", "compute_pose", "Camera", "Layer", "load_texture",
    "render", "render_views", "render_frames", "contact_sheet", "save_gif",
    "build_mesh", "bone_matrices", "rot_rs", "geo_to_rs", "VIEWS",
    "box_uv_rects", "face_rects", "make_orientation_test", "uv_map_image",
]

# ---------------------------------------------------------------------------
# JSON loading (tolerates // and /* */ comments, trailing commas, BOM)
# ---------------------------------------------------------------------------


def _strip_comments_and_trailing_commas(text: str) -> str:
    out: list[str] = []
    i, n = 0, len(text)
    in_str = False
    while i < n:
        c = text[i]
        if in_str:
            out.append(c)
            if c == "\\" and i + 1 < n:
                out.append(text[i + 1])
                i += 2
                continue
            if c == '"':
                in_str = False
            i += 1
            continue
        if c == '"':
            in_str = True
            out.append(c)
            i += 1
            continue
        if c == "/" and i + 1 < n and text[i + 1] == "/":
            j = text.find("\n", i)
            i = n if j < 0 else j
            continue
        if c == "/" and i + 1 < n and text[i + 1] == "*":
            j = text.find("*/", i + 2)
            i = n if j < 0 else j + 2
            continue
        if c == "#" and (i == 0 or text[i - 1] == "\n"):
            # very old Mojang files occasionally carry '#' comment lines
            j = text.find("\n", i)
            i = n if j < 0 else j
            continue
        if c == ",":
            # drop trailing comma: look ahead over whitespace / comments
            j = i + 1
            while j < n:
                if text[j] in " \t\r\n":
                    j += 1
                elif text.startswith("//", j):
                    k = text.find("\n", j)
                    j = n if k < 0 else k
                elif text.startswith("/*", j):
                    k = text.find("*/", j + 2)
                    j = n if k < 0 else k + 2
                else:
                    break
            if j < n and text[j] in "}]":
                i += 1
                continue
        out.append(c)
        i += 1
    return "".join(out)


def load_json(path_or_text: str, *, is_text: bool = False, warnings: list | None = None) -> Any:
    """Load JSON leniently.  Strict JSON first; on failure strip comments and
    trailing commas (Mojang's own files contain both) and record a warning."""
    if is_text:
        text = path_or_text
        label = "<text>"
    else:
        with open(path_or_text, "r", encoding="utf-8-sig") as fh:
            text = fh.read()
        label = path_or_text
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        data = json.loads(_strip_comments_and_trailing_commas(text))
        if warnings is not None:
            warnings.append(f"{label}: not strict JSON (comments/trailing commas); parsed leniently")
        return data


# ---------------------------------------------------------------------------
# Geometry model
# ---------------------------------------------------------------------------

def _vec3(v, default=(0.0, 0.0, 0.0)) -> tuple[float, float, float]:
    if v is None:
        return tuple(float(x) for x in default)  # type: ignore[return-value]
    if isinstance(v, (int, float)):
        return (float(v), float(v), float(v))
    v = list(v)
    if len(v) == 1:
        return (float(v[0]),) * 3  # type: ignore[return-value]
    return (float(v[0]), float(v[1]), float(v[2]))


@dataclass
class Cube:
    origin: tuple[float, float, float]
    size: tuple[float, float, float]
    uv: Any = None                      # [u, v] (box UV) or {face: {uv, uv_size}} or None
    inflate: float | None = None        # None -> inherit bone inflate
    mirror: bool | None = None          # None -> inherit bone mirror
    rotation: tuple[float, float, float] | None = None
    pivot: tuple[float, float, float] | None = None

    @staticmethod
    def from_json(d: dict) -> "Cube":
        uv = d.get("uv", [0, 0])
        return Cube(
            origin=_vec3(d.get("origin")),
            size=_vec3(d.get("size")),
            uv=uv,
            inflate=None if d.get("inflate") is None else float(d["inflate"]),
            mirror=None if d.get("mirror") is None else bool(d["mirror"]),
            rotation=None if d.get("rotation") is None else _vec3(d["rotation"]),
            pivot=None if d.get("pivot") is None else _vec3(d["pivot"]),
        )


@dataclass
class Bone:
    name: str
    parent: str | None = None
    pivot: tuple[float, float, float] = (0.0, 0.0, 0.0)
    rotation: tuple[float, float, float] = (0.0, 0.0, 0.0)
    bind_pose_rotation: tuple[float, float, float] = (0.0, 0.0, 0.0)
    cubes: list[Cube] = field(default_factory=list)
    never_render: bool = False
    mirror: bool = False
    inflate: float = 0.0
    locators: dict = field(default_factory=dict)

    @property
    def key(self) -> str:
        return self.name.lower()


@dataclass
class Geometry:
    identifier: str
    texture_width: float = 64.0
    texture_height: float = 64.0
    bones: list[Bone] = field(default_factory=list)
    format_version: str = ""
    source: str = ""
    visible_bounds: tuple = ()
    warnings: list[str] = field(default_factory=list)

    def bone(self, name: str) -> Bone | None:
        n = name.lower()
        for b in self.bones:
            if b.key == n:
                return b
        return None

    def ordered_bones(self) -> list[Bone]:
        """Bones with every parent before its children (cycles broken)."""
        by_key = {b.key: b for b in self.bones}
        out: list[Bone] = []
        state: dict[str, int] = {}

        def visit(b: Bone, depth=0):
            s = state.get(b.key, 0)
            if s == 2:
                return
            if s == 1 or depth > 256:
                self.warnings.append(f"bone parent cycle at '{b.name}'")
                return
            state[b.key] = 1
            if b.parent and b.parent.lower() in by_key and b.parent.lower() != b.key:
                visit(by_key[b.parent.lower()], depth + 1)
            state[b.key] = 2
            out.append(b)

        for b in self.bones:
            visit(b)
        return out


def _normalise_legacy(gdef: dict) -> dict:
    return {
        "texture_width": gdef.get("texturewidth"),
        "texture_height": gdef.get("textureheight"),
        "visible_bounds": (gdef.get("visible_bounds_width"), gdef.get("visible_bounds_height"),
                           gdef.get("visible_bounds_offset")),
        "bones": copy.deepcopy(gdef.get("bones") or []),
    }


def _normalise_modern(gdef: dict) -> tuple[str, dict]:
    desc = gdef.get("description") or {}
    ident = desc.get("identifier", "geometry.unknown")
    return ident, {
        "texture_width": desc.get("texture_width"),
        "texture_height": desc.get("texture_height"),
        "visible_bounds": (desc.get("visible_bounds_width"), desc.get("visible_bounds_height"),
                           desc.get("visible_bounds_offset")),
        "bones": copy.deepcopy(gdef.get("bones") or []),
    }


def _merge_inherited(parent: dict, child: dict) -> dict:
    """Legacy 'geometry.child:geometry.parent' inheritance.

    Bones are merged by (case-insensitive) name: the child's fields override
    the parent's, cubes are APPENDED to the parent's cubes (sheep wool keeps
    the sheared body/face, witch nose keeps the villager nose) unless the
    child bone has "reset": true, which drops the inherited cubes (armor
    helmet geometry).  New bones are appended.  Unset top-level fields
    (texture size, bounds) are inherited."""
    out = copy.deepcopy(parent)
    for k in ("texture_width", "texture_height"):
        if child.get(k) is not None:
            out[k] = child[k]
    if any(v is not None for v in child.get("visible_bounds", ())):
        out["visible_bounds"] = child["visible_bounds"]
    index = {b.get("name", "").lower(): b for b in out["bones"]}
    for cb in child.get("bones", []):
        key = cb.get("name", "").lower()
        if key in index:
            pb = index[key]
            inherited_cubes = [] if cb.get("reset") else list(pb.get("cubes") or [])
            for k, v in cb.items():
                if k != "cubes":
                    pb[k] = copy.deepcopy(v)
            pb["cubes"] = inherited_cubes + copy.deepcopy(cb.get("cubes") or [])
        else:
            nb = copy.deepcopy(cb)
            out["bones"].append(nb)
            index[key] = nb
    return out


def _build_geometry(ident: str, norm: dict, fmt: str, source: str, warnings: list[str]) -> Geometry:
    geo = Geometry(identifier=ident, format_version=fmt, source=source)
    tw, th = norm.get("texture_width"), norm.get("texture_height")
    # Bedrock assumes 64x64 when the geometry does not say (sheep, snow golem
    # and villager legacy geometries rely on this with 64x64 textures).
    geo.texture_width = float(tw) if tw else 64.0
    geo.texture_height = float(th) if th else 64.0
    geo.visible_bounds = tuple(norm.get("visible_bounds") or ())
    geo.warnings = list(warnings)
    for bd in norm.get("bones", []):
        if not isinstance(bd, dict) or "name" not in bd:
            geo.warnings.append(f"{ident}: bone without name skipped")
            continue
        b = Bone(name=str(bd["name"]))
        b.parent = bd.get("parent")
        b.pivot = _vec3(bd.get("pivot"))
        b.rotation = _vec3(bd.get("rotation"))
        b.bind_pose_rotation = _vec3(bd.get("bind_pose_rotation"))
        b.never_render = bool(bd.get("neverRender", False))
        b.mirror = bool(bd.get("mirror", False))
        b.inflate = float(bd.get("inflate", 0.0) or 0.0)
        b.locators = bd.get("locators") or {}
        for cd in bd.get("cubes") or []:
            try:
                b.cubes.append(Cube.from_json(cd))
                if any(s < 0 for s in b.cubes[-1].size):
                    geo.warnings.append(f"{ident}/{b.name}: negative cube size {list(b.cubes[-1].size)} "
                                        "(rendered normalised; the game may render it inside-out)")
            except Exception as e:  # pragma: no cover - malformed input
                geo.warnings.append(f"{ident}/{b.name}: bad cube {cd!r}: {e}")
        for unsupported in ("poly_mesh", "texture_meshes"):
            if unsupported in bd:
                geo.warnings.append(f"{ident}/{b.name}: '{unsupported}' is not rendered")
        geo.bones.append(b)
    names = {b.key for b in geo.bones}
    for b in geo.bones:
        if b.parent and b.parent.lower() not in names:
            geo.warnings.append(f"{ident}/{b.name}: parent '{b.parent}' not found (treated as root)")
    return geo


class GeometryLibrary:
    """Collects raw geometry definitions from any number of files and
    resolves identifiers (with legacy inheritance) on demand."""

    def __init__(self):
        self.raw: dict[str, tuple[str | None, dict, str, str]] = {}   # id -> (parent_id, norm, fmt, src)
        self.order: list[str] = []
        self.file_ids: dict[str, list[str]] = {}
        self.warnings: list[str] = []
        self._cache: dict[str, Geometry] = {}

    def add_file(self, path: str) -> list[str]:
        data = load_json(path, warnings=self.warnings)
        return self.add_data(data, path)

    def add_data(self, data: dict, source: str = "<data>") -> list[str]:
        ids: list[str] = []
        if not isinstance(data, dict):
            return ids
        fmt = str(data.get("format_version", ""))
        for key, val in data.items():
            if key == "minecraft:geometry" and isinstance(val, list):
                for gdef in val:
                    if not isinstance(gdef, dict):
                        continue
                    ident, norm = _normalise_modern(gdef)
                    ids.append(self._register(ident, norm, fmt, source))
            elif key.startswith("geometry.") and isinstance(val, dict):
                ids.append(self._register(key, _normalise_legacy(val), fmt, source))
        self.file_ids[source] = ids
        self._cache.clear()
        return ids

    def add_dir(self, root: str) -> None:
        for p in sorted(glob.glob(os.path.join(root, "**", "*.json"), recursive=True)):
            try:
                self.add_file(p)
            except Exception as e:
                self.warnings.append(f"{p}: {e}")

    def _register(self, key: str, norm: dict, fmt: str, source: str) -> str:
        parent = None
        ident = key
        if ":" in key:
            ident, parent = key.split(":", 1)
        if ident in self.raw and self.raw[ident][3] != source:
            self.warnings.append(f"{ident}: redefined in {source} (was {self.raw[ident][3]})")
        self.raw[ident] = (parent, norm, fmt, source)
        if ident not in self.order:
            self.order.append(ident)
        return ident

    def ids(self) -> list[str]:
        return list(self.order)

    def _resolve_norm(self, ident: str, depth: int = 0) -> tuple[dict, list[str]]:
        if ident not in self.raw:
            raise KeyError(f"geometry '{ident}' not found (add its file with --lib)")
        parent, norm, fmt, src = self.raw[ident]
        if parent is None:
            return copy.deepcopy(norm), []
        if depth > 32:
            raise ValueError(f"geometry inheritance too deep at {ident}")
        if parent not in self.raw:
            return copy.deepcopy(norm), [f"{ident}: parent geometry '{parent}' not loaded (add it with --lib); rendering child bones only"]
        pnorm, w = self._resolve_norm(parent, depth + 1)
        return _merge_inherited(pnorm, norm), w

    def get(self, ident: str | None = None) -> Geometry:
        if ident is None:
            if not self.order:
                raise KeyError("no geometry loaded")
            ident = self.order[0]
        if ident not in self._cache:
            norm, w = self._resolve_norm(ident)
            _, _, fmt, src = self.raw[ident]
            self._cache[ident] = _build_geometry(ident, norm, fmt, src, w)
        return self._cache[ident]


def load_geometries(path: str, extra: Sequence[str] = ()) -> GeometryLibrary:
    """Load a geometry file (+ optional extra files/dirs for inheritance)."""
    lib = GeometryLibrary()
    for p in extra:
        if os.path.isdir(p):
            lib.add_dir(p)
        else:
            lib.add_file(p)
    lib.add_file(path)
    return lib


# ---------------------------------------------------------------------------
# Transforms
# ---------------------------------------------------------------------------

def geo_to_rs(p) -> np.ndarray:
    """Geometry-file point -> render space (Blockbench space): negate X."""
    return np.array([-float(p[0]), float(p[1]), float(p[2])])


def _rx(a):
    c, s = math.cos(a), math.sin(a)
    return np.array([[1, 0, 0], [0, c, -s], [0, s, c]], dtype=float)


def _ry(a):
    c, s = math.cos(a), math.sin(a)
    return np.array([[c, 0, s], [0, 1, 0], [-s, 0, c]], dtype=float)


def _rz(a):
    c, s = math.cos(a), math.sin(a)
    return np.array([[c, -s, 0], [s, c, 0], [0, 0, 1]], dtype=float)


def rot_rs(r) -> np.ndarray:
    """Bedrock rotation [rx, ry, rz] (degrees, file convention) -> 3x3
    right-handed rotation in render space.  X is applied first, then Y,
    then Z; X and Y angles are negated because render space mirrors X."""
    rx, ry, rz = (float(r[0]), float(r[1]), float(r[2]))
    return _rz(math.radians(rz)) @ _ry(math.radians(-ry)) @ _rx(math.radians(-rx))


def _T(t) -> np.ndarray:
    m = np.eye(4)
    m[:3, 3] = t
    return m


def _R4(r3) -> np.ndarray:
    m = np.eye(4)
    m[:3, :3] = r3
    return m


def _S(s) -> np.ndarray:
    return np.diag([float(s[0]), float(s[1]), float(s[2]), 1.0])


def _about(pivot_rs, m4) -> np.ndarray:
    return _T(pivot_rs) @ m4 @ _T(-pivot_rs)


@dataclass
class BoneState:
    rotation: list[float]
    position: list[float]
    scale: list[float]


Pose = dict  # bone key (lower-case) -> BoneState


def default_pose(geo: Geometry) -> Pose:
    return {b.key: BoneState(list(b.rotation), [0.0, 0.0, 0.0], [1.0, 1.0, 1.0]) for b in geo.bones}


def bone_matrices(geo: Geometry, pose: Pose | None = None) -> dict[str, np.ndarray]:
    """World (render space) 4x4 matrix of every bone for the given pose.

    local = T(pivot) . T(anim position) . R(rotation) . S(scale) . T(-pivot)
    world = world(parent) . local
    A bone's bind_pose_rotation is NOT part of this matrix (it is not
    inherited by child bones); it only rotates the bone's own cubes."""
    pose = pose or {}
    mats: dict[str, np.ndarray] = {}
    for b in geo.ordered_bones():
        st = pose.get(b.key)
        rot = st.rotation if st else b.rotation
        pos = st.position if st else (0.0, 0.0, 0.0)
        scl = st.scale if st else (1.0, 1.0, 1.0)
        p = geo_to_rs(b.pivot)
        local = _T(p) @ _T(geo_to_rs(pos)) @ _R4(rot_rs(rot)) @ _S(scl) @ _T(-p)
        parent = mats.get(b.parent.lower()) if b.parent else None
        mats[b.key] = (parent @ local) if parent is not None else local
    return mats


# ---------------------------------------------------------------------------
# UV layout
# ---------------------------------------------------------------------------

FACES = ("north", "east", "south", "west", "up", "down")
FACE_NORMAL_RS = {
    "east": (1.0, 0.0, 0.0), "west": (-1.0, 0.0, 0.0),
    "up": (0.0, 1.0, 0.0), "down": (0.0, -1.0, 0.0),
    "south": (0.0, 0.0, 1.0), "north": (0.0, 0.0, -1.0),
}
# Which side of the ENTITY each face name is on (front = -Z geo).
FACE_SIDE = {"north": "front", "south": "back", "east": "entity's right (-X geo)",
             "west": "entity's left (+X geo)", "up": "top", "down": "bottom"}


def _box_size(size) -> tuple[int, int, int]:
    eps = 1e-7
    return tuple(int(math.floor(abs(float(s)) + eps)) for s in size)  # type: ignore[return-value]


def box_uv_rects(size, uv_offset, mirror: bool = False) -> dict[str, tuple[float, float, float, float]]:
    """Box-UV rects per face as (u0, v0, u1, v1) in texels, where face corner
    (lx, ly) in [0,1]^2 samples (u0 + lx*(u1-u0), v0 + ly*(v1-v0)).
    Layout (w=size x, h=size y, d=size z, (u,v)=uv offset):

        row v..v+d     :            [ up  u+d..u+d+w ][ down u+d+w..u+d+2w ]
        row v+d..v+d+h : [east u..u+d][north u+d..u+d+w][west ..u+2d+w][south ..u+2d+2w]

    east = entity's right side, north = front.  Sizes are floored (Blockbench)."""
    sx, sy, sz = _box_size(size)
    fl = {
        "east": ([0, sz], [sz, sy]),
        "west": ([sz + sx, sz], [sz, sy]),
        "up": ([sz + sx, sz], [-sx, -sz]),
        "down": ([sz + 2 * sx, 0], [-sx, sz]),
        "south": ([2 * sz + sx, sz], [sx, sy]),
        "north": ([sz, sz], [sx, sy]),
    }
    if mirror:
        for k in fl:
            fr, sz_ = fl[k]
            fr[0] += sz_[0]
            sz_[0] = -sz_[0]
        fl["east"], fl["west"] = fl["west"], fl["east"]
    u, v = float(uv_offset[0]), float(uv_offset[1])
    return {k: (fr[0] + u, fr[1] + v, fr[0] + s[0] + u, fr[1] + s[1] + v) for k, (fr, s) in fl.items()}


def face_rects(cube: Cube, mirror: bool, warnings: list | None = None) -> dict[str, tuple[float, float, float, float]]:
    """UV rect of every drawn face of a cube (box UV or per-face UV)."""
    uv = cube.uv
    if uv is None:
        uv = [0, 0]
    if isinstance(uv, (list, tuple)):
        return box_uv_rects(cube.size, uv, mirror)
    out = {}
    sx, sy, sz = (abs(s) for s in cube.size)
    defaults = {"north": (sx, sy), "south": (sx, sy), "east": (sz, sy), "west": (sz, sy),
                "up": (sx, sz), "down": (sx, sz)}
    for face in FACES:
        fd = uv.get(face)
        if not isinstance(fd, dict) or "uv" not in fd:
            continue
        u, v = float(fd["uv"][0]), float(fd["uv"][1])
        su, sv = fd.get("uv_size", defaults[face])
        su, sv = float(su), float(sv)
        if "uv_rotation" in fd and warnings is not None:
            warnings.append("uv_rotation is not part of the 1.21.0 geometry schema; ignored")
        if face in ("up", "down"):
            # Bedrock up/down per-face UV is stored 180 degrees rotated
            # relative to the other faces (Blockbench codec swaps corners).
            out[face] = (u + su, v + sv, u, v)
        else:
            out[face] = (u, v, u + su, v + sv)
    return out


def _face_corners(face: str, f: np.ndarray, t: np.ndarray) -> np.ndarray:
    """4 corners (RS) of a face for (lx,ly) = (0,0),(1,0),(1,1),(0,1).
    Matches Blockbench CubeFace.UVToLocal."""
    pts = []
    for lx, ly in ((0, 0), (1, 0), (1, 1), (0, 1)):
        def L(a, b, s):
            return a + (b - a) * s
        if face == "east":
            p = (t[0], L(t[1], f[1], ly), L(t[2], f[2], lx))
        elif face == "west":
            p = (f[0], L(t[1], f[1], ly), L(f[2], t[2], lx))
        elif face == "up":
            p = (L(f[0], t[0], lx), t[1], L(f[2], t[2], ly))
        elif face == "down":
            p = (L(f[0], t[0], lx), f[1], L(t[2], f[2], ly))
        elif face == "south":
            p = (L(f[0], t[0], lx), L(t[1], f[1], ly), t[2])
        else:  # north
            p = (L(t[0], f[0], lx), L(t[1], f[1], ly), f[2])
        pts.append(p)
    return np.array(pts, dtype=float)


@dataclass
class Quad:
    verts: np.ndarray        # (4,3) render space
    uvs: np.ndarray          # (4,2) texels (geometry texture units)
    rect: tuple              # (umin, vmin, umax, vmax) texels for clamping
    normal: np.ndarray       # (3,) outward, render space
    face: str
    bone: str
    cube_index: int


def build_mesh(geo: Geometry, pose: Pose | None = None, hidden: Iterable[str] = (),
               warnings: list | None = None, scale: float = 1.0) -> list[Quad]:
    """Posed quads of every visible cube face (render space).  ``scale`` is
    the entity's overall scale (client entity scripts.scale, about the
    entity origin)."""
    hidden = {h.lower() for h in hidden}
    mats = bone_matrices(geo, pose)
    quads: list[Quad] = []
    for b in geo.ordered_bones():
        if b.never_render or b.key in hidden or not b.cubes:
            continue
        p = geo_to_rs(b.pivot)
        M_bone = mats[b.key] @ _about(p, _R4(rot_rs(b.bind_pose_rotation)))
        for ci, c in enumerate(b.cubes):
            inflate = c.inflate if c.inflate is not None else b.inflate
            mirror = c.mirror if c.mirror is not None else b.mirror
            o, s = c.origin, c.size
            f = np.array([-(o[0] + s[0]), o[1], o[2]], dtype=float)
            t = np.array([-o[0], o[1] + s[1], o[2] + s[2]], dtype=float)
            lo, hi = np.minimum(f, t), np.maximum(f, t)
            center = (lo + hi) / 2.0
            f, t = lo - inflate, hi + inflate
            M = M_bone
            if c.rotation is not None and any(abs(a) > 1e-9 for a in c.rotation):
                cp = geo_to_rs(c.pivot) if c.pivot is not None else center
                M = M @ _about(cp, _R4(rot_rs(c.rotation)))
            M3 = M[:3, :3]
            det = np.linalg.det(M3)
            if abs(det) < 1e-12:
                continue  # zero scale -> invisible
            nmat = np.linalg.inv(M3).T
            rects = face_rects(c, mirror, warnings)
            for face, rect in rects.items():
                u0, v0, u1, v1 = rect
                if abs(u1 - u0) < 1e-9 or abs(v1 - v0) < 1e-9:
                    continue
                corners = _face_corners(face, f, t)
                e1 = corners[1] - corners[0]
                e2 = corners[3] - corners[0]
                if np.linalg.norm(np.cross(e1, e2)) < 1e-12:
                    continue  # zero-area face
                world = ((M[:3, :3] @ corners.T).T + M[:3, 3]) * scale
                n = nmat @ np.array(FACE_NORMAL_RS[face])
                n = n / (np.linalg.norm(n) or 1.0)
                uvs = np.array([[u0, v0], [u1, v0], [u1, v1], [u0, v1]], dtype=float)
                quads.append(Quad(world, uvs, (min(u0, u1), min(v0, v1), max(u0, u1), max(v0, v1)),
                                  n, face, b.name, ci))
    return quads


# ---------------------------------------------------------------------------
# Molang
# ---------------------------------------------------------------------------

class MolangError(Exception):
    pass


_TOKEN_RE = re.compile(r"""
  (?P<ws>\s+)
| (?P<num>(?:\d+\.\d*|\.\d+|\d+)(?:[eE][+-]?\d+)?[fF]?)
| (?P<str>'[^']*')
| (?P<name>[A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)*)
| (?P<op>\?\?|->|==|!=|<=|>=|&&|\|\||[-+*/!<>?:(),;=\[\]{}])
""", re.X)

_BINARY_BP = {
    "??": 1, "||": 3, "&&": 4, "==": 5, "!=": 5,
    "<": 6, "<=": 6, ">": 6, ">=": 6, "+": 7, "-": 7, "*": 8, "/": 8,
}


def _tokenize(src: str) -> list[tuple[str, str]]:
    toks = []
    pos = 0
    while pos < len(src):
        m = _TOKEN_RE.match(src, pos)
        if not m:
            raise MolangError(f"unexpected character {src[pos]!r} at {pos} in {src!r}")
        pos = m.end()
        kind = m.lastgroup
        if kind == "ws":
            continue
        text = m.group(kind)
        if kind == "num":
            text = text.rstrip("fF")
        elif kind == "name":
            text = text.lower()
        toks.append((kind, text))
    toks.append(("eof", ""))
    return toks


class _Parser:
    def __init__(self, src: str):
        self.src = src
        self.toks = _tokenize(src)
        self.i = 0

    def peek(self, k=0):
        return self.toks[min(self.i + k, len(self.toks) - 1)]

    def next(self):
        t = self.toks[self.i]
        self.i += 1
        return t

    def expect(self, op):
        t = self.next()
        if t[1] != op or t[0] not in ("op",):
            raise MolangError(f"expected {op!r}, got {t[1]!r} in {self.src!r}")
        return t

    # program := statement (';' statement)* [';']
    def program(self):
        stmts = []
        complex_ = False
        while self.peek()[0] != "eof":
            if self.peek() == ("op", ";"):
                self.next()
                complex_ = True
                continue
            stmts.append(self.statement())
            if self.peek() == ("op", ";"):
                self.next()
                complex_ = True
            elif self.peek()[0] != "eof":
                raise MolangError(f"unexpected {self.peek()[1]!r} in {self.src!r}")
        if not complex_ and len(stmts) == 1 and stmts[0][0] not in ("assign", "return"):
            return ("simple", stmts[0])
        return ("complex", stmts)

    def block(self):
        self.expect("{")
        stmts = []
        while self.peek() != ("op", "}"):
            if self.peek()[0] == "eof":
                raise MolangError(f"unterminated '{{' in {self.src!r}")
            if self.peek() == ("op", ";"):
                self.next()
                continue
            stmts.append(self.statement())
            if self.peek() == ("op", ";"):
                self.next()
        self.expect("}")
        return ("block", stmts)

    def statement(self):
        t = self.peek()
        if t == ("name", "return"):
            self.next()
            return ("return", self.expr(0))
        if t == ("name", "break"):
            self.next()
            return ("break",)
        if t == ("name", "continue"):
            self.next()
            return ("continue",)
        if t[0] == "name" and self.peek(1) == ("op", "="):
            self.next()
            self.next()
            return ("assign", t[1], self.expr(0))
        return self.expr(0)

    def expr(self, min_bp: int):
        lhs = self.prefix()
        while True:
            kind, op = self.peek()
            if kind != "op":
                break
            if op == "?":
                if 2 < min_bp:
                    break
                self.next()
                a = self.expr(2)
                if self.peek() == ("op", ":"):
                    self.next()
                    b = self.expr(2)   # right associative
                    lhs = ("tern", lhs, a, b)
                else:
                    lhs = ("cond", lhs, a)
                continue
            bp = _BINARY_BP.get(op)
            if bp is None or bp < min_bp:
                break
            self.next()
            rhs = self.expr(bp + 1)
            lhs = ("bin", op, lhs, rhs)
        return lhs

    def prefix(self):
        kind, text = self.next()
        if kind == "num":
            node = ("num", float(text))
        elif kind == "str":
            node = ("str", text[1:-1])
        elif kind == "op" and text == "(":
            node = self.expr(0)
            self.expect(")")
        elif kind == "op" and text in ("-", "!", "+"):
            operand = self.expr(9)
            node = ("un", text, operand)
        elif kind == "op" and text == "{":
            self.i -= 1
            node = self.block()
        elif kind == "name":
            if self.peek() == ("op", "("):
                self.next()
                args = []
                if self.peek() != ("op", ")"):
                    while True:
                        if self.peek() == ("op", "{"):
                            args.append(self.block())
                        else:
                            args.append(self.expr(0))
                        if self.peek() == ("op", ","):
                            self.next()
                            continue
                        break
                self.expect(")")
                node = ("call", text, args)
            else:
                node = ("var", text)
        else:
            raise MolangError(f"unexpected token {text!r} in {self.src!r}")
        # postfix: indexing and arrow
        while True:
            if self.peek() == ("op", "["):
                self.next()
                idx = self.expr(0)
                self.expect("]")
                node = ("index", node, idx)
            elif self.peek() == ("op", "->"):
                self.next()
                rhs = self.prefix()
                node = ("arrow", node, rhs)
            else:
                break
        return node


class _Return(Exception):
    def __init__(self, value):
        self.value = value


class _Break(Exception):
    pass


class _Continue(Exception):
    pass


_PREFIX_ALIASES = {"q": "query", "v": "variable", "t": "temp", "c": "context"}


def _split_name(name: str) -> tuple[str, str]:
    if "." in name:
        head, rest = name.split(".", 1)
        return _PREFIX_ALIASES.get(head, head), rest
    return "", name


def _num(x) -> float:
    if isinstance(x, bool):
        return 1.0 if x else 0.0
    if isinstance(x, (int, float)):
        return float(x)
    return 0.0


def _truthy(x) -> bool:
    if isinstance(x, str):
        return x != ""
    if isinstance(x, (list, tuple)):
        return len(x) > 0
    return _num(x) != 0.0


@dataclass
class MolangContext:
    """Evaluation context.  Unknown queries/variables evaluate to 0 and are
    recorded in ``missing`` so callers can report them."""
    queries: dict = field(default_factory=dict)      # name (no prefix) -> float | callable(*args)
    variables: dict = field(default_factory=dict)    # name -> value (read/write)
    context: dict = field(default_factory=dict)      # name -> value (read only)
    bare: dict = field(default_factory=dict)         # bare identifiers, e.g. {'t': time}
    arrays: dict = field(default_factory=dict)       # 'array.name' -> list
    refs: dict = field(default_factory=dict)         # 'texture.default' -> resolved value (optional)
    this: float = 0.0
    rng: random.Random = field(default_factory=lambda: random.Random(1234))
    missing: set = field(default_factory=set)
    temps: dict = field(default_factory=dict)


def _math_call(fn: str, a: list, ctx: MolangContext):
    d = math.degrees
    r = math.radians
    try:
        if fn == "abs":
            return abs(a[0])
        if fn == "sin":
            return math.sin(r(a[0]))
        if fn == "cos":
            return math.cos(r(a[0]))
        if fn == "acos":
            return d(math.acos(max(-1.0, min(1.0, a[0]))))
        if fn == "asin":
            return d(math.asin(max(-1.0, min(1.0, a[0]))))
        if fn == "atan":
            return d(math.atan(a[0]))
        if fn == "atan2":
            return d(math.atan2(a[0], a[1]))
        if fn == "ceil":
            return float(math.ceil(a[0]))
        if fn == "floor":
            return float(math.floor(a[0]))
        if fn == "round":
            return float(math.floor(a[0] + 0.5))
        if fn == "trunc":
            return float(math.trunc(a[0]))
        if fn == "clamp":
            return min(max(a[0], a[1]), a[2])
        if fn == "lerp":
            return a[0] + (a[1] - a[0]) * a[2]
        if fn == "lerprotate":
            diff = ((a[1] - a[0] + 180.0) % 360.0) - 180.0
            return a[0] + diff * a[2]
        if fn == "hermite_blend":
            return 3 * a[0] ** 2 - 2 * a[0] ** 3
        if fn == "min":
            return min(a[0], a[1])
        if fn == "max":
            return max(a[0], a[1])
        if fn == "min_angle":
            return ((a[0] + 180.0) % 360.0) - 180.0
        if fn == "mod":
            return math.fmod(a[0], a[1]) if a[1] != 0 else 0.0
        if fn == "pow":
            return math.pow(a[0], a[1])
        if fn == "sqrt":
            return math.sqrt(a[0]) if a[0] >= 0 else 0.0
        if fn == "exp":
            return math.exp(a[0])
        if fn == "ln":
            return math.log(a[0]) if a[0] > 0 else 0.0
        if fn == "random":
            return ctx.rng.uniform(a[0], a[1])
        if fn == "random_integer":
            return float(ctx.rng.randint(int(math.floor(a[0])), int(math.floor(a[1]))))
        if fn == "die_roll":
            return sum(ctx.rng.uniform(a[1], a[2]) for _ in range(int(a[0])))
        if fn == "die_roll_integer":
            return float(sum(ctx.rng.randint(int(a[1]), int(a[2])) for _ in range(int(a[0]))))
    except (ValueError, OverflowError, IndexError, ZeroDivisionError):
        return 0.0
    ctx.missing.add("math." + fn)
    return 0.0


def _eval(node, ctx: MolangContext):
    k = node[0]
    if k == "num":
        return node[1]
    if k == "str":
        return node[1]
    if k == "var":
        return _lookup(node[1], ctx)
    if k == "bin":
        op = node[1]
        if op == "&&":
            return 1.0 if (_truthy(_eval(node[2], ctx)) and _truthy(_eval(node[3], ctx))) else 0.0
        if op == "||":
            return 1.0 if (_truthy(_eval(node[2], ctx)) or _truthy(_eval(node[3], ctx))) else 0.0
        if op == "??":
            a = _eval(node[2], ctx)
            if a is None or (isinstance(node[2], tuple) and node[2][0] == "var" and _is_missing(node[2][1], ctx)):
                return _eval(node[3], ctx)
            return a
        a = _eval(node[2], ctx)
        b = _eval(node[3], ctx)
        if op in ("==", "!="):
            if isinstance(a, str) or isinstance(b, str):
                eq = (a == b)
            else:
                eq = abs(_num(a) - _num(b)) < 1e-9
            return 1.0 if (eq if op == "==" else not eq) else 0.0
        a, b = _num(a), _num(b)
        if op == "+":
            return a + b
        if op == "-":
            return a - b
        if op == "*":
            return a * b
        if op == "/":
            return a / b if b != 0 else 0.0
        if op == "<":
            return 1.0 if a < b else 0.0
        if op == "<=":
            return 1.0 if a <= b else 0.0
        if op == ">":
            return 1.0 if a > b else 0.0
        if op == ">=":
            return 1.0 if a >= b else 0.0
        raise MolangError(op)
    if k == "un":
        v = _eval(node[2], ctx)
        if node[1] == "-":
            return -_num(v)
        if node[1] == "+":
            return _num(v)
        return 0.0 if _truthy(v) else 1.0
    if k == "tern":
        return _eval(node[2], ctx) if _truthy(_eval(node[1], ctx)) else _eval(node[3], ctx)
    if k == "cond":
        if _truthy(_eval(node[1], ctx)):
            return _eval(node[2], ctx)
        return 0.0
    if k == "call":
        return _call(node[1], node[2], ctx)
    if k == "index":
        arr = _eval(node[1], ctx)
        idx = _num(_eval(node[2], ctx))
        if isinstance(arr, (list, tuple)) and arr:
            i = max(0, int(idx))  # C-style cast, clamp negative to 0, wrap large
            v = arr[i % len(arr)]
            if isinstance(v, tuple) and v and v[0] in ("simple", "complex"):
                return _run(v, ctx)
            return v
        return 0.0
    if k == "arrow":
        ctx.missing.add("-> operator")
        return 0.0
    if k == "block":
        for st in node[1]:
            _exec(st, ctx)
        return 0.0
    if k == "assign":
        _assign(node[1], _eval(node[2], ctx), ctx)
        return 0.0
    if k == "return":
        raise _Return(_eval(node[1], ctx))
    if k == "break":
        raise _Break()
    if k == "continue":
        raise _Continue()
    raise MolangError(f"bad node {k}")


def _exec(st, ctx):
    _eval(st, ctx)


def _is_missing(name: str, ctx: MolangContext) -> bool:
    scope, rest = _split_name(name)
    if scope == "variable":
        return rest not in ctx.variables
    if scope == "temp":
        return rest not in ctx.temps
    if scope == "query":
        return rest not in ctx.queries
    if scope == "context":
        return rest not in ctx.context
    return False


def _lookup(name: str, ctx: MolangContext):
    if name == "this":
        return ctx.this
    scope, rest = _split_name(name)
    if scope == "math":
        if rest == "pi":
            return math.pi
        ctx.missing.add(name)
        return 0.0
    if scope == "query":
        v = ctx.queries.get(rest)
        if v is None:
            ctx.missing.add("query." + rest)
            return 0.0
        return v() if callable(v) else v
    if scope == "variable":
        if rest in ctx.variables:
            return ctx.variables[rest]
        ctx.missing.add("variable." + rest)
        return 0.0
    if scope == "temp":
        return ctx.temps.get(rest, 0.0)
    if scope == "context":
        if rest in ctx.context:
            return ctx.context[rest]
        ctx.missing.add("context." + rest)
        return 0.0
    if scope in ("geometry", "texture", "material"):
        return ctx.refs.get(name, name)
    if scope == "array":
        return ctx.arrays.get(name, [])
    if scope == "":
        if rest in ctx.bare:
            return ctx.bare[rest]
        ctx.missing.add(rest)
        return 0.0
    ctx.missing.add(name)
    return 0.0


def _assign(name: str, value, ctx: MolangContext):
    scope, rest = _split_name(name)
    if scope == "variable":
        ctx.variables[rest] = value
    elif scope == "temp":
        ctx.temps[rest] = value
    else:
        ctx.missing.add(f"assignment to {name}")


def _call(name: str, args: list, ctx: MolangContext):
    scope, rest = _split_name(name)
    if scope == "math":
        vals = [_num(_eval(a, ctx)) for a in args]
        return _math_call(rest, vals, ctx)
    if name == "loop" and len(args) == 2:
        n = int(max(0, min(1024, _num(_eval(args[0], ctx)))))
        for _ in range(n):
            try:
                _eval(args[1], ctx)
            except _Break:
                break
            except _Continue:
                continue
        return 0.0
    if name == "for_each":
        ctx.missing.add("for_each")
        return 0.0
    if scope == "query":
        v = ctx.queries.get(rest)
        if v is None:
            ctx.missing.add("query." + rest)
            return 0.0
        if callable(v):
            return v(*[_eval(a, ctx) for a in args])
        return v
    ctx.missing.add(name + "()")
    return 0.0


def _run(prog, ctx: MolangContext):
    kind, body = prog
    if kind == "simple":
        try:
            return _eval(body, ctx)
        except _Return as r:
            return r.value
    try:
        for st in body:
            _exec(st, ctx)
    except _Return as r:
        return r.value
    except (_Break, _Continue):
        pass
    return 0.0


class Molang:
    """Compile-once Molang expression.  ``Molang("math.cos(q.anim_time*38)*80")``."""
    _cache: dict[str, Any] = {}

    def __init__(self, src):
        self.src = src
        if isinstance(src, (int, float)) and not isinstance(src, bool):
            self.const = float(src)
            self.prog = None
        else:
            s = str(src).strip()
            self.const = None
            if s == "":
                self.const = 0.0
                self.prog = None
            else:
                prog = Molang._cache.get(s)
                if prog is None:
                    prog = _Parser(s).program()
                    Molang._cache[s] = prog
                self.prog = prog
                if prog[0] == "simple" and prog[1][0] == "num":
                    self.const = prog[1][1]

    def eval(self, ctx: MolangContext | None = None, this: float | None = None):
        if self.const is not None:
            return self.const
        ctx = ctx or MolangContext()
        if this is not None:
            ctx.this = this
        ctx.temps = {}
        try:
            return _run(self.prog, ctx)
        except (_Break, _Continue):
            return 0.0
        except RecursionError:
            return 0.0

    def __repr__(self):
        return f"Molang({self.src!r})"


def molang_eval(src, ctx: MolangContext | None = None, **queries) -> float:
    """Convenience: evaluate an expression, optional query values as kwargs."""
    ctx = ctx or MolangContext()
    ctx.queries.update(queries)
    v = Molang(src).eval(ctx)
    return v


# ---------------------------------------------------------------------------
# Animations
# ---------------------------------------------------------------------------

def _triple(value) -> list[Molang]:
    """Channel value -> 3 compiled expressions (number/string/list forms).
    The rare vanilla form [{"y": e1}, {"x": e2}, {"y": e3}] (ordered single
    axis rotations, animation.squid.rotate) is approximated by summing the
    expressions per axis."""
    if isinstance(value, (list, tuple)) and value and all(isinstance(v, dict) for v in value):
        per = {"x": [], "y": [], "z": []}
        for item in value:
            for ax, e in item.items():
                if ax in per:
                    per[ax].append(f"({e})")
        return [Molang(" + ".join(per[ax]) if per[ax] else 0.0) for ax in "xyz"]
    if isinstance(value, (list, tuple)):
        if len(value) == 1:
            m = Molang(value[0])
            return [m, m, m]
        vals = list(value) + [0] * (3 - len(value))
        return [Molang(v) for v in vals[:3]]
    m = Molang(value)
    return [m, m, m]


@dataclass
class Keyframe:
    time: float
    pre: list[Molang]
    post: list[Molang]
    lerp: str = "linear"


@dataclass
class Channel:
    static: list[Molang] | None = None
    keyframes: list[Keyframe] | None = None

    @staticmethod
    def parse(value) -> "Channel":
        if isinstance(value, dict) and value and all(_is_number_string(k) for k in value):
            kfs = []
            for k, v in value.items():
                t = float(k)
                if isinstance(v, dict) and ("pre" in v or "post" in v or "lerp_mode" in v):
                    post = v.get("post", v.get("pre", 0))
                    pre = v.get("pre", post)
                    kfs.append(Keyframe(t, _triple(pre), _triple(post), str(v.get("lerp_mode", "linear"))))
                elif isinstance(v, dict) and "vector" in v:   # very old 1.8 beta form
                    tr = _triple(v["vector"])
                    kfs.append(Keyframe(t, tr, tr))
                else:
                    tr = _triple(v)
                    kfs.append(Keyframe(t, tr, tr))
            kfs.sort(key=lambda k: k.time)
            return Channel(keyframes=kfs)
        if isinstance(value, dict) and "vector" in value:
            return Channel(static=_triple(value["vector"]))
        return Channel(static=_triple(value))

    def length(self) -> float:
        return self.keyframes[-1].time if self.keyframes else 0.0

    def sample(self, t: float, ctx: MolangContext, current: Sequence[float]) -> list[float]:
        def ev(ms: list[Molang]) -> list[float]:
            return [_num(m.eval(ctx, this=current[i])) for i, m in enumerate(ms)]
        if self.static is not None:
            return ev(self.static)
        kfs = self.keyframes or []
        if not kfs:
            return [0.0, 0.0, 0.0]
        if t <= kfs[0].time:
            return ev(kfs[0].pre if t < kfs[0].time else kfs[0].post)
        if t >= kfs[-1].time:
            return ev(kfs[-1].post)
        for i in range(len(kfs) - 1):
            a, b = kfs[i], kfs[i + 1]
            if a.time <= t < b.time:
                break
        span = b.time - a.time
        alpha = 0.0 if span <= 0 else (t - a.time) / span
        va = ev(a.post)
        vb = ev(b.pre)
        if a.lerp == "catmullrom" or b.lerp == "catmullrom":
            p0 = ev(kfs[i - 1].post) if i > 0 else va
            p3 = ev(kfs[i + 2].pre) if i + 2 < len(kfs) else vb
            a2, a3 = alpha * alpha, alpha * alpha * alpha
            return [0.5 * ((2 * va[j]) + (-p0[j] + vb[j]) * alpha
                           + (2 * p0[j] - 5 * va[j] + 4 * vb[j] - p3[j]) * a2
                           + (-p0[j] + 3 * va[j] - 3 * vb[j] + p3[j]) * a3) for j in range(3)]
        return [va[j] + (vb[j] - va[j]) * alpha for j in range(3)]


def _is_number_string(k) -> bool:
    try:
        float(k)
        return True
    except (TypeError, ValueError):
        return False


@dataclass
class Animation:
    name: str
    loop: Any = False                       # True / False / "hold_on_last_frame"
    length: float = 0.0
    anim_time_update: Molang | None = None
    blend_weight: Molang | None = None
    override_previous: bool = False
    bones: dict = field(default_factory=dict)   # bone key -> {channel: Channel}
    source: str = ""

    @staticmethod
    def parse(name: str, d: dict, source: str = "") -> "Animation":
        a = Animation(name=name, source=source)
        a.loop = d.get("loop", False)
        if a.loop == "true":
            a.loop = True
        if d.get("anim_time_update") is not None:
            a.anim_time_update = Molang(d["anim_time_update"])
        if d.get("blend_weight") is not None:
            a.blend_weight = Molang(d["blend_weight"])
        a.override_previous = bool(d.get("override_previous_animation", False))
        longest = 0.0
        for bname, bdata in (d.get("bones") or {}).items():
            chans = {}
            if not isinstance(bdata, dict):
                continue
            for ch in ("rotation", "position", "scale"):
                if ch in bdata:
                    chans[ch] = Channel.parse(bdata[ch])
                    longest = max(longest, chans[ch].length())
            a.bones[bname.lower()] = chans
        a.length = float(d["animation_length"]) if d.get("animation_length") is not None else longest
        return a

    def local_time(self, anim_time: float) -> float:
        if self.length > 0:
            if self.loop is True:
                return anim_time % self.length if anim_time >= 0 else anim_time
            return min(anim_time, self.length)
        return anim_time


class AnimationLibrary:
    def __init__(self):
        self.anims: dict[str, Animation] = {}
        self.controllers: dict[str, dict] = {}
        self.warnings: list[str] = []

    def add_file(self, path: str) -> list[str]:
        data = load_json(path, warnings=self.warnings)
        names = []
        for name, adef in (data.get("animations") or {}).items():
            try:
                self.anims[name] = Animation.parse(name, adef, path)
                names.append(name)
            except MolangError as e:
                self.warnings.append(f"{path}: {name}: {e}")
        for name, cdef in (data.get("animation_controllers") or {}).items():
            self.controllers[name] = cdef
            names.append(name)
        return names

    def add_dir(self, root: str) -> None:
        for p in sorted(glob.glob(os.path.join(root, "**", "*.json"), recursive=True)):
            try:
                self.add_file(p)
            except Exception as e:
                self.warnings.append(f"{p}: {e}")

    def get(self, name: str) -> Animation:
        if name not in self.anims:
            raise KeyError(f"animation '{name}' not loaded")
        return self.anims[name]


def load_animations(*paths: str) -> AnimationLibrary:
    lib = AnimationLibrary()
    for p in paths:
        if os.path.isdir(p):
            lib.add_dir(p)
        else:
            lib.add_file(p)
    return lib


@dataclass
class Play:
    """One animation to apply.  ``weight`` may be a number or a Molang string
    (evaluated with the frame context, like an animate-list condition)."""
    animation: Animation
    weight: Any = 1.0
    time_offset: float = 0.0


class Value:
    """Wraps an already-evaluated value so it is not re-parsed as Molang."""
    __slots__ = ("value",)

    def __init__(self, value):
        self.value = value

    def __repr__(self):
        return f"Value({self.value!r})"


DEFAULT_QUERIES = {
    "modified_distance_moved": 0.0, "modified_move_speed": 0.0, "is_baby": 0.0,
    "is_on_ground": 1.0, "is_alive": 1.0, "health": 20.0, "max_health": 20.0,
    "target_x_rotation": 0.0, "target_y_rotation": 0.0, "ground_speed": 0.0,
    "walk_distance": 0.0, "delta_time": 1.0 / 20.0, "is_moving": 0.0,
}


def _norm_query_key(k: str) -> str:
    k = k.strip().lower()
    for p in ("query.", "q."):
        if k.startswith(p):
            return k[len(p):]
    return k


def _norm_var_key(k: str) -> str:
    k = k.strip().lower()
    for p in ("variable.", "v."):
        if k.startswith(p):
            return k[len(p):]
    return k


def frame_context(time: float, queries: dict | None = None, variables: dict | None = None,
                  context: dict | None = None) -> MolangContext:
    """Context for frame time ``time``.  Query/variable override values may be
    numbers or Molang strings in which the bare identifiers ``t``/``time``
    mean the frame time, e.g. {"modified_distance_moved": "t*4"}."""
    ctx = MolangContext()
    ctx.bare = {"t": float(time), "time": float(time)}
    ctx.queries.update(DEFAULT_QUERIES)
    ctx.queries["life_time"] = float(time)
    ctx.queries["anim_time"] = float(time)
    for k, v in (queries or {}).items():
        ctx.queries[_norm_query_key(k)] = _num(Molang(v).eval(ctx)) if not callable(v) else v
    for k, v in (variables or {}).items():
        if isinstance(v, Value):
            val = v.value
        elif isinstance(v, (list, tuple, bool)):
            val = v
        else:
            val = Molang(v).eval(ctx)
        ctx.variables[_norm_var_key(k)] = val
    ctx.context.update(context or {})
    return ctx


def _anim_time(anim: Animation, time: float, queries, variables, context) -> float:
    if anim.anim_time_update is None:
        return time
    src = str(anim.anim_time_update.src).lower()
    if "anim_time" in src:
        # simulate the per-frame update  anim_time = f(anim_time)
        dt = 1.0 / 60.0
        steps = int(round(max(0.0, time) / dt))
        a = 0.0
        for i in range(1, steps + 1):
            ctx = frame_context(i * dt, queries, variables, context)
            ctx.queries["delta_time"] = dt
            ctx.queries["anim_time"] = a
            a = _num(anim.anim_time_update.eval(ctx))
        return a
    ctx = frame_context(time, queries, variables, context)
    return _num(anim.anim_time_update.eval(ctx))


# What Molang `this` starts at for a POSITION channel.  "pivot" (default):
# the bone's pivot minus its parent's pivot, root bones relative to
# (0, 24, 0) - i.e. the Java-style joint offset.  Derived from vanilla data,
# where e.g. animation.ocelot_v1.0.setup / animation.wolf.setup /
# animation.sheep.setup write "<pivot-24> - this" (no-op in the default
# pose) and animation.guardian.spikes(.v1.0) differ by exactly the parent
# pivot difference between geometry.guardian.v1.8 and geometry.guardian.
# "zero": `this` = 0 (accumulated offset only).
POSITION_THIS_MODE = "pivot"


def position_this_base(geo: Geometry | None, mode: str | None = None) -> dict[str, list[float]]:
    mode = mode or POSITION_THIS_MODE
    out: dict[str, list[float]] = {}
    if geo is None or mode == "zero":
        return out
    keys = {b.key: b for b in geo.bones}
    for b in geo.bones:
        par = keys.get(b.parent.lower()) if b.parent else None
        pp = par.pivot if par is not None else (0.0, 24.0, 0.0)
        out[b.key] = [b.pivot[0] - pp[0], b.pivot[1] - pp[1], b.pivot[2] - pp[2]]
    return out


def compute_pose(geo: Geometry | None, plays: Sequence[Play], time: float = 0.0,
                 queries: dict | None = None, variables: dict | None = None,
                 context: dict | None = None, missing: set | None = None,
                 base: Pose | None = None, position_this: str | None = None) -> Pose:
    """Apply animations additively, in order, on top of the geometry default
    pose (Bedrock: the skeleton is reset to the geometry pose each frame and
    channels are added per axis; scale multiplies).  Bones named by an
    animation but absent from ``geo`` are still returned (so overlay layers
    with the same bone names receive them).  Molang ``this`` is the
    channel's current value: rotation starts at the bone's geometry
    "rotation", scale at 1, position at ``position_this_base`` (see
    POSITION_THIS_MODE) while the applied translation is only the sum of
    the animation values."""
    pose: Pose = copy.deepcopy(base) if base is not None else (default_pose(geo) if geo else {})
    defaults = default_pose(geo) if geo else {}
    pbase = position_this_base(geo, position_this)
    for play in plays:
        anim = play.animation
        at = _anim_time(anim, time + play.time_offset, queries, variables, context)
        ctx = frame_context(time + play.time_offset, queries, variables, context)
        ctx.queries["anim_time"] = anim.local_time(at)
        ctx.queries["anim_length"] = anim.length
        w = play.weight
        weight = _num(Molang(w).eval(ctx)) if isinstance(w, str) else float(w)
        if anim.blend_weight is not None:
            weight *= _num(anim.blend_weight.eval(ctx))
        if weight == 0.0:
            if missing is not None:
                missing |= ctx.missing
            continue
        lt = ctx.queries["anim_time"]
        for bkey, chans in anim.bones.items():
            if bkey not in pose:
                pose[bkey] = BoneState([0.0, 0.0, 0.0], [0.0, 0.0, 0.0], [1.0, 1.0, 1.0])
            st = pose[bkey]
            if anim.override_previous:
                d = defaults.get(bkey) or BoneState([0.0] * 3, [0.0] * 3, [1.0] * 3)
                st.rotation, st.position, st.scale = list(d.rotation), [0.0] * 3, [1.0] * 3
            if "rotation" in chans:
                v = chans["rotation"].sample(lt, ctx, st.rotation)
                st.rotation = [st.rotation[i] + v[i] * weight for i in range(3)]
            if "position" in chans:
                pb = pbase.get(bkey, (0.0, 0.0, 0.0))
                v = chans["position"].sample(lt, ctx, [pb[i] + st.position[i] for i in range(3)])
                st.position = [st.position[i] + v[i] * weight for i in range(3)]
            if "scale" in chans:
                v = chans["scale"].sample(lt, ctx, st.scale)
                st.scale = [st.scale[i] * (1.0 + (v[i] - 1.0) * weight) for i in range(3)]
        if missing is not None:
            missing |= ctx.missing
    return pose


# ---------------------------------------------------------------------------
# Textures and layers
# ---------------------------------------------------------------------------

TEXTURE_EXTS = ("", ".png", ".tga", ".jpg", ".jpeg")


def find_texture(path: str, roots: Sequence[str] = ()) -> str | None:
    cands = [path] + [os.path.join(r, path) for r in roots]
    for c in cands:
        for ext in TEXTURE_EXTS:
            p = c + ext
            if os.path.isfile(p):
                return p
    return None


def load_texture(path: str | None, roots: Sequence[str] = ()) -> np.ndarray | None:
    """Load a texture as an (H, W, 4) uint8 RGBA array.  ``path`` may omit the
    extension (as client entity files do); ``roots`` are extra search dirs."""
    if path is None:
        return None
    p = find_texture(path, roots)
    if p is None:
        raise FileNotFoundError(f"texture '{path}' not found (roots: {list(roots)})")
    im = Image.open(p).convert("RGBA")
    return np.asarray(im, dtype=np.uint8).copy()


def composite_textures(textures: Sequence[np.ndarray]) -> np.ndarray:
    """Alpha-over composite of several textures (multi-texture materials such
    as villager_v2_masked) resized to the first one's resolution."""
    base = textures[0].astype(np.float32) / 255.0
    h, w = base.shape[:2]
    for t in textures[1:]:
        if t.shape[:2] != (h, w):
            t = np.asarray(Image.fromarray(t).resize((w, h), Image.NEAREST))
        src = t.astype(np.float32) / 255.0
        a = src[..., 3:4]
        base[..., :3] = src[..., :3] * a + base[..., :3] * (1 - a)
        base[..., 3:4] = a + base[..., 3:4] * (1 - a)
    return (np.clip(base, 0, 1) * 255 + 0.5).astype(np.uint8)


FACE_DEBUG_COLORS = {
    "north": (230, 60, 60), "south": (60, 90, 230), "east": (60, 200, 60),
    "west": (240, 220, 50), "up": (245, 245, 245), "down": (200, 60, 220),
}


@dataclass
class Layer:
    """One render pass: a geometry with its texture and material-like flags.

    material       (flag 'material=NAME') apply a preset from MATERIAL_PRESETS,
                   e.g. entity, entity_alphatest, entity_emissive_alpha
    alpha_test     discard texels with alpha < 0.5 (entity_alphatest; default)
    emissive_alpha texture alpha is an emissive mask: everything is opaque,
                   low alpha = full-bright (vanilla 'spider' /
                   entity_emissive_alpha style materials)
    two_sided      draw back faces too (materials with DisableCulling, e.g.
                   entity_alphatest; vanilla chicken legs need it)
    blend          alpha-blend instead of alpha-test (no depth write)
    colormask      texture alpha is a tint mask, everything opaque: colour =
                   rgb * lerp(1, tint, alpha) (vanilla 'sheep' /
                   entity_change_color: wool alpha 255 is tinted, face alpha 3 not)
    tint           RGBA multiplier (or the colormask colour)
    face_colors    ignore texture, colour faces by name (debug)
    bone_flags     {bone name: {flag: value}} per-bone overrides of the flags
                   above (render-controller "materials" bone patterns)"""
    geometry: Geometry
    texture: np.ndarray | None = None
    alpha_test: bool = True       # defaults = entity_alphatest (alpha test, no culling)
    emissive_alpha: bool = False
    two_sided: bool = True
    blend: bool = False
    colormask: bool = False
    tint: tuple = (1.0, 1.0, 1.0, 1.0)
    hidden_bones: Sequence[str] = ()
    face_colors: bool = False
    name: str = ""
    bone_flags: dict = field(default_factory=dict)
    scale: float = 1.0

    def for_bone(self, bone: str) -> "Layer":
        ov = self.bone_flags.get(bone.lower())
        if not ov:
            return self
        lay = copy.copy(self)
        for k, v in ov.items():
            setattr(lay, k, v)
        return lay


def parse_layer_flags(layer: Layer, flags: str | Sequence[str] | None) -> Layer:
    if not flags:
        return layer
    if isinstance(flags, str):
        flags = [f for f in re.split(r"[,+]", flags) if f]
    for f in flags:
        f = f.strip()
        if f in ("emissive", "emissive_alpha"):
            layer.emissive_alpha = True
        elif f in ("two_sided", "nocull", "double_sided"):
            layer.two_sided = True
        elif f in ("cull", "one_sided"):
            layer.two_sided = False
        elif f.startswith("material="):
            for k, v in material_flags(f[9:]).items():
                setattr(layer, k, v)
        elif f == "blend":
            layer.blend = True
            layer.alpha_test = False
        elif f in ("noalpha", "opaque"):
            layer.alpha_test = False
        elif f in ("colormask", "change_color"):
            layer.colormask = True
            layer.alpha_test = False
        elif f in ("faces", "face_colors"):
            layer.face_colors = True
        elif f.startswith("tint="):
            layer.tint = parse_color(f[5:], normalised=True)
        elif f.startswith("hide="):
            layer.hidden_bones = list(layer.hidden_bones) + f[5:].split("/")
        else:
            raise ValueError(f"unknown layer flag '{f}'")
    return layer


def parse_color(s: str, normalised: bool = False) -> tuple:
    s = s.strip().lstrip("#")
    if s.lower() in ("transparent", "none"):
        c = (0, 0, 0, 0)
    elif len(s) in (6, 8):
        c = tuple(int(s[i:i + 2], 16) for i in range(0, len(s), 2))
        if len(c) == 3:
            c = c + (255,)
    elif "," in s:
        c = tuple(int(float(x)) for x in s.split(","))
        if len(c) == 3:
            c = c + (255,)
    else:
        raise ValueError(f"bad colour '{s}' (use rrggbb, rrggbbaa or r,g,b[,a])")
    if normalised:
        return tuple(x / 255.0 for x in c)
    return c


# ---------------------------------------------------------------------------
# Camera
# ---------------------------------------------------------------------------

VIEWS = {
    "front": (0.0, 0.0), "back": (180.0, 0.0),
    "right": (90.0, 0.0), "left": (-90.0, 0.0),      # the ENTITY's right / left flank
    "top": (0.0, 89.9), "bottom": (0.0, -89.9),
    "iso": (35.0, 25.0), "iso_left": (-35.0, 25.0),
    "iso_back": (145.0, 25.0), "iso_back_left": (-145.0, 25.0),
}


@dataclass
class Camera:
    """yaw: orbit angle in degrees, 0 = in front of the entity's face looking
    at it, +90 = looking at the entity's RIGHT flank, 180 = from behind.
    pitch: degrees above the horizon (+ = looking down)."""
    yaw: float = 35.0
    pitch: float = 25.0
    ortho: bool = False
    fov: float = 30.0
    distance: float | None = None          # model units; None = auto
    target: tuple | None = None            # geo-space point; None = model centre
    zoom: float = 1.0
    ppu: float | None = None               # fixed pixels per model unit (ortho) instead of auto-fit
    margin: float = 0.06

    @staticmethod
    def view(name: str, **kw) -> "Camera":
        if name not in VIEWS:
            raise KeyError(f"unknown view '{name}' (known: {', '.join(VIEWS)})")
        y, p = VIEWS[name]
        return Camera(yaw=y, pitch=p, **kw)

    def basis(self):
        yaw = math.radians(self.yaw)
        pitch = math.radians(max(-89.9, min(89.9, self.pitch)))
        d = np.array([math.sin(yaw) * math.cos(pitch), math.sin(pitch), -math.cos(yaw) * math.cos(pitch)])
        f = -d
        right = np.cross(f, np.array([0.0, 1.0, 0.0]))
        right /= np.linalg.norm(right)
        up = np.cross(right, f)
        return d, f, right, up


@dataclass
class Framing:
    """Fixed 2D framing (so animation frames do not jump around)."""
    cx: float
    cy: float
    scale: float
    target_rs: np.ndarray
    distance: float


def _compute_framing(points_rs: np.ndarray, cam: Camera, W: int, H: int) -> Framing:
    if len(points_rs) == 0:
        points_rs = np.zeros((1, 3))
    d, f, right, up = cam.basis()
    lo, hi = points_rs.min(0), points_rs.max(0)
    target = geo_to_rs(cam.target) if cam.target is not None else (lo + hi) / 2
    radius = float(np.max(np.linalg.norm(points_rs - target, axis=1))) or 1.0
    dist = cam.distance if cam.distance else radius / math.sin(math.radians(cam.fov) / 2) * 1.15
    sx, sy, _ = _project(points_rs, cam, target, dist, d, f, right, up)
    if cam.ppu and cam.ortho:
        tx, ty, _ = _project(target[None, :], cam, target, dist, d, f, right, up)
        return Framing(float(tx[0]), float(ty[0]), cam.ppu * cam.zoom, target, dist)
    bw, bh = float(sx.max() - sx.min()), float(sy.max() - sy.min())
    bw, bh = max(bw, 1e-6), max(bh, 1e-6)
    m = cam.margin
    scale = min(W * (1 - 2 * m) / bw, H * (1 - 2 * m) / bh) * cam.zoom
    return Framing(float((sx.max() + sx.min()) / 2), float((sy.max() + sy.min()) / 2), scale, target, dist)


def _project(P, cam: Camera, target, dist, d, f, right, up):
    C = target + d * dist
    rel = P - C
    xv, yv, zv = rel @ right, rel @ up, rel @ f
    if cam.ortho:
        return xv, yv, zv
    zs = np.maximum(zv, 1e-6)
    return xv / zs, yv / zs, zv


# ---------------------------------------------------------------------------
# Rasteriser
# ---------------------------------------------------------------------------

def _shade(n: np.ndarray) -> float:
    """Minecraft-like fixed directional face shading in model space:
    top 1.0, bottom 0.5, front/back (z) 0.8, left/right (x) 0.6."""
    x2, y2, z2 = n[0] * n[0], n[1] * n[1], n[2] * n[2]
    return x2 * 0.6 + z2 * 0.8 + y2 * (1.0 if n[1] > 0 else 0.5)


class _Target:
    def __init__(self, W, H, background):
        self.W, self.H = W, H
        self.color = np.zeros((H, W, 4), dtype=np.float32)
        bg = np.array(background, dtype=np.float32) / 255.0
        self.color[...] = bg
        self.depth = np.full((H, W), np.inf, dtype=np.float64)


def _raster_tri(tg: _Target, px, py, pz, uv, rect, tex, tw, th, layer: Layer, shade: float,
                ortho: bool, back: bool, layer_bias: float, flat_color=None):
    W, H = tg.W, tg.H
    x0, x1, x2 = px
    y0, y1, y2 = py
    area = (x1 - x0) * (y2 - y0) - (x2 - x0) * (y1 - y0)
    if abs(area) < 1e-12:
        return
    xmin = max(int(math.floor(min(px))), 0)
    xmax = min(int(math.ceil(max(px))), W - 1)
    ymin = max(int(math.floor(min(py))), 0)
    ymax = min(int(math.ceil(max(py))), H - 1)
    if xmin > xmax or ymin > ymax:
        return
    xs = np.arange(xmin, xmax + 1, dtype=np.float64) + 0.5
    ys = np.arange(ymin, ymax + 1, dtype=np.float64) + 0.5
    X, Y = np.meshgrid(xs, ys)
    w0 = ((x1 - X) * (y2 - Y) - (x2 - X) * (y1 - Y)) / area
    w1 = ((x2 - X) * (y0 - Y) - (x0 - X) * (y2 - Y)) / area
    w2 = 1.0 - w0 - w1
    eps = -1e-7
    inside = (w0 >= eps) & (w1 >= eps) & (w2 >= eps)
    if not inside.any():
        return
    if ortho:
        depth = w0 * pz[0] + w1 * pz[1] + w2 * pz[2]
        u = w0 * uv[0][0] + w1 * uv[1][0] + w2 * uv[2][0]
        v = w0 * uv[0][1] + w1 * uv[1][1] + w2 * uv[2][1]
    else:
        iz0, iz1, iz2 = 1.0 / pz[0], 1.0 / pz[1], 1.0 / pz[2]
        iz = w0 * iz0 + w1 * iz1 + w2 * iz2
        depth = 1.0 / iz
        u = (w0 * uv[0][0] * iz0 + w1 * uv[1][0] * iz1 + w2 * uv[2][0] * iz2) / iz
        v = (w0 * uv[0][1] * iz0 + w1 * uv[1][1] * iz1 + w2 * uv[2][1] * iz2) / iz
    # depth bias: back faces lose ties, later layers win ties (LEQUAL overlay)
    bias = abs(depth) * 1e-6 + 1e-6
    dcmp = depth + (bias * 4 if back else 0.0) - layer_bias * bias
    sub_depth = tg.depth[ymin:ymax + 1, xmin:xmax + 1]
    mask = inside & (dcmp <= sub_depth)
    if not mask.any():
        return
    if flat_color is not None:
        rgba = np.empty(u.shape + (4,), dtype=np.float32)
        rgba[...] = np.array(flat_color, dtype=np.float32)
        # subtle UV checker so the face's texture orientation stays visible
        cu = np.floor(u).astype(np.int64)
        cv = np.floor(v).astype(np.int64)
        chk = ((cu + cv) & 1).astype(np.float32)
        rgba[..., :3] *= (0.85 + 0.15 * chk)[..., None]
    else:
        umin, vmin, umax, vmax = rect
        uc = np.clip(u, umin + 1e-4, umax - 1e-4)
        vc = np.clip(v, vmin + 1e-4, vmax - 1e-4)
        ih, iw = tex.shape[:2]
        ix = np.clip(np.floor(uc * (iw / tw)).astype(np.int64), 0, iw - 1)
        iy = np.clip(np.floor(vc * (ih / th)).astype(np.int64), 0, ih - 1)
        rgba = tex[iy, ix].astype(np.float32) / 255.0
    a = rgba[..., 3]
    tint = np.array(layer.tint, dtype=np.float32)
    if layer.emissive_alpha and flat_color is None:
        emis = 1.0 - a
        light = shade * (1.0 - emis) + emis
        col = rgba[..., :3] * light[..., None] * tint[:3]
        alpha = np.full_like(a, tint[3])
    elif layer.colormask and flat_color is None:
        tmix = 1.0 + (tint[None, None, :3] - 1.0) * a[..., None]
        col = rgba[..., :3] * shade * tmix
        alpha = np.ones_like(a)
    else:
        col = rgba[..., :3] * shade * tint[:3]
        if layer.blend:
            alpha = a * tint[3]
        else:
            if layer.alpha_test and flat_color is None:
                mask &= a >= 0.5
            alpha = np.full_like(a, tint[3])
    if not mask.any():
        return
    sub_col = tg.color[ymin:ymax + 1, xmin:xmax + 1]
    if layer.blend:
        src_a = alpha[mask][:, None]
        dst = sub_col[mask]
        out = np.empty_like(dst)
        out[:, :3] = col[mask] * src_a + dst[:, :3] * (1 - src_a)
        out[:, 3:4] = src_a + dst[:, 3:4] * (1 - src_a)
        sub_col[mask] = out
    else:
        newc = np.concatenate([col, alpha[..., None]], axis=-1)
        sub_col[mask] = newc[mask]
        sub_depth[mask] = depth[mask]


def _rasterize(tg: _Target, quads, layer: Layer, layer_index: int, cam: Camera, fr: Framing,
               tex: np.ndarray | None, tw: float, th: float, shading: bool):
    d, f, right, up = cam.basis()
    C = fr.target_rs + d * fr.distance
    W, H = tg.W, tg.H
    base_layer = layer
    for q in quads:
        layer = base_layer.for_bone(q.bone)
        center = q.verts.mean(0)
        view_vec = (C - center) if not cam.ortho else d
        facing = float(np.dot(q.normal, view_vec)) > 0
        if not facing and not layer.two_sided:
            continue
        n = q.normal if facing else -q.normal
        shade = _shade(n) if shading else 1.0
        sx, sy, sz = _project(q.verts, cam, fr.target_rs, fr.distance, d, f, right, up)
        if not cam.ortho and np.any(sz <= 1e-3):
            continue
        px = W / 2 + (sx - fr.cx) * fr.scale
        py = H / 2 - (sy - fr.cy) * fr.scale
        flat = None
        if layer.face_colors or tex is None:
            flat = tuple(c / 255.0 for c in FACE_DEBUG_COLORS[q.face]) + (1.0,)
        for (i, j, k) in ((0, 1, 2), (0, 2, 3)):
            _raster_tri(tg, (px[i], px[j], px[k]), (py[i], py[j], py[k]), (sz[i], sz[j], sz[k]),
                        (q.uvs[i], q.uvs[j], q.uvs[k]), q.rect, tex, tw, th, layer, shade,
                        cam.ortho, not facing, float(layer_index), flat)


def _downsample(img: np.ndarray, ss: int) -> np.ndarray:
    if ss <= 1:
        return img
    H, W = img.shape[0] // ss, img.shape[1] // ss
    a = img[:H * ss, :W * ss].reshape(H, ss, W, ss, 4)
    alpha = a[..., 3:4]
    prem = (a[..., :3] * alpha).mean(axis=(1, 3))
    al = alpha.mean(axis=(1, 3))
    rgb = np.where(al > 1e-6, prem / np.maximum(al, 1e-6), 0.0)
    return np.concatenate([rgb, al], axis=-1)


def _to_image(arr: np.ndarray) -> Image.Image:
    return Image.fromarray((np.clip(arr, 0, 1) * 255 + 0.5).astype(np.uint8), "RGBA")


def _ground_quads(points: np.ndarray, size_blocks: float | None = None) -> list[Quad]:
    lo, hi = points.min(0), points.max(0)
    pad = 8.0
    x0, x1 = math.floor((lo[0] - pad) / 16) * 16, math.ceil((hi[0] + pad) / 16) * 16
    z0, z1 = math.floor((lo[2] - pad) / 16) * 16, math.ceil((hi[2] + pad) / 16) * 16
    if size_blocks:
        h = size_blocks * 8
        x0, x1, z0, z1 = -h, h, -h, h
    v = np.array([[x0, 0, z0], [x1, 0, z0], [x1, 0, z1], [x0, 0, z1]], dtype=float)
    uv = v[:, [0, 2]] / 16.0
    return [Quad(v, uv, (-1e9, -1e9, 1e9, 1e9), np.array([0.0, 1.0, 0.0]), "up", "<ground>", 0)]


def _draw_ground(tg: _Target, quads, cam: Camera, fr: Framing):
    """Procedural 1-block checker on the y=0 plane (depth tested)."""
    d, f, right, up = cam.basis()
    for q in quads:
        q2 = q
        sx, sy, sz = _project(q2.verts, cam, fr.target_rs, fr.distance, d, f, right, up)
        if not cam.ortho and np.any(sz <= 1e-3):
            continue
        px = tg.W / 2 + (sx - fr.cx) * fr.scale
        py = tg.H / 2 - (sy - fr.cy) * fr.scale
        for (i, j, k) in ((0, 1, 2), (0, 2, 3)):
            _raster_ground(tg, (px[i], px[j], px[k]), (py[i], py[j], py[k]), (sz[i], sz[j], sz[k]),
                           (q2.uvs[i], q2.uvs[j], q2.uvs[k]), cam.ortho)


def _raster_ground(tg, px, py, pz, uv, ortho):
    W, H = tg.W, tg.H
    x0, x1, x2 = px
    y0, y1, y2 = py
    area = (x1 - x0) * (y2 - y0) - (x2 - x0) * (y1 - y0)
    if abs(area) < 1e-12:
        return
    xmin, xmax = max(int(math.floor(min(px))), 0), min(int(math.ceil(max(px))), W - 1)
    ymin, ymax = max(int(math.floor(min(py))), 0), min(int(math.ceil(max(py))), H - 1)
    if xmin > xmax or ymin > ymax:
        return
    X, Y = np.meshgrid(np.arange(xmin, xmax + 1) + 0.5, np.arange(ymin, ymax + 1) + 0.5)
    w0 = ((x1 - X) * (y2 - Y) - (x2 - X) * (y1 - Y)) / area
    w1 = ((x2 - X) * (y0 - Y) - (x0 - X) * (y2 - Y)) / area
    w2 = 1 - w0 - w1
    inside = (w0 >= -1e-7) & (w1 >= -1e-7) & (w2 >= -1e-7)
    if ortho:
        depth = w0 * pz[0] + w1 * pz[1] + w2 * pz[2]
        u = w0 * uv[0][0] + w1 * uv[1][0] + w2 * uv[2][0]
        v = w0 * uv[0][1] + w1 * uv[1][1] + w2 * uv[2][1]
    else:
        iz = w0 / pz[0] + w1 / pz[1] + w2 / pz[2]
        depth = 1 / iz
        u = (w0 * uv[0][0] / pz[0] + w1 * uv[1][0] / pz[1] + w2 * uv[2][0] / pz[2]) / iz
        v = (w0 * uv[0][1] / pz[0] + w1 * uv[1][1] / pz[1] + w2 * uv[2][1] / pz[2]) / iz
    sub_d = tg.depth[ymin:ymax + 1, xmin:xmax + 1]
    m = inside & (depth < sub_d)
    chk = ((np.floor(u).astype(np.int64) + np.floor(v).astype(np.int64)) & 1).astype(np.float32)
    col = np.stack([0.55 + 0.1 * chk, 0.6 + 0.1 * chk, 0.55 + 0.1 * chk, np.ones_like(chk)], -1)
    sub_c = tg.color[ymin:ymax + 1, xmin:xmax + 1]
    sub_c[m] = col[m]
    sub_d[m] = depth[m]


def _font(size=11):
    for name in ("DejaVuSans.ttf", "DejaVuSansMono.ttf", "Arial.ttf"):
        try:
            return ImageFont.truetype(name, size)
        except OSError:
            continue
    return ImageFont.load_default()


def pose_layers(layers: Sequence[Layer], plays: Sequence[Play] = (), time: float = 0.0,
                queries=None, variables=None, context=None, missing=None) -> list[list[Quad]]:
    out = []
    for layer in layers:
        pose = compute_pose(layer.geometry, plays, time, queries, variables, context, missing)
        out.append(build_mesh(layer.geometry, pose, layer.hidden_bones, scale=layer.scale))
    return out


def render(layers: Sequence[Layer] | Layer, camera: Camera | None = None, size=(512, 512),
           background="transparent", supersample: int = 2, plays: Sequence[Play] = (),
           time: float = 0.0, queries: dict | None = None, variables: dict | None = None,
           context: dict | None = None, framing: Framing | None = None, ground: bool = False,
           shading: bool = True, show_pivots: bool = False, axes: bool = False,
           label: str | None = None, info: dict | None = None) -> Image.Image:
    """Render layers (sharing one pose) to a PIL RGBA image.

    ``info`` (optional dict) receives 'framing', 'missing' (unknown Molang
    names), 'quads' (count) and 'pivots' (bone -> pixel position)."""
    if isinstance(layers, Layer):
        layers = [layers]
    cam = camera or Camera()
    if isinstance(size, int):
        size = (size, size)
    W, H = int(size[0]), int(size[1])
    ss = max(1, int(supersample))
    bg = parse_color(background) if isinstance(background, str) else tuple(background)
    missing: set = set()
    meshes = pose_layers(layers, plays, time, queries, variables, context, missing)
    pts = np.concatenate([np.concatenate([q.verts for q in m]) for m in meshes if m] or [np.zeros((1, 3))])
    fr = framing or _compute_framing(pts, cam, W, H)
    fr_ss = Framing(fr.cx, fr.cy, fr.scale * ss, fr.target_rs, fr.distance)
    tg = _Target(W * ss, H * ss, bg)
    if ground:
        _draw_ground(tg, _ground_quads(pts), cam, fr_ss)
    for li, (layer, quads) in enumerate(zip(layers, meshes)):
        tex = layer.texture
        _rasterize(tg, quads, layer, li, cam, fr_ss, tex, layer.geometry.texture_width,
                   layer.geometry.texture_height, shading)
    img = _to_image(_downsample(tg.color, ss))
    d, f, right, up = cam.basis()
    pivots = {}
    if show_pivots or info is not None:
        geo0 = layers[0].geometry
        pose0 = compute_pose(geo0, plays, time, queries, variables, context)
        mats = bone_matrices(geo0, pose0)
        for b in geo0.bones:
            p = mats[b.key] @ np.append(geo_to_rs(b.pivot), 1.0)
            sx, sy, sz = _project(p[None, :3], cam, fr.target_rs, fr.distance, d, f, right, up)
            pivots[b.name] = (float(W / 2 + (sx[0] - fr.cx) * fr.scale), float(H / 2 - (sy[0] - fr.cy) * fr.scale))
    if show_pivots:
        dr = ImageDraw.Draw(img)
        fnt = _font(10)
        for name, (x, y) in pivots.items():
            dr.line([(x - 3, y), (x + 3, y)], fill=(255, 0, 255, 255))
            dr.line([(x, y - 3), (x, y + 3)], fill=(255, 0, 255, 255))
            dr.text((x + 4, y - 6), name, fill=(255, 0, 255, 255), font=fnt)
    if axes:
        _draw_axes(img, cam)
    if label:
        dr = ImageDraw.Draw(img)
        dr.text((4, 2), label, fill=(255, 255, 255, 255), font=_font(12), stroke_width=2,
                stroke_fill=(0, 0, 0, 255))
    if info is not None:
        info["framing"] = fr
        info["missing"] = missing
        info["quads"] = sum(len(m) for m in meshes)
        info["pivots"] = pivots
        info["bounds_geo"] = (np.array([-pts[:, 0].max(), pts[:, 1].min(), pts[:, 2].min()]),
                              np.array([-pts[:, 0].min(), pts[:, 1].max(), pts[:, 2].max()]))
    return img


def _draw_axes(img: Image.Image, cam: Camera):
    """Corner gizmo with GEO-FILE axes: red +X (entity's left), green +Y,
    blue -Z labelled 'front'."""
    d, f, right, up = cam.basis()
    dr = ImageDraw.Draw(img)
    W, H = img.size
    o = np.array([28.0, H - 28.0])
    L = 20.0
    fnt = _font(10)
    for vec_geo, colr, name in (((1, 0, 0), (230, 50, 50, 255), "+x"),
                                ((0, 1, 0), (50, 200, 50, 255), "+y"),
                                ((0, 0, -1), (60, 120, 255, 255), "front(-z)")):
        v = geo_to_rs(vec_geo)
        sx, sy = float(v @ right), float(v @ up)
        e = o + np.array([sx, -sy]) * L
        dr.line([tuple(o), tuple(e)], fill=colr, width=2)
        dr.text((e[0] + 2, e[1] - 6), name, fill=colr, font=fnt)


# ---------------------------------------------------------------------------
# Multi-image helpers
# ---------------------------------------------------------------------------

def render_views(layers, views: Sequence[str] = ("front", "right", "back", "left", "top", "iso"),
                 size=256, ortho: bool = True, **kw) -> list[tuple[str, Image.Image]]:
    out = []
    for v in views:
        cam = Camera.view(v, ortho=ortho) if isinstance(v, str) else v
        out.append((v if isinstance(v, str) else f"yaw{cam.yaw:g} pitch{cam.pitch:g}",
                    render(layers, cam, size=size, **kw)))
    return out


def render_frames(layers, times: Sequence[float], camera: Camera | None = None, size=256,
                  plays: Sequence[Play] = (), queries=None, variables=None, context=None,
                  fixed_framing: bool = True, **kw) -> list[tuple[str, Image.Image]]:
    """Render animation frames with one shared framing (union of all frames)."""
    cam = camera or Camera()
    if isinstance(layers, Layer):
        layers = [layers]
    W, H = (size, size) if isinstance(size, int) else size
    fr = None
    if fixed_framing:
        allpts = []
        for t in times:
            for m in pose_layers(layers, plays, t, queries, variables, context):
                if m:
                    allpts.append(np.concatenate([q.verts for q in m]))
        if allpts:
            fr = _compute_framing(np.concatenate(allpts), cam, W, H)
    out = []
    for t in times:
        img = render(layers, cam, size=(W, H), plays=plays, time=t, queries=queries,
                     variables=variables, context=context, framing=fr, **kw)
        out.append((f"t={t:g}", img))
    return out


def contact_sheet(items: Sequence[tuple[str, Image.Image]] | Sequence[Image.Image], cols: int | None = None,
                  pad: int = 4, background="#202020", label_color=(235, 235, 235, 255),
                  title: str | None = None) -> Image.Image:
    items = [(("", it) if isinstance(it, Image.Image) else it) for it in items]
    if not items:
        raise ValueError("no images")
    n = len(items)
    cols = cols or min(n, 4 if n > 4 else n)
    rows = (n + cols - 1) // cols
    cw = max(im.size[0] for _, im in items)
    ch = max(im.size[1] for _, im in items)
    lab = 16 if any(lbl for lbl, _ in items) else 0
    top = 20 if title else 0
    W = cols * cw + (cols + 1) * pad
    H = top + rows * (ch + lab) + (rows + 1) * pad
    bg = parse_color(background) if isinstance(background, str) else background
    sheet = Image.new("RGBA", (W, H), bg)
    dr = ImageDraw.Draw(sheet)
    fnt = _font(12)
    if title:
        dr.text((pad, 3), title, fill=label_color, font=_font(13))
    for i, (lbl, im) in enumerate(items):
        r, c = divmod(i, cols)
        x = pad + c * (cw + pad)
        y = top + pad + r * (ch + lab + pad)
        # checkerboard behind transparent renders
        cell = Image.new("RGBA", (cw, ch), (0, 0, 0, 0))
        cdr = ImageDraw.Draw(cell)
        for yy in range(0, ch, 8):
            for xx in range(0, cw, 8):
                g = 58 if ((xx // 8 + yy // 8) % 2) else 46
                cdr.rectangle([xx, yy, xx + 7, yy + 7], fill=(g, g, g, 255))
        cell.alpha_composite(im.convert("RGBA"), ((cw - im.size[0]) // 2, (ch - im.size[1]) // 2))
        sheet.alpha_composite(cell, (x, y + lab))
        if lbl:
            dr.text((x + 2, y + 1), lbl, fill=label_color, font=fnt)
    return sheet


def save_gif(frames: Sequence[Image.Image], path: str, fps: float = 10.0, background="#303030"):
    bg = parse_color(background)
    out = []
    for im in frames:
        base = Image.new("RGBA", im.size, bg)
        base.alpha_composite(im.convert("RGBA"))
        out.append(base.convert("P", palette=Image.ADAPTIVE, colors=255))
    out[0].save(path, save_all=True, append_images=out[1:], duration=int(1000 / fps), loop=0, disposal=2)


# ---------------------------------------------------------------------------
# UV map (texture layout overlay for artists)
# ---------------------------------------------------------------------------

def uv_map_image(geo: Geometry, texture: np.ndarray | None = None, scale: int = 8,
                 labels: bool = True) -> tuple[Image.Image, list[str]]:
    """Texture (or blank grid) scaled up with every face's UV rect outlined in
    its face colour.  Returns (image, problems) where problems lists rects
    outside the texture."""
    tw, th = int(round(geo.texture_width)), int(round(geo.texture_height))
    if texture is not None:
        base = Image.fromarray(texture).resize((tw * scale, th * scale), Image.NEAREST)
    else:
        base = Image.new("RGBA", (tw * scale, th * scale), (40, 40, 40, 255))
    bg = Image.new("RGBA", base.size, (25, 25, 25, 255))
    dr0 = ImageDraw.Draw(bg)
    for x in range(0, tw, 1):
        for y in range(0, th, 1):
            if (x + y) % 2:
                dr0.rectangle([x * scale, y * scale, (x + 1) * scale - 1, (y + 1) * scale - 1], fill=(35, 35, 35, 255))
    bg.alpha_composite(base.convert("RGBA"))
    dr = ImageDraw.Draw(bg)
    fnt = _font(max(8, scale + 2))
    problems = []
    for b in geo.bones:
        for ci, c in enumerate(b.cubes):
            mirror = c.mirror if c.mirror is not None else b.mirror
            for face, (u0, v0, u1, v1) in face_rects(c, mirror).items():
                umin, umax = min(u0, u1), max(u0, u1)
                vmin, vmax = min(v0, v1), max(v0, v1)
                if umax - umin <= 0 or vmax - vmin <= 0:
                    continue
                if umin < 0 or vmin < 0 or umax > geo.texture_width or vmax > geo.texture_height:
                    problems.append(f"{b.name}#{ci} {face}: uv rect {umin:g},{vmin:g}..{umax:g},{vmax:g} outside {tw}x{th}")
                col = FACE_DEBUG_COLORS[face] + (255,)
                dr.rectangle([umin * scale, vmin * scale, umax * scale - 1, vmax * scale - 1], outline=col)
                # mark the texel that lands on the face's (lx,ly)=(0,0) corner
                cx = u0 * scale + (1 if u1 > u0 else -3)
                cy = v0 * scale + (1 if v1 > v0 else -3)
                dr.rectangle([cx, cy, cx + 2, cy + 2], fill=col)
                if labels and (umax - umin) * scale >= 18 and (vmax - vmin) * scale >= 10:
                    dr.text((umin * scale + 2, vmin * scale + 1), face[0].upper(), fill=col, font=fnt)
    return bg, problems


# ---------------------------------------------------------------------------
# Orientation test model (deliberately asymmetric)
# ---------------------------------------------------------------------------

def make_orientation_test(per_face: bool = True) -> tuple[dict, np.ndarray]:
    """A synthetic geometry + 64x64 texture that makes orientation errors
    obvious.  A 16^3 'body' cube whose six faces carry their face letter, a
    black marker on the texel that maps to the face's UV origin corner and a
    white tick at the UV top-right; a nose cube on the FRONT (-Z, orange), a
    single arm on the entity's RIGHT side (bone 'right_arm', -X, cyan), a tail
    at the BACK (+Z, brown) and a hat on top (black).  ``per_face`` chooses
    per-face UV or box UV for the body.  Returns (geo_json, rgba_texture)."""
    tex = Image.new("RGBA", (64, 64), (0, 0, 0, 0))
    dr = ImageDraw.Draw(tex)
    fnt = _font(8)
    letters = {"north": "N", "south": "S", "east": "E", "west": "W", "up": "U", "down": "D"}
    if per_face:
        body = {"north": (0, 0), "south": (16, 0), "east": (32, 0), "west": (48, 0),
                "up": (0, 16), "down": (16, 16)}
        rects = {f: (u, v, u + 16, v + 16) for f, (u, v) in body.items()}
        uvb: Any = {f: {"uv": list(body[f]), "uv_size": [16, 16]} for f in body}
    else:
        # box UV layout; the rect corners already encode the orientation
        rects = box_uv_rects((16, 16, 16), (0, 0))
        uvb = [0, 0]
    for face, (u0, v0, u1, v1) in rects.items():
        umin, umax, vmin, vmax = int(min(u0, u1)), int(max(u0, u1)), int(min(v0, v1)), int(max(v0, v1))
        dr.rectangle([umin, vmin, umax - 1, vmax - 1], fill=FACE_DEBUG_COLORS[face] + (255,))
        # black 4x4 marker on the texel at the face's UV-origin corner (lx,ly)=(0,0)
        mx = int(u0) if u1 > u0 else int(u0) - 4
        my = int(v0) if v1 > v0 else int(v0) - 4
        dr.rectangle([mx, my, mx + 3, my + 3], fill=(0, 0, 0, 255))
        # white tick at the (lx,ly)=(1,0) corner
        tx = int(u1) - 4 if u1 > u0 else int(u1)
        dr.rectangle([tx, my, tx + 3, my + 1], fill=(255, 255, 255, 255))
        dr.text((umin + 5, vmin + 3), letters[face], fill=(0, 0, 0, 255), font=fnt)
    parts = {"nose": ((0, 48), (255, 140, 0)), "arm": ((16, 48), (0, 200, 200)),
             "tail": ((32, 48), (120, 60, 20)), "hat": ((48, 48), (20, 20, 20))}
    for (u, v), col in parts.values():
        dr.rectangle([u, v, u + 15, v + 15], fill=col + (255,))

    def flat(uv, w, h):
        return {f: {"uv": list(uv), "uv_size": [w, h]} for f in FACES}
    geo = {
        "format_version": "1.16.0",
        "minecraft:geometry": [{
            "description": {"identifier": "geometry.georender.orientation_test",
                            "texture_width": 64, "texture_height": 64},
            "bones": [
                {"name": "body", "pivot": [0, 0, 0],
                 "cubes": [{"origin": [-8, 0, -8], "size": [16, 16, 16], "uv": uvb}]},
                {"name": "nose", "parent": "body", "pivot": [0, 8, -8],
                 "cubes": [{"origin": [-2, 6, -12], "size": [4, 4, 4], "uv": flat(parts["nose"][0], 4, 4)}]},
                {"name": "right_arm", "parent": "body", "pivot": [-8, 12, 0],
                 "cubes": [{"origin": [-12, 2, -2], "size": [4, 12, 4], "uv": flat(parts["arm"][0], 4, 4)}]},
                {"name": "tail", "parent": "body", "pivot": [0, 10, 8],
                 "cubes": [{"origin": [-1, 9, 8], "size": [2, 2, 10], "uv": flat(parts["tail"][0], 2, 2)}]},
                {"name": "hat", "parent": "body", "pivot": [0, 16, 0],
                 "cubes": [{"origin": [-4, 16, -4], "size": [8, 4, 8], "uv": flat(parts["hat"][0], 8, 4)}]},
            ],
        }],
    }
    return geo, np.asarray(tex, dtype=np.uint8).copy()


# ---------------------------------------------------------------------------
# Client entity support (render controllers, animate list) - best effort
# ---------------------------------------------------------------------------

class ResourcePack:
    """Index of one or more resource pack roots (searched in order)."""

    def __init__(self, roots: Sequence[str]):
        self.roots = [r for r in roots if r]
        self.geos = GeometryLibrary()
        self.anims = AnimationLibrary()
        self.render_controllers: dict[str, dict] = {}
        self.entities: dict[str, tuple[str, dict]] = {}
        self.materials: dict[str, tuple[str, dict]] = {}   # name -> (base, definition)
        self.warnings: list[str] = []
        for r in reversed(self.roots):   # earlier roots override later ones
            if os.path.isdir(os.path.join(r, "models")):
                self.geos.add_dir(os.path.join(r, "models"))
            for sub in ("animations", "animation_controllers"):
                if os.path.isdir(os.path.join(r, sub)):
                    self.anims.add_dir(os.path.join(r, sub))
            for p in sorted(glob.glob(os.path.join(r, "materials", "*.material"))):
                try:
                    md = load_json(p).get("materials") or {}
                    for k, v in md.items():
                        if k == "version" or not isinstance(v, dict):
                            continue
                        name, _, base = k.partition(":")
                        self.materials[name.lower()] = (base.lower(), v)
                except Exception as e:
                    self.warnings.append(f"{p}: {e}")
            for p in sorted(glob.glob(os.path.join(r, "render_controllers", "**", "*.json"), recursive=True)):
                try:
                    d = load_json(p)
                    self.render_controllers.update(d.get("render_controllers") or {})
                except Exception as e:
                    self.warnings.append(f"{p}: {e}")
            for p in sorted(glob.glob(os.path.join(r, "entity", "**", "*.json"), recursive=True)):
                try:
                    d = load_json(p)
                    desc = (d.get("minecraft:client_entity") or {}).get("description") or {}
                    if "identifier" in desc:
                        # vanilla ships e.g. cow.entity.json (min_engine 1.8.0) and
                        # cow.v1.0.entity.json for the same id: keep the newest one
                        ident = desc["identifier"]
                        old = self.entities.get(ident)
                        if old is None or _version_tuple(desc.get("min_engine_version")) >= \
                                _version_tuple(old[1].get("min_engine_version")):
                            self.entities[ident] = (p, desc)
                except Exception as e:
                    self.warnings.append(f"{p}: {e}")
        self.warnings += self.geos.warnings + self.anims.warnings


def _version_tuple(v) -> tuple:
    if not v:
        return (0,)
    try:
        return tuple(int(x) for x in str(v).split("."))
    except ValueError:
        return (0,)


# Base entity materials (names as used by vanilla entity.material / add-on
# "name:base" material definitions) -> renderer flags.  NOTE: entity.material
# itself is not part of bedrock-samples, so this table is from knowledge of
# the vanilla material set, not verified against the 1.21.0.26 file.
MATERIAL_PRESETS: dict[str, dict] = {
    "entity": dict(alpha_test=False, two_sided=False, emissive_alpha=False, blend=False, colormask=False),
    "entity_nocull": dict(alpha_test=False, two_sided=True, emissive_alpha=False, blend=False, colormask=False),
    "entity_alphatest": dict(alpha_test=True, two_sided=True, emissive_alpha=False, blend=False, colormask=False),
    "entity_alphatest_one_sided": dict(alpha_test=True, two_sided=False, emissive_alpha=False, blend=False, colormask=False),
    "entity_alphablend": dict(alpha_test=False, two_sided=False, emissive_alpha=False, blend=True, colormask=False),
    "entity_emissive_alpha": dict(alpha_test=False, two_sided=False, emissive_alpha=True, blend=False, colormask=False),
    "entity_emissive_alpha_one_sided": dict(alpha_test=False, two_sided=False, emissive_alpha=True, blend=False, colormask=False),
    "entity_change_color": dict(alpha_test=False, two_sided=False, emissive_alpha=False, blend=False, colormask=True),
    "entity_change_color_one_sided": dict(alpha_test=False, two_sided=False, emissive_alpha=False, blend=False, colormask=True),
}
# vanilla material names -> base (best knowledge; see note above)
VANILLA_MATERIAL_BASE = {
    "spider": "entity_emissive_alpha", "spider_invisible": "entity_emissive_alpha",
    "enderman": "entity_emissive_alpha", "phantom": "entity_emissive_alpha",
    "glow_squid": "entity_emissive_alpha", "blaze_body": "entity_emissive_alpha",
    "blaze_head": "entity_emissive_alpha", "sheep": "entity_change_color",
    "chicken_legs": "entity_alphatest", "slime_outer": "entity_alphablend",
}
DEFAULT_MATERIAL = "entity_alphatest"


def material_flags(material_id: str, definitions: dict | None = None) -> dict:
    """Renderer flags for a material id.  ``definitions`` maps material
    names to (base, definition dict) parsed from a pack's materials/*.material
    ("name:base" keys); "+defines" ALPHA_TEST and "+states" DisableCulling are
    honoured.  Unknown names fall back to DEFAULT_MATERIAL (entity_alphatest:
    alpha test, no culling)."""
    mid = material_id.lower().strip()
    chain = []
    seen = set()
    cur = mid
    extra: dict = {}
    while cur and cur not in seen:
        seen.add(cur)
        chain.append(cur)
        if cur in MATERIAL_PRESETS:
            break
        if definitions and cur in definitions:
            base, mdef = definitions[cur]
            defs = [str(x).upper() for x in (mdef.get("+defines") or [])]
            states = [str(x) for x in (mdef.get("+states") or [])]
            if "ALPHA_TEST" in defs:
                extra.setdefault("alpha_test", True)
            if "DisableCulling" in states:
                extra.setdefault("two_sided", True)
            cur = base
            continue
        if cur in VANILLA_MATERIAL_BASE:
            cur = VANILLA_MATERIAL_BASE[cur]
            continue
        cur = None
    base = chain[-1] if chain and chain[-1] in MATERIAL_PRESETS else DEFAULT_MATERIAL
    out = dict(MATERIAL_PRESETS[base])
    out.update(extra)
    return out


def entity_layers(rp: ResourcePack, identifier_or_path: str, queries=None, variables=None,
                  time: float = 0.0) -> tuple[list[Layer], list[Play], dict, list[str]]:
    """Build layers + animation plays for a client entity the way the game
    composes it (best effort): every render controller becomes a layer
    (geometry/textures/materials/part_visibility evaluated with Molang),
    multi-texture controllers are alpha-composited, scripts.initialize and
    pre_animation set variables, scripts.animate decides the plays
    (animation controllers contribute their initial state's animations)."""
    notes: list[str] = []
    if os.path.isfile(identifier_or_path):
        d = load_json(identifier_or_path)
        desc = d["minecraft:client_entity"]["description"]
        path = identifier_or_path
    else:
        path, desc = rp.entities[identifier_or_path]
    ctx = frame_context(time, queries, variables)
    scripts = desc.get("scripts") or {}
    for key in ("initialize", "pre_animation"):
        for s in scripts.get(key) or []:
            try:
                Molang(s).eval(ctx)
            except MolangError as e:
                notes.append(f"{key}: {e}")
    variables_out = {k: Value(v) for k, v in ctx.variables.items()}
    for k, v in (variables or {}).items():   # explicit overrides win over scripts
        variables_out[_norm_var_key(k)] = v
    ctx = frame_context(time, queries, variables_out)
    textures = desc.get("textures") or {}
    geos = desc.get("geometry") or {}
    mats = desc.get("materials") or {}
    refs = {}
    for k, v in textures.items():
        refs[f"texture.{k.lower()}"] = ("texture", v)
    for k, v in geos.items():
        refs[f"geometry.{k.lower()}"] = ("geometry", v)
    for k, v in mats.items():
        refs[f"material.{k.lower()}"] = ("material", v)
    ctx.refs = refs
    layers: list[Layer] = []
    for rc_entry in desc.get("render_controllers") or []:
        if isinstance(rc_entry, dict):
            (rc_name, cond), = rc_entry.items()
            if not _truthy(Molang(cond).eval(ctx)):
                notes.append(f"{rc_name}: condition false, skipped")
                continue
        else:
            rc_name = rc_entry
        rc = rp.render_controllers.get(rc_name)
        if rc is None:
            notes.append(f"render controller {rc_name} not found")
            continue
        arrays = {}
        for kind, arrs in (rc.get("arrays") or {}).items():
            for an, items in arrs.items():
                arrays[an.lower()] = [Molang(it).prog for it in items]
        ctx.arrays = arrays

        def resolve(expr, kind):
            v = Molang(expr).eval(ctx)
            if isinstance(v, tuple) and v[0] == kind:
                return v[1]
            if isinstance(v, str):
                return v
            return None
        geo_id = resolve(rc.get("geometry", "Geometry.default"), "geometry")
        if geo_id is None:
            notes.append(f"{rc_name}: geometry unresolved")
            continue
        try:
            geo = rp.geos.get(geo_id)
        except KeyError as e:
            notes.append(str(e))
            continue
        tex_arrays = []
        for texpr in rc.get("textures") or ["Texture.default"]:
            tpath = resolve(texpr, "texture")
            if tpath is None:
                notes.append(f"{rc_name}: texture '{texpr}' unresolved")
                continue
            try:
                tex_arrays.append(load_texture(tpath, rp.roots))
            except FileNotFoundError as e:
                notes.append(str(e))
        tex = composite_textures(tex_arrays) if tex_arrays else None
        layer = Layer(geometry=geo, texture=tex, name=rc_name)
        try:
            layer.scale = float(_num(Molang(scripts.get("scale", 1.0)).eval(ctx))) or 1.0
        except MolangError:
            pass
        mat_ids = []
        bone_mat: dict[str, str] = {}
        for mentry in rc.get("materials") or []:
            for pattern, mexpr in mentry.items():
                mid = resolve(mexpr, "material")
                if not mid:
                    notes.append(f"{rc_name}: material '{mexpr}' unresolved")
                    continue
                mat_ids.append(f"{pattern}={mid}")
                rx = re.compile("^" + re.escape(pattern.lower()).replace(r"\*", ".*") + "$")
                for b in geo.bones:
                    if rx.match(b.key):
                        bone_mat[b.key] = mid      # later entries override earlier ones
        for bkey, mid in bone_mat.items():
            layer.bone_flags[bkey] = material_flags(mid, rp.materials)
        hidden = []
        for pv in rc.get("part_visibility") or []:
            for pattern, vexpr in pv.items():
                visible = _truthy(Molang(vexpr).eval(ctx)) if not isinstance(vexpr, bool) else vexpr
                rx = re.compile("^" + re.escape(pattern.lower()).replace(r"\*", ".*") + "$")
                for b in geo.bones:
                    if rx.match(b.key):
                        if visible and b.key in hidden:
                            hidden.remove(b.key)
                        elif not visible and b.key not in hidden:
                            hidden.append(b.key)
        layer.hidden_bones = hidden
        notes.append(f"layer {rc_name}: geometry={geo_id} materials={mat_ids} hidden={len(hidden)} bones")
        layers.append(layer)
    # animations
    plays: list[Play] = []
    short = desc.get("animations") or {}

    def add_play(name, weight):
        full = short.get(name, name)
        if full in rp.anims.anims:
            plays.append(Play(rp.anims.anims[full], weight))
        elif full in rp.anims.controllers:
            ctrl = rp.anims.controllers[full]
            states = ctrl.get("states") or {}
            st_name = ctrl.get("initial_state", "default")
            if st_name not in states and states:
                st_name = next(iter(states))
            # settle: follow transitions whose condition is true right now
            # (the game takes one per frame; a still preview wants the
            # steady state).  Cycles stop after 16 hops.
            seen = [st_name]
            for _ in range(16):
                nxt = None
                for tr in (states.get(st_name) or {}).get("transitions") or []:
                    for target, cond in tr.items():
                        if nxt is None and target in states and _truthy(Molang(cond).eval(ctx)):
                            nxt = target
                if nxt is None or nxt == st_name:
                    break
                st_name = nxt
                if st_name in seen:
                    break
                seen.append(st_name)
            st = states.get(st_name) or {}
            for a in st.get("animations") or []:
                if isinstance(a, dict):
                    (an, aw), = a.items()
                    add_play(an, aw if weight == 1.0 else f"({aw})*({weight})")
                else:
                    add_play(a, weight)
            notes.append(f"controller {full}: state path {' -> '.join(seen)}")
        else:
            notes.append(f"animation '{name}' -> '{full}' not found")
    for entry in desc.get("animation_controllers") or []:   # legacy 1.8.0 client entities
        if isinstance(entry, dict):
            for n, full in entry.items():
                add_play(full, 1.0)     # full id: the short name may also name an animation
        else:
            add_play(entry, 1.0)
    for entry in scripts.get("animate") or []:
        if isinstance(entry, dict):
            for n, w in entry.items():
                add_play(n, w)
        else:
            add_play(entry, 1.0)
    notes.append("variables after scripts: " + ", ".join(
        f"{k}={(v.value if isinstance(v, Value) else v)!r}" for k, v in sorted(variables_out.items())))
    return layers, plays, variables_out, notes


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def _parse_kv(items: Sequence[str] | None) -> dict:
    out = {}
    for it in items or []:
        if "=" not in it:
            raise SystemExit(f"expected name=value, got '{it}'")
        k, v = it.split("=", 1)
        try:
            out[k.strip()] = float(v)
        except ValueError:
            out[k.strip()] = v.strip()
    return out


def _parse_times(s: str) -> list[float]:
    if ":" in s:  # start:end:count
        a, b, n = s.split(":")
        n = int(n)
        a, b = float(a), float(b)
        return [a + (b - a) * i / max(1, n - 1) for i in range(n)] if n > 1 else [a]
    return [float(x) for x in s.split(",") if x.strip()]


def _common_args(p: argparse.ArgumentParser, model_required=True):
    if model_required:
        p.add_argument("model", help="geometry .json file")
        p.add_argument("-g", "--geometry", help="geometry identifier (default: first in file)")
        p.add_argument("-t", "--texture", help="texture file (extension optional); omit for face-colour debug")
        p.add_argument("--flags", default="",
                       help="layer-0 flags (comma list): material=NAME, cull, two_sided, emissive, colormask, "
                            "blend, noalpha, faces, tint=rrggbb, hide=bone/bone")
        p.add_argument("--layer", nargs="+", action="append", metavar="ARG",
                       help="extra layer: GEOFILE[#GEOMETRY_ID] [TEXTURE] [FLAGS]  (repeatable)")
    p.add_argument("--lib", action="append", default=[], help="extra geometry file/dir for inheritance parents")
    p.add_argument("--rp", action="append", default=[], help="resource pack root(s) to resolve textures/geometry")
    p.add_argument("--anim", action="append", default=[], help="animation .json file or directory (repeatable)")
    p.add_argument("--play", action="append", default=[],
                   help="animation id to apply, optional '@weight' (number or Molang), in order (repeatable)")
    p.add_argument("--query", "-q", action="append", default=[], help="query override name=value|molang (t = frame time)")
    p.add_argument("--var", action="append", default=[], help="variable override name=value|molang")
    p.add_argument("--time", type=float, default=0.0, help="frame time in seconds")
    p.add_argument("--view", default=None, help=f"named view: {', '.join(VIEWS)}")
    p.add_argument("--yaw", type=float, default=None)
    p.add_argument("--pitch", type=float, default=None)
    p.add_argument("--ortho", action="store_true", help="orthographic projection")
    p.add_argument("--fov", type=float, default=30.0)
    p.add_argument("--zoom", type=float, default=1.0)
    p.add_argument("--ppu", type=float, default=None, help="fixed pixels per model unit (ortho)")
    p.add_argument("--target", default=None, help="camera target x,y,z in geo space")
    p.add_argument("--distance", type=float, default=None, help="perspective camera distance (model units)")
    p.add_argument("--position-this", choices=("pivot", "zero"), default="pivot",
                   help="initial Molang 'this' of position channels (see README)")
    p.add_argument("--size", default="512", help="output size N or WxH")
    p.add_argument("--ss", type=int, default=2, help="supersampling factor (1 = off)")
    p.add_argument("--bg", default="transparent", help="background: transparent | rrggbb[aa]")
    p.add_argument("--ground", action="store_true", help="draw a ground checker at y=0 (1 block squares)")
    p.add_argument("--pivots", action="store_true", help="mark bone pivots")
    p.add_argument("--axes", action="store_true", help="draw geo-space axis gizmo")
    p.add_argument("--noshade", action="store_true", help="disable face shading")
    p.add_argument("--label", default=None)


def _size(s: str):
    if "x" in s.lower():
        a, b = s.lower().split("x")
        return int(a), int(b)
    return int(s), int(s)


def _camera_from_args(a, default_view="iso") -> Camera:
    yaw, pitch = VIEWS[a.view or default_view]
    if a.yaw is not None:
        yaw = a.yaw
    if a.pitch is not None:
        pitch = a.pitch
    target = tuple(float(x) for x in a.target.split(",")) if a.target else None
    global POSITION_THIS_MODE
    POSITION_THIS_MODE = getattr(a, "position_this", "pivot") or "pivot"
    return Camera(yaw=yaw, pitch=pitch, ortho=a.ortho, fov=a.fov, zoom=a.zoom, ppu=a.ppu, target=target,
                  distance=getattr(a, "distance", None))


def _layers_from_args(a) -> list[Layer]:
    lib = GeometryLibrary()
    rp_models = [os.path.join(r, "models") for r in a.rp if os.path.isdir(os.path.join(r, "models"))]
    for p in list(a.lib) + rp_models:
        if os.path.isdir(p):
            lib.add_dir(p)
        else:
            lib.add_file(p)
    ids = lib.add_file(a.model)
    if not ids:
        raise SystemExit(f"{a.model}: no geometry found")
    geo = lib.get(a.geometry or ids[0])
    layers = [parse_layer_flags(Layer(geometry=geo, texture=load_texture(a.texture, a.rp) if a.texture else None,
                                      name=geo.identifier), a.flags)]
    for spec in a.layer or []:
        gpath = spec[0]
        gid = None
        if "#" in gpath:
            gpath, gid = gpath.split("#", 1)
        ids2 = lib.add_file(gpath)
        g2 = lib.get(gid or ids2[0])
        tex = load_texture(spec[1], a.rp) if len(spec) > 1 and spec[1] not in ("-", "none") else None
        layers.append(parse_layer_flags(Layer(geometry=g2, texture=tex, name=g2.identifier),
                                        spec[2] if len(spec) > 2 else None))
    for w in lib.warnings:
        print("warning:", w, file=sys.stderr)
    for l in layers:
        for w in l.geometry.warnings:
            print("warning:", w, file=sys.stderr)
    return layers


def _plays_from_args(a) -> list[Play]:
    if not a.play:
        return []
    alib = load_animations(*(a.anim + [os.path.join(r, "animations") for r in a.rp
                                       if os.path.isdir(os.path.join(r, "animations"))]))
    for w in alib.warnings:
        print("warning:", w, file=sys.stderr)
    plays = []
    for spec in a.play:
        name, weight = (spec.split("@", 1) + [1.0])[:2] if "@" in spec else (spec, 1.0)
        try:
            weight = float(weight)
        except (TypeError, ValueError):
            pass
        plays.append(Play(alib.get(name), weight))
    return plays


def _report(info: dict):
    if info.get("missing"):
        print("note: Molang names evaluated as 0 (override with --query/--var): "
              + ", ".join(sorted(info["missing"])), file=sys.stderr)


def cmd_render(a):
    layers = _layers_from_args(a)
    plays = _plays_from_args(a)
    info: dict = {}
    img = render(layers, _camera_from_args(a), size=_size(a.size), background=a.bg, supersample=a.ss,
                 plays=plays, time=a.time, queries=_parse_kv(a.query), variables=_parse_kv(a.var),
                 ground=a.ground, shading=not a.noshade, show_pivots=a.pivots, axes=a.axes,
                 label=a.label, info=info)
    img.save(a.output)
    _report(info)
    lo, hi = info["bounds_geo"]
    print(f"wrote {a.output}  ({info['quads']} faces; posed bounds geo-space "
          f"x {lo[0]:g}..{hi[0]:g}  y {lo[1]:g}..{hi[1]:g}  z {lo[2]:g}..{hi[2]:g})")


def cmd_views(a):
    layers = _layers_from_args(a)
    plays = _plays_from_args(a)
    views = [v.strip() for v in a.views.split(",") if v.strip()]
    items = []
    info: dict = {}
    for v in views:
        cam = _camera_from_args(a, v)
        y, p = VIEWS[v]
        cam.yaw, cam.pitch = y, p
        items.append((v, render(layers, cam, size=_size(a.size), background=a.bg, supersample=a.ss,
                                plays=plays, time=a.time, queries=_parse_kv(a.query),
                                variables=_parse_kv(a.var), ground=a.ground, shading=not a.noshade,
                                show_pivots=a.pivots, axes=a.axes, info=info)))
    sheet = contact_sheet(items, cols=a.cols, title=a.label or layers[0].geometry.identifier)
    sheet.save(a.output)
    _report(info)
    print(f"wrote {a.output} ({len(items)} views)")


def cmd_anim(a):
    layers = _layers_from_args(a)
    plays = _plays_from_args(a)
    if not plays:
        raise SystemExit("anim: give at least one --play")
    times = _parse_times(a.times)
    frames = render_frames(layers, times, _camera_from_args(a), size=_size(a.size), plays=plays,
                           queries=_parse_kv(a.query), variables=_parse_kv(a.var), background=a.bg,
                           supersample=a.ss, ground=a.ground, shading=not a.noshade, axes=a.axes)
    title = a.label or (layers[0].geometry.identifier + "  " + " + ".join(p.animation.name for p in plays))
    contact_sheet(frames, cols=a.cols, title=title).save(a.output)
    print(f"wrote {a.output} ({len(frames)} frames)")
    if a.gif:
        save_gif([im for _, im in frames], a.gif, fps=a.fps)
        print(f"wrote {a.gif}")


def cmd_info(a):
    lib = GeometryLibrary()
    for p in a.lib:
        lib.add_dir(p) if os.path.isdir(p) else lib.add_file(p)
    ids = lib.add_file(a.model)
    for w in lib.warnings:
        print("warning:", w)
    print(f"{a.model}: {len(ids)} geometr{'y' if len(ids) == 1 else 'ies'}")
    for gid in ids:
        geo = lib.get(gid)
        ncubes = sum(len(b.cubes) for b in geo.bones)
        print(f"\n{gid}  format {geo.format_version}  texture {geo.texture_width:g}x{geo.texture_height:g}  "
              f"{len(geo.bones)} bones  {ncubes} cubes")
        for w in geo.warnings:
            print("  warning:", w)
        children: dict[str | None, list[Bone]] = {}
        keys = {b.key for b in geo.bones}
        for b in geo.bones:
            par = b.parent.lower() if b.parent and b.parent.lower() in keys else None
            children.setdefault(par, []).append(b)

        def show(b: Bone, depth):
            extra = []
            if any(b.rotation):
                extra.append(f"rot {list(b.rotation)}")
            if any(b.bind_pose_rotation):
                extra.append(f"bind_pose {list(b.bind_pose_rotation)}")
            if b.never_render:
                extra.append("neverRender")
            if b.mirror:
                extra.append("mirror")
            if b.inflate:
                extra.append(f"inflate {b.inflate:g}")
            print(f"  {'  ' * depth}{b.name}  pivot {list(b.pivot)}  cubes {len(b.cubes)}  {' '.join(extra)}")
            for c in children.get(b.key, []):
                show(c, depth + 1)
        for r in children.get(None, []):
            show(r, 0)
        quads = build_mesh(geo)
        if quads:
            pts = np.concatenate([q.verts for q in quads])
            print(f"  bind-pose bounds (geo space): x {-pts[:, 0].max():g}..{-pts[:, 0].min():g}  "
                  f"y {pts[:, 1].min():g}..{pts[:, 1].max():g}  z {pts[:, 2].min():g}..{pts[:, 2].max():g}")


def cmd_uvmap(a):
    lib = GeometryLibrary()
    for p in a.lib:
        lib.add_dir(p) if os.path.isdir(p) else lib.add_file(p)
    ids = lib.add_file(a.model)
    geo = lib.get(a.geometry or ids[0])
    tex = load_texture(a.texture, a.rp) if a.texture else None
    img, problems = uv_map_image(geo, tex, scale=a.scale)
    img.save(a.output)
    for p in problems:
        print("problem:", p)
    print(f"wrote {a.output}")


def cmd_entity(a):
    rp = ResourcePack(a.rp)
    layers, plays, variables, notes = entity_layers(rp, a.entity, _parse_kv(a.query), _parse_kv(a.var), a.time)
    for extra in a.play:
        alib = rp.anims
        for p in a.anim:
            alib.add_dir(p) if os.path.isdir(p) else alib.add_file(p)
        name, weight = (extra.split("@", 1) + [1.0])[:2] if "@" in extra else (extra, 1.0)
        plays.append(Play(alib.get(name), weight))
    if a.verbose:
        for n in notes:
            print("note:", n)
        for p in plays:
            print("play:", p.animation.name, "weight", p.weight)
    if not layers:
        raise SystemExit("no renderable layers: " + "; ".join(notes))
    if a.flags:
        parse_layer_flags(layers[0], a.flags)
    info: dict = {}
    if a.times:
        frames = render_frames(layers, _parse_times(a.times), _camera_from_args(a), size=_size(a.size),
                               plays=plays, queries=_parse_kv(a.query), variables=variables, background=a.bg,
                               supersample=a.ss, ground=a.ground, shading=not a.noshade, axes=a.axes)
        contact_sheet(frames, cols=a.cols, title=a.label or a.entity).save(a.output)
        if a.gif:
            save_gif([im for _, im in frames], a.gif, fps=a.fps)
    elif a.views:
        items = []
        for v in a.views.split(","):
            cam = _camera_from_args(a, v)
            cam.yaw, cam.pitch = VIEWS[v]
            items.append((v, render(layers, cam, size=_size(a.size), background=a.bg, supersample=a.ss,
                                    plays=plays, time=a.time, queries=_parse_kv(a.query), variables=variables,
                                    ground=a.ground, shading=not a.noshade, axes=a.axes, info=info)))
        contact_sheet(items, cols=a.cols, title=a.label or a.entity).save(a.output)
    else:
        img = render(layers, _camera_from_args(a), size=_size(a.size), background=a.bg, supersample=a.ss,
                     plays=plays, time=a.time, queries=_parse_kv(a.query), variables=variables,
                     ground=a.ground, shading=not a.noshade, show_pivots=a.pivots, axes=a.axes,
                     label=a.label, info=info)
        img.save(a.output)
    _report(info)
    print(f"wrote {a.output}")


def cmd_testcube(a):
    os.makedirs(a.outdir, exist_ok=True)
    for per_face in (True, False):
        geo_json, tex = make_orientation_test(per_face)
        tag = "perface" if per_face else "boxuv"
        gpath = os.path.join(a.outdir, f"orientation_test_{tag}.geo.json")
        tpath = os.path.join(a.outdir, f"orientation_test_{tag}.png")
        with open(gpath, "w") as fh:
            json.dump(geo_json, fh, indent=1)
        Image.fromarray(tex).save(tpath)
        lib = GeometryLibrary()
        lib.add_data(geo_json, gpath)
        layer = Layer(lib.get(), tex)
        items = render_views([layer], ("front", "right", "back", "left", "top", "bottom", "iso", "iso_back"),
                             size=200, ortho=False, axes=True, background="#404040")
        sheet = contact_sheet(items, cols=4, title=f"orientation test ({tag}); arm = entity's RIGHT, nose = FRONT, tail = BACK")
        out = os.path.join(a.outdir, f"orientation_test_{tag}_views.png")
        sheet.save(out)
        print("wrote", gpath, tpath, out)


def main(argv=None):
    ap = argparse.ArgumentParser(prog="georender", description=__doc__.split("\n\n")[0],
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)

    p = sub.add_parser("render", help="render one image")
    _common_args(p)
    p.add_argument("-o", "--output", required=True)
    p.set_defaults(func=cmd_render)

    p = sub.add_parser("views", help="contact sheet of several views")
    _common_args(p)
    p.add_argument("--views", default="front,right,back,left,top,iso")
    p.add_argument("--cols", type=int, default=None)
    p.add_argument("-o", "--output", required=True)
    p.set_defaults(func=cmd_views, size="256")

    p = sub.add_parser("anim", help="contact sheet (+ optional GIF) of animation frames")
    _common_args(p)
    p.add_argument("--times", default="0:1:6", help="t0,t1,... or start:end:count")
    p.add_argument("--cols", type=int, default=None)
    p.add_argument("--gif", default=None)
    p.add_argument("--fps", type=float, default=10.0)
    p.add_argument("-o", "--output", required=True)
    p.set_defaults(func=cmd_anim, size="256")

    p = sub.add_parser("info", help="print geometries, bone tree, bounds")
    p.add_argument("model")
    p.add_argument("--lib", action="append", default=[])
    p.set_defaults(func=cmd_info)

    p = sub.add_parser("uvmap", help="draw UV rects of a geometry over its texture")
    p.add_argument("model")
    p.add_argument("-g", "--geometry")
    p.add_argument("-t", "--texture")
    p.add_argument("--lib", action="append", default=[])
    p.add_argument("--rp", action="append", default=[])
    p.add_argument("--scale", type=int, default=8)
    p.add_argument("-o", "--output", required=True)
    p.set_defaults(func=cmd_uvmap)

    p = sub.add_parser("entity", help="render a client entity via its render controllers + animate list")
    p.add_argument("entity", help="client entity identifier (e.g. minecraft:cow) or .entity.json path")
    _common_args(p, model_required=False)
    p.add_argument("--flags", default="")
    p.add_argument("--times", default=None, help="render an animation sheet at these times")
    p.add_argument("--views", default=None, help="comma list of named views (contact sheet)")
    p.add_argument("--cols", type=int, default=None)
    p.add_argument("--gif", default=None)
    p.add_argument("--fps", type=float, default=10.0)
    p.add_argument("-v", "--verbose", action="store_true")
    p.add_argument("-o", "--output", required=True)
    p.set_defaults(func=cmd_entity)

    p = sub.add_parser("testcube", help="write + render the asymmetric orientation test model")
    p.add_argument("outdir")
    p.set_defaults(func=cmd_testcube)

    a = ap.parse_args(argv)
    a.func(a)


if __name__ == "__main__":
    main()
