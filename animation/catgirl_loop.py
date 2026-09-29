#!/usr/bin/env python3
"""Render a seamless 30-second looping animation of the cat-girl illustration.

The artwork is split into three layers (an inpainted street plate, the tail and
the character) and animated with smooth displacement fields plus a few
pixel-level edits (blinks). The original linework is only ever warped by a few
pixels, never redrawn, so the character stays on-model. Every motion is a
function of time that is periodic in LOOP seconds, which makes the frame after
the last one identical to frame 0 (a seamless loop).

    python3 animation/catgirl_loop.py                  # full render -> MP4s
    python3 animation/catgirl_loop.py --stills 0 2.7   # preview PNGs at times (s)
"""
import argparse
import json
import math
import os
import subprocess
import sys
import time
from multiprocessing import Pool

import cv2
import numpy as np
from PIL import Image, ImageDraw
from scipy.ndimage import distance_transform_edt, gaussian_filter1d, median_filter

HERE = os.path.dirname(os.path.abspath(__file__))
ASSETS = os.path.join(HERE, 'assets')

LOOP = 30.0                 # seconds
FPS = 30
NF = int(round(LOOP * FPS))
OW, OH = 1440, 1080         # main output (same 4:3 framing as the artwork)
W0 = 2 * math.pi / LOOP     # one cycle per loop; every oscillator is an integer multiple
DEG = math.pi / 180

G = {}                      # global state, shared copy-on-write with worker processes


# ----------------------------------------------------------------------------- helpers

def sstep(e0, e1, x):
    x = np.clip((np.asarray(x, np.float32) - e0) / (e1 - e0), 0.0, 1.0)
    return x * x * (3 - 2 * x)


def ss(e0, e1, x):
    x = min(max((x - e0) / (e1 - e0), 0.0), 1.0)
    return x * x * (3 - 2 * x)


def osc(k, t, ph=0.0):
    """Oscillator with k whole cycles per loop."""
    return math.sin(k * W0 * t + ph)


def poly_mask(pts, blur=0.0):
    m = np.zeros(G['shape'], np.float32)
    cv2.fillPoly(m, [np.round(np.array(pts, np.float64)).astype(np.int32)], 1.0, lineType=cv2.LINE_AA)
    return cv2.GaussianBlur(m, (0, 0), blur) if blur > 0 else m


def dist_from(c):
    return np.hypot(G['X'] - c[0], G['Y'] - c[1])


def axis_ramp(pivot, tip, f0, f1):
    ax = np.array(tip, np.float64) - np.array(pivot, np.float64)
    n = float(np.hypot(*ax))
    proj = ((G['X'] - pivot[0]) * (ax[0] / n) + (G['Y'] - pivot[1]) * (ax[1] / n)) / n
    return sstep(f0, f1, proj)


def gauss(c, sigma):
    return np.exp(-((G['X'] - c[0]) ** 2 + (G['Y'] - c[1]) ** 2) / (2 * sigma * sigma)).astype(np.float32)


def pushpull(img, w):
    """Smoothly fill pixels with weight 0 from weighted neighbours (pyramid pull-push)."""
    levels = []
    ci, cw = img * w[..., None], w.astype(np.float32)
    while min(cw.shape) > 3:
        levels.append((ci, cw))
        h, wd = cw.shape
        ci = cv2.resize(ci, ((wd + 1) // 2, (h + 1) // 2), interpolation=cv2.INTER_AREA)
        cw = cv2.resize(cw, ((wd + 1) // 2, (h + 1) // 2), interpolation=cv2.INTER_AREA)
    fill = ci.sum((0, 1)) / max(float(cw.sum()), 1e-6) * np.ones_like(ci)
    for li, lw in reversed(levels):
        up = cv2.resize(fill, (lw.shape[1], lw.shape[0]), interpolation=cv2.INTER_LINEAR)
        norm = li / np.maximum(lw, 1e-6)[..., None]
        conf = np.clip(lw * 2.0, 0, 1)[..., None]
        fill = norm * conf + up * (1 - conf)
    return fill


class Comp:
    """One motion component: a weight map cropped to its support."""

    def __init__(self, w, thr=2e-3):
        ys, xs = np.nonzero(w > thr)
        self.s = (slice(int(ys.min()), int(ys.max()) + 1), slice(int(xs.min()), int(xs.max()) + 1))
        self.w = np.ascontiguousarray(w[self.s], dtype=np.float32)
        self.X = G['X'][self.s]
        self.Y = G['Y'][self.s]

    def rot(self, D, c, th, w=None):
        """Add a forward rotation by th (radians, clockwise on screen) about c."""
        if abs(th) < 1e-8:
            return
        w = self.w if w is None else w
        dx = self.X - c[0]
        dy = self.Y - c[1]
        c1 = 1.0 - math.cos(th)
        s1 = math.sin(th)
        D[0][self.s] += w * (c1 * dx - s1 * dy)
        D[1][self.s] += w * (s1 * dx + c1 * dy)

    def trans(self, D, tx, ty):
        if tx:
            D[0][self.s] += self.w * tx
        if ty:
            D[1][self.s] += self.w * ty


def affine(scale, rot, center_src, center_dst):
    """2x3 matrix mapping src -> dst: dst = center_dst + scale * R(rot) * (src - center_src)."""
    c, s = math.cos(rot) * scale, math.sin(rot) * scale
    return np.array([[c, -s, center_dst[0] - c * center_src[0] + s * center_src[1]],
                     [s, c, center_dst[1] - s * center_src[0] - c * center_src[1]]], np.float64)


def compose(A, B):
    """A after B (both 2x3)."""
    A3 = np.vstack([A, [0, 0, 1]])
    B3 = np.vstack([B, [0, 0, 1]])
    return (A3 @ B3)[:2]


def invert(A):
    return cv2.invertAffineTransform(A)


def grid_from(Minv, w=OW, h=OH):
    """Source coordinates for every output pixel under inverse affine Minv."""
    xo = np.arange(w, dtype=np.float32)[None, :]
    yo = np.arange(h, dtype=np.float32)[:, None]
    qx = (Minv[0, 0] * xo + Minv[0, 1] * yo + Minv[0, 2]).astype(np.float32)
    qy = (Minv[1, 0] * xo + Minv[1, 1] * yo + Minv[1, 2]).astype(np.float32)
    return qx, qy


def apply_pt(M, p):
    return (M[0, 0] * p[0] + M[0, 1] * p[1] + M[0, 2], M[1, 0] * p[0] + M[1, 1] * p[1] + M[1, 2])


# ----------------------------------------------------------------------------- geometry of the artwork
# All coordinates are pixels in the 1446x1088 source illustration.

RIBBON_POLY = [(1160, 280), (1195, 272), (1222, 262), (1245, 262), (1258, 290), (1258, 330), (1250, 372),
               (1235, 380), (1232, 458), (1212, 458), (1205, 420), (1195, 450), (1170, 452), (1168, 400),
               (1165, 345), (1158, 320)]
TAIL_REGION = [(345, 415), (535, 415), (535, 480), (478, 520), (478, 715), (345, 715)]
TAIL_SKELETON = [(468, 700), (455, 668), (425, 640), (397, 606), (384, 566), (386, 526), (400, 490),
                 (425, 462), (455, 447), (486, 446), (505, 456)]
TAIL_PIVOT = (468, 700)

HEAD_PIVOT = (965, 470)
HEAD_POLY = [(836, 250), (842, 120), (845, -20), (1165, -20), (1255, 40), (1325, 120), (1322, 250),
             (1272, 292), (1150, 330), (1132, 420), (1082, 455), (1000, 478), (930, 472), (872, 442),
             (832, 382), (815, 300)]
PONY_POLY = [(1095, 245), (1300, 235), (1352, 350), (1356, 500), (1342, 650), (1180, 660), (1088, 565),
             (1080, 400)]
PONY_PIVOT = (1205, 300)
LEFT_HAIR_POLY = [(752, 250), (845, 245), (885, 300), (895, 430), (885, 565), (822, 615), (755, 565), (736, 400)]
LEFT_HAIR_PIVOT = (848, 285)
TOP_FLY_POLY = [(985, 20), (1060, 22), (1160, 40), (1262, 80), (1262, 150), (1150, 128), (1060, 100), (990, 60)]
RIGHT_FLY_POLY = [(1238, 140), (1330, 150), (1360, 260), (1320, 300), (1262, 290), (1240, 220)]

EAR1_POLY = [(842, 118), (846, 60), (866, 18), (893, -20), (962, -20), (964, 40), (972, 84), (952, 98),
             (900, 104), (866, 116)]
EAR1_PIVOT, EAR1_TIP = (912, 104), (928, -20)
EAR2_POLY = [(1136, 165), (1198, 140), (1262, 132), (1316, 128), (1294, 186), (1270, 240), (1256, 284),
             (1214, 274), (1168, 232), (1140, 200)]
EAR2_PIVOT, EAR2_TIP = (1195, 228), (1305, 138)
AHOGE_POLY = [(1030, 98), (1030, 18), (1052, -20), (1130, -20), (1158, 22), (1154, 62), (1126, 68),
              (1112, 44), (1072, 32), (1066, 98)]
AHOGE_PIVOT, AHOGE_TIP = (1050, 92), (1100, 5)

HAND_POLY = [(774, 96), (798, 78), (850, 82), (876, 102), (938, 88), (948, 104), (892, 150), (866, 164),
             (910, 164), (908, 184), (852, 204), (812, 210), (784, 204), (772, 150)]
WRIST = (806, 206)
FOREARM_POLY = [(420, 120), (830, 80), (850, 250), (700, 310), (420, 340)]

BELL_C, BELL_PIVOT = (878, 513), (884, 488)
PENDANT_C = (848, 582)
BAG_POLY = [(452, 540), (520, 488), (612, 498), (614, 700), (562, 768), (468, 752), (452, 680)]
BAG_PIVOT = (602, 470)
CHARM_POLY = [(512, 600), (598, 600), (600, 718), (512, 718)]
CHARM_PIVOT = (578, 610)
RARM_POLY = [(995, 588), (1140, 596), (1236, 760), (1218, 836), (1100, 836), (988, 742)]
RARM_PIVOT = (1075, 610)
HEM_POLY = [(540, 820), (600, 850), (700, 872), (800, 885), (880, 885), (960, 860), (1030, 805),
            (1045, 850), (965, 912), (880, 935), (790, 930), (700, 918), (596, 895), (538, 868)]
MOUTH_LOW, MOUTH_CL, MOUTH_CR = (922, 410), (898, 364), (968, 392)

EYES = {
    'L': dict(c=(893.0, 274.0), ang=12.5, fit=(-26.0, 31.0), lash=(-52.0, 38.0), outer='lo'),
    'R': dict(c=(1046.0, 336.0), ang=21.0, fit=(-37.0, 25.0), lash=(-39.0, 52.0), outer='hi'),
}


# ----------------------------------------------------------------------------- asset building

def build_layers():
    src = np.array(Image.open(os.path.join(ASSETS, 'catgirl_source.png')).convert('RGB'))
    H, W = src.shape[:2]
    G['shape'] = (H, W)
    yy, xx = np.mgrid[0:H, 0:W]
    G['X'] = xx.astype(np.float32)
    G['Y'] = yy.astype(np.float32)
    f = src.astype(np.float32)
    R, B = f[..., 0], f[..., 2]
    L = 0.299 * f[..., 0] + 0.587 * f[..., 1] + 0.114 * f[..., 2]

    alpha = np.array(Image.open(os.path.join(ASSETS, 'catgirl_alpha.png'))).astype(np.float32) / 255.0
    alpha[poly_mask(RIBBON_POLY) > 0.5] = 1.0          # dark satin ribbon is under-segmented

    # tail: soft bright fur on dark pavement, partly hidden behind the bag
    region = poly_mask(TAIL_REGION) > 0.5
    fur = sstep(55, 190, L) * np.clip((60.0 - (R - B)) / 25.0, 0, 1) * region
    vis = fur * (1 - sstep(0.3, 0.7, alpha))
    n, lab, stats, _ = cv2.connectedComponentsWithStats((vis > 0.3).astype(np.uint8))
    big = 1 + int(np.argmax(stats[1:, cv2.CC_STAT_AREA]))
    keep = cv2.dilate((lab == big).astype(np.uint8), np.ones((5, 5), np.uint8)) > 0
    vis = vis * keep
    core = vis > 0.6
    d, (iy, ix) = distance_transform_edt(~core, return_indices=True)
    ext = (alpha > 0.97) & region & (d < 14)            # fur continued under the bag edge
    tail_rgb = f.copy()
    tail_rgb[ext] = f[iy[ext], ix[ext]]
    tail_a = np.maximum(vis, ext.astype(np.float32))

    # clean street plate under character + tail
    hole = (((alpha > 0.02) | (tail_a > 0.02)).astype(np.uint8))
    hole = cv2.dilate(hole, np.ones((7, 7), np.uint8))
    plate = cv2.inpaint(src, hole * 255, 9, cv2.INPAINT_TELEA).astype(np.float32)

    # foreground colour estimation so that plate+tail+character reproduces the artwork exactly at rest
    at = tail_a[..., None]
    T = np.where(at > 0.02, (f - plate * (1 - at)) / np.maximum(at, 0.02), f)
    T[ext] = tail_rgb[ext]
    T = np.clip(T, 0, 255)
    under = plate * (1 - at) + T * at
    ac = alpha[..., None]
    C = np.clip(np.where(ac > 0.02, (f - under * (1 - ac)) / np.maximum(ac, 0.02), f), 0, 255)

    Cp = C * ac / 255.0
    under = under / 255.0

    # hand: its own layer, so the finger flick never drags the hair beside it
    hp = cv2.dilate((poly_mask(HAND_POLY) > 0.5).astype(np.uint8), np.ones((9, 9), np.uint8)) > 0
    Gc = f[..., 1]
    skin_h = (R - B > 25) & (Gc >= B - 4) & (L > 120) & hp
    near = cv2.dilate(skin_h.astype(np.uint8), np.ones((7, 7), np.uint8)) > 0
    line_h = (L < 150) & (R > B + 10) & near & hp
    core = cv2.morphologyEx((skin_h | line_h).astype(np.uint8), cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8))
    flood = core.copy()
    cv2.floodFill(flood, np.zeros((H + 2, W + 2), np.uint8), (0, 0), 1)
    core = (core > 0) | (flood == 0)                     # fill enclosed holes (nails, highlights)
    n, lab, stats, _ = cv2.connectedComponentsWithStats(core.astype(np.uint8))
    core = lab == 1 + int(np.argmax(stats[1:, cv2.CC_STAT_AREA]))
    ha = cv2.GaussianBlur(core.astype(np.float32), (0, 0), 0.7)
    hreg = cv2.dilate((ha > 0.01).astype(np.uint8), np.ones((3, 3), np.uint8)) > 0
    ys, xs = np.nonzero(hreg)
    hy0, hy1 = max(int(ys.min()) - 24, 0), min(int(ys.max()) + 25, H)
    hx0, hx1 = max(int(xs.min()) - 24, 0), min(int(xs.max()) + 25, W)
    win = (slice(hy0, hy1), slice(hx0, hx1))
    # what lies behind the hand: smooth fill of the character layer (colour + alpha) from its surroundings
    stack = np.dstack([Cp[win], alpha[win]]).astype(np.float32)
    fillv = pushpull(stack, (~hreg[win]).astype(np.float32))
    hw = hreg[win]
    Cp[win][hw] = fillv[..., :3][hw]
    alpha = alpha.copy()
    alpha[win][hw] = np.clip(fillv[..., 3][hw], 0, 1)
    behind = Cp[win] + under[win] * (1 - alpha[win][..., None])
    haw = ha[win][..., None]
    Hc = np.clip(np.where(haw > 0.02, (f[win] / 255.0 - behind * (1 - haw)) / np.maximum(haw, 0.02), 0), 0, 1)
    G['hand_box'] = (hx0, hy0, hx1, hy1)
    G['Hp'] = np.ascontiguousarray(Hc * haw, dtype=np.float32)
    G['ha'] = np.ascontiguousarray(ha[win], dtype=np.float32)

    G['src'] = f / 255.0
    G['plate'] = plate / 255.0
    G['Tp'] = (T * at / 255.0).astype(np.float32)
    G['at'] = tail_a.astype(np.float32)
    G['Cp'] = Cp.astype(np.float32)
    G['ac'] = alpha.astype(np.float32)
    Lp = 0.299 * plate[..., 0] + 0.587 * plate[..., 1] + 0.114 * plate[..., 2]
    G['Lplate'] = Lp / 255.0
    ac = alpha[..., None]
    rest = (G['plate'] * (1 - at) + G['Tp']) * (1 - ac) + G['Cp']
    rest[win] = rest[win] * (1 - haw) + G['Hp']
    G['rest_err'] = float(np.abs(rest - G['src']).mean() * 255)


# ---- eyes / blink

def _fill_nan(a):
    a = a.copy()
    i = np.arange(len(a))
    ok = ~np.isnan(a)
    a[~ok] = np.interp(i[~ok], i[ok], a[ok])
    return a


def _robust_fit(u, v, deg, thr=2.5, it=8):
    ok = ~np.isnan(v)
    for _ in range(it):
        p = np.polyfit(u[ok], v[ok], deg)
        r = v - np.polyval(p, u)
        new = ~np.isnan(v) & (np.abs(r) < thr * max(1.0, float(np.nanstd(r[ok]))))
        if new.sum() == ok.sum():
            break
        ok = new
    return p


def build_eyes():
    raw = json.load(open(os.path.join(ASSETS, 'eyes_raw.json')))
    rigs = []
    for name, e in EYES.items():
        us = np.array(raw[name]['us'])
        u0, u1 = e['fit']
        sel = (us >= u0) & (us <= u1)
        p_top = _robust_fit(us[sel], np.array(raw[name]['vtop'], float)[sel], 2)
        p_up = _robust_fit(us[sel], np.array(raw[name]['vup'], float)[sel], 3)
        p_lo = _robust_fit(us[sel], np.array(raw[name]['vlo'], float)[sel], 2)
        cx, cy = e['c']
        a = e['ang'] * DEG
        ca, sa = math.cos(a), math.sin(a)
        la0, la1 = e['lash']
        # patch in image coordinates
        corners = [(u, v) for u in (la0 - 4, la1 + 4) for v in (-36, 34)]
        xs = [cx + u * ca - v * sa for u, v in corners]
        ys = [cy + u * sa + v * ca for u, v in corners]
        x0, x1 = int(math.floor(min(xs))), int(math.ceil(max(xs))) + 1
        y0, y1 = int(math.floor(min(ys))), int(math.ceil(max(ys))) + 1
        X = G['X'][y0:y1, x0:x1]
        Y = G['Y'][y0:y1, x0:x1]
        U = (X - cx) * ca + (Y - cy) * sa
        V = -(X - cx) * sa + (Y - cy) * ca
        Uc = np.clip(U, u0, u1)
        vtop = np.polyval(p_top, Uc).astype(np.float32)
        vup = np.polyval(p_up, Uc).astype(np.float32)
        vlo = np.polyval(p_lo, Uc).astype(np.float32)
        ramp = 6.0
        taper = sstep(u0, u0 + ramp, U) * sstep(u1, u1 - ramp, U)
        gap = np.clip(vlo + 1.5 - vup, 0, None) * taper
        # eye region for the closed-eye drawing: dark lash pixels connected to the lash band + the opening
        patch = G['src'][y0:y1, x0:x1]
        Lp = patch @ np.array([0.299, 0.587, 0.114], np.float32)
        Rr, Gg, Bb = patch[..., 0], patch[..., 1], patch[..., 2]
        inl = (U >= la0) & (U <= la1)
        dark = (Lp < 0.50) & (Rr > Bb - 0.03) & inl & (V >= vtop - 12) & (V <= vlo + 4)
        _, lab = cv2.connectedComponents(dark.astype(np.uint8))
        band = inl & (V >= vtop) & (V <= vup)
        lash = np.isin(lab, list(set(np.unique(lab[band & dark]).tolist()) - {0}))
        opening = (U >= u0 - 1) & (U <= u1 + 1) & (V >= vup - 1) & (V <= vlo + 2.5)
        region = cv2.dilate((lash | opening).astype(np.uint8), np.ones((5, 5), np.uint8))
        # eyelid skin: interpolate only from nearby skin pixels (never from hair or lashes)
        skin_px = (Rr - Bb > 0.07) & (Lp > 0.55) & (Gg < Rr - 0.04) & (region == 0)
        skin_px = cv2.erode(skin_px.astype(np.uint8), np.ones((3, 3), np.uint8)).astype(np.float32)
        skin = pushpull(patch, skin_px).astype(np.float32)
        m_region = cv2.GaussianBlur(region.astype(np.float32), (0, 0), 0.8)
        lash_col = np.median(patch[(Lp < 0.33) & (region > 0)], 0)
        closed = draw_closed_eye(e, p_lo, (x0, y0, x1, y1), lash_col, skin)
        rigs.append(dict(name=name, bbox=(x0, y0, x1, y1), U=U, V=V, cx=cx, cy=cy, ca=ca, sa=sa,
                         vtop=vtop, vup=vup, gap=gap.astype(np.float32), skin=skin,
                         closed=closed, closed_m=m_region))
    G['eyes'] = rigs


def draw_closed_eye(e, p_lo, bbox, col, skin):
    """Skin fill + a soft anime closed-eye stroke along the lower lid, with a small outer flick."""
    x0, y0, x1, y1 = bbox
    cx, cy = e['c']
    a = e['ang'] * DEG
    ca, sa = math.cos(a), math.sin(a)
    u0, u1 = e['fit']
    us = np.linspace(u0 - 1.5, u1 + 1.0, 60)
    vs = np.polyval(p_lo, us) - 1.2
    # thickness grows toward the outer corner
    if e['outer'] == 'lo':
        k = (u1 + 1.0 - us) / (u1 - u0 + 2.5)
        us_w = np.linspace(us[0], us[0] - 11, 14)[1:]
        vs_w = vs[0] - 0.35 * (us[0] - us_w) - 0.035 * (us[0] - us_w) ** 2
        us_all = np.concatenate([us_w[::-1], us])
        vs_all = np.concatenate([vs_w[::-1], vs])
        wid = np.concatenate([np.linspace(0.6, 5.2, len(us_w)), 1.5 + 3.7 * np.clip(k, 0, 1) ** 0.7])
    else:
        k = (us - u0 + 1.5) / (u1 - u0 + 2.5)
        us_w = np.linspace(us[-1], us[-1] + 11, 14)[1:]
        vs_w = vs[-1] - 0.30 * (us_w - us[-1]) - 0.03 * (us_w - us[-1]) ** 2
        us_all = np.concatenate([us, us_w])
        vs_all = np.concatenate([vs, vs_w])
        wid = np.concatenate([1.5 + 3.7 * np.clip(k, 0, 1) ** 0.7, np.linspace(5.2, 0.6, len(us_w))])
    wid = gaussian_filter1d(wid, 1.5)
    px = cx + us_all * ca - vs_all * sa
    py = cy + us_all * sa + vs_all * ca
    pts = np.stack([px, py], 1)
    d = np.gradient(pts, axis=0)
    nrm = np.stack([-d[:, 1], d[:, 0]], 1)
    nrm /= np.linalg.norm(nrm, axis=1, keepdims=True) + 1e-9
    poly = np.concatenate([pts + nrm * wid[:, None] / 2, (pts - nrm * wid[:, None] / 2)[::-1]], 0)
    S = 4
    img = Image.new('L', ((x1 - x0) * S, (y1 - y0) * S), 0)
    ImageDraw.Draw(img).polygon([((x - x0) * S, (y - y0) * S) for x, y in poly], fill=255)
    m = np.array(img.resize((x1 - x0, y1 - y0), Image.Resampling.LANCZOS)).astype(np.float32) / 255.0
    m = np.clip(m, 0, 1)[..., None]
    lashc = np.asarray(col, np.float32) * 0.92
    return skin * (1 - m) + lashc * m


def blink_edit(Cp, rig, b):
    """Return Cp with one eye blinking by amount b (0 open .. 1 closed)."""
    x0, y0, x1, y1 = rig['bbox']
    reg = Cp[y0:y1, x0:x1]
    if b >= 0.9:
        m = rig['closed_m'][..., None]
        Cp[y0:y1, x0:x1] = reg * (1 - m) + rig['closed'] * m
        return
    bb = min(b, 0.85)
    U, V = rig['U'], rig['V']
    shift = bb * rig['gap']
    top = rig['vtop'] - 6.0
    new_top = top + shift
    new_bot = rig['vup'] + 1.5 + shift
    active = shift > 0.05
    in_band = (V >= new_top) & (V < new_bot) & active
    Vs = np.where(in_band, V - shift, V)
    X = (rig['cx'] + U * rig['ca'] - Vs * rig['sa']).astype(np.float32)
    Y = (rig['cy'] + U * rig['sa'] + Vs * rig['ca']).astype(np.float32)
    moved = cv2.remap(G['src'], X, Y, cv2.INTER_CUBIC, borderMode=cv2.BORDER_REFLECT)
    m_skin = (np.clip(new_top - V + 0.5, 0, 1) * np.clip(V - top + 0.5, 0, 1) * active)[..., None]
    out = moved * (1 - m_skin) + rig['skin'] * m_skin
    chg = cv2.dilate((in_band | (m_skin[..., 0] > 0)).astype(np.uint8), np.ones((3, 3), np.uint8)) > 0
    reg[chg] = out[chg]


BLINKS = [2.6, 7.4, 11.9, 12.32, 17.1, 21.8, 26.3]


def blink_amount(t):
    b = 0.0
    for t0 in BLINKS:
        dt = t - t0
        if 0 <= dt < 0.10:
            b = max(b, ss(0, 0.10, dt))
        elif 0.10 <= dt < 0.16:
            b = 1.0
        elif 0.16 <= dt < 0.34:
            b = max(b, 1 - ss(0.16, 0.34, dt))
    return b


# ---- motion rig

def build_rig():
    Y = G['Y']
    head = poly_mask(HEAD_POLY, 16)
    pony = poly_mask(PONY_POLY, 14) * (0.85 - 0.45 * sstep(300, 650, Y))
    lh = poly_mask(LEFT_HAIR_POLY, 12) * (0.9 - 0.6 * sstep(320, 600, Y))
    fore = poly_mask(FOREARM_POLY, 14) * 0.8 * sstep(470, 790, G['X'])
    handm = poly_mask(HAND_POLY, 3)
    w_head = np.maximum.reduce([head, pony, lh, fore, handm * 0.8])
    R = {}
    R['breath'] = Comp(sstep(790, 540, Y))
    R['head'] = Comp(w_head)
    R['ear1'] = Comp(poly_mask(EAR1_POLY, 2.5) * axis_ramp(EAR1_PIVOT, EAR1_TIP, 0.0, 0.62))
    R['ear2'] = Comp(poly_mask(EAR2_POLY, 2.5) * axis_ramp(EAR2_PIVOT, EAR2_TIP, 0.10, 0.50))
    R['ahoge'] = Comp(poly_mask(AHOGE_POLY, 2.5) * sstep(12, 55, dist_from(AHOGE_PIVOT)))
    ponym = poly_mask(PONY_POLY, 10)
    R['pony'] = Comp(ponym * sstep(25, 280, dist_from(PONY_PIVOT)))
    R['lhair'] = Comp(poly_mask(LEFT_HAIR_POLY, 10) * sstep(30, 280, dist_from(LEFT_HAIR_PIVOT)))
    # breeze weight: tips of the loose hair move the most
    br = np.maximum.reduce([
        ponym * sstep(60, 330, dist_from(PONY_PIVOT)),
        poly_mask(RIGHT_FLY_POLY, 8) * 0.9,
        poly_mask(LEFT_HAIR_POLY, 10) * sstep(330, 590, Y) * 0.7,
        poly_mask(TOP_FLY_POLY, 6) * 0.45,
    ])
    R['breeze'] = Comp(br)
    rib = poly_mask(RIBBON_POLY, 2.0)
    R['ribbon'] = Comp(rib * (0.25 + 0.75 * sstep(325, 455, Y)))
    R['bell'] = Comp(np.clip((23.0 - dist_from(BELL_C)) / 6.0, 0, 1))
    R['pendant'] = Comp(gauss(PENDANT_C, 9.0))
    R['hem'] = Comp(poly_mask(HEM_POLY, 7))
    R['bag'] = Comp(poly_mask(BAG_POLY, 8))
    R['charm'] = Comp(poly_mask(CHARM_POLY, 6) * sstep(6, 30, dist_from(CHARM_PIVOT)))
    R['rarm'] = Comp(poly_mask(RARM_POLY, 10) * sstep(20, 200, dist_from(RARM_PIVOT)))
    R['m_low'] = Comp(gauss(MOUTH_LOW, 14.0), thr=5e-3)
    R['m_cl'] = Comp(gauss(MOUTH_CL, 6.5), thr=5e-3)
    R['m_cr'] = Comp(gauss(MOUTH_CR, 6.5), thr=5e-3)
    G['rig'] = R

    # tail: arc-length parameter along the skeleton for every pixel near the tail
    sk = np.array(TAIL_SKELETON, np.float32)
    seg = np.diff(sk, axis=0)
    seglen = np.hypot(seg[:, 0], seg[:, 1])
    cum = np.concatenate([[0], np.cumsum(seglen)])
    total = cum[-1]
    near = cv2.dilate((G['at'] > 0.02).astype(np.uint8), np.ones((61, 61), np.uint8)) > 0
    ys, xs = np.nonzero(near)
    P = np.stack([xs, ys], 1).astype(np.float32)
    best_d = np.full(len(P), 1e9, np.float32)
    best_s = np.zeros(len(P), np.float32)
    for i in range(len(seg)):
        a = sk[i]
        v = seg[i]
        tt = np.clip(((P - a) @ v) / (seglen[i] ** 2), 0, 1)
        proj = a + tt[:, None] * v
        dd = np.hypot(*(P - proj).T)
        upd = dd < best_d
        best_d[upd] = dd[upd]
        best_s[upd] = (cum[i] + tt[upd] * seglen[i]) / total
    s_map = np.zeros(G['shape'], np.float32)
    s_map[ys, xs] = best_s
    wmap = np.zeros(G['shape'], np.float32)
    wmap[ys, xs] = 1.0
    wmap = cv2.GaussianBlur(wmap, (0, 0), 6)
    s_map = cv2.GaussianBlur(s_map, (0, 0), 3) / np.maximum(cv2.GaussianBlur(near.astype(np.float32), (0, 0), 3), 1e-3)
    c = Comp(wmap)
    G['tail_comp'] = c
    G['tail_s'] = np.ascontiguousarray(s_map[c.s])


EAR1_TWITCH = [5.30, 14.80, 15.08, 24.10]
EAR2_TWITCH = [9.60, 19.20, 19.47, 27.40]
HAND_TAPS = [5.02, 14.52, 23.82]


def twitch(t, starts):
    v = 0.0
    for t0 in starts:
        dt = t - t0
        if 0 <= dt < 0.07:
            v += math.sin(0.5 * math.pi * dt / 0.07)
        elif 0.07 <= dt < 0.62:
            x = dt - 0.07
            v += math.exp(-x / 0.10) * math.cos(2 * math.pi * x / 0.30) * (1 - ss(0.45, 0.55, x))
    return v


def tap(t, starts, dur=0.38):
    v = 0.0
    for t0 in starts:
        dt = t - t0
        if 0 <= dt < dur:
            v += math.sin(math.pi * dt / dur) ** 2
    return v


def motion(t):
    """All scalar motion parameters at time t (s)."""
    m = {}
    m['breath'] = 0.5 - 0.5 * math.cos(8 * W0 * t)
    m['sway'] = (0.12 * osc(2, t, 0.2) + 0.05 * osc(3, t, 1.7)) * DEG
    m['head'] = (0.9 * osc(2, t, 0.9) + 0.3 * osc(5, t, 2.1)) * DEG
    m['hand'] = (1.0 * osc(3, t, 0.4) + 0.35 * osc(7, t, 1.9)) * DEG - 2.5 * DEG * tap(t, HAND_TAPS)
    m['ear1'] = (1.2 * osc(4, t, 0.2) + 0.5 * osc(9, t, 1.0)) * DEG - 5.0 * DEG * twitch(t, EAR1_TWITCH)
    m['ear2'] = (1.1 * osc(4, t, 2.3) + 0.5 * osc(10, t, 0.4)) * DEG + 5.0 * DEG * twitch(t, EAR2_TWITCH)
    m['ahoge'] = (3.5 * osc(6, t, 0.5) + 1.5 * osc(13, t, 1.2)) * DEG
    m['pony'] = (1.1 * osc(3, t, 1.1) + 0.4 * osc(7, t, 0.2)) * DEG
    m['lhair'] = (0.7 * osc(3, t, 2.0) + 0.3 * osc(8, t, 0.9)) * DEG
    m['ribbon'] = (2.2 * osc(3, t, 0.5) + 0.9 * osc(8, t, 2.4)) * DEG
    m['bell'] = (3.0 * osc(8, t, -0.6) + 1.0 * osc(16, t, 0.3)) * DEG
    m['pendant'] = (1.0 * osc(8, t, -1.1), 0.4 * osc(16, t, -0.3))
    m['bag'] = 0.5 * osc(3, t, 2.3) * DEG
    m['charm'] = (3.0 * osc(4, t, 1.0) + 1.0 * osc(9, t, 0.0)) * DEG
    m['rarm'] = 0.5 * osc(3, t, 0.8) * DEG
    m['m_low'] = 1.3 * osc(3, t, 0.5) + 0.5 * osc(7, t, 2.0)
    m['m_corner'] = 0.9 * (0.5 + 0.5 * osc(2, t, 1.3))
    m['gust'] = 0.65 + 0.35 * osc(3, t, 0.4)
    m['blink'] = blink_amount(t)
    # camera: extremely slow float
    m['zoom'] = -0.006 * math.cos(W0 * t)
    m['pan'] = (6.0 * osc(1, t, 0.6) + 1.5 * osc(3, t, 0.2), 3.0 * osc(2, t, 1.1))
    m['roll'] = 0.12 * osc(1, t, 2.2) * DEG
    return m


def char_field(t, m):
    H, W = G['shape']
    D = (np.zeros((H, W), np.float32), np.zeros((H, W), np.float32))
    R = G['rig']
    R['breath'].trans(D, 0.0, -1.6 * m['breath'])
    R['head'].rot(D, HEAD_PIVOT, m['head'])
    R['ear1'].rot(D, EAR1_PIVOT, m['ear1'])
    R['ear2'].rot(D, EAR2_PIVOT, m['ear2'])
    R['ahoge'].rot(D, AHOGE_PIVOT, m['ahoge'])
    R['pony'].rot(D, PONY_PIVOT, m['pony'])
    R['lhair'].rot(D, LEFT_HAIR_PIVOT, m['lhair'])
    R['ribbon'].rot(D, PONY_PIVOT, m['ribbon'])
    R['bell'].rot(D, BELL_PIVOT, m['bell'])
    R['pendant'].trans(D, *m['pendant'])
    R['bag'].rot(D, BAG_PIVOT, m['bag'])
    R['charm'].rot(D, CHARM_PIVOT, m['charm'])
    R['rarm'].rot(D, RARM_PIVOT, m['rarm'])
    # skirt hem: soft travelling ripple
    c = R['hem']
    ph = 4 * W0 * t - 0.022 * c.X
    D[0][c.s] += c.w * 0.6 * np.sin(ph + 1.2)
    D[1][c.s] += c.w * 1.1 * np.sin(ph)
    # breeze through loose hair: two travelling waves, gust envelope
    c = R['breeze']
    g = m['gust']
    ph1 = 5 * W0 * t - 0.021 * c.X - 0.012 * c.Y
    ph2 = 7 * W0 * t - 0.013 * c.X + 0.019 * c.Y + 1.3
    D[0][c.s] += c.w * 2.3 * g * (np.sin(ph1) + 0.45 * np.sin(ph2))
    D[1][c.s] += c.w * 1.2 * g * (np.sin(ph1 + 1.1) + 0.5 * np.sin(ph2 + 2.0))
    # mouth: tiny smile changes
    R['m_low'].trans(D, 0.25 * m['m_low'], m['m_low'])
    R['m_cl'].trans(D, -0.3 * m['m_corner'], -m['m_corner'])
    R['m_cr'].trans(D, 0.3 * m['m_corner'], -m['m_corner'])
    return D


def tail_field(t):
    H, W = G['shape']
    D = (np.zeros((H, W), np.float32), np.zeros((H, W), np.float32))
    c = G['tail_comp']
    s = G['tail_s']
    A = 4.2 * DEG
    th = A * s ** 1.3 * np.sin(5 * W0 * t - 2.0 * s + 0.3) + 0.3 * A * s ** 2 * np.sin(11 * W0 * t - 3.2 * s + 1.9)
    dx = c.X - TAIL_PIVOT[0]
    dy = c.Y - TAIL_PIVOT[1]
    D[0][c.s] += c.w * ((1 - np.cos(th)) * dx - np.sin(th) * dy)
    D[1][c.s] += c.w * (np.sin(th) * dx + (1 - np.cos(th)) * dy)
    return D


# ---- environment

def build_env():
    rng = np.random.default_rng(7)
    H, W = G['shape']
    Lp = G['Lplate']
    Lb = cv2.GaussianBlur(Lp, (0, 0), 2.0)
    G['refl'] = sstep(0.28, 0.66, Lb)
    hp = np.clip((Lp - cv2.GaussianBlur(Lp, (0, 0), 5.0)) / 0.18, 0, 1)
    G['spec'] = np.clip(hp + 0.5 * sstep(0.25, 0.65, Lp), 0, 1)
    # coarse grid for the water noise
    S = 4
    G['cgrid'] = np.mgrid[0:H // S + 2, 0:W // S + 2].astype(np.float32) * S

    def waves(n, lam, ms, amp):
        out = []
        for i in range(n):
            ang = rng.uniform(0, 2 * np.pi)
            lm = rng.uniform(*lam)
            k = 2 * np.pi / lm
            out.append((k * math.cos(ang), k * math.sin(ang), int(ms[i % len(ms)]), rng.uniform(0, 2 * np.pi), amp))
        return out
    G['rip_x'] = waves(6, (70, 170), [5, 6, 7, 8, 9, 11], 1.0)
    G['rip_y'] = waves(6, (70, 170), [6, 5, 9, 7, 11, 8], 1.0)
    G['glint'] = waves(7, (20, 55), [9, 11, 13, 14, 16, 18, 12], 1.0)

    # neon reflection zones (soft pink light from off-screen signs)
    Xs, Ys = G['X'], G['Y']

    def ell(cx, cy, rx, ry):
        return np.exp(-(((Xs - cx) / rx) ** 2 + ((Ys - cy) / ry) ** 2) * 1.6).astype(np.float32)
    G['neon'] = [
        (ell(150, 830, 300, 250), np.array([1.0, 0.36, 0.72], np.float32), 0.95, 'a'),
        (ell(230, 320, 230, 190), np.array([1.0, 0.44, 0.80], np.float32), 0.75, 'b'),
        (ell(1180, 1070, 270, 120), np.array([1.0, 0.40, 0.75], np.float32), 0.45, 'c'),
    ]

    # sparkle glints on wet highlights, away from the character
    occ = cv2.dilate(((G['ac'] > 0.02) | (G['at'] > 0.02)).astype(np.uint8), np.ones((31, 31), np.uint8)) > 0
    cand = (Lp > 0.55) & ~occ
    cand[:12] = cand[-40:] = False
    cand[:, :12] = cand[:, -12:] = False
    ys, xs = np.nonzero(cand)
    wts = Lp[ys, xs] ** 3
    idx = rng.choice(len(ys), size=46, replace=False, p=wts / wts.sum())
    cols = [np.array(c, np.float32) for c in ((1.0, 0.95, 0.85), (1.0, 0.86, 0.60), (1.0, 0.75, 0.88))]
    G['sparkles'] = [dict(p=(float(xs[i]), float(ys[i])), r=float(rng.uniform(4.5, 11.5)),
                          col=cols[int(rng.choice(3, p=[0.55, 0.3, 0.15]))],
                          per=float(rng.choice([3.0, 5.0, 6.0, 7.5, 10.0])), ph=float(rng.uniform(0, 1)),
                          dur=float(rng.uniform(0.35, 0.8)), rot=float(rng.uniform(-0.35, 0.35)))
                     for i in idx]
    G['sparkle_sprite'] = make_sparkle_sprite()

    # small background bokeh on the pavement (twinkling out-of-focus lights)
    cand2 = (Lb > 0.30) & ~occ
    cand2[:30] = cand2[-60:] = False
    cand2[:, :30] = cand2[:, -30:] = False
    ys, xs = np.nonzero(cand2)
    idx = rng.choice(len(ys), size=16, replace=False)
    bcols = [np.array(c, np.float32) for c in ((1.0, 0.80, 0.50), (1.0, 0.62, 0.82), (1.0, 0.93, 0.80))]
    G['bokeh_bg'] = [dict(p=(float(xs[i]), float(ys[i])), r=float(rng.uniform(6, 13)),
                          col=bcols[int(rng.integers(0, 3))], a=float(rng.uniform(0.18, 0.34)),
                          k=int(rng.integers(2, 7)), ph=float(rng.uniform(0, 2 * np.pi)))
                     for i in idx]
    # large foreground bokeh near the frame edges (output coordinates)
    G['bokeh_fg'] = [
        dict(p=(70, 110), r=52, col=bcols[0], a=0.10, k=2, ph=0.3, drift=(9, 6)),
        dict(p=(1390, 990), r=66, col=bcols[1], a=0.11, k=3, ph=1.9, drift=(10, 7)),
        dict(p=(1350, 90), r=40, col=bcols[2], a=0.08, k=2, ph=4.0, drift=(7, 8)),
        dict(p=(110, 1010), r=58, col=bcols[1], a=0.10, k=3, ph=2.7, drift=(8, 6)),
        dict(p=(560, 1050), r=34, col=bcols[0], a=0.07, k=4, ph=5.1, drift=(6, 5)),
        dict(p=(30, 600), r=36, col=bcols[2], a=0.07, k=2, ph=0.9, drift=(6, 9)),
        dict(p=(1425, 560), r=44, col=bcols[0], a=0.08, k=3, ph=3.3, drift=(6, 8)),
        dict(p=(300, 20), r=30, col=bcols[1], a=0.07, k=4, ph=1.4, drift=(7, 5)),
    ]
    G['disc'] = {}

    # floating doodles (source coordinates of the anchor, placed in empty street areas)
    specs = [('heart', 250, 330, 34), ('paw', 150, 530, 30), ('heart', 290, 640, 26), ('heart', 205, 860, 32),
             ('paw', 430, 965, 28), ('heart', 430, 62, 28), ('paw', 690, 44, 26), ('heart', 1392, 330, 30),
             ('paw', 1372, 560, 28), ('heart', 1335, 770, 34), ('heart', 1180, 960, 28), ('paw', 1068, 1030, 30),
             ('heart', 600, 1012, 24), ('star', 330, 190, 22), ('star', 1270, 880, 20)]
    doodles = []
    for i, (kind, x, y, size) in enumerate(specs):
        per = float(rng.choice([6.0, 7.5, 10.0]))
        doodles.append(dict(kind=kind, p=(x, y), size=size, per=per, ph=float(rng.uniform(0, 1)),
                            rise=float(rng.uniform(45, 85)), sway=float(rng.uniform(4, 9)),
                            rot0=float(rng.uniform(-18, 18)) * DEG, spin=float(rng.uniform(6, 14)) * DEG,
                            sprite=make_doodle(kind, size, rng)))
    G['doodles'] = doodles


def make_sparkle_sprite(n=97):
    c = n // 2
    y, x = np.mgrid[0:n, 0:n].astype(np.float32) - c
    r = np.hypot(x, y) / c
    ray = np.exp(-np.abs(x) / (0.30 * c)) * np.exp(-(y / (0.035 * c)) ** 2)
    ray = np.maximum(ray, np.exp(-np.abs(y) / (0.30 * c)) * np.exp(-(x / (0.035 * c)) ** 2))
    xr, yr = (x + y) / math.sqrt(2), (x - y) / math.sqrt(2)
    diag = np.exp(-np.abs(xr) / (0.12 * c)) * np.exp(-(yr / (0.03 * c)) ** 2)
    diag = np.maximum(diag, np.exp(-np.abs(yr) / (0.12 * c)) * np.exp(-(xr / (0.03 * c)) ** 2))
    core = np.exp(-(r / 0.10) ** 2) + 0.35 * np.exp(-(r / 0.28) ** 2)
    s = np.clip(ray + 0.35 * diag + core, 0, 1.4) * (1 - sstep(0.85, 1.0, r))
    return s.astype(np.float32)


def make_doodle(kind, size, rng):
    """Hand-drawn style doodle: white wobbly outline, translucent pink fill, soft pink glow."""
    S = 4
    pad = int(size * 0.8)
    N = (size + 2 * pad) * S
    c = N / 2
    if kind == 'heart':
        tt = np.linspace(0, 2 * np.pi, 160, endpoint=False)
        x = 16 * np.sin(tt) ** 3
        y = -(13 * np.cos(tt) - 5 * np.cos(2 * tt) - 2 * np.cos(3 * tt) - np.cos(4 * tt))
        sc = size * S / 34.0
        shapes = [np.stack([x * sc, (y + 2) * sc], 1)]
    elif kind == 'paw':
        sc = size * S / 30.0
        tt = np.linspace(0, 2 * np.pi, 90, endpoint=False)
        pad_ = np.stack([9.5 * np.cos(tt) * (1 + 0.12 * np.sin(tt)), 7.5 * np.sin(tt) + 5], 1)
        shapes = [pad_ * sc]
        for (tx, ty, rx, ry) in ((-10.5, -4.5, 3.6, 4.6), (-4, -10.5, 3.8, 4.9), (4, -10.5, 3.8, 4.9),
                                 (10.5, -4.5, 3.6, 4.6)):
            shapes.append(np.stack([tx + rx * np.cos(tt), ty + ry * np.sin(tt)], 1) * sc)
    else:  # four-point star
        tt = np.linspace(0, 2 * np.pi, 8, endpoint=False) - np.pi / 2
        rad = np.where(np.arange(8) % 2 == 0, 1.0, 0.38) * size * S / 2.0
        pts = np.stack([rad * np.cos(tt), rad * np.sin(tt)], 1)
        # rounded star via midpoint curve sampling
        shapes = [pts]
    fill = Image.new('L', (N, N), 0)
    line = Image.new('L', (N, N), 0)
    df, dl = ImageDraw.Draw(fill), ImageDraw.Draw(line)
    lw = max(2, int(round(size * S * 0.075)))
    for sh in shapes:
        k = np.arange(len(sh))  # gentle hand-drawn wobble
        wob = sh * (1 + 0.025 * np.sin(k * 2 * np.pi * 3 / len(sh) + rng.uniform(0, 6)))[:, None]
        pts = [(float(px + c), float(py + c)) for px, py in wob]
        df.polygon(pts, fill=255)
        dl.line(pts + [pts[0]], fill=255, width=lw, joint='curve')
        for p in (pts[0],):
            dl.ellipse([p[0] - lw / 2, p[1] - lw / 2, p[0] + lw / 2, p[1] + lw / 2], fill=255)
    n = N // S
    fa = np.array(fill.resize((n, n), Image.Resampling.LANCZOS)).astype(np.float32) / 255
    la = np.array(line.resize((n, n), Image.Resampling.LANCZOS)).astype(np.float32) / 255
    fa, la = np.clip(fa, 0, 1), np.clip(la, 0, 1)
    glow = cv2.GaussianBlur(np.maximum(fa, la), (0, 0), size * 0.18)
    pink = np.array([1.0, 0.55, 0.78], np.float32)
    white = np.array([1.0, 0.97, 0.99], np.float32)
    # premultiplied RGBA
    a_glow = np.clip(glow * 0.75, 0, 0.6)
    a_fill = fa * 0.5
    rgb = pink * a_glow[..., None]
    a = a_glow
    rgb = rgb * (1 - a_fill[..., None]) + np.array([1.0, 0.62, 0.82], np.float32) * a_fill[..., None]
    a = a * (1 - a_fill) + a_fill
    rgb = rgb * (1 - la[..., None]) + white * la[..., None]
    a = a * (1 - la) + la
    return np.dstack([rgb, a]).astype(np.float32)


def disc_sprite(r):
    key = int(round(r * 2))
    if key in G['disc']:
        return G['disc'][key]
    rr = key / 2.0
    n = int(2 * rr + 7)
    c = (n - 1) / 2
    y, x = np.mgrid[0:n, 0:n].astype(np.float32) - c
    d = np.hypot(x, y)
    body = np.clip(rr - d + 0.5, 0, 1)
    body = cv2.GaussianBlur(body, (0, 0), max(0.8, rr * 0.06))
    rim = 0.78 + 0.22 * sstep(rr * 0.5, rr * 0.95, d)
    s = (body * rim).astype(np.float32)
    G['disc'][key] = s
    return s


def plane_waves(ws, t, X, Y):
    out = np.zeros_like(X)
    for kx, ky, m, ph, amp in ws:
        out += amp * np.sin(kx * X + ky * Y - m * W0 * t + ph)
    return out / math.sqrt(len(ws))


def background(t, m):
    """Street plate with shimmering wet reflections and soft pink neon, in source coordinates."""
    H, W = G['shape']
    cy, cx = G['cgrid']
    nx = plane_waves(G['rip_x'], t, cx, cy)
    ny = plane_waves(G['rip_y'], t, cx, cy)
    gl = plane_waves(G['glint'], t, cx, cy)
    def up(a):
        return cv2.resize(a, (a.shape[1] * 4, a.shape[0] * 4), interpolation=cv2.INTER_CUBIC)[:H, :W]
    nx, ny, gl = up(nx), up(ny), up(gl)
    refl = G['refl']
    rx = 1.4 * refl * nx
    ry = 1.4 * refl * ny
    mapx = G['X'] + rx
    mapy = G['Y'] + ry
    bg = cv2.remap(G['plate'], mapx, mapy, cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT)
    spec = cv2.remap(G['spec'], mapx, mapy, cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT)
    gain = 1.0 + 0.30 * refl * gl
    bg = bg * gain[..., None]
    # neon reflections: screen-blend pink light into the wet texture
    neon = np.zeros_like(bg)
    for mask, col, strength, key in G['neon']:
        p = neon_pulse(t, key)
        amt = mask * strength * p * (0.10 + 0.9 * spec) * (1.0 + 0.35 * gl)
        neon += amt[..., None] * col
    bg = 1 - (1 - np.clip(bg, 0, 1)) * (1 - np.clip(neon, 0, 1))
    return bg.astype(np.float32)


NEON_FLICKERS = {'a': [11.3, 23.7], 'b': [4.6, 18.9], 'c': [8.2]}


def neon_pulse(t, key):
    base = {'a': 0.86 + 0.14 * osc(2, t, 0.3), 'b': 0.84 + 0.16 * osc(3, t, 2.1),
            'c': 0.85 + 0.15 * osc(2, t, 4.0)}[key]
    for t0 in NEON_FLICKERS[key]:
        dt = t - t0
        if 0 <= dt < 0.42:
            base *= 1 - 0.45 * (math.sin(math.pi * dt / 0.14) ** 2 if dt < 0.28 else 0.0) - \
                0.25 * (math.sin(math.pi * (dt - 0.28) / 0.14) ** 2 if dt >= 0.28 else 0.0)
    return base


def blend_sprite(img, spr, cx, cy, color, alpha, mode='screen'):
    """Blend a single-channel intensity sprite centred at (cx, cy)."""
    h, w = spr.shape[:2]
    x0 = int(round(cx - w / 2))
    y0 = int(round(cy - h / 2))
    X0, Y0 = max(x0, 0), max(y0, 0)
    X1, Y1 = min(x0 + w, img.shape[1]), min(y0 + h, img.shape[0])
    if X1 <= X0 or Y1 <= Y0:
        return
    s = spr[Y0 - y0:Y1 - y0, X0 - x0:X1 - x0][..., None] * alpha
    reg = img[Y0:Y1, X0:X1]
    if mode == 'screen':
        img[Y0:Y1, X0:X1] = 1 - (1 - reg) * (1 - np.clip(s * color, 0, 1))
    else:
        img[Y0:Y1, X0:X1] = reg + s * color


def place_rgba(img, spr, M):
    """Composite a premultiplied RGBA sprite through the 2x3 affine M (sprite -> image)."""
    h, w = spr.shape[:2]
    corners = np.array([[0, 0], [w, 0], [0, h], [w, h]], np.float64)
    pts = corners @ M[:, :2].T + M[:, 2]
    x0, y0 = np.floor(pts.min(0)).astype(int) - 1
    x1, y1 = np.ceil(pts.max(0)).astype(int) + 1
    X0, Y0 = max(x0, 0), max(y0, 0)
    X1, Y1 = min(x1, img.shape[1]), min(y1, img.shape[0])
    if X1 <= X0 or Y1 <= Y0:
        return
    Mt = M.copy()
    Mt[:, 2] -= (X0, Y0)
    patch = cv2.warpAffine(spr, Mt, (X1 - X0, Y1 - Y0), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_CONSTANT)
    a = patch[..., 3:4]
    img[Y0:Y1, X0:X1] = img[Y0:Y1, X0:X1] * (1 - a) + patch[..., :3]


# ----------------------------------------------------------------------------- frame rendering

def cam_matrix(m, k):
    """Source -> output affine for a layer at parallax depth k (1 = character plane)."""
    H, W = G['shape']
    s0 = OW / W
    zoom = s0 * (1.037 + k * m['zoom'])
    csrc = (W / 2.0, 530.0)
    cdst = (OW / 2.0 + k * m['pan'][0], OH / 2.0 + k * m['pan'][1])
    return affine(zoom, m['roll'], csrc, cdst)


def render(t, w=OW, h=OH):
    m = motion(t)
    sway = affine(1.0, m['sway'], (800.0, 1400.0), (800.0, 1400.0))

    # background (ground plane, parallax 0.8)
    bg = background(t, m)
    Mbg = cam_matrix(m, 0.8)
    qx, qy = grid_from(invert(Mbg))
    out = cv2.remap(bg, qx, qy, cv2.INTER_CUBIC, borderMode=cv2.BORDER_REFLECT)

    # pavement glints and small bokeh live on the ground plane
    spr = G['sparkle_sprite']
    zb = Mbg[0, 0]
    for sp in G['sparkles']:
        ph = ((t / sp['per'] + sp['ph']) % 1.0) * sp['per']
        if ph >= sp['dur']:
            continue
        e = math.sin(math.pi * ph / sp['dur']) ** 2
        size = int(2 * sp['r'] * zb * (0.75 + 0.25 * e)) | 1
        s = cv2.resize(spr, (size, size), interpolation=cv2.INTER_AREA)
        if abs(sp['rot']) > 1e-3:
            Rm = cv2.getRotationMatrix2D(((size - 1) / 2, (size - 1) / 2), math.degrees(sp['rot']), 1.0)
            s = cv2.warpAffine(s, Rm, (size, size), flags=cv2.INTER_LINEAR)
        ox, oy = apply_pt(Mbg, sp['p'])
        blend_sprite(out, s, ox, oy, sp['col'], 0.95 * e, 'add')
    for b in G['bokeh_bg']:
        fl = 0.55 + 0.45 * math.sin(b['k'] * W0 * t + b['ph'])
        ox, oy = apply_pt(Mbg, b['p'])
        blend_sprite(out, disc_sprite(b['r'] * zb), ox, oy, b['col'], b['a'] * fl * fl, 'screen')

    # tail (parallax 0.95, rides on the body sway)
    Dt = tail_field(t)
    Mt = compose(cam_matrix(m, 0.95), sway)
    qx, qy = grid_from(invert(Mt))
    dx = cv2.remap(Dt[0], qx, qy, cv2.INTER_LINEAR, borderMode=cv2.BORDER_CONSTANT)
    dy = cv2.remap(Dt[1], qx, qy, cv2.INTER_LINEAR, borderMode=cv2.BORDER_CONSTANT)
    mx, my = qx - dx, qy - dy
    Tp = cv2.remap(G['Tp'], mx, my, cv2.INTER_CUBIC, borderMode=cv2.BORDER_CONSTANT)
    ta = np.clip(cv2.remap(G['at'], mx, my, cv2.INTER_LINEAR, borderMode=cv2.BORDER_CONSTANT), 0, 1)
    out = out * (1 - ta[..., None]) + np.clip(Tp, 0, 1)

    # character (parallax 1.0)
    Cp = G['Cp']
    if m['blink'] > 1e-3:
        Cp = Cp.copy()
        for rig in G['eyes']:
            blink_edit(Cp, rig, m['blink'])
    D = char_field(t, m)
    Mc = compose(cam_matrix(m, 1.0), sway)
    qx, qy = grid_from(invert(Mc))
    dx = cv2.remap(D[0], qx, qy, cv2.INTER_LINEAR, borderMode=cv2.BORDER_CONSTANT)
    dy = cv2.remap(D[1], qx, qy, cv2.INTER_LINEAR, borderMode=cv2.BORDER_CONSTANT)
    mx, my = qx - dx, qy - dy
    C = cv2.remap(Cp, mx, my, cv2.INTER_CUBIC, borderMode=cv2.BORDER_CONSTANT)
    ca = np.clip(cv2.remap(G['ac'], mx, my, cv2.INTER_LINEAR, borderMode=cv2.BORDER_CONSTANT), 0, 1)
    out = out * (1 - ca[..., None]) + np.clip(C, 0, 1)

    # hand layer: character motion + its own little flick about the wrist
    hx0, hy0, hx1, hy1 = G['hand_box']
    oc = np.array([apply_pt(Mc, p) for p in ((hx0, hy0), (hx1, hy0), (hx0, hy1), (hx1, hy1))])
    ox0, ox1 = max(int(oc[:, 0].min()) - 16, 0), min(int(oc[:, 0].max()) + 16, OW)
    oy0, oy1 = max(int(oc[:, 1].min()) - 16, 0), min(int(oc[:, 1].max()) + 16, OH)
    sub = (slice(oy0, oy1), slice(ox0, ox1))
    sqx, sqy = qx[sub], qy[sub]
    ex, ey = sqx - WRIST[0], sqy - WRIST[1]
    wgt = sstep(8, 30, np.hypot(ex, ey))
    th = m['hand']
    c1, s1 = 1.0 - math.cos(th), math.sin(th)
    hmx = sqx - dx[sub] - wgt * (c1 * ex - s1 * ey) - hx0
    hmy = sqy - dy[sub] - wgt * (s1 * ex + c1 * ey) - hy0
    Hc = cv2.remap(G['Hp'], hmx, hmy, cv2.INTER_CUBIC, borderMode=cv2.BORDER_CONSTANT)
    Ha = np.clip(cv2.remap(G['ha'], hmx, hmy, cv2.INTER_LINEAR, borderMode=cv2.BORDER_CONSTANT), 0, 1)
    out[sub] = out[sub] * (1 - Ha[..., None]) + np.clip(Hc, 0, 1)

    # floating doodles (slightly in front of the character plane)
    Md = cam_matrix(m, 1.15)
    draw_doodles(out, G['doodles'], t, Md, Md[0, 0])

    # large, very soft foreground bokeh drifting near the frame edges
    for b in G['bokeh_fg']:
        fl = 0.6 + 0.4 * math.sin(b['k'] * W0 * t + b['ph'])
        ox = b['p'][0] + 1.5 * m['pan'][0] + b['drift'][0] * math.sin(W0 * t + b['ph'])
        oy = b['p'][1] + 1.5 * m['pan'][1] + b['drift'][1] * math.sin(2 * W0 * t + b['ph'] * 1.7)
        blend_sprite(out, disc_sprite(b['r']), ox, oy, b['col'], b['a'] * fl, 'screen')

    out = np.clip(out, 0, 1)
    if (w, h) != (OW, OH):
        out = cv2.resize(out, (w, h), interpolation=cv2.INTER_AREA)
    return out


def to_u8(img, t):
    # tiny ordered dither against banding in the soft glows
    rng = np.random.default_rng(int(round(t * FPS)) % NF)
    noise = rng.uniform(-0.5, 0.5, img.shape[:2])[..., None].astype(np.float32)
    return np.clip(img * 255 + noise, 0, 255).astype(np.uint8)


# ----------------------------------------------------------------------------- vertical (9:16) version

VW, VH = 1080, 1920
V_CROP_X0, V_CROP_W = 306, 1100      # character-centred crop of the 4:3 frame (keeps tail + ponytail)
V_DOODLES = [('heart', 170, 250, 46), ('paw', 905, 175, 40), ('heart', 610, 330, 30), ('star', 360, 120, 26),
             ('heart', 890, 1720, 44), ('paw', 190, 1660, 40), ('heart', 560, 1800, 30), ('star', 770, 1580, 26)]
V_BOKEH = [(80, 90, 70, 0), (1010, 380, 54, 1), (520, 60, 40, 2), (60, 1840, 76, 1), (1000, 1560, 60, 0),
           (420, 1880, 44, 2)]


def build_vertical():
    rng = np.random.default_rng(11)
    G['vdoodles'] = [dict(kind=k, p=(x, y), size=sz, per=float(rng.choice([6.0, 7.5, 10.0])),
                          ph=float(rng.uniform(0, 1)), rise=float(rng.uniform(50, 90)), sway=float(rng.uniform(5, 10)),
                          rot0=float(rng.uniform(-18, 18)) * DEG, spin=float(rng.uniform(6, 14)) * DEG,
                          sprite=make_doodle(k, sz, rng))
                     for k, x, y, sz in V_DOODLES]
    G['vbokeh_cols'] = [np.array(c, np.float32) for c in ((1.0, 0.80, 0.50), (1.0, 0.62, 0.82), (1.0, 0.93, 0.80))]


def draw_doodles(img, doodles, t, M=None, scale=1.0):
    for d in doodles:
        f = (t / d['per'] + d['ph']) % 1.0
        env = ss(0.0, 0.22, f) * (1 - ss(0.62, 1.0, f))
        if env <= 1e-3:
            continue
        ax, ay = apply_pt(M, d['p']) if M is not None else d['p']
        wig = 2 * math.pi * f
        px = ax + d['sway'] * math.sin(2 * wig + d['rot0'] * 3)
        py = ay - d['rise'] * f
        ang = d['rot0'] + d['spin'] * math.sin(wig + 1.0)
        sc = scale * (0.82 + 0.18 * ss(0.0, 0.3, f))
        spr = d['sprite']
        hh, ww = spr.shape[:2]
        place_rgba(img, spr * (env * 0.9), affine(sc, ang, (ww / 2.0, hh / 2.0), (px, py)))


def vertical(frame_u8, t):
    """Social 9:16 cut: the scene (character-centred crop) over a blurred, dimmed copy of itself,
    with a few extra doodles and bokeh floating in the soft bands."""
    f = frame_u8.astype(np.float32) / 255
    sc = VH / OH
    bw = int(OW * sc)
    bgimg = cv2.resize(f, (bw, VH), interpolation=cv2.INTER_AREA)
    x0 = (bw - VW) // 2 + int((V_CROP_X0 + V_CROP_W / 2 - OW / 2) * sc)
    x0 = int(np.clip(x0, 0, bw - VW))
    bgimg = bgimg[:, x0:x0 + VW]
    small = cv2.resize(bgimg, (VW // 8, VH // 8), interpolation=cv2.INTER_AREA)
    small = cv2.GaussianBlur(small, (0, 0), 5)
    bgimg = cv2.resize(small, (VW, VH), interpolation=cv2.INTER_CUBIC) * 0.5
    crop = f[:, V_CROP_X0:V_CROP_X0 + V_CROP_W]
    fh = int(round(OH * VW / V_CROP_W))
    fg = cv2.resize(crop, (VW, fh), interpolation=cv2.INTER_AREA)
    y0 = (VH - fh) // 2
    out = bgimg.copy()
    ft, fb = 8, 28      # short feather on top so the ear tip is not faded
    m = np.ones((fh, 1, 1), np.float32)
    m[:ft, 0, 0] = np.linspace(0, 1, ft, dtype=np.float32)
    m[-fb:, 0, 0] = np.linspace(1, 0, fb, dtype=np.float32)
    out[y0:y0 + fh] = bgimg[y0:y0 + fh] * (1 - m) + fg * m
    for i, (bx, by, br, ci) in enumerate(V_BOKEH):
        fl = 0.6 + 0.4 * math.sin((2 + i % 3) * W0 * t + i * 1.7)
        ox = bx + 10 * math.sin(W0 * t + i)
        oy = by + 8 * math.sin(2 * W0 * t + i * 2.3)
        blend_sprite(out, disc_sprite(br), ox, oy, G['vbokeh_cols'][ci], 0.12 * fl, 'screen')
    draw_doodles(out, G['vdoodles'], t)
    return to_u8(np.clip(out, 0, 1), t)


# ----------------------------------------------------------------------------- driver

def init():
    t0 = time.time()
    build_layers()
    build_eyes()
    build_rig()
    build_env()
    build_vertical()
    print(f'assets ready in {time.time() - t0:.1f}s (rest recomposite error {G["rest_err"]:.3f}/255)', flush=True)


def _work(i):
    t = i / FPS
    fr = to_u8(render(t), t)
    return i, fr


X264 = ['-c:v', 'libx264', '-preset', 'slow', '-crf', '16', '-tune', 'animation', '-pix_fmt', 'yuv420p',
        '-profile:v', 'high', '-movflags', '+faststart',
        # flat I/P quality so the keyframe at the loop point does not "pop"
        '-x264-params', f'keyint={FPS * 2}:min-keyint={FPS * 2}:scenecut=0:ipratio=1.0:pbratio=1.0:aq-mode=3']


def ffmpeg():
    return __import__('imageio_ffmpeg').get_ffmpeg_exe()


def open_master(path, w, h):
    cmd = [ffmpeg(), '-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{w}x{h}',
           '-r', str(FPS), '-i', '-', '-c:v', 'ffv1', '-level', '3', '-slices', '4', '-pix_fmt', 'bgr0', path]
    return subprocess.Popen(cmd, stdin=subprocess.PIPE)


def encode_mp4(master, out, x264=None):
    cmd = [ffmpeg(), '-y', '-loglevel', 'error', '-i', master] + (x264 or X264) + [out]
    subprocess.run(cmd, check=True)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--stills', nargs='*', type=float, help='render PNG stills at these times (s)')
    ap.add_argument('--out', default=os.path.join(HERE, 'output'))
    ap.add_argument('--masters', default=None, help='directory for the lossless FFV1 masters (default: --out)')
    ap.add_argument('--keep-masters', action='store_true')
    ap.add_argument('--workers', type=int, default=os.cpu_count() or 2)
    args = ap.parse_args()
    os.makedirs(args.out, exist_ok=True)
    init()
    if args.stills is not None:
        for t in args.stills:
            fr = to_u8(render(t), t)
            Image.fromarray(fr).save(os.path.join(args.out, f'still_{t:06.2f}.png'))
        return
    mdir = args.masters or args.out
    os.makedirs(mdir, exist_ok=True)
    m43, m916 = os.path.join(mdir, 'master_4x3.mkv'), os.path.join(mdir, 'master_9x16.mkv')
    p1, p2 = open_master(m43, OW, OH), open_master(m916, VW, VH)
    t0 = time.time()
    with Pool(args.workers) as pool:
        for i, fr in pool.imap(_work, range(NF), chunksize=2):
            p1.stdin.write(fr.tobytes())
            p2.stdin.write(vertical(fr, i / FPS).tobytes())
            if i % 60 == 0:
                print(f'frame {i}/{NF}  {time.time() - t0:.0f}s', flush=True)
    for p in (p1, p2):
        p.stdin.close()
        if p.wait() != 0:
            raise SystemExit('ffmpeg failed')
    print(f'rendered {NF} frames in {time.time() - t0:.0f}s; encoding MP4s', flush=True)
    encode_mp4(m43, os.path.join(args.out, 'catgirl_loop_30s_4x3.mp4'))
    encode_mp4(m916, os.path.join(args.out, 'catgirl_loop_30s_9x16.mp4'))
    if not args.keep_masters:
        os.remove(m43)
        os.remove(m916)
    print('done in', f'{time.time() - t0:.0f}s')


if __name__ == '__main__':
    main()
