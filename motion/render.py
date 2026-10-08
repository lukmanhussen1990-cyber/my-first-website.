#!/usr/bin/env python3
"""Premium 40 s motion-graphics reveal for the logo.

Every frame is rendered procedurally (NumPy + OpenCV) and piped to ffmpeg.

    python3 render.py --stills 2.4 6 12 17.1 21 27 36   # preview PNGs
    python3 render.py --out build/video.mp4               # full render
"""
import argparse
import math
import os
import subprocess
import sys
import time

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont

import timeline as TL
from logo_geom import (A1, B1, D2E, D3E, FB, FJ, FL, HOLES, O, OUTER,
                       SKELETON, TIP, to_world)

cv2.setNumThreads(1)

W, H = 1920, 1080
FPS = TL.FPS
NF = int(round(TL.DURATION * FPS))
SS = 2                      # supersampling for solid geometry
FOCAL = 1400.0              # px
FLOOR_Y = -12.0
HERE = os.path.dirname(os.path.abspath(__file__))


# ----------------------------------------------------------------- easing
def clamp(x, a=0.0, b=1.0):
    return a if x < a else b if x > b else x


def lin(t, t0, t1):
    return clamp((t - t0) / (t1 - t0))


def mix(a, b, x):
    return a + (b - a) * x


def smooth(x):
    x = clamp(x)
    return x * x * (3 - 2 * x)


def ease_out_expo(x):
    x = clamp(x)
    return 1.0 if x >= 1 else 1 - 2 ** (-10 * x)


def ease_out_cubic(x):
    x = clamp(x)
    return 1 - (1 - x) ** 3


def ease_in_cubic(x):
    return clamp(x) ** 3


def ease_in_out_cubic(x):
    x = clamp(x)
    return 4 * x ** 3 if x < 0.5 else 1 - (-2 * x + 2) ** 3 / 2


def ease_in_out_sine(x):
    return -(math.cos(math.pi * clamp(x)) - 1) / 2


def bump(t, t0, t1):
    """0 -> 1 -> 0 over [t0, t1]."""
    x = lin(t, t0, t1)
    return math.sin(math.pi * x)


# --------------------------------------------------------------- geometry
def m(p):
    return (24.0 - p[0], p[1])


def P(*pts):
    return np.array([to_world(p) for p in pts], dtype=np.float64)


def with_z(p2, z=0.0):
    p2 = np.atleast_2d(p2)
    return np.c_[p2, np.full(len(p2), z)]


CONTOURS = [np.array([to_world(p) for p in c]) for c in [OUTER] + HOLES]
O_W = to_world(O)


def _inside_solid(pt):
    k = 0
    for c in CONTOURS:
        if cv2.pointPolygonTest(c.astype(np.float32).reshape(-1, 1, 2),
                                (float(pt[0]), float(pt[1])), False) > 0:
            k += 1
    return k % 2 == 1


EDGES = []                  # (contour, i, j, outward normal 2d)
for _ci, _c in enumerate(CONTOURS):
    for _i in range(len(_c)):
        _j = (_i + 1) % len(_c)
        _d = _c[_j] - _c[_i]
        _L = float(np.hypot(*_d))
        if _L < 1e-3:
            continue
        _n = np.array([_d[1], -_d[0]]) / _L
        if _inside_solid((_c[_i] + _c[_j]) / 2 + 0.02 * _n):
            _n = -_n
        EDGES.append((_ci, _i, _j, _n))


class Poly:
    """Polyline with arc-length parametrisation (2d world points)."""

    def __init__(self, pts):
        self.p = np.asarray(pts, dtype=np.float64)
        d = np.diff(self.p, axis=0)
        self.seg = np.hypot(d[:, 0], d[:, 1])
        self.cum = np.r_[0.0, np.cumsum(self.seg)]
        self.L = float(self.cum[-1])

    def at(self, s):
        s = clamp(s, 0.0, self.L)
        i = min(int(np.searchsorted(self.cum, s, 'right')) - 1, len(self.seg) - 1)
        f = (s - self.cum[i]) / max(self.seg[i], 1e-9)
        return self.p[i] + f * (self.p[i + 1] - self.p[i])

    def sub(self, s0, s1):
        s0, s1 = clamp(s0, 0, self.L), clamp(s1, 0, self.L)
        if s1 <= s0:
            return None
        inner = self.p[(self.cum > s0) & (self.cum < s1)]
        return np.vstack([self.at(s0), inner, self.at(s1)])


SKEL = [(name, Poly(P(a, b)), TL.T_BEAM + s * TL.BEAM_SCALE, d * TL.BEAM_SCALE)
        for name, a, b, s, d in SKELETON]
SKEL_END = max(t0 + d for _, _, t0, d in SKEL)

_TRACE = [
    (P((12, 0.1577), (11.4223, 0.1577), (11.4223, 6.3543), (4.4904, 0), (4.4904, 7.0896),
       (1.6023, 7.0896), (1.6023, 17.4872), (4.4905, 17.4872), (4.4905, 24),
       (11.4225, 17.6409), (11.4225, 23.8414), (12, 23.8414)), 0.0, 3.4),
    (P((10.5149, 7.0896), (5.6458, 7.0896), (5.6458, 2.6262), (10.5149, 7.0896)), 0.55, 1.5),
    (P((10.6052, 8.245), (4.4903, 14.3597), (4.4903, 16.332), (2.7576, 16.332),
       (2.7576, 8.245), (10.6052, 8.245)), 1.05, 1.9),
    (P((11.4222, 9.062), (11.4222, 16.0731), (5.6458, 21.3724), (5.6458, 14.8384),
       (11.4222, 9.062)), 1.55, 1.9),
]
TRACE = []
for _pts, _s, _d in _TRACE:
    TRACE.append((Poly(_pts), TL.T_TRACE + _s, _d))
    TRACE.append((Poly(np.c_[-_pts[:, 0], _pts[:, 1]]), TL.T_TRACE + _s, _d))

_PULSE = [P(O, A1, B1, O), P(O, D2E, TIP, D3E, O), P(O, FL, FB, FJ, D2E, O)]
PULSES = []
for _k, _p in enumerate(_PULSE):
    PULSES.append(Poly(_p))
    PULSES.append(Poly(np.c_[-_p[:, 0], _p[:, 1]]))
PULSES.append(Poly(P((12, 0.1577), O, (12, 23.8414))))


# ------------------------------------------------------------------ guides
def _unit(v):
    v = np.asarray(v, float)
    return v / np.linalg.norm(v)


_d1 = _unit(to_world(A1) - O_W)
_d2 = _unit(to_world(D2E) - O_W)
_d3 = _unit(to_world(D3E) - to_world(TIP))
GUIDE_LINES = [  # centre, direction, half length, start offset
    (np.array([0.0, 0.0]), np.array([0.0, 1.0]), 70, 0.00),
    (O_W, np.array([1.0, 0.0]), 90, 0.10),
    (O_W, _d1, 80, 0.25), (O_W, _d1 * [-1, 1], 80, 0.25),
    (O_W, _d2, 80, 0.35), (O_W, _d2 * [-1, 1], 80, 0.35),
    (np.array([-9.82, 0.0]), np.array([0.0, 1.0]), 60, 0.50),
    (np.array([9.82, 0.0]), np.array([0.0, 1.0]), 60, 0.50),
    (np.array([-6.932, 0.0]), np.array([0.0, 1.0]), 60, 0.60),
    (np.array([6.932, 0.0]), np.array([0.0, 1.0]), 60, 0.60),
    (np.array([0.0, 12.0]), np.array([1.0, 0.0]), 90, 0.70),
    (np.array([0.0, -12.0]), np.array([1.0, 0.0]), 90, 0.70),
    (np.array([0.0, -4.9096]), np.array([1.0, 0.0]), 90, 0.80),
    (to_world(D3E), _d3, 70, 0.85), (to_world(D3E), _d3 * [-1, 1], 70, 0.85),
]
GUIDE_CIRCLES = [(O_W, 9.404, 0.9), (O_W, 2.1, 0.2), (np.array([0.0, 0.0]), 16.9, 1.1)]
NODES = [O, A1, B1, FL, FB, FJ, D2E, TIP, D3E]
NODES = [to_world(p) for p in NODES] + [to_world(m(p)) for p in NODES[1:-1]]
ANGLE_ARCS = [  # centre, radius, a0, a1 (deg), label, label angle
    (O_W, 3.4, 180.0, 180.0 - math.degrees(math.atan2(6.3543, 6.9319)), "42.5°", 160),
    (O_W, 4.6, 0.0, -45.0, "45°", -22),
]


def _text_sprite(text, size=22):
    for name in ("Inter-Regular.otf", "Inter-Light.otf"):
        path = os.path.join("/usr/share/fonts/opentype/inter", name)
        if os.path.exists(path):
            font = ImageFont.truetype(path, size)
            break
    else:
        font = ImageFont.load_default()
    box = font.getbbox(text)
    im = Image.new("L", (box[2] + 8, box[3] + 8), 0)
    ImageDraw.Draw(im).text((4, 4), text, fill=255, font=font)
    return np.asarray(im, np.float32) / 255.0


LABELS = {a[4]: _text_sprite(a[4]) for a in ANGLE_ARCS}


# ----------------------------------------------------------------- sprites
def _gauss_sprite(sx, sy=None):
    sy = sx if sy is None else sy
    hx, hy = int(math.ceil(sx * 3)), int(math.ceil(sy * 3))
    x = np.arange(-hx, hx + 1, dtype=np.float32)
    y = np.arange(-hy, hy + 1, dtype=np.float32)
    return np.exp(-(x[None, :] ** 2) / (2 * sx * sx) - (y[:, None] ** 2) / (2 * sy * sy))


GLOW = {s: _gauss_sprite(s) for s in (2, 4, 8, 16, 32, 64, 128, 220)}
STREAK = _gauss_sprite(380, 1.6)
STREAK_SOFT = _gauss_sprite(520, 7)


def _bokeh_sprite(r):
    if r <= 2:
        return _gauss_sprite(max(0.6, r * 0.6))
    h = int(math.ceil(r)) + 2
    yy, xx = np.mgrid[-h:h + 1, -h:h + 1].astype(np.float32)
    d = np.sqrt(xx * xx + yy * yy)
    disc = np.clip(r + 0.5 - d, 0, 1)
    return disc * (0.8 + 0.2 * (d / r) ** 4)


BOKEH = {r: _bokeh_sprite(r) for r in range(1, 81)}


def add_sprite(img, spr, cx, cy, color):
    h, w = spr.shape
    x0, y0 = int(round(cx - w / 2)), int(round(cy - h / 2))
    x1, y1 = x0 + w, y0 + h
    H_, W_ = img.shape[:2]
    if x1 <= 0 or y1 <= 0 or x0 >= W_ or y0 >= H_:
        return
    sx0, sy0 = max(0, -x0), max(0, -y0)
    sx1, sy1 = w - max(0, x1 - W_), h - max(0, y1 - H_)
    img[max(0, y0):min(H_, y1), max(0, x0):min(W_, x1)] += \
        spr[sy0:sy1, sx0:sx1, None] * np.asarray(color, np.float32)


# --------------------------------------------------------------- particles
_rng = np.random.default_rng(11)
NP = 280
DUST_P0 = _rng.uniform([-80, -46, -110], [80, 46, 18], (NP, 3))
DUST_VEL = _rng.normal(0, 0.12, (NP, 3)) + [0.05, 0.10, 0.0]
DUST_AMP = _rng.uniform(0.4, 1.8, (NP, 3))
DUST_FRQ = _rng.uniform(0.03, 0.12, (NP, 3))
DUST_PH = _rng.uniform(0, 2 * np.pi, (NP, 3))
DUST_SIZE = _rng.uniform(0.03, 0.11, NP)
DUST_BRI = _rng.uniform(0.25, 1.0, NP) ** 2 * 0.55
DUST_TWK = _rng.uniform(0.3, 1.4, NP)
_warm = np.array([1.0, 0.93, 0.84])
_cool = np.array([0.80, 0.92, 1.0])
DUST_COL = np.where(_rng.random(NP)[:, None] < 0.35, _warm, _cool)

NS = 460
_segs = [(Poly(P(a, b))) for _, a, b, _, _ in SKELETON]
_lens = np.array([s.L for s in _segs])
_pick = _rng.choice(len(_segs), NS, p=_lens / _lens.sum())
SPARK_P0 = np.array([_segs[k].at(_rng.uniform(0, _segs[k].L)) for k in _pick])
_dir = SPARK_P0 - O_W + _rng.normal(0, 1.2, (NS, 2))
_dir /= np.linalg.norm(_dir, axis=1, keepdims=True)
SPARK_V = np.c_[_dir, _rng.normal(0, 0.35, NS)] * _rng.uniform(4, 32, (NS, 1)) ** 1.0
SPARK_P0 = np.c_[SPARK_P0, _rng.uniform(-0.4, 0.4, NS)]
SPARK_K = _rng.uniform(1.6, 3.6, NS)
SPARK_LIFE = _rng.uniform(0.5, 2.6, NS)
SPARK_BRI = _rng.uniform(0.35, 1.0, NS)

# fog noise (two layers, scrolled)
_fog_rng = np.random.default_rng(5)
FOG = [cv2.resize(_fog_rng.random((36, 64)).astype(np.float32), (1280, 720),
                  interpolation=cv2.INTER_CUBIC) for _ in range(2)]
FOG = [cv2.GaussianBlur(f, (0, 0), 18) for f in FOG]
FOG = [(f - f.mean()) / (f.std() + 1e-6) for f in FOG]

_yy, _xx = np.mgrid[0:H, 0:W].astype(np.float32)
_r = np.sqrt(((_xx - W / 2) / (W / 2)) ** 2 + ((_yy - H / 2) / (W / 2)) ** 2)
VIGNETTE = (1.0 - 0.62 * np.clip(_r / 1.15, 0, 1) ** 2.3)[..., None].astype(np.float32)
BG_BASE = np.array([0.010, 0.011, 0.014], np.float32)
DITHER = ((np.random.default_rng(3).random((H, W, 1)) +
           np.random.default_rng(4).random((H, W, 1)) - 1.0) * 0.9).astype(np.float32)
_hy, _hx = np.mgrid[0:H // 2, 0:W // 2].astype(np.float32)


# ------------------------------------------------------------------ camera
def _norm(v):
    return v / np.linalg.norm(v)


def camera_params(t):
    if t < 10.5:
        k = ease_in_out_sine(lin(t, 0.0, 10.5))
        dist = mix(30, 64, ease_in_out_sine(lin(t, 0.8, 10.5)))
        yaw, pitch, roll = mix(24, 0, k), mix(-7, 0, k), mix(-4, 0, k)
    elif t < TL.T_BUILD:
        k = ease_in_out_sine(lin(t, 10.5, TL.T_BUILD))
        dist, yaw, pitch, roll = mix(64, 61, k), mix(0, -3.5, k), 0.0, 0.0
    elif t < TL.T_IMPACT:
        dist = mix(61, 52, ease_in_cubic(lin(t, TL.T_BUILD, TL.T_IMPACT)))
        yaw = mix(-3.5, 0, ease_in_out_sine(lin(t, TL.T_BUILD, TL.T_IMPACT)))
        pitch, roll = 0.0, 0.0
    elif t < TL.T_3D:
        tau = t - TL.T_IMPACT
        dist = 58 - 6 * math.exp(-tau * 4.5) * math.cos(tau * 7) \
            - 5 * ease_in_out_sine(lin(t, 17.6, TL.T_3D))
        yaw = pitch = roll = 0.0
    elif t < TL.T_RETURN0:
        k = ease_in_out_cubic(lin(t, TL.T_3D, 25.8))
        dist = mix(53, 50, ease_in_out_sine(lin(t, TL.T_3D, 26.0)))
        yaw, pitch, roll = mix(0, 32, k), mix(0, 10, k), 0.0
    elif t < TL.T_RETURN1:
        k = ease_in_out_cubic(lin(t, TL.T_RETURN0, TL.T_RETURN1))
        dist, yaw, pitch, roll = mix(50, 58, k), mix(32, 0, k), mix(10, 3, k), 0.0
    else:
        k = ease_in_out_sine(lin(t, TL.T_RETURN1, TL.DURATION))
        dist, yaw, pitch, roll = mix(58, 53.5, k), mix(0, -4, k), mix(3, 1.5, k), 0.0
    ty = O_W[1] * (1 - ease_in_out_sine(lin(t, 0.8, 10.0))) \
        - 2.0 * ease_in_out_cubic(lin(t, TL.T_3D, 25.8))
    return dist, yaw, pitch, roll, ty


def make_camera(t, depth):
    dist, yaw, pitch, roll, ty = camera_params(t)
    target = np.array([0.0, ty, -depth / 2])
    yr, pr = math.radians(yaw), math.radians(pitch)
    eye = target + dist * np.array([math.sin(yr) * math.cos(pr), math.sin(pr),
                                    math.cos(yr) * math.cos(pr)])
    tau = t - TL.T_IMPACT
    if 0 <= tau < 1.2:
        a = 0.5 * math.exp(-tau * 5.5)
        sh = a * np.array([math.sin(tau * 83) + 0.5 * math.sin(tau * 141 + 2),
                           math.sin(tau * 71 + 1) + 0.5 * math.sin(tau * 127), 0.0])
        eye, target = eye + sh, target + sh * 0.6
    f = _norm(target - eye)
    r = _norm(np.cross(f, [0.0, 1.0, 0.0]))
    u = np.cross(r, f)
    if roll:
        c, s = math.cos(math.radians(roll)), math.sin(math.radians(roll))
        r, u = c * r + s * u, -s * r + c * u
    return {"eye": eye, "r": r, "u": u, "f": f, "dist": dist}


def project(cam, Pw):
    d = np.asarray(Pw, np.float64) - cam["eye"]
    xc, yc, zc = d @ cam["r"], d @ cam["u"], d @ cam["f"]
    zc = np.maximum(zc, 0.05)
    return np.stack([W / 2 + FOCAL * xc / zc, H / 2 - FOCAL * yc / zc], -1), zc


def proj2(cam, pts2, z=0.0):
    if pts2 is None:
        return None
    return project(cam, with_z(pts2, z))[0]


# ---------------------------------------------------------- solid renderer
L_KEY = _norm(np.array([-0.45, 0.55, 0.70]))
L_FILL = _norm(np.array([0.75, 0.15, 0.55]))


def rot_y(a):
    c, s = math.cos(a), math.sin(a)
    return np.array([[c, 0, s], [0, 1, 0], [-s, 0, c]])


def render_solid(cam, depth, spin_deg, mirror=False):
    """Painter's-algorithm render of the extruded mark.

    Returns (x0, y0, colour, alpha, near_cap) in a 1x ROI, or None.
    """
    R = rot_y(math.radians(spin_deg))
    piv = np.array([0.0, 0.0, -depth / 2])

    def xf(Pw):
        Q = (Pw - piv) @ R.T + piv
        if mirror:
            Q[:, 1] = 2 * FLOOR_Y - Q[:, 1]
        return Q

    front = [xf(with_z(c, 0.0)) for c in CONTOURS]
    back = [xf(with_z(c, -depth)) for c in CONTOURS]
    fp = [project(cam, c)[0] for c in front]
    bp = [project(cam, c)[0] for c in back]
    allp = np.vstack(fp + bp)
    x0 = int(max(0, math.floor(allp[:, 0].min()) - 3))
    y0 = int(max(0, math.floor(allp[:, 1].min()) - 3))
    x1 = int(min(W, math.ceil(allp[:, 0].max()) + 4))
    y1 = int(min(H, math.ceil(allp[:, 1].max()) + 4))
    if x1 <= x0 or y1 <= y0:
        return None
    rw, rh = x1 - x0, y1 - y0

    def to_ss(p):
        q = (p - [x0, y0] + 0.5) * SS - 0.5
        return np.round(q * 4).astype(np.int32).reshape(-1, 1, 2)

    buf = np.zeros((rh * SS, rw * SS), np.uint8)
    lut = np.zeros((256, 3), np.float32)
    eye = cam["eye"]
    view_c = _norm(eye - xf(np.zeros((1, 3)))[0])

    def shade(n, base, amb, diff, spec_k, spec_p):
        lam = max(0.0, float(n @ L_KEY))
        hv = _norm(L_KEY + view_c)
        sp = max(0.0, float(n @ hv)) ** spec_p
        return np.asarray(base) * (amb + diff * lam) + spec_k * sp

    nf = R @ np.array([0.0, 0.0, 1.0])
    if mirror:
        nf[1] = -nf[1]
    front_faces = float(nf @ (eye - front[0].mean(0))) > 0
    near, far = (fp, bp) if front_faces else (bp, fp)
    n_near = nf if front_faces else -nf
    cap = shade(n_near, [1.06, 1.06, 1.05], 0.80, 0.27, 0.22, 40)
    lut[1] = cap
    lut[2] = cap * 0.55

    if depth > 1e-3:
        cv2.fillPoly(buf, [to_ss(c) for c in far], 2, cv2.LINE_8, shift=2)
        quads = []
        for k, (ci, i, j, n2) in enumerate(EDGES):
            n3 = R @ np.array([n2[0], n2[1], 0.0])
            if mirror:
                n3[1] = -n3[1]
            mid = (front[ci][i] + front[ci][j] + back[ci][i] + back[ci][j]) / 4
            if float(n3 @ (eye - mid)) <= 0:
                continue
            quads.append((float(np.linalg.norm(eye - mid)), k, ci, i, j, n3))
        quads.sort(key=lambda q: -q[0])
        for _, k, ci, i, j, n3 in quads:
            poly = np.array([fp[ci][i], fp[ci][j], bp[ci][j], bp[ci][i]])
            cv2.fillPoly(buf, [to_ss(poly)], 3 + k, cv2.LINE_8, shift=2)
            fill = max(0.0, float(n3 @ L_FILL))
            lut[3 + k] = np.clip(shade(n3, [0.62, 0.66, 0.72], 0.26, 0.70, 0.8, 26)
                                 + np.array([0.30, 0.36, 0.42]) * fill, 0, 1.4)
    cv2.fillPoly(buf, [to_ss(c) for c in near], 1, cv2.LINE_8, shift=2)

    col = cv2.resize(lut[buf], (rw, rh), interpolation=cv2.INTER_AREA)
    alpha = cv2.resize((buf > 0).astype(np.float32), (rw, rh), interpolation=cv2.INTER_AREA)
    nearc = cv2.resize((buf == 1).astype(np.float32), (rw, rh), interpolation=cv2.INTER_AREA)
    return x0, y0, col, alpha, nearc


# ----------------------------------------------------------------- helpers
def draw_poly(buf, pts, val, thick=1, closed=False):
    if pts is None or len(pts) < 2 or val <= 0:
        return
    p = np.round(pts * 16).astype(np.int32).reshape(-1, 1, 2)
    cv2.polylines(buf, [p], closed, int(clamp(val, 0, 255)), thick, cv2.LINE_AA, shift=4)


def zoom_blur(img, cx, cy, amount, n=5):
    h, w = img.shape[:2]
    out = img
    for i in range(n):
        k = 1.0 + amount * (2 ** i) / (2 ** n)
        M = np.float32([[k, 0, cx * (1 - k)], [0, k, cy * (1 - k)]])
        out = 0.5 * (out + cv2.warpAffine(out, M, (w, h), flags=cv2.INTER_LINEAR))
    return out


def bloom(img):
    levels, cur = [], img
    for _ in range(6):
        cur = cv2.resize(cur, (max(1, cur.shape[1] // 2), max(1, cur.shape[0] // 2)),
                         interpolation=cv2.INTER_AREA)
        levels.append(cv2.GaussianBlur(cur, (0, 0), 1.6))
    acc = levels[-1]
    for lv, wgt in zip(reversed(levels[:-1]), (0.9, 0.8, 0.7, 0.6, 0.5)):
        acc = cv2.resize(acc, (lv.shape[1], lv.shape[0]), interpolation=cv2.INTER_LINEAR) + lv * wgt
    return cv2.resize(acc, (W, H), interpolation=cv2.INTER_LINEAR) * 0.22


def tonemap(x, k=0.80):
    return np.where(x < k, x, k + (1 - k) * (1 - np.exp(-(x - k) / (1 - k))))


def scale_about(ch, cx, cy, k):
    M = np.float32([[k, 0, cx * (1 - k)], [0, k, cy * (1 - k)]])
    return cv2.warpAffine(ch, M, (W, H), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT)


# ------------------------------------------------------------------- frame
def render_frame(t):
    T = TL
    tau_i = t - T.T_IMPACT
    depth = 2.0 * ease_in_out_cubic(lin(t, T.T_3D, 25.0))
    spin = 360.0 * ease_in_out_cubic(lin(t, T.T_SPIN0, T.T_SPIN1))
    cam = make_camera(t, depth)
    dist = cam["dist"]
    fade_in = smooth(lin(t, 0.0, 2.4))
    fade_out = 1.0 - ease_in_out_sine(lin(t, T.T_FADE0, T.T_FADE1))
    o_px = proj2(cam, O_W)[0]
    c_px = proj2(cam, np.zeros(2), -depth / 2)[0]
    pxu = FOCAL / dist                      # pixels per world unit near the mark

    # --------------------------------------------------------- background
    frame = np.empty((H, W, 3), np.float32)
    frame[:] = BG_BASE * fade_in
    add_sprite(frame, GLOW[220], c_px[0], c_px[1], np.array([0.040, 0.046, 0.054]) * fade_in)
    add_sprite(frame, GLOW[128], c_px[0], c_px[1] - 40, np.array([0.022, 0.026, 0.032]) * fade_in)
    f1 = cv2.warpAffine(FOG[0], np.float32([[1, 0, -40 - t * 6.0], [0, 1, -20 - t * 1.5]]), (1280, 720))
    f2 = cv2.warpAffine(FOG[1], np.float32([[1, 0, -60 + t * 4.0], [0, 1, -30 + t * 2.0]]), (1280, 720))
    fog = cv2.resize(f1 * 0.6 + f2 * 0.4, (W, H), interpolation=cv2.INTER_LINEAR)
    frame += np.clip(fog, -2, 3)[..., None] * (np.array([0.006, 0.008, 0.011], np.float32) * fade_in)

    # ----------------------------------------------------------- particles
    pull = ease_in_cubic(lin(t, T.T_BUILD, T.T_IMPACT - 0.05))
    if tau_i < 0:
        s, swirl = 1 - 0.45 * pull, 0.9 * pull
    else:
        s = 1 + 0.5 * (1 - math.exp(-3 * tau_i)) - 0.45 * math.exp(-6 * tau_i)
        swirl = 0.9 + 0.3 * (1 - math.exp(-2 * tau_i))
    pos = DUST_P0 + DUST_VEL * t + DUST_AMP * np.sin(2 * np.pi * DUST_FRQ * t + DUST_PH)
    cs, sn = math.cos(swirl), math.sin(swirl)
    x, y = pos[:, 0] * s, (pos[:, 1] - O_W[1]) * s
    pos = np.c_[cs * x - sn * y, sn * x + cs * y + O_W[1], pos[:, 2]]
    pp, zc = project(cam, pos)
    rad = DUST_SIZE * FOCAL / zc
    coc = 1.5 * FOCAL * np.abs(zc - dist) / (zc * dist)
    rr = np.clip(np.sqrt(rad ** 2 + coc ** 2), 0.8, 80)
    inten = DUST_BRI * np.clip((1.8 / rr) ** 1.1, 0.05, 1.0)
    twk = 0.75 + 0.25 * np.sin(t * DUST_TWK * 3 + DUST_PH[:, 0])
    pa = smooth(lin(t, 0.4, 3.5)) * fade_out * (1 + 0.8 * math.exp(-max(tau_i, 0) * 2) * (tau_i >= 0))
    front_layer = np.zeros_like(frame)
    if pa > 0:
        for k in range(NP):
            if zc[k] < 1.0:
                continue
            spr = BOKEH[int(clamp(round(rr[k]), 1, 80))]
            tgt = front_layer if pos[k, 2] > 1.0 else frame
            add_sprite(tgt, spr, pp[k, 0], pp[k, 1], DUST_COL[k] * (inten[k] * twk[k] * pa))

    # -------------------------------------------------------- emission bufs
    emis = np.zeros((H, W, 3), np.float32)
    B_line = np.zeros((H, W), np.uint8)
    B_guide = np.zeros((H, W), np.uint8)
    B_spark = np.zeros((H, W), np.uint8)
    used = set()
    line_fade = 1.0 - lin(t, T.T_IMPACT, T.T_IMPACT + 0.35)

    # node glow / ignition
    if t >= 0.8 and tau_i < 0.5:
        pre = 0.18 * ease_in_cubic(lin(t, 0.8, T.T_IGNITE))
        ti = t - T.T_IGNITE
        env = 0.0
        if ti >= 0:
            env = min(1.0, ti / 0.05) * (0.30 + 0.70 * math.exp(-ti * 2.2))
            env *= 1 - 0.55 * lin(t, SKEL_END, T.T_TRACE)
            env *= 1 + 0.9 * ease_in_cubic(lin(t, T.T_BUILD, T.T_IMPACT))
            env *= line_fade
        add_sprite(emis, GLOW[64], o_px[0], o_px[1], np.array([0.5, 0.75, 1.0]) * pre)
        if env > 0:
            add_sprite(emis, GLOW[2], o_px[0], o_px[1], np.array([1.0, 1.0, 1.0]) * 3.0 * env)
            add_sprite(emis, GLOW[8], o_px[0], o_px[1], np.array([0.75, 0.9, 1.0]) * 1.1 * env)
            add_sprite(emis, GLOW[32], o_px[0], o_px[1], np.array([0.45, 0.70, 1.0]) * 0.35 * env)
            sk = (0.1 + 0.9 * math.exp(-ti * 1.6)) * env
            add_sprite(emis, STREAK, o_px[0], o_px[1], np.array([0.55, 0.80, 1.0]) * 0.9 * sk)
            add_sprite(emis, STREAK_SOFT, o_px[0], o_px[1], np.array([0.35, 0.6, 1.0]) * 0.12 * sk)
        if 0 <= ti < 1.8:
            u = ti / 1.8
            rad_r = 40 + 900 * ease_out_cubic(u)
            ring = np.zeros((H, W), np.uint8)
            cv2.circle(ring, (int(o_px[0] * 16), int(o_px[1] * 16)), int(rad_r * 16),
                       int(255 * (1 - u) ** 2), 2, cv2.LINE_AA, shift=4)
            emis += cv2.GaussianBlur(ring, (0, 0), 1.2)[..., None].astype(np.float32) * \
                (np.array([0.5, 0.75, 1.0], np.float32) * 0.7 / 255)

    # skeleton light beams
    if t >= T.T_BEAM and line_fade > 0:
        lvl = 1.0
        lvl *= 1 - 0.55 * lin(t, T.T_TRACE, T.T_TRACE + 1.5)
        lvl *= 1 + 0.9 * ease_in_cubic(lin(t, T.T_BUILD, T.T_IMPACT))
        lvl *= line_fade
        th = 3 if pxu > 30 else 2
        for name, poly, t0, d in SKEL:
            if t < t0:
                continue
            k = ease_out_expo(lin(t, t0, t0 + d))
            pts = proj2(cam, poly.sub(0, poly.L * k))
            if pts is None:
                continue
            fresh = 1 + 0.6 * math.exp(-max(0, t - t0 - d) * 3)
            draw_poly(B_line, pts, 200 * lvl * fresh, th)
            if k < 0.999:
                hp = pts[-1]
                hb = 1 - k
                add_sprite(emis, GLOW[4], hp[0], hp[1], np.array([1, 1, 1.0]) * 1.6 * (0.4 + hb))
                add_sprite(emis, GLOW[16], hp[0], hp[1], np.array([0.5, 0.78, 1.0]) * 0.35 * (0.4 + hb))
        used.add("line")

    # data pulses
    if t >= T.T_PULSE and line_fade > 0:
        lvl = smooth(lin(t, T.T_PULSE, T.T_PULSE + 1.0)) * line_fade
        speed = 9.0 * (1 + 2.2 * ease_in_cubic(lin(t, T.T_BUILD, T.T_IMPACT)))
        travel = (t - T.T_PULSE) * 9.0 + (speed - 9.0) * max(0, t - T.T_BUILD) * 0.5
        for k, poly in enumerate(PULSES):
            for rep in range(2):
                sh = (travel + k * 7.3 + rep * poly.L * 0.5) % (poly.L + 6)
                if sh > poly.L:
                    continue
                tail = 3.2
                for q in range(4):
                    a, b = sh - tail * (q + 1) / 4, sh - tail * q / 4
                    draw_poly(B_line, proj2(cam, poly.sub(a, b)), 255 * lvl * (1 - q / 4.5), 2)
                hp = proj2(cam, poly.at(sh))[0]
                add_sprite(emis, GLOW[4], hp[0], hp[1], np.array([0.8, 0.95, 1.0]) * 1.2 * lvl)
                add_sprite(emis, GLOW[16], hp[0], hp[1], np.array([0.3, 0.7, 1.0]) * 0.18 * lvl)
        used.add("line")

    # construction guides
    g_lvl = smooth(lin(t, T.T_GUIDES, T.T_GUIDES + 0.6)) * \
        (1 - smooth(lin(t, 15.2, 16.85)))
    if g_lvl > 0:
        tg = t - T.T_GUIDES
        for c, d, hl, s0 in GUIDE_LINES:
            k = ease_out_cubic(lin(tg, s0, s0 + 1.3))
            if k <= 0:
                continue
            a, b = c - d * hl * k, c + d * hl * k
            draw_poly(B_guide, proj2(cam, np.array([a, b]), -0.02), 255 * g_lvl, 1)
        for c, rad_c, s0 in GUIDE_CIRCLES:
            k = ease_in_out_cubic(lin(tg, s0, s0 + 1.6))
            if k <= 0:
                continue
            ang = np.linspace(math.pi / 2, math.pi / 2 + 2 * math.pi * k, max(8, int(160 * k)))
            pts = c + rad_c * np.c_[np.cos(ang), np.sin(ang)]
            draw_poly(B_guide, proj2(cam, pts, -0.02), 230 * g_lvl, 1)
        for n_i, nd in enumerate(NODES):
            k = smooth(lin(tg, 1.0 + n_i * 0.06, 1.3 + n_i * 0.06))
            if k <= 0:
                continue
            q = proj2(cam, nd)[0]
            sz = 7 * k
            for dx, dy in ((sz, 0), (0, sz)):
                draw_poly(B_guide, np.array([[q[0] - dx, q[1] - dy], [q[0] + dx, q[1] + dy]]),
                          255 * g_lvl, 1)
            cv2.circle(B_guide, (int(q[0] * 16), int(q[1] * 16)), int(4 * k * 16),
                       int(255 * g_lvl), 1, cv2.LINE_AA, shift=4)
        for c, rad_c, a0, a1, label, la in ANGLE_ARCS:
            k = ease_in_out_cubic(lin(tg, 1.6, 2.4))
            if k <= 0:
                continue
            ang = np.radians(np.linspace(a0, mix(a0, a1, k), 40))
            draw_poly(B_guide, proj2(cam, c + rad_c * np.c_[np.cos(ang), np.sin(ang)], -0.02),
                      255 * g_lvl, 1)
            lp = proj2(cam, c + (rad_c + 2.2) * np.array([math.cos(math.radians(la)),
                                                         math.sin(math.radians(la))]))[0]
            add_sprite(emis, LABELS[label], lp[0], lp[1],
                       np.array([0.55, 0.75, 0.9]) * 0.85 * g_lvl * smooth(lin(tg, 2.0, 2.6)))
        used.add("guide")

    # outline tracing
    if t >= T.T_TRACE and line_fade > 0:
        lvl = line_fade * (1 + 0.8 * ease_in_cubic(lin(t, T.T_BUILD, T.T_IMPACT)))
        flick = 1 + 0.12 * math.sin(t * 61) * lin(t, T.T_BUILD, T.T_IMPACT)
        for poly, t0, d in TRACE:
            if t < t0:
                continue
            k = ease_in_out_sine(lin(t, t0, t0 + d))
            pts = proj2(cam, poly.sub(0, poly.L * k))
            if pts is None:
                continue
            draw_poly(B_line, pts, 190 * lvl * flick, 1)
            if k < 0.999:
                hp = pts[-1]
                add_sprite(emis, GLOW[2], hp[0], hp[1], np.array([1, 1, 1.0]) * 2.2)
                add_sprite(emis, GLOW[8], hp[0], hp[1], np.array([0.5, 0.8, 1.0]) * 0.5)
                add_sprite(emis, STREAK, hp[0], hp[1], np.array([0.5, 0.8, 1.0]) * 0.10)
        used.add("line")

    # impact flash, ring and sparks
    flash = 0.0
    if 0 <= tau_i < 3.0:
        e1, e2 = math.exp(-tau_i * 5), math.exp(-tau_i * 2.2)
        add_sprite(emis, GLOW[32], o_px[0], o_px[1], np.array([1.0, 1.0, 1.0]) * 1.6 * e1)
        add_sprite(emis, GLOW[128], o_px[0], o_px[1], np.array([0.6, 0.8, 1.0]) * 0.35 * e1)
        add_sprite(emis, STREAK, o_px[0], o_px[1], np.array([0.55, 0.8, 1.0]) * 2.0 * e2)
        add_sprite(emis, STREAK_SOFT, o_px[0], o_px[1], np.array([0.4, 0.65, 1.0]) * 0.35 * e2)
        flash = 0.14 * math.exp(-tau_i * 10)
        if tau_i < 1.5:
            u = tau_i / 1.5
            ring = np.zeros((H, W), np.uint8)
            cv2.circle(ring, (int(o_px[0] * 16), int(o_px[1] * 16)), int((30 + 1500 * ease_out_cubic(u)) * 16),
                       int(255 * (1 - u) ** 1.5), max(1, int(8 * (1 - u))), cv2.LINE_AA, shift=4)
            emis += cv2.GaussianBlur(ring, (0, 0), 3)[..., None].astype(np.float32) * \
                (np.array([0.6, 0.85, 1.0], np.float32) * 0.9 / 255)
        live = tau_i < SPARK_LIFE
        if live.any():
            def spos(tt):
                tt = max(tt, 0.0)
                return SPARK_P0 + SPARK_V * ((1 - np.exp(-SPARK_K * tt)) / SPARK_K)[:, None] \
                    + np.array([0.0, -0.9, 0.0]) * tt * tt
            pa_, _ = project(cam, spos(tau_i))
            pb_, _ = project(cam, spos(tau_i - 0.035))
            lifef = np.clip(1 - tau_i / SPARK_LIFE, 0, 1) ** 1.5 * SPARK_BRI
            for k in np.nonzero(live)[0]:
                draw_poly(B_spark, np.array([pb_[k], pa_[k]]), 255 * lifef[k], 1)
            used.add("spark")

    if "line" in used:
        emis += B_line[..., None].astype(np.float32) * (np.array([0.80, 0.93, 1.0], np.float32) / 255)
    if "guide" in used:
        emis += B_guide[..., None].astype(np.float32) * (np.array([0.30, 0.42, 0.52], np.float32) / 255)
    if "spark" in used:
        emis += B_spark[..., None].astype(np.float32) * (np.array([1.0, 0.95, 0.88], np.float32) * 1.4 / 255)

    # ------------------------------------------------------------ the mark
    solid_a = 0.0
    if tau_i >= 0:
        solid_a = 1.0
    elif t >= T.T_BUILD:
        solid_a = 0.12 * ease_in_cubic(lin(t, T.T_BUILD, T.T_IMPACT)) * (1 + 0.3 * math.sin(t * 47))
    logo_col = None
    if solid_a > 0:
        res = render_solid(cam, depth, spin)
        if res is not None:
            x0, y0, col, alpha, nearc = res
            rh, rw = alpha.shape
            yy = _yy[y0:y0 + rh, x0:x0 + rw]
            xx = _xx[y0:y0 + rh, x0:x0 + rw]
            col = col * (1.03 - 0.09 * (yy - y0) / max(rh, 1))[..., None]
            for tg0, dur, gain in ((T.T_GLINT1, 1.2, 1.0), (T.T_GLINT2, 1.4, 1.2), (T.T_RETURN1 - 0.9, 1.3, 0.6)):
                if tg0 <= t < tg0 + dur:
                    u = ease_in_out_sine((t - tg0) / dur)
                    q = (xx - c_px[0]) * 0.74 + (yy - c_px[1]) * 0.67
                    qc = mix(-760, 760, u)
                    band = np.exp(-((q - qc) / 55) ** 2) + 0.4 * np.exp(-((q - qc + 120) / 20) ** 2)
                    col = col + (nearc * band * gain)[..., None] * np.array([0.9, 0.97, 1.0], np.float32)
            if 0 <= tau_i < 0.3:
                rad_r = 1000 * ease_out_cubic(tau_i / 0.22)
                dd = np.sqrt((xx - o_px[0]) ** 2 + (yy - o_px[1]) ** 2)
                rv = np.clip((rad_r - dd) / 40, 0, 1)
                alpha, col = alpha * rv, col * rv[..., None]
            if tau_i < 0:   # translucent energy fill during the build-up
                alpha = alpha * solid_a
                col = alpha[..., None] * np.array([0.55, 0.78, 1.0], np.float32)
            # floor reflection (behind the mark)
            refl_op = 0.17 * smooth(lin(t, T.T_3D - 0.5, T.T_3D + 1.5))
            if refl_op > 0:
                rr_ = render_solid(cam, depth, spin, mirror=True)
                if rr_ is not None:
                    rx0, ry0, rcol, ralpha, _ = rr_
                    yf = project(cam, np.array([[0.0, FLOOR_Y, -depth / 2]]))[0][0, 1]
                    rhh, rww = ralpha.shape
                    ys = np.arange(ry0, ry0 + rhh, dtype=np.float32)
                    fz = (np.clip(1 - (ys - yf) / 330, 0, 1) ** 1.6 * refl_op)[:, None]
                    rcol = cv2.GaussianBlur(rcol, (0, 0), 1.6)
                    ralpha = cv2.GaussianBlur(ralpha, (0, 0), 1.6)
                    reg = frame[ry0:ry0 + rhh, rx0:rx0 + rww]
                    reg *= (1 - ralpha * fz)[..., None]
                    reg += rcol * fz[..., None]
                    add_sprite(frame, _gauss_sprite(420, 26), c_px[0], yf,
                               np.array([0.030, 0.036, 0.044]) * refl_op / 0.17)
            logo_col = (x0, y0, col, alpha, nearc)

    # ----------------------------------------------------------- god rays
    ray_lvl = 0.0
    if tau_i >= 0:
        ray_lvl = mix(1.0, 0.42, smooth(tau_i / 1.6))
        ray_lvl *= 1 - 0.65 * smooth(lin(t, T.T_3D, 24.5)) + 0.65 * smooth(lin(t, T.T_RETURN0 + 1.0, T.T_RETURN1))
        ray_lvl *= 1 + 0.12 * math.sin(t * 0.9)
    elif t >= T.T_IGNITE:
        ray_lvl = 0.25 * (1 - lin(t, SKEL_END, T.T_TRACE)) * smooth(lin(t, T.T_IGNITE, T.T_IGNITE + 0.4))
    if ray_lvl > 0.003:
        src = np.zeros((H // 2, W // 2, 3), np.float32)
        ox, oy = o_px[0] / 2, o_px[1] / 2
        add_sprite(src, GLOW[64], ox, oy, np.array([0.85, 0.93, 1.0]) * 1.0)
        add_sprite(src, GLOW[16], ox, oy, np.array([1.0, 1.0, 1.0]) * 1.5)
        if logo_col is not None and tau_i >= 0:
            x0, y0, col, alpha, nearc = logo_col
            occ = np.ones((H, W), np.float32)
            occ[y0:y0 + alpha.shape[0], x0:x0 + alpha.shape[1]] -= alpha
            src *= cv2.resize(occ, (W // 2, H // 2), interpolation=cv2.INTER_AREA)[..., None]
            lc = np.zeros((H, W, 3), np.float32)
            lc[y0:y0 + alpha.shape[0], x0:x0 + alpha.shape[1]] = col
            src += cv2.resize(lc, (W // 2, H // 2), interpolation=cv2.INTER_AREA) * 0.10
        rays = zoom_blur(src, ox, oy, 0.9, 6)
        th_ = np.arctan2(_hy - oy, _hx - ox)
        mod = 0.45 + 0.55 * (0.5 + 0.5 * np.sin(th_ * 9 + t * 0.12)) * (0.5 + 0.5 * np.sin(th_ * 23 - t * 0.08 + 1.3))
        rays *= mod[..., None]
        frame += cv2.resize(rays, (W, H), interpolation=cv2.INTER_LINEAR) * (ray_lvl * 0.55)

    # ------------------------------------------------------------ composite
    glow_src = emis.copy()
    if logo_col is not None:
        x0, y0, col, alpha, nearc = logo_col
        reg = frame[y0:y0 + alpha.shape[0], x0:x0 + alpha.shape[1]]
        reg *= (1 - alpha)[..., None]
        reg += col
        gain = 0.30 + 0.05 * math.sin(t * 1.3)
        if tau_i >= 0:
            gain += 0.8 * math.exp(-tau_i * 4.0)
        glow_src[y0:y0 + alpha.shape[0], x0:x0 + alpha.shape[1]] += col * gain
    frame += emis
    frame += bloom(glow_src)
    frame += front_layer
    if flash > 0:
        frame += np.array([0.9, 0.95, 1.0], np.float32) * flash
    dip = 1 - 0.35 * bump(t, T.T_IMPACT - 0.35, T.T_IMPACT + 0.02) if tau_i < 0.02 else 1.0
    frame *= dip * fade_out

    out = tonemap(frame)
    ca = 0.0012 + 0.007 * (math.exp(-tau_i * 4.5) if tau_i >= 0 else 0.0)
    out[..., 0] = scale_about(out[..., 0], W / 2, H / 2, 1 + ca)
    out[..., 2] = scale_about(out[..., 2], W / 2, H / 2, 1 - ca)
    out *= VIGNETTE
    out = out * 255 + DITHER
    return np.clip(out, 0, 255).astype(np.uint8)


# --------------------------------------------------------------------- main
def _worker(i):
    return render_frame(i / FPS).tobytes()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--stills", type=float, nargs="*")
    ap.add_argument("--out", default=os.path.join(HERE, "build", "video.mp4"))
    ap.add_argument("--start", type=float, default=0.0)
    ap.add_argument("--end", type=float, default=TL.DURATION)
    ap.add_argument("--jobs", type=int, default=os.cpu_count())
    ap.add_argument("--crf", type=int, default=17)
    args = ap.parse_args()

    if args.stills:
        os.makedirs(os.path.join(HERE, "build", "stills"), exist_ok=True)
        for ts in args.stills:
            t0 = time.time()
            img = render_frame(ts)
            p = os.path.join(HERE, "build", "stills", f"t{ts:05.2f}.png")
            cv2.imwrite(p, cv2.cvtColor(img, cv2.COLOR_RGB2BGR))
            print(f"{p}  ({time.time() - t0:.2f}s)")
        return

    os.makedirs(os.path.dirname(os.path.abspath(args.out)), exist_ok=True)
    f0, f1 = int(round(args.start * FPS)), int(round(args.end * FPS))
    cmd = ["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24",
           "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
           "-vf", "scale=out_color_matrix=bt709:out_range=tv,format=yuv420p",
           "-c:v", "libx264", "-preset", "slow", "-crf", str(args.crf),
           "-x264-params", "aq-mode=3:aq-strength=0.9:deblock=-1,-1",
           "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709",
           "-movflags", "+faststart", args.out]
    enc = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    import multiprocessing as mp
    t0 = time.time()
    with mp.get_context("fork").Pool(args.jobs) as pool:
        for n, buf in enumerate(pool.imap(_worker, range(f0, f1), chunksize=4)):
            enc.stdin.write(buf)
            if n % 120 == 0:
                el = time.time() - t0
                print(f"frame {f0 + n}/{f1}  {el:.0f}s elapsed", flush=True)
    enc.stdin.close()
    enc.wait()
    print(f"done in {time.time() - t0:.0f}s -> {args.out}")
    sys.exit(enc.returncode)


if __name__ == "__main__":
    main()
