"""Render a 30 s seamless nostalgic loop from a single anime still.

Every motion is a function of t that is periodic over LOOP seconds (all
frequencies are integer cycles per loop), so frame N == frame 0 and the
video can repeat forever without a visible cut. The original pixels are
only gently warped / relit; nothing is regenerated or upscaled.

usage: python3 render_loop.py src.png out.mp4 [--preview DIR]
"""
import argparse
import os
import subprocess
import sys
from multiprocessing import Pool

import cv2
import imageio_ffmpeg
import numpy as np

LOOP = 30.0
FPS = 30
NFRAMES = int(LOOP * FPS)
OUT_W, OUT_H = 936, 1664  # exact 9:16, fits inside the 941x1672 source
TAU = 2 * np.pi

G = {}  # precomputed state shared with worker processes (fork)


def cyc(n, t, phase=0.0):
    """sin with n whole cycles per loop -> always seamless."""
    return np.sin(TAU * n * t / LOOP + phase)


def gust(t, x):
    """Wind gusts sweeping left -> right (320 px/s), three per loop of varying
    strength. Depends only on t - x/v with whole-cycle periods, so it loops."""
    tau = TAU * (t - x / 320.0) / LOOP
    e = (0.5 - 0.5 * np.cos(3 * tau)) ** 3
    return e * (0.7 + 0.3 * np.cos(tau + 0.8))


def soft_poly(shape, pts, blur):
    m = np.zeros(shape, np.float32)
    cv2.fillPoly(m, [np.array(pts, np.int32)], 1.0)
    return cv2.GaussianBlur(m, (0, 0), blur) if blur else m


def soft_ellipse(shape, center, axes, blur, angle=0):
    m = np.zeros(shape, np.float32)
    cv2.ellipse(m, center, axes, angle, 0, 360, 1.0, -1)
    return cv2.GaussianBlur(m, (0, 0), blur) if blur else m


def ramp(v, a, b):
    return np.clip((v - a) / (b - a), 0, 1).astype(np.float32)


def smooth_noise(shape, sigma, rng):
    n = cv2.GaussianBlur(rng.standard_normal(shape).astype(np.float32), (0, 0), sigma)
    return n / (n.std() + 1e-6)


def point_lights(img, region, blur, thr, rng, amp_lo, amp_hi, cyc_lo, cyc_hi, warm=False):
    """Isolate small bright points (stars / lamps) as an additive residual layer
    and give every point its own periodic intensity curve parameters."""
    f = img.astype(np.float32)
    lum = f.mean(axis=2)
    resid = lum - cv2.GaussianBlur(lum, (0, 0), blur)
    mask = (resid > thr) & (region > 0.5)
    if warm:
        mask &= f[..., 2] > f[..., 0] + 8
    mask = cv2.dilate(mask.astype(np.uint8), np.ones((3, 3), np.uint8))
    n, labels = cv2.connectedComponents(mask)
    layer = np.clip(f - cv2.GaussianBlur(f, (0, 0), blur), 0, None) * (mask[..., None] > 0)
    params = np.stack([
        rng.uniform(amp_lo, amp_hi, n),
        rng.integers(cyc_lo, cyc_hi + 1, n).astype(np.float32),
        rng.uniform(0, TAU, n),
        rng.integers(cyc_lo, cyc_hi + 1, n).astype(np.float32),
        rng.uniform(0, TAU, n),
    ], 1).astype(np.float32)
    params[0] = 0
    return layer.astype(np.float32), labels, params


def closed_eye_patch(img, box, lash_pts, skin_box, rng):
    """Build a closed-eye version of a tiny eye: skin fill + soft lash line."""
    x0, y0, x1, y1 = box
    sx0, sy0, sx1, sy1 = skin_box
    skin = np.median(img[sy0:sy1, sx0:sx1].reshape(-1, 3), axis=0).astype(np.float32)
    out = img.astype(np.float32).copy()
    patch = np.empty((y1 - y0, x1 - x0, 3), np.float32)
    patch[:] = skin
    patch += rng.normal(0, 2.0, patch.shape[:2])[..., None]
    out[y0:y1, x0:x1] = patch
    # lash line drawn 8x supersampled for a soft anti-aliased stroke
    S = 8
    big = np.zeros(((y1 - y0 + 6) * S, (x1 - x0 + 6) * S), np.float32)
    pts = np.array([[(px - x0 + 3) * S, (py - y0 + 3) * S] for px, py in lash_pts], np.int32)
    cv2.polylines(big, [pts], False, 1.0, thickness=int(1.4 * S), lineType=cv2.LINE_AA)
    a = cv2.resize(big, (x1 - x0 + 6, y1 - y0 + 6), interpolation=cv2.INTER_AREA)
    lash = np.array([32, 28, 40], np.float32)  # BGR, matches the original lid ink
    reg = out[y0 - 3:y1 + 3, x0 - 3:x1 + 3]
    reg[:] = reg * (1 - a[..., None]) + lash * a[..., None]
    mask = np.zeros(img.shape[:2], np.float32)
    mask[y0 - 2:y1 + 2, x0 - 2:x1 + 2] = 1
    mask = cv2.GaussianBlur(mask, (0, 0), 1.2)
    return out, mask


def blink_curve(t, times, dur=0.24):
    """0 = open, 1 = closed. Quick close, brief hold, slightly slower open."""
    v = 0.0
    for t0 in times:
        p = (t - t0) / dur
        if 0 <= p <= 1:
            if p < 0.3:
                v = max(v, p / 0.3)
            elif p < 0.45:
                v = 1.0
            else:
                v = max(v, 1 - (p - 0.45) / 0.55)
    return v * v * (3 - 2 * v)


def setup(src_path):
    img = cv2.imread(src_path, cv2.IMREAD_COLOR)
    H, W = img.shape[:2]
    rng = np.random.default_rng(7)
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    shp = (H, W)

    # --- character masks (kept rigid against grass / tree / cloud motion) ---
    girl = soft_poly(shp, [(228, 1052), (335, 1050), (352, 1110), (362, 1190), (392, 1250),
                           (412, 1330), (418, 1412), (168, 1414), (172, 1290), (196, 1150)], 3)
    boy = soft_poly(shp, [(478, 798), (622, 796), (634, 900), (692, 948), (704, 1060),
                          (752, 1150), (754, 1335), (705, 1356), (466, 1356), (462, 1150),
                          (502, 952), (478, 885)], 3)
    chars = np.clip(girl + boy, 0, 1)

    # --- tree foliage mask ---
    f = img.astype(np.float32)
    leafy = ((f[..., 1] > f[..., 0] * 0.92) & (xx > 480) & (yy > 230) & (yy < 1190)).astype(np.float32)
    leafy = cv2.morphologyEx(leafy, cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8))
    leaves = cv2.GaussianBlur(leafy, (0, 0), 2.5) * (1 - chars)
    trunk = soft_poly(shp, [(872, 700), (941, 640), (941, 1190), (880, 1190)], 6)
    leaves *= 1 - 0.85 * trunk
    tree_region = cv2.GaussianBlur(cv2.dilate(leafy, np.ones((15, 15), np.uint8)), (0, 0), 6)

    # --- depth map for camera parallax (0 = far sky, 1 = nearest grass) ---
    depth = np.where(yy < 880, 0.0,
             np.where(yy < 1000, 0.05 * ramp(yy, 880, 1000) + 0.02,
             np.where(yy < 1150, 0.07 + 0.2 * ramp(yy, 1000, 1150),
                      0.3 + 0.7 * ramp(yy, 1150, H)))).astype(np.float32)
    depth = depth * (1 - tree_region) + 0.42 * tree_region
    depth = depth * (1 - girl) + 0.5 * girl
    depth = depth * (1 - boy) + 0.46 * boy
    depth = cv2.GaussianBlur(depth, (0, 0), 7)

    # --- grass / flowers ---
    grass = ramp(yy, 1150, 1210) * (1 - chars)
    grass *= 1 - tree_region * (yy < 1180)
    grass_amp = (0.5 + 2.4 * ramp(yy, 1170, H)) * grass
    gph1 = smooth_noise(shp, 10, rng) * 1.3
    gph2 = smooth_noise(shp, 6, rng) * 1.6

    # --- clouds: slow sway of the sky bands that hold clouds ---
    clouds_a = soft_poly(shp, [(0, 240), (300, 240), (300, 490), (0, 490)], 25)
    clouds_b = soft_poly(shp, [(0, 520), (941, 520), (941, 890), (0, 890)], 20)
    sky_free = (1 - tree_region) * (1 - chars) * (1 - soft_ellipse(shp, (213, 230), (40, 40), 8))
    clouds_a *= sky_free
    clouds_b *= sky_free * (1 - ramp(yy, 860, 900))

    # --- hair, ribbon, clothing ---
    girl_face = soft_ellipse(shp, (306, 1140), (34, 50), 6)
    hair_l = soft_poly(shp, [(178, 1100), (268, 1095), (262, 1370), (172, 1370)], 6)
    hair_r = soft_poly(shp, [(322, 1150), (386, 1160), (392, 1330), (340, 1320)], 6)
    ahoge = soft_ellipse(shp, (296, 1072), (30, 20), 5)
    girl_hair_w = (hair_l + hair_r) * ramp(yy, 1090, 1340) * (1 - girl_face) + ahoge * 0.7
    ribbon = soft_ellipse(shp, (210, 1172), (18, 34), 4)
    girl_head = soft_ellipse(shp, (290, 1122), (80, 78), 18)
    girl_torso = soft_poly(shp, [(200, 1060), (380, 1060), (400, 1340), (190, 1340)], 20)

    boy_hair = soft_poly(shp, [(476, 800), (624, 798), (628, 880), (476, 890)], 5)
    boy_face = soft_ellipse(shp, (548, 895), (32, 32), 5)
    boy_hair_w = boy_hair * (1 - boy_face) * (0.3 + 0.7 * ramp(yy, 800, 880))
    tie = soft_poly(shp, [(528, 935), (566, 935), (556, 1140), (522, 1140)], 4)
    tie_w = tie * ramp(yy, 950, 1140)
    jacket = soft_poly(shp, [(585, 1060), (740, 1050), (756, 1330), (590, 1340)], 6)
    jacket_w = jacket * ramp(yy, 1060, 1330)
    shirt = soft_poly(shp, [(505, 920), (690, 930), (705, 1130), (505, 1150)], 12)
    boy_torso = soft_poly(shp, [(470, 790), (700, 790), (715, 1170), (470, 1170)], 20)

    # --- point lights ---
    sky_region = ((yy < 880) & (tree_region < 0.2) & (chars < 0.1)).astype(np.float32)
    sky_region *= (1 - soft_ellipse(shp, (213, 230), (34, 34), 0))
    stars = point_lights(img, sky_region, 2.0, 14, rng, 0.35, 0.8, 2, 9)
    town_region = np.maximum(soft_poly(shp, [(0, 985), (941, 985), (941, 1118), (0, 1118)], 0),
                             soft_poly(shp, [(0, 1170), (70, 1170), (70, 1245), (0, 1245)], 0))
    town_region *= (chars < 0.1) * (tree_region < 0.3)
    town = point_lights(img, town_region, 2.5, 10, rng, 0.08, 0.28, 3, 23, warm=True)
    # a handful of lamps get a deeper, lazier "old bulb" flicker
    tp = town[2]
    pick = rng.random(len(tp)) < 0.2
    tp[pick, 0] = rng.uniform(0.3, 0.45, pick.sum())
    tp[0] = 0

    # --- blinks ---
    girl_closed, girl_eye_m = closed_eye_patch(
        img, (295, 1119, 312, 1139), [(295, 1135), (300, 1134), (306, 1132), (311, 1128)],
        (312, 1128, 318, 1138), rng)
    boy_closed, boy_eye_m = closed_eye_patch(
        img, (525, 873, 543, 887), [(526, 881), (531, 883), (537, 883), (542, 881)],
        (530, 887, 545, 893), rng)

    # --- fireflies: closed Lissajous paths (integer cycles per loop) ---
    ff = []
    for (x0, y0, size) in [(95, 1290, 1.0), (55, 1500, 1.4), (430, 1235, 0.8), (815, 1245, 0.9),
                           (880, 1440, 1.3), (655, 1520, 1.5), (300, 1575, 1.6), (790, 1115, 0.6),
                           (150, 1170, 0.6), (470, 1470, 1.2), (20, 1100, 0.55)]:
        ff.append(dict(x0=x0, y0=y0, size=size,
                       ax=rng.uniform(22, 45) * size, ay=rng.uniform(14, 28) * size,
                       nx=int(rng.integers(1, 3)), ny=int(rng.integers(1, 4)),
                       wx=rng.uniform(4, 8), wy=rng.uniform(3, 6), nw=int(rng.integers(3, 6)),
                       px=rng.uniform(0, TAU), py=rng.uniform(0, TAU), pw=rng.uniform(0, TAU),
                       nb=int(rng.integers(3, 7)), pb=rng.uniform(0, TAU)))

    # --- wind-borne specks (seed fluff) and a few stray leaves ---
    motes = []
    for k in range(13):
        motes.append(dict(kind='fluff', y0=rng.uniform(930, 1620), laps=int(rng.integers(1, 3)),
                          x0=rng.uniform(0, 1), by=rng.uniform(6, 22), nb=int(rng.integers(2, 6)),
                          pb=rng.uniform(0, TAU), size=rng.uniform(0.6, 1.3), alpha=rng.uniform(0.3, 0.55)))
    for k in range(4):
        motes.append(dict(kind='leaf', y0=rng.uniform(700, 1450), laps=1,
                          x0=rng.uniform(0, 1), by=rng.uniform(15, 35), nb=int(rng.integers(2, 4)),
                          pb=rng.uniform(0, TAU), size=rng.uniform(0.9, 1.4), alpha=0.8,
                          spin=int(rng.choice([-3, -2, 2, 3])), flip=int(rng.integers(4, 8)),
                          th0=rng.uniform(0, TAU)))

    G.update(img=f, motes=motes, H=H, W=W, xx=xx, yy=yy, depth=depth,
             grass_amp=grass_amp, gph1=gph1, gph2=gph2,
             leaves=leaves, lph1=smooth_noise(shp, 12, rng) * 2.5, lph2=smooth_noise(shp, 12, rng) * 2.5,
             clouds_a=clouds_a, clouds_b=clouds_b,
             girl_hair_w=girl_hair_w, ribbon=ribbon, girl_head=girl_head, girl_torso=girl_torso,
             boy_hair_w=boy_hair_w, tie_w=tie_w, jacket_w=jacket_w, shirt=shirt, boy_torso=boy_torso,
             stars=stars, town=town,
             girl_closed=girl_closed, girl_eye_m=girl_eye_m[..., None],
             boy_closed=boy_closed, boy_eye_m=boy_eye_m[..., None],
             fireflies=ff)

    # output-space grid: zoom 1.012 about the centre gives margin for the float
    u, v = np.meshgrid(np.arange(OUT_W, dtype=np.float32), np.arange(OUT_H, dtype=np.float32))
    G['u'], G['v'] = u, v
    G['depth_out'] = cv2.resize(depth[(H - OUT_H) // 2:(H - OUT_H) // 2 + OUT_H,
                                      (W - OUT_W) // 2:(W - OUT_W) // 2 + OUT_W], (OUT_W, OUT_H))


def modulate_points(layer, labels, params, t):
    amp, n1, p1, n2, p2 = params.T
    k = amp * (0.7 * np.sin(TAU * n1 * t / LOOP + p1) + 0.3 * np.sin(TAU * n2 * t / LOOP + p2))
    return layer * k[labels][..., None]


def source_frame(t):
    g = G
    src = g['img'].copy()
    b = blink_curve(t, [3.3, 11.6, 12.05, 22.0, 28.4])
    if b > 0:
        m = g['girl_eye_m'] * b
        src = src * (1 - m) + g['girl_closed'] * m
    b = blink_curve(t, [6.4, 17.3, 25.2], dur=0.28)
    if b > 0:
        m = g['boy_eye_m'] * b
        src = src * (1 - m) + g['boy_closed'] * m
    src += modulate_points(*g['stars'], t)
    src += modulate_points(*g['town'], t)
    return np.clip(src, 0, 255)


def displacement(t):
    """Source-space offsets (dx, dy): pixel at p shows source pixel p + d."""
    g = G
    xx, yy = g['xx'], g['yy']
    # grass & flowers: slow travelling breeze + per-blade variation
    gw = gust(t, xx[:1, :])  # (1, W) gust strength per column, broadcast down
    s = 0.65 * np.sin(TAU * 5 * t / LOOP - 0.011 * xx + 0.004 * yy + g['gph1']) \
        + 0.35 * np.sin(TAU * 8 * t / LOOP - 0.027 * xx + g['gph2'])
    s = s * (1 + 0.7 * gw) + 0.35 * gw * np.sin(TAU * 17 * t / LOOP - 0.05 * xx + g['gph2'])
    dx = g['grass_amp'] * (s - 1.1 * gw)  # blades lean right as a gust passes
    dy = 0.18 * g['grass_amp'] * np.abs(s) + 0.25 * g['grass_amp'] * gw
    # tree leaves
    dx += g['leaves'] * ((1.1 + 1.1 * gw) * np.sin(TAU * 6 * t / LOOP + g['lph1'])
                         + 0.5 * gw * np.sin(TAU * 19 * t / LOOP + g['lph2']) - 0.9 * gw)
    dy += g['leaves'] * (0.7 + 0.6 * gw) * np.sin(TAU * 4 * t / LOOP + g['lph2'])
    # clouds: extremely slow drift that returns home at t = LOOP
    dx += g['clouds_a'] * 2.6 * cyc(1, t) + g['clouds_b'] * 2.0 * cyc(1, t, 1.1)
    dy += g['clouds_b'] * 0.4 * cyc(1, t, 2.0)

    # girl: breathing (7 breaths), head tilt towards the boy, hair & ribbon in the breeze
    br = 0.5 + 0.5 * cyc(7, t)
    dy += g['girl_torso'] * (yy - 1335) * 0.0055 * br
    dx += g['girl_torso'] * (xx - 290) * 0.0025 * br
    th = 0.0045 * cyc(2, t, 0.4) + 0.002 * cyc(3, t)
    hx = 0.55 * cyc(1, t, 0.9) + 0.25 * cyc(3, t, 2.0)
    hy = 0.35 * cyc(2, t, 1.7)
    dx += g['girl_head'] * (-th * (yy - 1195) + hx)
    dy += g['girl_head'] * (th * (xx - 300) + hy)
    wind = cyc(3, t) * 0.7 + cyc(5, t, 1.3) * 0.3
    gg = float(gust(t, 280.0))
    flutter = gg * np.sin(TAU * 16 * t / LOOP + 0.05 * yy)
    dx += g['girl_hair_w'] * (1.7 * (0.8 * wind + 0.2 * np.sin(TAU * 7 * t / LOOP + 0.03 * yy))
                              + 0.6 * flutter - 1.8 * gg)
    dy += g['girl_hair_w'] * (0.3 * cyc(4, t, 0.5) - 0.4 * gg)
    dx += g['ribbon'] * (1.3 * cyc(4, t, 0.8) + 0.7 * gg * cyc(18, t) - 1.5 * gg)
    dy += g['ribbon'] * (0.6 * cyc(5, t, 2.2) - 0.5 * gg)

    # boy: breathing (6 breaths), hair, tie, shirt, jacket
    br = 0.5 + 0.5 * cyc(6, t, 1.0)
    dy += g['boy_torso'] * (yy - 1170) * 0.0038 * br
    dx += g['boy_torso'] * (xx - 600) * 0.0015 * br
    gb = float(gust(t, 560.0))
    dx += g['boy_hair_w'] * (0.8 * (cyc(3, t, 0.6) * 0.7 + cyc(7, t, 0.03) * 0.3)
                             + 0.35 * gb * cyc(17, t, 0.4) - 0.9 * gb)
    dy += g['boy_hair_w'] * 0.25 * cyc(4, t, 1.9)
    dx += g['tie_w'] * (0.9 * cyc(4, t, 1.0) - 1.0 * gb)
    dx += g['jacket_w'] * (0.8 * cyc(3, t, 2.0) - 0.8 * float(gust(t, 670.0)))
    dx += g['shirt'] * (0.25 + 0.3 * gb) * np.sin(TAU * 5 * t / LOOP + 0.04 * yy)
    return dx, dy


def camera(t):
    cx = 2.4 * cyc(1, t) + 0.6 * cyc(2, t, 1.2)
    cy = 1.4 * cyc(1, t, 1.9) + 0.5 * cyc(3, t, 0.3)
    z = 1.012 + 0.0025 * (0.5 - 0.5 * cyc(1, t, 1.6))
    return cx, cy, z


def draw_glow(canvas, x, y, sigma, color, inten):
    r = int(sigma * 5) + 2
    x0, y0 = int(x) - r, int(y) - r
    if x0 < 0 or y0 < 0 or x0 + 2 * r + 1 > canvas.shape[1] or y0 + 2 * r + 1 > canvas.shape[0]:
        return
    ys, xs = np.mgrid[y0:y0 + 2 * r + 1, x0:x0 + 2 * r + 1].astype(np.float32)
    d2 = (xs - x) ** 2 + (ys - y) ** 2
    a = np.exp(-d2 / (2 * sigma ** 2)) + 0.28 * np.exp(-d2 / (2 * (sigma * 4) ** 2))
    canvas[y0:y0 + 2 * r + 1, x0:x0 + 2 * r + 1] += a[..., None] * (color * inten)


def draw_motes(out, t):
    L = OUT_W + 160
    for m in G['motes']:
        x = (m['x0'] * L + L * m['laps'] * t / LOOP) % L - 80
        x += 10 * cyc(m['nb'] + 1, t, m['pb'])
        y = m['y0'] + m['by'] * cyc(m['nb'], t, m['pb']) - (G['H'] - OUT_H) / 2
        vis = m['alpha'] * (0.3 + 0.7 * float(gust(t, x + 3)))
        r = 6
        x0, y0 = int(x) - r, int(y) - r
        if x0 < 0 or y0 < 0 or x0 + 2 * r + 1 > OUT_W or y0 + 2 * r + 1 > OUT_H:
            continue
        ys, xs = np.mgrid[y0:y0 + 2 * r + 1, x0:x0 + 2 * r + 1].astype(np.float32)
        ddx, ddy = xs - x, ys - y
        if m['kind'] == 'fluff':
            a = np.exp(-(ddx ** 2 + ddy ** 2) / (2 * (0.7 * m['size']) ** 2))
            col = np.array([205, 212, 218], np.float32)
        else:
            th = m['th0'] + TAU * m['spin'] * t / LOOP
            u = (ddx * np.cos(th) + ddy * np.sin(th)) / (2.3 * m['size'])
            v = (-ddx * np.sin(th) + ddy * np.cos(th)) / (
                1.1 * m['size'] * (0.25 + 0.75 * abs(np.cos(TAU * m['flip'] * t / LOOP))))
            a = np.clip(1.6 - 1.6 * np.sqrt(u * u + v * v), 0, 1)
            col = np.array([38, 58, 50], np.float32)
        a = (a * vis)[..., None]
        reg = out[y0:y0 + 2 * r + 1, x0:x0 + 2 * r + 1]
        reg[:] = reg * (1 - a) + col * a


def shooting_star(canvas, t, t0, dur, p0, p1, peak, tail):
    p = (t - t0) / dur
    if not 0 <= p <= 1:
        return
    env = np.sin(np.pi * p) ** 1.5 * peak
    hx, hy = p0[0] + (p1[0] - p0[0]) * p, p0[1] + (p1[1] - p0[1]) * p
    dxy = np.array(p1, np.float32) - np.array(p0, np.float32)
    dxy /= np.linalg.norm(dxy)
    layer = np.zeros(canvas.shape[:2], np.float32)
    n = 24
    for i in range(n):
        a0, a1 = i / n, (i + 1) / n
        q0 = (hx - dxy[0] * tail * a0, hy - dxy[1] * tail * a0)
        q1 = (hx - dxy[0] * tail * a1, hy - dxy[1] * tail * a1)
        seg = np.zeros_like(layer)
        cv2.line(seg, (int(q0[0] * 16), int(q0[1] * 16)), (int(q1[0] * 16), int(q1[1] * 16)),
                 1.0, 1, cv2.LINE_AA, shift=4)
        layer = np.maximum(layer, seg * (1 - a0) ** 2)
    layer = cv2.GaussianBlur(layer, (0, 0), 0.8) * 1.6
    canvas += layer[..., None] * np.array([255, 238, 225], np.float32) * env
    draw_glow(canvas, hx, hy, 1.1, np.array([255, 245, 235], np.float32), env * 0.9)


def render(i):
    g = G
    t = i / FPS
    src = source_frame(t)
    dx, dy = displacement(t)
    cx, cy, z = camera(t)
    H, W = g['H'], g['W']
    par = 0.3 + g['depth_out']
    mx = (W - 1) / 2 + (g['u'] - (OUT_W - 1) / 2) / z - cx * par
    my = (H - 1) / 2 + (g['v'] - (OUT_H - 1) / 2) / z - cy * par
    # sample local displacement at the (approximate) source position
    mxi = np.clip(mx, 0, W - 1).astype(np.int32)
    myi = np.clip(my, 0, H - 1).astype(np.int32)
    mx = mx + dx[myi, mxi]
    my = my + dy[myi, mxi]
    out = cv2.remap(src.astype(np.float32), mx.astype(np.float32), my.astype(np.float32), cv2.INTER_CUBIC, borderMode=cv2.BORDER_REFLECT)

    draw_motes(out, t)
    fx = np.zeros_like(out)
    for f in g['fireflies']:
        x = f['x0'] + f['ax'] * cyc(f['nx'], t, f['px']) + f['wx'] * cyc(f['nw'], t, f['pw'])
        y = f['y0'] + f['ay'] * cyc(f['ny'], t, f['py']) + f['wy'] * cyc(f['nw'] + 1, t, f['pw'] + 1)
        pulse = (0.5 + 0.5 * cyc(f['nb'], t, f['pb'])) ** 2.2
        draw_glow(fx, x - (W - OUT_W) / 2, y - (H - OUT_H) / 2, 1.0 + 0.9 * f['size'],
                  np.array([120, 225, 205], np.float32), 0.15 + 0.6 * pulse)
    shooting_star(fx, t, 8.6, 0.85, (880, 60), (700, 190), 0.55, 85)
    shooting_star(fx, t, 21.4, 0.7, (470, 420), (375, 488), 0.4, 60)
    fx = cv2.GaussianBlur(fx, (0, 0), 0.6)
    out = 255 - (255 - out) * (1 - np.clip(fx / 255, 0, 1))  # screen blend

    # subtle living film grain (luma + faint chroma), softened like the source
    rng = np.random.default_rng(1000 + i)
    gr = rng.normal(0, 2.4, out.shape[:2]).astype(np.float32)
    ch = rng.normal(0, 0.8, out.shape).astype(np.float32)
    out += cv2.GaussianBlur(gr, (0, 0), 0.55)[..., None] + cv2.GaussianBlur(ch, (0, 0), 0.8)
    return np.clip(out + 0.5, 0, 255).astype(np.uint8)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('src')
    ap.add_argument('out')
    ap.add_argument('--preview', help='only write a few PNG frames to this dir')
    a = ap.parse_args()
    setup(a.src)
    if a.preview:
        os.makedirs(a.preview, exist_ok=True)
        for i in [0, 99, 258, 349, 450, 643, 899]:
            cv2.imwrite(os.path.join(a.preview, f'f{i:03d}.png'), render(i))
        return
    ff = imageio_ffmpeg.get_ffmpeg_exe()
    cmd = [ff, '-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'bgr24',
           '-s', f'{OUT_W}x{OUT_H}', '-r', str(FPS), '-i', '-',
           '-vf', 'scale=out_color_matrix=bt709:out_range=tv:flags=accurate_rnd+full_chroma_int',
           '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-tune', 'grain',
           '-pix_fmt', 'yuv420p', '-colorspace', 'bt709', '-color_primaries', 'bt709',
           '-color_trc', 'bt709', '-color_range', 'tv', '-movflags', '+faststart', a.out]
    p = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    with Pool(os.cpu_count()) as pool:
        for n, fr in enumerate(pool.imap(render, range(NFRAMES), chunksize=4)):
            p.stdin.write(fr.tobytes())
            if n % 90 == 0:
                print(f'frame {n}/{NFRAMES}', file=sys.stderr, flush=True)
    p.stdin.close()
    sys.exit(p.wait())


if __name__ == '__main__':
    main()
