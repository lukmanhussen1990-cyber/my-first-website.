#!/usr/bin/env python3
"""SCP-096 model: ONE cube table -> geometry.scp096 (.geo.json) + UV layout.

This module is the single source of truth for the model.  tools/make_texture.py
imports it (build_model(), face_rects()) so that every painted feature lands on
exactly the face the geometry uses.

Conventions (see DESIGN.md section 6/7, calibrated on vanilla files):
  * 16 px = 1 block, model +Y up, front of the model = -Z (north).
  * right_* bones live at -X, left_* bones at +X (vanilla zombie rightArm pivot x=-5).
  * Box UV is used for every cube (vanilla-proven `"uv": [u, v]`), all cube sizes are
    integers, so a cube of size (w, h, d) owns a cross-shaped UV area:
        up    = (u+d      , v    , w, d)      down  = (u+d+w    , v    , w, d)
        west  = (u        , v+d  , d, h)      north = (u+d      , v+d  , w, h)   (west = -X face)
        east  = (u+d+w    , v+d  , d, h)      south = (u+2d+w   , v+d  , w, h)   (east = +X face)
    This is the classic Java/Bedrock mob layout (first strip = the face on the mob's right
    side = -X).  Face canvases used by the painter are oriented "as seen from outside by an
    observer looking at the mob" (see CANVAS_AXES).

Run:  python3 tools/make_model.py        -> writes SCP096_RP/models/entity/scp096.geo.json
      python3 tools/make_model.py --report   (prints verification tables)
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from collections import OrderedDict

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
GEO_PATH = os.path.join(ROOT, "SCP096_RP", "models", "entity", "scp096.geo.json")

TEX_W = 128
TEX_H = 128
GEOMETRY_ID = "geometry.scp096"
GUTTER = 1  # empty texels kept between UV islands (they are bled by the texture script)

# --------------------------------------------------------------------------------------
# Skeleton.  Names / parents are FIXED by DESIGN.md section 6.  Pivots are design choices.
# --------------------------------------------------------------------------------------
HIP_Y = 22.0
KNEE_Y = 11.0
SHOULDER_Y = 32.0
ELBOW_Y = 22.0
WRIST_Y = 12.0
ARM_X = 5.0
LEG_X = 2.0
NECK_Y = 34.0
JAW_PIVOT = (0.0, 37.0, 1.0)

BONES = OrderedDict()


def _bone(name, parent, pivot):
    BONES[name] = {"name": name, "parent": parent, "pivot": list(pivot)}


_bone("root", None, (0, 0, 0))
_bone("waist", "root", (0, HIP_Y, 0))
_bone("torso", "waist", (0, 24, 0))
_bone("head", "torso", (0, NECK_Y, 0.5))
_bone("jaw", "head", JAW_PIVOT)
for _s, _sx in (("left", 1), ("right", -1)):
    _bone(f"{_s}_arm", "torso", (_sx * ARM_X, SHOULDER_Y, 0))
    _bone(f"{_s}_forearm", f"{_s}_arm", (_sx * ARM_X, ELBOW_Y, 0))
    _bone(f"{_s}_hand", f"{_s}_forearm", (_sx * ARM_X, WRIST_Y, 0))
    _bone(f"{_s}_leg", "waist", (_sx * LEG_X, HIP_Y, 0))
    _bone(f"{_s}_shin", f"{_s}_leg", (_sx * LEG_X, KNEE_Y, 0))

# --------------------------------------------------------------------------------------
# Cube table.  Each entry: bone, name, kind (painter key), origin, size (ints!), side (-1/0/+1)
# --------------------------------------------------------------------------------------
CUBES = []


def cube(bone, name, kind, origin, size, side=0, **extra):
    for s in size:
        assert float(s).is_integer() and s >= 1, f"{name}: box-UV needs integer sizes >= 1, got {size}"
    c = dict(bone=bone, name=name, kind=kind, origin=list(map(float, origin)),
             size=[int(s) for s in size], side=side)
    c.update(extra)
    CUBES.append(c)
    return c


def mirrored(c, bone, name):
    """Return a copy of cube c mirrored about x=0 and re-homed to another bone."""
    ox, oy, oz = c["origin"]
    sx, sy, sz = c["size"]
    n = dict(c)
    n["bone"] = bone
    n["name"] = name
    n["origin"] = [-(ox + sx), oy, oz]
    n["side"] = -c["side"]
    CUBES.append(n)
    return n


def _build_cube_table():
    CUBES.clear()
    # ---------------- pelvis (waist bone) ----------------
    cube("waist", "pelvis", "pelvis", (-3.5, 20, -2), (7, 4, 4))

    # ---------------- torso ----------------
    cube("torso", "abdomen", "abdomen", (-2.5, 23, -1.5), (5, 3, 3))
    cube("torso", "ribcage", "ribcage", (-3.5, 26, -2.5), (7, 7, 5))
    for i, y in enumerate((27, 29, 31)):
        cube("torso", f"rib_ring_{i}", "rib_ring", (-4, y, -3), (8, 1, 6))
    for i, (y, z) in enumerate(((24, 1.5), (27, 3.0), (29, 3.0), (31, 3.0))):
        cube("torso", f"spine_knob_{i}", "spine", (-0.5, y, z), (1, 1, 1))

    # ---------------- head + neck ----------------
    # head bone = neck + tall hairless skull (7 wide, 7 high, 7 deep) + brow ridge + ears + the static half of the
    # mouth (throat wall + upper teeth).  The lower jaw is its own bone (hinge near the back of the jaw).
    cube("head", "neck", "neck", (-1.5, 33, -1.5), (3, 4, 3))
    cube("head", "cranium", "cranium", (-3.5, 38, -3.5), (7, 7, 7))
    # brow ridge: 0.65 px proud of the face; the tiny negative inflate keeps its side faces off the cranium planes
    cube("head", "brow", "brow", (-3, 43, -4.25), (6, 1, 1), inflate=-0.1)
    cube("head", "ear_left", "ear", (3.5, 40, 0), (1, 2, 1), side=1)
    cube("head", "ear_right", "ear", (-4.5, 40, 0), (1, 2, 1), side=-1)
    cube("head", "throat", "throat", (-2.5, 36.5, 0), (5, 2, 1))
    # upper teeth: bottoms stay >= 0.5 px above the chin plane (y=35) so nothing is coplanar with the jaw;
    # every tooth keeps >= 0.5 px distance from the side planes x=+-3.5 and the front plane z=-3.5
    for i, (x, h, z) in enumerate(((-2.5, 3, -3), (-0.5, 2, -3), (1.0, 3, -3))):
        cube("head", f"tooth_up_{i}", "tooth_up", (x, 38.5 - h, z), (1, h, 1))
    cube("head", "tooth_up_side_l", "tooth_up", (2.0, 36.5, -1.5), (1, 2, 1))
    cube("head", "tooth_up_side_r", "tooth_up", (-3.0, 36.5, -1.5), (1, 2, 1))
    # lower jaw (hinge bone)
    cube("jaw", "jaw", "jaw", (-3.5, 35, -4), (7, 3, 6))
    for i, (x, h, z) in enumerate(((-1.5, 2, -1.5), (0.5, 3, -1.5))):
        cube("jaw", f"tooth_lo_{i}", "tooth_lo", (x, 37.5, z), (1, h, 1))
    cube("jaw", "tooth_lo_side_l", "tooth_lo", (2.0, 37.5, 0.5), (1, 2, 1))
    cube("jaw", "tooth_lo_side_r", "tooth_lo", (-3.0, 37.5, 0.5), (1, 2, 1))

    # ---------------- arms (left built, right mirrored) ----------------
    la = []
    la.append(cube("left_arm", "l_upper_arm", "upper_arm", (ARM_X - 1, 22, -1), (2, 11, 2), side=1))
    la.append(cube("left_forearm", "l_elbow", "elbow", (ARM_X - 1.5, 21, -1.5), (3, 2, 3), side=1))
    la.append(cube("left_forearm", "l_forearm", "forearm", (ARM_X - 1, 12, -1), (2, 10, 2), side=1))
    la.append(cube("left_hand", "l_palm", "palm", (ARM_X - 1.5, 10, -1), (3, 2, 2), side=1))
    # three long thin fingers (lengths 5,6,5 px); a tiny negative inflate leaves a visible gap between them.
    # finger 0 is the inner one (towards the body); the thumb sits in front of the palm.
    for i, (dx, ln) in enumerate(((-1.5, 5), (-0.5, 6), (0.5, 5))):
        la.append(cube("left_hand", f"l_finger_{i}", "finger", (ARM_X + dx, 10 - ln, -0.5), (1, ln, 1),
                       side=1, finger=i, length=ln, inflate=-0.12))
    la.append(cube("left_hand", "l_thumb", "thumb", (ARM_X - 1.5, 8, -2), (1, 3, 1), side=1, inflate=-0.1))
    for c in la:
        bone = c["bone"].replace("left_", "right_")
        mirrored(c, bone, c["name"].replace("l_", "r_", 1))

    # ---------------- legs (left built, right mirrored) ----------------
    ll = []
    ll.append(cube("left_leg", "l_thigh", "thigh", (LEG_X - 1, 11, -1), (2, 11, 2), side=1))
    ll.append(cube("left_shin", "l_knee", "knee", (LEG_X - 0.5, 10, -1.5), (1, 2, 2), side=1))
    ll.append(cube("left_shin", "l_shin", "shin", (LEG_X - 1, 2, -1), (2, 9, 2), side=1))
    ll.append(cube("left_shin", "l_foot", "foot", (LEG_X - 1.5, 0, -6), (3, 2, 8), side=1))
    ll.append(cube("left_shin", "l_toes", "toes", (LEG_X - 1.5, 0, -8), (3, 1, 2), side=1))
    for c in ll:
        bone = c["bone"].replace("left_", "right_")
        mirrored(c, bone, c["name"].replace("l_", "r_", 1))


_build_cube_table()

# --------------------------------------------------------------------------------------
# UV packing (box UV, automatic, deterministic)
# --------------------------------------------------------------------------------------


def face_rects(c):
    """Texel rectangles (x, y, w, h) of the six faces of cube c (needs c['uv'])."""
    u, v = c["uv"]
    w, h, d = c["size"]
    return OrderedDict([
        ("up", (u + d, v, w, d)),
        ("down", (u + d + w, v, w, d)),
        ("west", (u, v + d, d, h)),
        ("north", (u + d, v + d, w, h)),
        ("east", (u + d + w, v + d, d, h)),
        ("south", (u + 2 * d + w, v + d, w, h)),
    ])


# Painter canvas orientation: for each face, which model axis the canvas columns / rows follow,
# as seen from OUTSIDE the face by someone looking at the mob (net unfolded around the front face):
#   north: col -> +X, row -> -Y        south: col -> -X, row -> -Y
#   west : col -> -Z (towards front), row -> -Y      east : col -> +Z (towards back), row -> -Y
#   up   : col -> +X, row -> -Z (towards front)      down : col -> +X, row -> +Z (towards back)
CANVAS_AXES = {
    "north": ("+x", "-y"), "south": ("-x", "-y"),
    "west": ("-z", "-y"), "east": ("+z", "-y"),
    "up": ("+x", "-z"), "down": ("+x", "+z"),
}


def pack_uvs(cubes, tex_w=TEX_W, tex_h=TEX_H, gutter=GUTTER):
    """Shelf-pack the bounding box (2(d+w) x (d+h)) of every cube. Deterministic."""
    items = []
    for i, c in enumerate(cubes):
        w, h, d = c["size"]
        items.append((i, 2 * (d + w), d + h))
    # tallest first, then widest, then table order (stable)
    items.sort(key=lambda t: (-t[2], -t[1], t[0]))
    x = y = shelf_h = 0
    for i, bw, bh in items:
        if x + bw > tex_w:
            x = 0
            y += shelf_h + gutter
            shelf_h = 0
        assert bw <= tex_w, "cube too wide for the texture"
        cubes[i]["uv"] = [x, y]
        x += bw + gutter
        shelf_h = max(shelf_h, bh)
    used_h = y + shelf_h
    assert used_h <= tex_h, f"UV layout does not fit: needs {used_h} rows, have {tex_h}"
    return used_h


def uv_coverage(cubes, tex_w=TEX_W, tex_h=TEX_H):
    """Return per-texel face coverage count and a list of out-of-range faces."""
    cov = np.zeros((tex_h, tex_w), dtype=np.int32)
    bad = []
    for c in cubes:
        for fname, (x, y, w, h) in face_rects(c).items():
            if x < 0 or y < 0 or x + w > tex_w or y + h > tex_h:
                bad.append((c["name"], fname, (x, y, w, h)))
                continue
            cov[y:y + h, x:x + w] += 1
    return cov, bad


def check_uvs(cubes):
    cov, bad = uv_coverage(cubes)
    assert not bad, f"UV faces out of range: {bad}"
    assert cov.max() <= 1, f"overlapping UV faces: {int((cov > 1).sum())} texels"
    # gutter check: every face rect inflated by 1 must not touch another cube's face
    owner = -np.ones((TEX_H, TEX_W), dtype=np.int32)
    for i, c in enumerate(cubes):
        for fname, (x, y, w, h) in face_rects(c).items():
            owner[y:y + h, x:x + w] = i
    touching = 0
    for i, c in enumerate(cubes):
        for fname, (x, y, w, h) in face_rects(c).items():
            x0, y0, x1, y1 = max(x - 1, 0), max(y - 1, 0), min(x + w + 1, TEX_W), min(y + h + 1, TEX_H)
            region = owner[y0:y1, x0:x1]
            others = np.unique(region[(region >= 0) & (region != i)])
            touching += len(others)
    return cov, touching


# --------------------------------------------------------------------------------------
# Model assembly + diagnostics
# --------------------------------------------------------------------------------------


def build_model():
    """Return (bones, cubes) with UVs assigned.  Pure function of this file."""
    _build_cube_table()
    pack_uvs(CUBES)
    check_uvs(CUBES)
    return BONES, CUBES


def cube_bounds(c):
    inf = float(c.get("inflate", 0.0))
    o = np.array(c["origin"], dtype=float) - inf
    s = np.array(c["size"], dtype=float) + 2 * inf
    return o, o + s


def coplanar_overlaps(cubes):
    """Pairs of same-direction faces lying in the same plane with overlapping area (z-fight risk)."""
    faces = []
    for ci, c in enumerate(cubes):
        lo, hi = cube_bounds(c)
        for axis in range(3):
            for sign, coord in ((-1, lo[axis]), (+1, hi[axis])):
                a1, a2 = [k for k in range(3) if k != axis]
                faces.append((ci, axis, sign, coord, (lo[a1], hi[a1]), (lo[a2], hi[a2])))
    out = []
    for i in range(len(faces)):
        for j in range(i + 1, len(faces)):
            fa, fb = faces[i], faces[j]
            if fa[0] == fb[0] or fa[1] != fb[1] or fa[2] != fb[2] or abs(fa[3] - fb[3]) > 1e-6:
                continue
            o1 = min(fa[4][1], fb[4][1]) - max(fa[4][0], fb[4][0])
            o2 = min(fa[5][1], fb[5][1]) - max(fa[5][0], fb[5][0])
            if o1 > 1e-6 and o2 > 1e-6:
                out.append((cubes[fa[0]]["name"], cubes[fb[0]]["name"], "xyz"[fa[1]], "-+"[(fa[2] + 1) // 2],
                            fa[3], round(o1 * o2, 3)))
    return out


# --------------------------------------------------------------------------------------
# JSON emission (strict JSON, 2-space indent, inline number arrays)
# --------------------------------------------------------------------------------------


def _n(v):
    v = round(float(v), 4)
    if v == int(v):
        return str(int(v))
    return repr(v)


def _arr(a):
    return "[" + ", ".join(_n(x) for x in a) + "]"


def geo_json_text(bones, cubes):
    by_bone = OrderedDict((b, []) for b in bones)
    for c in cubes:
        by_bone[c["bone"]].append(c)
    lines = []
    lines.append("{")
    lines.append('  "format_version": "1.12.0",')
    lines.append('  "minecraft:geometry": [')
    lines.append("    {")
    lines.append('      "description": {')
    lines.append(f'        "identifier": "{GEOMETRY_ID}",')
    lines.append(f'        "texture_width": {TEX_W},')
    lines.append(f'        "texture_height": {TEX_H},')
    lines.append('        "visible_bounds_width": 4,')
    lines.append('        "visible_bounds_height": 4,')
    lines.append('        "visible_bounds_offset": [0, 1.5, 0]')
    lines.append("      },")
    lines.append('      "bones": [')
    bone_blocks = []
    for name, b in bones.items():
        L = ["        {", f'          "name": "{name}",']
        if b["parent"]:
            L.append(f'          "parent": "{b["parent"]}",')
        cs = by_bone[name]
        if cs:
            L.append(f'          "pivot": {_arr(b["pivot"])},')
            L.append('          "cubes": [')
            cl = []
            for c in cs:
                infl = (', "inflate": %s' % _n(c["inflate"])) if c.get("inflate") else ""
                cl.append('            {"origin": %s, "size": %s%s, "uv": %s}' % (
                    _arr(c["origin"]), _arr(c["size"]), infl, _arr(c["uv"])))
            L.append(",\n".join(cl))
            L.append("          ]")
        else:
            L.append(f'          "pivot": {_arr(b["pivot"])}')
        L.append("        }")
        bone_blocks.append("\n".join(L))
    lines.append(",\n".join(bone_blocks))
    lines.append("      ]")
    lines.append("    }")
    lines.append("  ]")
    lines.append("}")
    return "\n".join(lines) + "\n"


def write_geo(path=GEO_PATH):
    bones, cubes = build_model()
    text = geo_json_text(bones, cubes)
    json.loads(text)  # strict JSON sanity
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8", newline="\n") as f:
        f.write(text)
    return path


def report():
    bones, cubes = build_model()
    cov, touching = check_uvs(cubes)
    print(f"cubes: {len(cubes)}   bones: {len(bones)}")
    print(f"UV: texture {TEX_W}x{TEX_H}, covered texels {int((cov > 0).sum())} "
          f"({100.0 * (cov > 0).sum() / (TEX_W * TEX_H):.1f}%), max overlap {int(cov.max())}, "
          f"face pairs closer than the gutter: {touching}")
    # per-bone table
    print(f"{'bone':14s} {'parent':10s} {'pivot':18s} cube extents (min..max)")
    for name, b in bones.items():
        cs = [c for c in cubes if c["bone"] == name]
        if cs:
            lo = np.min([cube_bounds(c)[0] for c in cs], axis=0)
            hi = np.max([cube_bounds(c)[1] for c in cs], axis=0)
            ext = f"x[{_n(lo[0])},{_n(hi[0])}] y[{_n(lo[1])},{_n(hi[1])}] z[{_n(lo[2])},{_n(hi[2])}]  ({len(cs)} cubes)"
        else:
            ext = "-"
        print(f"{name:14s} {str(b['parent']):10s} {_arr(b['pivot']):18s} {ext}")
    allo = np.min([cube_bounds(c)[0] for c in cubes], axis=0)
    allh = np.max([cube_bounds(c)[1] for c in cubes], axis=0)
    print("overall extents  x[%s,%s] y[%s,%s] z[%s,%s]" % (_n(allo[0]), _n(allh[0]), _n(allo[1]), _n(allh[1]),
                                                           _n(allo[2]), _n(allh[2])))
    print(f"standing height (sole -> top of head): {allh[1] - allo[1]} px = {(allh[1] - allo[1]) / 16:.3f} blocks")
    hc = [c for c in cubes if c["bone"] in ("head", "jaw")]
    hlo = np.min([cube_bounds(c)[0] for c in hc], axis=0)
    hhi = np.max([cube_bounds(c)[1] for c in hc], axis=0)
    print("head (head+jaw bones incl. neck) extents:", hlo, hhi, " centre y = %.2f px = %.3f blocks" % (
        (hlo[1] + hhi[1]) / 2, (hlo[1] + hhi[1]) / 32))
    sk = [c for c in cubes if c["kind"] in ("cranium", "brow", "jaw")]
    slo = np.min([cube_bounds(c)[0] for c in sk], axis=0)
    shi = np.max([cube_bounds(c)[1] for c in sk], axis=0)
    print("skull+jaw (no neck/ears/teeth) extents:", slo, shi, " centre y = %.2f px = %.3f blocks" % (
        (slo[1] + shi[1]) / 2, (slo[1] + shi[1]) / 32))
    cr = [c for c in cubes if c["kind"] in ("cranium", "brow")]
    clo = np.min([cube_bounds(c)[0] for c in cr], axis=0)
    chi = np.max([cube_bounds(c)[1] for c in cr], axis=0)
    print("cranium(+brow) extents:", clo, chi)
    tips = []
    for c in cubes:
        if c["kind"] == "finger":
            tips.append(c["origin"][1])
    print(f"finger tips y = {min(tips)} px (knee y = {KNEE_Y}), lowest foot y = {allo[1]}")
    cp = coplanar_overlaps(cubes)
    print(f"coplanar same-direction overlapping faces (z-fight risk): {len(cp)}")
    for t in cp:
        print("   ", t)
    return bones, cubes


EXPECTED_BONES = OrderedDict([  # DESIGN.md section 6: name -> parent (None = no parent)
    ("root", None), ("waist", "root"), ("torso", "waist"), ("head", "torso"), ("jaw", "head"),
    ("left_arm", "torso"), ("left_forearm", "left_arm"), ("left_hand", "left_forearm"),
    ("right_arm", "torso"), ("right_forearm", "right_arm"), ("right_hand", "right_forearm"),
    ("left_leg", "waist"), ("left_shin", "left_leg"), ("right_leg", "waist"), ("right_shin", "right_leg"),
])
VANILLA_GEO_DIR = "/home/user/mojang/bedrock-samples/resource_pack/models/entity"


def _no_dupes(pairs):
    d = {}
    for k, v in pairs:
        if k in d:
            raise ValueError(f"duplicate JSON key {k!r}")
        d[k] = v
    return d


def _vanilla_112_keys():
    """Union of bone / cube / description keys used by vanilla format 1.12.0 geometry files."""
    import glob
    import re
    bk, ck, dk = set(), set(), set()
    for f in glob.glob(os.path.join(VANILLA_GEO_DIR, "*.geo.json")):
        t = open(f, encoding="utf-8").read()
        try:
            d = json.loads(t)
        except ValueError:
            d = json.loads(re.sub(r",\s*([}\]])", r"\1", re.sub(r"//[^\n]*", "", t)))
        if "minecraft:geometry" not in d:
            continue
        for g in d["minecraft:geometry"]:
            dk |= set(g["description"])
            for b in g["bones"]:
                bk |= set(b)
                for c in b.get("cubes", []):
                    ck |= set(c)
    return bk, ck, dk


def verify(path=GEO_PATH, texture_path=None):
    """Hard checks; raises AssertionError on the first problem, prints a summary otherwise."""
    raw = open(path, "rb").read()
    assert not raw.startswith(b"\xef\xbb\xbf"), "BOM"
    assert b"\r" not in raw, "CRLF"
    assert raw.endswith(b"}\n") and not raw.endswith(b"\n\n"), "must end with a single newline"
    def _bad(c):
        raise ValueError("non-finite number " + c)
    data = json.loads(raw.decode("utf-8"), object_pairs_hook=_no_dupes, parse_constant=_bad)
    assert data["format_version"] == "1.12.0"
    assert list(data) == ["format_version", "minecraft:geometry"]
    geos = data["minecraft:geometry"]
    assert len(geos) == 1
    g = geos[0]
    desc = g["description"]
    assert desc == {"identifier": "geometry.scp096", "texture_width": 128, "texture_height": 128,
                    "visible_bounds_width": 4, "visible_bounds_height": 4, "visible_bounds_offset": [0, 1.5, 0]}, desc
    # bones: names, parents, order
    names = [b["name"] for b in g["bones"]]
    assert len(set(names)) == len(names), "duplicate bone names"
    assert set(names) == set(EXPECTED_BONES), (set(names) ^ set(EXPECTED_BONES))
    seen = set()
    for b in g["bones"]:
        assert b.get("parent") == EXPECTED_BONES[b["name"]], (b["name"], b.get("parent"))
        if b.get("parent"):
            assert b["parent"] in seen, f"{b['name']}: parent {b['parent']} must be defined first"
        seen.add(b["name"])
        assert len(b["pivot"]) == 3
    # keys must be a subset of what vanilla 1.12.0 geometry files use (and of the blockception schema)
    if os.path.isdir(VANILLA_GEO_DIR):
        vb, vc, vd = _vanilla_112_keys()
        for b in g["bones"]:
            assert set(b) <= vb, f"bone keys not used by vanilla 1.12.0: {set(b) - vb}"
            for c in b.get("cubes", []):
                assert set(c) <= vc, f"cube keys not used by vanilla 1.12.0: {set(c) - vc}"
        assert set(desc) <= vd, set(desc) - vd
    # UV
    cubes = []
    for b in g["bones"]:
        for c in b.get("cubes", []):
            assert all(float(x).is_integer() and x >= 1 for x in c["size"]), c
            assert all(float(x).is_integer() and x >= 0 for x in c["uv"]), c
            cubes.append(dict(name=b["name"], size=c["size"], uv=c["uv"]))
    cov, bad = uv_coverage(cubes)
    assert not bad, bad
    assert cov.max() == 1, "UV overlap"
    # texture size == description
    tp = texture_path or os.path.join(ROOT, "SCP096_RP", "textures", "entity", "scp096.png")
    if os.path.exists(tp):
        from PIL import Image
        with Image.open(tp) as im:
            assert im.size == (desc["texture_width"], desc["texture_height"]), im.size
    return data


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument("--report", action="store_true")
    ap.add_argument("--verify", action="store_true", help="strict checks of the written .geo.json")
    ap.add_argument("--out", default=GEO_PATH)
    a = ap.parse_args(argv)
    p = write_geo(a.out)
    print("wrote", p)
    if a.report:
        report()
    if a.verify:
        verify(a.out)
        print("verify OK: strict JSON, LF/no BOM, format 1.12.0, description, 15 bones + parents exactly as DESIGN.md "
              "section 6, only vanilla-proven keys, integer box-UV sizes, UV in range and non-overlapping, "
              "texture size == description")


if __name__ == "__main__":
    main()
