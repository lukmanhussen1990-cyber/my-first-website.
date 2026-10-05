#!/usr/bin/env python3
"""Software rasteriser for Bedrock entity geometry (numpy only, no GPU).

Features: 1.12.0 `minecraft:geometry` and legacy 1.8.0 `geometry.*` files, box-UV and per-face UV,
cube `mirror`, `inflate`, cube/bone rotation, bone `scale`, pose dicts {bone: {rotation, position,
scale}}, perspective or orthographic cameras, z-buffer, nearest-neighbour texture sampling,
back-face culling, mild directional light, ground grid, contact sheets, CLI.

ROTATION CONVENTION  (calibrated on vanilla files, see `--calibrate`)
------------------------------------------------------------------
Animation / bone `rotation` is [x, y, z] degrees, applied about the bone pivot in the parent's
frame, order X first, then Y, then Z.  In MODEL space (x = towards the mob's left, y up,
front = -z) the equivalent right-hand-rule matrices are

        R = Rz(-z) . Ry(+y) . Rx(-x)

 * X : NEGATIVE swings a hanging limb FORWARD (-Z).   vanilla zombie arms -90, evoker/skeleton.
 * Z : on a bone hanging at -X (right_*) POSITIVE swings it OUTWARD (-X) and up;
       on a +X (left_*) bone NEGATIVE swings it outward.   vanilla evoker casting +-135.
 * Y : POSITIVE turns a forward-pointing bone towards -X (the mob's RIGHT); negative towards +X.
       Y is therefore NOT negated like X and Z.  (DESIGN.md section 7 says all three are negated -
       that is WRONG for Y.)  Evidence: vanilla `animation.humanoid.bow_and_arrow` has
       left arm Y=+28.65 and right arm Y=-5.73 with arms forward: with +Y -> -X both hands converge
       on the body centre line (left hand lands at x ~ 0.2 px, i.e. on the bow); with the opposite
       sign the left hand would end 10 px OUTSIDE the body.  It also follows from Java -> Bedrock
       conversion (Bedrock model space = Java model space with only the y axis flipped, which
       negates rotations about X and Z but not about Y) and matches Blockbench's (-x,-y,+z)
       export flips in its mirrored editor frame.
`position` is added in the parent frame, model px, +Y up, -Z forward.

DISPLAY: model space is mirrored for display so that the mob's right (-X) appears on the
viewer's LEFT when looking at the mob's face (what the game shows).  yaw 0 = looking at the face,
90 = looking at the mob's right side, 180 = back, 270 = left side.

API:
    geo = load_geometry(path, identifier=None)
    tex = load_texture(path)                      # (H, W, 4) uint8
    img = render(geo, tex, pose=None, yaw=0, pitch=0, size=512, ...)   # PIL.Image
    sheet = contact_sheet([img, ...], ["front", ...], cols=4)
"""
from __future__ import annotations

import argparse
import json
import math
import os
import sys
import zlib
from collections import OrderedDict

import numpy as np
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
VANILLA = "/home/user/mojang/bedrock-samples/resource_pack"

Y_SIGN = +1.0  # +1 = verified convention (see module docstring); -1 = what DESIGN.md claimed

FACES = ("north", "south", "west", "east", "up", "down")
NORMALS = {"north": (0, 0, -1), "south": (0, 0, 1), "west": (-1, 0, 0), "east": (1, 0, 0),
           "up": (0, 1, 0), "down": (0, -1, 0)}


# ======================================================================================
# loading
# ======================================================================================
class Cube:
    __slots__ = ("origin", "size", "uv", "inflate", "mirror", "rotation", "pivot")

    def __init__(self, d, bone_inflate, bone_mirror):
        self.origin = np.array(d["origin"], dtype=float)
        self.size = np.array(d["size"], dtype=float)
        self.uv = d.get("uv", [0, 0])
        self.inflate = float(d.get("inflate", bone_inflate or 0.0))
        self.mirror = bool(d.get("mirror", bone_mirror))
        self.rotation = np.array(d.get("rotation", [0, 0, 0]), dtype=float)
        self.pivot = np.array(d["pivot"], dtype=float) if "pivot" in d else None


class Bone:
    def __init__(self, d):
        self.name = d["name"]
        self.parent = d.get("parent")
        self.pivot = np.array(d.get("pivot", [0, 0, 0]), dtype=float)
        rot = d.get("rotation", d.get("bind_pose_rotation", [0, 0, 0]))
        self.rotation = np.array(rot, dtype=float)
        self.never_render = bool(d.get("neverRender", False))
        mir = bool(d.get("mirror", False))
        inf = d.get("inflate", 0.0)
        self.cubes = [Cube(c, inf, mir) for c in d.get("cubes", [])]


class Geometry:
    def __init__(self, identifier, tex_w, tex_h, bones, bounds=None):
        self.identifier = identifier
        self.tex_w = tex_w
        self.tex_h = tex_h
        self.bones = OrderedDict((b.name, b) for b in bones)
        self.bounds = bounds


def load_geometry(path, identifier=None):
    with open(path, "r", encoding="utf-8") as f:
        text = f.read()
    try:
        data = json.loads(text)
    except json.JSONDecodeError:  # vanilla files sometimes have trailing commas / comments
        import re
        t = re.sub(r"//[^\n]*", "", text)
        t = re.sub(r",\s*([}\]])", r"\1", t)
        data = json.loads(t)
    if "minecraft:geometry" in data:
        items = data["minecraft:geometry"]
        item = items[0] if identifier is None else next(i for i in items if i["description"]["identifier"] == identifier)
        desc = item["description"]
        return Geometry(desc["identifier"], desc.get("texture_width", 64), desc.get("texture_height", 64),
                        [Bone(b) for b in item["bones"]])
    keys = [k for k in data if k.startswith("geometry.")]
    key = keys[0] if identifier is None else next(k for k in keys if k.split(":")[0] == identifier)
    g = data[key]
    return Geometry(key, g.get("texturewidth", 64), g.get("textureheight", 32), [Bone(b) for b in g["bones"]])


def load_texture(path):
    return np.array(Image.open(path).convert("RGBA"))


# ======================================================================================
# transforms
# ======================================================================================
def rot_matrix(rx, ry, rz, y_sign=None):
    """R = Rz(-z) . Ry(y_sign*y) . Rx(-x)  (right-hand-rule matrices, angles in degrees)."""
    ys = Y_SIGN if y_sign is None else y_sign
    a, b, c = math.radians(-rx), math.radians(ys * ry), math.radians(-rz)
    ca, sa, cb, sb, cc, sc = math.cos(a), math.sin(a), math.cos(b), math.sin(b), math.cos(c), math.sin(c)
    Rx = np.array([[1, 0, 0], [0, ca, -sa], [0, sa, ca]])
    Ry = np.array([[cb, 0, sb], [0, 1, 0], [-sb, 0, cb]])
    Rz = np.array([[cc, -sc, 0], [sc, cc, 0], [0, 0, 1]])
    return Rz @ Ry @ Rx


def _pose_for(pose, name):
    if not pose:
        return {}
    if name in pose:
        return pose[name]
    low = name.lower()  # Bedrock matches bone names case-insensitively (vanilla evoker: "leftarm" vs "leftArm")
    for k, v in pose.items():
        if k.lower() == low:
            return v
    return {}


def bone_matrices(geo, pose=None, y_sign=None):
    """Return {bone: (A 3x3, b 3)} mapping rest-pose model points of that bone to posed model points,
    plus {bone: hidden(bool)} (scale 0 propagates to children)."""
    mats = {}
    hidden = {}

    def get(name):
        if name in mats:
            return mats[name]
        bone = geo.bones[name]
        p = _pose_for(pose, name)
        rot = bone.rotation + np.array(p.get("rotation", [0, 0, 0]), dtype=float)
        pos = np.array(p.get("position", [0, 0, 0]), dtype=float)
        sc = p.get("scale", 1.0)
        sc = np.array([sc, sc, sc], dtype=float) if np.isscalar(sc) else np.array(sc, dtype=float)
        R = rot_matrix(*rot, y_sign=y_sign) @ np.diag(sc)
        c = bone.pivot
        A_l = R
        b_l = c - R @ c + pos
        if bone.parent and bone.parent in geo.bones:
            Ap, bp, hp = get(bone.parent)
            A = Ap @ A_l
            b = Ap @ b_l + bp
            h = hp
        else:
            A, b, h = A_l, b_l, False
        h = h or bool(np.all(sc == 0))
        mats[name] = (A, b, h)
        return mats[name]

    for n in geo.bones:
        get(n)
    return {n: (m[0], m[1]) for n, m in mats.items()}, {n: m[2] for n, m in mats.items()}


# ======================================================================================
# faces: corners + uv rect, in the "canvas" orientation of make_model.CANVAS_AXES
# ======================================================================================
def _box_uv_rects(u, v, w, h, d):
    return {"up": (u + d, v, w, d), "down": (u + d + w, v, w, d), "west": (u, v + d, d, h),
            "north": (u + d, v + d, w, h), "east": (u + d + w, v + d, d, h), "south": (u + 2 * d + w, v + d, w, h)}


def cube_faces(cube):
    """Yield (face_name, P0, U, V, rect(x,y,w,h), flip_u) in model space, before cube rotation."""
    o = cube.origin - cube.inflate
    s = cube.size + 2 * cube.inflate
    x0, y0, z0 = o
    x1, y1, z1 = o + s
    w, h, d = s
    geom = {
        "north": ((x0, y1, z0), (w, 0, 0), (0, -h, 0)),
        "south": ((x1, y1, z1), (-w, 0, 0), (0, -h, 0)),
        "west": ((x0, y1, z1), (0, 0, -d), (0, -h, 0)),
        "east": ((x1, y1, z0), (0, 0, d), (0, -h, 0)),
        "up": ((x0, y1, z1), (w, 0, 0), (0, 0, -d)),
        "down": ((x0, y0, z0), (w, 0, 0), (0, 0, d)),
    }
    if isinstance(cube.uv, dict):
        rects = {}
        for fn in FACES:
            if fn in cube.uv:
                f = cube.uv[fn]
                fu, fv = f["uv"]
                size = f.get("uv_size")
                dims = {"north": (w, h), "south": (w, h), "west": (d, h), "east": (d, h), "up": (w, d), "down": (w, d)}[fn]
                sw, sh = size if size else dims
                rects[fn] = (fu, fv, sw, sh)
    else:
        u, v = cube.uv
        rects = _box_uv_rects(u, v, round(cube.size[0]), round(cube.size[1]), round(cube.size[2]))
    out = []
    for fn in FACES:
        if fn not in rects:
            continue
        P0, U, V = (np.array(a, dtype=float) for a in geom[fn])
        rect = rects[fn]
        flip = False
        if cube.mirror and not isinstance(cube.uv, dict):
            # Java/Bedrock mirror: swap the two side strips and flip every face horizontally
            if fn == "west":
                rect = rects["east"]
            elif fn == "east":
                rect = rects["west"]
            flip = True
        out.append((fn, P0, U, V, rect, flip))
    return out


# ======================================================================================
# rasteriser
# ======================================================================================
def _bone_color(name):
    h = zlib.crc32(name.lower().encode()) & 0xFFFFFF
    r, g, b = (h >> 16) & 255, (h >> 8) & 255, h & 255
    return np.array([90 + r * 0.55, 90 + g * 0.55, 90 + b * 0.55])


def _camera(yaw, pitch):
    """Camera basis in display space.  yaw 0 = in front of the face; pitch > 0 = camera above."""
    pitch = max(-89.5, min(89.5, pitch))
    ya, pi = math.radians(yaw), math.radians(pitch)
    pos = np.array([math.sin(ya) * math.cos(pi), math.sin(pi), -math.cos(ya) * math.cos(pi)])
    f = -pos / np.linalg.norm(pos)
    r = np.cross(f, np.array([0.0, 1.0, 0.0]))
    r /= np.linalg.norm(r)
    u = np.cross(r, f)
    return pos, f, r, u


def to_display(p):
    """model space (x left-of-mob, y up, front -z) -> display space W = (-x, y, z) (right-handed)."""
    p = np.asarray(p, dtype=float)
    q = p.copy()
    q[..., 0] = -q[..., 0]
    return q


def build_scene(geo, pose=None, y_sign=None, only_bones=None, hide_bones=()):
    """Return list of quads: dict(P(4,3) display-space corners [P0,P1,P3,P2], uv(4,2) in texels, normal(3), bone)."""
    mats, hidden = bone_matrices(geo, pose, y_sign)
    quads = []
    hide = {h.lower() for h in hide_bones}
    for bname, bone in geo.bones.items():
        if bone.never_render or hidden[bname] or bname.lower() in hide:
            continue
        if only_bones and bname not in only_bones:
            continue
        A, b = mats[bname]
        for cube in bone.cubes:
            Rc = np.eye(3)
            cpiv = None
            if np.any(cube.rotation != 0):
                Rc = rot_matrix(*cube.rotation, y_sign=y_sign)
                cpiv = cube.pivot if cube.pivot is not None else cube.origin + cube.size / 2
            for fn, P0, U, V, rect, flip in cube_faces(cube):
                corners = np.array([P0, P0 + U, P0 + U + V, P0 + V])  # TL, TR, BR, BL
                n = np.array(NORMALS[fn], dtype=float)
                if cpiv is not None:
                    corners = (corners - cpiv) @ Rc.T + cpiv
                    n = Rc @ n
                corners = corners @ A.T + b
                n = A @ n  # (uniform scale only; fine for previews)
                if np.linalg.norm(n) == 0:
                    continue
                n = n / np.linalg.norm(n)
                rx, ry, rw, rh = rect
                if flip:
                    uv = np.array([[rx + rw, ry], [rx, ry], [rx, ry + rh], [rx + rw, ry + rh]], dtype=float)
                else:
                    uv = np.array([[rx, ry], [rx + rw, ry], [rx + rw, ry + rh], [rx, ry + rh]], dtype=float)
                quads.append(dict(P=to_display(corners), uv=uv, n=to_display(n), bone=bname, face=fn))
    return quads


def render(geo, texture=None, pose=None, yaw=0.0, pitch=0.0, size=512, ortho=True, fov=28.0, target=None,
           extent=None, ss=2, bg=(36, 38, 46), ground=True, y_sign=None, flat=False, ambient=0.72,
           hide_bones=(), front_marker=False, ground_size=48, shade=True, cull=True, return_info=False,
           front_arrow=False):
    """Render `geo` with optional `texture` ((H,W,4) uint8) in the given pose.

    target : model-space point to look at (default centre of the posed bounding box)
    extent : visible height of the view in model px (default: fit the posed bounding box)
    """
    S = int(ss)
    W = H = int(size) * S
    quads = build_scene(geo, pose, y_sign, hide_bones=hide_bones)
    if not quads:
        raise ValueError("nothing to render")
    pts = np.concatenate([q["P"] for q in quads])  # display space
    cam_pos_dir, f, r, u = _camera(yaw, pitch)
    if target is None:
        tgt_d = (pts.min(0) + pts.max(0)) / 2
    else:
        tgt_d = to_display(np.array(target, dtype=float))
    rel = pts - tgt_d
    vx, vy = rel @ r, rel @ u
    if extent is None:
        half = max(np.abs(vx).max(), np.abs(vy).max()) * 1.12
    else:
        half = extent / 2.0
    t = math.tan(math.radians(fov) / 2)
    dist = 400.0 if ortho else max(half / t, 40.0)
    eye = tgt_d - f * dist

    def project(P):
        rel = P - eye
        x, y, z = rel @ r, rel @ u, rel @ f
        if ortho:
            sx, sy, iw = x / half, y / half, np.ones_like(z)
        else:
            sx, sy, iw = x / (z * t), y / (z * t), 1.0 / z
        return (sx * 0.5 + 0.5) * W, (0.5 - sy * 0.5) * H, z, iw

    color = np.empty((H, W, 3), dtype=np.float32)
    color[:] = np.array(bg, dtype=np.float32)
    zbuf = np.full((H, W), np.inf, dtype=np.float32)
    light_dir = (-0.35 * r + 0.75 * u - 0.55 * f)
    light_dir /= np.linalg.norm(light_dir)

    def draw_tri(p0, p1, p2, z, iw, uv, tex, base_col, lum, alpha_test=True, checker=None):
        xs = np.array([p0[0], p1[0], p2[0]])
        ys = np.array([p0[1], p1[1], p2[1]])
        x0, x1 = int(max(math.floor(xs.min()), 0)), int(min(math.ceil(xs.max()) + 1, W))
        y0, y1 = int(max(math.floor(ys.min()), 0)), int(min(math.ceil(ys.max()) + 1, H))
        if x1 <= x0 or y1 <= y0:
            return
        den = (p1[1] - p2[1]) * (p0[0] - p2[0]) + (p2[0] - p1[0]) * (p0[1] - p2[1])
        if abs(den) < 1e-9:
            return
        gx, gy = np.meshgrid(np.arange(x0, x1) + 0.5, np.arange(y0, y1) + 0.5)
        l0 = ((p1[1] - p2[1]) * (gx - p2[0]) + (p2[0] - p1[0]) * (gy - p2[1])) / den
        l1 = ((p2[1] - p0[1]) * (gx - p2[0]) + (p0[0] - p2[0]) * (gy - p2[1])) / den
        l2 = 1.0 - l0 - l1
        eps = -1e-6
        inside = (l0 >= eps) & (l1 >= eps) & (l2 >= eps)
        if not inside.any():
            return
        # perspective-correct weights
        w0, w1, w2 = l0 * iw[0], l1 * iw[1], l2 * iw[2]
        ws = w0 + w1 + w2
        w0, w1, w2 = w0 / ws, w1 / ws, w2 / ws
        depth = l0 * z[0] + l1 * z[1] + l2 * z[2]
        sub_z = zbuf[y0:y1, x0:x1]
        m = inside & (depth < sub_z)
        if tex is not None and alpha_test:
            uu = w0 * uv[0][0] + w1 * uv[1][0] + w2 * uv[2][0]
            vv = w0 * uv[0][1] + w1 * uv[1][1] + w2 * uv[2][1]
            tx = np.clip(np.floor(uu - 1e-4).astype(int), 0, tex.shape[1] - 1)
            ty = np.clip(np.floor(vv - 1e-4).astype(int), 0, tex.shape[0] - 1)
            texel = tex[ty, tx]
            m &= texel[..., 3] >= 128
            rgb = texel[..., :3].astype(np.float32)
        elif checker is not None:
            rgb = np.where(checker(w0, w1, w2)[..., None], base_col[0], base_col[1]).astype(np.float32)
        else:
            rgb = np.broadcast_to(base_col.astype(np.float32), inside.shape + (3,))
        if not m.any():
            return
        sub_z[m] = depth[m]
        sub_c = color[y0:y1, x0:x1]
        sub_c[m] = np.clip(rgb[m] * lum, 0, 255)

    # ground
    if ground:
        g = ground_size / 2.0
        step = 6.0
        n = int(ground_size / step)
        for i in range(n):
            for j in range(n):
                xa, xb = -g + i * step, -g + (i + 1) * step
                za, zb = -g + j * step, -g + (j + 1) * step
                c = np.array([[xa, -0.02, za], [xb, -0.02, za], [xb, -0.02, zb], [xa, -0.02, zb]])
                col = np.array([70, 74, 80] if (i + j) % 2 == 0 else [58, 61, 68], dtype=float)
                px, py, zz, iw = project(to_display(c))
                for tri in ((0, 1, 2), (0, 2, 3)):
                    draw_tri((px[tri[0]], py[tri[0]]), (px[tri[1]], py[tri[1]]), (px[tri[2]], py[tri[2]]),
                             [zz[k] for k in tri], [iw[k] for k in tri], None, None, col, 1.0)

    tex = None if (flat or texture is None) else texture
    for q in quads:
        n = q["n"]
        px, py, zz, iw = project(q["P"])
        facing = float(np.dot(n, f))
        if cull and facing >= -1e-6:
            continue  # back face
        lum = 1.0
        if shade:
            lum = ambient + (1 - ambient) * max(0.0, float(np.dot(n, light_dir)))
            lum = min(lum * 1.08, 1.05)
        base = _bone_color(q["bone"])
        if front_marker and q["face"] == "north" and q["bone"].lower() in ("head", "jaw"):
            base = np.array([210, 60, 60])
        uv = q["uv"]
        for tri in ((0, 1, 2), (0, 2, 3)):
            draw_tri((px[tri[0]], py[tri[0]]), (px[tri[1]], py[tri[1]]), (px[tri[2]], py[tri[2]]),
                     [zz[k] for k in tri], [iw[k] for k in tri], [uv[k] for k in tri], tex, base, lum)

    img = Image.fromarray(np.clip(color, 0, 255).astype(np.uint8), "RGB")
    if S > 1:
        img = img.resize((size, size), Image.BOX)
    if front_arrow:
        d = to_display(np.array([0.0, 0.0, -1.0]))
        vx, vy = float(d @ r), float(d @ u)
        n = math.hypot(vx, vy)
        dr = ImageDraw.Draw(img)
        cx, cy, L = 44, size - 40, 26
        if n > 0.15:
            ex, ey = cx + vx / n * L, cy - vy / n * L
            dr.line((cx, cy, ex, ey), fill=(255, 90, 90), width=3)
            ang = math.atan2(ey - cy, ex - cx)
            for da in (2.6, -2.6):
                dr.line((ex, ey, ex + 9 * math.cos(ang + da), ey + 9 * math.sin(ang + da)), fill=(255, 90, 90), width=3)
            dr.text((cx - 14, cy + 14), "front", fill=(255, 130, 130), font=_font(13))
        else:
            dr.text((cx - 14, cy), "front: toward/away", fill=(255, 130, 130), font=_font(11))
    if return_info:
        return img, dict(half=half, target=tgt_d, yaw=yaw, pitch=pitch)
    return img


# ======================================================================================
# sheets / annotation
# ======================================================================================
def _font(sz=14):
    for p in ("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", "/usr/share/fonts/dejavu/DejaVuSans.ttf"):
        if os.path.exists(p):
            return ImageFont.truetype(p, sz)
    return ImageFont.load_default()


def annotate(img, text, xy=(8, 6), color=(255, 255, 255)):
    d = ImageDraw.Draw(img)
    f = _font(14)
    bbox = d.textbbox(xy, text, font=f)
    d.rectangle((bbox[0] - 3, bbox[1] - 2, bbox[2] + 3, bbox[3] + 2), fill=(0, 0, 0))
    d.text(xy, text, font=f, fill=color)
    return img


def contact_sheet(images, labels=None, cols=None, pad=6, bg=(20, 20, 24)):
    n = len(images)
    cols = cols or n
    rows = (n + cols - 1) // cols
    w = max(i.width for i in images)
    h = max(i.height for i in images)
    sheet = Image.new("RGB", (cols * w + (cols + 1) * pad, rows * h + (rows + 1) * pad), bg)
    for k, im in enumerate(images):
        im = im.copy()
        if labels and k < len(labels) and labels[k]:
            annotate(im, labels[k])
        sheet.paste(im, (pad + (k % cols) * (w + pad), pad + (k // cols) * (h + pad)))
    return sheet


def parse_pose(s):
    if not s:
        return None
    if os.path.exists(s):
        with open(s) as f:
            return json.load(f)
    return json.loads(s)


VIEWS = {"front": (0, 0), "right": (90, 0), "back": (180, 0), "left": (270, 0),
         "front34": (35, 12), "back34": (215, 12), "top": (180, 89.5)}


# ======================================================================================
# calibration on vanilla
# ======================================================================================
def _vanilla_geo(name, identifier=None):
    return load_geometry(os.path.join(VANILLA, "models", "entity", name), identifier)


def calibrate(outdir):
    os.makedirs(outdir, exist_ok=True)
    report = []
    # ---- zombie, both arms -90 about X: arms must point to the face side -------------------
    z = _vanilla_geo("zombie.geo.json")
    pose = {"rightArm": {"rotation": [-90, 0, 0]}, "leftArm": {"rotation": [-90, 0, 0]}}
    ims, labs = [], []
    for nm, (ya, pi) in (("rest, side (yaw 90)", (90, 0)), ("arms -90, side (yaw 90)", (90, 0)),
                         ("arms -90, front34", (35, 12))):
        p = None if nm.startswith("rest") else pose
        ims.append(render(z, None, p, yaw=ya, pitch=pi, size=420, front_marker=True, ss=2, extent=44,
                          target=(0, 14, 0), front_arrow=True))
        labs.append("zombie " + nm + "  (red = face)")
    sheet = contact_sheet(ims, labs, cols=3)
    annotate(sheet, "vanilla zombie.geo.json (flat colours, no vanilla texture in samples); animation.zombie.attack_bare_hand "
                    "arms X=-90 -> arms must go to the FACE (red) side", (8, sheet.height - 22))
    sheet.save(os.path.join(outdir, "calibration_zombie.png"))
    # numeric check
    mats, _ = bone_matrices(z, pose)
    A, b = mats["rightArm"]
    tip = A @ np.array([-6.0, 12.0, 0.0]) + b  # bottom of the hanging right arm
    report.append(("zombie rightArm X=-90: arm tip rest (-6,12,0) -> %s ; front is -Z" % np.round(tip, 2)))
    # ---- evoker casting: right +135 Z, left -135 Z -> V shape up/out ------------------------
    e = _vanilla_geo("evoker.geo.json")
    pose = {"arms": {"scale": 0.0}, "leftarm": {"rotation": [0, 0, -135]}, "rightarm": {"rotation": [0, 0, 135]}}
    ims, labs = [], []
    for nm, (ya, pi) in (("rest, front", (0, 0)), ("casting, front", (0, 0)), ("casting, front34", (35, 12))):
        p = {"arms": {"scale": 1.0}} if nm.startswith("rest") else pose
        ims.append(render(e, None, p, yaw=ya, pitch=pi, size=420, front_marker=True, ss=2, extent=46, target=(0, 18, 0),
                          front_arrow=True))
        labs.append("evoker " + nm)
    sheet = contact_sheet(ims, labs, cols=3)
    annotate(sheet, "vanilla evoker.geo.json + animation.evoker.casting (right Z=+135, left Z=-135, bone names matched "
                    "case-insensitively) -> arms must form a V up and OUT", (8, sheet.height - 22))
    sheet.save(os.path.join(outdir, "calibration_evoker.png"))
    mats, _ = bone_matrices(e, pose)
    A, b = mats["rightArm"]
    tip = A @ np.array([-6.0, 12.0, 0.0]) + b
    mats2, _ = bone_matrices(e, pose)
    A2, b2 = mats2["leftArm"]
    tip2 = A2 @ np.array([6.0, 12.0, 0.0]) + b2
    report.append("evoker casting: right arm tip -> %s (outward = -x, up = +y ok if x<-5 and y>22)" % np.round(tip, 2))
    report.append("evoker casting: left  arm tip -> %s (outward = +x)" % np.round(tip2, 2))
    # ---- skeleton bow_and_arrow: tests the Y sign (top view) --------------------------------
    s = _vanilla_geo("skeleton.geo.json")
    pose = {"leftarm": {"rotation": [-90, 28.65, -2.865]}, "rightarm": {"rotation": [-90, -5.73, 2.865]}}
    ims, labs = [], []
    for ys, nm in ((+1, "Y sign +1 (used): arms converge"), (-1, "Y sign -1 (DESIGN.md claim): left arm flies out")):
        ims.append(render(s, None, pose, yaw=180, pitch=89.5, size=420, front_marker=True, ss=2, extent=40,
                          target=(0, 20, -8), y_sign=ys, front_arrow=True))
        labs.append(nm)
    sheet = contact_sheet(ims, labs, cols=2)
    annotate(sheet, "top view of vanilla skeleton, animation.humanoid.bow_and_arrow (arms X=-90, left Y=+28.65, right Y=-5.73), "
                    "front = up", (8, sheet.height - 22))
    sheet.save(os.path.join(outdir, "calibration_skeleton_bow.png"))
    for ys in (+1, -1):
        mats, _ = bone_matrices(s, pose, y_sign=ys)
        A, b = mats["leftArm"]
        tipl = A @ np.array([5.0, 12.0, 0.0]) + b
        A, b = mats["rightArm"]
        tipr = A @ np.array([-5.0, 12.0, 0.0]) + b
        report.append("skeleton bow, Y sign %+d: left hand x=%.2f z=%.2f, right hand x=%.2f z=%.2f (body centre line x=0)"
                      % (ys, tipl[0], tipl[2], tipr[0], tipr[2]))
    return report


# ======================================================================================
# SCP-096 preview set
# ======================================================================================
JAW_OPEN = {"jaw": {"rotation": [70, 0, 0]}}


POSE_TESTS = OrderedDict([
    ("rest", {}),
    ("scream (jaw 70, head back, arms out)", {
        "head": {"rotation": [-22, 0, 0]}, "jaw": {"rotation": [70, 0, 0]}, "torso": {"rotation": [-8, 0, 0]},
        "left_arm": {"rotation": [0, 0, -75]}, "right_arm": {"rotation": [0, 0, 75]},
        "left_forearm": {"rotation": [-25, 0, -10]}, "right_forearm": {"rotation": [-25, 0, 10]}}),
    ("hands on face (crying)", {
        "torso": {"rotation": [12, 0, 0]}, "head": {"rotation": [16, 0, 0]},
        "left_arm": {"rotation": [-62, 0, 10]}, "right_arm": {"rotation": [-62, 0, -10]},
        "left_forearm": {"rotation": [-105, 0, 0]}, "right_forearm": {"rotation": [-105, 0, 0]},
        "left_hand": {"rotation": [-15, 0, 0]}, "right_hand": {"rotation": [-15, 0, 0]}}),
    ("sitting (rig test, arms untuned)", {
        "root": {"position": [0, -20, 0]}, "torso": {"rotation": [28, 0, 0]}, "head": {"rotation": [18, 0, 0]},
        "left_leg": {"rotation": [-145, 0, -5]}, "right_leg": {"rotation": [-145, 0, 5]},
        "left_shin": {"rotation": [150, 0, 0]}, "right_shin": {"rotation": [150, 0, 0]},
        "left_arm": {"rotation": [-100, 0, 12]}, "right_arm": {"rotation": [-100, 0, -12]},
        "left_forearm": {"rotation": [-80, 0, 0]}, "right_forearm": {"rotation": [-80, 0, 0]},
        "left_hand": {"rotation": [-20, 0, 0]}, "right_hand": {"rotation": [-20, 0, 0]}}),
    ("run (rage sprint)", {
        "torso": {"rotation": [24, 0, 0]}, "head": {"rotation": [-18, 0, 0]}, "jaw": {"rotation": [55, 0, 0]},
        "left_arm": {"rotation": [-75, 0, -8]}, "right_arm": {"rotation": [-75, 0, 8]},
        "left_forearm": {"rotation": [-30, 0, 0]}, "right_forearm": {"rotation": [-30, 0, 0]},
        "left_leg": {"rotation": [-55, 0, 0]}, "right_leg": {"rotation": [40, 0, 0]},
        "left_shin": {"rotation": [75, 0, 0]}, "right_shin": {"rotation": [10, 0, 0]}}),
])


def pose_test_sheet(outpath=None, geo_path=None, tex_path=None):
    gp, tp = default_paths()
    geo = load_geometry(geo_path or gp)
    tex = load_texture(tex_path or tp)
    ims, labs = [], []
    for name, pose in POSE_TESTS.items():
        for ya in (90, 30):
            ims.append(render(geo, tex, pose, yaw=ya, pitch=6 if ya != 90 else 0, size=440, ss=2, target=(0, 22, -2),
                              extent=60, front_arrow=(ya == 90)))
            labs.append(name + (" - side" if ya == 90 else " - 3/4"))
    sheet = contact_sheet(ims, labs, cols=4)
    if outpath:
        sheet.save(outpath)
    return sheet


def make_icon(paths, geo_path=None, tex_path=None, size=256):
    """pack_icon.png: face close-up on a dark vignette background; the same bytes are written to every path."""
    import io
    gp, tp = default_paths()
    geo = load_geometry(geo_path or gp)
    tex = load_texture(tex_path or tp)
    bg = (12, 12, 16)
    im = render(geo, tex, None, yaw=22, pitch=5, size=size, ss=4, target=(0, 40.2, 0), extent=15.5, ground=False,
                ortho=False, fov=16, bg=bg, ambient=0.78)
    a = np.asarray(im).astype(np.float32)
    yy, xx = np.mgrid[0:size, 0:size].astype(np.float32)
    rr = np.sqrt(((xx - size / 2) / (size / 2)) ** 2 + ((yy - size / 2) / (size / 2)) ** 2)
    vig = np.clip(1.15 - 0.55 * rr ** 2, 0.25, 1.0)
    bgmask = (np.abs(a - np.array(bg, dtype=np.float32)).sum(-1) < 1.0)[..., None]
    out = np.where(bgmask, a, a * vig[..., None])
    # faint cold glow behind the head so the dark background has some depth
    glow = np.clip(1.0 - rr, 0, 1)[..., None] ** 2 * np.array([10, 12, 20], dtype=np.float32)
    out = np.where(bgmask, np.array(bg, dtype=np.float32) + glow, out)
    img = Image.fromarray(np.clip(out, 0, 255).astype(np.uint8), "RGB")
    buf = io.BytesIO()
    img.save(buf, "PNG", optimize=True)
    data = buf.getvalue()
    for p in paths:
        os.makedirs(os.path.dirname(p), exist_ok=True)
        with open(p, "wb") as f:
            f.write(data)
    return img


def make_previews(outdir=None, geo_path=None, tex_path=None):
    gp, tp = default_paths()
    geo = load_geometry(geo_path or gp)
    tex = load_texture(tex_path or tp)
    outdir = outdir or os.path.join(ROOT, "previews")
    os.makedirs(outdir, exist_ok=True)
    kw = dict(size=640, ss=3)
    for name, (ya, pi) in (("front", (0, 0)), ("side", (90, 0)), ("back", (180, 0))):
        im = render(geo, tex, None, yaw=ya, pitch=pi, front_arrow=(name == "side"), **kw)
        annotate(im, "SCP-096 " + name)
        im.save(os.path.join(outdir, "model_%s.png" % name))
    im = render(geo, tex, None, yaw=30, pitch=10, ortho=False, fov=26, **kw)
    im.save(os.path.join(outdir, "model_front34.png"))
    head_t = (0, 40, 0)
    for nm, pose in (("model_head_closeup.png", None), ("model_head_closeup_open.png", JAW_OPEN)):
        ims = []
        for ya, pi in ((0, 0), (35, 8), (90, 0)):
            ims.append(render(geo, tex, pose, yaw=ya, pitch=pi, size=520, ss=3, target=head_t, extent=17, ground=False,
                              ortho=False, fov=18))
        contact_sheet(ims, ["front", "3/4", "side"], cols=3).save(os.path.join(outdir, nm))
    pose_test_sheet(os.path.join(outdir, "pose_tests.png"), geo_path, tex_path)
    make_icon([os.path.join(ROOT, "SCP096_BP", "pack_icon.png"), os.path.join(ROOT, "SCP096_RP", "pack_icon.png")],
              geo_path, tex_path)
    # texture atlas (nearest-neighbour upscale on a checker so alpha is visible)
    t = Image.fromarray(tex, "RGBA")
    bgc = Image.new("RGBA", t.size, (255, 0, 255, 255))
    bgc.alpha_composite(t)
    bgc.resize((768, 768), Image.NEAREST).convert("RGB").save(os.path.join(outdir, "texture_atlas.png"))
    return outdir


# ======================================================================================
# self test
# ======================================================================================
def selftest(verbose=True):
    """Numeric self-checks of the rasteriser conventions (no images written)."""
    sys.path.insert(0, HERE)
    import make_model as MM
    log = []

    def ok(cond, msg):
        log.append(("PASS " if cond else "FAIL ") + msg)
        assert cond, msg

    # 1. painter canvas orientation == renderer face orientation
    cube = Cube(dict(origin=[0, 0, 0], size=[4, 5, 6], uv=[0, 0]), 0, False)
    axes = {"x": 0, "y": 1, "z": 2}
    for fn, P0, U, V, rect, flip in cube_faces(cube):
        col, row = MM.CANVAS_AXES[fn]
        cu = np.zeros(3); cu[axes[col[1]]] = 1 if col[0] == "+" else -1
        rv = np.zeros(3); rv[axes[row[1]]] = 1 if row[0] == "+" else -1
        ok(np.allclose(U / np.linalg.norm(U), cu) and np.allclose(V / np.linalg.norm(V), rv),
           "face %-5s canvas col %s row %s == renderer U,V" % (fn, col, row))
    # 2. rotation convention
    def rot(rx, ry, rz, v):
        return rot_matrix(rx, ry, rz) @ np.array(v, float)
    down, front = (0, -1, 0), (0, 0, -1)
    ok(np.allclose(rot(-90, 0, 0, down), (0, 0, -1), atol=1e-9), "X=-90 swings a hanging limb FORWARD (-Z)")
    ok(np.allclose(rot(0, 0, 135, down), (-0.7071, 0.7071, 0), atol=1e-3), "Z=+135 on a hanging limb: toward -X (right side outward) and up")
    ok(np.allclose(rot(0, 0, -135, down), (0.7071, 0.7071, 0), atol=1e-3), "Z=-135 on a hanging limb: toward +X (left side outward) and up")
    ok(rot(0, 30, 0, front)[0] < -0.4, "Y=+30 turns a forward-pointing bone toward -X (mob's right)")
    ok(rot(60, 0, 0, front)[1] < -0.8, "X=+60 on a forward vector tips it DOWN (jaw opening / nodding down are +X)")
    ok(rot(30, 0, 0, (0, 1, 0))[2] < -0.4, "X=+30 on an upward limb leans it FORWARD (torso hunch / head nod are +X)")
    R = rot_matrix(30, 40, 50)
    Rx = rot_matrix(30, 0, 0); Ry = rot_matrix(0, 40, 0); Rz = rot_matrix(0, 0, 50)
    ok(np.allclose(R, Rz @ Ry @ Rx), "order: X applied first, then Y, then Z (R = Rz Ry Rx)")
    # 3. bone chain: pivot handling
    geo = Geometry("t", 16, 16, [Bone({"name": "a", "pivot": [0, 10, 0], "cubes": []}),
                                 Bone({"name": "b", "parent": "a", "pivot": [0, 5, 0], "cubes": []})])
    mats, _ = bone_matrices(geo, {"a": {"rotation": [-90, 0, 0]}, "b": {"position": [0, 0, -1]}})
    A, b = mats["b"]
    p = A @ np.array([0, 0, 0.0]) + b  # rest point at the origin hanging 10 below the pivot of a
    ok(np.allclose(p, (0, 11, -10), atol=1e-9), "child position is expressed in the parent frame and rotates with it: %s" % np.round(p, 3))
    # 4. position: +Y up, -Z forward
    mats, _ = bone_matrices(geo, {"a": {"position": [0, 3, -2]}})
    ok(np.allclose(mats["a"][1], (0, 3, -2)), "position adds in model px (+Y up, -Z forward)")
    # 5. display mirror: the mob's right (-X) is on the viewer's LEFT when looking at the face
    g2 = Geometry("t", 16, 16, [Bone({"name": "root", "pivot": [0, 0, 0],
                                      "cubes": [dict(origin=[-6, 0, -1], size=[2, 2, 2], uv=[0, 0]),
                                                dict(origin=[4, 0, -1], size=[2, 2, 2], uv=[8, 0])]})])
    tex = np.zeros((16, 16, 4), np.uint8); tex[..., 3] = 255
    tex[0:6, 0:8, :3] = (255, 0, 0)    # right cube (-X) red
    tex[0:6, 8:16, :3] = (0, 0, 255)   # left cube (+X) blue
    im = np.asarray(render(g2, tex, None, yaw=0, pitch=0, size=200, ss=1, ground=False, bg=(0, 0, 0), shade=False))
    red_x = np.nonzero(im[..., 0] > 100)[1].mean(); blue_x = np.nonzero(im[..., 2] > 100)[1].mean()
    ok(red_x < blue_x, "front view: the -X (right_*) cube appears on the viewer's LEFT (red x=%.0f < blue x=%.0f)" % (red_x, blue_x))
    if verbose:
        print("\n".join(log))
    return log


# ======================================================================================
# CLI
# ======================================================================================
def default_paths():
    return (os.path.join(ROOT, "SCP096_RP", "models", "entity", "scp096.geo.json"),
            os.path.join(ROOT, "SCP096_RP", "textures", "entity", "scp096.png"))


def main(argv=None):
    gp, tp = default_paths()
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--geo", default=gp)
    ap.add_argument("--id", default=None, help="geometry identifier inside the file")
    ap.add_argument("--tex", default=tp)
    ap.add_argument("--out", default=os.path.join(ROOT, "previews", "render.png"))
    ap.add_argument("--views", default="front", help="comma list of %s or yaw:pitch" % ",".join(VIEWS))
    ap.add_argument("--pose", default=None, help="JSON string or file {bone:{rotation,position,scale}}")
    ap.add_argument("--size", type=int, default=512)
    ap.add_argument("--ss", type=int, default=2)
    ap.add_argument("--persp", action="store_true")
    ap.add_argument("--flat", action="store_true", help="flat bone colours instead of the texture")
    ap.add_argument("--no-ground", action="store_true")
    ap.add_argument("--target", default=None, help="x,y,z look-at point in model px")
    ap.add_argument("--extent", type=float, default=None, help="visible height in model px")
    ap.add_argument("--cols", type=int, default=None)
    ap.add_argument("--calibrate", action="store_true", help="write vanilla calibration renders to previews/")
    ap.add_argument("--selftest", action="store_true", help="numeric checks of the conventions")
    ap.add_argument("--previews", action="store_true", help="write the standard SCP-096 preview set to previews/")
    a = ap.parse_args(argv)
    outdir = os.path.join(ROOT, "previews")
    if a.selftest:
        selftest()
        return
    if a.calibrate:
        for line in calibrate(outdir):
            print(line)
        return
    if a.previews:
        print("wrote previews to", make_previews(outdir))
        return
    geo = load_geometry(a.geo, a.id)
    tex = load_texture(a.tex) if (os.path.exists(a.tex) and not a.flat) else None
    pose = parse_pose(a.pose)
    imgs, labels = [], []
    for v in a.views.split(","):
        if v in VIEWS:
            ya, pi = VIEWS[v]
        else:
            ya, pi = (float(x) for x in v.split(":"))
        tgt = tuple(float(x) for x in a.target.split(",")) if a.target else None
        imgs.append(render(geo, tex, pose, yaw=ya, pitch=pi, size=a.size, ss=a.ss, ortho=not a.persp, flat=a.flat,
                           ground=not a.no_ground, target=tgt, extent=a.extent))
        labels.append(v)
    out = imgs[0] if len(imgs) == 1 else contact_sheet(imgs, labels, cols=a.cols)
    os.makedirs(os.path.dirname(a.out), exist_ok=True)
    out.save(a.out)
    print("wrote", a.out)


if __name__ == "__main__":
    main()
