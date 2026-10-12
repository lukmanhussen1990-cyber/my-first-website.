#!/usr/bin/env python3
"""Generate the Giant Spider Hunter entity texture (docs/VISUAL_PLAN.md T1-T5).

Output: packs/GiantSpiderHunter_RP/textures/entity/giant_spider/giant_spider.png (256x256 RGBA)

The texture is an atlas of named rectangular *regions*. Each region is painted for one
kind of surface (femur side, tibia underside, knee block, end face, carapace, abdomen,
head front with eyes, ...). The geometry generator (tools/gen_geometry.py) imports
`layout()` from this module and maps every cube face onto one of these regions with
per-face UVs, so both files always agree. Region names and leg sizes are the contract of
VISUAL_PLAN.md T3 (legs ~2.4-2.8 model px per texel); the body uses the same ~2.6 px per
texel so the whole creature has one texel size (head front 2.3 so the eyes stay crisp).

Look (ref_thumbnail.jpg close-up of the legs): clean stripped-wood beams.
  * legs: smooth warm brown (#7d6250) with 3-4 soft lengthwise grain stripes, a slow tone
    drift along the length, at most 3 long dark streaks per face, a light tan band just
    outside each joint block (1-texel darker borders), a 1-texel dark edge line on every
    beam edge, flat end faces with a lighter centre. No specks, seams, knots, end-grain
    rings, light bevels or bristles;
  * big knee / ankle blocks: slightly darker wood with one tan band and flat caps;
  * baked light that survives shader-less Bedrock: top quarter of a side face x1.06,
    bottom quarter x0.92, `*_under` regions x1.18 (Bedrock shades bottom faces dark),
    femur darkened toward the body (ambient occlusion);
  * body: darker chitin (#5c4636) with a few straight plate seams and faint radial grooves
    on the carapace, abdomen with 3-4 faint forward-pointing chevrons, plain light undersides;
  * eyes: small deep-red eyes (#a60202 / highlight #ff0e0e) with ALPHA = 3 so the vanilla
    `spider` material makes them glow; every other texel alpha 255.

Hue check (VISUAL_PLAN T1): R-G about 25-30 and G-B about 15-20 on the leg wood, which reads
warm brown instead of the old mauve-grey (G-B about 5).

Mirrored regions: a region declared with mirror=True is also emitted as `<name>_f`
(horizontally flipped). Long limb faces are painted with their DISTAL end at high U;
gen_geometry.py picks `<name>` or `<name>_f` per face so the distal end (knee, foot) of
every leg -- left or right, north or south face -- gets the same treatment, and the tan
bands are placed by U fraction.

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


# ---------------------------------------------------------------------------- palette (T1)
WOOD_M = hexc("#7d6250")     # leg base
WOOD_D = hexc("#6e5442")     # dark grain stripe
WOOD_L = hexc("#8f735c")     # light grain stripe
STREAK = hexc("#654c3c")     # rare long dark streak
EDGE = hexc("#4a3628")       # 1-texel outline on every long edge and end column
TAN = hexc("#b8997a")        # joint band
TAN_EDGE = hexc("#8a6c55")   # 1-texel border on both sides of each band
END_FACE = hexc("#5e4636")   # E/W end faces (flat, no rings)
END_C = hexc("#6a503e")      # lighter centre of an end face
KNEE = hexc("#735a48")       # knee and ankle blocks
KNEE_CAP = hexc("#6a503e")   # knee / ankle caps (E/W)
CHIT_M = hexc("#5c4636")     # cephalothorax, head
CHIT_D = hexc("#4e3a2e")
CHIT_L = hexc("#6b5240")
ABD_M = hexc("#584233")      # abdomen
ABD_D = hexc("#4a372c")      # abdomen dark / folium chevrons
ABD_L = hexc("#674e3d")
UNDER_D = hexc("#82664f")    # sternum, abdomen underside
UNDER_L = hexc("#957660")
FANG = hexc("#2c2022")
FANG_TIP = hexc("#6e2a20")
EYE = hexc("#a60202")
EYE_HI = hexc("#ff0e0e")
SOCKET = hexc("#1a0e0a")

# ---------------------------------------------------------------------------- regions (T3)
# (name, width_texels, height_texels, style, seed, mirror)
# Orientation convention used by gen_geometry.py (verified with the viewer's UV mapping):
#   north/south faces: U = cube X extent, V = cube Y extent (top of region = top of face)
#   east/west faces:   U = cube Z extent, V = cube Y extent
#   up/down faces:     U = cube X extent, V = cube Z extent
#   on north/up/down faces U grows toward +X, on south faces toward -X.
# Limb regions: DISTAL end (toward the foot) at high U; `<name>_f` is the mirror image.
REGIONS = [
    # ---- legs (shared by all eight legs; sized for the k = 1.00 pair, ~2.4-2.8 px per texel)
    # Names and sizes follow docs/VISUAL_PLAN.md T3 (the contract with gen_geometry.py).
    # femur bone: coxa collar + femur beam + knee block
    ("coxa_side", 16, 18, "coxa", 110, True),       # coxa collar N/S/U/D (40 x 46)
    ("coxa_end", 18, 18, "cap", 111, False),        # (46 x 46)
    ("fem_side", 64, 15, "fem_side", 11, True),     # femur beam N/S (152 x 38)
    ("fem_top", 64, 14, "fem_top", 12, True),       # femur beam up (152 x 36)
    ("fem_under", 64, 14, "fem_under", 13, True),   # femur beam down (seen from below: lighter)
    ("fem_end", 14, 15, "end", 14, False),          # (36 x 38)
    ("knee", 18, 18, "block", 21, False),           # knee block N/S/U/D (46 cube)
    ("knee_cap", 18, 18, "cap", 22, False),         # knee block E/W
    # tibia bone: tibia beam + tibia/metatarsus joint block
    ("tib_side", 96, 10, "tib_side", 23, True),     # tibia N/S/U (244 x 26)
    ("tib_under", 96, 10, "tib_under", 24, True),   # tibia down
    ("tib_end", 10, 10, "end", 25, False),
    ("ankle_side", 13, 13, "block", 27, False),     # joint block N/S/U/D (32 cube)
    ("ankle_end", 13, 13, "cap", 28, False),
    # foot bone: metatarsus + tarsus + hooked claw
    ("met_side", 70, 8, "met_side", 29, True),      # metatarsus N/S/U (170 x 20)
    ("met_under", 70, 8, "met_under", 30, True),    # metatarsus down
    ("met_end", 8, 8, "end", 31, False),
    ("tar_side", 12, 6, "tarsus", 32, True),        # tarsus (29 x 14)
    ("tar_end", 6, 6, "end", 33, False),
    ("claw_side", 6, 4, "claw", 34, True),          # claw (12 x 9)
    ("claw_end", 4, 4, "claw_end", 35, False),
    # ---- cephalothorax (body x1.15; sizes in px are after scaling)
    ("tor_side", 39, 20, "tor_side", 40, False),     # main block E/W (101 x 53)
    ("tor_end", 35, 20, "tor_side", 41, False),      # main block N/S (92 x 53)
    ("tor_under", 36, 36, "under", 42, False),       # main block / taper / carapace underside
    ("tor2_side", 31, 7, "tor_low", 43, False),      # lower taper E/W (81 x 18)
    ("tor2_end", 25, 7, "tor_low", 44, False),       # lower taper N/S (64 x 18)
    ("cara_top", 40, 33, "carapace", 45, False),     # carapace top (104 x 85)
    ("cara_side", 33, 4, "rim", 46, False),          # carapace rim E/W (85 x 11.5)
    ("cara_end", 40, 4, "rim", 47, False),           # carapace rim N/S (104 x 11.5)
    ("ridge_top", 10, 24, "ridge", 48, False),       # thoracic ridge top (25 x 62)
    ("ridge_side", 24, 3, "rim", 49, False),
    ("ridge_end", 10, 3, "rim", 50, False),
    ("stern_down", 22, 27, "under", 51, False),      # sternum keel + taper underside
    ("stern_side", 23, 5, "under_side", 52, False),  # sternum keel sides (60 x 14)
    ("stern_end", 16, 5, "under_side", 53, False),
    # ---- head (front ~2.3 px per texel so the eyes stay crisp)
    ("head_front", 27, 24, "head_front", 60, False),  # (62 x 55) anterior lateral eyes + AME sockets
    ("head_side", 13, 21, "head_side", 61, False),    # (35 x 55)
    ("head_top", 24, 13, "head_top", 62, False),      # (62 x 35)
    ("head_under", 24, 13, "under", 63, False),
    ("mound_front", 17, 6, "mound_front", 114, False),  # eye mound front (39 x 14), 4 eyes
    ("mound_side", 8, 5, "chitin", 115, False),         # (21 x 14)
    ("mound_top", 15, 8, "chitin", 116, False),         # (39 x 21)
    ("eye_bump", 4, 4, "eye_bump", 117, False),         # anterior median eye lens (8 x 8)
    ("bump_side", 4, 2, "bump_side", 118, False),       # (8 x 4.6)
    ("palp_long", 16, 4, "palp", 119, False),           # pedipalp segment, long faces (44 x 11.5)
    ("palp_vert", 4, 15, "palp_v", 120, False),         # pedipalp, long faces of the hanging segment
    ("palp_end", 4, 4, "palp_end", 121, False),
    ("chel_front", 8, 15, "chel_front", 122, False),    # chelicera (21 x 39 x 28)
    ("chel_side", 11, 15, "chel_side", 123, False),
    ("chel_end", 8, 11, "chel_end", 124, False),
    ("fang_side", 5, 12, "fang", 67, False),          # fang base (10 x 18)
    ("fang_end", 5, 5, "fang_end", 68, False),
    ("fangtip_side", 4, 10, "fangtip", 69, False),    # fang tip (7 x 16)
    ("fangtip_end", 4, 4, "fangtip_end", 70, False),
    # ---- abdomen (body x1.15; ~2.6 px per texel)
    ("petiole", 12, 9, "petiole", 80, False),
    ("abd_front", 29, 25, "abd_side", 81, False),     # front block N/S (76 x 64)
    ("abd1_side", 11, 25, "abd_side", 82, False),     # front block E/W (28 x 64)
    ("abd1_top", 30, 11, "abd_top_small", 83, False),  # front / rear block top
    ("abd1_under", 30, 11, "under", 84, False),
    ("abd_top", 44, 44, "abd_top", 85, False),        # main bulb + rounding slab top (115 x 120)
    ("abd_under", 44, 44, "under", 86, False),
    ("abd_side", 44, 27, "abd_side", 87, False),      # main bulb + slab E/W (120 x 71)
    ("abd_end", 44, 27, "abd_side", 88, False),       # main bulb N/S (115 x 71)
    ("belly_down", 35, 39, "under", 89, False),       # belly underside (92 x 104)
    ("belly_side", 39, 14, "abd_belly", 90, False),   # belly E/W (104 x 37)
    ("belly_end", 35, 14, "abd_belly", 91, False),    # belly N/S (92 x 37)
    ("keel_down", 21, 26, "under", 92, False),        # keel underside (55 x 69)
    ("keel_side", 26, 7, "under_side", 93, False),    # keel E/W (69 x 18)
    ("keel_end", 21, 7, "under_side", 94, False),     # keel N/S (55 x 18)
    ("abd_rear", 31, 29, "abd_side", 95, False),      # rear taper N/S (81 x 76)
    ("abd3_side", 11, 29, "abd_side", 96, False),     # rear taper E/W (30 x 76)
    ("abd_plate", 29, 33, "abd_plate", 98, False),    # dorsal shield (76 x 87)
    ("abd_plate_side", 31, 3, "abd_rim", 99, False),
    ("spin_side", 9, 5, "spin", 127, False),          # spinneret (10 x 14 x 23)
    ("spin_end", 4, 5, "spin_end", 128, False),
    ("spin_top", 4, 9, "spin_v", 129, False),
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


def smoothstep(x):
    x = np.clip(x, 0, 1)
    return x * x * (3 - 2 * x)


def flat(w, h, color):
    img = np.empty((h, w, 3))
    img[:] = color
    return img


def mix(a, b, t):
    """Blend colour/image `a` toward `b` by t (scalar or broadcastable)."""
    return a * (1 - t) + b * t


def tone_color(t, mid, dark, light):
    """Map a tone field to colours: -1 = dark, 0 = mid, +1 = light (extrapolated a little
    beyond the ends so a hairline crossing a dark stripe reads as a deeper grain line)."""
    t = np.clip(t, -1.5, 1.2)[..., None]
    return np.where(t >= 0, mid + t * (light - mid), mid - t * (dark - mid))


def _stripe(tone, rng, w, h, hgt, val, steps, fade=(0.7, 0.3)):
    r0 = int(rng.integers(1, max(2, h - hgt)))
    inten = fade[0] + fade[1] * smooth1d(rng, w, 18.0)
    rows = np.arange(r0, min(h - 1, r0 + hgt))
    if steps and w >= 24 and rng.random() < 0.45:
        u0 = int(rng.integers(w // 4, 3 * w // 4))
        d = 1 if rng.random() < 0.5 else -1
        tone[rows, :u0] += val * inten[None, :u0]
        rows2 = np.clip(rows + d, 1, h - 2)
        tone[rows2, u0:] += val * inten[None, u0:]
    else:
        tone[rows, :] += val * inten[None, :]


def grain(w, h, rng, stripes=None, steps=True, hairlines=None, weather=0.5):
    """Lengthwise wood grain as a tone field (h, w), about [-1.5, 1.2]; the length axis is U.

    * a gentle row-to-row tone from smooth 1-D noise across the rows;
    * 3-4 grain stripes (1-3 texels high, alternating dark / light), each fading slowly
      along U (period >= 18 texels) and possibly stepping one row once, like a real grain
      line drifting across a board;
    * 1-3 fine 1-texel dark hairlines (the crisp lengthwise lines of stripped wood);
    * broad weathering: a low-frequency 2-D mottle (period ~11 texels along U).
    No per-texel noise anywhere."""
    base = (smooth1d(rng, h, max(2.0, h / 3.0)) - 0.5) * 0.5
    tone = np.repeat(base[:, None], w, axis=1)
    if h < 3:
        return tone
    n = stripes if stripes is not None else int(rng.integers(3, 5))
    sign = 1.0 if rng.random() < 0.5 else -1.0
    for _ in range(n):
        if h >= 12:
            hgt = int(rng.choice([1, 2, 2, 3]))
        elif h >= 7:
            hgt = int(rng.choice([1, 1, 2]))
        else:
            hgt = 1
        _stripe(tone, rng, w, h, hgt, sign * (0.65 + 0.35 * rng.random()), steps)
        sign = -sign
    nh = hairlines if hairlines is not None else (int(rng.integers(2, 4)) if h >= 10 else 1)
    for _ in range(nh):
        _stripe(tone, rng, w, h, 1, -(0.55 + 0.3 * rng.random()), steps, fade=(0.45, 0.55))
    if weather and w >= 8:
        mot = (smooth1d(rng, w, 11.0)[None, :] - 0.5) * (smooth1d(rng, h, max(2.0, h / 2.0))[:, None] + 0.5)
        tone += weather * mot
    return tone


def along_u_drift(img, rng, amount=0.04, period=20.0):
    """Slow tone variation along the length (U), +-amount."""
    w = img.shape[1]
    img *= (1 + amount * (2 * smooth1d(rng, w, period) - 1))[None, :, None]


def streaks(img, rng, max_n=3):
    """At most `max_n` long dark streaks: 1 texel high, 6-20 long, ~8 % darker."""
    h, w, _ = img.shape
    if h < 5 or w < 12:
        return
    for _ in range(int(rng.integers(1, max_n + 1))):
        r = int(rng.integers(2, h - 2))
        ln = int(rng.integers(6, min(20, w - 4) + 1))
        a = int(rng.integers(2, max(3, w - ln - 1)))
        img[r, a:a + ln] = mix(img[r, a:a + ln], STREAK, 0.4)


def side_light(img, top=1.06, bottom=0.92):
    """Baked top light on a side face: top quarter x top, bottom quarter x bottom."""
    h = img.shape[0]
    v = (np.arange(h) + 0.5) / h
    f = top + (bottom - top) * smoothstep((v - 0.2) / 0.6)
    img *= f[:, None, None]


def round_light(img, centre=1.03, rim=0.95):
    """Symmetric profile across the rows (top / bottom faces read slightly rounded)."""
    h = img.shape[0]
    v = np.abs((np.arange(h) + 0.5) / h - 0.5) * 2
    img *= (centre + (rim - centre) * v ** 2)[:, None, None]


def vgrad(img, top, bottom):
    h = img.shape[0]
    img *= np.linspace(top, bottom, h)[:, None, None]


def ramp_u(img, start, length, low_u=True):
    """Darken one U end: factor `start` at the end, back to 1 over `length` texels."""
    w = img.shape[1]
    n = max(1, min(w, int(round(length))))
    f = start + (1 - start) * smoothstep(np.arange(n) / max(n - 1, 1))
    if low_u:
        img[:, :n] *= f[None, :, None]
    else:
        img[:, w - n:] *= f[::-1][None, :, None]


def front_high_v(img):
    """Up faces map HIGH V to the front (-Z) and low V to the rear (viewer / Blockbench
    Bedrock codec: up/down per-face UVs are stored flipped). Painters that draw an
    up-face pattern with the front at low V return it through this vertical flip."""
    return img[::-1].copy()


def outline(img, color=EDGE, strength=0.7, top=True, bottom=True, left=True, right=True):
    """Blend the outer rows / columns toward `color` (the thin dark beam edge)."""
    if top:
        img[0, :] = mix(img[0, :], color, strength)
    if bottom:
        img[-1, :] = mix(img[-1, :], color, strength)
    if left:
        img[:, 0] = mix(img[:, 0], color, strength)
    if right:
        img[:, -1] = mix(img[:, -1], color, strength)


# ---------------------------------------------------------------------------- legs (T2)
# Tan bands as fractions of the region's length (U), computed so they sit just outside the
# joint blocks (docs/MODEL.md section 3). The tarsus and claw have no band.
BANDS = {
    "fem": [(0.13, 0.21), (0.59, 0.70)],
    "tib": [(0.20, 0.27), (0.76, 0.83)],
    "met": [(0.19, 0.27), (0.86, 0.93)],
}


def wood_surface(w, h, rng, mid=WOOD_M, dark=WOOD_D, light=WOOD_L, contrast=1.0,
                 n_streaks=3):
    t = grain(w, h, rng) * contrast
    img = tone_color(t, mid, dark, light)
    along_u_drift(img, rng)
    if n_streaks:
        streaks(img, rng, n_streaks)
    return img


def tan_band(img, base_mid, u0, u1, contrast=0.3, borders=True):
    """TAN band over columns u0..u1-1 with the wood grain kept at `contrast`, plus a 1-texel
    TAN_EDGE border column on each side."""
    w = img.shape[1]
    u0, u1 = max(0, u0), min(w, u1)
    if u1 <= u0:
        return
    rel = img[:, u0:u1] / base_mid - 1.0
    img[:, u0:u1] = TAN * (1 + contrast * rel)
    if borders:
        for c in (u0 - 1, u1):
            if 0 <= c < w:
                rel_c = img[:, c] / base_mid - 1.0
                img[:, c] = TAN_EDGE * (1 + 0.5 * rel_c)


def p_beam(w, h, rng, seg, face):
    """One painter for every long leg face. DISTAL end at high U.

    seg: 'fem' | 'tib' | 'met';  face: 'side' (N/S, and U for tibia / metatarsus),
    'top' or 'under'."""
    img = wood_surface(w, h, rng)
    bands = BANDS[seg]
    cols = [(int(round(a * w)), int(round(b * w))) for a, b in bands]
    # between a band and its beam end: base x 0.9 (the end stays a little darker)
    (p0, _p1), (_d0, d1) = cols[0], cols[-1]
    img[:, :max(0, p0 - 1)] *= 0.9
    img[:, min(w, d1 + 1):] *= 0.9
    for u0, u1 in cols:
        tan_band(img, WOOD_M, u0, u1)
    # baked light
    if face == "under":
        # x1.18 counters Bedrock's dark bottom faces; the tan bands (already light) only
        # get x1.06 so they stay tan instead of turning peach
        round_light(img)
        lift = np.full(w, 1.18)
        for u0, u1 in cols:
            lift[max(0, u0 - 1):min(w, u1 + 1)] = 1.06
        img *= lift[None, :, None]
    elif face == "top":
        round_light(img, 1.04, 0.97)
    else:
        side_light(img)
    if seg == "fem":
        ramp_u(img, 0.85, 0.15 * w, low_u=True)    # ambient occlusion where it enters the body
    outline(img)
    return img


def p_end(w, h, rng, base=END_FACE, centre=END_C):
    """Flat end face: END_FACE, 1-texel EDGE border, a lighter 2-4 texel centre square."""
    img = flat(w, h, base)
    img *= (1 + 0.03 * (2 * smooth1d(rng, h, 3.0) - 1))[:, None, None]
    c = int(np.clip(min(w, h) // 3, 2, 4))
    y0, x0 = (h - c) // 2, (w - c) // 2
    img[y0:y0 + c, x0:x0 + c] = centre
    outline(img, EDGE, 0.85)
    return img


def p_block(w, h, rng):
    """Knee / ankle block: KNEE wood with grain, EDGE outline and one 2-texel tan band at
    25 % from one side."""
    img = wood_surface(w, h, rng, KNEE, KNEE * 0.92, KNEE * 1.12, contrast=0.8, n_streaks=1)
    u0 = int(round(0.25 * w)) - 1
    tan_band(img, KNEE, u0, u0 + 2, contrast=0.3, borders=False)
    side_light(img, 1.05, 0.93)
    outline(img)
    return img


def p_cap(w, h, rng):
    """Knee / ankle / coxa cap (E/W): flat KNEE_CAP with an EDGE border."""
    img = flat(w, h, KNEE_CAP)
    img *= (1 + 0.025 * (2 * smooth1d(rng, h, 4.0) - 1))[:, None, None]
    outline(img, EDGE, 0.8)
    return img


def p_coxa(w, h, rng):
    """Coxa collar where the leg leaves the body (distal end at high U): KNEE wood, deep
    occlusion toward the body and a thin TAN_EDGE rim one texel inside the distal edge."""
    img = wood_surface(w, h, rng, KNEE * 0.95, KNEE * 0.87, KNEE * 1.05, contrast=0.8,
                       n_streaks=0)
    img[:, -2] = mix(img[:, -2], TAN_EDGE, 0.7)
    ramp_u(img, 0.7, 0.6 * w, low_u=True)
    side_light(img, 1.05, 0.93)
    outline(img)
    return img


def p_tarsus(w, h, rng):
    """Tarsus: plain wood, a little darker, darkening toward the claw (high U)."""
    img = wood_surface(w, h, rng, WOOD_M * 0.92, WOOD_D * 0.92, WOOD_L * 0.92, contrast=0.7,
                       n_streaks=0)
    img *= np.linspace(1.0, 0.8, w)[None, :, None]
    side_light(img)
    outline(img)
    return img


def p_claw(w, h, rng):
    """Claw: dark wood fading to an almost black tip (high U)."""
    t = np.linspace(0, 1, w)[None, :] * np.ones((h, 1))
    img = mix(WOOD_D * 0.8, EDGE * 0.7, t[..., None])
    side_light(img, 1.08, 0.9)
    return img


def p_claw_end(w, h, rng):
    img = flat(w, h, EDGE * 0.75)
    return img


# ---------------------------------------------------------------------------- body (T4)
def chitin_noise(w, h, rng, mid, dark, light, amount=0.35):
    """Calm chitin surface: a broad, low-frequency mottling (no per-texel noise)."""
    t = ((smooth1d(rng, w, 7.0)[None, :] - 0.5) + (smooth1d(rng, h, 6.0)[:, None] - 0.5)) * amount
    return tone_color(t, mid, dark, light)


def p_tor_side(w, h, rng):
    """Cephalothorax side wall: chitin with two faint vertical plate seams, top-lit."""
    img = chitin_noise(w, h, rng, CHIT_M, CHIT_D, CHIT_L)
    for x in (int(w * 0.34), int(w * 0.67)):
        img[2:-1, x] = mix(img[2:-1, x], CHIT_D, 0.6)
    vgrad(img, 1.06, 0.86)
    outline(img, EDGE, 0.6)
    return img


def p_tor_low(w, h, rng):
    img = chitin_noise(w, h, rng, CHIT_D, CHIT_D * 0.9, CHIT_M)
    vgrad(img, 1.0, 0.85)
    outline(img, EDGE, 0.5, top=False)
    return img


def p_carapace(w, h, rng):
    """Carapace top (U = width X, V = length Z; painted front-at-low-V, then flipped because
    an up face shows its HIGH V at the front): chitin with a dome light,
    a median groove from the eye region to the fovea, two straight cervical seams forming
    a V forward of the fovea, and faint radial grooves (6 %) toward the leg bases."""
    img = chitin_noise(w, h, rng, CHIT_M, CHIT_D, CHIT_L, amount=0.3)
    yy, xx = np.mgrid[0:h, 0:w]
    cx = (w - 1) / 2
    fy = h * 0.55                                   # fovea a little behind the centre
    rr = np.hypot((xx - cx) / (w / 2), (yy - fy) / (h / 2))
    img *= (1.07 - 0.12 * np.clip(rr, 0, 1.2) ** 2)[..., None]       # dome light
    ang = np.arctan2(yy - fy, xx - cx)
    radial = (np.cos(ang * 8) > 0.93) & (rr > 0.18) & (rr < 0.9)      # 8 radial grooves
    img[radial] *= 0.94
    c0, c1 = int(np.floor(cx)), int(np.ceil(cx))
    img[2:int(fy), c0:c1 + 1] = mix(img[2:int(fy), c0:c1 + 1], CHIT_D, 0.55)   # median groove
    # cervical seams: straight lines from the fovea forward-outward (a V opening forward)
    for s in (-1, 1):
        for k in range(1, int(h * 0.42)):
            y = int(round(fy - k))
            x = int(round(cx + s * k * 0.75))
            if 1 <= y < h - 1 and 1 <= x < w - 1:
                img[y, x] = mix(img[y, x], CHIT_D, 0.45)
    fy_i = int(fy)
    img[fy_i - 1:fy_i + 1, c0:c1 + 1] = mix(img[fy_i - 1:fy_i + 1, c0:c1 + 1], SOCKET, 0.5)
    outline(img, EDGE, 0.6)
    return front_high_v(img)


def p_rim(w, h, rng):
    """Carapace / ridge rim: a narrow chitin band, lighter top, EDGE bottom line."""
    img = chitin_noise(w, h, rng, CHIT_L * 0.97, CHIT_M, CHIT_L, amount=0.25)
    vgrad(img, 1.05, 0.92)
    outline(img, EDGE, 0.7, top=False)
    outline(img, EDGE, 0.4, bottom=False)
    return img


def p_ridge(w, h, rng):
    """Thoracic ridge top (V = length): slightly lighter chitin with faint segment notches."""
    img = chitin_noise(w, h, rng, CHIT_L * 0.96, CHIT_M, CHIT_L, amount=0.3)
    for y in range(4, h - 2, 5):
        img[y, 1:-1] *= 0.94
    round_light(img.transpose(1, 0, 2), 1.05, 0.95)
    outline(img, EDGE, 0.55)
    return img


def p_under(w, h, rng):
    """Plain light undersides (sternum, belly, keel): UNDER_D..UNDER_L, soft mottling."""
    img = chitin_noise(w, h, rng, mix(UNDER_D, UNDER_L, 0.45), UNDER_D, UNDER_L, amount=0.5)
    outline(img, mix(UNDER_D, EDGE, 0.5), 0.6)
    return img


def p_under_side(w, h, rng):
    """Narrow side walls of the sternum / keel: chitin at the top fading to UNDER below."""
    img = chitin_noise(w, h, rng, CHIT_M, CHIT_D, CHIT_L, amount=0.25)
    v = np.linspace(0, 1, h)[:, None, None]
    img = mix(img, UNDER_D * 0.9, 0.2 + 0.6 * v)
    outline(img, EDGE, 0.5)
    return img


def p_chitin(w, h, rng):
    img = chitin_noise(w, h, rng, CHIT_M, CHIT_D, CHIT_L)
    vgrad(img, 1.05, 0.92)
    outline(img, EDGE, 0.6)
    return img


def p_head_side(w, h, rng):
    img = chitin_noise(w, h, rng, CHIT_M, CHIT_D, CHIT_L)
    vgrad(img, 1.06, 0.84)
    img[int(h * 0.55), 2:-2] = mix(img[int(h * 0.55), 2:-2], CHIT_D, 0.4)   # faint jaw line
    outline(img, EDGE, 0.6)
    return img


def p_head_top(w, h, rng):
    """Head top (V = length): chitin, slightly lighter, a faint median groove."""
    img = chitin_noise(w, h, rng, CHIT_M, CHIT_D, CHIT_L)
    c = (w - 1) / 2
    img[1:-1, int(np.floor(c)):int(np.ceil(c)) + 1] *= 0.94
    img *= 1.03
    outline(img, EDGE, 0.6)
    return img


# ---------------------------------------------------------------------------- eyes (T5)
# Eyes are spread over three surfaces so the cluster is three-dimensional and small:
#  * the two anterior medians (AME, largest) are separate lens cubes ("eye_bump", whole front
#    face glows, one highlight texel) standing out of the head front in dark sockets;
#  * the anterior laterals (ALE) are 2x2 on the head front beside the AME sockets;
#  * the posterior row (PME + PLE) is 2x2 each on the front of the raised eye mound.
# Each list: (x, y, w, h, kind) in texels of its region. Keep eye_texels() in sync.
EYES = [                                                 # head_front (27 x 24)
    (3, 7, 2, 2, "mid"), (22, 7, 2, 2, "mid"),          # anterior laterals
]
AME_SOCKETS = [(8, 6, 5, 5), (14, 6, 5, 5)]             # dark rings around the 7x7 lens cubes (x +-3..+-10, y 216..223)
EYES_MOUND = [                                           # mound_front (17 x 6)
    (5, 2, 2, 2, "mid"), (10, 2, 2, 2, "mid"),          # posterior medians
    (1, 3, 2, 2, "mid"), (14, 3, 2, 2, "mid"),          # posterior laterals
]
EYE_REGIONS = {"head_front": EYES, "mound_front": EYES_MOUND,
               "eye_bump": [(0, 0, 4, 4, "lens")]}


def paint_eyes(img, alpha, eyes):
    """2x2 eyes in a tight CHIT_D socket: base EYE, one highlight texel, a darker lower-right
    texel for roundness. Eye texels get alpha 3 (glow); everything else stays 255."""
    h, w, _ = img.shape
    for x, y, ew, eh, _k in eyes:
        y0, y1 = max(0, y - 1), min(h, y + eh + 1)
        x0, x1 = max(0, x - 1), min(w, x + ew + 1)
        img[y0:y1, x0:x1] = mix(img[y0:y1, x0:x1], CHIT_D * 0.7, 0.8)
    for x, y, ew, eh, _k in eyes:
        img[y:y + eh, x:x + ew] = EYE
        img[y + eh - 1, x + ew - 1] = EYE * 0.82
        img[y, x] = EYE_HI
        alpha[y:y + eh, x:x + ew] = EYE_ALPHA


def p_head_front(w, h, rng):
    """Head (clypeus) front: chitin with a brow line, ALE eyes, dark AME sockets (the lens
    cubes stand in them), a faint median groove down to the chelicerae."""
    img = chitin_noise(w, h, rng, CHIT_M, CHIT_D, CHIT_L, amount=0.3)
    vgrad(img, 1.08, 0.94)
    img[3, 2:-2] = mix(img[3, 2:-2], CHIT_D, 0.35)        # brow line above the eyes
    for x, y, ew, eh in AME_SOCKETS:
        img[y:y + eh, x:x + ew] = SOCKET
    cx = w // 2
    img[12:h - 1, cx] = mix(img[12:h - 1, cx], CHIT_D, 0.5)  # median groove
    outline(img, EDGE, 0.6)
    alpha = np.full((h, w), 255, np.uint8)
    paint_eyes(img, alpha, EYES)
    return img, alpha


def p_mound_front(w, h, rng):
    img = chitin_noise(w, h, rng, CHIT_M, CHIT_D, CHIT_L, amount=0.25)
    vgrad(img, 1.05, 0.9)
    outline(img, EDGE, 0.6)
    alpha = np.full((h, w), 255, np.uint8)
    paint_eyes(img, alpha, EYES_MOUND)
    return img, alpha


def p_eye_bump(w, h, rng):
    """AME lens: the whole front face glows (alpha 3), one highlight texel, darker bottom row."""
    img = flat(w, h, EYE)
    img[-1, :] = EYE * 0.82
    img[1, 1] = EYE_HI
    return img, np.full((h, w), EYE_ALPHA, np.uint8)


def p_bump_side(w, h, rng):
    return flat(w, h, SOCKET * 1.2)


# ---------------------------------------------------------------------------- head parts
def p_palp(w, h, rng, vertical=False):
    """Pedipalp segment: a small leg -- darker wood with a tan ring at the distal end."""
    L, C = (h, w) if vertical else (w, h)
    img = wood_surface(L, C, rng, KNEE * 0.9, KNEE * 0.8, KNEE, contrast=0.7, n_streaks=0)
    img[:, -2] = mix(img[:, -2], TAN, 0.5)
    side_light(img, 1.05, 0.92)
    outline(img, EDGE, 0.6)
    if vertical:
        img = img.transpose(1, 0, 2)
    return img


def p_palp_end(w, h, rng):
    img = flat(w, h, KNEE_CAP * 0.9)
    outline(img, EDGE, 0.6)
    return img


def p_chel(w, h, rng, front=True):
    """Chelicera: dark chitin, lighter at the top, darker and redder toward the fang
    (bottom), a faint vertical groove on the front."""
    img = chitin_noise(w, h, rng, CHIT_M, CHIT_D, CHIT_L, amount=0.3)
    vgrad(img, 1.08, 0.85)
    if front:
        cx = w // 2
        img[2:-2, cx] = mix(img[2:-2, cx], SOCKET, 0.35)
    img[-2:, :] = mix(img[-2:, :], FANG_TIP * 0.7, 0.35)
    outline(img, EDGE, 0.6)
    return img


def p_chel_end(w, h, rng):
    img = flat(w, h, CHIT_D * 0.9)
    outline(img, EDGE, 0.6)
    return img


def p_fang(w, h, rng):
    """Fang base (V = downward): FANG with a faint lit left edge, reddening at the bottom."""
    t = np.linspace(0, 1, h)[:, None, None] * np.ones((1, w, 1))
    img = mix(FANG, FANG_TIP * 0.8, 0.45 * t ** 2)
    img[:, 0] = mix(img[:, 0], CHIT_L, 0.35)
    img[:, -1] *= 0.8
    return img


def p_fang_end(w, h, rng):
    return flat(w, h, FANG * 1.1)


def p_fangtip(w, h, rng):
    """Hooked fang tip: FANG at the root fading to the red-brown FANG_TIP at the point."""
    t = np.linspace(0, 1, h)[:, None, None] * np.ones((1, w, 1))
    img = mix(FANG * 1.1, FANG_TIP, smoothstep(t * 1.2))
    img[:, 0] = mix(img[:, 0], hexc("#a0503f"), 0.35 * t[:, 0])
    img[:, -1] *= 0.8
    return img


def p_fangtip_end(w, h, rng):
    return flat(w, h, FANG_TIP * 0.8)


# ---------------------------------------------------------------------------- abdomen (T4)
def p_abd_side(w, h, rng, belly=False):
    """Abdomen walls (U horizontal, V downward): ABD chitin, vertical gradient x1.05 at the
    top to x0.9 at the bottom; the belly tier blends toward the light underside."""
    img = chitin_noise(w, h, rng, ABD_M, ABD_D, ABD_L, amount=0.4)
    if belly:
        v = np.linspace(0, 1, h)[:, None, None]
        img = mix(img, UNDER_D * 0.95, 0.15 + 0.55 * v)
    vgrad(img, 1.05, 0.9)
    outline(img, EDGE, 0.45)
    return img


def chevrons(img, cx, step, first, n, contrast=0.08, color=ABD_D, slope=0.6, half=None):
    """Forward-pointing chevrons (V shape, apex toward low V = front), 1 texel thick."""
    h, w, _ = img.shape
    yy, xx = np.mgrid[0:h, 0:w]
    dist = np.abs(xx - cx)
    half = half if half is not None else cx - 2
    for i in range(n):
        k = first + i * step
        line = (np.abs((yy - k) - dist * slope) < 0.55) & (dist > 0.6) & (dist < half - i * 0.8)
        img[line] = mix(img[line], color, contrast / 0.15)
    return img


def p_abd_top(w, h, rng, small=False):
    """Abdomen top (U = X width, V = Z length): ABD with a lighter crown (symmetric in V)."""
    img = chitin_noise(w, h, rng, ABD_M, ABD_D, ABD_L, amount=0.4)
    cx = (w - 1) / 2
    xx = np.arange(w)
    img *= (1.06 - 0.12 * ((xx - cx) / max(cx, 1)) ** 2)[None, :, None]
    outline(img, EDGE, 0.45)
    return img


def p_abd_plate(w, h, rng):
    """Dorsal shield: the folium -- 4 faint forward-pointing chevrons (8 %) behind a dark
    median heart mark, lighter crown, soft outline."""
    img = chitin_noise(w, h, rng, ABD_M * 1.02, ABD_D, ABD_L, amount=0.35)
    cx = (w - 1) / 2
    xx = np.arange(w)
    img *= (1.06 - 0.12 * ((xx - cx) / max(cx, 1)) ** 2)[None, :, None]
    chevrons(img, cx, step=max(5, h // 6), first=int(h * 0.3), n=4, contrast=0.08,
             slope=0.55, half=cx - 2)
    heart = (np.abs(xx - cx) < 1.6)
    img[2:int(h * 0.42), heart] = mix(img[2:int(h * 0.42), heart], ABD_D, 0.6)
    outline(img, EDGE, 0.5)
    return front_high_v(img)


def p_abd_rim(w, h, rng):
    img = chitin_noise(w, h, rng, ABD_L * 0.97, ABD_M, ABD_L, amount=0.25)
    vgrad(img, 1.04, 0.9)
    outline(img, EDGE, 0.5, top=False)
    return img


def p_petiole(w, h, rng):
    img = chitin_noise(w, h, rng, CHIT_D, CHIT_D * 0.85, CHIT_M, amount=0.3)
    outline(img, EDGE, 0.5)
    return img


def p_spin(w, h, rng, vertical=False):
    """Spinneret: dark chitin with faint segment lines, darker toward the tip."""
    img = chitin_noise(w, h, rng, ABD_D, ABD_D * 0.85, ABD_M, amount=0.3)
    if vertical:
        for y in range(2, h - 1, 3):
            img[y, :] *= 0.9
    else:
        for x in range(2, w - 1, 3):
            img[:, x] *= 0.9
    outline(img, EDGE, 0.5)
    return img


def p_spin_end(w, h, rng):
    img = flat(w, h, ABD_D * 0.8)
    img[1:-1, 1:-1] = SOCKET * 1.5
    return img


PAINTERS = {
    "fem_side": lambda w, h, r: p_beam(w, h, r, "fem", "side"),
    "fem_top": lambda w, h, r: p_beam(w, h, r, "fem", "top"),
    "fem_under": lambda w, h, r: p_beam(w, h, r, "fem", "under"),
    "tib_side": lambda w, h, r: p_beam(w, h, r, "tib", "side"),
    "tib_under": lambda w, h, r: p_beam(w, h, r, "tib", "under"),
    "met_side": lambda w, h, r: p_beam(w, h, r, "met", "side"),
    "met_under": lambda w, h, r: p_beam(w, h, r, "met", "under"),
    "end": p_end,
    "block": p_block,
    "cap": p_cap,
    "coxa": p_coxa,
    "tarsus": p_tarsus,
    "claw": p_claw,
    "claw_end": p_claw_end,
    "tor_side": p_tor_side,
    "tor_low": p_tor_low,
    "carapace": p_carapace,
    "rim": p_rim,
    "ridge": p_ridge,
    "under": p_under,
    "under_side": p_under_side,
    "chitin": p_chitin,
    "head_front": p_head_front,
    "head_side": p_head_side,
    "head_top": p_head_top,
    "mound_front": p_mound_front,
    "eye_bump": p_eye_bump,
    "bump_side": p_bump_side,
    "palp": p_palp,
    "palp_v": lambda w, h, r: p_palp(w, h, r, vertical=True),
    "palp_end": p_palp_end,
    "chel_front": p_chel,
    "chel_side": lambda w, h, r: p_chel(w, h, r, front=False),
    "chel_end": p_chel_end,
    "fang": p_fang,
    "fang_end": p_fang_end,
    "fangtip": p_fangtip,
    "fangtip_end": p_fangtip_end,
    "abd_side": p_abd_side,
    "abd_belly": lambda w, h, r: p_abd_side(w, h, r, belly=True),
    "abd_top": p_abd_top,
    "abd_top_small": lambda w, h, r: p_abd_top(w, h, r, small=True),
    "abd_plate": p_abd_plate,
    "abd_rim": p_abd_rim,
    "petiole": p_petiole,
    "spin": p_spin,
    "spin_v": lambda w, h, r: p_spin(w, h, r, vertical=True),
    "spin_end": p_spin_end,
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
        if img.shape != (h, w, 3):
            raise SystemExit(f"painter {style} returned {img.shape} for {name} ({w}x{h})")
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
    out = []
    for region, eyes in EYE_REGIONS.items():
        u, v, _w, _h = lay[region]
        for x, y, ew, eh, _k in eyes:
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
