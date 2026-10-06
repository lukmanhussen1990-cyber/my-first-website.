"""pas:parasite model definition: joints, cubes, bones and UV layout.

Shared by make_parasite.py (writes the .geo.json and paints the texture) and
render_previews.py.  Everything here is original design data.

Conventions (tools/georender/README.md, CONVENTIONS): 16 units = 1 block,
origin on the ground, front = -Z, the entity's right = -X, absolute pivots.

Leg segments are built as "hanging" cubes (long axis along -Y from the joint)
that are turned with a cube rotation about the joint so that they run from one
joint to the next.  Bone rest rotations stay 0, so animation rotations act in
plain model axes about each joint:
  y  sweeps a leg forward/back (right legs: +y = tip backward, left legs: +y = tip forward)
  z  lifts a leg (right legs: +z = tip up, left legs: -z = tip up)
"""
from __future__ import annotations

import math
from dataclasses import dataclass, field

GEO_ID = "geometry.pas.parasite"
UV_W, UV_H = 64, 64          # geometry texture units
TEX_SCALE = 2                 # PNG pixels per texture unit (128x128 PNG)


def _sub(a, b):
    return (a[0] - b[0], a[1] - b[1], a[2] - b[2])


def _add(a, b):
    return (a[0] + b[0], a[1] + b[1], a[2] + b[2])


def _mul(a, s):
    return (a[0] * s, a[1] * s, a[2] * s)


def _len(a):
    return math.sqrt(a[0] ** 2 + a[1] ** 2 + a[2] ** 2)


def _unit(a):
    n = _len(a)
    return (a[0] / n, a[1] / n, a[2] / n)


def _r(x, n=3):
    v = round(float(x), n)
    return 0.0 if v == 0 else v


def segment_rotation(direction):
    """Cube rotation [rx, ry, rz] (degrees, file convention) that turns the
    cube's -Y axis onto ``direction`` (geo coordinates).

    Render space mirrors X; there R = Rz(rz) Ry(-ry) Rx(-rx) (georender.rot_rs).
    With ry = 0:  R (0,-1,0) = (cos rx sin rz, -cos rx cos rz, sin rx) must equal
    (-dx, dy, dz)  ->  rx = asin(dz), rz = atan2(-dx, -dy)."""
    dx, dy, dz = _unit(direction)
    rx = math.degrees(math.asin(max(-1.0, min(1.0, dz))))
    rz = math.degrees(math.atan2(-dx, -dy))
    return (_r(rx), 0.0, _r(rz))


@dataclass
class Cube:
    origin: tuple
    size: tuple
    uv: object                      # "region" name (box UV) or "swatch:<name>" (per-face, every face)
    rotation: tuple | None = None
    pivot: tuple | None = None
    mirror: bool = False


@dataclass
class Bone:
    name: str
    parent: str | None
    pivot: tuple
    cubes: list = field(default_factory=list)


def seg_cube(a, b, t, uv, ext0=0.0, ext1=0.0, mirror=False, tz=None):
    """Cube of cross-section t x tz running from joint a to joint b (extended by
    ext0 before a and ext1 past b), rotated about a."""
    tz = t if tz is None else tz
    d = _unit(_sub(b, a))
    L = _len(_sub(b, a)) + ext0 + ext1
    top = _sub(a, _mul(d, ext0))           # where the cube starts (centre of its top face)
    # canonical hanging cube below `top`; the rotation pivot is `top`
    origin = (top[0] - t / 2, top[1] - L, top[2] - tz / 2)
    return Cube(origin=tuple(_r(x) for x in origin), size=(t, _r(L), tz), uv=uv,
                rotation=segment_rotation(d), pivot=tuple(_r(x) for x in top), mirror=mirror)


# ---------------------------------------------------------------------------
# joints (right side; the left side mirrors x)
# ---------------------------------------------------------------------------
# front legs: shoulder at the chest beside the neck, elbow high and out,
# foot planted out to the side, level with the head's front.
# back legs: hip at the rear of the body, knee high, foot far out and back.
LEGS = {
    #       shoulder            elbow/knee           foot
    "fr": ((-3.5, 8.0, -3.0), (-10.0, 12.5, -7.0), (-12.0, 0.6, -11.5)),
    "br": ((-3.0, 10.0, 5.0), (-10.5, 14.0, 9.5), (-13.5, 0.6, 15.0)),
}
LEG_T_UPPER = 3
LEG_T_LOWER = 2


def mirror_x(p):
    return (-p[0], p[1], p[2])


def leg_joints():
    """{"fr", "fl", "br", "bl"} -> (shoulder, elbow/knee, foot)."""
    out = {}
    for k, (s, e, f) in LEGS.items():
        out[k] = (s, e, f)
        out[k[0] + "l"] = (mirror_x(s), mirror_x(e), mirror_x(f))
    return {k: out[k] for k in ("fr", "fl", "br", "bl")}


# ---------------------------------------------------------------------------
# bones
# ---------------------------------------------------------------------------

HEAD_PIVOT = (0.0, 10.0, -4.0)
JAW_PIVOT = (0.0, 10.0, -4.5)


def build_bones():
    bones: list[Bone] = []
    bones.append(Bone("root", None, (0.0, 0.0, 0.0)))
    # body: chest (front, low) + raised abdomen (hunched back) + fleshy lumps on the hump
    bones.append(Bone("body", "root", (0.0, 8.0, 2.0), [
        Cube((-4.0, 4.5, -6.0), (8, 7, 8), "chest"),
        Cube((-3.5, 6.5, -1.0), (7, 8, 9), "abdomen", rotation=(8.0, 0.0, 0.0), pivot=(0.0, 10.0, 3.0)),
    ]))
    bones.append(Bone("spikes", "body", (0.0, 14.0, 3.0), [
        Cube((-2.5, 13.2, 0.0), (3, 2, 3), "lump", rotation=(10.0, 20.0, -12.0), pivot=(-1.0, 14.0, 1.5)),
        Cube((0.0, 13.6, 3.5), (3, 2, 3), "lump", rotation=(-8.0, -15.0, 10.0), pivot=(1.5, 14.5, 5.0), mirror=True),
        seg_cube((0.0, 14.6, 5.5), (0.4, 16.4, 7.4), 1, "swatch:spike", ext0=0.6),
        seg_cube((-1.2, 14.0, 1.0), (-2.2, 15.6, 2.4), 1, "swatch:spike", ext0=0.6),
        seg_cube((2.0, 13.6, 2.0), (3.0, 15.0, 3.4), 1, "swatch:spike", ext0=0.6),
    ]))
    # head: upper skull (eyes, upper lip); jaw below it is hinged at the back
    bones.append(Bone("head", "body", HEAD_PIVOT, [
        Cube((-5.0, 10.0, -14.0), (10, 6, 10), "skull"),
    ]))
    bones.append(Bone("eyes", "head", (0.0, 12.5, -14.0), [
        Cube((-4.0, 11.5, -14.3), (2, 2, 1), "eye"),
        Cube((2.0, 11.5, -14.3), (2, 2, 1), "eye", mirror=True),
    ]))
    # mouth: dark throat box inside the head + ragged upper teeth hanging from the skull's front edge
    mouth = [Cube((-4.5, 7.5, -13.0), (9, 3, 8), "swatch:throat")]
    for x, ln in ((-3.6, 1.7), (-1.4, 2.3), (1.2, 1.4), (3.4, 2.0)):
        mouth.append(seg_cube((x, 10.2, -13.4), (x + 0.15 * (1 if x < 0 else -1), 10.2 - ln, -13.3), 1, "swatch:tooth", tz=1))
    for z, ln in ((-11.8, 1.3),):
        for sx in (-1, 1):
            mouth.append(seg_cube((sx * 3.6, 10.2, z), (sx * 3.5, 10.2 - ln, z), 1, "swatch:tooth"))
    bones.append(Bone("mouth", "head", (0.0, 10.0, -9.0), mouth))
    jaw = [Cube((-5.0, 6.0, -14.0), (10, 4, 10), "jaw")]
    for x, ln in ((-2.6, 1.3), (0.2, 0.9), (2.7, 1.5)):
        jaw.append(seg_cube((x, 9.8, -13.3), (x, 9.8 + ln, -13.2), 1, "swatch:tooth_low"))
    bones.append(Bone("jaw", "head", JAW_PIVOT, jaw))
    # dripping strands of blood/flesh under the jaw front
    drips = []
    for x, z, ln in ((-3.5, -13.5, 3.5), (-1.5, -13.6, 2.2), (0.5, -13.5, 4.5), (2.5, -13.4, 2.8), (4.2, -13.0, 1.8),
                     (-4.6, -11.5, 2.0)):
        drips.append(seg_cube((x, 6.3, z), (x, 6.3 - ln, z), 1, "swatch:drip", tz=1))
    bones.append(Bone("drips", "jaw", (0.0, 6.0, -13.5), drips))
    # legs
    for k, (s, e, f) in leg_joints().items():
        right = s[0] < 0
        front = k[0] == "f"
        side = "r" if right else "l"
        up_uv = "leg_upper_front" if front else "leg_upper_back"
        lo_uv = "leg_lower_front" if front else "leg_lower_back"
        name = f"leg_{k}"
        bones.append(Bone(f"{name}_upper", "root", s, [
            seg_cube(s, e, LEG_T_UPPER, up_uv, ext0=1.0, ext1=1.2, mirror=not right),
        ]))
        bones.append(Bone(f"{name}_lower", f"{name}_upper", e, [
            seg_cube(e, f, LEG_T_LOWER, lo_uv, ext0=0.8, ext1=0.2, mirror=not right),
            Cube((e[0] - 1.5, e[1] - 1.5, e[2] - 1.5), (3, 3, 3), "elbow", mirror=not right,
                 rotation=segment_rotation(_sub(f, e)), pivot=e),
        ]))
        # claw: knuckle + three splayed talons + a rear spur, all touching the ground
        out_dir = _unit((f[0] - s[0], 0.0, f[2] - s[2]))
        cubes = [Cube((f[0] - 1.0, 0.0, f[2] - 1.0), (2, 2, 2), "knuckle", mirror=not right)]
        for ang, ln in ((-38.0, 3.2), (0.0, 3.8), (38.0, 3.2), (180.0, 1.8)):
            a = math.radians(ang)
            dxz = (out_dir[0] * math.cos(a) - out_dir[2] * math.sin(a), out_dir[0] * math.sin(a) + out_dir[2] * math.cos(a))
            tip = (f[0] + dxz[0] * ln, 0.15, f[2] + dxz[1] * ln)
            base = (f[0] + dxz[0] * 0.6, 1.3, f[2] + dxz[1] * 0.6)
            cubes.append(seg_cube(base, tip, 1, "swatch:claw", ext0=0.2))
        bones.append(Bone(f"{name}_claw", f"{name}_lower", f, cubes))
    return bones


# ---------------------------------------------------------------------------
# UV layout (geometry texture units, 64 x 64)
# ---------------------------------------------------------------------------

def box_dims(size):
    w, h, d = (int(math.floor(abs(s) + 1e-7)) for s in size)
    return w, h, d


def region_sizes(bones):
    """Box-UV region name -> (w, h, d) (the first cube that uses it defines it)."""
    out = {}
    for b in bones:
        for c in b.cubes:
            if isinstance(c.uv, str) and not c.uv.startswith("swatch:"):
                dims = box_dims(c.size)
                if c.uv in out and out[c.uv] != dims:
                    # shared regions must have the same floored size
                    raise ValueError(f"region {c.uv}: {out[c.uv]} vs {dims}")
                out.setdefault(c.uv, dims)
    return out


SWATCHES = {            # name -> (w, h) in texture units
    "throat": (4, 4),
    "tooth": (1, 3),
    "tooth_low": (1, 3),
    "drip": (1, 5),
    "claw": (1, 4),
    "spike": (1, 4),
}


def pack_layout(bones):
    """Pack every box-UV region and swatch into the 64x64 UV space with a
    skyline bottom-left packer (deterministic).
    Returns {name: (u, v, w, h, d)} for regions and {name: (u, v, w, h)} for swatches."""
    regs = region_sizes(bones)
    items = []
    for name, (w, h, d) in regs.items():
        items.append((name, 2 * (d + w), d + h, (w, h, d)))
    for name, (w, h) in SWATCHES.items():
        items.append(("swatch:" + name, w, h, None))
    items.sort(key=lambda it: (-it[1] * it[2], -it[2], it[0]))     # biggest area first
    sky = [0] * UV_W                       # filled height of every column
    regions, swatches = {}, {}
    for name, W, H, dims in items:
        best = None
        for x in range(0, UV_W - W + 1):
            y = max(sky[x:x + W])
            if y + H <= UV_H and (best is None or (y, x) < best):
                best = (y, x)
        if best is None:
            raise ValueError(f"UV layout overflow at {name}")
        y, x = best
        for i in range(x, x + W):
            sky[i] = y + H
        if dims is None:
            swatches[name[7:]] = (x, y, W, H)
        else:
            w, h, d = dims
            regions[name] = (x, y, w, h, d)
    return regions, swatches


def box_face_rects(u, v, w, h, d):
    """Face rects (u0, v0, u1, v1) of a box-UV region, in texture units.
    Orientation inside each rect (as seen from outside; README "Box UV"):
      north: left = entity's right, top = up      south: left = entity's left
      east (entity's right): left = back, right = front
      west (entity's left):  left = front, right = back
      up:   top row = back, bottom row = front, left = entity's right
      down: top row = back, left = entity's right"""
    return {
        "up": (u + d, v, u + d + w, v + d),
        "down": (u + d + w, v, u + d + 2 * w, v + d),
        "east": (u, v + d, u + d, v + d + h),
        "north": (u + d, v + d, u + d + w, v + d + h),
        "west": (u + d + w, v + d, u + 2 * d + w, v + d + h),
        "south": (u + 2 * d + w, v + d, u + 2 * d + 2 * w, v + d + h),
    }


def cube_json(c: Cube, regions, swatches):
    out = {"origin": [_r(x) for x in c.origin], "size": [_r(x) for x in c.size]}
    if c.pivot is not None:
        out["pivot"] = [_r(x) for x in c.pivot]
    if c.rotation is not None and any(abs(r) > 1e-9 for r in c.rotation):
        out["rotation"] = [_r(x) for x in c.rotation]
    if c.uv.startswith("swatch:"):
        u, v, w, h = swatches[c.uv[7:]]
        face = {"uv": [u, v], "uv_size": [w, h]}
        out["uv"] = {f: dict(face) for f in ("north", "east", "south", "west", "up", "down")}
    else:
        u, v, w, h, d = regions[c.uv]
        out["uv"] = [u, v]
        if c.mirror:
            out["mirror"] = True
    return out


def geometry_json(bones=None):
    bones = bones or build_bones()
    regions, swatches = pack_layout(bones)
    jb = []
    for b in bones:
        bj = {"name": b.name}
        if b.parent:
            bj["parent"] = b.parent
        bj["pivot"] = [_r(x) for x in b.pivot]
        if b.cubes:
            bj["cubes"] = [cube_json(c, regions, swatches) for c in b.cubes]
        jb.append(bj)
    return {
        "format_version": "1.12.0",
        "minecraft:geometry": [{
            "description": {
                "identifier": GEO_ID,
                "texture_width": UV_W,
                "texture_height": UV_H,
                "visible_bounds_width": 3,
                "visible_bounds_height": 2,
                "visible_bounds_offset": [0, 0.5, 0],
            },
            "bones": jb,
        }],
    }
