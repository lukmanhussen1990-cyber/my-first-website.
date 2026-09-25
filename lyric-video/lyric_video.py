#!/usr/bin/env python3
"""
Hand-painted lyric-card video, 100% procedural.

Every pixel comes from code: backgrounds, drawings and letters are all built
from brush strokes (stamped discs, dry-brush bristles and wobbly filled
shapes). No images, footage, fonts, AI assets or audio are used. The letters
come from a hand-made single-stroke font defined in this file.

    pip install -r requirements.txt
    python lyric_video.py                       # writes lyric_video.mp4

Handy while editing:
    python lyric_video.py --still 12.5          # one PNG frame at 12.5 s
    python lyric_video.py --sheet               # contact sheet, one frame per scene

Edit SCENES below to change lyrics, timings and layout. Nothing else needs to
change.
"""

import argparse
import math
import os
import shutil
import subprocess
import sys
import time
from contextlib import contextmanager
from multiprocessing import Pool

import numpy as np
from PIL import Image, ImageChops, ImageDraw

# =============================================================================
# 1. SCENES: lyrics, timings and layout (edit this part)
# =============================================================================
#
# Coordinates are in PANEL pixels. The painted panel is 720 x 540 and sits
# vertically centred in the 720 x 1280 frame, with black above and below.
# (0, 0) is the panel's top-left corner.
#
# Scene keys
#   start    : cut-in time in seconds. The scene lasts until the next start
#              (the last one lasts until VIDEO_SECONDS). Cuts are hard.
#   art      : which illustration to paint (see ART at the bottom of part 5).
#   bg       : background paint colour (a name from PALETTE).
#   draw_on  : optional (start, duration). The illustration's strokes draw
#              themselves on screen over that window. Leave it out for a
#              hard cut.
#   text     : list of lettering blocks, drawn on top of the art.
#
# Text block keys
#   text      : the words. Rendered in uppercase. Supports A-Z 0-9 and
#               [ ] ( ) ' " . , ! ? - : ; / & + # @
#   box       : (x, y, width, height) area. The text word-wraps and scales to
#               the largest size that fits, so longer lyrics just work.
#   at        : seconds after the scene's cut when the block appears (0).
#   until     : seconds after the cut when it disappears (end of scene).
#   draw      : seconds to letter itself on stroke by stroke (0 = pop in).
#   style     : "marker"  ink letters on a painted highlight blob (default)
#               "paint"   painted letters, no highlight
#               "outline" painted letters with a black outline
#   ink       : letter colour. highlight: blob colour (marker style only).
#   align     : "left" | "center" | "right" (default "center").
#   size      : optional maximum letter height in pixels.

VIDEO_SECONDS = 36.0

SCENES = [
    {   # 0.0 s: rearview mirror, the opening strokes draw themselves on
        "start": 0.0, "art": "rearview_mirror", "bg": "pink",
        "draw_on": (0.0, 1.3),
        "text": [
            {"text": "[LINE 1]", "box": (18, 18, 310, 96), "at": 0.5, "highlight": "cream", "align": "left"},
            {"text": "[LINE 2]", "box": (392, 18, 310, 96), "at": 1.1, "highlight": "cream", "align": "right"},
            {"text": "[LINE 3]", "box": (20, 436, 680, 92), "at": 2.2, "highlight": "cream"},
        ],
    },
    {   # 4.2 s: ID card on a lanyard
        "start": 4.2, "art": "id_card", "bg": "slate",
        "text": [
            {"text": "[LINE 4]", "box": (18, 18, 272, 100), "highlight": "peach", "align": "left"},
            {"text": "[LINE 5]", "box": (442, 18, 260, 100), "at": 0.9, "highlight": "peach", "align": "right"},
            {"text": "[LINE 6]", "box": (20, 446, 680, 84), "at": 2.0, "highlight": "peach"},
        ],
    },
    {   # 8.4 s: one big word that letters itself on
        "start": 8.4, "art": "sparkles", "bg": "red", "draw_on": (0.95, 0.35),
        "text": [
            {"text": "[LINE 7]", "box": (40, 70, 640, 400), "style": "paint", "ink": "peach_light", "draw": 0.9},
        ],
    },
    {   # 10.0 s: city skyline at dusk
        "start": 10.0, "art": "skyline", "bg": "peach",
        "text": [
            {"text": "[LINE 8]", "box": (18, 18, 440, 80), "highlight": "cream", "align": "left"},
            {"text": "[LINE 9]", "box": (18, 104, 330, 62), "at": 0.9, "highlight": "cream", "align": "left"},
            {"text": "[LINE 10]", "box": (20, 426, 680, 104), "at": 2.0, "style": "paint", "ink": "cream"},
        ],
    },
    {   # 14.4 s: two people watching the sun go down
        "start": 14.4, "art": "sunset_pair", "bg": "pink",
        "text": [
            {"text": "[LINE 11]", "box": (18, 18, 684, 88), "highlight": "cream"},
            {"text": "[LINE 12]", "box": (20, 450, 680, 82), "at": 2.0, "style": "paint", "ink": "peach_light"},
        ],
    },
    {   # 19.0 s: paper plane, dotted flight path draws itself on
        "start": 19.0, "art": "paper_plane", "bg": "blue",
        "text": [
            {"text": "[LINE 13]", "box": (24, 150, 640, 110), "style": "outline", "ink": "cream", "align": "left"},
            {"text": "[LINE 14]", "box": (24, 268, 672, 110), "at": 1.2, "style": "outline", "ink": "cream", "align": "left"},
            {"text": "[LINE 15]", "box": (24, 388, 672, 120), "at": 2.4, "style": "outline", "ink": "peach_light", "align": "left"},
        ],
    },
    {   # 23.2 s: open cardboard box, moving day
        "start": 23.2, "art": "cardboard_box", "bg": "cream",
        "text": [
            {"text": "[LINE 16]", "box": (18, 18, 330, 96), "highlight": "pink", "align": "left"},
            {"text": "[LINE 17]", "box": (392, 18, 310, 96), "at": 1.0, "highlight": "pink", "align": "right"},
            {"text": "[LINE 18]", "box": (20, 454, 680, 80), "at": 2.2, "highlight": "peach"},
        ],
    },
    {   # 27.6 s: sleepy face tucked in, the Zs draw themselves on
        "start": 27.6, "art": "sleepy_face", "bg": "slate",
        "text": [
            {"text": "[LINE 19]", "box": (18, 18, 420, 90), "highlight": "pink_light", "align": "left"},
            {"text": "[LINE 20]", "box": (20, 446, 680, 86), "at": 1.8, "until": 4.0, "highlight": "cream"},
            {"text": "[LINE 21]", "box": (20, 446, 680, 86), "at": 4.0, "highlight": "cream"},
        ],
    },
    {   # 33.6 s: sign-off card
        "start": 33.6, "art": "tiny_heart", "bg": "black", "draw_on": (0.95, 0.4),
        "text": [
            {"text": "[CREDIT]", "box": (160, 238, 400, 60), "style": "paint", "ink": "cream", "draw": 0.8},
        ],
    },
]

# =============================================================================
# 2. Render settings and palette
# =============================================================================

W, H = 720, 1280                 # output frame
PANEL_W, PANEL_H = 720, 540      # painted illustration panel
PANEL_Y = (H - PANEL_H) // 2     # black space above and below
FPS = 30
BOIL_EVERY = 3                   # redraw the "boil" jitter every N frames
BOIL_VARIANTS = 3                # cycle through this many redrawn versions
BOIL_PX = 1.15                   # how far lines wander between redraws
SPACING = 3.0                    # brush stamp spacing along a stroke
SEED = 1987

PALETTE = {
    "ink":         (27, 23, 26),
    "black":       (0, 0, 0),
    "cream":       (243, 232, 207),
    "peach":       (238, 172, 124),
    "peach_light": (247, 206, 164),
    "pink":        (214, 150, 154),
    "pink_light":  (235, 190, 186),
    "red":         (184, 72, 62),
    "red_dark":    (140, 52, 48),
    "slate":       (86, 96, 114),
    "slate_dark":  (50, 56, 72),
    "slate_light": (146, 156, 172),
    "blue":        (102, 150, 210),
    "blue_light":  (164, 198, 232),
    "blue_dark":   (66, 104, 164),
    "tan":         (208, 150, 106),   # peach worked with a little red
    "tan_dark":    (160, 104, 76),
    "night":       (40, 38, 52),      # slate pushed toward ink
}


def col(c):
    return PALETTE[c] if isinstance(c, str) else tuple(int(v) for v in c)


def tint(c, amt):
    """amt > 0 mixes toward white, amt < 0 toward black."""
    c = np.array(col(c), float)
    c = c + (255 - c) * amt if amt > 0 else c * (1 + amt)
    return tuple(int(round(v)) for v in np.clip(c, 0, 255))


# =============================================================================
# 3. Hand-made single-stroke font (cap height = 1.0, y points down)
# =============================================================================

def _arc(cx, cy, rx, ry, a0, a1, n=None):
    if n is None:
        n = max(5, int(abs(a1 - a0) / 10) + 1)
    a = np.radians(np.linspace(a0, a1, n))
    return [(float(x), float(y)) for x, y in zip(cx + rx * np.cos(a), cy + ry * np.sin(a))]


def _c(*pts):
    """Mark a stroke as a smooth curve through its control points."""
    return ("c", list(pts))


_O = _arc(0.39, 0.5, 0.39, 0.5, 265, -100)
_P = [(0, 1), (0, 0)] + _arc(0.26, 0.26, 0.32, 0.26, 270, 450) + [(0, 0.52)]

GLYPHS = {
    " ": (0.40, []),
    "A": (0.74, [[(0, 1), (0.37, 0), (0.74, 1)], [(0.16, 0.63), (0.59, 0.63)]]),
    "B": (0.62, [[(0, 0), (0, 1)],
                 [(0, 0)] + _arc(0.26, 0.24, 0.3, 0.24, 270, 450) + [(0, 0.48)],
                 [(0, 0.48)] + _arc(0.3, 0.74, 0.32, 0.26, 270, 450) + [(0, 1)]]),
    "C": (0.70, [_arc(0.38, 0.5, 0.38, 0.5, 318, 42)]),
    "D": (0.66, [[(0, 0), (0, 1)], [(0, 0)] + _arc(0.14, 0.5, 0.52, 0.5, 270, 450) + [(0, 1)]]),
    "E": (0.58, [[(0.58, 0), (0, 0), (0, 1), (0.6, 1)], [(0, 0.5), (0.46, 0.5)]]),
    "F": (0.56, [[(0.58, 0), (0, 0), (0, 1)], [(0, 0.48), (0.44, 0.48)]]),
    "G": (0.76, [_arc(0.38, 0.5, 0.38, 0.5, 318, 15) + [(0.75, 0.55), (0.45, 0.55)]]),
    "H": (0.64, [[(0, 0), (0, 1)], [(0.64, 0), (0.64, 1)], [(0, 0.5), (0.64, 0.5)]]),
    "I": (0.16, [[(0.08, 0), (0.08, 1)]]),
    "J": (0.56, [[(0.54, 0), (0.54, 0.7)] + _arc(0.28, 0.7, 0.26, 0.3, 0, 180)]),
    "K": (0.62, [[(0, 0), (0, 1)], [(0.6, 0), (0.02, 0.58)], [(0.2, 0.4), (0.64, 1)]]),
    "L": (0.54, [[(0, 0), (0, 1), (0.56, 1)]]),
    "M": (0.84, [[(0, 1), (0.05, 0), (0.42, 0.64), (0.79, 0), (0.84, 1)]]),
    "N": (0.66, [[(0, 1), (0, 0), (0.66, 1), (0.66, 0)]]),
    "O": (0.78, [_O]),
    "P": (0.60, [_P]),
    "Q": (0.80, [_O, [(0.48, 0.68), (0.82, 1.04)]]),
    "R": (0.62, [_P, [(0.24, 0.52), (0.64, 1)]]),
    "S": (0.60, [_c((0.58, 0.12), (0.4, 0.0), (0.16, 0.02), (0.03, 0.18), (0.08, 0.38), (0.32, 0.5),
                    (0.54, 0.62), (0.6, 0.84), (0.44, 1.0), (0.16, 0.99), (0.0, 0.86))]),
    "T": (0.70, [[(0, 0), (0.7, 0)], [(0.35, 0), (0.35, 1)]]),
    "U": (0.64, [[(0, 0), (0, 0.66)] + _arc(0.32, 0.66, 0.32, 0.34, 180, 0) + [(0.64, 0)]]),
    "V": (0.70, [[(0, 0), (0.35, 1), (0.7, 0)]]),
    "W": (0.94, [[(0, 0), (0.2, 1), (0.47, 0.34), (0.74, 1), (0.94, 0)]]),
    "X": (0.64, [[(0, 0), (0.64, 1)], [(0.64, 0), (0, 1)]]),
    "Y": (0.66, [[(0, 0), (0.33, 0.52), (0.66, 0)], [(0.33, 0.52), (0.33, 1)]]),
    "Z": (0.62, [[(0, 0), (0.62, 0), (0, 1), (0.64, 1)]]),
    "0": (0.62, [_arc(0.31, 0.5, 0.31, 0.5, 265, -100)]),
    "1": (0.40, [[(0.04, 0.22), (0.26, 0), (0.26, 1)]]),
    "2": (0.60, [_c((0.02, 0.2), (0.16, 0.03), (0.36, 0.0), (0.54, 0.12), (0.54, 0.34), (0.3, 0.62), (0.0, 1.0)),
                 [(0.0, 1.0), (0.6, 1.0)]]),
    "3": (0.58, [_c((0.02, 0.1), (0.22, 0.0), (0.44, 0.03), (0.55, 0.2), (0.48, 0.4), (0.24, 0.48),
                    (0.5, 0.56), (0.6, 0.76), (0.5, 0.95), (0.24, 1.0), (0.0, 0.9))]),
    "4": (0.64, [[(0.48, 1), (0.48, 0), (0, 0.68), (0.64, 0.68)]]),
    "5": (0.60, [[(0.56, 0), (0.1, 0), (0.05, 0.44)],
                 _c((0.05, 0.44), (0.3, 0.38), (0.52, 0.48), (0.6, 0.7), (0.52, 0.92), (0.28, 1.0), (0.0, 0.9))]),
    "6": (0.60, [_c((0.52, 0.04), (0.3, 0.0), (0.1, 0.16), (0.02, 0.5), (0.06, 0.84), (0.28, 1.0), (0.5, 0.94),
                    (0.6, 0.74), (0.52, 0.56), (0.3, 0.5), (0.1, 0.58), (0.03, 0.72))]),
    "7": (0.60, [[(0, 0), (0.6, 0), (0.18, 1)]]),
    "8": (0.60, [_c((0.3, 0.47), (0.08, 0.35), (0.07, 0.13), (0.3, 0.0), (0.52, 0.12), (0.5, 0.35), (0.3, 0.47),
                    (0.05, 0.62), (0.04, 0.88), (0.3, 1.0), (0.57, 0.88), (0.56, 0.62), (0.3, 0.47))]),
    "9": (0.60, [_c((0.57, 0.3), (0.44, 0.47), (0.24, 0.5), (0.05, 0.38), (0.04, 0.14), (0.26, 0.0), (0.5, 0.06),
                    (0.58, 0.3), (0.55, 0.7), (0.4, 0.95), (0.14, 1.0), (0.02, 0.92))]),
    "[": (0.34, [[(0.32, -0.06), (0.04, -0.06), (0.04, 1.06), (0.32, 1.06)]]),
    "]": (0.34, [[(0.02, -0.06), (0.3, -0.06), (0.3, 1.06), (0.02, 1.06)]]),
    "(": (0.30, [_arc(0.42, 0.5, 0.38, 0.58, 240, 120)]),
    ")": (0.30, [_arc(-0.12, 0.5, 0.38, 0.58, -60, 60)]),
    "'": (0.14, [[(0.08, 0.0), (0.05, 0.26)]]),
    '"': (0.34, [[(0.08, 0.0), (0.05, 0.26)], [(0.28, 0.0), (0.25, 0.26)]]),
    ".": (0.16, [[(0.08, 0.94), (0.09, 0.97)]]),
    ",": (0.18, [[(0.1, 0.88), (0.04, 1.14)]]),
    "!": (0.16, [[(0.08, 0), (0.08, 0.66)], [(0.08, 0.93), (0.09, 0.96)]]),
    "?": (0.58, [_c((0.02, 0.2), (0.14, 0.03), (0.34, 0.0), (0.52, 0.1), (0.54, 0.3), (0.3, 0.48), (0.28, 0.7)),
                 [(0.28, 0.93), (0.29, 0.96)]]),
    "-": (0.42, [[(0.02, 0.52), (0.4, 0.5)]]),
    ":": (0.16, [[(0.08, 0.3), (0.09, 0.33)], [(0.08, 0.9), (0.09, 0.93)]]),
    ";": (0.18, [[(0.1, 0.3), (0.11, 0.33)], [(0.1, 0.86), (0.04, 1.12)]]),
    "/": (0.50, [[(0.5, -0.02), (0.0, 1.02)]]),
    "&": (0.70, [_c((0.7, 1.0), (0.4, 0.66), (0.12, 0.36), (0.1, 0.12), (0.28, 0.0), (0.46, 0.1), (0.44, 0.3),
                    (0.06, 0.6), (0.06, 0.88), (0.26, 1.0), (0.48, 0.92), (0.68, 0.6))]),
    "+": (0.56, [[(0.28, 0.22), (0.28, 0.82)], [(0.0, 0.52), (0.56, 0.52)]]),
    "#": (0.70, [[(0.24, 0.0), (0.16, 1.0)], [(0.54, 0.0), (0.46, 1.0)], [(0.02, 0.32), (0.7, 0.32)],
                 [(0.0, 0.68), (0.66, 0.68)]]),
    "@": (0.92, [_arc(0.47, 0.56, 0.16, 0.2, 0, 360),
                 [(0.64, 0.34), (0.64, 0.72), (0.76, 0.8), (0.9, 0.62)] + _arc(0.48, 0.52, 0.44, 0.5, -10, -300)]),
}
GLYPHS["’"] = GLYPHS["'"]
GLYPHS["‘"] = GLYPHS["'"]


def glyph(ch):
    return GLYPHS.get(ch, GLYPHS["?"] if ch.strip() else GLYPHS[" "])


# =============================================================================
# 4. Brush engine: geometry, strokes, fills, texture
# =============================================================================

def catmull(pts, closed=False, per=10):
    P = np.asarray(pts, float)
    if len(P) < 3:
        return P
    if closed:
        P = np.vstack([P[-1], P, P[0], P[1]])
    else:
        P = np.vstack([2 * P[0] - P[1], P, 2 * P[-1] - P[-2]])
    t = np.linspace(0, 1, per, endpoint=False)[:, None]
    out = []
    for i in range(1, len(P) - 2):
        p0, p1, p2, p3 = P[i - 1], P[i], P[i + 1], P[i + 2]
        out.append(0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t ** 2
                          + (-p0 + 3 * p1 - 3 * p2 + p3) * t ** 3))
    out.append(P[-2][None])
    return np.vstack(out)


def path_len(P):
    return float(np.hypot(*np.diff(P, axis=0).T).sum()) if len(P) > 1 else 0.0


def resample(P, spacing=SPACING):
    P = np.asarray(P, float)
    if len(P) < 2:
        return np.vstack([P, P + 0.01])
    seg = np.hypot(*np.diff(P, axis=0).T)
    d = np.concatenate([[0], np.cumsum(seg)])
    if d[-1] < 1e-6:
        return np.vstack([P[:1], P[:1] + 0.01])
    n = max(2, int(math.ceil(d[-1] / spacing)) + 1)
    s = np.linspace(0, d[-1], n)
    return np.column_stack([np.interp(s, d, P[:, 0]), np.interp(s, d, P[:, 1])])


def normals(P):
    t = np.gradient(P, axis=0)
    ln = np.hypot(t[:, 0], t[:, 1])[:, None] + 1e-9
    t = t / ln
    return np.column_stack([-t[:, 1], t[:, 0]])


def smooth_noise(n, rng, corr=10.0):
    """Smooth 1-D noise, roughly unit amplitude, correlated over `corr` samples."""
    k = int(n / corr) + 4
    ctrl = rng.normal(size=k)
    x = np.linspace(1, k - 3, n)
    i = np.floor(x).astype(int)
    f = x - i
    f = f * f * (3 - 2 * f)
    return ctrl[i] * (1 - f) + ctrl[i + 1] * f


def rot_pts(pts, deg, cx=0.0, cy=0.0):
    a = math.radians(deg)
    ca, sa = math.cos(a), math.sin(a)
    P = np.asarray(pts, float)
    return np.column_stack([P[:, 0] * ca - P[:, 1] * sa + cx, P[:, 0] * sa + P[:, 1] * ca + cy])


def rrect(cx, cy, w, h, r, rot=0.0):
    hw, hh = w / 2, h / 2
    r = min(r, hw, hh)
    pts = []
    for qx, qy, a0 in [(hw - r, -hh + r, 270), (hw - r, hh - r, 0), (-hw + r, hh - r, 90), (-hw + r, -hh + r, 180)]:
        for a in np.radians(np.linspace(a0, a0 + 90, 7)):
            pts.append((qx + r * math.cos(a), qy + r * math.sin(a)))
    return rot_pts(pts, rot, cx, cy)


def ell(cx, cy, rx, ry=None, rot=0.0, n=30):
    ry = rx if ry is None else ry
    a = np.radians(np.linspace(270, 270 + 360, n, endpoint=False))
    return rot_pts(np.column_stack([rx * np.cos(a), ry * np.sin(a)]), rot, cx, cy)


def heart(cx, cy, s):
    t = np.linspace(0, 2 * math.pi, 40, endpoint=False)
    x = 16 * np.sin(t) ** 3
    y = -(13 * np.cos(t) - 5 * np.cos(2 * t) - 2 * np.cos(3 * t) - np.cos(4 * t))
    return np.column_stack([cx + x * s / 16, cy + y * s / 16])


def crescent(cx, cy, R, d, rot=0.0):
    """Moon crescent: circle of radius R with a same-size circle bitten out at offset d."""
    hx = d / 2
    ha = math.degrees(math.acos(min(1.0, hx / R)))
    outer = _arc(0, 0, R, R, ha, 360 - ha, 40)
    inner = _arc(d, 0, R, R, 180 + ha, 180 - ha, 30)
    return rot_pts(outer + inner, rot, cx, cy)


class Op:
    """One brush operation in a scene's display list."""
    __slots__ = ("kind", "pts", "wid", "color", "seed", "boil", "t0", "t1", "dur",
                 "clip", "texture", "reveal", "reveal_w", "closed")

    def __init__(self, kind, pts, color, wid=None, seed=0, boil=1.0, closed=False):
        self.kind, self.pts, self.color, self.wid = kind, pts, color, wid
        self.seed, self.boil, self.closed = seed, boil, closed
        self.t0, self.t1, self.dur = 0.0, 1e9, 0.0
        self.clip = self.texture = self.reveal = None
        self.reveal_w = 0.0

    def length(self):
        n = path_len(self.pts)
        return n * 0.5 if self.kind == "fill" else n

    def progress(self, t):
        if t < self.t0 or t >= self.t1:
            return 0.0
        if self.dur <= 0:
            return 1.0
        return min(1.0, (t - self.t0) / self.dur)


def dry_bristles(P, width, color, rng, bristles=5, dryness=0.35, spacing=6.0):
    """Split a broad stroke into bristle lines with random dry gaps (uneven paint)."""
    P = resample(P, spacing)
    nrm = normals(P)
    out = []
    for j in range(bristles):
        off = (j / max(1, bristles - 1) - 0.5) * 0.8 + rng.normal() * 0.05
        Q = P + nrm * (off * width + smooth_noise(len(P), rng, 8) * width * 0.04)[:, None]
        keep = smooth_noise(len(Q), rng, 5) > (dryness * 2 - 1.2) * 0.9
        bw = max(2, int(round(width / bristles * rng.uniform(1.5, 2.3))))
        runs, start = [], None
        for i, k in enumerate(keep):
            if k and start is None:
                start = i
            if (not k or i == len(keep) - 1) and start is not None:
                end = i if not k else i + 1
                if end - start >= 2:
                    runs.append(Q[start:end])
                start = None
        for r in runs:
            out.append((r, bw, col(color)))
    return out


class Art:
    """Collects brush operations for one scene (art + lettering)."""

    def __init__(self, seed):
        self.ops = []
        self.rng = np.random.default_rng(seed)
        self._seq = None
        self._clip = None
        self._win = (0.0, 1e9)

    def _seed(self):
        return int(self.rng.integers(1, 2 ** 31 - 1))

    def _add(self, op, seq=True, weight=None, overlap=0.0):
        op.t0, op.t1 = self._win
        if self._clip is not None and op.kind == "fill":
            op.clip = self._clip
        self.ops.append(op)
        if seq and self._seq is not None:
            self._seq.append([op, op.length() if weight is None else weight, overlap])
        return op

    # --- context helpers ----------------------------------------------------
    @contextmanager
    def draw_on(self, start, dur):
        """Strokes created inside draw themselves on between start and start+dur."""
        prev, self._seq = self._seq, []
        try:
            yield
        finally:
            seq, self._seq = self._seq, prev
            schedule(seq, start, dur)

    @contextmanager
    def clip(self, pts):
        prev, self._clip = self._clip, np.asarray(pts, float)
        try:
            yield
        finally:
            self._clip = prev

    @contextmanager
    def window(self, t0, t1=1e9):
        prev, self._win = self._win, (t0, t1)
        try:
            yield
        finally:
            self._win = prev

    # --- primitives ---------------------------------------------------------
    def stroke(self, pts, color="ink", width=7.0, smooth=True, closed=False, wobble=1.6,
               boil=1.0, taper=True, seed=None, overshoot=0.06, seq=True):
        rng = np.random.default_rng(self._seed() if seed is None else seed)
        P = np.asarray(pts, float)
        if smooth and len(P) >= 3:
            P = catmull(P, closed)
        elif closed:
            P = np.vstack([P, P[:1]])
        P = resample(P)
        if closed and overshoot > 0:
            k = max(2, int(len(P) * overshoot * rng.uniform(0.4, 1.4)))
            P = np.vstack([P, P[1:k]])
        if wobble > 0:
            P = P + normals(P) * (smooth_noise(len(P), rng, 14) * wobble)[:, None]
        n = len(P)
        wid = width * (1 + 0.13 * smooth_noise(n, rng, 9))
        if taper and n > 4:
            u = np.linspace(0, 1, n)
            wid = wid * np.clip(np.minimum(u, 1 - u) / 0.09, 0.6, 1.0) ** 0.6
        op = Op("stroke", P, col(color), wid=np.maximum(wid, 1.0),
                seed=self._seed() if seed is None else seed, boil=boil)
        return self._add(op, seq=seq)

    def fill(self, pts, color, smooth=True, texture=True, wobble=1.8, boil=1.0, seq=True,
             weight=None, overlap=0.0):
        rng = np.random.default_rng(self._seed())
        P = np.asarray(pts, float)
        P = catmull(P, True) if smooth and len(P) >= 3 else np.vstack([P, P[:1]])
        P = resample(P)
        if wobble > 0:
            d = smooth_noise(len(P), rng, 14) * wobble
            d -= (d[-1] - d[0]) * np.linspace(0, 1, len(P))
            P = P + normals(P) * d[:, None]
        op = Op("fill", P, col(color), seed=self._seed(), boil=boil, closed=True)
        if texture:
            op.texture = fill_texture(P, col(color), rng)
        return self._add(op, seq=seq, weight=weight, overlap=overlap)

    def shape(self, pts, fill=None, line="ink", width=7.0, smooth=True, texture=True, wobble=1.8):
        """Filled shape with a rough outline. In draw-on mode: outline first, then paint in."""
        f = self.fill(pts, fill, smooth=smooth, texture=texture, wobble=wobble, seq=False) if fill else None
        o = self.stroke(pts, line, width, smooth=smooth, closed=True, wobble=wobble) if line else None
        if f is not None and self._seq is not None:
            self._seq.append([f, max(60.0, f.length() * 0.6), 0.55 if o is not None else 0.0])
        return f, o

    def tube(self, pts, color, width, line="ink", line_w=4.0, smooth=True):
        """A thick painted band with an ink edge (straps, poles, rolled paper)."""
        seed = self._seed()
        self.stroke(pts, line, width + 2 * line_w, smooth=smooth, seed=seed, taper=False)
        self.stroke(pts, color, width, smooth=smooth, seed=seed, taper=False, seq=False)

    def dashes(self, pts, color="ink", width=5.0, dash=14.0, gap=11.0, smooth=True):
        P = catmull(pts) if smooth else np.asarray(pts, float)
        P = resample(P, 1.0)
        i, n = 0, len(P)
        while i < n - 2:
            j = min(n - 1, i + int(dash * self.rng.uniform(0.8, 1.2)))
            self.stroke(P[i:j + 1], color, width, smooth=False, wobble=0.8)
            i = j + int(gap * self.rng.uniform(0.8, 1.2))

    def letters(self, text, x, y, size, color="ink", style="paint", rot=0.0):
        """Hand letters at an explicit spot (x, y = top-left of the cap height)."""
        spec = {"text": text, "style": style, "ink": color, "size": size}
        return place_text(self, spec, [(text.upper(), x, y)], size, rot=rot)


def schedule(seq, start, dur):
    """Spread a draw-on group's strokes over [start, start+dur] in creation order."""
    if not seq:
        return
    cursor, spans = 0.0, []
    for op, w, ov in seq:
        w = max(w, 1.0)
        s0 = max(0.0, cursor - ov * w)
        spans.append((op, s0, s0 + w))
        cursor = max(cursor, s0 + w)
    for op, s0, s1 in spans:
        op.t0 = start + s0 / cursor * dur
        op.dur = max(1e-3, (s1 - s0) / cursor * dur)
        if op.kind == "fill":
            make_reveal(op)


def make_reveal(op):
    """Zig-zag brush path that paints a fill in when it draws on."""
    x0, y0 = op.pts.min(0)
    x1, y1 = op.pts.max(0)
    w, h = x1 - x0, y1 - y0
    bw = float(np.clip(min(w, h) * 0.45, 14, 64))
    rows = max(1, int(math.ceil(h / (bw * 0.7))))
    pts = []
    for i in range(rows):
        y = y0 + (i + 0.5) * h / rows
        xs = (x0 - bw / 2, x1 + bw / 2) if i % 2 == 0 else (x1 + bw / 2, x0 - bw / 2)
        pts += [(xs[0], y), (xs[1], y)]
    op.reveal = resample(np.array(pts), 4.0)
    op.reveal_w = bw * 1.25


def fill_texture(P, color, rng):
    """Uneven paint coverage inside a fill: a few dry-brush passes in close tints."""
    x0, y0 = P.min(0)
    x1, y1 = P.max(0)
    w, h = x1 - x0, y1 - y0
    area = w * h
    n = int(np.clip(area / 9000, 1, 10))
    ang = rng.uniform(-25, 25) + (90 if h > w * 1.8 else 0)
    out = []
    for _ in range(n):
        cx, cy = rng.uniform(x0, x1), rng.uniform(y0, y1)
        L = rng.uniform(0.5, 1.0) * math.hypot(w, h) * 0.7
        a = math.radians(ang + rng.normal(0, 6))
        dx, dy = math.cos(a) * L / 2, math.sin(a) * L / 2
        mid = (cx + rng.normal(0, 6), cy + rng.normal(0, 6))
        path = catmull([(cx - dx, cy - dy), mid, (cx + dx, cy + dy)])
        bw = float(np.clip(min(w, h) * rng.uniform(0.15, 0.35), 6, 60))
        c = tint(color, rng.choice([0.07, 0.11, -0.05, -0.08]))
        out += dry_bristles(path, bw, c, rng, bristles=int(rng.integers(3, 6)), dryness=0.45)
    return out


# --- rasterisers -------------------------------------------------------------

def boiled(op, variant):
    """The op's points as redrawn for boil variant `variant` (small hand jitter)."""
    if op.boil <= 0:
        return op.pts, op.wid
    rng = np.random.default_rng((op.seed * 7919 + variant * 104729 + 17) % (2 ** 32))
    amp = BOIL_PX * op.boil
    P = op.pts
    d = smooth_noise(len(P), rng, 9) * amp
    if op.closed:
        d -= (d[-1] - d[0]) * np.linspace(0, 1, len(P))
    P = P + normals(P) * d[:, None] + rng.normal(size=2) * amp * 0.55
    wid = None if op.wid is None else op.wid * (1 + 0.07 * smooth_noise(len(P), rng, 7))
    return P, wid


def raster_stroke(draw, P, wid, color, prog=1.0):
    n = len(P)
    m = n if prog >= 1 else int(round(prog * n))
    if m < 1:
        return
    P, wid = P[:m], wid[:m]
    r = wid / 2
    if m > 1:
        d = P[1:] - P[:-1]
        ln = np.hypot(d[:, 0], d[:, 1])[:, None] + 1e-9
        nr = np.column_stack([-d[:, 1], d[:, 0]]) / ln
        a = P[:-1] + nr * r[:-1, None]
        b = P[1:] + nr * r[1:, None]
        c = P[1:] - nr * r[1:, None]
        e = P[:-1] - nr * r[:-1, None]
        quads = np.stack([a, b, c, e], 1).tolist()
        for q in quads:
            draw.polygon([tuple(v) for v in q], fill=color)
    for (x, y), rr in zip(P.tolist(), r.tolist()):
        if rr < 0.7:
            draw.point((x, y), fill=color)
        else:
            draw.ellipse([x - rr, y - rr, x + rr, y + rr], fill=color)


def raster_lines(draw, runs, dx=0.0, dy=0.0):
    for pts, bw, c in runs:
        q = (pts + (dx, dy)).tolist()
        draw.line([tuple(v) for v in q], fill=c, width=bw, joint="curve")
        r = bw / 2
        for x, y in (q[0], q[-1]):
            draw.ellipse([x - r, y - r, x + r, y + r], fill=c)


def raster_fill(img, op, variant, prog):
    P, _ = boiled(op, variant)
    x0 = int(max(0, math.floor(P[:, 0].min()) - 2))
    y0 = int(max(0, math.floor(P[:, 1].min()) - 2))
    x1 = int(min(PANEL_W, math.ceil(P[:, 0].max()) + 2))
    y1 = int(min(PANEL_H, math.ceil(P[:, 1].max()) + 2))
    if x1 <= x0 or y1 <= y0:
        return
    size = (x1 - x0, y1 - y0)
    off = np.array([x0, y0], float)
    mask = Image.new("L", size, 0)
    ImageDraw.Draw(mask).polygon([tuple(v) for v in (P - off).tolist()], fill=255)
    if op.clip is not None:
        cm = Image.new("L", size, 0)
        ImageDraw.Draw(cm).polygon([tuple(v) for v in (op.clip - off).tolist()], fill=255)
        mask = ImageChops.multiply(mask, cm)
    if prog < 1 and op.reveal is not None:
        rv = Image.new("L", size, 0)
        R = op.reveal - off
        raster_stroke(ImageDraw.Draw(rv), R, np.full(len(R), op.reveal_w), 255, prog)
        mask = ImageChops.multiply(mask, rv)
    tile = Image.new("RGB", size, op.color)
    if op.texture:
        rng = np.random.default_rng(op.seed + variant)
        jx, jy = rng.normal(size=2) * 0.8
        raster_lines(ImageDraw.Draw(tile), op.texture, jx - x0, jy - y0)
    img.paste(tile, (x0, y0), mask)


# =============================================================================
# 5. Lettering and illustrations
# =============================================================================

TEXT_STYLES = {
    #          line spacing, pill pad, word gap, stroke weight, outline weight
    "marker":  dict(line=1.62, pad=0.40, gap=0.22, weight=0.15, outline=0.0),
    "paint":   dict(line=1.34, pad=0.06, gap=0.48, weight=0.17, outline=0.0),
    "outline": dict(line=1.42, pad=0.14, gap=0.50, weight=0.15, outline=0.33),
}
TRACK = 0.2   # letter spacing, in cap heights


def word_w(word):
    return sum(glyph(ch)[0] for ch in word) + TRACK * max(0, len(word) - 1)


def fit_text(text, box, style, max_size=None):
    st = TEXT_STYLES[style]
    words = text.split()
    _, _, bw, bh = box
    extra = text_extra(style)
    hi = int(min(bh / (1 + extra), max_size or 1e9))
    for s in range(hi, 7, -1):
        lines, cur = [], []
        for wd in words:
            trial = cur + [wd]
            if cur and line_w(trial, st) * s > bw:
                lines.append(cur)
                cur = [wd]
            else:
                cur = trial
        if cur:
            lines.append(cur)
        need_h = s * (1 + (len(lines) - 1) * st["line"] + extra)
        if need_h <= bh and max(line_w(ln, st) for ln in lines) * s <= bw:
            return s, [" ".join(ln) for ln in lines]
    return 8, [text]


def text_extra(style):
    """Height a block needs beyond its cap height (highlight blob or stroke weight), in caps."""
    st = TEXT_STYLES[style]
    return 0.45 if style == "marker" else max(st["outline"], st["weight"]) + 0.04


def line_w(words, st):
    gap = st["gap"] + (2 * st["pad"] if st is TEXT_STYLES["marker"] else 0)
    return sum(word_w(w) for w in words) + gap * (len(words) - 1) + 2 * st["pad"]


def build_text(A, spec):
    style = spec.get("style", "marker")
    st = TEXT_STYLES[style]
    text = " ".join(spec["text"].upper().split())
    bx, by, bw, bh = spec["box"]
    s, lines = fit_text(text, spec["box"], style, spec.get("size"))
    extra = text_extra(style)
    total_h = s * (1 + (len(lines) - 1) * st["line"] + extra)
    y = by + (bh - total_h) / 2 + s * extra / 2
    align = spec.get("align", "center")
    placed = []
    for i, ln in enumerate(lines):
        lw = line_w(ln.split(), st) * s
        if align == "left":
            x = bx
        elif align == "right":
            x = bx + bw - lw
        else:
            x = bx + (bw - lw) / 2
        placed.append((ln, x + st["pad"] * s, y + i * st["line"] * s))
    at, until = spec.get("at", 0.0), spec.get("until", 1e9)
    with A.window(at, until):
        place_text(A, spec, placed, s, draw=spec.get("draw", 0.0), start=at)


def place_text(A, spec, placed, s, draw=0.0, start=0.0, rot=0.0):
    style = spec.get("style", "marker")
    st = TEXT_STYLES[style]
    ink = col(spec.get("ink", "ink" if style == "marker" else "cream"))
    hl = col(spec.get("highlight", "peach"))
    rng = A.rng
    pills, strokes = [], []   # strokes: (points, seed)
    for ln, x, y in placed:
        cx = x
        for wd in ln.split(" "):
            ww = word_w(wd) * s
            if style == "marker":
                pills.append((cx, cx + ww, y))
            lx = cx
            for ch in wd:
                gw, gstrokes = glyph(ch)
                sc = rng.uniform(0.93, 1.07)
                th = rng.uniform(-4.5, 4.5) + rot
                dy = rng.uniform(-0.05, 0.05) * s
                ccx, ccy = lx + gw * s / 2, y + s / 2 + dy
                for g in gstrokes:
                    smooth = isinstance(g, tuple)
                    pts = np.asarray(g[1] if smooth else g, float)
                    if smooth:
                        pts = catmull(pts)
                    pts = (pts - (gw / 2, 0.5)) * s * sc
                    strokes.append(rot_pts(pts, th, ccx, ccy))
                lx += (gw + TRACK) * s
            cx += ww + (st["gap"] + (2 * st["pad"] if style == "marker" else 0)) * s

    pill_ops, ink_ops = [], []
    for x0, x1, y in pills:
        pad = st["pad"] * s * rng.uniform(0.8, 1.0)
        yc = y + s * 0.5
        for k in range(2):
            oy = rng.uniform(-0.08, 0.08) * s
            sh = rng.uniform(0.0, 0.18) * s
            pts = [(x0 - pad + (sh if k else 0), yc + oy + rng.normal(0, 0.03 * s)),
                   ((x0 + x1) / 2, yc + oy + rng.normal(0, 0.05 * s)),
                   (x1 + pad - (0 if k else sh), yc + oy + rng.normal(0, 0.03 * s))]
            w = s * (1.42 if k == 0 else rng.uniform(1.15, 1.35))
            pill_ops.append(A.stroke(pts, hl, w, wobble=0.035 * s, taper=False, boil=0.8, seq=False))
        streak = [(x0 - pad * 0.3, yc + rng.uniform(-0.3, 0.3) * s), (x1 + pad * 0.3, yc + rng.uniform(-0.3, 0.3) * s)]
        pill_ops.append(A.stroke(streak, tint(hl, 0.16), s * 0.14, wobble=0.03 * s, boil=0.6, seq=False))

    seeds = [A._seed() for _ in strokes]
    wob = max(0.6, 0.02 * s)
    boil = 0.5 + 0.012 * s
    if st["outline"] > 0:
        for P, sd in zip(strokes, seeds):
            ink_ops.append([A.stroke(P, "ink", st["outline"] * s, smooth=False, wobble=wob, boil=boil,
                                     seed=sd, seq=False, taper=False)])
    for i, (P, sd) in enumerate(zip(strokes, seeds)):
        op = A.stroke(P, ink, st["weight"] * s, smooth=False, wobble=wob, boil=boil, seed=sd, seq=False)
        if st["outline"] > 0:
            ink_ops[i].append(op)
        else:
            ink_ops.append([op])

    if draw > 0:
        # pills swipe on first, then the letters are written stroke by stroke
        schedule([[o, o.length(), 0.3] for o in pill_ops], start, draw * 0.3)
        schedule([[grp[0], grp[0].length(), 0.0] for grp in ink_ops], start + (draw * 0.25 if pills else 0),
                 draw * (0.75 if pills else 1.0))
        for grp in ink_ops:
            for o in grp[1:]:
                o.t0, o.dur = grp[0].t0, grp[0].dur
    elif A._seq is not None:
        for o in pill_ops + [g[0] for g in ink_ops]:
            A._seq.append([o, o.length(), 0.0])


# --- illustrations -----------------------------------------------------------
# Each function paints one scene's symbol with the Art helpers:
#   A.shape(points, fill=..., line="ink")   filled shape + rough outline
#   A.fill(points, colour)                  paint only
#   A.stroke(points, colour, width)         a single brush line
#   A.tube / A.dashes / A.letters           bands, dotted lines, hand letters
#   with A.clip(points):                    keep fills inside a shape
#   with A.draw_on(start, dur):             strokes draw themselves on

ART = {}


def art(name):
    def reg(fn):
        ART[name] = fn
        return fn
    return reg


@art("none")
def art_none(A):
    pass


@art("rearview_mirror")
def art_rearview_mirror(A):
    # windshield mount
    A.shape([(347, -30), (373, -30), (371, 126), (349, 126)], fill="slate_dark", smooth=False, width=6)
    A.shape(ell(360, 130, 20, 15), fill="slate", smooth=False, width=6)
    # housing
    A.shape(rrect(360, 230, 506, 198, 66), fill="slate", width=8, smooth=False)
    A.stroke([(170, 150), (260, 140), (360, 138)], "slate_light", 5, wobble=1.0)
    glass = rrect(360, 230, 452, 148, 46)
    A.fill(glass, "blue_light", smooth=False)
    with A.clip(glass):
        A.shape(ell(482, 190, 20), fill="peach_light", width=5, smooth=False)
        A.fill([(110, 252), (170, 234), (232, 244), (292, 224), (352, 238), (424, 226), (486, 240),
                (548, 226), (612, 238), (612, 330), (110, 330)], "slate_light", smooth=True)
        A.fill([(110, 264), (300, 259), (612, 263), (612, 330), (110, 330)], "pink_light", smooth=False)
        A.fill([(367, 258), (383, 258), (640, 330), (90, 330)], "slate", smooth=False)
    A.stroke([(138, 250), (170, 236), (232, 246), (292, 226), (352, 240), (424, 228), (486, 242),
              (548, 228), (582, 236)], "ink", 5)
    A.stroke([(368, 259), (246, 298)], "ink", 5, smooth=False)
    A.stroke([(382, 259), (500, 298)], "ink", 5, smooth=False)
    for y0, y1, w in [(264, 269, 3), (275, 283, 4), (290, 302, 5)]:
        A.stroke([(375, y0), (376, y1)], "cream", w, wobble=0.4, smooth=False)
    A.stroke([(160, 238), (198, 178)], "cream", 6, smooth=False)
    A.stroke([(182, 248), (214, 198)], "cream", 4, smooth=False)
    A.stroke(glass, "ink", 6, smooth=False, closed=True)
    # little pine air freshener
    A.stroke([(548, 324), (551, 340), (550, 354)], "ink", 3, wobble=0.6)
    tree = [(550, 352), (568, 374), (558, 375), (576, 396), (562, 397), (582, 420),
            (518, 420), (538, 397), (524, 396), (542, 375), (532, 374)]
    A.shape(tree, fill="red", width=5, smooth=False)
    A.stroke([(550, 420), (550, 432)], "ink", 7, smooth=False)


@art("id_card")
def art_id_card(A):
    def L(pts):
        return rot_pts(pts, -5, 372, 292)

    A.tube([(300, -30), (326, 80), (352, 152)], "red", 18)
    A.tube([(438, -30), (408, 80), (386, 152)], "red", 18)
    A.shape(rrect(369, 160, 40, 46, 9), fill="slate_light", width=6, smooth=False)
    A.shape(L(rrect(0, 0, 430, 248, 26)), fill="cream", width=8, smooth=False)
    A.shape(L(rrect(0, -100, 66, 14, 7)), fill="slate", width=4, smooth=False)
    photo = L(rrect(-116, 22, 136, 156, 14))
    A.fill(photo, "peach_light", smooth=False)
    with A.clip(photo):
        A.fill(L([(-186, 110), (-180, 70), (-156, 44), (-116, 36), (-76, 44), (-52, 70), (-46, 110)]), "slate")
        A.fill(L(ell(-116, -2, 32, 38)), "slate", smooth=False)
    A.stroke(L(ell(-116, -2, 32, 38)), "ink", 5, closed=True, smooth=False)
    A.stroke(L([(-176, 98), (-172, 70), (-152, 48), (-116, 40), (-80, 48), (-60, 70), (-56, 98)]), "ink", 5)
    A.stroke(photo, "ink", 6, closed=True, smooth=False)
    A.letters("?", *L([(-127, -22)])[0], size=38, color="cream", rot=-5)
    for yy, xe in [(-56, 160), (-24, 128), (8, 150)]:
        A.stroke(L([(6, yy), ((6 + xe) / 2, yy - 2), (xe, yy + 1)]), "ink", 6)
    A.stroke(L([(6, 36), (90, 34)]), "slate_light", 5)
    x = 8.0
    while x < 160:
        w = float(A.rng.choice([3, 3, 5, 7]))
        A.stroke(L([(x, 62), (x, 98)]), "ink", w, smooth=False, wobble=0.5, taper=False)
        x += w + A.rng.uniform(4, 8)
    A.shape(L(ell(172, -92, 13)), fill="red", width=4, smooth=False)


@art("sparkles")
def art_sparkles(A):
    for x, y, r in [(70, 70, 24), (652, 86, 17), (88, 468, 15), (636, 458, 26)]:
        A.stroke([(x - r, y + 2), (x + r, y - 2)], "cream", 6, smooth=False)
        A.stroke([(x + 2, y - r), (x - 2, y + r)], "cream", 6, smooth=False)
        k = r * 0.5
        A.stroke([(x - k, y - k), (x + k, y + k)], "peach_light", 4, smooth=False)


@art("skyline")
def art_skyline(A):
    A.fill([(-30, -30), (750, -30), (750, 150), (620, 162), (430, 146), (250, 164), (90, 148), (-30, 160)],
           "pink", smooth=False, wobble=4)
    A.fill([(-30, 250), (200, 240), (420, 256), (750, 242), (750, 420), (-30, 420)], "peach_light",
           smooth=False, wobble=4)
    A.shape(crescent(612, 78, 36, 24, rot=-30), fill="cream", width=5, smooth=False)
    blds = [(-30, 60, 300), (60, 140, 252), (140, 196, 326), (196, 290, 214), (290, 336, 286),
            (336, 430, 232), (430, 476, 272), (476, 566, 236), (566, 612, 304), (612, 702, 206), (702, 760, 276)]
    sil = [(-30, 440)]
    for x0, x1, top in blds:
        if x0 == 196:
            sil += [(x0, top), ((x0 + x1) / 2, top - 38), (x1, top)]
        else:
            sil += [(x0, top), (x1, top)]
    sil += [(760, 440)]
    A.shape(sil, fill="slate", width=7, smooth=False)
    # water tower + antenna
    for lx in (504, 538):
        A.stroke([(lx, 236), (lx + (4 if lx < 520 else -4), 206)], "ink", 4, smooth=False)
    A.shape(rrect(521, 190, 50, 34, 8), fill="slate_light", width=5, smooth=False)
    A.shape([(494, 176), (521, 156), (548, 176)], fill="slate_dark", width=5, smooth=False)
    A.stroke([(657, 206), (657, 158)], "ink", 4, smooth=False)
    A.stroke([(645, 174), (669, 172)], "ink", 4, smooth=False)
    # windows, some lit
    for x0, x1, top in blds:
        for wx in np.arange(x0 + 16, x1 - 10, 22):
            for wy in np.arange(top + 22, 396, 28):
                if 0 < wx < 720 and A.rng.random() < 0.34:
                    c = "cream" if A.rng.random() < 0.4 else "peach_light"
                    A.stroke([(wx, wy), (wx + A.rng.normal(0, 0.6), wy + 7)], c, 8, smooth=False,
                             wobble=0.4, taper=False, boil=0.6)
    A.shape([(-30, 414), (180, 404), (360, 416), (540, 402), (750, 412), (750, 580), (-30, 580)],
            fill="slate_dark", width=7)


@art("sunset_pair")
def art_sunset_pair(A):
    A.fill([(-30, 186), (200, 176), (420, 192), (750, 180), (750, 320), (-30, 320)], "peach",
           smooth=False, wobble=4)
    A.shape(ell(360, 300, 112, n=48), fill="peach_light", width=7, smooth=False)
    A.shape([(-30, 300), (750, 300), (750, 580), (-30, 580)], fill="blue", width=7, smooth=False)
    for y, hw, w in [(314, 92, 7), (328, 70, 6), (342, 52, 6)]:
        A.stroke([(360 - hw, y), (360 + hw, y + 1)], "cream", w, smooth=False, wobble=1.2)
    for x, y, hw in [(80, 330, 34), (620, 322, 40), (150, 360, 22), (600, 356, 26)]:
        A.stroke([(x - hw, y), (x + hw, y)], "blue_light", 5, smooth=False, wobble=1.0)
    A.shape([(-30, 446), (130, 414), (250, 378), (360, 368), (470, 378), (590, 414), (750, 446),
             (750, 580), (-30, 580)], fill="slate_dark", width=7)
    # two small figures, one leaning in
    A.shape([(290, 380), (294, 336), (308, 318), (328, 312), (348, 318), (362, 336), (366, 380)],
            fill="night", width=6)
    A.shape(ell(328, 290, 23), fill="night", width=6, smooth=False)
    A.shape([(372, 382), (376, 342), (388, 326), (404, 320), (420, 326), (432, 342), (436, 382)],
            fill="night", width=6)
    A.shape(ell(396, 299, 21, rot=-18), fill="night", width=6, smooth=False)
    for x, y, s in [(140, 126, 14), (176, 106, 10), (560, 140, 12)]:
        A.stroke([(x - s, y - s * 0.5), (x - s * 0.4, y - s * 0.6), (x, y)], "ink", 4, wobble=0.5)
        A.stroke([(x, y), (x + s * 0.4, y - s * 0.6), (x + s, y - s * 0.5)], "ink", 4, wobble=0.5)
    with A.draw_on(2.6, 0.7):
        A.shape(heart(362, 238, 20), fill="red", width=5, smooth=False)


@art("paper_plane")
def art_paper_plane(A):
    with A.draw_on(0.0, 1.5):
        A.dashes([(18, 120), (110, 98), (196, 116), (246, 84), (224, 44), (180, 58), (190, 100),
                  (260, 118), (360, 108), (446, 92), (508, 98)], "cream", 5)
    A.shape([(664, 52), (512, 94), (574, 110)], fill="cream", width=6, smooth=False)
    A.shape([(664, 52), (574, 110), (552, 146)], fill="blue_light", width=6, smooth=False)
    A.stroke([(664, 52), (566, 112)], "ink", 4, smooth=False)
    for x, y in [(612, 196), (668, 252), (590, 520)]:
        A.stroke([(x - 8, y), (x + 8, y)], "blue_light", 4, smooth=False)
        A.stroke([(x, y - 8), (x, y + 8)], "blue_light", 4, smooth=False)


@art("cardboard_box")
def art_cardboard_box(A):
    a, b, c, d = (180, 244), (420, 266), (420, 432), (180, 410)
    e, f, g = (548, 228), (548, 392), (308, 206)
    A.shape([a, g, (290, 146), (152, 180)], fill="tan", width=7, smooth=False)
    A.shape([g, e, (566, 166), (324, 142)], fill="tan", width=7, smooth=False)
    A.shape([a, g, e, b], fill="tan_dark", width=7, smooth=False)
    # things poking out
    A.tube([(438, 262), (490, 150)], "blue_light", 26)
    A.shape(ell(490, 150, 17, 8, rot=25), fill="cream", width=5, smooth=False)
    A.stroke(ell(490, 150, 6, 3, rot=25, n=12), "ink", 3, closed=True, smooth=False, wobble=0.4)
    A.stroke([(290, 250), (292, 206)], "ink", 7, smooth=False)
    A.shape([(246, 150), (322, 144), (340, 204), (228, 210)], fill="pink", width=7, smooth=False)
    A.shape([a, b, c, d], fill="tan", width=8, smooth=False)
    A.shape([b, e, f, c], fill="tan_dark", width=8, smooth=False)
    A.shape([b, e, (608, 256), (480, 302)], fill="tan", width=7, smooth=False)
    A.shape([a, b, (412, 300), (170, 280)], fill="tan", width=7, smooth=False)
    lab = rrect(296, 360, 128, 56, 8, rot=4)
    A.shape(lab, fill="cream", width=5, smooth=False)
    for yy, xe in [(-10, 40), (10, 20)]:
        A.stroke(rot_pts([(-44, yy), (xe, yy + 2)], 4, 296, 360), "ink", 4)
    for ax, ay in [(462, 350), (506, 334)]:
        A.stroke([(ax, ay + 22), (ax + 2, ay - 12)], "ink", 4, smooth=False)
        A.stroke([(ax - 9, ay - 2), (ax + 2, ay - 14), (ax + 12, ay - 3)], "ink", 4, smooth=False)


@art("sleepy_face")
def art_sleepy_face(A):
    for x, y, r in [(66, 164, 9), (128, 128, 6), (660, 214, 8), (470, 60, 6), (690, 150, 5)]:
        A.stroke([(x - r, y), (x + r, y)], "cream", 4, smooth=False)
        A.stroke([(x, y - r), (x, y + r)], "cream", 4, smooth=False)
    A.shape(rrect(330, 318, 452, 196, 70, rot=-4), fill="cream", width=7, smooth=False)
    head = ell(322, 280, 104, 100, n=40)
    A.fill(head, "peach_light", smooth=False)
    with A.clip(head):
        A.fill([(200, 262), (236, 224), (300, 208), (360, 210), (412, 228), (446, 262), (450, 150), (200, 150)],
               "slate_dark", smooth=False)
    A.stroke([(222, 246), (240, 226), (300, 210), (360, 212), (412, 230), (428, 250)], "ink", 5)
    A.stroke(head, "ink", 7, closed=True, smooth=False)
    A.stroke([(318, 184), (332, 166), (322, 152), (342, 144)], "ink", 5)
    for ex in (284, 362):
        A.stroke(_arc(ex, 272, 23, 13, 15, 165), "ink", 6)
        for lx, ly, dx in [(-14, 282, -5), (0, 286, 0), (14, 282, 5)]:
            A.stroke([(ex + lx, ly), (ex + lx + dx, ly + 8)], "ink", 3, smooth=False)
    A.fill(ell(254, 310, 18, 11), "pink", smooth=False)
    A.fill(ell(392, 310, 18, 11), "pink", smooth=False)
    A.shape(ell(323, 330, 9, 11), fill="red_dark", width=5, smooth=False)
    A.shape([(-30, 376), (110, 352), (250, 366), (400, 346), (560, 362), (750, 342), (750, 580), (-30, 580)],
            fill="red", width=7)
    A.stroke([(-20, 398), (140, 384), (300, 396), (460, 380), (620, 392), (740, 378)], "cream", 10)
    A.stroke([(-20, 424), (140, 410), (300, 422), (460, 406), (620, 418), (740, 404)], "pink", 6)
    for i, (x, y, s) in enumerate([(490, 150, 42), (560, 92, 32), (620, 44, 24)]):
        with A.draw_on(0.6 + i * 0.55, 0.35):
            A.letters("Z", x, y, s, color="cream", rot=-8 + i * 5)


@art("tiny_heart")
def art_tiny_heart(A):
    A.shape(heart(360, 336, 16), fill="red", width=4, smooth=False)


# =============================================================================
# 6. Scenes, timeline and rendering
# =============================================================================

class Scene:
    def __init__(self, idx, spec, end):
        self.start, self.end = float(spec["start"]), float(end)
        self.bg = col(spec.get("bg", "cream"))
        A = Art(SEED * 1000 + idx * 97)
        fn = ART[spec.get("art", "none")]
        if spec.get("draw_on"):
            with A.draw_on(*spec["draw_on"]):
                fn(A)
        else:
            fn(A)
        for tspec in spec.get("text", []):
            build_text(A, tspec)
        self.ops = A.ops
        rng = np.random.default_rng(SEED + idx * 131)
        self.bg_img = paint_background(self.bg, rng)
        self.speck = make_speckles(rng) if sum(self.bg) > 30 else None


def paint_background(color, rng):
    img = Image.new("RGB", (PANEL_W, PANEL_H), color)
    if sum(color) < 30:
        return img
    draw = ImageDraw.Draw(img)
    for _ in range(34):
        y = rng.uniform(-20, PANEL_H + 20)
        a = rng.normal(0, 3)
        x0 = rng.uniform(-80, 200)
        x1 = rng.uniform(520, 800)
        pts = catmull([(x0, y), ((x0 + x1) / 2, y + rng.normal(0, 8) + math.tan(math.radians(a)) * 300),
                       (x1, y + math.tan(math.radians(a)) * (x1 - x0))])
        c = tint(color, rng.choice([0.035, 0.06, -0.03, -0.045]))
        raster_lines(draw, dry_bristles(pts, rng.uniform(24, 64), c, rng, bristles=6, dryness=0.5, spacing=10))
    return img


def make_speckles(rng):
    """Clusters of tiny dots, like flicked paint / dusty paper."""
    xs, ys = [], []
    for _ in range(40):
        cx, cy = rng.uniform(0, PANEL_W), rng.uniform(0, PANEL_H)
        n = int(rng.integers(6, 16))
        xs.append(cx + rng.normal(0, 7, n))
        ys.append(cy + rng.normal(0, 7, n))
    xs.append(rng.uniform(0, PANEL_W, 70))
    ys.append(rng.uniform(0, PANEL_H, 70))
    return np.concatenate(xs), np.concatenate(ys)


def apply_speckles(arr, speck, variant):
    xs, ys = speck
    rng = np.random.default_rng(variant * 31 + 5)
    keep = rng.random(len(xs)) > 0.2
    x = (xs[keep] + rng.integers(-1, 2, keep.sum())).astype(int)
    y = (ys[keep] + rng.integers(-1, 2, keep.sum())).astype(int)
    x = np.clip(np.concatenate([x, x + 1, x, x + 1]), 0, PANEL_W - 1)
    y = np.clip(np.concatenate([y, y, y + 1, y + 1]), 0, PANEL_H - 1)
    px = arr[y, x].astype(float)
    lum = px @ np.array([0.3, 0.59, 0.11])
    f = np.where(lum < 95, 1.45, 0.72)[:, None]
    arr[y, x] = np.clip(px * f + np.where(lum < 95, 12, 0)[:, None], 0, 255).astype(np.uint8)


def render_panel(scene, variant, progs):
    img = scene.bg_img.copy()
    draw = ImageDraw.Draw(img)
    for op, p in zip(scene.ops, progs):
        if p <= 0:
            continue
        if op.kind == "stroke":
            P, wid = boiled(op, variant)
            raster_stroke(draw, P, wid, op.color, p)
        else:
            raster_fill(img, op, variant, p)
    arr = np.array(img)
    if scene.speck is not None:
        apply_speckles(arr, scene.speck, variant)
    return arr


def build_scenes():
    specs = sorted(SCENES, key=lambda s: s["start"])
    ends = [s["start"] for s in specs[1:]] + [VIDEO_SECONDS]
    return [Scene(i, s, e) for i, (s, e) in enumerate(zip(specs, ends))]


def frame_key(scenes, f):
    t = f / FPS
    si = max((i for i, s in enumerate(scenes) if s.start <= t + 1e-9), default=0)
    sc = scenes[si]
    lt = t - sc.start
    variant = (f // BOIL_EVERY) % BOIL_VARIANTS
    progs = tuple(round(op.progress(lt), 3) for op in sc.ops)
    return (si, variant, progs)


_SCENES = None


def _render_key(key):
    si, variant, progs = key
    return render_panel(_SCENES[si], variant, progs)


def to_frame(panel):
    frame = np.zeros((H, W, 3), np.uint8)
    frame[PANEL_Y:PANEL_Y + PANEL_H] = panel
    return frame


def find_ffmpeg():
    if os.environ.get("FFMPEG"):
        return os.environ["FFMPEG"]
    try:
        import imageio_ffmpeg
        return imageio_ffmpeg.get_ffmpeg_exe()
    except Exception:
        exe = shutil.which("ffmpeg")
        if exe:
            return exe
    sys.exit("ffmpeg not found: pip install imageio-ffmpeg (or install ffmpeg and/or set FFMPEG=/path/to/ffmpeg)")


def render_video(out, jobs):
    global _SCENES
    t_start = time.time()
    _SCENES = build_scenes()
    nframes = int(round(VIDEO_SECONDS * FPS))
    keys = [frame_key(_SCENES, f) for f in range(nframes)]
    order, last_use = [], {}
    for f, k in enumerate(keys):
        if k not in last_use:
            order.append(k)
        last_use[k] = f
    print(f"{len(_SCENES)} scenes, {nframes} frames, {len(order)} unique paintings, {jobs} workers")

    cmd = [find_ffmpeg(), "-y", "-hide_banner", "-loglevel", "error",
           "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
           "-an", "-vf", "scale=out_color_matrix=bt709:out_range=tv,format=yuv420p",
           "-c:v", "libx264", "-preset", "slow", "-crf", "17", "-tune", "animation",
           "-profile:v", "high", "-level", "4.0", "-pix_fmt", "yuv420p",
           "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709", "-color_range", "tv",
           "-movflags", "+faststart", out]
    enc = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    cache = {}
    with Pool(jobs) as pool:
        results = pool.imap(_render_key, order, chunksize=2)
        for f, k in enumerate(keys):
            if k not in cache:          # `order` is first-use order, so the next result is k
                cache[k] = next(results)
            enc.stdin.write(to_frame(cache[k]).tobytes())
            if last_use[k] == f:
                cache[k] = None
            if f % 90 == 0:
                print(f"  frame {f:4d}/{nframes}  ({time.time() - t_start:5.1f}s)", flush=True)
    enc.stdin.close()
    if enc.wait() != 0:
        sys.exit("ffmpeg failed")
    print(f"wrote {out} in {time.time() - t_start:.1f}s")


def render_still(t, out):
    scenes = build_scenes()
    k = frame_key(scenes, int(round(t * FPS)))
    Image.fromarray(to_frame(render_panel(scenes[k[0]], k[1], k[2]))).save(out)
    print(f"wrote {out}")


def render_sheet(out):
    scenes = build_scenes()
    thumbs = []
    for s in scenes:
        t = s.start + (s.end - s.start) * 0.85
        k = frame_key(scenes, int(round(t * FPS)))
        thumbs.append(Image.fromarray(render_panel(scenes[k[0]], k[1], k[2])))
    cols = 3
    rows = (len(thumbs) + cols - 1) // cols
    sheet = Image.new("RGB", (cols * PANEL_W + (cols + 1) * 12, rows * PANEL_H + (rows + 1) * 12), (0, 0, 0))
    for i, th in enumerate(thumbs):
        sheet.paste(th, (12 + (i % cols) * (PANEL_W + 12), 12 + (i // cols) * (PANEL_H + 12)))
    sheet.save(out)
    print(f"wrote {out}")


def main():
    ap = argparse.ArgumentParser(description="Render the hand-painted lyric video.")
    ap.add_argument("--out", default="lyric_video.mp4")
    ap.add_argument("--jobs", type=int, default=os.cpu_count() or 2)
    ap.add_argument("--still", type=float, help="render one frame at this time (s) to a PNG instead")
    ap.add_argument("--sheet", action="store_true", help="render a contact sheet PNG, one frame per scene")
    a = ap.parse_args()
    if a.still is not None:
        render_still(a.still, os.path.splitext(a.out)[0] + f"_{a.still:05.2f}s.png")
    elif a.sheet:
        render_sheet(os.path.splitext(a.out)[0] + "_sheet.png")
    else:
        render_video(a.out, max(1, a.jobs))


if __name__ == "__main__":
    main()
