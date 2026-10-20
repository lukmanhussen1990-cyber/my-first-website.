"""Cube-model DSL, per-face UV packing and Bedrock .geo.json export.

Design space for every gun: (s, y, f) in model pixels (1/16 block)
  s = towards the gun's right side, y = up, f = towards the muzzle.
Internal (Blockbench) frame: x = s, y = y, z = -f.
"""
import math
import numpy as np

from .rig import euler_internal

FACES = ("north", "south", "east", "west", "up", "down")


class Part:
    __slots__ = ("bone", "mat", "frm", "to", "rot", "pivot", "pattern", "face_mat",
                 "face_pattern", "hidden_faces", "uv", "seed", "tag")

    def __init__(self, bone, mat, frm, to, rot=None, pivot=None, pattern=None,
                 face_mat=None, face_pattern=None, hidden_faces=(), tag=None):
        self.bone = bone
        self.mat = mat
        self.frm = np.asarray(frm, dtype=float)
        self.to = np.asarray(to, dtype=float)
        self.rot = rot
        self.pivot = None if pivot is None else np.asarray(pivot, dtype=float)
        self.pattern = pattern
        self.face_mat = face_mat or {}
        self.face_pattern = face_pattern or {}
        self.hidden_faces = set(hidden_faces)
        self.uv = {}
        self.seed = 0
        self.tag = tag

    def size(self):
        return self.to - self.frm

    def face_dims(self, face):
        """(width, height) of a face in model px (matches Bedrock uv_size axes)."""
        sx, sy, sz = self.size()
        if face in ("north", "south"):
            return sx, sy
        if face in ("east", "west"):
            return sz, sy
        return sx, sz

    def corners(self):
        x0, y0, z0 = self.frm
        x1, y1, z1 = self.to
        pts = np.array([[x, y, z] for x in (x0, x1) for y in (y0, y1) for z in (z0, z1)], dtype=float)
        if self.rot is not None:
            R = euler_internal(self.rot)
            pts = (pts - self.pivot) @ R.T + self.pivot
        return pts


class GunModel:
    """Collects parts for one gun and exports them."""

    def __init__(self, gid):
        self.gid = gid
        self.parts = []
        self.bone_pivots = {"body": (0, 0, 0)}
        self.bone_parent = {"body": "recoil"}
        self._seed = 1

    # -- helpers in design space -------------------------------------
    def box(self, mat, s0, s1, y0, y1, f0, f1, bone="body", pitch=0.0, yaw=0.0,
            roll=0.0, pivot=None, pattern=None, faces=None, fpat=None, hide=(), tag=None):
        """Axis aligned box given in design space (s, y, f) ranges.

        pitch: degrees, positive raises the front (+f) end.
        yaw:   degrees, positive turns the front towards +s (right).
        roll:  degrees, positive rolls the top towards +s.
        pivot: design-space point the rotation happens around."""
        frm = (min(s0, s1), min(y0, y1), -max(f0, f1))
        to = (max(s0, s1), max(y0, y1), -min(f0, f1))
        rot = None
        piv = None
        if pitch or yaw or roll:
            rot = (pitch, -yaw, -roll)
            if pivot is None:
                pivot = ((s0 + s1) / 2, (y0 + y1) / 2, (f0 + f1) / 2)
            piv = (pivot[0], pivot[1], -pivot[2])
        p = Part(bone, mat, frm, to, rot, piv, pattern, faces, fpat, hide, tag)
        p.seed = self._seed
        self._seed += 1
        self.parts.append(p)
        return p

    def cbox(self, mat, cs, cy, cf, ws, hy, lf, **kw):
        """Centered box: center (cs, cy, cf), sizes (ws, hy, lf)."""
        return self.box(mat, cs - ws / 2, cs + ws / 2, cy - hy / 2, cy + hy / 2,
                        cf - lf / 2, cf + lf / 2, **kw)

    def tube(self, mat, cs, cy, f0, f1, d, bone="body", pattern=None, fpat=None,
             octagon=True, tag=None, hide_ends=False):
        """Round-ish tube along f: a square plus a 45-degree rotated square."""
        hide = ("north", "south") if hide_ends else ()
        self.box(mat, cs - d / 2, cs + d / 2, cy - d / 2, cy + d / 2, f0, f1, bone=bone,
                 pattern=pattern, fpat=fpat, tag=tag, hide=hide)
        if octagon and d >= 0.45:
            k = d * 0.83
            self.box(mat, cs - k / 2, cs + k / 2, cy - k / 2, cy + k / 2, f0 + 0.01, f1 - 0.01,
                     bone=bone, roll=45, pivot=(cs, cy, (f0 + f1) / 2), pattern=pattern,
                     fpat=fpat, tag=tag, hide=("north", "south"))

    def bone(self, name, pivot, parent="recoil"):
        self.bone_pivots[name] = pivot
        self.bone_parent[name] = parent

    # -- statistics ---------------------------------------------------
    def bounds(self):
        pts = np.vstack([p.corners() for p in self.parts])
        return pts.min(axis=0), pts.max(axis=0)

    def surface_area(self):
        a = 0.0
        for p in self.parts:
            for f in FACES:
                if f in p.hidden_faces:
                    continue
                w, h = p.face_dims(f)
                a += w * h
        return a


# --------------------------------------------------------------------------
# UV packing
# --------------------------------------------------------------------------
def _pack(rects, W, H, pad):
    """Shelf packer. rects: list of (key, w, h). Returns key->(x, y) or None."""
    order = sorted(rects, key=lambda r: (-r[2], -r[1]))
    pos = {}
    x = y = 0
    shelf_h = 0
    for key, w, h in order:
        pw, ph = w + 2 * pad, h + 2 * pad
        if pw > W:
            return None
        if x + pw > W:
            x = 0
            y += shelf_h
            shelf_h = 0
        if y + ph > H:
            return None
        pos[key] = (x + pad, y + pad)
        x += pw
        shelf_h = max(shelf_h, ph)
    return pos


def layout_uvs(model, W, H, density=None, pad=1, max_density=6.0, reserved=None):
    """Assign per-face UV rectangles. Picks the highest density that fits."""
    def rects_for(d):
        out = []
        for i, p in enumerate(model.parts):
            for f in FACES:
                if f in p.hidden_faces:
                    continue
                w, h = p.face_dims(f)
                tw = max(1, int(round(w * d)))
                th = max(1, int(round(h * d)))
                out.append(((i, f), tw, th))
        return out

    if reserved:
        Wr = W
        Hr = H - reserved
    else:
        Wr, Hr = W, H
    if density is None:
        lo, hi = 0.5, max_density
        best = None
        for _ in range(28):
            mid = (lo + hi) / 2
            if _pack(rects_for(mid), Wr, Hr, pad) is not None:
                best = mid
                lo = mid
            else:
                hi = mid
        density = math.floor(best * 4) / 4.0
        while _pack(rects_for(density), Wr, Hr, pad) is None:
            density -= 0.25
    rects = rects_for(density)
    pos = _pack(rects, Wr, Hr, pad)
    if pos is None:
        raise RuntimeError(f"{model.gid}: cannot pack at density {density}")
    sizes = {k: (w, h) for k, w, h in rects}
    for (i, f), (x, y) in pos.items():
        w, h = sizes[(i, f)]
        model.parts[i].uv[f] = (x, y, w, h)
    return density


# --------------------------------------------------------------------------
# geo.json export
# --------------------------------------------------------------------------
def _r(v, nd=4):
    v = round(float(v), nd)
    if v == 0:
        v = 0.0
    if v == int(v):
        return int(v)
    return v


def part_to_cube(p):
    """Convert an internal-frame part to a Bedrock cube dict."""
    x0, y0, z0 = p.frm
    x1, y1, z1 = p.to
    cube = {
        "origin": [_r(-x1), _r(y0), _r(z0)],
        "size": [_r(x1 - x0), _r(y1 - y0), _r(z1 - z0)],
    }
    if p.rot is not None:
        cube["pivot"] = [_r(-p.pivot[0]), _r(p.pivot[1]), _r(p.pivot[2])]
        cube["rotation"] = [_r(-p.rot[0], 3), _r(-p.rot[1], 3), _r(p.rot[2], 3)]
    uv = {}
    for f in FACES:
        if f in p.uv:
            x, y, w, h = p.uv[f]
            uv[f] = {"uv": [x, y], "uv_size": [w, h]}
    cube["uv"] = uv
    return cube


def export_geometry(model, identifier, W, H, extra_bones=None, visible_bounds=(3, 2.5),
                    recoil_pivot=(0, 0, 0)):
    rp = recoil_pivot
    bones = [
        {"name": "gun", "binding": "q.item_slot_to_bone_name(c.item_slot)", "pivot": [0, 0, 0]},
        {"name": "recoil", "parent": "gun", "pivot": [_r(-rp[0]), _r(rp[1]), _r(-rp[2])]},
    ]
    names = ["body"] + [b for b in model.bone_pivots if b != "body"]
    for name in names:
        piv = model.bone_pivots[name]
        bones.append({
            "name": name,
            "parent": model.bone_parent.get(name, "recoil"),
            "pivot": [_r(-piv[0]), _r(piv[1]), _r(-piv[2])],
            "cubes": [part_to_cube(p) for p in model.parts if p.bone == name],
        })
    if extra_bones:
        bones.extend(extra_bones)
    return {
        "format_version": "1.16.0",
        "minecraft:geometry": [{
            "description": {
                "identifier": identifier,
                "texture_width": W,
                "texture_height": H,
                "visible_bounds_width": visible_bounds[0],
                "visible_bounds_height": visible_bounds[1],
                "visible_bounds_offset": [0, 1, 0],
            },
            "bones": bones,
        }],
    }
