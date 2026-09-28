"""Procedurally paint every texture of the Limitless Addon.

Item icons are painted at 8x resolution with anti-aliased shapes, reduced to
32x32 and given a 1px dark outline so they read clearly in the inventory on
small phone screens. Particle textures are white/greyscale so the particle
JSON can tint them (additive blending = glowing cursed energy).

Run:  python3 tools/art.py
"""
import math
import os
import random

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RP = os.path.join(ROOT, "packs", "Gojo_Limitless_RP")
BP = os.path.join(ROOT, "packs", "Gojo_Limitless_BP")
ICON_DIR = os.path.join(RP, "textures", "items", "gojo")
PARTICLE_DIR = os.path.join(RP, "textures", "particle", "gojo")
MODEL_DIR = os.path.join(RP, "textures", "models", "gojo")

S = 8  # supersampling factor
N = 32  # icon size


# ----------------------------------------------------------------------------
# helpers
# ----------------------------------------------------------------------------

def canvas(size=N * S):
    return Image.new("RGBA", (size, size), (0, 0, 0, 0))


def radial(size, cx, cy, radius, stops):
    """RGBA radial gradient as numpy array. stops: [(t, (r,g,b,a)), ...] t in 0..1"""
    y, x = np.mgrid[0:size, 0:size].astype(np.float32)
    d = np.sqrt((x - cx) ** 2 + (y - cy) ** 2) / max(radius, 1e-6)
    d = np.clip(d, 0, 1)
    out = np.zeros((size, size, 4), np.float32)
    ts = [s[0] for s in stops]
    for ch in range(4):
        vals = [s[1][ch] for s in stops]
        out[..., ch] = np.interp(d, ts, vals)
    return out


def over(dst, src):
    """Alpha-composite float RGBA arrays (0..255)."""
    sa = src[..., 3:4] / 255.0
    da = dst[..., 3:4] / 255.0
    oa = sa + da * (1 - sa)
    rgb = np.where(oa > 0, (src[..., :3] * sa + dst[..., :3] * da * (1 - sa)) / np.maximum(oa, 1e-6), 0)
    return np.concatenate([rgb, oa * 255.0], axis=-1)


def add_glow(dst, src):
    """Additive light: brightens colour, keeps max alpha."""
    out = dst.copy()
    sa = src[..., 3:4] / 255.0
    out[..., :3] = np.clip(dst[..., :3] + src[..., :3] * sa, 0, 255)
    out[..., 3] = np.maximum(dst[..., 3], src[..., 3])
    return out


def to_img(arr):
    return Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8), "RGBA")


def to_arr(img):
    return np.asarray(img.convert("RGBA")).astype(np.float32)


class Pen:
    """ImageDraw wrapper that paints the mask at full strength by default."""

    def __init__(self, draw):
        self._d = draw

    def _area(self, name, xy, **kw):
        if "outline" in kw and "fill" not in kw:
            kw["fill"] = None
        else:
            kw.setdefault("fill", 255)
        return getattr(self._d, name)(xy, **kw)

    def polygon(self, xy, **kw):
        return self._area("polygon", xy, **kw)

    def ellipse(self, xy, **kw):
        return self._area("ellipse", xy, **kw)

    def rectangle(self, xy, **kw):
        return self._area("rectangle", xy, **kw)

    def rounded_rectangle(self, xy, radius=0, **kw):
        if "outline" in kw and "fill" not in kw:
            kw["fill"] = None
        else:
            kw.setdefault("fill", 255)
        return self._d.rounded_rectangle(xy, radius, **kw)

    def line(self, xy, **kw):
        kw.setdefault("fill", 255)
        return self._d.line(xy, **kw)

    def arc(self, xy, start, end, **kw):
        kw.setdefault("fill", 255)
        return self._d.arc(xy, start, end, **kw)


def shape_layer(size, draw_fn, fill):
    """Anti-aliased filled shape (drawn by draw_fn on a mask) as RGBA array."""
    mask = Image.new("L", (size, size), 0)
    draw_fn(Pen(ImageDraw.Draw(mask)))
    m = np.asarray(mask).astype(np.float32) / 255.0
    arr = np.zeros((size, size, 4), np.float32)
    arr[..., 0] = fill[0]
    arr[..., 1] = fill[1]
    arr[..., 2] = fill[2]
    arr[..., 3] = m * (fill[3] if len(fill) > 3 else 255)
    return arr


def finish_icon(big, outline=(12, 8, 24, 255), outline_alpha=150):
    """Downsample to 32x32 and add a 1px outline for readability."""
    img = to_img(big).resize((N, N), Image.LANCZOS)
    a = np.asarray(img).astype(np.int32)
    alpha = a[..., 3]
    solid = alpha > 60
    ring = np.zeros_like(solid)
    for dy, dx in ((-1, 0), (1, 0), (0, -1), (0, 1)):
        ring |= np.roll(np.roll(solid, dy, 0), dx, 1)
    ring &= ~solid
    out = a.copy()
    out[ring] = [outline[0], outline[1], outline[2], outline_alpha]
    # Snap near-transparent pixels to fully transparent (clean pixel edges).
    out[(alpha <= 60) & ~ring, 3] = 0
    return Image.fromarray(out.astype(np.uint8), "RGBA")


def save(img, folder, name):
    os.makedirs(folder, exist_ok=True)
    img.save(os.path.join(folder, name + ".png"))


def lemniscate(t, a):
    # Bernoulli lemniscate (infinity symbol) parametric
    s = math.sin(t)
    c = math.cos(t)
    d = 1 + s * s
    return a * c / d, a * s * c / d


def star_points(cx, cy, r_out, r_in, n, rot=0.0):
    pts = []
    for i in range(n * 2):
        r = r_out if i % 2 == 0 else r_in
        ang = rot + math.pi * i / n
        pts.append((cx + r * math.cos(ang), cy + r * math.sin(ang)))
    return pts


def sphere(size, cx, cy, r, dark, mid, light, highlight=True):
    """Shaded glowing orb."""
    base = radial(size, cx, cy, r * 1.0, [
        (0.0, light + (255,)),
        (0.45, mid + (255,)),
        (0.93, dark + (255,)),
        (1.0, dark + (0,)),
    ])
    if highlight:
        hl = radial(size, cx - r * 0.32, cy - r * 0.36, r * 0.42, [
            (0.0, (255, 255, 255, 200)),
            (1.0, (255, 255, 255, 0)),
        ])
        base = over(base, hl)
    return base


def halo(size, cx, cy, r, color, strength=160):
    return radial(size, cx, cy, r, [
        (0.0, color + (strength,)),
        (0.55, color + (int(strength * 0.45),)),
        (1.0, color + (0,)),
    ])


# ----------------------------------------------------------------------------
# item icons
# ----------------------------------------------------------------------------

def icon_transformation():
    Z = N * S
    arr = halo(Z, Z / 2, Z / 2, Z * 0.52, (120, 200, 255), 170)
    c = Z / 2
    # face
    face = shape_layer(Z, lambda d: d.ellipse([c - 68, c - 40, c + 68, c + 104]), (246, 208, 178, 255))
    shade = radial(Z, c + 20, c + 60, 110, [(0, (0, 0, 0, 0)), (0.7, (0, 0, 0, 0)), (1, (120, 70, 50, 90))])
    face_shaded = over(face, shade * (face[..., 3:4] / 255.0))
    arr = over(arr, face_shaded)
    # spiky white hair (upwards, blindfold style)
    def hair(d):
        pts = [(c - 84, c - 6), (c - 100, c - 64), (c - 62, c - 50), (c - 72, c - 112), (c - 30, c - 76),
               (c - 20, c - 124), (c + 8, c - 80), (c + 34, c - 122), (c + 40, c - 72), (c + 86, c - 104),
               (c + 66, c - 44), (c + 104, c - 58), (c + 84, c - 6)]
        d.polygon(pts)
    hair_l = shape_layer(Z, hair, (238, 243, 252, 255))
    hair_shade = radial(Z, c - 30, c - 110, 170, [(0, (255, 255, 255, 0)), (1, (150, 170, 205, 170))])
    hair_l = over(hair_l, hair_shade * (hair_l[..., 3:4] / 255.0))
    arr = over(arr, hair_l)
    # blindfold band
    band = shape_layer(Z, lambda d: d.rounded_rectangle([c - 90, c - 16, c + 90, c + 30], 10), (22, 22, 30, 255))
    arr = over(arr, band)
    stripe = shape_layer(Z, lambda d: d.rectangle([c - 86, c - 8, c + 86, c - 2]), (70, 70, 88, 255))
    arr = over(arr, stripe)
    # mouth (confident smile)
    mouth = shape_layer(Z, lambda d: d.arc([c - 26, c + 36, c + 30, c + 76], 20, 150, width=8), (150, 70, 70, 255))
    arr = over(arr, mouth)
    return finish_icon(arr)


def icon_infinity():
    Z = N * S
    c = Z / 2
    arr = radial(Z, c, c, Z * 0.48, [(0, (40, 90, 170, 255)), (0.8, (10, 22, 60, 255)), (0.93, (6, 12, 38, 255)), (1, (6, 12, 38, 0))])
    ring = shape_layer(Z, lambda d: d.ellipse([c - 112, c - 112, c + 112, c + 112], outline=255, width=7), (140, 230, 255, 255))
    arr = over(arr, ring)
    pts = [lemniscate(t, 100) for t in np.linspace(0, 2 * math.pi, 400)]
    glow = shape_layer(Z, lambda d: d.line([(c + x, c + y) for x, y in pts] + [(c + pts[0][0], c + pts[0][1])], width=34, joint="curve"), (80, 200, 255, 150))
    glow = to_arr(to_img(glow).filter(ImageFilter.GaussianBlur(10)))
    arr = add_glow(arr, glow)
    line = shape_layer(Z, lambda d: d.line([(c + x, c + y) for x, y in pts] + [(c + pts[0][0], c + pts[0][1])], width=20, joint="curve"), (170, 240, 255, 255))
    arr = over(arr, line)
    core = shape_layer(Z, lambda d: d.line([(c + x, c + y) for x, y in pts] + [(c + pts[0][0], c + pts[0][1])], width=8, joint="curve"), (255, 255, 255, 255))
    arr = over(arr, core)
    return finish_icon(arr)


def vortex_arms(Z, c, color, width, turns=1.6, arms=3, r_max=112, alpha=255):
    layer = np.zeros((Z, Z, 4), np.float32)
    for a in range(arms):
        pts = []
        for t in np.linspace(0, 1, 120):
            ang = a * 2 * math.pi / arms + t * turns * 2 * math.pi
            r = 14 + t * r_max
            pts.append((c + r * math.cos(ang), c + r * math.sin(ang)))
        seg = shape_layer(Z, lambda d, pts=pts: d.line(pts, width=width, joint="curve"), color + (alpha,))
        layer = over(layer, seg)
    return layer


def icon_blue():
    Z = N * S
    c = Z / 2
    arr = halo(Z, c, c, Z * 0.5, (40, 110, 255), 150)
    arms = vortex_arms(Z, c, (90, 170, 255), 16)
    arms = to_arr(to_img(arms).filter(ImageFilter.GaussianBlur(3)))
    arr = add_glow(arr, arms)
    arr = over(arr, sphere(Z, c, c, 64, (10, 40, 150), (40, 120, 255), (200, 235, 255)))
    thin = vortex_arms(Z, c, (220, 240, 255), 5, arms=3, r_max=100)
    arr = add_glow(arr, thin)
    return finish_icon(arr)


def icon_red():
    Z = N * S
    c = Z / 2
    arr = halo(Z, c, c, Z * 0.5, (255, 50, 40), 160)
    rays = shape_layer(Z, lambda d: d.polygon(star_points(c, c, 124, 44, 8, 0.2)), (255, 90, 60, 230))
    rays = to_arr(to_img(rays).filter(ImageFilter.GaussianBlur(2)))
    arr = add_glow(arr, rays)
    arr = over(arr, sphere(Z, c, c, 66, (130, 0, 10), (235, 30, 30), (255, 220, 170)))
    core = radial(Z, c + 4, c + 4, 34, [(0, (255, 255, 235, 255)), (0.5, (255, 230, 160, 200)), (1, (255, 160, 90, 0))])
    arr = add_glow(arr, core)
    return finish_icon(arr)


def icon_purple():
    Z = N * S
    c = Z / 2
    arr = halo(Z, c, c, Z * 0.54, (170, 60, 255), 200)
    arr = over(arr, sphere(Z, c, c, 90, (45, 0, 85), (150, 40, 230), (255, 225, 255)))
    # Blue (left) and Red (right) crescents colliding into the purple mass
    blue_arc = shape_layer(Z, lambda d: d.arc([c - 108, c - 108, c + 108, c + 108], 110, 250, width=16), (90, 170, 255, 255))
    red_arc = shape_layer(Z, lambda d: d.arc([c - 108, c - 108, c + 108, c + 108], -70, 70, width=16), (255, 70, 80, 255))
    arr = add_glow(arr, to_arr(to_img(blue_arc).filter(ImageFilter.GaussianBlur(4))))
    arr = add_glow(arr, to_arr(to_img(red_arc).filter(ImageFilter.GaussianBlur(4))))
    arr = over(arr, blue_arc)
    arr = over(arr, red_arc)
    core = radial(Z, c, c, 46, [(0, (255, 255, 255, 255)), (0.6, (255, 210, 255, 170)), (1, (255, 200, 255, 0))])
    arr = add_glow(arr, core)
    rng = random.Random(7)
    for _ in range(6):
        ang = rng.random() * 2 * math.pi
        r = rng.uniform(40, 80)
        x0, y0 = c + r * math.cos(ang), c + r * math.sin(ang)
        pts = [(x0, y0)]
        for _k in range(3):
            ang += rng.uniform(-0.6, 0.6)
            x0 += 14 * math.cos(ang)
            y0 += 14 * math.sin(ang)
            pts.append((x0, y0))
        bolt = shape_layer(Z, lambda d, pts=pts: d.line(pts, width=5), (255, 235, 255, 255))
        arr = add_glow(arr, bolt)
    return finish_icon(arr)


def icon_void():
    Z = N * S
    c = Z / 2
    arr = radial(Z, c, c, 120, [(0, (26, 10, 54, 255)), (0.7, (8, 4, 22, 255)), (0.94, (4, 2, 10, 255)), (1, (4, 2, 10, 0))])
    rim = shape_layer(Z, lambda d: d.ellipse([c - 116, c - 116, c + 116, c + 116], outline=255, width=8), (190, 110, 255, 255))
    arr = add_glow(arr, to_arr(to_img(rim).filter(ImageFilter.GaussianBlur(2))))
    rng = random.Random(3)
    for _ in range(30):
        ang = rng.random() * 2 * math.pi
        r = 30 + math.sqrt(rng.random()) * 78
        x, y = c + r * math.cos(ang), c + r * math.sin(ang)
        s_ = rng.choice([4, 5, 6, 8])
        st_ = shape_layer(Z, lambda d, x=x, y=y, s_=s_: d.polygon(star_points(x, y, s_ * 1.6, s_ * 0.45, 4, 0.0)), (255, 255, 255, 255))
        arr = add_glow(arr, st_)
    # black hole: glowing accretion ring around an empty centre
    ring = shape_layer(Z, lambda d: d.ellipse([c - 62, c - 26, c + 62, c + 26], outline=255, width=10), (230, 190, 255, 255))
    arr = add_glow(arr, to_arr(to_img(ring).filter(ImageFilter.GaussianBlur(5))))
    arr = over(arr, ring)
    hole = shape_layer(Z, lambda d: d.ellipse([c - 24, c - 24, c + 24, c + 24]), (0, 0, 0, 255))
    arr = over(arr, hole)
    edge = shape_layer(Z, lambda d: d.ellipse([c - 26, c - 26, c + 26, c + 26], outline=255, width=4), (255, 240, 255, 255))
    arr = add_glow(arr, edge)
    return finish_icon(arr, outline=(40, 10, 70, 255))


def icon_six_eyes():
    Z = N * S
    c = Z / 2
    arr = halo(Z, c, c, Z * 0.5, (60, 180, 255), 130)
    sclera = shape_layer(Z, lambda d: d.polygon([(c - 118, c), (c - 60, c - 62), (c, c - 78), (c + 60, c - 62), (c + 118, c),
                                                   (c + 60, c + 62), (c, c + 78), (c - 60, c + 62)]), (236, 246, 255, 255))
    arr = over(arr, sclera)
    iris = radial(Z, c, c, 62, [(0, (230, 255, 255, 255)), (0.35, (70, 220, 255, 255)), (0.75, (20, 110, 230, 255)), (0.95, (10, 40, 120, 255)), (1, (10, 40, 120, 0))])
    arr = over(arr, iris)
    for rr in (48, 32):
        ring = shape_layer(Z, lambda d, rr=rr: d.ellipse([c - rr, c - rr, c + rr, c + rr], outline=255, width=4), (170, 250, 255, 200))
        arr = add_glow(arr, ring)
    pupil = shape_layer(Z, lambda d: d.ellipse([c - 16, c - 16, c + 16, c + 16]), (6, 20, 50, 255))
    arr = over(arr, pupil)
    glint = shape_layer(Z, lambda d: d.ellipse([c - 40, c - 44, c - 16, c - 20]), (255, 255, 255, 255))
    arr = over(arr, glint)
    lid = shape_layer(Z, lambda d: d.line([(c - 118, c), (c - 60, c - 62), (c, c - 78), (c + 60, c - 62), (c + 118, c)], width=10, joint="curve"), (20, 30, 60, 255))
    arr = over(arr, lid)
    return finish_icon(arr)


def icon_teleport():
    Z = N * S
    c = Z / 2
    arr = halo(Z, c, c, Z * 0.5, (60, 170, 255), 110)
    for i, (off, alpha) in enumerate(((-64, 70), (-26, 140), (16, 255))):
        def chev(d, off=off):
            x0 = c + off
            d.polygon([(x0 - 40, c - 70), (x0 + 30, c), (x0 - 40, c + 70), (x0 - 10, c + 70), (x0 + 60, c), (x0 - 10, c - 70)])
        layer = shape_layer(Z, chev, (120 + i * 40, 210 + i * 15, 255, alpha))
        arr = over(arr, layer)
    rng = random.Random(11)
    for _ in range(7):
        x, y = rng.uniform(c - 110, c + 110), rng.uniform(c - 100, c + 100)
        sp = shape_layer(Z, lambda d, x=x, y=y: d.polygon(star_points(x, y, 12, 3, 4, 0)), (230, 250, 255, 255))
        arr = add_glow(arr, sp)
    return finish_icon(arr)


def icon_rct():
    Z = N * S
    c = Z / 2
    arr = halo(Z, c, c, Z * 0.5, (90, 255, 150), 140)

    def heart(d):
        pts = []
        for t in np.linspace(0, 2 * math.pi, 200):
            x = 16 * math.sin(t) ** 3
            y = -(13 * math.cos(t) - 5 * math.cos(2 * t) - 2 * math.cos(3 * t) - math.cos(4 * t))
            pts.append((c + x * 6.4, c + y * 6.4 + 6))
        d.polygon(pts)

    h = shape_layer(Z, heart, (60, 220, 120, 255))
    shade = radial(Z, c - 40, c - 50, 170, [(0, (220, 255, 230, 255)), (0.5, (60, 220, 120, 255)), (1, (10, 110, 60, 255))])
    arr = over(arr, np.concatenate([shade[..., :3], h[..., 3:4]], axis=-1))
    cross = shape_layer(Z, lambda d: (d.rectangle([c - 14, c - 50, c + 14, c + 54]), d.rectangle([c - 50, c - 12, c + 50, c + 16])), (255, 255, 255, 255))
    arr = over(arr, cross)
    return finish_icon(arr, outline=(10, 40, 20, 255))


def icon_black_flash():
    Z = N * S
    c = Z / 2
    arr = halo(Z, c, c, Z * 0.55, (255, 20, 30), 200)
    bolt = [(c + 30, c - 124), (c - 40, c - 10), (c + 2, c - 6), (c - 34, c + 124), (c + 58, c - 24), (c + 12, c - 26), (c + 64, c - 124)]
    red_edge = shape_layer(Z, lambda d: d.polygon(bolt), (255, 40, 40, 255))
    red_edge = to_arr(to_img(red_edge).filter(ImageFilter.MaxFilter(15)).filter(ImageFilter.GaussianBlur(3)))
    arr = add_glow(arr, red_edge)
    black = shape_layer(Z, lambda d: d.polygon(bolt), (8, 4, 8, 255))
    arr = over(arr, black)
    rng = random.Random(5)
    for _ in range(10):
        ang = rng.random() * 2 * math.pi
        r = rng.uniform(70, 118)
        x, y = c + r * math.cos(ang), c + r * math.sin(ang)
        sp = shape_layer(Z, lambda d, x=x, y=y, a=ang: d.line([(x, y), (x + 22 * math.cos(a), y + 22 * math.sin(a))], width=7), (255, 90, 60, 255))
        arr = add_glow(arr, sp)
    return finish_icon(arr, outline=(40, 0, 0, 255))


def icon_blindfold(lifted=False):
    Z = N * S
    c = Z / 2
    arr = np.zeros((Z, Z, 4), np.float32)
    # white hair tuft
    def hair(d):
        base_y = c - (40 if lifted else 10)
        pts = [(c - 104, base_y + 20), (c - 96, base_y - 50), (c - 60, base_y - 30), (c - 56, base_y - 96), (c - 18, base_y - 48),
               (c + 4, base_y - 110), (c + 26, base_y - 50), (c + 64, base_y - 92), (c + 60, base_y - 30), (c + 100, base_y - 46), (c + 104, base_y + 20)]
        d.polygon(pts)
    hair_l = shape_layer(Z, hair, (236, 242, 252, 255))
    shade = radial(Z, c, c - 120, 180, [(0, (255, 255, 255, 0)), (1, (140, 160, 200, 170))])
    arr = over(arr, over(hair_l, shade * (hair_l[..., 3:4] / 255.0)))
    y0 = c - (44 if lifted else 4)
    band = shape_layer(Z, lambda d: d.rounded_rectangle([c - 112, y0, c + 112, y0 + 56], 18), (20, 20, 28, 255))
    arr = over(arr, band)
    stripe = shape_layer(Z, lambda d: d.rectangle([c - 106, y0 + 12, c + 106, y0 + 20]), (74, 74, 92, 255))
    arr = over(arr, stripe)
    knot = shape_layer(Z, lambda d: d.polygon([(c + 90, y0 + 40), (c + 124, y0 + 96), (c + 100, y0 + 104), (c + 78, y0 + 52)]), (26, 26, 34, 255))
    arr = over(arr, knot)
    if lifted:
        for ex in (-50, 50):
            g = halo(Z, c + ex, c + 60, 44, (80, 220, 255), 230)
            arr = add_glow(arr, g)
            eye = shape_layer(Z, lambda d, ex=ex: d.ellipse([c + ex - 20, c + 48, c + ex + 20, c + 72]), (170, 250, 255, 255))
            arr = over(arr, eye)
    return finish_icon(arr, outline=(8, 8, 16, 255), outline_alpha=190)


# ----------------------------------------------------------------------------
# particle textures (greyscale, tinted in particle JSON)
# ----------------------------------------------------------------------------

def tex_glow(size=32):
    return to_img(radial(size, size / 2 - 0.5, size / 2 - 0.5, size / 2, [
        (0, (255, 255, 255, 255)), (0.25, (255, 255, 255, 200)), (0.6, (255, 255, 255, 70)), (1, (255, 255, 255, 0))]))


def tex_core(size=32):
    return to_img(radial(size, size / 2 - 0.5, size / 2 - 0.5, size / 2, [
        (0, (255, 255, 255, 255)), (0.35, (255, 255, 255, 255)), (0.55, (255, 255, 255, 140)), (1, (255, 255, 255, 0))]))


def tex_spark(size=16):
    Z = size * S
    arr = shape_layer(Z, lambda d: d.polygon(star_points(Z / 2, Z / 2, Z * 0.5, Z * 0.09, 4, 0)), (255, 255, 255, 255))
    arr = add_glow(arr, radial(Z, Z / 2, Z / 2, Z * 0.3, [(0, (255, 255, 255, 255)), (1, (255, 255, 255, 0))]))
    return to_img(arr).resize((size, size), Image.LANCZOS)


def tex_star(size=16):
    Z = size * S
    arr = shape_layer(Z, lambda d: d.polygon(star_points(Z / 2, Z / 2, Z * 0.48, Z * 0.06, 4, 0.785)), (255, 255, 255, 200))
    arr = add_glow(arr, radial(Z, Z / 2, Z / 2, Z * 0.18, [(0, (255, 255, 255, 255)), (1, (255, 255, 255, 0))]))
    return to_img(arr).resize((size, size), Image.LANCZOS)


def tex_ring(size=64, width=0.09):
    y, x = np.mgrid[0:size, 0:size].astype(np.float32)
    r = np.sqrt((x - size / 2 + 0.5) ** 2 + (y - size / 2 + 0.5) ** 2) / (size / 2)
    a = np.exp(-((r - 0.82) / width) ** 2) * 255
    a += np.exp(-((r - 0.82) / (width * 3)) ** 2) * 60
    arr = np.zeros((size, size, 4), np.float32)
    arr[..., :3] = 255
    arr[..., 3] = np.clip(a, 0, 255) * (r < 1)
    return to_img(arr)


def tex_ripple(size=32):
    y, x = np.mgrid[0:size, 0:size].astype(np.float32)
    r = np.sqrt((x - size / 2 + 0.5) ** 2 + (y - size / 2 + 0.5) ** 2) / (size / 2)
    a = np.zeros_like(r)
    for rr, w, s in ((0.85, 0.07, 255), (0.6, 0.06, 170), (0.35, 0.06, 100)):
        a += np.exp(-((r - rr) / w) ** 2) * s
    arr = np.zeros((size, size, 4), np.float32)
    arr[..., :3] = 255
    arr[..., 3] = np.clip(a, 0, 255) * (r < 1)
    return to_img(arr)


def tex_smoke(size=32, seed=1):
    rng = np.random.default_rng(seed)
    base = radial(size, size / 2, size / 2, size / 2, [(0, (255, 255, 255, 210)), (0.6, (255, 255, 255, 110)), (1, (255, 255, 255, 0))])
    noise = rng.random((size // 4, size // 4)).astype(np.float32)
    noise = np.asarray(Image.fromarray((noise * 255).astype(np.uint8)).resize((size, size), Image.BICUBIC)).astype(np.float32) / 255
    base[..., 3] *= 0.55 + 0.45 * noise
    return to_img(base)


def tex_bolt_sheet(frames=4, fsize=32):
    """Black lightning arcs with a red rim (drawn in colour, used with alpha blending)."""
    sheet = Image.new("RGBA", (fsize * frames, fsize), (0, 0, 0, 0))
    rng = random.Random(42)
    for f in range(frames):
        Z = fsize * S
        pts = [(rng.uniform(0.1, 0.25) * Z, rng.uniform(0.1, 0.9) * Z)]
        x = pts[0][0]
        while x < 0.9 * Z:
            x += rng.uniform(0.1, 0.2) * Z
            pts.append((x, rng.uniform(0.15, 0.85) * Z))
        rim = shape_layer(Z, lambda d, pts=pts: d.line(pts, width=int(Z * 0.16), joint="curve"), (255, 30, 40, 220))
        rim = to_arr(to_img(rim).filter(ImageFilter.GaussianBlur(Z * 0.03)))
        core = shape_layer(Z, lambda d, pts=pts: d.line(pts, width=int(Z * 0.07), joint="curve"), (6, 0, 6, 255))
        frame = over(rim, core)
        # a fork
        fork = [pts[len(pts) // 2], (pts[len(pts) // 2][0] + rng.uniform(0.1, 0.25) * Z, rng.uniform(0.05, 0.95) * Z)]
        fr = shape_layer(Z, lambda d, fork=fork: d.line(fork, width=int(Z * 0.045)), (6, 0, 6, 255))
        frame = over(frame, fr)
        sheet.paste(to_img(frame).resize((fsize, fsize), Image.LANCZOS), (f * fsize, 0))
    return sheet


def tex_glyph_sheet(frames=4, fsize=16):
    """Cryptic 'information' glyphs for Unlimited Void (white, tinted cyan)."""
    sheet = Image.new("RGBA", (fsize * frames, fsize), (0, 0, 0, 0))
    rng = random.Random(9)
    for f in range(frames):
        Z = fsize * S
        img = Image.new("L", (Z, Z), 0)
        d = ImageDraw.Draw(img)
        w = int(Z * 0.1)
        for _ in range(4):
            x0, y0 = rng.uniform(0.1, 0.6) * Z, rng.uniform(0.1, 0.6) * Z
            kind = rng.randint(0, 2)
            if kind == 0:
                d.line([(x0, y0), (x0 + Z * 0.35, y0)], fill=255, width=w)
            elif kind == 1:
                d.line([(x0, y0), (x0, y0 + Z * 0.35)], fill=255, width=w)
            else:
                d.ellipse([x0, y0, x0 + Z * 0.25, y0 + Z * 0.25], outline=255, width=w)
        m = np.asarray(img.resize((fsize, fsize), Image.LANCZOS)).astype(np.float32)
        arr = np.zeros((fsize, fsize, 4), np.float32)
        arr[..., :3] = 255
        arr[..., 3] = m
        sheet.paste(to_img(arr), (f * fsize, 0))
    return sheet


def tex_eye(w=64, h=32):
    """Six Eyes sigil: glowing blue eye (coloured, additive)."""
    Z = w * S
    Hh = h * S
    img = np.zeros((Hh, Z, 4), np.float32)
    cx, cy = Z / 2, Hh / 2
    mask = Image.new("L", (Z, Hh), 0)
    ImageDraw.Draw(mask).polygon([(cx - Z * 0.47, cy), (cx - Z * 0.2, cy - Hh * 0.4), (cx, cy - Hh * 0.46), (cx + Z * 0.2, cy - Hh * 0.4),
                                  (cx + Z * 0.47, cy), (cx + Z * 0.2, cy + Hh * 0.4), (cx, cy + Hh * 0.46), (cx - Z * 0.2, cy + Hh * 0.4)], fill=255)
    m = np.asarray(mask).astype(np.float32) / 255
    y, x = np.mgrid[0:Hh, 0:Z].astype(np.float32)
    r = np.sqrt((x - cx) ** 2 + (y - cy) ** 2) / (Hh * 0.42)
    iris = np.clip(1 - r, 0, 1)
    img[..., 0] = 60 + 195 * iris ** 0.6
    img[..., 1] = 170 + 85 * iris ** 0.5
    img[..., 2] = 255
    img[..., 3] = m * (110 + 145 * np.clip(iris * 1.5, 0, 1))
    pupil = (r < 0.25)
    img[pupil, 0] = 20
    img[pupil, 1] = 70
    img[pupil, 2] = 160
    return to_img(img).resize((w, h), Image.LANCZOS)


def tex_cell(size=16):
    Z = size * S
    arr = shape_layer(Z, lambda d: d.ellipse([Z * 0.1, Z * 0.1, Z * 0.9, Z * 0.9], outline=255, width=int(Z * 0.12)), (255, 255, 255, 255))
    arr = over(arr, shape_layer(Z, lambda d: d.ellipse([Z * 0.38, Z * 0.38, Z * 0.62, Z * 0.62]), (255, 255, 255, 230)))
    return to_img(arr).resize((size, size), Image.LANCZOS)


def tex_streak(w=16, h=64):
    y, x = np.mgrid[0:h, 0:w].astype(np.float32)
    ax = np.exp(-((x - w / 2 + 0.5) / (w * 0.18)) ** 2)
    ay = np.clip(1 - np.abs(y - h / 2 + 0.5) / (h / 2), 0, 1) ** 0.7
    arr = np.zeros((h, w, 4), np.float32)
    arr[..., :3] = 255
    arr[..., 3] = ax * ay * 255
    return to_img(arr)


def tex_shard(size=8):
    arr = np.zeros((size, size, 4), np.float32)
    arr[1:size - 1, 1:size - 1] = (255, 255, 255, 255)
    arr[2:size - 2, 2:size - 2, :3] = 200
    return to_img(arr)


# ----------------------------------------------------------------------------
# blindfold model texture (64x32, per-face UV patches)
# ----------------------------------------------------------------------------

def tex_blindfold():
    img = np.zeros((32, 64, 4), np.float32)
    rng = np.random.default_rng(5)
    # BAND patch (0,0) 16x8: black fabric with subtle weave stripes
    band = np.zeros((8, 16, 4), np.float32)
    band[..., :3] = 24
    band[..., 3] = 255
    band[1::3, :, :3] = 42
    band[:, ::5, :3] += 6
    img[0:8, 0:16] = band
    # KNOT patch (16,0) 8x8
    img[0:8, 16:24] = (34, 34, 42, 255)
    img[3:5, 16:24, :3] = 50
    # HAIR patch (0,8) 16x16: white with blue-grey shading
    hair = np.zeros((16, 16, 4), np.float32)
    noise = rng.random((16, 16))
    for yy in range(16):
        tone = 250 - yy * 3
        hair[yy, :, 0] = tone - 10
        hair[yy, :, 1] = tone - 4
        hair[yy, :, 2] = min(255, tone + 4)
    hair[..., :3] -= (noise[..., None] * 16)
    hair[..., 3] = 255
    img[8:24, 0:16] = hair
    # HAIR_TOP patch (16,8) 8x8: brightest
    img[8:16, 16:24] = (246, 249, 255, 255)
    img[9:16:3, 16:24, :3] = 228
    # EYE patch (32,0) 4x4: cyan, translucent => emissive glow with entity_emissive_alpha
    img[0:4, 32:36] = (120, 235, 255, 90)
    img[1:3, 33:35] = (220, 255, 255, 70)
    return to_img(img)


# ----------------------------------------------------------------------------
# pack icon
# ----------------------------------------------------------------------------

def pack_icon(size=256, variant="bp"):
    Z = size
    c = Z / 2
    arr = radial(Z, c, c, Z * 0.75, [(0, (40, 12, 70, 255)), (0.6, (10, 6, 26, 255)), (1, (2, 2, 8, 255))])
    rng = random.Random(21)
    for _ in range(70):
        x, y = rng.uniform(0, Z), rng.uniform(0, Z)
        s = rng.choice([1.5, 2, 2.5, 3.5])
        st_ = shape_layer(Z, lambda d, x=x, y=y, s=s: d.polygon(star_points(x, y, s * 1.8, s * 0.5, 4, 0.0)), (255, 255, 255, 220))
        arr = add_glow(arr, st_)
    arr = add_glow(arr, halo(Z, c, c, Z * 0.42, (170, 60, 255), 200))
    arr = over(arr, sphere(Z, c, c + 6, Z * 0.26, (50, 0, 90), (150, 40, 230), (255, 225, 255)))
    arr = add_glow(arr, radial(Z, c, c + 6, Z * 0.13, [(0, (255, 255, 255, 255)), (1, (255, 200, 255, 0))]))
    arr = add_glow(arr, halo(Z, c - Z * 0.33, c - Z * 0.2, Z * 0.14, (60, 140, 255), 230))
    arr = over(arr, sphere(Z, c - Z * 0.33, c - Z * 0.2, Z * 0.085, (10, 40, 150), (40, 120, 255), (210, 240, 255)))
    arr = add_glow(arr, halo(Z, c + Z * 0.33, c - Z * 0.2, Z * 0.14, (255, 60, 50), 230))
    arr = over(arr, sphere(Z, c + Z * 0.33, c - Z * 0.2, Z * 0.085, (130, 0, 10), (235, 30, 30), (255, 220, 170)))
    pts = [lemniscate(t, Z * 0.2) for t in np.linspace(0, 2 * math.pi, 300)]
    inf = shape_layer(Z, lambda d: d.line([(c + x, c + Z * 0.36 + y) for x, y in pts] + [(c + pts[0][0], c + Z * 0.36 + pts[0][1])], width=int(Z * 0.035), joint="curve"),
                      (150, 235, 255, 255) if variant == "bp" else (255, 255, 255, 255))
    arr = add_glow(arr, to_arr(to_img(inf).filter(ImageFilter.GaussianBlur(3))))
    arr = over(arr, inf)
    border = shape_layer(Z, lambda d: d.rounded_rectangle([3, 3, Z - 4, Z - 4], 26, outline=255, width=5), (150, 90, 255, 255))
    arr = over(arr, border)
    return to_img(arr)


def main():
    icons = {
        "transformation": icon_transformation(),
        "infinity": icon_infinity(),
        "lapse_blue": icon_blue(),
        "reversal_red": icon_red(),
        "hollow_purple": icon_purple(),
        "unlimited_void": icon_void(),
        "six_eyes": icon_six_eyes(),
        "teleport": icon_teleport(),
        "reverse_cursed_technique": icon_rct(),
        "black_flash": icon_black_flash(),
        "blindfold": icon_blindfold(False),
        "blindfold_lifted": icon_blindfold(True),
    }
    for name, img in icons.items():
        save(img, ICON_DIR, name)
    parts = {
        "glow": tex_glow(),
        "core": tex_core(),
        "spark": tex_spark(),
        "star": tex_star(),
        "ring": tex_ring(),
        "ripple": tex_ripple(),
        "smoke": tex_smoke(),
        "bolt": tex_bolt_sheet(),
        "glyph": tex_glyph_sheet(),
        "eye": tex_eye(),
        "cell": tex_cell(),
        "streak": tex_streak(),
        "shard": tex_shard(),
    }
    for name, img in parts.items():
        save(img, PARTICLE_DIR, name)
    save(tex_blindfold(), MODEL_DIR, "blindfold")
    pack_icon(256, "bp").save(os.path.join(BP, "pack_icon.png"))
    pack_icon(256, "rp").save(os.path.join(RP, "pack_icon.png"))
    # Contact sheet of all icons (for the README / quick visual review).
    sheet = Image.new("RGBA", (len(icons) * 36 + 4, 40), (48, 48, 56, 255))
    for i, img in enumerate(icons.values()):
        sheet.alpha_composite(img, (4 + i * 36, 4))
    sheet = sheet.resize((sheet.width * 4, sheet.height * 4), Image.NEAREST)
    os.makedirs(os.path.join(ROOT, "docs"), exist_ok=True)
    sheet.save(os.path.join(ROOT, "docs", "icons_preview.png"))
    print("art generated:", len(icons), "icons,", len(parts), "particle textures")


if __name__ == "__main__":
    main()
