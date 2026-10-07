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


# ------------------------------------------------------------------ materials
#
# Each material paints an (h, w, 3) RGB float image plus an (h, w) glow mask
# in [0,1].  `ctx` tells the painter about the face: which texture axis runs
# along the cube's longest dimension (for grain / brushing direction) and
# whether it is a side, top or bottom face (for bevel lighting).

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


def metal(base, hi=None, streak=0.10, band=0.22, noise=0.05):
    base = _c(base)
    hi = _c(hi) if hi is not None else np.minimum(base * 1.6 + 0.08, 1)

    def paint(ctx):
        img = np.empty((ctx.h, ctx.w, 3))
        img[:] = base
        img += _streaks(ctx, 1.2, streak)[..., None]
        img += (_fbm(ctx.rng, ctx.h, ctx.w, 4) - 0.5)[..., None] * noise
        b = _spec_band(ctx, 0.28, 0.2, 1.0)
        img = _mix(img, hi, b * band)
        if ctx.is_down:
            img *= 0.8
        img = _bevel(img, ctx)
        return img, np.zeros((ctx.h, ctx.w))
    return paint


def wood(base, dark, rings=5.0):
    base, dark = _c(base), _c(dark)

    def paint(ctx):
        rng = ctx.rng
        h, w = ctx.h, ctx.w
        if ctx.grain_along_u:
            across = np.arange(h)[:, None] + _smooth_noise(rng, h, w, max(3, w // 4)) * 3.0
        else:
            across = np.arange(w)[None, :] + _smooth_noise(rng, h, w, max(3, h // 4)) * 3.0
        grain = 0.5 + 0.5 * np.sin(across / max(1.0, rings / 2.0) * math.pi)
        grain = grain ** 3
        img = _mix(np.broadcast_to(base, (h, w, 3)), dark, grain * 0.55)
        img += (_fbm(rng, h, w, 3) - 0.5)[..., None] * 0.05
        img = _bevel(img, ctx, 0.08, 0.12)
        return img, np.zeros((h, w))
    return paint


def leather_wrap(base, dark, period=3):
    base, dark = _c(base), _c(dark)

    def paint(ctx):
        h, w = ctx.h, ctx.w
        yy, xx = np.mgrid[0:h, 0:w]
        if ctx.grain_along_u:
            diag = (xx + yy * 0.6) % period
        else:
            diag = (yy + xx * 0.6) % period
        seam = (diag < 1).astype(float)
        img = _mix(np.broadcast_to(base, (h, w, 3)), dark, seam * 0.7)
        img += (_fbm(ctx.rng, h, w, 3) - 0.5)[..., None] * 0.08
        img = _bevel(img, ctx, 0.06, 0.1)
        return img, np.zeros((h, w))
    return paint


def knurl(base, hi):
    base, hi = _c(base), _c(hi)

    def paint(ctx):
        h, w = ctx.h, ctx.w
        yy, xx = np.mgrid[0:h, 0:w]
        dots = (((xx + yy) % 3 == 0) | ((xx - yy) % 3 == 0)).astype(float)
        img = _mix(np.broadcast_to(base, (h, w, 3)), hi, dots * 0.5)
        img = _bevel(img, ctx, 0.1, 0.12)
        return img, np.zeros((h, w))
    return paint


def bone(base=(0.88, 0.85, 0.74), crack=(0.45, 0.40, 0.32)):
    base, crack = _c(base), _c(crack)

    def paint(ctx):
        rng = ctx.rng
        h, w = ctx.h, ctx.w
        n = _fbm(rng, h, w, 6, 4)
        img = _mix(np.broadcast_to(base, (h, w, 3)), base * 0.78, n)
        ridge = np.abs(_smooth_noise(rng, h, w, 5) - 0.5)
        img = _mix(img, crack, (ridge < 0.035).astype(float) * 0.8)
        img = _bevel(img, ctx, 0.05, 0.18)
        return img, np.zeros((h, w))
    return paint


def obsidian(base=(0.07, 0.04, 0.11), fleck=(0.36, 0.16, 0.55)):
    base, fleck = _c(base), _c(fleck)

    def paint(ctx):
        rng = ctx.rng
        h, w = ctx.h, ctx.w
        n = _fbm(rng, h, w, 4, 3)
        img = _mix(np.broadcast_to(base, (h, w, 3)), base * 2.2, n * 0.6)
        f = rng.random((h, w)) > 0.93
        img[f] = _mix(img[f], fleck, 0.8)
        img = _mix(img, np.array([0.55, 0.45, 0.75]), _spec_band(ctx, 0.25, 0.15, 0.25))
        img = _bevel(img, ctx, 0.12, 0.05)
        return img, np.zeros((h, w))
    return paint


def patina(copper=(0.72, 0.43, 0.29), green=(0.29, 0.62, 0.52)):
    copper, green = _c(copper), _c(green)

    def paint(ctx):
        rng = ctx.rng
        h, w = ctx.h, ctx.w
        n = _fbm(rng, h, w, 5, 3)
        img = _mix(np.broadcast_to(copper, (h, w, 3)), green, np.clip((n - 0.38) * 3.0, 0, 1))
        img += _streaks(ctx, 1.2, 0.06)[..., None]
        img = _mix(img, np.array([0.95, 0.75, 0.6]), _spec_band(ctx, 0.3, 0.15, 0.25))
        img = _bevel(img, ctx)
        return img, np.zeros((h, w))
    return paint


def trimmed(inner_paint, trim_paint, border=1):
    """Plate with an inlaid border of another material (gold filigree...)."""
    def paint(ctx):
        a, ga = inner_paint(ctx)
        b, gb = trim_paint(ctx)
        h, w = ctx.h, ctx.w
        m = np.zeros((h, w))
        if h > 2 * border + 1 and w > 2 * border + 1:
            m[:border, :] = 1
            m[-border:, :] = 1
            m[:, :border] = 1
            m[:, -border:] = 1
            # a little scroll-work: dotted mid line on big side faces
            if ctx.is_side and h >= 7 and w >= 10:
                mid = h // 2
                m[mid, 2:-2:3] = 1
        img = _mix(a, b, m)
        glow = ga * (1 - m) + gb * m
        return img, glow
    return paint


def glow(core, edge=None, facets=True, sparkle=True, lines=None):
    """Emissive crystal / energy material.  Whole face glows."""
    core = _c(core)
    edge = _c(edge) if edge is not None else core * 0.55

    def paint(ctx):
        rng = ctx.rng
        h, w = ctx.h, ctx.w
        yy, xx = np.mgrid[0:h, 0:w]
        cy, cx = (h - 1) / 2.0, (w - 1) / 2.0
        r = np.sqrt(((yy - cy) / max(1, h / 2)) ** 2 + ((xx - cx) / max(1, w / 2)) ** 2)
        t = np.clip(r / 1.3, 0, 1)
        img = _mix(np.broadcast_to(np.minimum(core * 1.25 + 0.15, 1), (h, w, 3)), edge, t)
        if facets and h >= 3 and w >= 3:
            diag = ((xx / max(1, w) - yy / max(1, h)) > 0).astype(float)
            img = img * (0.9 + 0.12 * diag[..., None])
        img += (_fbm(rng, h, w, 3) - 0.5)[..., None] * 0.12
        if lines is not None:
            lc = _c(lines)
            zig = np.abs(((xx + 2 * np.sin(yy * 0.9)) % 5) - 2.5) < 0.5
            img = _mix(img, lc, zig.astype(float) * 0.85)
        if sparkle:
            s = rng.random((h, w)) > 0.92
            img[s] = np.minimum(img[s] + 0.35, 1)
        return img, np.ones((h, w))
    return paint


def runes(metal_paint, rune_rgb, density=0.5):
    """Metal engraved with glowing glyphs (procedural little sigils)."""
    rune_rgb = _c(rune_rgb)

    def paint(ctx):
        img, g = metal_paint(ctx)
        h, w = ctx.h, ctx.w
        mask = np.zeros((h, w))
        rng = ctx.rng
        if h >= 5 and w >= 5:
            # sigils are 3x3 stroke patterns spaced along the long axis
            step = 5
            if ctx.grain_along_u or w >= h:
                cy = h // 2 - 1
                for x0 in range(1, w - 3, step):
                    if rng.random() < density + 0.35:
                        glyph = rng.random((3, 3)) > 0.45
                        glyph[1, 1] = True
                        mask[cy:cy + 3, x0:x0 + 3] = np.maximum(mask[cy:cy + 3, x0:x0 + 3], glyph)
            else:
                cx = w // 2 - 1
                for y0 in range(1, h - 3, step):
                    if rng.random() < density + 0.35:
                        glyph = rng.random((3, 3)) > 0.45
                        glyph[1, 1] = True
                        mask[y0:y0 + 3, cx:cx + 3] = np.maximum(mask[y0:y0 + 3, cx:cx + 3], glyph)
        elif h >= 2 and w >= 4:
            mask[h // 2, 1:-1:2] = 1
        img = _mix(img, np.minimum(rune_rgb * 1.2 + 0.1, 1), mask)
        return img, np.maximum(g, mask)
    return paint


def coil(metal_paint, glow_rgb, period=3):
    """Alternating metal windings and glowing gaps (tesla / frost coils)."""
    glow_rgb = _c(glow_rgb)

    def paint(ctx):
        img, g = metal_paint(ctx)
        h, w = ctx.h, ctx.w
        yy, xx = np.mgrid[0:h, 0:w]
        if ctx.grain_along_u:
            m = (xx % period == 0).astype(float)
        else:
            m = (yy % period == 0).astype(float)
        img = _mix(img, glow_rgb, m)
        return img, np.maximum(g, m)
    return paint


def skull_face(bone_paint, eye_rgb):
    """Bone with glowing eye sockets on the north (front) face."""
    eye_rgb = _c(eye_rgb)

    def paint(ctx):
        img, g = bone_paint(ctx)
        h, w = ctx.h, ctx.w
        if ctx.face in ("north", "south") and h >= 6 and w >= 6:
            ey = int(h * 0.38)
            ew = max(1, w // 4)
            eh = max(1, h // 5)
            for ex in (int(w * 0.18), w - int(w * 0.18) - ew):
                img[ey:ey + eh, ex:ex + ew] = eye_rgb
                g[ey:ey + eh, ex:ex + ew] = 1
            # nose + teeth
            nx = w // 2
            img[ey + eh + 1:ey + eh + 2, nx - 1:nx + 1] = img[ey + eh + 1:ey + eh + 2, nx - 1:nx + 1] * 0.35
            ty = int(h * 0.8)
            img[ty, 1:-1:2] = img[ty, 1:-1:2] * 0.4
        return img, g
    return paint


def flat(rgb, glow_on=False):
    rgb = _c(rgb)

    def paint(ctx):
        img = np.empty((ctx.h, ctx.w, 3))
        img[:] = rgb
        return img, np.ones((ctx.h, ctx.w)) if glow_on else np.zeros((ctx.h, ctx.w))
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
        vw, vh, voff = visible
        return {
            "format_version": "1.16.0",
            "minecraft:geometry": [{
                "description": {
                    "identifier": identifier,
                    "texture_width": W,
                    "texture_height": H,
                    "visible_bounds_width": vw,
                    "visible_bounds_height": vh,
                    "visible_bounds_offset": list(voff),
                },
                "bones": bones,
            }],
        }

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
                n = np.cross(q[1] - q[0], q[3] - q[0])
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
