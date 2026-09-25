#!/usr/bin/env python3
"""
Stair-landing dance: a 15-second, silent, 720x1280 / 30 fps loop painted
entirely in code.

Seven original characters dance on a two-level stair landing. Three rounded
dancers bounce on the floor and four slim dancers dance along the upper
walkway. Walls, stairs, railings, shadows and characters are all procedural,
slightly rough brush strokes. No images, footage, 3D models, fonts or
watermarks are used.

Each frame is painted once as "material" numbers. Each colour version is a
palette lookup on that painting, so the rapid colour cuts always show exactly
the same scene.

    pip install -r requirements.txt
    python stair_dance.py                  # writes stair_dance.mp4

    python stair_dance.py --still 5.2      # a single PNG frame
    python stair_dance.py --sheet          # every colour version side by side

Everything you are likely to edit is in parts 1-3: tempo and cuts, colours,
choreography.
"""

import argparse
import math
import os
import shutil
import subprocess
import sys
import time
from multiprocessing import Pool

import numpy as np
from PIL import Image, ImageChops, ImageDraw

# =============================================================================
# 1. TEMPO, CUTS AND CAMERA
# =============================================================================
#
# All timing hangs off one musical grid. A "slot" is one eighth note.
# The default grid matches the reference: 147.3 BPM, so a colour cut every
# ~6 frames, with beat 0 at 0.124 s. Change BPM / BEAT0 to fit your track.
# The cuts and the dancing both follow.

FPS = 30
DURATION = 15.0          # seconds
BPM = 147.3
BEAT0 = 0.124            # time (s) of the first beat

# One bar of colour cuts, one version per eighth note.
BAR = ["magenta", "yellow", "green", "yellow", "deep_blue", "gray", "near_black", "silver"]


def bar(shot="wide", colours=BAR):
    return [(1, c, shot) for c in colours]


# (length in eighth notes, colour version, camera shot). Played in order.
# The last entry runs to the end. "black" is a pure black flash.
TIMELINE = [
    # close shot on the three rounded dancers
    (1, "green",      "close"),
    (1, "yellow",     "close"),
    (1, "deep_blue",  "close"),
    (3, "gray",       "close"),
    (1, "magenta",    "close"),
    (1, "silver",     "close"),
    (1, "green",      "close"),
    (1, "yellow",     "close"),
    (1, "deep_blue",  "close"),
    (3, "gray",       "close"),
    (1, "magenta",    "close"),
    (1, "near_black", "close"),
    (1, "black",      "close"),    # black flash into the wide shot
    # wide shot of the whole stair landing, cutting every eighth note
    (1, "gray",       "wide"),
    *bar(), *bar(), *bar(), *bar(),
    *bar()[:5],
    # deep-blue hold with a slow push-in until the end
    (99, "deep_blue_night", "push"),
]

# Extra short black flashes: (eighth-note index from beat 0, length in frames).
FLASHES = [(26, 2), (42, 2), (55, 2)]

# Camera shots. zoom 1 = the whole set; center is in set pixels (720 x 800).
# A (start, end) pair eases from one value to the other over the shot.
CAMERAS = {
    "close": {"zoom": 1.6, "center": (450, 552)},
    "wide":  {"zoom": 1.0, "center": (360, 400)},
    "push":  {"zoom": (1.0, 1.07), "center": ((360, 400), (378, 424))},
}

# =============================================================================
# 2. COLOURS
# =============================================================================
#
# Each version needs a "key" colour. Walls, floor, stairs and railings are
# worked out as lighter and darker shades of it. The dancers stay neutral,
# lightly tinted by the key ("tint"), and "accent" colours the hats, bows,
# ties and cheeks. "dim" darkens the dancers (for the near-black and night
# versions).

VERSIONS = {
    "yellow":          {"key": (255, 226, 0),   "accent": (236, 0, 150)},
    "magenta":         {"key": (236, 0, 186),   "accent": (255, 226, 0)},
    "green":           {"key": (60, 255, 30),   "accent": (236, 0, 186)},
    "deep_blue":       {"key": (20, 40, 212),   "accent": (255, 226, 0)},
    "gray":            {"key": (148, 148, 150), "accent": (60, 60, 64)},
    "silver":          {"key": (232, 232, 230), "accent": (96, 96, 100)},
    "near_black":      {"key": (22, 22, 26),    "accent": (64, 64, 70), "dim": 0.34, "ink": (0, 0, 0)},
    "deep_blue_night": {"key": (10, 22, 132),   "accent": (70, 110, 255), "tint": 0.42, "dim": 0.62,
                        "ink": (4, 6, 26)},
}

# Neutral character colours before tinting.
CHARACTER_COLOURS = {
    "round":       (234, 231, 224),
    "round_shade": (166, 166, 172),
    "leg":         (40, 38, 44),
    "shoe":        (16, 16, 18),
    "suit":        (32, 32, 38),
    "suit_hi":     (72, 72, 84),
    "shirt":       (240, 240, 236),
    "skin":        (210, 202, 194),
    "hair":        (28, 26, 28),
}

# =============================================================================
# 3. CHOREOGRAPHY
# =============================================================================
#
# A move is a loop of key poses, positioned in beats. Pose values:
#   x, y      body shift in pixels (y > 0 is down)
#   tilt      lean in degrees (> 0 leans right); head: extra head tilt
#   la, ra    left / right upper arm: 0 hangs down, 90 is straight out,
#             180 is straight up, negative crosses in front of the body
#   le, re    elbow bend added to the forearm (same scale)
#   lfx, lfy, rfx, rfy   foot offsets from standing position (lfy < 0 lifts)
#   sq        squash and stretch (rounded dancers)
# Move options:
#   beats     loop length; ease: "smooth" (flowing) or "snap" (hit and hold)
#   groove    dip on every beat (px); hop: jump between beats (px)
#   squash    extra squash on each landing

MOVES = {
    # ---- rounded dancers -------------------------------------------------
    "sway": {"beats": 2, "ease": "smooth", "groove": 9, "squash": 0.08, "keys": [
        (0, dict(x=-12, tilt=-8, head=-10, la=112, le=22, ra=-48, re=34)),
        (1, dict(x=12, tilt=8, head=10, la=-48, le=34, ra=112, re=22)),
    ]},
    "raise_roof": {"beats": 2, "ease": "smooth", "groove": 10, "squash": 0.09, "keys": [
        (0.0, dict(la=166, le=26, ra=166, re=26, tilt=-6, head=8)),
        (0.5, dict(la=138, le=-24, ra=138, re=-24)),
        (1.0, dict(la=166, le=26, ra=166, re=26, tilt=6, head=-8)),
        (1.5, dict(la=138, le=-24, ra=138, re=-24)),
    ]},
    "step_clap": {"beats": 4, "ease": "smooth", "groove": 6, "squash": 0.06, "keys": [
        (0.0, dict(la=34, ra=34)),
        (0.5, dict(x=10, lfx=14, lfy=-16, la=76, le=40, ra=40)),
        (1.0, dict(x=20, lfx=20, rfx=20, la=164, le=38, ra=164, re=38, head=8)),
        (1.5, dict(x=10, lfx=20, rfx=8, rfy=-16, la=76, ra=76)),
        (2.0, dict(la=34, ra=34)),
        (2.5, dict(x=-10, rfx=-14, rfy=-16, ra=76, re=40, la=40)),
        (3.0, dict(x=-20, lfx=-20, rfx=-20, la=164, le=38, ra=164, re=38, head=-8)),
        (3.5, dict(x=-10, rfx=-20, lfx=-8, lfy=-16, la=76, ra=76)),
    ]},
    "hop_finale": {"beats": 1, "ease": "smooth", "hop": 18, "groove": 4, "squash": 0.12, "keys": [
        (0.0, dict(la=118, le=34, ra=118, re=34)),
        (0.5, dict(la=156, le=8, ra=156, re=8)),
    ]},
    # ---- slim dancers ----------------------------------------------------
    "disco_point": {"beats": 2, "ease": "snap", "groove": 6, "keys": [
        (0, dict(ra=146, re=0, la=36, le=-112, x=6, tilt=6, head=-8, rfx=4, rfy=-10)),
        (1, dict(ra=-34, re=0, la=36, le=-112, x=-5, tilt=-4, head=8, lfy=-6)),
    ]},
    "arm_wave": {"beats": 2, "ease": "smooth", "groove": 5, "keys": [
        (0, dict(la=150, le=42, ra=150, re=-42, x=-5, tilt=6, head=7)),
        (1, dict(la=150, le=-42, ra=150, re=42, x=5, tilt=-6, head=-7)),
    ]},
    "knee_runner": {"beats": 2, "ease": "smooth", "groove": 8, "keys": [
        (0, dict(lfy=-34, lfx=5, la=52, le=92, ra=8, re=92, tilt=-4)),
        (1, dict(rfy=-34, rfx=-5, la=8, le=92, ra=52, re=92, tilt=4)),
    ]},
    "twist": {"beats": 2, "ease": "smooth", "groove": 11, "keys": [
        (0, dict(tilt=11, x=-6, la=78, le=86, ra=16, re=86, lfx=-6, rfx=6, head=-6)),
        (1, dict(tilt=-11, x=6, la=16, le=86, ra=78, re=86, lfx=6, rfx=-6, head=6)),
    ]},
    "wave_line": {"beats": 2, "ease": "smooth", "groove": 7, "keys": [
        (0.0, dict(la=160, le=10, ra=160, re=10, tilt=0)),
        (0.5, dict(la=120, le=40, ra=120, re=40, tilt=8, x=6)),
        (1.0, dict(la=160, le=10, ra=160, re=10, tilt=0)),
        (1.5, dict(la=120, le=40, ra=120, re=40, tilt=-8, x=-6)),
    ]},
    # ---- everyone: the pose they all hit as the wide shot opens -----------
    "star": {"beats": 1, "ease": "snap", "keys": [
        (0, dict(la=148, le=0, ra=148, re=0, lfx=-9, rfx=9, head=0)),
    ]},
}

# Routines are lists of (start beat, move). A third item shifts that move's
# phase in beats (a canon). Moves blend into each other over BLEND beats.
BLEND = 0.75
WIDE = 8.5      # beat where the wide shot opens (eighth note 17)
FINALE = 27.5   # beat where the deep-blue hold starts (eighth note 55)

DANCERS = [
    # lower floor: three rounded dancers
    {"name": "Plum", "type": "round", "x": 318, "floor": 744, "size": 0.98, "look": "beanie",
     "routine": [(0, "sway"), (WIDE, "star"), (WIDE + 1, "sway"), (FINALE, "hop_finale")]},
    {"name": "Dot", "type": "round", "x": 452, "floor": 752, "size": 1.06, "look": "bow",
     "routine": [(0, "raise_roof"), (WIDE, "star"), (WIDE + 1, "raise_roof"), (FINALE, "hop_finale", 0.5)]},
    {"name": "Mo", "type": "round", "x": 588, "floor": 742, "size": 0.94, "look": "glasses",
     "routine": [(0, "step_clap"), (WIDE, "star"), (WIDE + 1, "step_clap"), (FINALE, "hop_finale")]},
    # upper walkway: four slim dancers
    {"name": "Reed", "type": "slim", "x": 322, "floor": 330, "size": 1.0, "look": "bob",
     "routine": [(0, "disco_point"), (WIDE, "star"), (WIDE + 1, "disco_point"), (FINALE, "wave_line", 0.0)]},
    {"name": "Wick", "type": "slim", "x": 434, "floor": 330, "size": 1.03, "look": "cap",
     "routine": [(0, "arm_wave"), (WIDE, "star"), (WIDE + 1, "arm_wave"), (FINALE, "wave_line", -0.25)]},
    {"name": "Lark", "type": "slim", "x": 546, "floor": 330, "size": 0.97, "look": "bun",
     "routine": [(0, "knee_runner"), (WIDE, "star"), (WIDE + 1, "knee_runner"), (FINALE, "wave_line", -0.5)]},
    {"name": "Stem", "type": "slim", "x": 656, "floor": 330, "size": 1.01, "look": "spikes",
     "routine": [(0, "twist"), (WIDE, "star"), (WIDE + 1, "twist"), (FINALE, "wave_line", -0.75)]},
]

# =============================================================================
# 4. Frame layout and paint settings
# =============================================================================

W, H = 720, 1280
PANEL_W, PANEL_H = 720, 800          # the painted action panel...
PANEL_Y = (H - PANEL_H) // 2         # ...centred, black above and below
SET_W, SET_H = 720, 800              # set coordinates (the wide shot)
SET_VARIANTS = 6                     # redrawn versions of the set (edge flicker)
SET_BOIL = 0.6                       # px the set's paint edges wander
DANCER_BOIL = 0.45                   # px the dancers' paint edges wander per frame
SPACING = 2.6                        # brush stamp spacing
SEED = 4242

# material numbers painted into each frame (colours come from part 2)
MATERIALS = ["wall", "wall_low", "ceil", "light", "floor", "floor_line", "slab", "shadow",
             "tread", "riser", "stringer", "wood", "rail", "door", "glass", "wall_shadow",
             "fig_shadow", "ink", "accent"] + list(CHARACTER_COLOURS)
MAT = {name: i + 1 for i, name in enumerate(MATERIALS)}
LIGHT, DARK, DARKER = 64, 128, 192   # offsets for texture tints of a material


def mix(a, b, t):
    return tuple(float(x) * (1 - t) + float(y) * t for x, y in zip(a, b))


def mul(c, f):
    return tuple(float(x) * f for x in c)


def brighten(c, f):
    return tuple(min(255.0, float(x) * (1 + f)) + (255 - min(255.0, float(x) * (1 + f))) * f * 0.35 for x in c)


def build_lut(name):
    """Material number -> RGB for one colour version."""
    v = VERSIONS[name]
    k = tuple(float(x) for x in v["key"])
    tint, dim = v.get("tint", 0.12), v.get("dim", 1.0)
    base = {
        "wall": k, "wall_low": mul(k, 0.9), "ceil": mul(k, 0.7), "light": brighten(k, 0.2),
        "floor": mul(k, 0.8), "floor_line": mul(k, 0.6), "slab": mul(k, 0.64), "shadow": mul(k, 0.6),
        "tread": brighten(k, 0.06), "riser": mul(k, 0.6), "stringer": mul(k, 0.44), "wood": mul(k, 0.3),
        "rail": mul(k, 0.24), "door": mul(k, 0.4), "glass": brighten(k, 0.32), "wall_shadow": mul(k, 0.78),
        "fig_shadow": mul(k, 0.5), "ink": v.get("ink", (14, 14, 16)), "accent": mul(v["accent"], dim),
    }
    for cname, c in CHARACTER_COLOURS.items():
        base[cname] = mul(mix(c, k, tint), dim)
    lut = np.zeros((256, 3), float)
    for mname, idx in MAT.items():
        c = np.array(base[mname], float)
        lut[idx] = c
        lut[idx + LIGHT] = brighten(c, 0.07)
        lut[idx + DARK] = c * 0.92
        lut[idx + DARKER] = c * 0.76
    return np.clip(np.round(lut), 0, 255).astype(np.uint8)


# =============================================================================
# 5. Brush engine
# =============================================================================

def catmull(pts, closed=False, per=8):
    P = np.asarray(pts, float)
    if len(P) < 3:
        return P
    P = np.vstack([P[-1], P, P[0], P[1]]) if closed else np.vstack([2 * P[0] - P[1], P, 2 * P[-1] - P[-2]])
    t = np.linspace(0, 1, per, endpoint=False)[:, None]
    out = [0.5 * (2 * P[i] + (-P[i - 1] + P[i + 1]) * t
                  + (2 * P[i - 1] - 5 * P[i] + 4 * P[i + 1] - P[i + 2]) * t ** 2
                  + (-P[i - 1] + 3 * P[i] - 3 * P[i + 1] + P[i + 2]) * t ** 3) for i in range(1, len(P) - 2)]
    out.append(P[-2][None])
    return np.vstack(out)


def resample(P, spacing=SPACING, n=None):
    P = np.asarray(P, float)
    if len(P) < 2:
        return np.vstack([P, P + 0.01])
    d = np.concatenate([[0], np.cumsum(np.hypot(*np.diff(P, axis=0).T))])
    if d[-1] < 1e-6:
        return np.vstack([P[:1], P[:1] + 0.01])
    if n is None:
        n = max(2, int(math.ceil(d[-1] / spacing)) + 1)
    s = np.linspace(0, d[-1], n)
    return np.column_stack([np.interp(s, d, P[:, 0]), np.interp(s, d, P[:, 1])])


def normals(P):
    t = np.gradient(P, axis=0)
    t = t / (np.hypot(t[:, 0], t[:, 1])[:, None] + 1e-9)
    return np.column_stack([-t[:, 1], t[:, 0]])


def smooth_noise(n, rng, corr=10.0):
    k = int(n / corr) + 4
    ctrl = rng.normal(size=k)
    x = np.linspace(1, k - 3, n)
    i = np.floor(x).astype(int)
    f = x - i
    f = f * f * (3 - 2 * f)
    return ctrl[i] * (1 - f) + ctrl[i + 1] * f


def rot(v, deg):
    a = math.radians(deg)
    ca, sa = math.cos(a), math.sin(a)
    return np.array([v[0] * ca - v[1] * sa, v[0] * sa + v[1] * ca])


def rot_pts(pts, deg, cx=0.0, cy=0.0):
    a = math.radians(deg)
    ca, sa = math.cos(a), math.sin(a)
    P = np.asarray(pts, float)
    return np.column_stack([P[:, 0] * ca - P[:, 1] * sa + cx, P[:, 0] * sa + P[:, 1] * ca + cy])


def ell(cx, cy, rx, ry=None, rot_deg=0.0, n=36):
    ry = rx if ry is None else ry
    a = np.linspace(-math.pi / 2, 1.5 * math.pi, n, endpoint=False)
    return rot_pts(np.column_stack([rx * np.cos(a), ry * np.sin(a)]), rot_deg, cx, cy)


def arc(cx, cy, rx, ry, a0, a1, n=16):
    a = np.radians(np.linspace(a0, a1, n))
    return np.column_stack([cx + rx * np.cos(a), cy + ry * np.sin(a)])


def rect(x, y, w, h):
    return np.array([(x, y), (x + w, y), (x + w, y + h), (x, y + h)], float)


def smoothstep(u):
    u = min(1.0, max(0.0, u))
    return u * u * (3 - 2 * u)


class Cam:
    def __init__(self, zoom, cx, cy):
        self.zoom, self.cx, self.cy = zoom, cx, cy
        self.key = (round(zoom, 4), round(cx, 2), round(cy, 2))

    def __call__(self, P):
        return (np.asarray(P, float) - (self.cx, self.cy)) * self.zoom + (PANEL_W / 2, PANEL_H / 2)


def raster_stroke(draw, P, wid, idx):
    r = wid / 2
    if len(P) > 1:
        d = P[1:] - P[:-1]
        nr = np.column_stack([-d[:, 1], d[:, 0]]) / (np.hypot(d[:, 0], d[:, 1])[:, None] + 1e-9)
        a, b = P[:-1] + nr * r[:-1, None], P[1:] + nr * r[1:, None]
        c, e = P[1:] - nr * r[1:, None], P[:-1] - nr * r[:-1, None]
        for q in np.stack([a, b, c, e], 1).tolist():
            draw.polygon([tuple(v) for v in q], fill=idx)
    for (x, y), rr in zip(P.tolist(), r.tolist()):
        if rr < 0.7:
            draw.point((x, y), fill=idx)
        else:
            draw.ellipse([x - rr, y - rr, x + rr, y + rr], fill=idx)


def dry_brush(P, width, idx, rng, bristles=5, dryness=0.45, spacing=7.0):
    """Split a broad stroke into bristle lines with dry gaps: (points, width, material) runs."""
    P = resample(P, spacing)
    nrm = normals(P)
    runs = []
    for j in range(bristles):
        off = (j / max(1, bristles - 1) - 0.5) * 0.8 + rng.normal() * 0.05
        Q = P + nrm * (off * width + smooth_noise(len(P), rng, 8) * width * 0.04)[:, None]
        keep = smooth_noise(len(Q), rng, 5) > (dryness * 2 - 1.2) * 0.9
        bw = max(2.0, width / bristles * rng.uniform(1.5, 2.3))
        start = None
        for i, kp in enumerate(list(keep) + [False]):
            if kp and start is None:
                start = i
            elif not kp and start is not None:
                if i - start >= 2:
                    runs.append((Q[start:i], bw, idx))
                start = None
    return runs


def texture_runs(P, idx, rng, passes):
    """A few dry-brush passes in close tints: uneven, layered paint inside a fill."""
    x0, y0 = P.min(0)
    x1, y1 = P.max(0)
    w, h = x1 - x0, y1 - y0
    ang = rng.uniform(-20, 20) + (90 if h > w * 1.8 else 0)
    runs = []
    for _ in range(passes):
        cx, cy = rng.uniform(x0, x1), rng.uniform(y0, y1)
        L = rng.uniform(0.5, 1.0) * math.hypot(w, h) * 0.7
        a = math.radians(ang + rng.normal(0, 7))
        dx, dy = math.cos(a) * L / 2, math.sin(a) * L / 2
        path = catmull([(cx - dx, cy - dy), (cx + rng.normal(0, 6), cy + rng.normal(0, 6)), (cx + dx, cy + dy)])
        bw = float(np.clip(min(w, h) * rng.uniform(0.14, 0.32), 5, 70))
        tint = int(rng.choice([LIGHT, DARK]))
        runs += dry_brush(path, bw, idx + tint, rng, bristles=int(rng.integers(3, 6)))
    return runs


class Canvas:
    """Paints brush strokes (given in set coordinates) into a material image."""

    def __init__(self, img, cam, fseed):
        self.img, self.cam, self.fseed = img, cam, fseed
        self.draw = ImageDraw.Draw(img)

    def _prep(self, pts, smooth, closed, n):
        P = np.asarray(pts, float)
        if smooth and len(P) >= 3:
            P = catmull(P, closed)
        elif closed:
            P = np.vstack([P, P[:1]])
        return resample(P, n=n)

    def _boil(self, seed, n, amp):
        rb = np.random.default_rng((seed * 1000003 + self.fseed * 7919 + 11) % (2 ** 32))
        return smooth_noise(n, rb, 8) * amp, rb

    def stroke(self, pts, width, idx, seed, n=None, wobble=1.0, boil=DANCER_BOIL, taper=0.65,
               smooth=False, closed=False):
        P = self._prep(pts, smooth, closed, n)
        rs = np.random.default_rng(seed)
        m = len(P)
        d = smooth_noise(m, rs, 12) * wobble
        wid = width * (1 + 0.12 * smooth_noise(m, rs, 8))
        if boil:
            db, rb = self._boil(seed, m, boil)
            d = d + db
            wid = wid * (1 + 0.05 * smooth_noise(m, rb, 6))
        if taper < 1 and m > 4:
            u = np.linspace(0, 1, m)
            wid = wid * np.clip(np.minimum(u, 1 - u) / 0.12, taper, 1.0)
        P = P + normals(P) * d[:, None]
        raster_stroke(self.draw, self.cam(P), np.maximum(wid * self.cam.zoom, 1.0), idx)

    def fill(self, pts, idx, seed, n=None, wobble=1.2, boil=DANCER_BOIL, smooth=False, clip=None, texture=0):
        P = self._prep(pts, smooth, True, n)
        rs = np.random.default_rng(seed)
        m = len(P)
        d = smooth_noise(m, rs, 12) * wobble
        if boil:
            d = d + self._boil(seed, m, boil)[0]
        d -= (d[-1] - d[0]) * np.linspace(0, 1, m)
        P = P + normals(P) * d[:, None]
        Q = self.cam(P)
        x0, y0 = int(max(0, math.floor(Q[:, 0].min()) - 2)), int(max(0, math.floor(Q[:, 1].min()) - 2))
        x1 = int(min(PANEL_W, math.ceil(Q[:, 0].max()) + 2))
        y1 = int(min(PANEL_H, math.ceil(Q[:, 1].max()) + 2))
        if x1 <= x0 or y1 <= y0:
            return
        size, off = (x1 - x0, y1 - y0), np.array([x0, y0], float)
        mask = Image.new("L", size, 0)
        ImageDraw.Draw(mask).polygon([tuple(v) for v in (Q - off).tolist()], fill=255)
        if clip is not None:
            cm = Image.new("L", size, 0)
            ImageDraw.Draw(cm).polygon([tuple(v) for v in (self.cam(clip) - off).tolist()], fill=255)
            mask = ImageChops.multiply(mask, cm)
        tile = Image.new("L", size, idx)
        if texture:
            td = ImageDraw.Draw(tile)
            jx, jy = np.random.default_rng(seed + self.fseed).normal(size=2) * 0.35
            for pts2, bw, tidx in texture_runs(P, idx, rs, texture):
                q = (self.cam(pts2) - off + (jx, jy)).tolist()
                bwz = max(1, int(round(bw * self.cam.zoom)))
                td.line([tuple(v) for v in q], fill=tidx, width=bwz, joint="curve")
                rr = bwz / 2
                for x, y in (q[0], q[-1]):
                    td.ellipse([x - rr, y - rr, x + rr, y + rr], fill=tidx)
        self.img.paste(tile, (x0, y0), mask)


class Seeds:
    def __init__(self, base):
        self.n = base

    def __call__(self):
        self.n += 1
        return self.n


# =============================================================================
# 6. The set: two-level stair landing
# =============================================================================

M = MAT
STAIR_BL, STAIR_TL, STAIR_BR, STAIR_TR = (-100, 812), (146, 332), (156, 812), (252, 332)
BALUSTERS = list(range(290, 740, 30))


def _edge(a, b, y):
    v = (a[1] - y) / (a[1] - b[1])
    return a[0] + (b[0] - a[0]) * v


def paint_set(cv):
    S = Seeds(SEED)
    b = SET_BOIL
    # ---- upper level ------------------------------------------------------
    cv.fill(rect(-40, -40, 800, 376), M["wall"], S(), wobble=0, boil=0, texture=7)
    cv.fill(ell(478, 206, 276, 116, n=60), M["light"], S(), wobble=7, boil=b, texture=4)
    # window above the stairs
    cv.fill(rect(30, 92, 150, 196), M["glass"], S(), wobble=1.5, boil=b, texture=3)
    for x in (105,):
        cv.stroke([(x, 94), (x, 286)], 7, M["wood"], S(), wobble=1.0, boil=b)
    cv.stroke([(32, 190), (178, 188)], 7, M["wood"], S(), wobble=1.0, boil=b)
    cv.stroke(rect(30, 92, 150, 196), 9, M["wood"], S(), closed=True, wobble=1.2, boil=b, taper=1)
    cv.stroke(rect(24, 86, 162, 208), 4, M["ink"], S(), closed=True, wobble=1.2, boil=b, taper=1)
    # tall doorway, upper right
    cv.fill(rect(648, 128, 64, 206), M["door"], S(), wobble=1.2, boil=b, texture=2)
    cv.stroke([(644, 334), (644, 124), (716, 124), (716, 334)], 8, M["wood"], S(), wobble=1.0, boil=b)
    # ceiling
    cv.fill([(-40, -40), (760, -40), (760, 30), (-40, 46)], M["ceil"], S(), wobble=2, boil=b, texture=3)
    cv.stroke([(-40, 46), (760, 30)], 5, M["ink"], S(), wobble=1.4, boil=b, taper=1)
    # railing shadows thrown on the upper wall
    cv.stroke([(262, 230), (760, 226)], 9, M["shadow"], S(), wobble=1.5, boil=b, taper=1)
    for x in BALUSTERS:
        cv.stroke([(x + 20, 318), (x + 26, 236)], 5, M["shadow"], S(), wobble=0.8, boil=b, taper=1)
    # ---- lower level ------------------------------------------------------
    cv.fill(rect(-40, 332, 800, 316), M["wall_low"], S(), wobble=0, boil=0, texture=6)
    cv.fill(ell(452, 532, 250, 98, n=60), M["light"], S(), wobble=8, boil=b, texture=3)
    cv.fill([(252, 372), (760, 372), (760, 426), (252, 402)], M["shadow"], S(), wobble=3, boil=b, texture=2)
    cv.fill(rect(580, 452, 100, 194), M["door"], S(), wobble=1.2, boil=b, texture=2)
    cv.stroke([(576, 646), (576, 448), (684, 448), (684, 646)], 8, M["wood"], S(), wobble=1.0, boil=b)
    cv.stroke([(-40, 568), (760, 564)], 6, M["wood"], S(), wobble=1.3, boil=b, taper=1)
    cv.fill([(-40, 628), (760, 626), (760, 648), (-40, 648)], M["stringer"], S(), wobble=1.2, boil=b)
    cv.stroke([(-40, 628), (760, 625)], 4, M["ink"], S(), wobble=1.0, boil=b, taper=1)
    # floor with boards running away from us
    cv.fill(rect(-40, 646, 800, 200), M["floor"], S(), wobble=0, boil=0, texture=8)
    vp = (402, 420)
    for xt in range(-140, 900, 50):
        xb = vp[0] + (xt - vp[0]) * (812 - vp[1]) / (646 - vp[1])
        cv.stroke([(xt, 648), (xb, 812)], 3, M["floor_line"], S(), wobble=0.8, boil=b, taper=1)
    for y in (690, 752):
        cv.stroke([(-40, y), (760, y + 2)], 2.5, M["floor_line"], S(), wobble=0.8, boil=b, taper=1)
    # ---- stairs up to the walkway ----------------------------------------
    n, r = 13, 0.93
    h0 = (STAIR_BL[1] - STAIR_TL[1]) * (1 - r) / (1 - r ** n)
    bands, y = [], float(STAIR_BL[1])
    for k in range(n):
        bands.append((y, y - h0 * r ** k))
        y -= h0 * r ** k
    for yb, yt in reversed(bands):                       # far steps first
        tf = float(np.clip((yb - 520) / 300, 0.1, 0.42))
        yr = yb - (yb - yt) * (1 - tf)
        xl = lambda yy: _edge(STAIR_BL, STAIR_TL, yy)
        xr = lambda yy: _edge(STAIR_BR, STAIR_TR, yy)
        cv.fill([(xl(yb), yb), (xr(yb), yb), (xr(yr), yr), (xl(yr), yr)], M["riser"], S(), wobble=0.8, boil=b)
        cv.fill([(xl(yr), yr), (xr(yr), yr), (xr(yt), yt), (xl(yt), yt)], M["tread"], S(), wobble=0.8, boil=b)
        cv.stroke([(xl(yr) - 2, yr), (xr(yr) + 2, yr)], 4, M["ink"], S(), wobble=0.7, boil=b, taper=1)
        cv.stroke([(xl(yb), yb - 2), (xr(yb), yb - 2)], 3, M["riser"] + DARKER, S(), wobble=0.7, boil=b, taper=1)
    cv.stroke([STAIR_BL, STAIR_TL], 5, M["ink"], S(), wobble=1.2, boil=b, taper=1)
    cv.fill([STAIR_TR, (278, 340), (184, 812), STAIR_BR], M["stringer"], S(), wobble=1.0, boil=b, texture=2)
    cv.stroke([STAIR_BR, STAIR_TR], 5, M["ink"], S(), wobble=1.2, boil=b, taper=1)
    cv.stroke([(184, 812), (278, 340)], 4, M["ink"], S(), wobble=1.2, boil=b, taper=1)
    # stair handrail
    tops = []
    for yy in (792, 704, 616, 528, 446, 372):
        bx = _edge(STAIR_BR, STAIR_TR, yy) + 14
        sd = S()
        cv.stroke([(bx, yy - 4), (bx + 5, yy - 96)], 11, M["ink"], sd, wobble=0.6, boil=b, taper=1)
        cv.stroke([(bx, yy - 4), (bx + 5, yy - 96)], 6, M["wood"], sd, wobble=0.6, boil=b, taper=1)
        tops.append((bx + 5, yy - 96))
    rail = [(tops[0][0] - 6, tops[0][1] + 28)] + tops + [(262, 248)]
    sd = S()
    cv.stroke(rail, 19, M["ink"], sd, smooth=True, wobble=1.2, boil=b, taper=1)
    cv.stroke(rail, 12, M["wood"], sd, smooth=True, wobble=1.2, boil=b, taper=1)
    cv.stroke([(v[0] - 3, v[1] - 3) for v in rail], 3, M["wood"] + LIGHT, S(), smooth=True, wobble=0.8,
              boil=b, taper=1)
    cv.stroke([(184, 820), (182, 700)], 20, M["ink"], S(), wobble=0.8, boil=b, taper=1)
    cv.stroke([(184, 820), (182, 700)], 14, M["wood"], S(), wobble=0.8, boil=b, taper=1)
    cv.fill(ell(182, 694, 12, 10), M["wood"], S(), wobble=0.8, boil=b)
    cv.stroke(ell(182, 694, 12, 10), 3.5, M["ink"], S(), closed=True, wobble=0.6, boil=b, taper=1)
    # ---- walkway slab -----------------------------------------------------
    cv.fill([(252, 330), (760, 330), (760, 374), (252, 374)], M["slab"], S(), wobble=1.2, boil=b, texture=3)
    cv.stroke([(254, 335), (760, 333)], 4, M["slab"] + LIGHT, S(), wobble=0.8, boil=b, taper=1)
    cv.stroke([(252, 374), (760, 374)], 5, M["ink"], S(), wobble=1.2, boil=b, taper=1)
    cv.stroke([(252, 330), (252, 374)], 5, M["ink"], S(), wobble=0.8, boil=b, taper=1)


def paint_railing(cv):
    """Walkway railing, painted over the upper dancers."""
    S = Seeds(SEED + 5000)
    b = SET_BOIL
    for x in BALUSTERS:
        sd = S()
        cv.stroke([(x, 254), (x + 0.5, 324)], 9, M["ink"], sd, wobble=0.6, boil=b, taper=1)
        cv.stroke([(x, 254), (x + 0.5, 324)], 5.5, M["rail"], sd, wobble=0.6, boil=b, taper=1)
    for pts, w in (([(256, 324), (760, 322)], 7), ([(254, 250), (760, 247)], 10)):
        sd = S()
        cv.stroke(pts, w + 5, M["ink"], sd, wobble=1.0, boil=b, taper=1)
        cv.stroke(pts, w, M["rail"], sd, wobble=1.0, boil=b, taper=1)
        cv.stroke([(pts[0][0] + 6, pts[0][1] - w * 0.25), (pts[1][0], pts[1][1] - w * 0.25)], 2.5,
                  M["rail"] + LIGHT, S(), wobble=0.8, boil=b, taper=1)
    sd = S()
    cv.stroke([(258, 238), (258, 334)], 16, M["ink"], sd, wobble=0.6, boil=b, taper=1)
    cv.stroke([(258, 238), (258, 334)], 11, M["rail"], sd, wobble=0.6, boil=b, taper=1)


# =============================================================================
# 7. Characters: pose evaluation, rig and painting
# =============================================================================

POSE_KEYS = ("x", "y", "tilt", "head", "sq", "la", "le", "ra", "re", "lfx", "lfy", "rfx", "rfy")
REST = dict(x=0, y=0, tilt=0, head=0, sq=0, la=16, le=10, ra=16, re=10, lfx=0, lfy=0, rfx=0, rfy=0)


def move_pose(name, b):
    mv = MOVES[name]
    L = float(mv["beats"])
    keys = sorted(mv["keys"], key=lambda k: k[0])
    kb = [float(k[0]) for k in keys]
    kv = [np.array([{**REST, **k[1]}[p] for p in POSE_KEYS], float) for k in keys]
    n = len(keys)
    bl = b % L
    if n == 1:
        val = kv[0]
    else:
        if bl < kb[0]:
            i, b0, b1 = n - 1, kb[-1] - L, kb[0]
        else:
            i = max(j for j in range(n) if kb[j] <= bl)
            b0, b1 = kb[i], (kb[i + 1] if i + 1 < n else kb[0] + L)
        j = (i + 1) % n
        u = (bl - b0) / (b1 - b0)
        if mv.get("ease") == "snap":
            val = kv[i] + (kv[j] - kv[i]) * smoothstep(u / 0.75)
        else:
            p0, p1, p2, p3 = kv[(i - 1) % n], kv[i], kv[j], kv[(j + 1) % n]
            val = 0.5 * (2 * p1 + (-p0 + p2) * u + (2 * p0 - 5 * p1 + 4 * p2 - p3) * u ** 2
                         + (-p0 + 3 * p1 - 3 * p2 + p3) * u ** 3)
    pose = dict(zip(POSE_KEYS, val.tolist()))
    ph = 2 * math.pi * b
    pose["y"] += mv.get("groove", 0) * (0.5 + 0.5 * math.cos(ph))
    pose["sq"] += mv.get("squash", 0) * max(0.0, math.cos(ph)) ** 4
    hop = mv.get("hop", 0) * abs(math.sin(math.pi * b)) ** 1.2
    pose["y"] -= hop
    pose["lfy"] -= hop
    pose["rfy"] -= hop
    pose["hop"] = hop
    return pose


def dancer_pose(d, b):
    routine = d["routine"]
    cur = max([i for i, r in enumerate(routine) if r[0] <= b] or [0])

    def ev(entry):
        return move_pose(entry[1], b + (entry[2] if len(entry) > 2 else 0.0))

    p = ev(routine[cur])
    if cur > 0 and b - routine[cur][0] < BLEND:
        q = ev(routine[cur - 1])
        w = smoothstep((b - routine[cur][0]) / BLEND)
        p = {k: q[k] + (p[k] - q[k]) * w for k in p}
    return p


def ik(hip, foot, l1, l2, side):
    """Two-bone leg: returns knee and (reachable) foot; the knee bends outward."""
    d = foot - hip
    dist = float(np.hypot(*d)) + 1e-9
    dc = min(max(dist, abs(l1 - l2) + 1e-3), l1 + l2 - 1e-3)
    u = d / dist
    a = math.acos(max(-1.0, min(1.0, (l1 * l1 + dc * dc - l2 * l2) / (2 * l1 * dc))))
    base = math.atan2(u[1], u[0])
    k1 = hip + l1 * np.array([math.cos(base + a), math.sin(base + a)])
    k2 = hip + l1 * np.array([math.cos(base - a), math.sin(base - a)])
    knee = k1 if (k1[0] - k2[0]) * side > 0 else k2
    return knee, hip + u * dc


def arm(shoulder, a, e, tilt, side, l1, l2):
    def dv(ang):
        r = math.radians(ang)
        return rot((side * math.sin(r), math.cos(r)), tilt)
    elbow = shoulder + l1 * dv(a)
    return elbow, elbow + l2 * dv(a + e)


class Pen:
    """Brush calls for one character. With `shadow` set, paints its flat silhouette instead."""

    def __init__(self, cv, seed, shadow=None):
        self.cv, self.seed = cv, seed
        self.off = None if shadow is None else np.asarray(shadow, float)

    def _m(self, mat):
        return M["wall_shadow"] if self.off is not None else (M[mat] if isinstance(mat, str) else mat)

    def _p(self, pts):
        P = np.asarray(pts, float)
        return P if self.off is None else P + self.off

    def fill(self, part, pts, mat, n=48, detail=False, clip=None, wobble=0.8):
        if detail and self.off is not None:
            return
        self.cv.fill(self._p(pts), self._m(mat), self.seed + part, n=n, wobble=wobble,
                     clip=None if clip is None else self._p(clip))

    def stroke(self, part, pts, width, mat, n=None, detail=False, wobble=0.6, taper=0.7, closed=False):
        if detail and self.off is not None:
            return
        self.cv.stroke(self._p(pts), width, self._m(mat), self.seed + part, n=n, wobble=wobble,
                       taper=taper, closed=closed)

    def tube(self, part, pts, width, mat, line=2.5, n=18):
        self.stroke(part, pts, width + 2 * line, "ink", n=n, taper=1.0)
        self.stroke(part, pts, width, mat, n=n, taper=1.0)

    def blob(self, part, c, rx, ry, mat, line=2.2, tilt=0.0, n=28, detail=False):
        pts = ell(c[0], c[1], rx, ry, tilt, n=n)
        self.fill(part, pts, mat, n=n, detail=detail)
        if line:
            self.stroke(part + 500, pts, line, "ink", n=n + 4, closed=True, taper=1.0, detail=detail)


def draw_round(pen, d, p, di, b):
    s = d["size"]
    x0, fy = d["x"], d["floor"]
    tilt, sq = p["tilt"], p["sq"]
    P = np.array([x0 + p["x"], fy - 36 * s + p["y"]])
    bw, bh = 98 * s * (1 + 0.8 * sq), 112 * s * (1 - sq)
    C = P + rot((0, 10 * s - bh / 2), tilt)
    # legs + shoes
    for side, fx, fyo, part in ((-1, p["lfx"], p["lfy"], 10), (1, p["rfx"], p["rfy"], 20)):
        hip = P + rot((side * 17 * s, 0), tilt * 0.4)
        foot = np.array([x0 + side * 19 * s + fx, fy + fyo])
        knee, foot = ik(hip, foot, 24 * s, 24 * s, side)
        pen.tube(part, [hip, knee, foot], 13 * s, "leg", line=3 * s)
        pen.blob(part + 1, foot + (side * 5 * s, 2 * s), 14 * s, 7.5 * s, "shoe", line=2.5 * s)
    # body: paint, shade, highlight, outline
    t = np.linspace(-math.pi / 2, 1.5 * math.pi, 64, endpoint=False)
    local = np.column_stack([np.cos(t) * (1 + 0.1 * np.sin(t)) * bw / 2, np.sin(t) * bh / 2])
    body = C + rot_pts(local, tilt)
    pen.fill(30, body, "round", n=64)
    pen.fill(31, C + rot_pts(local * 0.96 + (0.24 * bw, 0.1 * bh), tilt), "round_shade", n=64, clip=body,
             detail=True)
    pen.stroke(32, [C + rot((-0.3 * bw, -0.2 * bh), tilt), C + rot((-0.16 * bw, -0.36 * bh), tilt)],
               9 * s, M["round"] + LIGHT, n=10, detail=True)
    pen.stroke(33, body, 4.5 * s, "ink", n=70, closed=True, taper=1.0)
    # head
    hd = tilt + p["head"]
    Hc = C + rot((0, -bh / 2 + 4 * s), tilt) + rot((0, -24 * s), hd)
    head = ell(Hc[0], Hc[1], 30 * s, 28 * s, hd, n=40)
    pen.fill(40, head, "round", n=40)
    pen.fill(41, ell(Hc[0] + 9 * s, Hc[1] + 5 * s, 29 * s, 27 * s, hd, n=40), "round_shade", n=40, clip=head,
             detail=True)
    pen.stroke(42, head, 4.2 * s, "ink", n=44, closed=True, taper=1.0)
    blink = ((b + di * 1.37) % 4.0) < 0.14
    for side in (-1, 1):
        e = Hc + rot((side * 10 * s, -2 * s), hd)
        pen.blob(43 + side, e, 3.4 * s, (0.9 if blink else 4.4) * s, "ink", line=0, n=14, detail=True)
        pen.blob(46 + side, Hc + rot((side * 17 * s, 8 * s), hd), 5.5 * s, 3.5 * s, "accent", line=0, n=14,
                 detail=True)
    pen.stroke(49, [Hc + rot(v, hd) for v in arc(0, 7 * s, 8 * s, 5 * s, 25, 155, 9)], 2.8 * s, "ink",
               n=12, detail=True)
    look = d.get("look")
    if look == "beanie":
        dome = [Hc + rot(v, hd) for v in arc(0, -2 * s, 32 * s, 31 * s, 192, 348, 18)]
        pen.fill(50, dome, "accent", n=40)
        pen.stroke(51, dome + [dome[0]], 3.4 * s, "ink", n=44, taper=1.0)
        pen.stroke(52, [Hc + rot((-30 * s, -8 * s), hd), Hc + rot((30 * s, -8 * s), hd)], 7 * s,
                   M["accent"] + DARK, n=14, detail=True)
        pen.blob(53, Hc + rot((0, -36 * s), hd), 8 * s, 8 * s, "accent", line=2.6 * s)
    elif look == "bow":
        c = Hc + rot((15 * s, -25 * s), hd)
        for side in (-1, 1):
            lobe = [c, c + rot((side * 16 * s, -9 * s), hd + 10), c + rot((side * 16 * s, 9 * s), hd + 10)]
            pen.fill(55 + side, lobe, "accent", n=24)
            pen.stroke(58 + side, lobe, 2.6 * s, "ink", n=28, closed=True, taper=1.0)
        pen.blob(60, c, 4.5 * s, 4.5 * s, "accent", line=2.2 * s)
    elif look == "glasses":
        for side in (-1, 1):
            pen.stroke(62 + side, ell(*(Hc + rot((side * 10 * s, -2 * s), hd)), 8.5 * s, 8.5 * s, n=18),
                       2.4 * s, "ink", n=22, closed=True, taper=1.0, detail=True)
        pen.stroke(65, [Hc + rot((-2 * s, -3 * s), hd), Hc + rot((2 * s, -3 * s), hd)], 2.4 * s, "ink",
                   n=6, detail=True)
    # arms (in front of the body) + mitten hands
    for side, a, e, part in ((-1, p["la"], p["le"], 70), (1, p["ra"], p["re"], 80)):
        sh = C + rot((side * bw * 0.4, -bh * 0.14), tilt)
        elbow, hand = arm(sh, a, e, tilt, side, 30 * s, 27 * s)
        pen.tube(part, [sh, elbow, hand], 14 * s, "round", line=3.2 * s)
        pen.blob(part + 1, hand, 9.5 * s, 9.5 * s, "round", line=3 * s)


def draw_slim(pen, d, p, di, b):
    s = d["size"]
    x0, fy = d["x"], d["floor"]
    tilt = p["tilt"]
    P = np.array([x0 + p["x"], fy - 86 * s + p["y"]])
    N = P + rot((0, -60 * s), tilt)
    # legs + shoes
    for side, fx, fyo, part in ((-1, p["lfx"], p["lfy"], 10), (1, p["rfx"], p["rfy"], 20)):
        hip = P + rot((side * 7 * s, 0), tilt * 0.4)
        foot = np.array([x0 + side * 11 * s + fx, fy + fyo])
        knee, foot = ik(hip, foot, 44 * s, 44 * s, side)
        pen.tube(part, [hip, knee, foot], 10.5 * s, "suit", line=2.2 * s)
        pen.blob(part + 1, foot + (side * 5 * s, -1 * s), 10 * s, 5 * s, "shoe", line=2 * s)
    # jacket
    torso = [P + rot(v, tilt) for v in np.array([(-11, 5), (11, 5), (17, -54), (13, -61), (-13, -61), (-17, -54)]) * s]
    pen.fill(30, torso, "suit", n=40)
    pen.stroke(31, [P + rot((-12 * s, -4 * s), tilt), P + rot((-15 * s, -50 * s), tilt)], 3 * s, "suit_hi",
               n=12, detail=True)
    pen.fill(32, [N + rot(v, tilt) for v in np.array([(-7, -1), (7, -1), (0, 17)]) * s], "shirt", n=16,
             detail=True)
    pen.stroke(33, [N + rot((0, 2 * s), tilt), N + rot((0.5 * s, 19 * s), tilt)], 3.2 * s, "accent", n=8,
               detail=True)
    pen.stroke(34, torso, 2.2 * s, "ink", n=44, closed=True, taper=1.0)
    # head
    hd = tilt + p["head"]
    Hc = N + rot((0, -19 * s), hd)
    pen.stroke(40, [N + rot((0, 2 * s), tilt), N + rot((0, -9 * s), hd)], 7 * s, "skin", n=6, taper=1.0)
    head = ell(Hc[0], Hc[1], 11 * s, 13.5 * s, hd, n=30)
    pen.fill(41, head, "skin", n=30)
    pen.stroke(42, head, 2.2 * s, "ink", n=34, closed=True, taper=1.0)
    for side in (-1, 1):
        pen.blob(43 + side, Hc + rot((side * 4.2 * s, 1 * s), hd), 1.5 * s, 1.9 * s, "ink", line=0, n=10,
                 detail=True)
    look = d.get("look")
    hair = lambda pts: [Hc + rot(v, hd) for v in np.asarray(pts, float) * s]
    if look == "bob":
        pts = hair([(-13, 9), (-13.5, -3)] + [tuple(v) for v in arc(0, -2, 13.5, 14, 190, 350, 12)]
                   + [(13.5, -3), (13, 9), (9, 9), (8, -6), (-8, -7), (-9, 9)])
        pen.fill(50, pts, "hair", n=40)
    elif look == "cap":
        dome = hair([tuple(v) for v in arc(0, -4, 12.5, 11, 180, 360, 14)])
        pen.fill(50, dome, "accent", n=30)
        pen.stroke(51, dome + [dome[0]], 2 * s, "ink", n=34, taper=1.0)
        pen.stroke(52, hair([(-3, -4), (21, -3)]), 4 * s, "accent", n=10, taper=1.0)
    elif look == "bun":
        pen.fill(50, hair([tuple(v) for v in arc(0, -3, 12, 12.5, 180, 360, 14)]), "hair", n=30)
        pen.blob(51, hair([(0, -18)])[0], 6.5 * s, 6 * s, "hair", line=1.8 * s)
    elif look == "spikes":
        pen.fill(50, hair([tuple(v) for v in arc(0, -3, 12, 12, 180, 360, 14)]), "hair", n=30)
        for i, ang in enumerate((-60, -30, 0, 30, 60)):
            base = hair([(math.sin(math.radians(ang)) * 9, -3 - math.cos(math.radians(ang)) * 10)])[0]
            tip = hair([(math.sin(math.radians(ang)) * 17, -3 - math.cos(math.radians(ang)) * 19)])[0]
            pen.stroke(55 + i, [base, tip], 4 * s, "hair", n=6, taper=0.3)
    # arms + hands
    for side, a, e, part in ((-1, p["la"], p["le"], 70), (1, p["ra"], p["re"], 80)):
        sh = N + rot((side * 15 * s, 4 * s), tilt)
        elbow, hand = arm(sh, a, e, tilt, side, 32 * s, 30 * s)
        pen.tube(part, [sh, elbow, hand], 8.5 * s, "suit", line=2 * s)
        pen.blob(part + 1, hand, 5 * s, 5 * s, "skin", line=1.8 * s)


def paint_dancers(img, cam, frame, b, level):
    cv = Canvas(img, cam, frame)
    for di, d in enumerate(DANCERS):
        is_upper = d["type"] == "slim"
        if (level == "upper") != is_upper:
            continue
        p = dancer_pose(d, b)
        seed = SEED + 10000 * (di + 1)
        if d["type"] == "slim":
            draw_slim(Pen(cv, seed, shadow=(20, -8)), d, p, di, b)
            draw_slim(Pen(cv, seed), d, p, di, b)
        else:
            s = d["size"]
            rx = 58 * s * (1 - min(0.35, p["hop"] / 50.0))
            cv.fill(ell(d["x"] + p["x"] * 0.8, d["floor"] + 5 * s, rx, 12 * s, n=32), M["fig_shadow"],
                    seed + 999, n=32, wobble=1.2)
    for di, d in enumerate(DANCERS):
        if d["type"] == "round" and level == "lower":
            draw_round(Pen(cv, SEED + 10000 * (di + 1)), d, dancer_pose(d, b), di, b)


# =============================================================================
# 8. Timeline, rendering and export
# =============================================================================

def expand_timeline():
    """Per-frame (version, shot, progress through that shot)."""
    eighth = 60.0 / BPM / 2
    nf = int(round(DURATION * FPS))
    states = [None] * nf
    k = 0
    for i, (n, ver, shot) in enumerate(TIMELINE):
        f0 = 0 if i == 0 else int(round((BEAT0 + k * eighth) * FPS))
        f1 = min(nf, int(round((BEAT0 + (k + n) * eighth) * FPS)))
        for f in range(f0, f1):
            states[f] = [ver, shot, (f - f0) / max(1, f1 - f0 - 1)]
        k += n
    for f in range(nf):
        if states[f] is None:
            states[f] = list(states[f - 1])
    for slot, length in FLASHES:
        f0 = int(round((BEAT0 + slot * eighth) * FPS))
        for f in range(f0, min(nf, f0 + length)):
            states[f][0] = "black"
    return states


def camera_for(shot, u):
    c = CAMERAS[shot]
    e = u * u * (3 - 2 * u)
    z = c["zoom"]
    z = z[0] + (z[1] - z[0]) * e if isinstance(z, (tuple, list)) else z
    ctr = c["center"]
    if isinstance(ctr[0], (tuple, list)):
        ctr = (ctr[0][0] + (ctr[1][0] - ctr[0][0]) * e, ctr[0][1] + (ctr[1][1] - ctr[0][1]) * e)
    hw, hh = PANEL_W / 2 / z, PANEL_H / 2 / z
    cx = min(max(ctr[0], hw), SET_W - hw)
    cy = min(max(ctr[1], hh), SET_H - hh)
    return Cam(z, cx, cy)


_SET_CACHE, _RAIL_CACHE, _LUTS = {}, {}, {}
_STATES = None


def set_layers(cam, variant):
    key = (cam.key, variant)
    if key not in _SET_CACHE:
        if len(_SET_CACHE) > 40:
            _SET_CACHE.clear()
            _RAIL_CACHE.clear()
        img = Image.new("L", (PANEL_W, PANEL_H), M["wall"])
        paint_set(Canvas(img, cam, 101 + variant))
        rail = Image.new("L", (PANEL_W, PANEL_H), 0)
        paint_railing(Canvas(rail, cam, 201 + variant))
        _SET_CACHE[key] = img
        _RAIL_CACHE[key] = (rail, rail.point(lambda v: 255 if v else 0))
    return _SET_CACHE[key], _RAIL_CACHE[key]


def render_panel(frame, ver, shot, u):
    """Material image for one frame, coloured with version `ver`."""
    cam = camera_for(shot, u)
    base, (rail, rmask) = set_layers(cam, frame % SET_VARIANTS)
    img = base.copy()
    b = (frame / FPS - BEAT0) * BPM / 60.0
    paint_dancers(img, cam, frame, b, "upper")
    img.paste(rail, (0, 0), rmask)
    paint_dancers(img, cam, frame, b, "lower")
    if ver not in _LUTS:
        _LUTS[ver] = build_lut(ver)
    return _LUTS[ver][np.asarray(img)]


def render_frame(f):
    ver, shot, u = _STATES[f]
    frame = np.zeros((H, W, 3), np.uint8)
    if ver != "black":
        frame[PANEL_Y:PANEL_Y + PANEL_H] = render_panel(f, ver, shot, u)
    return frame


def _init_worker(states):
    global _STATES
    _STATES = states


def _render_bytes(f):
    return render_frame(f).tobytes()


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
    sys.exit("ffmpeg not found: pip install imageio-ffmpeg (or set FFMPEG=/path/to/ffmpeg)")


def render_video(out, jobs):
    t0 = time.time()
    states = expand_timeline()
    nf = len(states)
    cuts = sum(1 for i in range(1, nf) if states[i][:2] != states[i - 1][:2])
    print(f"{nf} frames ({nf / FPS:.1f}s at {FPS} fps), {cuts} cuts, {len(DANCERS)} dancers, {jobs} workers")
    cmd = [find_ffmpeg(), "-y", "-hide_banner", "-loglevel", "error",
           "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
           "-an", "-vf", "scale=out_color_matrix=bt709:out_range=tv,format=yuv420p",
           "-c:v", "libx264", "-preset", "slow", "-crf", "18", "-profile:v", "high", "-level", "4.0",
           "-pix_fmt", "yuv420p", "-g", "30", "-colorspace", "bt709", "-color_primaries", "bt709",
           "-color_trc", "bt709", "-color_range", "tv", "-movflags", "+faststart", out]
    enc = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    with Pool(jobs, initializer=_init_worker, initargs=(states,)) as pool:
        for f, buf in enumerate(pool.imap(_render_bytes, range(nf), chunksize=4)):
            enc.stdin.write(buf)
            if f % 60 == 0:
                print(f"  frame {f:4d}/{nf}  ({time.time() - t0:5.1f}s)", flush=True)
    enc.stdin.close()
    if enc.wait() != 0:
        sys.exit("ffmpeg failed")
    print(f"wrote {out} in {time.time() - t0:.1f}s")


def render_still(t, out):
    global _STATES
    _STATES = expand_timeline()
    f = min(len(_STATES) - 1, int(round(t * FPS)))
    Image.fromarray(render_frame(f)).save(out)
    print(f"wrote {out}  (frame {f}: {_STATES[f][0]}, {_STATES[f][1]})")


def render_sheet(out, t=6.0):
    """The same moment in every colour version, plus a few moments of the dance."""
    global _STATES
    _STATES = expand_timeline()
    f = int(round(t * FPS))
    tiles = [(v, render_panel(f, v, "wide", 0.0)) for v in VERSIONS]
    for tt in (1.0, 4.4, 8.8, 13.0):
        ff = int(round(tt * FPS))
        v, shot, u = _STATES[ff]
        tiles.append((f"{tt}s", render_panel(ff, v if v != "black" else "gray", shot, u)))
    cols, sc = 4, 0.5
    tw, th = int(PANEL_W * sc), int(PANEL_H * sc)
    rows = (len(tiles) + cols - 1) // cols
    sheet = Image.new("RGB", (cols * (tw + 8) + 8, rows * (th + 8) + 8), (0, 0, 0))
    for i, (_, arr) in enumerate(tiles):
        sheet.paste(Image.fromarray(arr).resize((tw, th), Image.LANCZOS),
                    (8 + (i % cols) * (tw + 8), 8 + (i // cols) * (th + 8)))
    sheet.save(out)
    print(f"wrote {out}: " + ", ".join(n for n, _ in tiles))


def main():
    ap = argparse.ArgumentParser(description="Render the painted stair-landing dance.")
    ap.add_argument("--out", default="stair_dance.mp4")
    ap.add_argument("--jobs", type=int, default=os.cpu_count() or 2)
    ap.add_argument("--still", type=float, help="render the frame at this time (s) to a PNG instead")
    ap.add_argument("--sheet", action="store_true", help="render a PNG of every colour version")
    a = ap.parse_args()
    stem = os.path.splitext(a.out)[0]
    if a.still is not None:
        render_still(a.still, f"{stem}_{a.still:05.2f}s.png")
    elif a.sheet:
        render_sheet(f"{stem}_sheet.png")
    else:
        render_video(a.out, max(1, a.jobs))


if __name__ == "__main__":
    main()
