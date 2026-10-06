#!/usr/bin/env python3
"""Tactical torchlight held-item model: part list, UV atlas layout and geometry writer.

The model is built from Minecraft-style boxes (1 texel per model unit) and written
as a 1.16.0 geometry with per-face UVs:

  addon/resource_pack/models/entity/pas_tactical_torchlight.geo.json
      geometry.pas.tactical_torchlight

Local design frame (used throughout tools/art/torchlight):
  L  = distance along the torch from the rear face of the tail cap (L grows toward the lens)
  x  = across (+x = geo +X), y = up, both centred on the torch axis.
Geometry ("attachable") space: X = x, Y = 24 + y, Z = GRIP_L - L, so the lens points to
geo -Z (the "north"/front face) and the grip centre sits at (0, 24, 0), the bone pivot.
(0, 24, 0) is the point that lands on the bound hand bone's pivot (see docs/TORCHLIGHT_MODEL.md).
Bones: "torch_anchor" (root, binding to the hand bone, no cubes) -> "torch" (all cubes).

Usage: python3 tools/art/torchlight/torch_model.py      (writes the .geo.json)
Deterministic output; imported by make_torch_texture.py, solve_transforms.py and
render_previews.py.
"""
from __future__ import annotations

import json
import math
import re
import sys
from dataclasses import dataclass
from pathlib import Path

sys.dont_write_bytecode = True

ROOT = Path(__file__).resolve().parents[3]
GEO_PATH = ROOT / "addon" / "resource_pack" / "models" / "entity" / "pas_tactical_torchlight.geo.json"
GEO_ID = "geometry.pas.tactical_torchlight"
ANCHOR_BONE = "torch_anchor"   # root, bound to the hand bone; animated with fixed derived constants
BONE = "torch"                 # child of the anchor, carries the cubes and the tweakable hold pose
TEX_W = TEX_H = 64          # texture size in texels == geometry texture units (1 texel / unit)
GRIP_L = 5.0                # L of the grip centre (the bone pivot / where the fist closes)
PIVOT = (0.0, 24.0, 0.0)

FACES = ("north", "south", "east", "west", "up", "down")


@dataclass(frozen=True)
class Part:
    name: str               # unique cube name (used for UV bookkeeping and docs)
    style: str              # paint style, see make_torch_texture.py
    x: tuple[float, float]
    y: tuple[float, float]
    L: tuple[float, float]
    faces: tuple[str, ...] = FACES

    # geometry-space box -------------------------------------------------
    @property
    def origin(self) -> tuple[float, float, float]:
        return (self.x[0], PIVOT[1] + self.y[0], GRIP_L - self.L[1])

    @property
    def size(self) -> tuple[float, float, float]:
        return (self.x[1] - self.x[0], self.y[1] - self.y[0], self.L[1] - self.L[0])


def _sym(h: float) -> tuple[float, float]:
    return (-h, h)


# Tail (L<0) -> lens (L=11).  Overall length 11.5 units, head/bezel 6x6, body 3x3.
PARTS: tuple[Part, ...] = (
    # clicky tail switch (rubber boot) protruding from the tail cap
    Part("button", "button", _sym(1.0), _sym(1.0), (-0.5, 0.0)),
    # tail cap, slightly wider than the body, scalloped/knurled
    Part("tail_cap", "cap", _sym(2.0), _sym(2.0), (0.0, 2.0)),
    # red anodised switch band
    Part("switch_band", "band", _sym(1.65), _sym(1.65), (2.0, 3.0)),
    # ribbed grip: 3x3 core + four raised rings
    Part("grip", "grip", _sym(1.5), _sym(1.5), (3.0, 7.0)),
    Part("rib_1", "rib", _sym(1.75), _sym(1.75), (3.25, 3.75)),
    Part("rib_2", "rib", _sym(1.75), _sym(1.75), (4.25, 4.75)),
    Part("rib_3", "rib", _sym(1.75), _sym(1.75), (5.25, 5.75)),
    Part("rib_4", "rib", _sym(1.75), _sym(1.75), (6.25, 6.75)),
    # collar flaring into the head
    Part("collar", "collar", _sym(2.0), _sym(2.0), (7.0, 8.0)),
    # head shell with cooling fins
    Part("head", "head", _sym(2.5), _sym(2.5), (8.0, 10.0)),
    # knurled bezel ring: a 6x6 frame with a 4x4 opening (four bars)
    Part("bezel_top", "bezel", _sym(3.0), (2.0, 3.0), (10.0, 11.0)),
    Part("bezel_bottom", "bezel", _sym(3.0), (-3.0, -2.0), (10.0, 11.0)),
    Part("bezel_left", "bezel", (2.0, 3.0), _sym(2.0), (10.0, 11.0)),
    Part("bezel_right", "bezel", (-3.0, -2.0), _sym(2.0), (10.0, 11.0)),
    # glass lens recessed 0.5 behind the bezel's front face
    Part("lens", "lens", _sym(2.0), _sym(2.0), (10.0, 10.5)),
    # pocket clip on top of the body: mount on the band, bar, bent tip
    Part("clip_mount", "clip_dark", _sym(0.5), (1.5, 2.25), (2.1, 2.9)),
    Part("clip_bar", "clip", _sym(0.5), (2.25, 2.75), (2.1, 6.6)),
    Part("clip_tip", "clip_dark", _sym(0.5), (1.75, 2.25), (6.1, 6.6)),
    # lanyard ring hanging under the tail cap
    Part("lanyard_rear", "ring", _sym(0.25), (-3.0, -2.0), (0.25, 0.75)),
    Part("lanyard_front", "ring", _sym(0.25), (-3.0, -2.0), (1.25, 1.75)),
    Part("lanyard_bottom", "ring", _sym(0.25), (-3.5, -3.0), (0.25, 1.75)),
)

LENGTH = max(p.L[1] for p in PARTS) - min(p.L[0] for p in PARTS)


# ---------------------------------------------------------------------------
# Face geometry helpers (per-face UV conventions: tools/georender/README.md)
# ---------------------------------------------------------------------------

def face_dims(part: Part, face: str) -> tuple[float, float]:
    """(width, height) of a face in texture units (u extent, v extent)."""
    w, h, d = part.size
    return {
        "north": (w, h), "south": (w, h),
        "east": (d, h), "west": (d, h),
        "up": (w, d), "down": (w, d),
    }[face]


def face_point(part: Part, face: str, a: float, b: float) -> tuple[float, float, float]:
    """Geo-space point on ``face`` at texture fraction (a along u, b along v), 0..1 from the
    face's UV origin.  Conventions (verified by tools/georender, Blockbench-compatible):
      north: u -> +X, v -> -Y      south: u -> -X, v -> -Y
      east (-X side): u -> -Z      west (+X side): u -> +Z      (v -> -Y)
      up:   u -> +X, v -> -Z (top edge at the back)
      down: u -> +X, v -> +Z (top edge at the front)"""
    x0, y0, z0 = part.origin
    w, h, d = part.size
    x1, y1, z1 = x0 + w, y0 + h, z0 + d
    if face == "north":
        return (x0 + a * w, y1 - b * h, z0)
    if face == "south":
        return (x1 - a * w, y1 - b * h, z1)
    if face == "east":
        return (x0, y1 - b * h, z1 - a * d)
    if face == "west":
        return (x1, y1 - b * h, z0 + a * d)
    if face == "up":
        return (x0 + a * w, y1, z1 - b * d)
    if face == "down":
        return (x0 + a * w, y0, z0 + b * d)
    raise ValueError(face)


def to_local(p: tuple[float, float, float]) -> tuple[float, float, float]:
    """Geo point -> (x, y, L) in the design frame."""
    return (p[0], p[1] - PIVOT[1], GRIP_L - p[2])


# ---------------------------------------------------------------------------
# UV atlas: shelf packing, 1 texel per unit, 1-texel gutter between cells
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class Cell:
    part: Part
    face: str
    u: int
    v: int
    w: float     # face extent in texels (may be fractional)
    h: float

    @property
    def cw(self) -> int:
        return max(1, math.ceil(self.w - 1e-6))

    @property
    def ch(self) -> int:
        return max(1, math.ceil(self.h - 1e-6))


def atlas() -> list[Cell]:
    items = []
    for p in PARTS:
        for f in p.faces:
            w, h = face_dims(p, f)
            items.append((p, f, w, h))
    # tallest first, then widest: compact shelves
    items.sort(key=lambda t: (-max(1, math.ceil(t[3] - 1e-6)), -max(1, math.ceil(t[2] - 1e-6)), t[0].name, t[1]))
    cells: list[Cell] = []
    x = y = 0
    shelf_h = 0
    gutter = 1
    for p, f, w, h in items:
        cw, ch = max(1, math.ceil(w - 1e-6)), max(1, math.ceil(h - 1e-6))
        if x + cw > TEX_W:
            x = 0
            y += shelf_h + gutter
            shelf_h = 0
        if y + ch > TEX_H:
            raise RuntimeError("UV atlas overflow")
        cells.append(Cell(p, f, x, y, w, h))
        x += cw + gutter
        shelf_h = max(shelf_h, ch)
    return cells


def _r(v: float) -> float:
    v = round(float(v), 4)
    return int(v) if v == int(v) else v


def dumps_compact(obj) -> str:
    """Strict JSON, 2-space indent, with numeric arrays kept on one line."""
    text = json.dumps(obj, indent=2)
    return re.sub(r"\[\s*(-?[\d.]+(?:,\s*-?[\d.]+)*)\s*\]",
                  lambda m: "[" + ", ".join(x.strip() for x in m.group(1).split(",")) + "]", text)


def geometry_json() -> dict:
    cells = {(c.part.name, c.face): c for c in atlas()}
    cubes = []
    for p in PARTS:
        uv = {}
        for f in p.faces:
            c = cells[(p.name, f)]
            uv[f] = {"uv": [_r(c.u), _r(c.v)], "uv_size": [_r(c.w), _r(c.h)]}
        cubes.append({"origin": [_r(v) for v in p.origin], "size": [_r(v) for v in p.size], "uv": uv})
    return {
        "format_version": "1.16.0",
        "minecraft:geometry": [
            {
                "description": {
                    "identifier": GEO_ID,
                    "texture_width": TEX_W,
                    "texture_height": TEX_H,
                    # generous, like vanilla geometry.spyglass: never cull a held item early
                    "visible_bounds_width": 3,
                    "visible_bounds_height": 3,
                    "visible_bounds_offset": [0, 1.5, 0],
                },
                "bones": [
                    {
                        "name": ANCHOR_BONE,
                        "binding": "q.item_slot_to_bone_name(c.item_slot)",
                        "pivot": [_r(v) for v in PIVOT],
                    },
                    {
                        "name": BONE,
                        "parent": ANCHOR_BONE,
                        "pivot": [_r(v) for v in PIVOT],
                        "cubes": cubes,
                    },
                ],
            }
        ],
    }


def write_geometry(path: Path = GEO_PATH) -> Path:
    path.parent.mkdir(parents=True, exist_ok=True)
    text = dumps_compact(geometry_json()) + "\n"
    path.write_text(text, encoding="utf-8")
    return path


def main() -> int:
    p = write_geometry()
    cells = atlas()
    used_h = max(c.v + c.ch for c in cells)
    print(f"wrote {p.relative_to(ROOT)}: {len(PARTS)} cubes, length {LENGTH} units, atlas {TEX_W}x{TEX_H} (rows used: {used_h})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
