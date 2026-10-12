#!/usr/bin/env python3
"""Generate the Giant Spider Hunter entity texture (DESIGN.md section 5).

Output: packs/GiantSpiderHunter_RP/textures/entity/giant_spider/giant_spider.png (256x256 RGBA)

The texture is an atlas of named rectangular *regions*. Each region is painted for one
kind of surface (femur side, femur underside, knee joint, end cap, carapace, abdomen,
head front with eyes, ...). The geometry generator (tools/gen_geometry.py) imports
`layout()` from this module and maps every cube face onto one of these regions with
per-face UVs, so both files always agree. Region sizes keep roughly 2.5-3 model px per
texel on the giant (head front 2 px/texel so the eye cluster stays crisp).

Look ("stripped dark wooden beams", ref_thumbnail.jpg / ref_giant_hero.png):
  * medium-dark warm brown wood with a slight red/grey tint (#5e4b47 .. #85706a), crisp
    1-texel LIGHTER bevel edges on every beam (brightest on the upper edge), a darker
    chamfer line just inside the bevel, lengthwise plank seams with a lit lower lip,
    wavy grain lines, worn light streaks, knots, bristle specks;
  * baked lighting that survives vanilla (shader-less) Bedrock rendering: a subtle top-lit
    vertical gradient on side faces, ambient-occlusion darkening where the femur enters the
    body and toward the joints, lighter "collar" bands next to every joint, lighter
    end-grain caps, darker angular knee/ankle blocks with light caps;
  * faces that are mostly seen from BELOW (undersides) are painted a little lighter to
    compensate Bedrock's dark bottom-face shading (top 1.0, sides ~0.6-0.8, bottom ~0.45);
  * body: chitin plates with plate seams, carapace with median groove + radial striations,
    abdomen with a pale folium/chevron pattern and segment lines;
  * eyes: deep red cluster (#a60202 / #ff0e0e) on the head front with ALPHA = 3 so the
    vanilla `spider` material makes them glow; every other texel alpha 255.

Mirrored regions: a region declared with mirror=True is also emitted as `<name>_f`
(horizontally flipped). Long limb faces are painted with their DISTAL end at high U;
gen_geometry.py picks `<name>` or `<name>_f` per face so the distal end (knee, foot) of
every leg -- left or right, north or south face -- gets the same treatment.

Deterministic: fixed RNG seeds, no timestamps. Run:  python3 tools/gen_texture.py
"""
import os
import sys

import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "packs", "GiantSpiderHunter_RP", "textures", "entity",
                   "giant_spider", "giant_spider.png")

SIZE = 256
EYE_ALPHA = 3


def hexc(s):
    s = s.lstrip("#")
    return np.array([int(s[i:i + 2], 16) for i in (0, 2, 4)], dtype=np.float64)


# ---------------------------------------------------------------------------- palette
WOOD_D = hexc("#5c4945")     # dark grain
WOOD_M = hexc("#715c57")     # median wood (reference median ~#725a5a)
WOOD_L = hexc("#86716b")     # light grain
WORN = hexc("#9a867d")       # worn light streaks
SEAM = hexc("#3a2d2b")       # plank seam / groove
BEVEL_TOP = hexc("#b09c92")  # upper bevel edge (catches the light)
BEVEL = hexc("#a08b82")      # side / end bevel edge
BEVEL_LOW = hexc("#8f7b73")  # lower bevel edge
BEVEL_HI = hexc("#c1aea3")   # bevel corner highlight
COLLAR = hexc("#9c877d")     # light band next to a joint
CAP_L = hexc("#a69186")      # end-grain cap, light ring
CAP_D = hexc("#86716a")      # end-grain cap, dark ring
JOINT_D = hexc("#3f3233")    # knee/ankle block dark
JOINT_M = hexc("#53423f")    # knee/ankle block mid
JOINT_BEVEL = hexc("#8a766d")
KNOT = hexc("#33272a")
CHIT_D = hexc("#4c3c3c")     # body chitin dark
CHIT_M = hexc("#5f4c4a")     # body chitin mid
CHIT_L = hexc("#725e59")     # body chitin light
CHIT_BEVEL = hexc("#937e75")
ABD_D = hexc("#45363a")      # abdomen charcoal-red
ABD_M = hexc("#57464a")
ABD_L = hexc("#6a5755")
FOLIUM = hexc("#8e786c")     # pale abdomen chevrons
UNDER_D = hexc("#6a5752")    # undersides (lighter: bottom faces are shaded dark in game)
UNDER_L = hexc("#836e67")
BRISTLE = hexc("#2b2124")
BRISTLE_HI = hexc("#a39086")
FANG0 = hexc("#2c2022")
FANG_TIP = hexc("#6e2a20")
SOCKET = hexc("#170f10")
EYE_DARK = hexc("#620000")
EYE = hexc("#a60202")
EYE_HI = hexc("#ff0e0e")

# ---------------------------------------------------------------------------- regions
# (name, width_texels, height_texels, style, seed, mirror)
# Orientation convention used by gen_geometry.py (verified with the viewer's UV mapping):
#   north/south faces: U = cube X extent, V = cube Y extent (top of region = top of face)
#   east/west faces:   U = cube Z extent, V = cube Y extent
#   up/down faces:     U = cube X extent, V = cube Z extent
#   on north/up/down faces U grows toward +X, on south faces toward -X.
# Limb regions: DISTAL end (toward the foot) at high U; `<name>_f` is the mirror image.
REGIONS = [
    # ---- legs (shared by all eight legs; sized for the k = 1.00 pair, ~3 px per texel)
    ("fem_side", 84, 12, "fem_side", 11, True),      # femur N/S   (252 x 36 px)
    ("fem_top", 84, 12, "fem_top", 12, True),        # femur up    (252 x 34)
    ("fem_under", 84, 12, "fem_under", 13, True),    # femur down  (seen from below: lighter)
    ("fem_end", 12, 12, "endcap", 14, False),        # femur ends  (34 x 36)
    ("crest_top", 60, 8, "plank_top", 15, False),    # dorsal plank on the femur (182 x 24)
    ("crest_side", 60, 4, "plank_side", 16, False),  # (182 x 10)
    ("crest_end", 8, 4, "endcap", 17, False),
    ("fkeel_under", 52, 8, "plank_under", 18, False),  # ventral plank under the femur (158 x 22)
    ("fkeel_side", 52, 3, "plank_side", 19, False),    # (158 x 8)
    ("fkeel_end", 8, 3, "endcap", 20, False),
    ("knee", 16, 16, "knee", 21, False),             # knee block sides (46 cube)
    ("knee_cap", 16, 16, "knee_cap", 22, False),     # knee block ends (lighter caps)
    ("tib1_side", 46, 8, "tib_upper", 23, True),     # upper tibia (133 x 24)
    ("tib1_end", 8, 8, "endcap", 24, False),
    ("tib2_side", 50, 7, "tib_lower", 25, True),     # lower tibia (148 x 20)
    ("tib2_end", 7, 7, "endcap", 26, False),
    ("ankle_side", 7, 8, "joint", 27, False),        # ankle block (20 x 24)
    ("ankle_end", 8, 8, "joint_cap", 28, False),
    ("foot_side", 10, 5, "foot", 29, True),          # foot (30 x 14)
    ("foot_end", 5, 5, "endcap", 30, False),
    ("claw_side", 7, 3, "claw", 31, True),           # claw (20 x 9)
    ("claw_end", 3, 3, "claw_end", 32, False),
    # ---- cephalothorax (~2.7 px per texel)
    ("tor_side", 32, 16, "plate_side", 40, False),   # main block E/W (90 x 46)
    ("tor_end", 28, 16, "plate_side", 41, False),    # main block N/S (80 x 46)
    ("tor_under", 30, 32, "under_plates", 42, False),  # main block / carapace underside
    ("tor2_side", 25, 6, "plate_side", 43, False),   # lower taper E/W (70 x 16)
    ("tor2_end", 20, 6, "plate_side", 44, False),    # lower taper N/S (56 x 16)
    ("cara_top", 32, 28, "carapace", 45, False),     # carapace top (88 x 74)
    ("cara_side", 27, 4, "rim", 46, False),          # carapace rim E/W (74 x 10)
    ("cara_end", 32, 4, "rim", 47, False),           # carapace rim N/S (88 x 10)
    ("ridge_top", 8, 20, "ridge", 48, False),        # dorsal ridge top (22 x 54)
    ("ridge_side", 20, 3, "rim", 49, False),
    ("ridge_end", 8, 3, "rim", 50, False),
    ("stern_down", 20, 25, "sternum", 51, False),    # plated underside (56 x 70)
    ("stern_side", 18, 4, "rim", 52, False),         # sternum keel sides (50 x 12)
    ("stern_end", 12, 4, "rim", 53, False),
    # ---- head (front 2 px per texel for the eyes)
    ("head_front", 26, 21, "head_front", 60, False),  # (52 x 42) eight glowing eyes
    ("head_side", 12, 16, "plate_side", 61, False),   # (30 x 42)
    ("head_top", 20, 12, "head_top", 62, False),      # (52 x 30)
    ("head_under", 20, 12, "sternum", 63, False),
    ("jaw_front", 15, 6, "jaw", 64, False),           # chelicera base (38 x 14)
    ("jaw_side", 8, 6, "jaw", 65, False),
    ("jaw_under", 15, 8, "sternum", 66, False),
    ("fang_side", 5, 12, "fang", 67, False),          # fang base (14 x 34)
    ("fang_end", 5, 5, "fang_end", 68, False),
    ("fangtip_side", 4, 10, "fangtip", 69, False),    # fang tip (9 x 26)
    ("fangtip_end", 4, 4, "fangtip_end", 70, False),
    # ---- abdomen (~2.8 px per texel)
    ("petiole", 10, 8, "joint", 80, False),
    ("abd_front", 24, 20, "abd_side", 81, False),     # front block N/S (66 x 56)
    ("abd1_side", 9, 20, "abd_side", 82, False),      # front block E/W (24 x 56)
    ("abd1_top", 26, 9, "abd_top_small", 83, False),  # front / rear block top (66..72 x 24..26)
    ("abd1_under", 26, 9, "abd_under", 84, False),
    ("abd_top", 36, 36, "abd_top", 85, False),        # main bulb top (100 x 104)
    ("abd_under", 36, 36, "abd_under", 86, False),
    ("abd_side", 36, 22, "abd_side", 87, False),      # main bulb E/W (104 x 62)
    ("abd_end", 36, 22, "abd_side", 88, False),       # main bulb N/S (100 x 62)
    ("belly_down", 29, 32, "abd_under", 89, False),   # belly underside (80 x 90)
    ("belly_side", 32, 16, "abd_belly", 90, False),   # belly E/W (90 x 44)
    ("belly_end", 29, 16, "abd_belly", 91, False),    # belly N/S (80 x 44)
    ("keel_down", 17, 21, "abd_under", 92, False),    # keel underside (48 x 60)
    ("keel_side", 21, 8, "abd_belly", 93, False),     # keel E/W (60 x 22)
    ("keel_end", 17, 8, "abd_belly", 94, False),      # keel N/S (48 x 22)
    ("abd_rear", 25, 24, "abd_side", 95, False),      # rear taper N/S (70 x 66)
    ("abd3_side", 9, 24, "abd_side", 96, False),      # rear taper E/W (26 x 66)
    ("spinner", 10, 8, "joint", 97, False),           # spinnerets
    ("abd_plate", 24, 28, "abd_plate", 98, False),    # dorsal shield (66 x 76)
    ("abd_plate_side", 26, 3, "rim", 99, False),
]


def region_list():
    """Expanded (name, w, h, style, seed, flipped) list including mirrored copies."""
    out = []
    for name, w, h, style, seed, mirror in REGIONS:
        out.append((name, w, h, style, seed, False))
        if mirror:
            out.append((name + "_f", w, h, style, seed, True))
    return out


def layout():
    """Deterministic skyline (bottom-left) packing of all regions into the atlas.

    Every region gets a 1-texel gutter on all sides (shared with neighbours); gutters are
    later filled by edge dilation so sampling slightly outside a region never hits
    unpainted texels. Returns {name: (u, v, w, h)}.
    """
    order = sorted(region_list(), key=lambda r: (-r[2], -r[1], r[0]))
    sky = [[1, 1, SIZE - 1]]
    placed = {}
    for name, w, h, _style, _seed, _f in order:
        cw, ch = w + 1, h + 1  # cell incl. right/bottom gutter
        best = None
        for i in range(len(sky)):
            x = sky[i][0]
            if x + cw > SIZE:
                break
            y, span, j = 0, 0, i
            while span < cw:
                y = max(y, sky[j][1])
                span += sky[j][2]
                j += 1
            if y + ch > SIZE:
                continue
            if best is None or (y + ch, x) < (best[0] + ch, best[1]):
                best = (y, x)
        if best is None:
            raise RuntimeError(f"atlas overflow while placing {name}")
        y, x = best
        placed[name] = (x, y, w, h)
        new = []
        for sx, sy, sw in sky:
            ex = sx + sw
            if ex <= x or sx >= x + cw:
                new.append([sx, sy, sw])
                continue
            if sx < x:
                new.append([sx, sy, x - sx])
            if ex > x + cw:
                new.append([x + cw, sy, ex - (x + cw)])
        new.append([x, y + ch, cw])
        new.sort()
        merged = []
        for seg in new:
            if merged and merged[-1][1] == seg[1] and merged[-1][0] + merged[-1][2] == seg[0]:
                merged[-1][2] += seg[2]
            else:
                merged.append(seg)
        sky = merged
    return placed


# ---------------------------------------------------------------------------- helpers
def smooth1d(rng, n, scale=3.0):
    """Smooth 1D noise in [0,1] (cosine interpolation of random knots `scale` apart)."""
    knots = max(2, int(np.ceil(n / scale)) + 2)
    k = rng.random(knots)
    xs = np.linspace(0, (n - 1) / scale, n) + rng.random() * 0.999
    i = np.floor(xs).astype(int)
    f = xs - i
    f = (1 - np.cos(f * np.pi)) / 2
    return k[i] * (1 - f) + k[i + 1] * f


def lerp(a, b, t):
    t = np.asarray(t, dtype=np.float64)[..., None]
    return a * (1 - t) + b * t


def jit(rng, shape, amount):
    return 1 + (rng.random(shape) - 0.5) * 2 * amount


def smoothstep(x):
    x = np.clip(x, 0, 1)
    return x * x * (3 - 2 * x)


def wood(w, h, rng, c0=WOOD_D, c1=WOOD_L, along_u=True, grain_lines=0.5, knots=0.0,
         worn=0.02, mid_bias=0.5):
    """Wood/plank surface: rows of grain running along the length axis.

    along_u=True: length axis = U (columns), cross axis = V (rows)."""
    L, C = (w, h) if along_u else (h, w)
    rows = smooth1d(rng, C, 1.4)                         # tone per grain row (fast across)
    slow = smooth1d(rng, L, 9.0)                         # slow tone drift along the length
    ripple = np.stack([smooth1d(rng, L, 3.0 + 3 * rng.random()) for _ in range(C)])
    t = 0.40 * rows[:, None] + 0.22 * slow[None, :] + 0.18 * ripple + 0.20 * rng.random((C, L))
    t = np.clip((t - 0.5) * 1.15 + mid_bias, 0, 1)
    img = lerp(c0, c1, t)                                # (C, L, 3)
    # wavy darker grain lines following the length
    for _ in range(int(grain_lines * C + 0.5)):
        y0 = rng.random() * (C - 1)
        amp = 0.4 + rng.random() * 0.9
        per = 10 + rng.random() * 30
        ph = rng.random() * 6.283
        gate = smooth1d(rng, L, 5.0) > 0.35
        xs = np.arange(L)
        ys = np.clip(np.round(y0 + amp * np.sin(xs / per * 6.283 + ph)), 0, C - 1).astype(int)
        f = 0.78 + 0.08 * rng.random()
        img[ys[gate], xs[gate]] *= f
    # worn lighter streaks
    for _ in range(int(worn * L * C)):
        r = rng.integers(0, C)
        c = rng.integers(0, L)
        ln = rng.integers(3, 10)
        img[r, c:c + ln] = img[r, c:c + ln] * 0.55 + WORN * 0.45
    # knots: dark core, lighter rim, stretched along the length
    for _ in range(int(knots * L * C / 100 + rng.random())):
        if C < 5 or L < 8:
            break
        ky = rng.integers(2, C - 2)
        kx = rng.integers(3, L - 3)
        img[ky, kx - 1:kx + 2] = img[ky, kx - 1:kx + 2] * 0.3 + KNOT * 0.7
        img[ky - 1, kx - 2:kx + 3] *= 1.12
        img[ky + 1, kx - 2:kx + 3] *= 0.86
        img[ky, kx - 2] *= 1.1
        img[ky, kx + 2] *= 1.1
    if not along_u:
        img = img.transpose(1, 0, 2)
    return img


def seams(img, rows, rng, along_u=True):
    """Plank seams: dark groove, the plank below catches light on its upper lip."""
    h, w, _ = img.shape
    for r in rows:
        if along_u:
            img[r, :] = img[r, :] * 0.3 + SEAM * 0.7
            if r + 1 < h:
                img[r + 1, :] *= 1.13
            if r - 1 >= 0:
                img[r - 1, :] *= 0.9
        else:
            img[:, r] = img[:, r] * 0.3 + SEAM * 0.7
            if r + 1 < w:
                img[:, r + 1] *= 1.1
            if r - 1 >= 0:
                img[:, r - 1] *= 0.9


def plank_tones(img, rows, rng, amount=0.12):
    """Each plank band between seams gets its own tone."""
    h = img.shape[0]
    edges = [0] + list(rows) + [h]
    for a, b in zip(edges[:-1], edges[1:]):
        img[a:b] *= 1 + (rng.random() - 0.5) * 2 * amount


def vgrad(img, top=1.07, bottom=0.88):
    h = img.shape[0]
    g = np.linspace(top, bottom, h)
    img *= g[:, None, None]


def ugrad(img, left=1.0, right=1.0):
    w = img.shape[1]
    g = np.linspace(left, right, w)
    img *= g[None, :, None]


def ao_end(img, n, strength, at_high_u):
    """Ambient-occlusion ramp: `strength` darkening at one U end fading over n texels."""
    w = img.shape[1]
    n = min(n, w)
    ramp = 1 - strength * (1 - smoothstep(np.arange(n) / max(n - 1, 1))) ** 1.3
    if at_high_u:
        img[:, w - n:] *= ramp[::-1][None, :, None]
    else:
        img[:, :n] *= ramp[None, :, None]


def collar(img, u0, u1, rng, color=COLLAR, mix=0.6):
    """Lighter band across the beam between columns u0..u1 with dark grooves either side."""
    w = img.shape[1]
    u0, u1 = max(0, u0), min(w, u1)
    if u1 <= u0:
        return
    img[:, u0:u1] = img[:, u0:u1] * (1 - mix) + color * mix * jit(rng, (img.shape[0], u1 - u0), 0.05)[..., None]
    if u0 - 1 >= 0:
        img[:, u0 - 1] = img[:, u0 - 1] * 0.35 + SEAM * 0.65
    if u1 < w:
        img[:, u1] = img[:, u1] * 0.35 + SEAM * 0.65
    img[:, u0] *= 1.08


def bevel(img, rng, top=BEVEL_TOP, side=BEVEL, low=BEVEL_LOW, corner=BEVEL_HI,
          inner=0.84, jitter=0.04, sides=True):
    """1-texel lighter bevel ring (upper edge brightest) + darker chamfer line inside."""
    h, w, _ = img.shape
    if h >= 5 and w >= 5 and inner:
        img[1, 1:-1] *= inner + 0.04
        img[-2, 1:-1] *= inner
        if sides:
            img[1:-1, 1] *= inner
            img[1:-1, -2] *= inner
    j = lambda n: jit(rng, (n, 1), jitter)
    img[0, :] = top * j(w)
    img[-1, :] = low * j(w)
    if sides:
        img[:, 0] = side * j(h)
        img[:, -1] = side * j(h)
        if h >= 3 and w >= 3:
            img[0, 0] = img[0, -1] = corner
            img[-1, 0] = img[-1, -1] = (corner + low) / 2


def specks(img, rng, density, inset=2, light=BRISTLE_HI, dark=BRISTLE):
    """Bristle specks: a dark dot with a tiny lit tip above it."""
    h, w, _ = img.shape
    if h <= 2 * inset or w <= 2 * inset:
        return
    count = int(round(density * (h - 2 * inset) * (w - 2 * inset)))
    for _ in range(count):
        yy = rng.integers(inset, h - inset)
        xx = rng.integers(inset, w - inset)
        img[yy, xx] = img[yy, xx] * 0.35 + dark * 0.65
        if rng.random() < 0.5 and yy - 1 >= 1:
            img[yy - 1, xx] = img[yy - 1, xx] * 0.5 + light * 0.5


def scratches(img, rng, count, dark=True):
    """Short diagonal scratches/cracks."""
    h, w, _ = img.shape
    for _ in range(count):
        if h < 5 or w < 5:
            return
        y = rng.integers(1, h - 2)
        x = rng.integers(1, w - 2)
        dx = 1 if rng.random() < 0.5 else -1
        for k in range(rng.integers(2, 5)):
            yy, xx = y + k, x + dx * k
            if 1 <= yy < h - 1 and 1 <= xx < w - 1:
                img[yy, xx] *= 0.72 if dark else 1.15


def end_grain(w, h, rng, c0=CAP_D, c1=CAP_L):
    yy, xx = np.mgrid[0:h, 0:w]
    cy = (h - 1) / 2 + (rng.random() - 0.5) * 0.8
    cx = (w - 1) / 2 + (rng.random() - 0.5) * 0.8
    r = np.sqrt((yy - cy) ** 2 + (xx - cx) ** 2)
    t = 0.5 + 0.38 * np.sin(r * 1.9 + rng.random() * 3) + 0.18 * (rng.random((h, w)) - 0.5)
    img = lerp(c0, c1, np.clip(t, 0, 1))
    # radial checks (drying cracks)
    for _ in range(max(1, (w * h) // 60)):
        a = rng.random() * 6.283
        for s in np.arange(1.0, min(w, h) / 2, 0.7):
            y = int(round(cy + np.sin(a) * s))
            x = int(round(cx + np.cos(a) * s))
            if 0 < y < h - 1 and 0 < x < w - 1:
                img[y, x] *= 0.78
    return img


# ---------------------------------------------------------------------------- painters
def plank_rows(h):
    if h >= 12:
        return [4, 8]
    if h >= 9:
        return [h // 2]
    if h >= 7:
        return [h // 2]
    return []


def p_fem(w, h, rng, face):
    """Femur long face. DISTAL (knee) end at high U, body end at low U."""
    if face == "under":
        img = wood(w, h, rng, UNDER_D, UNDER_L, grain_lines=0.6, knots=0.5)
    elif face == "top":
        img = wood(w, h, rng, WOOD_D * 0.98, WOOD_L * 0.98, grain_lines=0.6, knots=0.5)
    else:
        img = wood(w, h, rng, grain_lines=0.6, knots=0.6)
    rows = plank_rows(h)
    plank_tones(img, rows, rng)
    seams(img, rows, rng)
    if face == "side":
        vgrad(img, 1.08, 0.86)
    specks(img, rng, 0.012)
    scratches(img, rng, 3)
    # body end: hidden ~4 texels inside the torso, then occlusion fading out
    ao_end(img, 16, 0.5, at_high_u=False)
    # knee end: last ~2 texels hidden in the knee block; light collar band right before it
    collar(img, w - 9, w - 4, rng)
    ao_end(img, 3, 0.35, at_high_u=True)
    bevel(img, rng)
    return img


def p_plank(w, h, rng, face):
    """Dorsal / ventral plank stacked on the femur (symmetric along U)."""
    if face == "under":
        img = wood(w, h, rng, UNDER_D * 1.02, UNDER_L * 1.02, grain_lines=0.6, knots=0.4)
    else:
        img = wood(w, h, rng, WOOD_D * 1.03, WOOD_L * 1.03, grain_lines=0.6, knots=0.4)
    if h >= 7:
        seams(img, [h // 2], rng)
    if face == "side":
        vgrad(img, 1.1, 0.9)
    specks(img, rng, 0.01)
    ao_end(img, 3, 0.25, at_high_u=False)
    ao_end(img, 3, 0.25, at_high_u=True)
    bevel(img, rng, inner=0.86 if h >= 5 else 0)
    return img


def p_tib(w, h, rng, upper):
    """Tibia long face. Knee end at LOW U, ankle end at high U (distal)."""
    img = wood(w, h, rng, grain_lines=0.7, knots=0.4, worn=0.03)
    rows = [h // 2] if h >= 7 else []
    plank_tones(img, rows, rng, 0.08)
    seams(img, rows, rng)
    # cylindrical-ish shading across the beam (the tibia hangs vertically: V runs sideways)
    v = np.linspace(-1, 1, h)
    img *= (1.04 - 0.12 * v ** 2)[:, None, None]
    specks(img, rng, 0.015)
    scratches(img, rng, 2)
    if upper:
        # first ~8 texels sit inside the knee block; light collar just below the knee
        ao_end(img, 10, 0.3, at_high_u=False)
        collar(img, 6, 11, rng)
        ugrad(img, 1.04, 0.97)
    else:
        # lower tibia: darker, dirtier toward the ankle
        ugrad(img, 0.98, 0.84)
        ao_end(img, 6, 0.35, at_high_u=True)
        ao_end(img, 3, 0.25, at_high_u=False)
    bevel(img, rng)
    return img


def p_endcap(w, h, rng):
    img = end_grain(w, h, rng)
    bevel(img, rng, top=BEVEL_TOP * 1.04, side=BEVEL * 1.02, low=BEVEL, inner=0.86)
    return img


def p_knee(w, h, rng):
    """Big angular knee block: dark weathered block with crisp light bevel and a cross
    plate seam, darker toward the middle (occluded by the beams entering it)."""
    img = wood(w, h, rng, JOINT_D, JOINT_M * 1.08, grain_lines=0.5, worn=0.03)
    yy, xx = np.mgrid[0:h, 0:w]
    r = np.maximum(np.abs(yy - (h - 1) / 2), np.abs(xx - (w - 1) / 2)) / ((min(h, w) - 1) / 2)
    img *= (0.9 + 0.12 * r)[..., None]
    c = h // 2
    seams(img, [c], rng)                                    # horizontal plate seam
    img[2:-2, w // 2] = img[2:-2, w // 2] * 0.4 + SEAM * 0.6  # vertical seam
    img[2:-2, w // 2 + 1] *= 1.1
    specks(img, rng, 0.03)
    scratches(img, rng, 3)
    # inner raised plate outline (2 texels in)
    img[2, 2:-2] *= 1.12
    img[2:-2, 2] *= 1.08
    img[-3, 2:-2] *= 0.85
    img[2:-2, -3] *= 0.88
    bevel(img, rng, top=JOINT_BEVEL * 1.18, side=JOINT_BEVEL * 1.08, low=JOINT_BEVEL,
          corner=BEVEL_TOP, inner=0.8)
    return img


def p_knee_cap(w, h, rng):
    img = end_grain(w, h, rng, CAP_D * 0.96, CAP_L)
    # cap plate: inner square slightly darker -> reads as a lighter rim/cap
    img[3:-3, 3:-3] *= 0.92
    img[3, 3:-3] *= 0.85
    img[3:-3, 3] *= 0.88
    bevel(img, rng, top=BEVEL_HI, side=BEVEL_TOP, low=BEVEL, corner=BEVEL_HI, inner=0.86)
    return img


def p_joint(w, h, rng):
    img = lerp(JOINT_D, JOINT_M, 0.55 * rng.random((h, w)) + 0.45 * smooth1d(rng, w, 2.5)[None, :])
    if h >= 6:
        seams(img, [h // 2], rng)
    specks(img, rng, 0.04)
    bevel(img, rng, top=JOINT_BEVEL * 1.12, side=JOINT_BEVEL, low=JOINT_BEVEL * 0.92,
          corner=BEVEL_TOP, inner=0.82)
    return img


def p_joint_cap(w, h, rng):
    img = end_grain(w, h, rng, JOINT_M, CAP_D)
    bevel(img, rng, top=BEVEL, side=JOINT_BEVEL * 1.1, low=JOINT_BEVEL, inner=0.85)
    return img


def p_foot(w, h, rng):
    img = wood(w, h, rng, WOOD_D * 0.92, WOOD_M, grain_lines=0.5, worn=0.0)
    ugrad(img, 1.0, 0.78)                 # darker toward the claw
    bevel(img, rng, inner=0.86 if h >= 5 else 0)
    return img


def p_claw(w, h, rng):
    t = np.linspace(0, 1, w)[None, :] * np.ones((h, 1))
    img = lerp(JOINT_M, BRISTLE, np.clip(t * 0.9 + 0.1 * rng.random((h, w)), 0, 1))
    img[0, :] = lerp(JOINT_BEVEL, JOINT_M, t[0] * 0.8)
    img[-1, :] *= 0.85
    return img


def p_claw_end(w, h, rng):
    img = lerp(BRISTLE, JOINT_D, rng.random((h, w)))
    img[0, :] = JOINT_BEVEL * 0.9
    return img


def p_plate_side(w, h, rng):
    """Chitin side plate: vertical plate seams, top-lit gradient, light bevel."""
    img = wood(w, h, rng, CHIT_D, CHIT_L, grain_lines=0.3, worn=0.01, mid_bias=0.5)
    n = max(1, w // 9)
    for i in range(1, n + 1):
        x = int(round(i * w / (n + 1)))
        img[2:-1, x] = img[2:-1, x] * 0.35 + SEAM * 0.65
        img[2:-1, min(w - 1, x + 1)] *= 1.1
    if h >= 10:
        seams(img, [h // 3], rng)
    vgrad(img, 1.1, 0.85)
    specks(img, rng, 0.03)
    scratches(img, rng, max(1, w * h // 120))
    bevel(img, rng, top=CHIT_BEVEL * 1.12, side=CHIT_BEVEL, low=CHIT_BEVEL * 0.92,
          corner=BEVEL_TOP, inner=0.84)
    return img


def p_rim(w, h, rng):
    img = wood(w, h, rng, CHIT_M, CHIT_L * 1.05, grain_lines=0.4, worn=0.02)
    vgrad(img, 1.08, 0.9)
    bevel(img, rng, top=BEVEL_TOP, side=BEVEL, low=BEVEL_LOW, inner=0.86 if h >= 5 else 0)
    return img


def p_under_plates(w, h, rng):
    img = lerp(UNDER_D * 0.92, UNDER_L * 0.95, 0.5 * rng.random((h, w)) + 0.5 * smooth1d(rng, h, 4)[:, None])
    for yy in range(4, h - 2, 5):          # transverse plate seams with lit lips
        img[yy, 1:-1] = img[yy, 1:-1] * 0.3 + SEAM * 0.7
        img[yy + 1, 1:-1] *= 1.1
    cx = w // 2
    img[1:-1, cx] = img[1:-1, cx] * 0.5 + SEAM * 0.5
    specks(img, rng, 0.03)
    bevel(img, rng, top=CHIT_BEVEL, side=CHIT_BEVEL, low=CHIT_BEVEL * 0.95, inner=0.85)
    return img


def p_carapace(w, h, rng):
    # U = width (X), V = length (Z). Median groove, fovea pit, radial striations, rim.
    img = wood(w, h, rng, CHIT_D, CHIT_L, along_u=False, grain_lines=0.2, worn=0.01)
    cx = (w - 1) / 2
    fy = h * 0.42
    yy, xx = np.mgrid[0:h, 0:w]
    ang = np.arctan2(yy - fy, xx - cx)
    rr = np.hypot((yy - fy) * 1.1, xx - cx)
    stri = (np.cos(ang * 10) > 0.8) & (rr > 3) & (rr < min(w, h) * 0.48)
    img[stri] *= 0.8
    img[np.cos(ang * 10 - 0.6) > 0.9] *= 1.06
    dome = 1.12 - 0.25 * np.clip(rr / (min(w, h) * 0.55), 0, 1)
    img *= dome[..., None]
    img[1:-1, int(np.floor(cx))] = img[1:-1, int(np.floor(cx))] * 0.4 + SEAM * 0.6
    img[1:-1, int(np.ceil(cx)) + 1] *= 1.1
    fy_i = int(fy)
    img[fy_i - 1:fy_i + 2, int(cx) - 1:int(np.ceil(cx)) + 2] = SEAM * 0.8
    specks(img, rng, 0.025)
    bevel(img, rng, top=CHIT_BEVEL * 1.15, side=CHIT_BEVEL * 1.1, low=CHIT_BEVEL, corner=BEVEL_TOP,
          inner=0.82)
    return img


def p_ridge(w, h, rng):
    img = wood(w, h, rng, CHIT_M, CHIT_L * 1.08, along_u=False, grain_lines=0.3)
    cx = w // 2
    img[1:-1, cx] = img[1:-1, cx] * 0.5 + BEVEL_TOP * 0.5      # crest line
    for yy in range(3, h - 1, 4):
        img[yy, 1:-1] = img[yy, 1:-1] * 0.4 + SEAM * 0.6       # segment notches
        img[yy + 1, 1:-1] *= 1.1
    bevel(img, rng, inner=0.85)
    return img


def p_sternum(w, h, rng):
    img = lerp(UNDER_D, UNDER_L, rng.random((h, w)) * 0.55 + 0.45 * smooth1d(rng, h, 3)[:, None])
    for yy in range(3, h - 1, 4):
        img[yy, 1:-1] = img[yy, 1:-1] * 0.35 + SEAM * 0.65
        img[yy + 1, 1:-1] *= 1.1
    cx = (w - 1) / 2
    img[1:-1, int(np.floor(cx))] *= 0.8
    specks(img, rng, 0.03)
    bevel(img, rng, top=CHIT_BEVEL, side=CHIT_BEVEL, low=CHIT_BEVEL * 0.95, inner=0.86)
    return img


def p_head_top(w, h, rng):
    img = wood(w, h, rng, CHIT_D, CHIT_L, along_u=False, grain_lines=0.3)
    cx = (w - 1) / 2
    img[1:-1, int(np.floor(cx))] *= 0.75
    img[1:-1, int(np.ceil(cx))] *= 0.75
    # two small raised tubercles where the eye cluster begins (front edge = low V? keep symmetric)
    specks(img, rng, 0.04)
    bevel(img, rng, top=CHIT_BEVEL * 1.12, side=CHIT_BEVEL, low=CHIT_BEVEL, corner=BEVEL_TOP)
    return img


# Eye layout on the 26x21 head front region (x, y, w, h, kind). Upper half of the face,
# 8 eyes: two large anterior medians, two anterior laterals, two posterior medians,
# two posterior laterals (posterior row higher and wider, like a real spider).
EYES = [
    (9, 7, 3, 3, "big"), (14, 7, 3, 3, "big"),          # anterior median (largest)
    (5, 9, 2, 2, "mid"), (19, 9, 2, 2, "mid"),          # anterior laterals
    (8, 3, 2, 2, "mid"), (16, 3, 2, 2, "mid"),          # posterior medians
    (3, 5, 2, 2, "mid"), (21, 5, 2, 2, "mid"),          # posterior laterals
]


def p_head_front(w, h, rng):
    img = wood(w, h, rng, CHIT_D, CHIT_L, grain_lines=0.3, worn=0.01)
    vgrad(img, 1.1, 0.88)
    # brow ridge above the eyes and a darker face below
    img[1, 2:-2] *= 1.12
    img[13:, :] *= 0.9
    specks(img, rng, 0.03)
    bevel(img, rng, top=CHIT_BEVEL * 1.12, side=CHIT_BEVEL, low=CHIT_BEVEL * 0.9, corner=BEVEL_TOP)
    alpha = np.full((h, w), 255, np.uint8)
    # dark sockets with a faint lit rim above each eye
    for x, y, ew, eh, _k in EYES:
        img[max(1, y - 1):min(h - 1, y + eh + 1), max(1, x - 1):min(w - 1, x + ew + 1)] = SOCKET
        if y - 2 >= 1:
            img[y - 2, max(1, x - 1):min(w - 1, x + ew + 1)] *= 1.15
    for x, y, ew, eh, kind in EYES:
        img[y:y + eh, x:x + ew] = EYE
        img[y + eh - 1, x:x + ew] = EYE_DARK * 1.3          # lower half darker
        img[y, x] = EYE_HI                                   # glint
        if kind == "big":
            img[y + 1, x + 1] = EYE_HI * 0.85 + EYE * 0.15
            img[y + eh - 1, x + ew - 1] = EYE_DARK
        alpha[y:y + eh, x:x + ew] = EYE_ALPHA
    # chelicera seam + mouth plate along the lower part
    img[h - 4, 4:w - 4] = img[h - 4, 4:w - 4] * 0.3 + SEAM * 0.7
    img[h - 3, 4:w - 4] *= 1.1
    img[h - 4:h - 1, w // 2] = SEAM
    return img, alpha


def p_jaw(w, h, rng):
    img = wood(w, h, rng, JOINT_D, JOINT_M, grain_lines=0.3, worn=0.0)
    vgrad(img, 1.1, 0.85)
    img[1:-1, w // 2] = img[1:-1, w // 2] * 0.5 + SEAM * 0.5
    bevel(img, rng, top=JOINT_BEVEL * 1.15, side=JOINT_BEVEL, low=JOINT_BEVEL * 0.9,
          inner=0.85 if h >= 5 else 0)
    return img


def p_fang(w, h, rng):
    t = np.linspace(0, 1, h)[:, None] * np.ones((1, w))
    img = lerp(FANG0, FANG_TIP * 0.85, np.clip(t * 0.7 + 0.12 * rng.random((h, w)), 0, 1))
    img[:, 0] = lerp(JOINT_BEVEL, FANG_TIP, t[:, 0] * 0.6)
    img[:, -1] *= 0.75
    img[0, :] = JOINT_BEVEL
    for yy in range(3, h - 2, 3):                        # ribbing
        img[yy, 1:-1] *= 0.8
    return img


def p_fang_end(w, h, rng):
    img = lerp(FANG0, JOINT_M, rng.random((h, w)))
    bevel(img, rng, top=JOINT_BEVEL, side=JOINT_BEVEL, low=JOINT_BEVEL * 0.9, inner=0)
    return img


def p_fangtip(w, h, rng):
    t = np.linspace(0, 1, h)[:, None] * np.ones((1, w))
    img = lerp(FANG_TIP, SOCKET, np.clip(t * 0.95 + 0.1 * rng.random((h, w)), 0, 1))
    img[:, 0] = img[:, 0] * 0.5 + hexc("#b0584a") * 0.5 * (1 - t[:, 0])[:, None]
    return img


def p_fangtip_end(w, h, rng):
    return lerp(SOCKET, FANG_TIP * 0.7, rng.random((h, w)) * 0.6)


def abd_base(w, h, rng, lighten=0.0):
    t = (0.40 * rng.random((h, w))
         + 0.35 * smooth1d(rng, w, 3.5)[None, :] * smooth1d(rng, h, 3.5)[:, None]
         + 0.25 * smooth1d(rng, h, 6)[:, None])
    img = lerp(ABD_D, ABD_L, np.clip(t * 1.1, 0, 1))
    if lighten:
        img = img * (1 - lighten) + UNDER_L * lighten
    return img


def p_abd_side(w, h, rng, belly=False):
    # U = horizontal, V = downward. Segment plates (horizontal lines curving slightly),
    # pale lateral dashes, top-lit gradient, lighter toward the belly.
    img = abd_base(w, h, rng)
    v = np.linspace(0, 1, h)[:, None, None]
    lift = 0.25 + 0.55 * v if belly else 0.45 * v ** 2
    img = img * (1 - lift) + UNDER_D * lift
    step = 4 if belly else 5
    for yy in range(step, h - 1, step):
        bend = np.round(0.8 * np.sin(np.linspace(0, np.pi, w))).astype(int)
        ys = np.clip(yy - bend, 1, h - 2)
        xs = np.arange(w)
        img[ys, xs] = img[ys, xs] * 0.35 + SEAM * 0.65
        img[np.clip(ys + 1, 1, h - 2), xs] *= 1.12
    # pale lateral dashes (folium edge) on the upper band
    if not belly and h >= 12:
        for x in range(3, w - 3, 6):
            y = 3 + (x // 6) % 2
            img[y, x:x + 3] = img[y, x:x + 3] * 0.4 + FOLIUM * 0.6
    vgrad(img, 1.08, 0.9)
    specks(img, rng, 0.035)
    bevel(img, rng, top=CHIT_BEVEL * 1.08, side=CHIT_BEVEL, low=CHIT_BEVEL * 0.92, corner=BEVEL_TOP,
          inner=0.85)
    return img


def p_abd_top(w, h, rng, small=False):
    # U = width (X), V = length (Z). Folium: pale chevrons pointing forward + dark heart mark.
    img = abd_base(w, h, rng)
    cx = (w - 1) / 2
    yy, xx = np.mgrid[0:h, 0:w]
    dist = np.abs(xx - cx)
    step = 4 if small else 6
    for k in range(2, h + 4, step):
        chev = (np.abs((yy - k) + dist * 0.55) < 0.75) & (dist > 1.2) & (dist < cx - 1.5)
        img[chev] = img[chev] * 0.35 + FOLIUM * 0.65
        below = (np.abs((yy - k - 1) + dist * 0.55) < 0.6) & (dist > 1.2) & (dist < cx - 1.5)
        img[below & ~chev] *= 0.82
    heart = (dist < 2.0) & (yy > 1) & (yy < h * (0.55 if not small else 0.9))
    img[heart] = img[heart] * 0.5 + SEAM * 0.5
    img[(np.abs(dist - 2.5) < 0.5) & heart.any()] *= 1.0
    # dome shading: lighter crown, darker flanks
    img *= (1.1 - 0.22 * (dist / max(cx, 1)) ** 2)[..., None]
    specks(img, rng, 0.03)
    bevel(img, rng, top=CHIT_BEVEL * 1.08, side=CHIT_BEVEL, low=CHIT_BEVEL, corner=BEVEL_TOP,
          inner=0.85)
    return img


def p_abd_under(w, h, rng):
    img = lerp(UNDER_D * 0.95, UNDER_L, 0.55 * rng.random((h, w)) + 0.45 * smooth1d(rng, w, 4)[None, :])
    for yy in range(3, h - 1, 4):
        img[yy, 1:-1] = img[yy, 1:-1] * 0.4 + SEAM * 0.6
        img[yy + 1, 1:-1] *= 1.1
    cx = w // 2
    img[1:-1, cx - 1:cx + 1] *= 0.85                  # epigastric furrow / midline
    specks(img, rng, 0.03)
    bevel(img, rng, top=CHIT_BEVEL * 1.05, side=CHIT_BEVEL, low=CHIT_BEVEL, inner=0.86)
    return img


def p_abd_plate(w, h, rng):
    img = p_abd_top(w, h, rng)
    img[2, 2:-2] *= 1.12
    img[2:-2, 2] *= 1.08
    img[-3, 2:-2] *= 0.85
    img[2:-2, -3] *= 0.88
    bevel(img, rng, top=BEVEL_TOP, side=BEVEL, low=BEVEL_LOW, corner=BEVEL_HI, inner=0.8)
    return img


PAINTERS = {
    "fem_side": lambda w, h, r: p_fem(w, h, r, "side"),
    "fem_top": lambda w, h, r: p_fem(w, h, r, "top"),
    "fem_under": lambda w, h, r: p_fem(w, h, r, "under"),
    "plank_top": lambda w, h, r: p_plank(w, h, r, "top"),
    "plank_side": lambda w, h, r: p_plank(w, h, r, "side"),
    "plank_under": lambda w, h, r: p_plank(w, h, r, "under"),
    "tib_upper": lambda w, h, r: p_tib(w, h, r, True),
    "tib_lower": lambda w, h, r: p_tib(w, h, r, False),
    "endcap": p_endcap,
    "knee": p_knee,
    "knee_cap": p_knee_cap,
    "joint": p_joint,
    "joint_cap": p_joint_cap,
    "foot": p_foot,
    "claw": p_claw,
    "claw_end": p_claw_end,
    "plate_side": p_plate_side,
    "rim": p_rim,
    "under_plates": p_under_plates,
    "carapace": p_carapace,
    "ridge": p_ridge,
    "sternum": p_sternum,
    "head_top": p_head_top,
    "head_front": p_head_front,
    "jaw": p_jaw,
    "fang": p_fang,
    "fang_end": p_fang_end,
    "fangtip": p_fangtip,
    "fangtip_end": p_fangtip_end,
    "abd_side": p_abd_side,
    "abd_belly": lambda w, h, r: p_abd_side(w, h, r, belly=True),
    "abd_top": p_abd_top,
    "abd_top_small": lambda w, h, r: p_abd_top(w, h, r, small=True),
    "abd_under": p_abd_under,
    "abd_plate": p_abd_plate,
}


def build():
    """Return (rgba uint8 array SIZExSIZEx4, layout dict, painted-mask)."""
    lay = layout()
    rgb = np.zeros((SIZE, SIZE, 3), np.float64)
    alpha = np.full((SIZE, SIZE), 255, np.uint8)
    painted = np.zeros((SIZE, SIZE), bool)
    for name, w, h, style, seed, flipped in region_list():
        u, v, _w, _h = lay[name]
        rng = np.random.default_rng(seed * 7919 + 17)
        out = PAINTERS[style](w, h, rng)
        if isinstance(out, tuple):
            img, a = out
        else:
            img, a = out, np.full((h, w), 255, np.uint8)
        if flipped:
            img, a = img[:, ::-1], a[:, ::-1]
        rgb[v:v + h, u:u + w] = img
        alpha[v:v + h, u:u + w] = a
        painted[v:v + h, u:u + w] = True
    # gutters: 2 rings of edge dilation around every region, so sampling slightly outside a
    # region (float precision, mip-mapping) repeats its edge colour; unused space -> base.
    filled = painted.copy()
    for _ in range(2):
        nf = filled.copy()
        acc = np.zeros_like(rgb)
        cnt = np.zeros((SIZE, SIZE))
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            src_f = np.roll(filled, (dy, dx), axis=(0, 1))
            src_c = np.roll(rgb, (dy, dx), axis=(0, 1))
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
    rgb[~filled] = WOOD_M
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


def check_layout(lay):
    """Regions must lie inside the atlas and never overlap (gutters included)."""
    occ = np.zeros((SIZE, SIZE), np.int32)
    for name, (u, v, w, h) in lay.items():
        if u < 1 or v < 1 or u + w > SIZE - 1 or v + h > SIZE - 1:
            raise SystemExit(f"region {name} touches the atlas border")
        occ[v:v + h, u:u + w] += 1
    if occ.max() > 1:
        raise SystemExit("overlapping atlas regions")


def main():
    rgba, lay, painted = build()
    check_layout(lay)
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    Image.fromarray(rgba, "RGBA").save(OUT, optimize=True)
    a = rgba[..., 3]
    vals, counts = np.unique(a, return_counts=True)
    hist = {int(k): int(c) for k, c in zip(vals, counts)}
    used = int(painted.sum())
    print(f"wrote {os.path.relpath(OUT, ROOT)}  {SIZE}x{SIZE}  regions={len(lay)} "
          f"painted={used}/{SIZE * SIZE} ({100.0 * used / SIZE / SIZE:.1f}%)  alpha={hist}")
    expected = {255, EYE_ALPHA}
    if set(hist) - expected:
        sys.exit(f"unexpected alpha values {sorted(set(hist) - expected)}")
    if hist.get(EYE_ALPHA, 0) != len(eye_texels(lay)):
        sys.exit("eye texel count mismatch")


if __name__ == "__main__":
    main()
