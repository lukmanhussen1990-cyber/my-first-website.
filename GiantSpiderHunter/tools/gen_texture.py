#!/usr/bin/env python3
"""Generate the Giant Spider Hunter entity texture (DESIGN.md section 5).

Output: packs/GiantSpiderHunter_RP/textures/entity/giant_spider/giant_spider.png (128x128 RGBA)

The texture is an atlas of named rectangular *regions*. Each region is painted for one
kind of surface (limb side, limb end cap, joint, carapace, abdomen, head front with eyes,
...). The geometry generator (tools/gen_geometry.py) imports `layout()` from this module
and maps every cube face onto one of these regions with per-face UVs, so both files always
agree. Region sizes are chosen so a face is drawn at roughly 2 model px per texel on the
giant (long limb faces are stretched moderately along their length, the abdomen uses
~2.4 px per texel).

Colour rules (binding):
  * dark brown / charcoal base (#2a221e .. #3d2f27), lighter warm-brown bevel ring
    (#6b5240) on every limb face (the reference "wooden beam" look), subtle grain/noise,
    darker joints, bristle specks;
  * abdomen charcoal with faint brown chevrons, slightly lighter underside;
  * eyes deep red (#a60202 / #ff0e0e) with ALPHA = 3 so the vanilla `spider` material
    makes them glow; every other texel has alpha 255 (gutters/unused space included).

Deterministic: fixed RNG seeds, no timestamps. Run:  python3 tools/gen_texture.py
"""
import os
import sys

import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "packs", "GiantSpiderHunter_RP", "textures", "entity",
                   "giant_spider", "giant_spider.png")

SIZE = 128
EYE_ALPHA = 3


def hexc(s):
    s = s.lstrip("#")
    return np.array([int(s[i:i + 2], 16) for i in (0, 2, 4)], dtype=np.float64)


# ---------------------------------------------------------------------------- palette
BASE0 = hexc("#2a221e")      # darkest limb base
BASE1 = hexc("#3d2f27")      # lightest limb base
BEVEL = hexc("#6b5240")      # warm-brown bevel edge
BEVEL_HI = hexc("#7a5e49")   # bevel corner highlight
SHADOW = hexc("#1d1714")     # groove / inner shadow
JOINT0 = hexc("#1c1613")
JOINT1 = hexc("#29201b")
JOINT_BEVEL = hexc("#4f3c2f")
CAP0 = hexc("#251d19")       # limb end caps (darker than sides)
CAP1 = hexc("#33281f")
ABD0 = hexc("#221e1c")       # abdomen charcoal
ABD1 = hexc("#2e2824")
ABD_BEVEL = hexc("#4a3a2f")
CHEVRON = hexc("#4b3a2d")
UNDER0 = hexc("#332a24")     # lighter undersides
UNDER1 = hexc("#43362d")
SPECK_LIGHT = hexc("#5a4636")
SPECK_DARK = hexc("#120e0c")
FANG0 = hexc("#1a1311")
FANG_TIP = hexc("#3a1410")
SOCKET = hexc("#0f0b0a")
EYE_DARK = hexc("#620000")
EYE = hexc("#a60202")
EYE_HI = hexc("#ff0e0e")

# ---------------------------------------------------------------------------- regions
# (name, width_texels, height_texels, style, seed)
# Orientation convention used by gen_geometry.py:
#   north/south faces: U = cube X extent, V = cube Y extent (top of region = top of face)
#   east/west faces:   U = cube Z extent, V = cube Y extent
#   up/down faces:     U = cube X extent, V = cube Z extent
REGIONS = [
    # ---- legs (shared by all eight legs; sized for the k = 1.00 pair)
    ("fem_side", 72, 11, "beam", 11),        # femur long faces N/S  (~152 x 22 px)
    ("fem_top", 72, 11, "beam_top", 12),     # femur long faces U/D
    ("fem_end", 11, 11, "endcap", 13),       # femur end faces E/W (22 x 22)
    ("crest_top", 48, 7, "beam_top", 14),    # femur dorsal crest top (~105 x 14)
    ("crest_side", 48, 3, "beam", 15),       # crest sides (~105 x 5)
    ("crest_end", 7, 3, "endcap", 16),
    ("knee", 13, 13, "joint", 17),           # knee joint block (26 cube)
    ("tib1_side", 64, 7, "beam_long", 18),   # upper tibia long faces (~137 x 14)
    ("tib1_end", 7, 7, "endcap", 19),
    ("tib2_side", 64, 6, "beam_long", 20),   # lower tibia long faces (~136 x 11)
    ("tib2_end", 6, 6, "endcap", 21),
    ("ankle_side", 4, 7, "joint", 22),       # ankle joint (8 x 13)
    ("ankle_end", 7, 7, "joint", 23),
    ("foot_side", 15, 5, "beam", 24),        # foot (30 x 9)
    ("foot_end", 5, 5, "endcap", 25),
    ("claw_side", 10, 3, "claw", 26),        # claw (20 x 6)
    ("claw_end", 3, 3, "claw", 27),
    # ---- cephalothorax
    ("tor_side", 26, 10, "plate", 30),       # main block E/W (52 x 20)
    ("tor_end", 21, 10, "plate", 31),        # main block N/S (42 x 20)
    ("tor_under", 21, 26, "under_dark", 32),  # main block underside (42 x 52)
    ("cara_top", 23, 21, "carapace", 33),    # carapace plate top (46 x 42)
    ("cara_side", 21, 4, "beam", 34),        # carapace rim E/W (42 x 8)
    ("cara_end", 23, 4, "beam", 35),         # carapace rim N/S (46 x 8)
    ("ridge_top", 7, 16, "ridge", 36),       # dorsal ridge top (14 x 32)
    ("ridge_side", 16, 2, "beam", 37),
    ("ridge_end", 7, 2, "beam", 38),
    ("stern_down", 15, 17, "sternum", 39),   # plated underside (30 x 34)
    ("stern_side", 17, 2, "beam", 40),
    ("stern_end", 15, 2, "beam", 41),
    # ---- head
    ("head_front", 14, 11, "head_front", 50),  # eyes (28 x 22)
    ("head_side", 10, 11, "plate", 51),        # (20 x 22)
    ("head_top", 14, 10, "head_top", 52),      # (28 x 20)
    ("head_under", 14, 10, "sternum", 53),
    ("jaw_front", 11, 4, "plate", 54),         # chelicera base (22 x 8)
    ("jaw_side", 6, 4, "plate", 55),
    ("jaw_under", 11, 6, "sternum", 56),
    ("fang_side", 4, 11, "fang", 57),          # fang base (8 x 22)
    ("fang_end", 4, 4, "fang_end", 58),
    ("fangtip_side", 3, 8, "fangtip", 59),     # fang tip (5 x 16)
    ("fangtip_end", 3, 3, "fangtip", 60),
    # ---- abdomen (~2.4 px per texel)
    ("petiole", 6, 6, "joint", 70),
    ("abd_front", 18, 16, "abd_side", 71),     # front block N (44 x 38)
    ("abd1_side", 7, 16, "abd_side", 72),      # front block E/W (16 x 38)
    ("abd1_top", 18, 7, "abd_side", 73),       # front/rear block top (44 x 16)
    ("abd1_under", 18, 7, "abd_under", 74),
    ("abd_top", 26, 21, "abd_top", 75),        # main block top (64 x 52)
    ("abd_under", 26, 21, "abd_under", 76),
    ("abd_side", 21, 25, "abd_side", 77),      # main block E/W (52 x 62)
    ("abd_end", 26, 25, "abd_side", 78),       # main block N/S (64 x 62)
    ("abd_rear", 19, 19, "abd_side", 79),      # rear block S (46 x 46)
    ("abd3_side", 7, 19, "abd_side", 80),      # rear block E/W (16 x 46)
    ("spinner", 8, 6, "joint", 81),            # spinnerets (20 x 16)
    ("abd_plate", 16, 16, "abd_plate", 82),    # dorsal plate top (40 x 40)
    ("abd_plate_side", 16, 2, "beam", 83),
]


def layout():
    """Deterministic shelf packing of REGIONS into the 128x128 atlas.

    Every region gets a 1-texel gutter on all sides (shared with neighbours); gutters are
    later filled by edge dilation so sampling slightly outside a region never hits
    unpainted or transparent texels. Returns {name: (u, v, w, h)}.
    """
    order = sorted(REGIONS, key=lambda r: (-r[2], -r[1], r[0]))
    placed = {}
    x, y, shelf_h = 1, 1, 0
    for name, w, h, _style, _seed in order:
        if x + w + 1 > SIZE:
            x, y = 1, y + shelf_h + 1
            shelf_h = 0
        if y + h + 1 > SIZE:
            raise RuntimeError(f"atlas overflow while placing {name}")
        placed[name] = (x, y, w, h)
        x += w + 1
        shelf_h = max(shelf_h, h)
    return placed


# ---------------------------------------------------------------------------- noise helpers
def smooth1d(rng, n, scale=3.0):
    """Smooth-ish 1D noise in [0,1] (linear interpolation of random knots)."""
    knots = max(2, int(np.ceil(n / scale)) + 2)
    k = rng.random(knots)
    xs = np.linspace(0, knots - 1.001, n)
    i = np.floor(xs).astype(int)
    f = xs - i
    return k[i] * (1 - f) + k[i + 1] * f


def lerp(a, b, t):
    t = np.asarray(t)[..., None]
    return a * (1 - t) + b * t


def ring(img, color, rng, jitter=0.06, width=1):
    """Paint a bevel ring of `width` texels around the region border."""
    h, w, _ = img.shape
    m = np.zeros((h, w), bool)
    m[:width, :] = m[-width:, :] = True
    m[:, :width] = m[:, -width:] = True
    n = 1 + (rng.random((h, w)) - 0.5) * 2 * jitter
    img[m] = (color[None, :] * n[m][:, None])
    return m


def inner_shadow(img, factor=0.86):
    h, w, _ = img.shape
    if h > 4 and w > 4:
        img[1, 1:-1] *= factor
        img[-2, 1:-1] *= factor
        img[1:-1, 1] *= factor
        img[1:-1, -2] *= factor


def specks(img, rng, density, light=SPECK_LIGHT, dark=SPECK_DARK, inset=1):
    h, w, _ = img.shape
    if h <= 2 * inset or w <= 2 * inset:
        return
    count = int(round(density * (h - 2 * inset) * (w - 2 * inset)))
    for _ in range(count):
        yy = rng.integers(inset, h - inset)
        xx = rng.integers(inset, w - inset)
        img[yy, xx] = light if rng.random() < 0.55 else dark


def corners(img, color):
    h, w, _ = img.shape
    if h >= 3 and w >= 3:
        for yy, xx in ((0, 0), (0, w - 1), (h - 1, 0), (h - 1, w - 1)):
            img[yy, xx] = color


# ---------------------------------------------------------------------------- painters
def grain(w, h, rng, c0, c1, along_u=True, streak=0.035):
    """Wood-like grain: stripes running along U (or V)."""
    rows = smooth1d(rng, h if along_u else w, 1.6)
    fine = rng.random((h, w))
    if along_u:
        t = 0.55 * rows[:, None] + 0.25 * fine + 0.2 * smooth1d(rng, w, 6.0)[None, :]
    else:
        t = 0.55 * rows[None, :] + 0.25 * fine + 0.2 * smooth1d(rng, h, 6.0)[:, None]
    img = lerp(c0, c1, np.clip(t, 0, 1))
    # darker grain streaks along the length
    n = int(streak * w * h)
    for _ in range(n):
        if along_u:
            r = rng.integers(0, h)
            c = rng.integers(0, w)
            ln = rng.integers(3, 9)
            img[r, c:c + ln] *= 0.8
        else:
            c = rng.integers(0, w)
            r = rng.integers(0, h)
            ln = rng.integers(3, 9)
            img[r:r + ln, c] *= 0.8
    return img


def p_beam(w, h, rng, top=False, long=False):
    c0, c1 = (BASE0, BASE1)
    if top:  # upper faces catch a touch more warmth
        c0, c1 = BASE0 * 1.04, BASE1 * 1.04
    img = grain(w, h, rng, c0, c1, along_u=True)
    specks(img, rng, 0.05 if long else 0.03)
    inner_shadow(img)
    ring(img, BEVEL, rng)
    corners(img, BEVEL_HI)
    return img


def p_endcap(w, h, rng):
    yy, xx = np.mgrid[0:h, 0:w]
    cy, cx = (h - 1) / 2, (w - 1) / 2
    r = np.sqrt((yy - cy) ** 2 + (xx - cx) ** 2)
    t = 0.5 + 0.35 * np.sin(r * 2.2) + 0.15 * rng.random((h, w))  # faint end-grain rings
    img = lerp(CAP0, CAP1, np.clip(t, 0, 1))
    inner_shadow(img, 0.8)
    ring(img, BEVEL * 0.92, rng)
    corners(img, BEVEL_HI * 0.95)
    return img


def p_joint(w, h, rng):
    img = lerp(JOINT0, JOINT1, rng.random((h, w)) * 0.7 + 0.3 * smooth1d(rng, w, 2)[None, :])
    specks(img, rng, 0.06, light=JOINT_BEVEL, dark=SPECK_DARK)
    if h > 4 and w > 4:
        inner_shadow(img, 0.8)
    ring(img, JOINT_BEVEL, rng)
    return img


def p_claw(w, h, rng):
    img = lerp(SPECK_DARK, JOINT0, rng.random((h, w)))
    ring(img, JOINT_BEVEL * 0.9, rng)
    if h >= 3 and w >= 3:
        img[1:-1, 1:-1] = lerp(SPECK_DARK, JOINT0, rng.random((h - 2, w - 2)))
    return img


def p_plate(w, h, rng):
    img = grain(w, h, rng, BASE0, BASE1 * 0.97, along_u=True, streak=0.02)
    specks(img, rng, 0.04)
    inner_shadow(img)
    ring(img, BEVEL, rng)
    corners(img, BEVEL_HI)
    return img


def p_under_dark(w, h, rng):
    img = lerp(BASE0 * 0.85, BASE0, rng.random((h, w)))
    for yy in range(3, h - 1, 5):        # transverse plate seams
        img[yy, 1:-1] = SHADOW
    specks(img, rng, 0.03)
    ring(img, BEVEL * 0.85, rng)
    return img


def p_carapace(w, h, rng):
    # U = width (X), V = length (Z). Central groove + radial striations + bevel rim.
    img = grain(w, h, rng, BASE0, BASE1, along_u=False, streak=0.02)
    cx = (w - 1) / 2
    yy, xx = np.mgrid[0:h, 0:w]
    fy = h * 0.45
    ang = np.arctan2(yy - fy, xx - cx)
    stri = (np.cos(ang * 8) > 0.82) & (np.hypot(yy - fy, xx - cx) > 2.5)
    img[stri] *= 0.8
    img[:, int(np.floor(cx))] = SHADOW              # median groove
    if w % 2 == 0:
        img[:, int(np.ceil(cx))] = SHADOW
    fy_i = int(fy)
    img[fy_i - 1:fy_i + 2, int(cx) - 1:int(np.ceil(cx)) + 2] = SPECK_DARK  # fovea pit
    specks(img, rng, 0.03)
    inner_shadow(img)
    ring(img, BEVEL, rng)
    corners(img, BEVEL_HI)
    return img


def p_ridge(w, h, rng):
    img = grain(w, h, rng, BASE0 * 1.05, BASE1 * 1.08, along_u=False)
    cx = w // 2
    img[1:-1, cx] = BEVEL * 0.8       # crest line
    for yy in range(2, h - 1, 4):
        img[yy, 1:-1] *= 0.8          # segment notches
    ring(img, BEVEL, rng)
    corners(img, BEVEL_HI)
    return img


def p_sternum(w, h, rng):
    img = lerp(UNDER0, UNDER1, rng.random((h, w)) * 0.6 + 0.4 * smooth1d(rng, h, 3)[:, None])
    for yy in range(3, h - 1, 4):     # plated underside seams
        img[yy, 1:-1] = SHADOW * 1.2
    cx = (w - 1) / 2
    img[1:-1, int(np.floor(cx))] *= 0.85
    specks(img, rng, 0.03)
    ring(img, BEVEL, rng)
    return img


def p_head_top(w, h, rng):
    img = grain(w, h, rng, BASE0, BASE1, along_u=False, streak=0.02)
    cx = (w - 1) / 2
    img[1:-1, int(np.floor(cx))] *= 0.8
    img[1:-1, int(np.ceil(cx))] *= 0.8
    specks(img, rng, 0.05)
    inner_shadow(img)
    ring(img, BEVEL, rng)
    corners(img, BEVEL_HI)
    return img


# Eye layout on the 14x11 head front region (x, y, w, h, kind). Upper half of the face,
# 8 eyes: two large median eyes, two anterior laterals, four small posterior eyes.
EYES = [
    (4, 3, 2, 2, "big"), (8, 3, 2, 2, "big"),          # anterior median (largest)
    (2, 5, 1, 1, "small"), (11, 5, 1, 1, "small"),     # anterior laterals
    (3, 2, 1, 1, "small"), (10, 2, 1, 1, "small"),     # posterior laterals
    (6, 1, 1, 1, "small"), (7, 1, 1, 1, "small"),      # posterior medians
]


def p_head_front(w, h, rng):
    img = grain(w, h, rng, BASE0, BASE1, along_u=True, streak=0.02)
    specks(img, rng, 0.04)
    inner_shadow(img)
    ring(img, BEVEL, rng)
    corners(img, BEVEL_HI)
    alpha = np.full((h, w), 255, np.uint8)
    # dark sockets around every eye first
    for x, y, ew, eh, _k in EYES:
        img[max(1, y - 1):min(h - 1, y + eh + 1), max(1, x - 1):min(w - 1, x + ew + 1)] = SOCKET
    for x, y, ew, eh, kind in EYES:
        if kind == "big":
            img[y:y + eh, x:x + ew] = EYE
            img[y, x] = EYE_HI          # specular-ish bright texel
            img[y + eh - 1, x + ew - 1] = EYE_DARK
        else:
            img[y:y + eh, x:x + ew] = EYE
        alpha[y:y + eh, x:x + ew] = EYE_ALPHA
    # mouth / chelicera seam along the lower edge
    img[h - 3, 3:w - 3] = SHADOW
    return img, alpha


def p_fang(w, h, rng):
    t = np.linspace(0, 1, h)[:, None] * np.ones((1, w))
    img = lerp(FANG0, FANG_TIP * 0.8, t * 0.6 + 0.15 * rng.random((h, w)))
    img[:, 0] = JOINT_BEVEL
    img[:, -1] = JOINT_BEVEL * 0.9
    img[0, :] = JOINT_BEVEL
    return img


def p_fang_end(w, h, rng):
    img = lerp(FANG0, JOINT1, rng.random((h, w)))
    ring(img, JOINT_BEVEL, rng)
    return img


def p_fangtip(w, h, rng):
    t = np.linspace(0, 1, h)[:, None] * np.ones((1, w))
    img = lerp(FANG_TIP * 0.8, SPECK_DARK, np.clip(t + 0.15 * rng.random((h, w)), 0, 1))
    img[:, 0] *= 1.3
    return img


def p_abd_side(w, h, rng):
    # U = horizontal, V = downward. Charcoal mottling, slightly lighter towards the belly.
    v = np.linspace(0, 1, h)[:, None]
    t = 0.45 * rng.random((h, w)) + 0.35 * smooth1d(rng, w, 3)[None, :] * smooth1d(rng, h, 3)[:, None]
    img = lerp(ABD0, ABD1, np.clip(t, 0, 1))
    img = img * (1 - v[..., None] * 0) + (UNDER0 - ABD0)[None, None, :] * (v[..., None] ** 2) * 0.6
    # faint brown side bands
    for yy in range(3, h - 2, 6):
        img[yy, 1:-1] = img[yy, 1:-1] * 0.7 + CHEVRON * 0.3
    specks(img, rng, 0.03, light=ABD_BEVEL, dark=SPECK_DARK)
    inner_shadow(img, 0.9)
    ring(img, ABD_BEVEL, rng)
    return img


def p_abd_top(w, h, rng):
    # U = width (X), V = length (Z): faint brown chevrons + dark median band.
    t = 0.5 * rng.random((h, w)) + 0.5 * smooth1d(rng, h, 3)[:, None]
    img = lerp(ABD0, ABD1, np.clip(t, 0, 1))
    cx = (w - 1) / 2
    yy, xx = np.mgrid[0:h, 0:w]
    dist = np.abs(xx - cx)
    for k in range(3, h, 5):
        chev = (np.abs((yy - k) - dist * 0.6) < 0.7) & (dist > 1.5) & (dist < cx - 1)
        img[chev] = img[chev] * 0.45 + CHEVRON * 0.55
    band = dist < 1.6
    img[band] *= 0.75                   # heart mark
    specks(img, rng, 0.03, light=ABD_BEVEL, dark=SPECK_DARK)
    inner_shadow(img, 0.9)
    ring(img, ABD_BEVEL, rng)
    return img


def p_abd_under(w, h, rng):
    img = lerp(UNDER0, UNDER1, 0.6 * rng.random((h, w)) + 0.4 * smooth1d(rng, w, 4)[None, :])
    for yy in range(2, h - 1, 4):
        img[yy, 1:-1] *= 0.8
    specks(img, rng, 0.02)
    ring(img, ABD_BEVEL * 1.1, rng)
    return img


def p_abd_plate(w, h, rng):
    img = p_abd_top(w, h, rng)
    inner_shadow(img, 0.8)
    ring(img, BEVEL * 0.85, rng)
    corners(img, BEVEL)
    return img


PAINTERS = {
    "beam": lambda w, h, r: p_beam(w, h, r),
    "beam_top": lambda w, h, r: p_beam(w, h, r, top=True),
    "beam_long": lambda w, h, r: p_beam(w, h, r, long=True),
    "endcap": p_endcap,
    "joint": p_joint,
    "claw": p_claw,
    "plate": p_plate,
    "under_dark": p_under_dark,
    "carapace": p_carapace,
    "ridge": p_ridge,
    "sternum": p_sternum,
    "head_top": p_head_top,
    "head_front": p_head_front,
    "fang": p_fang,
    "fang_end": p_fang_end,
    "fangtip": p_fangtip,
    "abd_side": p_abd_side,
    "abd_top": p_abd_top,
    "abd_under": p_abd_under,
    "abd_plate": p_abd_plate,
}


def build():
    """Return (rgba uint8 array 128x128x4, layout dict, painted-mask)."""
    lay = layout()
    rgb = np.zeros((SIZE, SIZE, 3), np.float64)
    alpha = np.full((SIZE, SIZE), 255, np.uint8)
    painted = np.zeros((SIZE, SIZE), bool)
    for name, w, h, style, seed in REGIONS:
        u, v, _w, _h = lay[name]
        rng = np.random.default_rng(seed * 7919 + 17)
        out = PAINTERS[style](w, h, rng)
        if isinstance(out, tuple):
            img, a = out
            alpha[v:v + h, u:u + w] = a
        else:
            img = out
        rgb[v:v + h, u:u + w] = img
        painted[v:v + h, u:u + w] = True
    # fill gutters / unused space by dilation from painted texels (opaque, alpha 255)
    filled = painted.copy()
    while not filled.all():
        nf = filled.copy()
        acc = np.zeros_like(rgb)
        cnt = np.zeros((SIZE, SIZE))
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            src_f = np.roll(filled, (dy, dx), axis=(0, 1))
            src_c = np.roll(rgb, (dy, dx), axis=(0, 1))
            # do not wrap around the borders
            if dy == 1:
                src_f[0, :] = False
            if dy == -1:
                src_f[-1, :] = False
            if dx == 1:
                src_f[:, 0] = False
            if dx == -1:
                src_f[:, -1] = False
            take = src_f & ~filled
            acc[take] += src_c[take]
            cnt[take] += 1
        new = cnt > 0
        rgb[new] = acc[new] / cnt[new][:, None]
        nf[new] = True
        filled = nf
    alpha[~painted] = 255
    rgba = np.zeros((SIZE, SIZE, 4), np.uint8)
    rgba[..., :3] = np.clip(np.round(rgb), 0, 255).astype(np.uint8)
    rgba[..., 3] = alpha
    return rgba, lay, painted


def eye_texels(lay):
    """Atlas coordinates of every eye texel (for verification)."""
    u, v, _w, _h = lay["head_front"]
    out = []
    for x, y, ew, eh, _k in EYES:
        for yy in range(y, y + eh):
            for xx in range(x, x + ew):
                out.append((u + xx, v + yy))
    return out


def main():
    rgba, lay, painted = build()
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    Image.fromarray(rgba, "RGBA").save(OUT, optimize=True)
    a = rgba[..., 3]
    vals, counts = np.unique(a, return_counts=True)
    hist = {int(k): int(c) for k, c in zip(vals, counts)}
    used = int(painted.sum())
    print(f"wrote {os.path.relpath(OUT, ROOT)}  {SIZE}x{SIZE}  regions={len(REGIONS)} "
          f"painted={used}/{SIZE * SIZE} ({100.0 * used / SIZE / SIZE:.1f}%)  alpha={hist}")
    expected = {255, EYE_ALPHA}
    if set(hist) - expected:
        sys.exit(f"unexpected alpha values {sorted(set(hist) - expected)}")
    if hist.get(EYE_ALPHA, 0) != len(eye_texels(lay)):
        sys.exit("eye texel count mismatch")


if __name__ == "__main__":
    main()
