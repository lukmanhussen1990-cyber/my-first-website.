"""Procedural 3D weapon models: texture atlas + material painters + geo.json builder.

Coordinates are Bedrock "file space" (see tools/README). Every weapon is modelled
upright in the *canonical frame*:
    +Y = towards the tip, the grip centre sits on the root pivot (0, 24, 0),
    -Z = the front edge, X = the broad flat sides of a blade.
The hold transform (first/third person) and the animations are computed separately.
"""
import math
from collections import namedtuple

from .pngkit import Canvas, mix, shade, ramp, rng_for, hex_rgb

T = 2  # texels per model unit


# ---------------------------------------------------------------- noise helpers
def _hash(ix, iy, seed):
    n = (ix * 374761393 + iy * 668265263 + seed * 2147483647) & 0xFFFFFFFF
    n = (n ^ (n >> 13)) * 1274126177 & 0xFFFFFFFF
    return ((n ^ (n >> 16)) & 0xFFFFFF) / float(0xFFFFFF)


def vnoise(x, y, seed=0):
    ix, iy = math.floor(x), math.floor(y)
    fx, fy = x - ix, y - iy
    fx = fx * fx * (3 - 2 * fx)
    fy = fy * fy * (3 - 2 * fy)
    a, b = _hash(ix, iy, seed), _hash(ix + 1, iy, seed)
    c, d = _hash(ix, iy + 1, seed), _hash(ix + 1, iy + 1, seed)
    return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy


# ---------------------------------------------------------------- atlas
Mat = namedtuple('Mat', 'key paint')


class Atlas:
    def __init__(self, w=256, h=256):
        self.cv = Canvas(w, h)
        self.cx = 0
        self.cy = 0
        self.rowh = 0
        self.cache = {}
        self.max_y = 0

    def alloc(self, w, h):
        if self.cx + w + 1 > self.cv.w:
            self.cx = 0
            self.cy += self.rowh + 1
            self.rowh = 0
        if self.cy + h + 1 > self.cv.h or w > self.cv.w:
            raise RuntimeError('atlas full (%dx%d) while placing %dx%d' % (self.cv.w, self.cv.h, w, h))
        x, y = self.cx, self.cy
        self.cx += w + 1
        self.rowh = max(self.rowh, h)
        self.max_y = max(self.max_y, y + h)
        return x, y

    def region(self, mat, w, h):
        key = (mat.key, w, h)
        if key not in self.cache:
            x, y = self.alloc(w, h)
            mat.paint(self.cv, x, y, w, h)
            self.cache[key] = (x, y, w, h)
        return self.cache[key]

    def cropped(self):
        """Crop to used rows, rounded up to a power of two (width is kept)."""
        h = 1
        while h < self.max_y + 1:
            h *= 2
        out = Canvas(self.cv.w, h)
        for y in range(min(h, self.cv.h)):
            out.px[y * out.w:(y + 1) * out.w] = self.cv.px[y * self.cv.w:(y + 1) * self.cv.w]
        return out


# ---------------------------------------------------------------- palettes
def P(*hexes):
    return [hex_rgb(h) for h in hexes]


STEEL = P('#3b4252', '#5c667a', '#8d99ae', '#c5cfdf', '#f1f6ff')
DARKSTEEL = P('#15121d', '#262033', '#3a3150', '#574a78', '#7d6ba3')
GOLD = P('#5c3d0c', '#9c6f1c', '#d4a02e', '#f3cf5e', '#fff1a6')
LEATHER = P('#25150c', '#3b2314', '#583520', '#7a4c2d', '#946238')
WOOD = P('#2a1b10', '#44301d', '#5f4529', '#7d5c37', '#9a7646')
EBONY = P('#0e0b0a', '#1b1513', '#2b221e', '#3e312a', '#54443a')
FIRE = P('#6e0d0a', '#c9291a', '#ff7a1c', '#ffc23a', '#fff4b0')
EMBER = P('#2a0a06', '#6e1a0c', '#b8360f', '#ff7a1c', '#ffd56a')
ICE = P('#1f4f9c', '#3a86d1', '#6fc4f2', '#b6ecff', '#f4fdff')
FROST = P('#3d6a96', '#6ea3c9', '#a9d6ee', '#dff3fb', '#ffffff')
STORM = P('#2a3d8f', '#4f78e0', '#8fb8ff', '#d6e8ff', '#ffffff')
ARCANE = P('#2a1260', '#5a2bc0', '#9b5cff', '#d3a8ff', '#fbe8ff')
SHADOW = P('#09070f', '#17102a', '#2b1d4d', '#4a2f80', '#8a56d6')
VIOLET_GLOW = P('#4b1d8f', '#8a3fe0', '#c07cff', '#e8c4ff', '#ffffff')
STONE = P('#33312f', '#4b4945', '#65625c', '#827e76', '#a29e94')
AMBER = P('#7a3d00', '#c46a0a', '#ffa21f', '#ffd36b', '#fff2c0')
SOUL = P('#0c5a38', '#18a35f', '#4ff09a', '#aaffd0', '#f0fff6')
BONE = P('#6b6048', '#a79b7c', '#d6ccb0', '#efe8d2', '#fffdf2')
CRIMSON = P('#3a0610', '#7a0f22', '#c11d3a', '#ec4a63', '#ffb0bd')
NAVY = P('#0c1426', '#16264a', '#223f72', '#33599a', '#4f7cc4')
SILVER = P('#4a5160', '#7b8496', '#aeb7c8', '#dbe2ee', '#ffffff')
VIOLET = P('#1a0a33', '#3a1a6e', '#6a34c4', '#9a62f0', '#d2b0ff')


# ---------------------------------------------------------------- material painters
def _px(cv, x, y, c):
    cv.set(x, y, c)


def flat(color):
    def paint(cv, x, y, w, h):
        cv.rect(x, y, w, h, color)
    return Mat(('flat', color), paint)


def slab(pal, bevel=1, noise=0.05, vgrad=0.0, seed=0):
    """Beveled metal-ish slab: light top/left edge, dark bottom/right edge."""
    def paint(cv, x, y, w, h):
        rg = rng_for('slab', seed, pal[2], w, h)
        for j in range(h):
            for i in range(w):
                t = j / max(1, h - 1)
                base = pal[2]
                if vgrad:
                    base = mix(pal[2], pal[3] if vgrad > 0 else pal[1], abs(vgrad) * (1 - t))
                if j < bevel or i < bevel:
                    c = pal[4] if (i + j) % 7 else pal[3]
                elif j >= h - bevel or i >= w - bevel:
                    c = pal[1]
                else:
                    f = 1 + (rg.random() - 0.5) * 2 * noise
                    c = shade(base, f)
                cv.set(x + i, y + j, c)
    return Mat(('slab', tuple(pal[2]), bevel, noise, vgrad, seed), paint)


def blade_face(pal, fuller=True, tip=False, edge_pal=None, seed=0, taper=0.0, heat=None, heat_amount=0.8, heat_reach=0.6):
    """Broad blade face; long axis is vertical (top of region = tip side).

    heat: optional palette; the tip end is tinted towards it (heated steel / frozen / etc).
    """
    edge_pal = edge_pal or pal

    def paint(cv, x, y, w, h):
        rg = rng_for('blade', seed, pal[2], w, h)
        cx = (w - 1) / 2.0
        for j in range(h):
            t = j / max(1, h - 1)  # 0 at tip side, 1 at guard side
            for i in range(w):
                d = abs(i - cx) / max(0.5, cx)  # 0 centre .. 1 edge
                base = ramp(pal, 0.5 + 0.18 * (1 - t) - 0.14 * d)
                if d > 0.78:
                    base = ramp(edge_pal, 0.88 - 0.1 * t)  # bevelled cutting edge
                elif d > 0.58:
                    base = ramp(pal, 0.68 - 0.06 * t)
                if fuller and d < 0.2:
                    base = ramp(pal, 0.2 + 0.06 * rg.random())  # fuller groove
                elif fuller and d < 0.36:
                    base = ramp(pal, 0.82)  # fuller highlight rim
                base = shade(base, 1 + (rg.random() - 0.5) * 0.06)
                if heat is not None and t < heat_reach:
                    k = (1 - t / heat_reach) ** 1.4 * heat_amount
                    hc = ramp(heat, 0.45 + 0.35 * (1 - t / heat_reach) + (rg.random() - 0.5) * 0.1)
                    base = mix(base, hc, k)
                cv.set(x + i, y + j, base)
    return Mat(('blade', tuple(pal[2]), fuller, tip, tuple(edge_pal[2]), seed, tuple(heat[2]) if heat else None, heat_amount, heat_reach), paint)


def edge_strip(pal, seed=0):
    def paint(cv, x, y, w, h):
        rg = rng_for('edge', seed, pal[2], w, h)
        for j in range(h):
            for i in range(w):
                c = ramp(pal, 0.82 + (rg.random() - 0.5) * 0.12 - 0.2 * (j / max(1, h - 1)))
                cv.set(x + i, y + j, c)
    return Mat(('edge', tuple(pal[2]), seed), paint)


def leather_wrap(pal, spacing=3, seed=0):
    def paint(cv, x, y, w, h):
        rg = rng_for('leather', seed, pal[2], w, h)
        for j in range(h):
            for i in range(w):
                stripe = ((i + j) % spacing) == 0
                c = ramp(pal, 0.28 if stripe else 0.55 + (rg.random() - 0.5) * 0.12)
                cv.set(x + i, y + j, c)
    return Mat(('wrap', tuple(pal[2]), spacing, seed), paint)


def wood_grain(pal, seed=0, horizontal=False):
    def paint(cv, x, y, w, h):
        for j in range(h):
            for i in range(w):
                u, v = (j, i) if horizontal else (i, j)
                n = vnoise(u * 0.9, v * 0.12, seed) * 0.6 + vnoise(u * 2.3, v * 0.3, seed + 7) * 0.4
                c = ramp(pal, 0.25 + 0.6 * n)
                cv.set(x + i, y + j, c)
    return Mat(('wood', tuple(pal[2]), seed, horizontal), paint)


def stone_block(pal, seed=0, cracks=False):
    def paint(cv, x, y, w, h):
        for j in range(h):
            for i in range(w):
                n = vnoise(i * 0.55, j * 0.55, seed) * 0.6 + vnoise(i * 1.7, j * 1.7, seed + 3) * 0.4
                c = ramp(pal, 0.18 + 0.7 * n)
                if i == 0 or j == 0:
                    c = shade(c, 1.18)
                if i == w - 1 or j == h - 1:
                    c = shade(c, 0.78)
                cv.set(x + i, y + j, c)
        if cracks:
            rg = rng_for('crack', seed, w, h)
            cx, cy = rg.randrange(w), 0
            for _ in range(h):
                cv.set(x + cx, y + cy, pal[0])
                cy += 1
                cx += rg.choice([-1, 0, 0, 1])
                cx = max(0, min(w - 1, cx))
                if cy >= h:
                    break
    return Mat(('stone', tuple(pal[2]), seed, cracks), paint)


def gem(pal, seed=0):
    """Faceted gem: radial ramp + diagonal highlight (use on glow bones for a lit look)."""
    def paint(cv, x, y, w, h):
        cx, cy = (w - 1) / 2.0, (h - 1) / 2.0
        for j in range(h):
            for i in range(w):
                d = math.hypot((i - cx) / max(0.5, cx + 0.5), (j - cy) / max(0.5, cy + 0.5))
                facet = ((i - j) // 2 + (i + j) // 3) % 2
                t = 0.95 - 0.55 * min(1.0, d) - 0.08 * facet
                if i + j < max(w, h) * 0.55 and d < 0.7:
                    t = min(1.0, t + 0.12)
                cv.set(x + i, y + j, ramp(pal, t))
    return Mat(('gem', tuple(pal[2]), seed), paint)


def crystal(pal, seed=0):
    """Ice / crystal: slanted facet bands with bright speckles."""
    def paint(cv, x, y, w, h):
        rg = rng_for('crystal', seed, pal[2], w, h)
        for j in range(h):
            for i in range(w):
                band = (i * 2 + j) // 3
                n = vnoise(band * 1.3, 0.0, seed)
                t = 0.35 + 0.5 * n + (0.08 if (i + j) % 11 == 0 else 0)
                if rg.random() < 0.025:
                    t = 1.0
                cv.set(x + i, y + j, ramp(pal, t))
    return Mat(('crystal', tuple(pal[2]), seed), paint)


def glow_solid(pal, t=0.8, pulse=0.0):
    """Flat emissive colour with slight inner gradient."""
    def paint(cv, x, y, w, h):
        for j in range(h):
            for i in range(w):
                d = math.hypot((i - (w - 1) / 2) / max(1, w / 2), (j - (h - 1) / 2) / max(1, h / 2))
                cv.set(x + i, y + j, ramp(pal, max(0, min(1, t - 0.25 * d + pulse))))
    return Mat(('glowsolid', tuple(pal[2]), t, pulse), paint)


def flame_cutout(pal, seed=0, tongues=3, core=True):
    """Flame silhouette with transparent background (alpha-tested). Tip at the top."""
    def paint(cv, x, y, w, h):
        rg = rng_for('flame', seed, w, h, tongues)
        hts = []
        for i in range(w):
            u = i / max(1, w - 1)
            envelope = math.sin(math.pi * u) ** 0.8
            wob = 0.55 + 0.45 * math.sin(u * math.pi * tongues * 2 + seed) * math.cos(u * 7 + seed * 1.7)
            hts.append(max(0.0, envelope * (0.35 + 0.65 * abs(wob))))
        for i in range(w):
            hcol = hts[i] * h
            for j in range(h):
                from_bottom = (h - 1 - j)
                if from_bottom <= hcol and hcol > 0.7:
                    t = from_bottom / max(1.0, hcol)  # 0 base .. 1 tip
                    inner = 1 - abs(i - (w - 1) / 2) / max(1, w / 2)
                    heat = 0.95 - 0.78 * t if core else 0.8 - 0.6 * t
                    heat = heat * (0.55 + 0.45 * inner) + (rg.random() - 0.5) * 0.08
                    cv.set(x + i, y + j, ramp(pal, max(0.0, min(1.0, heat))))
    return Mat(('flame', tuple(pal[2]), seed, tongues, core), paint)


def spark_cutout(pal, seed=0, rays=4):
    """Soft star / glint shape on a transparent background."""
    def paint(cv, x, y, w, h):
        cx, cy = (w - 1) / 2.0, (h - 1) / 2.0
        for j in range(h):
            for i in range(w):
                dx, dy = abs(i - cx) / max(0.5, cx + 0.5), abs(j - cy) / max(0.5, cy + 0.5)
                d = math.hypot(dx, dy)
                cross = min(dx, dy)
                inside = d < 0.36 or (cross < 0.16 and d < 1.0)
                if rays >= 8 and not inside:
                    inside = abs(dx - dy) < 0.12 and d < 0.8
                if inside:
                    cv.set(x + i, y + j, ramp(pal, 1.0 - 0.7 * d))
    return Mat(('spark', tuple(pal[2]), seed, rays), paint)


def glyph_cutout(pal, seed=0, density=0.5, t=0.85):
    """Angular rune strokes on a transparent background."""
    def paint(cv, x, y, w, h):
        rg = rng_for('glyph', seed, w, h)
        gx, gy = max(3, w // 3), max(3, h // 3)
        pts = [(rg.randrange(0, w), rg.randrange(0, h)) for _ in range(max(3, int(density * (gx + gy))))]
        px0, py0 = pts[0]
        for (qx, qy) in pts[1:]:
            if rg.random() < 0.5:
                cv.line(x + px0, y + py0, x + qx, y + py0, ramp(pal, t))
                cv.line(x + qx, y + py0, x + qx, y + qy, ramp(pal, t))
            else:
                cv.line(x + px0, y + py0, x + qx, y + qy, ramp(pal, t))
            px0, py0 = qx, qy
    return Mat(('glyph', tuple(pal[2]), seed, density, t), paint)


def ring_cutout(pal, thickness=1.0, t=0.8):
    def paint(cv, x, y, w, h):
        cx, cy = (w - 1) / 2.0, (h - 1) / 2.0
        r = min(w, h) / 2.0 - 0.5
        for j in range(h):
            for i in range(w):
                d = math.hypot(i - cx, j - cy)
                if abs(d - (r - thickness / 2)) <= thickness / 2 + 0.3:
                    cv.set(x + i, y + j, ramp(pal, t))
    return Mat(('ring', tuple(pal[2]), thickness, t), paint)


# ---------------------------------------------------------------- model builder
class Bone:
    def __init__(self, name, parent, pivot, rotation, binding):
        self.name = name
        self.parent = parent
        self.pivot = list(pivot)
        self.rotation = list(rotation) if rotation else None
        self.binding = binding
        self.cubes = []


class Model:
    def __init__(self, ident, atlas_w=256, atlas_h=256):
        self.id = ident
        self.atlas = Atlas(atlas_w, atlas_h)
        self.bones = {}
        self.order = []

    def bone(self, name, parent=None, pivot=(0, 24, 0), rotation=None, binding=None):
        b = Bone(name, parent, pivot, rotation, binding)
        self.bones[name] = b
        self.order.append(name)
        return b

    def box(self, bone, origin, size, x=None, z=None, y=None, inflate=0.0):
        """Add a cube. x/z/y are Mat or (Mat, Mat) pairs for [east,west] / [north,south] / [up,down]."""
        sx, sy, sz = size

        def pair(m):
            return m if isinstance(m, tuple) and len(m) == 2 and isinstance(m[0], Mat) else (m, m)

        def tex(n):
            return max(1, int(round(n * T)))

        faces = {}
        if x is not None:
            e, w = pair(x)
            faces['east'] = self.atlas.region(e, tex(sz), tex(sy))
            faces['west'] = self.atlas.region(w, tex(sz), tex(sy))
        if z is not None:
            n, s = pair(z)
            faces['north'] = self.atlas.region(n, tex(sx), tex(sy))
            faces['south'] = self.atlas.region(s, tex(sx), tex(sy))
        if y is not None:
            u, d = pair(y)
            faces['up'] = self.atlas.region(u, tex(sx), tex(sz))
            faces['down'] = self.atlas.region(d, tex(sx), tex(sz))
        cube = {'origin': [round(v, 4) for v in origin], 'size': [round(v, 4) for v in size], 'uv': {}}
        if inflate:
            cube['inflate'] = inflate
        for name, (u0, v0, w, h) in faces.items():
            cube['uv'][name] = {'uv': [u0, v0], 'uv_size': [w, h]}
        self.bones[bone].cubes.append(cube)
        return cube

    def geo_json(self, bounds=(6, 6, (0, 1.5, 0))):
        tex = self.atlas.cropped()
        self._tex = tex
        bones = []
        for name in self.order:
            b = self.bones[name]
            d = {'name': b.name}
            if b.binding:
                d['binding'] = b.binding
            if b.parent:
                d['parent'] = b.parent
            d['pivot'] = [round(v, 4) for v in b.pivot]
            if b.rotation:
                d['rotation'] = [round(v, 4) for v in b.rotation]
            if b.cubes:
                d['cubes'] = b.cubes
            bones.append(d)
        return {
            'format_version': '1.16.0',
            'minecraft:geometry': [{
                'description': {
                    'identifier': 'geometry.mw_%s' % self.id,
                    'texture_width': tex.w,
                    'texture_height': tex.h,
                    'visible_bounds_width': bounds[0],
                    'visible_bounds_height': bounds[1],
                    'visible_bounds_offset': list(bounds[2]),
                },
                'bones': bones,
            }],
        }

    def texture(self):
        if not hasattr(self, '_tex'):
            self.geo_json()
        return self._tex


def vein_cutout(pal, seed=0, branch=0.22, wander=True):
    """Glowing magma crack running top->bottom on a transparent background."""
    def paint(cv, x, y, w, h):
        rg = rng_for('vein', seed, w, h)
        cx = w // 2
        for j in range(h):
            if wander and w > 3:
                cx += rg.choice([-1, 0, 0, 0, 1])
                cx = max(1, min(w - 2, cx))
            cv.set(x + cx, y + j, ramp(pal, 0.97))
            if w >= 5:
                cv.set(x + cx - 1, y + j, ramp(pal, 0.62))
                cv.set(x + cx + 1, y + j, ramp(pal, 0.62))
            if w >= 7 and rg.random() < branch:
                d = rg.choice([-1, 1])
                for k in range(2, 2 + rg.randrange(1, 3)):
                    cv.set(x + cx + d * k, y + j, ramp(pal, 0.8 - 0.1 * k))
    return Mat(('vein', tuple(pal[2]), seed, branch, wander), paint)


def strip_glow(pal, fade=True):
    """Vertical emissive strip (edge glow): bright at the top, ember at the bottom."""
    def paint(cv, x, y, w, h):
        for j in range(h):
            t = 1.0 - (j / max(1, h - 1)) * (0.55 if fade else 0.0)
            for i in range(w):
                cv.set(x + i, y + j, ramp(pal, 0.35 + 0.65 * t))
    return Mat(('strip', tuple(pal[2]), fade), paint)
