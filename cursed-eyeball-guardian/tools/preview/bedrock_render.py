#!/usr/bin/env python3
"""Tiny software renderer for Minecraft Bedrock entity geometry (preview only).

It implements the Bedrock conventions exactly as Blockbench's Bedrock codec
interprets them (Blockbench is the reference the community validates against
the game):

* Geometry JSON space ("J space"): +Y up, the entity faces -Z.  The game (and
  Blockbench) render this space mirrored in X, so +X_J is the entity's LEFT.
  For display we therefore convert to "B space" (x_B = -x_J) and use a normal
  right-handed camera.  From the front, +X_J appears on the viewer's right.
* Bone/cube rotation [rx, ry, rz] (degrees) is, in J space with right-handed
  matrices, R = Rz(-rz) . Ry(ry) . Rx(-rx)   (X applied first, then Y, Z).
  Check: rx = +90 maps +Y to -Z (the vanilla cow's body lies on its legs).
* Bone transform: M = M_parent . T(pivot + anim_pos) . R(rest + anim_rot)
  . S(anim_scale) . T(-pivot).  Cube rotation pivots likewise.
* inflate grows the box on every side without touching the UVs.
* Per-face UVs (format 1.12+), positive uv_size, in J space:
    north (-Z face): u -> +X, v -> -Y      south (+Z face): u -> -X, v -> -Y
    east  (-X face): u -> -Z, v -> -Y      west  (+X face): u -> +Z, v -> -Y
    up    (+Y face): u -> +X, v -> -Z      down  (-Y face): u -> +X, v -> +Z
  (derived from Blockbench's setShape vertex order, its 'ZYX' euler order and
  the up/down uv flip it applies when exporting Bedrock per-face UVs).
* Box UV is converted to the same per-face form exactly like Blockbench does
  (face_list in cube.js updateUV, including bone/cube "mirror").

Rendering: z-buffer rasteriser with nearest-neighbour texture sampling,
alpha-test (< 0.5 discarded), Minecraft-style two-light entity shading.  An
optional emissive overlay (same geometry, same UVs) is composited with alpha
blending at full brightness, like the warden bioluminescent layer.
"""
import json
import math
import re

import numpy as np
from PIL import Image

# --------------------------------------------------------------------------
# math helpers


def _rx(a):
    c, s = math.cos(a), math.sin(a)
    return np.array([[1, 0, 0], [0, c, -s], [0, s, c]], dtype=np.float64)


def _ry(a):
    c, s = math.cos(a), math.sin(a)
    return np.array([[c, 0, s], [0, 1, 0], [-s, 0, c]], dtype=np.float64)


def _rz(a):
    c, s = math.cos(a), math.sin(a)
    return np.array([[c, -s, 0], [s, c, 0], [0, 0, 1]], dtype=np.float64)


def bedrock_rotation(r):
    """3x3 rotation for a Bedrock [rx, ry, rz] (degrees) in J space."""
    rx, ry, rz = (math.radians(float(a)) for a in r)
    return _rz(-rz) @ _ry(ry) @ _rx(-rx)


def _m4(r3=None, t=None):
    m = np.eye(4)
    if r3 is not None:
        m[:3, :3] = r3
    if t is not None:
        m[:3, 3] = t
    return m


def _t4(v):
    return _m4(t=np.asarray(v, dtype=np.float64))


def _s4(s):
    m = np.eye(4)
    if np.isscalar(s):
        s = (s, s, s)
    m[0, 0], m[1, 1], m[2, 2] = s
    return m


# --------------------------------------------------------------------------
# geometry loading


FACES = ("north", "south", "east", "west", "up", "down")


def _box_uv_faces(uv, size, mirror):
    """Blockbench cube.js updateUV face_list -> Bedrock per-face (u, v, su, sv)."""
    w, h, d = (math.floor(s) for s in size)
    u0, v0 = uv
    fl = {
        "east": [[0, d], [d, h]],
        "west": [[d + w, d], [d, h]],
        "up": [[d + w, d], [-w, -d]],
        "down": [[d + 2 * w, 0], [-w, d]],
        "south": [[2 * d + w, d], [w, h]],
        "north": [[d, d], [w, h]],
    }
    if mirror:
        for f in fl.values():
            f[0][0] += f[1][0]
            f[1][0] *= -1
        fl["east"], fl["west"] = fl["west"], fl["east"]
    out = {}
    for name, (frm, sz) in fl.items():
        u, v = frm[0] + u0, frm[1] + v0
        su, sv = sz
        if name in ("up", "down"):  # Blockbench export flip
            u, v, su, sv = u + su, v + sv, -su, -sv
        out[name] = (u, v, su, sv)
    return out


def load_geometry(path, identifier=None):
    """Return dict(texture_width, texture_height, bones=[...]) for one geometry."""
    with open(path) as f:
        data = json.load(f)
    geos = []
    if "minecraft:geometry" in data:
        for g in data["minecraft:geometry"]:
            desc = g.get("description", {})
            geos.append((desc.get("identifier"), desc.get("texture_width", 64),
                         desc.get("texture_height", 64), g.get("bones", [])))
    else:
        for k, g in data.items():
            if k.startswith("geometry."):
                geos.append((k.split(":")[0], g.get("texturewidth", 64),
                             g.get("textureheight", 64), g.get("bones", [])))
    if identifier:
        geos = [g for g in geos if g[0] == identifier]
    if not geos:
        raise ValueError("geometry %s not found in %s" % (identifier, path))
    ident, tw, th, raw_bones = geos[0]
    bones = []
    for b in raw_bones:
        bone_inflate = b.get("inflate", 0)
        bone_mirror = b.get("mirror", False)
        cubes = []
        for c in b.get("cubes", []):
            size = c.get("size", [0, 0, 0])
            uv = c.get("uv", [0, 0])
            mirror = c.get("mirror", bone_mirror)
            if isinstance(uv, dict):
                faces = {}
                for fname, fv in uv.items():
                    if fname not in FACES:
                        continue
                    su, sv = fv.get("uv_size", [0, 0])
                    faces[fname] = (fv["uv"][0], fv["uv"][1], su, sv)
            else:
                faces = _box_uv_faces(uv, size, mirror)
            cubes.append({
                "origin": c.get("origin", [0, 0, 0]),
                "size": size,
                "inflate": c.get("inflate", bone_inflate),
                "faces": faces,
                "rotation": c.get("rotation"),
                "pivot": c.get("pivot"),
            })
        bones.append({
            "name": b["name"],
            "parent": b.get("parent"),
            "pivot": b.get("pivot", [0, 0, 0]),
            "rotation": b.get("rotation") or [0, 0, 0],
            # legacy (<=1.10) bind_pose_rotation only turns the bone's own cubes
            # (the v1.8 cow's legs are children of its rotated body)
            "bind_rotation": b.get("bind_pose_rotation"),
            "cubes": cubes,
            "locators": b.get("locators", {}),
        })
    return {"identifier": ident, "texture_width": tw, "texture_height": th,
            "bones": bones}


# --------------------------------------------------------------------------
# posing / triangulation


def bone_matrices(geo, pose=None, root_scale=1.0):
    """World (J space) 4x4 matrix per bone.  pose: name -> {rot,pos,scale}."""
    pose = pose or {}
    by_name = {b["name"].lower(): b for b in geo["bones"]}
    cache = {}

    def mat(name):
        key = name.lower()
        if key in cache:
            return cache[key]
        b = by_name[key]
        p = pose.get(b["name"], {})
        rot = np.add(b["rotation"], p.get("rot", [0, 0, 0]))
        pos = np.asarray(p.get("pos", [0, 0, 0]), dtype=np.float64)
        pivot = np.asarray(b["pivot"], dtype=np.float64)
        local = _t4(pivot + pos) @ _m4(bedrock_rotation(rot)) @ _s4(p.get("scale", 1.0)) @ _t4(-pivot)
        parent = b.get("parent")
        if parent and parent.lower() in by_name:
            m = mat(parent) @ local
        else:
            m = _s4(root_scale) @ local
        cache[key] = m
        return m

    return {b["name"]: mat(b["name"]) for b in geo["bones"]}


def _hidden(geo, hidden):
    """Set of bone names hidden directly or through a hidden ancestor."""
    hidden = set(hidden or ())
    by_name = {b["name"]: b for b in geo["bones"]}
    out = set()
    for b in geo["bones"]:
        n = b["name"]
        while n:
            if n in hidden:
                out.add(b["name"])
                break
            n = by_name[n]["parent"] if n in by_name else None
    return out


def face_quads(x0, y0, z0, x1, y1, z1):
    """Corners (TL, TR, BL, BR in uv space) for each face, J space."""
    return {
        "north": [(x0, y1, z0), (x1, y1, z0), (x0, y0, z0), (x1, y0, z0)],
        "south": [(x1, y1, z1), (x0, y1, z1), (x1, y0, z1), (x0, y0, z1)],
        "east": [(x0, y1, z1), (x0, y1, z0), (x0, y0, z1), (x0, y0, z0)],
        "west": [(x1, y1, z0), (x1, y1, z1), (x1, y0, z0), (x1, y0, z1)],
        "up": [(x0, y1, z1), (x1, y1, z1), (x0, y1, z0), (x1, y1, z0)],
        "down": [(x0, y0, z0), (x1, y0, z0), (x0, y0, z1), (x1, y0, z1)],
    }


def triangles(geo, pose=None, hidden=None, root_scale=1.0, root_offset=(0, 0, 0)):
    """Return (pos (N,3,3) J space, uv (N,3,2) UV units, bone index per tri)."""
    mats = bone_matrices(geo, pose, root_scale)
    hide = _hidden(geo, hidden)
    P, U, B = [], [], []
    for bi, b in enumerate(geo["bones"]):
        if b["name"] in hide:
            continue
        M = _t4(root_offset) @ mats[b["name"]]
        if b.get("bind_rotation"):
            bp = np.asarray(b["pivot"], dtype=np.float64)
            M = M @ _t4(bp) @ _m4(bedrock_rotation(b["bind_rotation"])) @ _t4(-bp)
        for c in b["cubes"]:
            o = np.asarray(c["origin"], dtype=np.float64)
            s = np.asarray(c["size"], dtype=np.float64)
            inf = c["inflate"] or 0.0
            lo, hi = o - inf, o + s + inf
            Mc = M
            if c["rotation"]:
                cp = np.asarray(c["pivot"] if c["pivot"] is not None else (o + s / 2), dtype=np.float64)
                Mc = M @ _t4(cp) @ _m4(bedrock_rotation(c["rotation"])) @ _t4(-cp)
            quads = face_quads(lo[0], lo[1], lo[2], hi[0], hi[1], hi[2])
            for fname, (u, v, su, sv) in c["faces"].items():
                corners = np.array(quads[fname], dtype=np.float64)
                corners = (Mc @ np.c_[corners, np.ones(4)].T).T[:, :3]
                uvs = np.array([(u, v), (u + su, v), (u, v + sv), (u + su, v + sv)], dtype=np.float64)
                for tri in ((0, 1, 2), (1, 3, 2)):
                    P.append(corners[list(tri)])
                    U.append(uvs[list(tri)])
                    B.append(bi)
    if not P:
        return np.zeros((0, 3, 3)), np.zeros((0, 3, 2)), np.zeros(0, dtype=int)
    return np.array(P), np.array(U), np.array(B)


# --------------------------------------------------------------------------
# camera + rasteriser


class Camera:
    """Right-handed look-at camera in B space (x mirrored vs geometry JSON).

    yaw 0 = looking at the entity's front (from -Z), positive yaw orbits
    towards the viewer's right side of the model (+X_J side).
    """

    def __init__(self, target=(0, 8, 0), yaw=0.0, pitch=0.0, dist=60.0,
                 ortho_scale=None, fov=30.0):
        self.target = np.array([-target[0], target[1], target[2]], dtype=np.float64)
        a, p = math.radians(yaw), math.radians(pitch)
        offset = np.array([-math.sin(a) * math.cos(p), math.sin(p), -math.cos(a) * math.cos(p)])
        self.eye = self.target + dist * offset
        f = self.target - self.eye
        f /= np.linalg.norm(f)
        up = np.array([0.0, 1.0, 0.0])
        r = np.cross(f, up)
        r /= np.linalg.norm(r)
        u = np.cross(r, f)
        self.f, self.r, self.u = f, r, u
        self.ortho_scale = ortho_scale  # model px visible across the image width
        self.fov = fov

    def project(self, pts_j, W, H):
        """J-space points (...,3) -> screen x, y (pixels), depth."""
        p = np.array(pts_j, dtype=np.float64)
        p[..., 0] *= -1.0  # to B space
        d = p - self.eye
        x = d @ self.r
        y = d @ self.u
        z = d @ self.f
        if self.ortho_scale:
            k = W / self.ortho_scale
            sx = W / 2 + x * k
            sy = H / 2 - y * k
            w = np.ones_like(z)
        else:
            k = (W / 2) / math.tan(math.radians(self.fov) / 2)
            sx = W / 2 + x * k / z
            sy = H / 2 - y * k / z
            w = z
        return sx, sy, z, w

    def world_normal_b(self, n_j):
        n = np.array(n_j, dtype=np.float64)
        n[..., 0] *= -1.0
        return n


LIGHT0 = np.array([0.2, 1.0, -0.7]) / np.linalg.norm([0.2, 1.0, -0.7])
LIGHT1 = np.array([-0.2, 1.0, 0.7]) / np.linalg.norm([-0.2, 1.0, 0.7])


def mc_shade(n):
    """Minecraft entity lighting (ambient 0.4 + two diffuse lights)."""
    v = 0.4 + 0.6 * (max(0.0, float(n @ LIGHT0)) + max(0.0, float(n @ LIGHT1)))
    return min(1.0, v)


def load_texture(path_or_img):
    img = path_or_img if isinstance(path_or_img, Image.Image) else Image.open(path_or_img)
    return np.asarray(img.convert("RGBA"), dtype=np.float32) / 255.0


def render(geo, tex, cam, W=512, H=512, ss=2, pose=None, hidden=None,
           glow=None, glow_alpha=1.0, light=1.0, background=None,
           root_scale=1.0, root_offset=(0, 0, 0), return_layers=False):
    """Render geo with texture tex (float RGBA array).  Returns PIL RGBA image.

    glow: optional emissive overlay texture (same UV layout); composited with
    alpha blending at full brightness (ignore_lighting) times glow_alpha.
    light: world light multiplier for the lit base layer (night < 1).
    background: optional (H, W, 3/4) float array or PIL image to composite on.
    """
    P, UV, _ = triangles(geo, pose, hidden, root_scale, root_offset)
    w_px, h_px = W * ss, H * ss
    zbuf = np.full((h_px, w_px), np.inf)
    col = np.zeros((h_px, w_px, 3), dtype=np.float32)
    uvbuf = np.full((h_px, w_px, 2), -1.0, dtype=np.float32)
    shade = np.zeros((h_px, w_px), dtype=np.float32)
    th, tw = tex.shape[:2]
    tu, tv = float(geo["texture_width"]), float(geo["texture_height"])
    if len(P) == 0:
        return Image.new("RGBA", (W, H))
    sx, sy, sz, sw = cam.project(P, w_px, h_px)
    for i in range(len(P)):
        x, y, z, wv = sx[i], sy[i], sz[i], sw[i]
        if np.any(wv <= 0.01):
            continue
        e1 = P[i, 1] - P[i, 0]
        e2 = P[i, 2] - P[i, 0]
        n = np.cross(e1, e2)
        nn = np.linalg.norm(n)
        if nn < 1e-12:
            continue
        n = cam.world_normal_b(n / nn)
        # quads are wound so cross(e1, e2) points outward (J space)
        lum = mc_shade(n)
        x0 = int(max(0, math.floor(x.min())))
        x1 = int(min(w_px - 1, math.ceil(x.max())))
        y0 = int(max(0, math.floor(y.min())))
        y1 = int(min(h_px - 1, math.ceil(y.max())))
        if x0 > x1 or y0 > y1:
            continue
        gx, gy = np.meshgrid(np.arange(x0, x1 + 1) + 0.5, np.arange(y0, y1 + 1) + 0.5)
        den = (y[1] - y[2]) * (x[0] - x[2]) + (x[2] - x[1]) * (y[0] - y[2])
        if abs(den) < 1e-9:
            continue
        l0 = ((y[1] - y[2]) * (gx - x[2]) + (x[2] - x[1]) * (gy - y[2])) / den
        l1 = ((y[2] - y[0]) * (gx - x[2]) + (x[0] - x[2]) * (gy - y[2])) / den
        l2 = 1.0 - l0 - l1
        eps = -1e-4
        inside = (l0 >= eps) & (l1 >= eps) & (l2 >= eps)
        if not inside.any():
            continue
        # perspective-correct interpolation
        iw = np.array([1.0 / wv[0], 1.0 / wv[1], 1.0 / wv[2]])
        q = l0 * iw[0] + l1 * iw[1] + l2 * iw[2]
        b0, b1, b2 = l0 * iw[0] / q, l1 * iw[1] / q, l2 * iw[2] / q
        depth = b0 * z[0] + b1 * z[1] + b2 * z[2]
        u = b0 * UV[i, 0, 0] + b1 * UV[i, 1, 0] + b2 * UV[i, 2, 0]
        v = b0 * UV[i, 0, 1] + b1 * UV[i, 1, 1] + b2 * UV[i, 2, 1]
        px = np.clip(np.floor(u / tu * tw), 0, tw - 1).astype(int)
        py = np.clip(np.floor(v / tv * th), 0, th - 1).astype(int)
        texel = tex[py, px]
        sub_z = zbuf[y0:y1 + 1, x0:x1 + 1]
        m = inside & (texel[..., 3] >= 0.5) & (depth < sub_z)
        if not m.any():
            continue
        sub_z[m] = depth[m]
        col[y0:y1 + 1, x0:x1 + 1][m] = texel[..., :3][m]
        shade[y0:y1 + 1, x0:x1 + 1][m] = lum
        uvbuf[y0:y1 + 1, x0:x1 + 1, 0][m] = px[m]
        uvbuf[y0:y1 + 1, x0:x1 + 1, 1][m] = py[m]
    covered = np.isfinite(zbuf)
    lit = col * (shade * light)[..., None]
    out = lit.copy()
    if glow is not None:
        gh, gw = glow.shape[:2]
        gx = np.clip((uvbuf[..., 0] * gw / tw).astype(int), 0, gw - 1)
        gy = np.clip((uvbuf[..., 1] * gh / th).astype(int), 0, gh - 1)
        g = glow[gy, gx]
        a = (g[..., 3] * glow_alpha)[..., None] * covered[..., None]
        out = out * (1 - a) + g[..., :3] * a
    alpha = covered.astype(np.float32)
    rgba = np.dstack([np.clip(out, 0, 1), alpha])
    if background is not None:
        bg = background
        if isinstance(bg, Image.Image):
            bg = np.asarray(bg.convert("RGB").resize((w_px, h_px), Image.NEAREST), dtype=np.float32) / 255.0
        else:
            bg = np.asarray(Image.fromarray((np.clip(bg[..., :3], 0, 1) * 255).astype(np.uint8)).resize((w_px, h_px), Image.BILINEAR), dtype=np.float32) / 255.0
        rgb = rgba[..., :3] * alpha[..., None] + bg * (1 - alpha[..., None])
        rgba = np.dstack([rgb, np.ones_like(alpha)])
    img = Image.fromarray((rgba * 255 + 0.5).astype(np.uint8), "RGBA")
    if ss > 1:
        img = img.resize((W, H), Image.BOX)
    if return_layers:
        return img, {"covered": covered, "uv": uvbuf}
    return img


# --------------------------------------------------------------------------
# minimal molang evaluator for previewing our own (simple) animations


_MOLANG_FUNCS = {
    "math.sin": lambda a: math.sin(math.radians(a)),
    "math.cos": lambda a: math.cos(math.radians(a)),
    "math.abs": abs,
    "math.min": min,
    "math.max": max,
    "math.clamp": lambda v, lo, hi: max(lo, min(hi, v)),
    "math.mod": lambda a, b: math.fmod(a, b),
    "math.lerp": lambda a, b, t: a + (b - a) * t,
    "math.pow": pow,
    "math.sqrt": math.sqrt,
    "math.floor": math.floor,
    "math.round": round,
    "math.pi": None,
}

_TOK = re.compile(r"\s*(?:(\d+\.\d*|\.\d+|\d+)|('[^']*')|([A-Za-z_][A-Za-z0-9_.]*)|(<=|>=|==|!=|&&|\|\||[-+*/()?:<>!,;]))")


class _Molang:
    """Small recursive-descent Molang evaluator (preview use only)."""

    def __init__(self, text, ctx):
        self.toks = []
        pos = 0
        text = text.strip()
        while pos < len(text):
            m = _TOK.match(text, pos)
            if not m or m.end() == pos:
                raise ValueError("bad molang near: %r" % text[pos:])
            pos = m.end()
            num, string, ident, op = m.groups()
            if num is not None:
                self.toks.append(("n", float(num)))
            elif string is not None:
                self.toks.append(("s", string[1:-1]))
            elif ident is not None:
                self.toks.append(("i", ident))
            elif op is not None:
                self.toks.append(("o", op))
        self.i = 0
        self.ctx = ctx

    def peek(self):
        return self.toks[self.i] if self.i < len(self.toks) else (None, None)

    def take(self, op=None):
        t = self.peek()
        if op is not None and t != ("o", op):
            raise ValueError("expected %s got %r" % (op, t))
        self.i += 1
        return t

    def run(self):
        v = self.ternary()
        while self.peek() == ("o", ";"):
            self.take()
        return v

    def ternary(self):
        c = self.orx()
        if self.peek() == ("o", "?"):
            self.take()
            a = self.ternary()
            self.take(":")
            b = self.ternary()
            return a if c else b
        return c

    def orx(self):
        v = self.andx()
        while self.peek() == ("o", "||"):
            self.take()
            r = self.andx()
            v = 1.0 if (v or r) else 0.0
        return v

    def andx(self):
        v = self.cmp()
        while self.peek() == ("o", "&&"):
            self.take()
            r = self.cmp()
            v = 1.0 if (v and r) else 0.0
        return v

    def cmp(self):
        v = self.add()
        ops = {"<": lambda a, b: a < b, ">": lambda a, b: a > b, "<=": lambda a, b: a <= b,
               ">=": lambda a, b: a >= b, "==": lambda a, b: a == b, "!=": lambda a, b: a != b}
        while self.peek()[0] == "o" and self.peek()[1] in ops:
            op = self.take()[1]
            v = 1.0 if ops[op](v, self.add()) else 0.0
        return v

    def add(self):
        v = self.mul()
        while self.peek() in (("o", "+"), ("o", "-")):
            op = self.take()[1]
            r = self.mul()
            v = v + r if op == "+" else v - r
        return v

    def mul(self):
        v = self.unary()
        while self.peek() in (("o", "*"), ("o", "/")):
            op = self.take()[1]
            r = self.unary()
            v = v * r if op == "*" else (v / r if r else 0.0)
        return v

    def unary(self):
        t = self.peek()
        if t == ("o", "-"):
            self.take()
            return -self.unary()
        if t == ("o", "!"):
            self.take()
            return 0.0 if self.unary() else 1.0
        return self.primary()

    def primary(self):
        kind, val = self.take()
        if kind == "n":
            return val
        if kind == "s":
            return val
        if (kind, val) == ("o", "("):
            v = self.ternary()
            self.take(")")
            return v
        if kind == "i":
            name = val.lower()
            if self.peek() == ("o", "("):
                self.take()
                args = []
                if self.peek() != ("o", ")"):
                    args.append(self.ternary())
                    while self.peek() == ("o", ","):
                        self.take()
                        args.append(self.ternary())
                self.take(")")
                if name in ("query.property", "q.property"):
                    return float(self.ctx.get("__props__", {}).get(args[0], 0.0))
                if name in _MOLANG_FUNCS and _MOLANG_FUNCS[name]:
                    return float(_MOLANG_FUNCS[name](*args))
                raise ValueError("unknown function " + name)
            if name == "math.pi":
                return math.pi
            if name == "this":
                return 0.0
            name = re.sub(r"^q\.", "query.", name)
            name = re.sub(r"^v\.", "variable.", name)
            return float(self.ctx.get(name, 0.0))
        raise ValueError("unexpected token %r" % ((kind, val),))


def eval_molang(expr, ctx):
    """Evaluate a Molang expression (numbers pass through)."""
    if isinstance(expr, (int, float)):
        return float(expr)
    return float(_Molang(expr, ctx).run())


def _interp_channel(chan, t, ctx):
    """Evaluate a Bedrock animation channel (array, scalar, or keyframes)."""
    if isinstance(chan, (int, float, str)):
        v = eval_molang(chan, ctx)
        return [v, v, v]
    if isinstance(chan, list):
        return [eval_molang(c, ctx) for c in chan]
    keys = sorted(chan.items(), key=lambda kv: float(kv[0]))

    def val(k):
        if isinstance(k, dict):
            k = k.get("post", k.get("pre"))
        return _interp_channel(k, t, ctx)

    if t <= float(keys[0][0]):
        return val(keys[0][1])
    for (ta, va), (tb, vb) in zip(keys, keys[1:]):
        ta, tb = float(ta), float(tb)
        if ta <= t <= tb:
            f = (t - ta) / (tb - ta) if tb > ta else 0.0
            a, b = val(va), val(vb)
            return [x + (y - x) * f for x, y in zip(a, b)]
    return val(keys[-1][1])


def pose_from_animations(anim_file, anim_ids, t, ctx, anim_times=None):
    """Combine several animations (additive) into a pose dict at time t."""
    with open(anim_file) as f:
        anims = json.load(f)["animations"]
    pose = {}
    for aid in anim_ids:
        a = anims[aid]
        at = (anim_times or {}).get(aid, t)
        length = a.get("animation_length")
        if length and a.get("loop") is True:
            at = math.fmod(at, length)
        local = dict(ctx)
        local["query.anim_time"] = at
        local["query.life_time"] = ctx.get("query.life_time", t)
        for bone, chans in a.get("bones", {}).items():
            p = pose.setdefault(bone, {"rot": [0, 0, 0], "pos": [0, 0, 0], "scale": [1, 1, 1]})
            if "rotation" in chans:
                p["rot"] = list(np.add(p["rot"], _interp_channel(chans["rotation"], at, local)))
            if "position" in chans:
                p["pos"] = list(np.add(p["pos"], _interp_channel(chans["position"], at, local)))
            if "scale" in chans:
                p["scale"] = list(np.multiply(p["scale"], _interp_channel(chans["scale"], at, local)))
    return pose
