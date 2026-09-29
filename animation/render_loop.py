"""Render a 30 s seamless nostalgic loop from a single anime still.

The two characters are cut out with a matte (character_matte.png, made by
make_matte.py) and animated as their own layer over a background plate whose
hidden strip behind them is rebuilt from the surrounding scenery. That lets
them sway, breathe, tilt their heads and catch the wind without dragging the
landscape along. Everything else (grass, tree, clouds, lights) is animated by
smooth warps / relighting of the original pixels; nothing is regenerated.

Wind blows from the right: gusts sweep across the frame right -> left, hitting
the tree first, then the boy, the girl and the meadow.

Every motion is periodic over LOOP seconds (whole cycles only), so frame N ==
frame 0 and the video repeats without a visible cut.

usage: python3 render_loop.py source.png character_matte.png out.mp4 [--preview DIR]
"""
import argparse
import os
import subprocess
import sys
from multiprocessing import Pool

import cv2
import imageio_ffmpeg
import numpy as np
from scipy import ndimage as ndi

LOOP = 30.0
FPS = 30
NFRAMES = int(LOOP * FPS)
OUT_W, OUT_H = 936, 1664  # exact 9:16, fits inside the 941x1672 source
ZOOM = 1.02               # just enough margin for the camera float
TAU = 2 * np.pi
WIND_V = 260.0            # px/s, speed at which a gust front crosses the frame

# source-space boxes (x0, y0, x1, y1) that bound each animated area
GBOX = (140, 1010, 452, 1445)   # girl + everything she can move into
BBOX = (452, 755, 800, 1372)    # boy
TBOX = (470, 220, 941, 1200)    # tree
GRASS_Y0 = 1140
SKY_Y0, SKY_Y1 = 230, 905

G = {}  # precomputed state shared with worker processes (fork)


def cyc(n, t, phase=0.0):
    """sin with n whole cycles per loop -> always seamless."""
    return np.sin(TAU * n * t / LOOP + phase)


def gust(t, x):
    """0..1 gust strength at time t and column x: four gusts per loop of
    different strength, each sweeping right -> left. Periodic in t."""
    tau = TAU * (t + np.asarray(x, np.float32) / WIND_V) / LOOP
    e = (0.5 - 0.5 * np.cos(4 * tau)) ** 2.5
    return (e * (0.65 + 0.35 * np.cos(tau + 0.8))).astype(np.float32)


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


def smooth_noise(shape, sigma, rng, sigma_y=None):
    n = cv2.GaussianBlur(rng.standard_normal(shape).astype(np.float32), (0, 0),
                         sigmaX=sigma, sigmaY=sigma_y or sigma)
    return n / (n.std() + 1e-6)


def rot_disp(xx, yy, th, cx, cy):
    """Offsets that rotate content by th (rad) about (cx, cy)."""
    c, s = np.cos(th), np.sin(th)
    return (cx + c * (xx - cx) + s * (yy - cy) - xx,
            cy - s * (xx - cx) + c * (yy - cy) - yy)


def fill_behind(img8, cover):
    """Background plate with the pixels under `cover` rebuilt. Near the
    outline (the only part a moving character ever uncovers) the surrounding
    texture is mirrored across the edge; deeper in, a smooth Telea fill."""
    H, W = cover.shape
    tel = cv2.inpaint(img8, cover, 5, cv2.INPAINT_TELEA).astype(np.float32)
    d, (iy, ix) = ndi.distance_transform_edt(cover, return_indices=True)
    yy, xx = np.mgrid[0:H, 0:W]
    qy = np.clip(2 * iy - yy, 0, H - 1)
    qx = np.clip(2 * ix - xx, 0, W - 1)
    w = np.clip(1 - (d - 9) / 8, 0, 1) * (cover[qy, qx] == 0)
    w = cv2.GaussianBlur(w.astype(np.float32), (0, 0), 1.0)[..., None]
    fill = w * img8[qy, qx].astype(np.float32) + (1 - w) * tel
    out = img8.astype(np.float32)
    out[cover > 0] = fill[cover > 0]
    return out


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


def box_slice(box):
    x0, y0, x1, y1 = box
    return slice(y0, y1), slice(x0, x1)


def setup(src_path, matte_path):
    img8 = cv2.imread(src_path, cv2.IMREAD_COLOR)
    H, W = img8.shape[:2]
    img = img8.astype(np.float32)
    rng = np.random.default_rng(7)
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    shp = (H, W)

    # --- character layer: matte grown a little so it carries the outline glow ---
    matte = (cv2.imread(matte_path, cv2.IMREAD_GRAYSCALE) > 127).astype(np.uint8)
    cover = cv2.dilate(matte, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (9, 9)))
    dist = cv2.distanceTransform((1 - cover).astype(np.uint8), cv2.DIST_L2, 3)
    alpha = np.clip(1 - dist / 3.0, 0, 1).astype(np.float32)  # 1 on cover, 3 px feather
    bg = fill_behind(img8, cover)
    near_chars = cv2.GaussianBlur(
        cv2.dilate(cover, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (41, 41))).astype(np.float32),
        (0, 0), 10)

    # --- tree ---
    leafy = ((img[..., 1] > img[..., 0] * 0.92) & (xx > 480) & (yy > 230) & (yy < 1140)).astype(np.float32)
    leafy = cv2.morphologyEx(leafy, cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8))
    tree_region = cv2.GaussianBlur(cv2.dilate(leafy, np.ones((15, 15), np.uint8)), (0, 0), 6)
    trunk = soft_poly(shp, [(868, 690), (941, 620), (941, 1200), (878, 1200)], 8)
    reach = np.clip((np.hypot(925 - xx, 1150 - yy) - 250) / 450, 0, 1.25) * (1 - 0.9 * trunk)
    leaves = cv2.GaussianBlur(leafy, (0, 0), 2.5) * (1 - 0.9 * trunk)

    # --- depth for camera parallax (0 = far sky, 1 = nearest grass) ---
    depth = np.where(yy < 880, 0.0,
             np.where(yy < 1000, 0.02 + 0.05 * ramp(yy, 880, 1000),
             np.where(yy < 1150, 0.07 + 0.2 * ramp(yy, 1000, 1150),
                      0.3 + 0.7 * ramp(yy, 1150, H)))).astype(np.float32)
    depth = depth * (1 - tree_region) + 0.42 * tree_region
    depth = cv2.GaussianBlur(depth, (0, 0), 7)

    # --- meadow ---
    s = ramp(yy, 1150, H)
    grass = ramp(yy, 1150, 1215) * (1 - tree_region * (yy < 1200)) * (1 - 0.8 * near_chars)
    g_lean = grass * (1.0 + 7.0 * s ** 1.2)
    g_osc = grass * (0.8 + 4.2 * s ** 1.2)
    g_fl = grass * (0.3 + 1.1 * s)

    # --- clouds ---
    moon = soft_ellipse(shp, (213, 230), (40, 40), 8)
    sky_free = (1 - tree_region) * (1 - moon)
    clouds_a = soft_poly(shp, [(0, 240), (300, 240), (300, 490), (0, 490)], 25) * sky_free
    clouds_b = soft_poly(shp, [(0, 520), (941, 520), (941, 890), (0, 890)], 20) * sky_free
    clouds_b *= 1 - ramp(yy, 860, 900)

    # --- girl ---
    girl = dict(
        head=soft_ellipse(shp, (287, 1118), (100, 88), 14),
        torso=soft_poly(shp, [(195, 1050), (385, 1050), (405, 1345), (185, 1345)], 20),
        body=ramp(1395 - yy, 0, 150),
        hair_l=soft_poly(shp, [(160, 1100), (262, 1095), (252, 1390), (155, 1390)], 6)
        * (1 - ramp(xx, 236, 262)) * ramp(yy, 1110, 1380) ** 1.2,
        hair_r=soft_poly(shp, [(325, 1150), (388, 1158), (395, 1335), (342, 1325)], 6)
        * ramp(yy, 1150, 1335),
        ahoge=soft_ellipse(shp, (298, 1068), (32, 20), 5),
        ribbon=soft_ellipse(shp, (208, 1180), (20, 40), 4) * ramp(yy, 1140, 1212),
    )
    # --- boy ---
    boy_hair = soft_poly(shp, [(468, 772), (632, 772), (634, 885), (468, 898)], 5) \
        * (1 - soft_ellipse(shp, (548, 895), (34, 36), 5))
    boy = dict(
        head=soft_ellipse(shp, (548, 862), (85, 78), 12),
        torso=soft_poly(shp, [(470, 790), (700, 790), (715, 1170), (470, 1170)], 20),
        body=ramp(1345 - yy, 0, 200),
        hair=boy_hair * np.clip(np.hypot(xx - 548, yy - 850) / 75, 0.25, 1.3),
        tie=soft_poly(shp, [(528, 935), (566, 935), (556, 1140), (522, 1140)], 4) * ramp(yy, 945, 1140) ** 1.2,
        jacket=soft_poly(shp, [(585, 1060), (740, 1050), (756, 1335), (590, 1340)], 6) * ramp(yy, 1080, 1335),
        shirt=soft_poly(shp, [(505, 925), (690, 935), (705, 1130), (505, 1150)], 12),
        panel=soft_poly(shp, [(460, 1150), (514, 1150), (514, 1345), (460, 1345)], 5) * ramp(yy, 1150, 1340),
    )

    # --- point lights (on the background plate) ---
    sky_region = ((yy < 880) & (tree_region < 0.2) & (cover == 0)).astype(np.float32)
    sky_region *= (1 - soft_ellipse(shp, (213, 230), (34, 34), 0))
    stars = point_lights(img8, sky_region, 2.0, 14, rng, 0.35, 0.8, 2, 9)
    town_region = np.maximum(soft_poly(shp, [(0, 985), (941, 985), (941, 1118), (0, 1118)], 0),
                             soft_poly(shp, [(0, 1170), (70, 1170), (70, 1245), (0, 1245)], 0))
    town_region *= (cover == 0) * (tree_region < 0.3)
    town = point_lights(img8, town_region, 2.5, 10, rng, 0.08, 0.28, 3, 23, warm=True)
    tp = town[2]
    pick = rng.random(len(tp)) < 0.2  # a few lamps get a deeper, lazier "old bulb" flicker
    tp[pick, 0] = rng.uniform(0.3, 0.45, pick.sum())
    tp[0] = 0

    # --- blinks ---
    girl_closed, girl_eye_m = closed_eye_patch(
        img8, (295, 1119, 312, 1139), [(295, 1135), (300, 1134), (306, 1132), (311, 1128)],
        (312, 1128, 318, 1138), rng)
    boy_closed, boy_eye_m = closed_eye_patch(
        img8, (525, 873, 543, 887), [(526, 881), (531, 883), (537, 883), (542, 881)],
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

    # --- wind-borne seed fluff, daisy petals and leaves off the tree ---
    motes = []
    for kind, n, ylo, yhi in [('fluff', 16, 900, 1650), ('petal', 9, 1150, 1650), ('leaf', 6, 450, 1400)]:
        for _ in range(n):
            motes.append(dict(kind=kind, y0=rng.uniform(ylo, yhi),
                              laps=int(rng.integers(1, 3)) if kind == 'fluff' else 1,
                              x0=rng.uniform(0, 1), by=rng.uniform(6, 22) if kind == 'fluff' else rng.uniform(12, 30),
                              nb=int(rng.integers(2, 6)), pb=rng.uniform(0, TAU),
                              lift=rng.uniform(8, 25),
                              size=rng.uniform(0.7, 1.5) if kind == 'fluff' else rng.uniform(0.9, 1.4),
                              alpha=rng.uniform(0.45, 0.75) if kind == 'fluff' else rng.uniform(0.7, 0.9),
                              spin=int(rng.choice([-4, -3, -2, 2, 3, 4])), flip=int(rng.integers(4, 9)),
                              th0=rng.uniform(0, TAU)))
    ts = np.linspace(0, LOOP, 3001)
    gc = gust(ts, 470.0)
    gint = np.concatenate([[0.0], np.cumsum((gc[1:] + gc[:-1]) / 2 * np.diff(ts))])

    def crop(a, box):
        return a[box_slice(box)].copy()

    G.update(H=H, W=W, img=img, bg=bg, alpha=alpha, xx=xx, yy=yy,
             grass=dict(lean=g_lean[GRASS_Y0:], osc=g_osc[GRASS_Y0:], fl=g_fl[GRASS_Y0:],
                        ph1=(smooth_noise(shp, 30, rng) * 1.2 + TAU * yy / 900)[GRASS_Y0:],
                        ph2=(smooth_noise(shp, 18, rng) * 1.5)[GRASS_Y0:],
                        blade=(smooth_noise(shp, 4, rng, 14) * 1.6)[GRASS_Y0:]),
             tree=dict(region=crop(tree_region, TBOX), reach=crop(reach, TBOX), leaves=crop(leaves, TBOX),
                       phb=crop(smooth_noise(shp, 35, rng) * 1.3, TBOX),
                       phb2=crop(smooth_noise(shp, 35, rng) * 1.3, TBOX),
                       phl=crop(smooth_noise(shp, 4, rng) * 1.8, TBOX),
                       phl2=crop(smooth_noise(shp, 4, rng) * 1.8, TBOX)),
             clouds_a=clouds_a[SKY_Y0:SKY_Y1], clouds_b=clouds_b[SKY_Y0:SKY_Y1],
             girl={k: crop(v, GBOX) for k, v in girl.items()},
             boy={k: crop(v, BBOX) for k, v in boy.items()},
             strand_g=crop(smooth_noise(shp, 2.5, rng, 18) * 1.5, GBOX),
             strand_b=crop(smooth_noise(shp, 3, rng, 8) * 1.5, BBOX),
             stars=stars, town=town,
             girl_closed=girl_closed, girl_eye_m=girl_eye_m[..., None],
             boy_closed=boy_closed, boy_eye_m=boy_eye_m[..., None],
             fireflies=ff, motes=motes, gust_int=(ts, gint))

    # output-space helpers (static approximation of where each output pixel samples)
    u, v = np.meshgrid(np.arange(OUT_W, dtype=np.float32), np.arange(OUT_H, dtype=np.float32))
    G['u'], G['v'] = u, v
    sx = np.clip((W - 1) / 2 + (u - (OUT_W - 1) / 2) / ZOOM, 0, W - 1)
    sy = np.clip((H - 1) / 2 + (v - (OUT_H - 1) / 2) / ZOOM, 0, H - 1)
    sxi, syi = sx.astype(np.int32), sy.astype(np.int32)
    G['par_bg'] = 0.25 + 0.9 * depth[syi, sxi]
    G['par_ch'] = np.where(sx < 452, 0.25 + 0.9 * 0.64, 0.25 + 0.9 * 0.56).astype(np.float32)
    G['sheen_x'] = sx + 70 * smooth_noise((OUT_H, OUT_W), 25, rng)
    G['sheen_m'] = (grass * (0.35 + 0.65 * s))[syi, sxi] * (0.6 + 0.4 * smooth_noise((OUT_H, OUT_W), 12, rng))


def modulate_points(layer, labels, params, t):
    amp, n1, p1, n2, p2 = params.T
    k = amp * (0.7 * np.sin(TAU * n1 * t / LOOP + p1) + 0.3 * np.sin(TAU * n2 * t / LOOP + p2))
    return layer * k[labels][..., None]


def sources(t):
    g = G
    bg = g['bg'] + modulate_points(*g['stars'], t) + modulate_points(*g['town'], t)
    ch = g['img']
    b1 = blink_curve(t, [3.3, 11.6, 12.05, 22.0, 28.4])
    b2 = blink_curve(t, [6.4, 17.3, 25.2], dur=0.28)
    if b1 > 0 or b2 > 0:
        ch = ch.copy()
        if b1 > 0:
            m = g['girl_eye_m'] * b1
            ch = ch * (1 - m) + g['girl_closed'] * m
        if b2 > 0:
            m = g['boy_eye_m'] * b2
            ch = ch * (1 - m) + g['boy_closed'] * m
    return np.clip(bg, 0, 255), ch


def bg_fields(t):
    """Background offsets (dx, dy): output pixel p shows source p + d, so a
    positive dx moves content left (downwind)."""
    g = G
    H, W = g['H'], g['W']
    dx = np.zeros((H, W), np.float32)
    dy = np.zeros((H, W), np.float32)

    # meadow: gust lean + travelling sway + blade flutter
    gr = g['grass']
    xx = g['xx'][GRASS_Y0:]
    gw = gust(t, xx[:1])
    k = TAU / 420
    osc = 0.65 * np.sin(TAU * 12 * t / LOOP + k * xx + gr['ph1']) \
        + 0.35 * np.sin(TAU * 7 * t / LOOP + 0.6 * k * xx + gr['ph2'])
    gx = gr['lean'] * gw + gr['osc'] * (0.45 + 0.55 * gw) * osc \
        + gr['fl'] * (0.35 + 0.65 * gw) * np.sin(TAU * 27 * t / LOOP + gr['blade'])
    dx[GRASS_Y0:] = gx
    dy[GRASS_Y0:] = -0.12 * np.abs(gx) - 0.15 * gr['lean'] * gw

    # tree: branches sway from the trunk outwards, leaves flutter, all lean downwind
    tr = g['tree']
    ys, xs = box_slice(TBOX)
    gt = gust(t, g['xx'][ys, xs][:1])
    sway = tr['reach'] * (3.5 * gt + (1.0 + 1.6 * gt) * np.sin(TAU * 5 * t / LOOP + tr['phb']))
    dx[ys, xs] += tr['region'] * sway \
        + tr['leaves'] * (0.4 + 1.1 * gt) * np.sin(TAU * 23 * t / LOOP + tr['phl'])
    dy[ys, xs] += tr['region'] * tr['reach'] * (0.3 + 0.5 * gt) * np.sin(TAU * 4 * t / LOOP + tr['phb2']) \
        + tr['leaves'] * 0.5 * gt * np.sin(TAU * 19 * t / LOOP + tr['phl2'])

    # clouds: slow drift that returns home at t = LOOP
    dx[SKY_Y0:SKY_Y1] += g['clouds_a'] * 5.0 * cyc(1, t) \
        + g['clouds_b'] * (4.0 * cyc(1, t, 1.1) + 1.0 * cyc(2, t, 0.3))
    dy[SKY_Y0:SKY_Y1] += g['clouds_b'] * 0.6 * cyc(1, t, 2.0)
    return dx, dy


def char_fields(t):
    g = G
    H, W = g['H'], g['W']
    dx = np.zeros((H, W), np.float32)
    dy = np.zeros((H, W), np.float32)

    # ---- girl ----
    ys, xs = box_slice(GBOX)
    m = g['girl']
    xx, yy = g['xx'][ys, xs], g['yy'][ys, xs]
    gg = float(gust(t, 250.0))
    ax = np.zeros_like(xx)
    ay = np.zeros_like(xx)
    # gentle rocking of the upper body about the hips
    rx, ry = rot_disp(xx, yy, 0.0085 * cyc(1, t, 0.3) + 0.004 * cyc(2, t, 1.1), 290, 1395)
    ax += m['body'] * rx
    ay += m['body'] * ry
    # breathing: shoulders rise, chest widens (7 breaths per loop)
    b = 0.5 + 0.5 * cyc(7, t)
    ay += m['torso'] * -(yy - 1390) * 0.0075 * b
    ax += m['torso'] * -(xx - 290) * 0.003 * b
    # head: small tilts / nods while she keeps looking up at him (face stays rigid)
    hx, hy = rot_disp(xx, yy, 0.030 * (0.6 * cyc(2, t, 0.4) + 0.4 * cyc(3, t, 2.1)), 300, 1195)
    ax += m['head'] * (hx - 0.8 * cyc(1, t, 2.4))
    ay += m['head'] * (hy - 1.0 * cyc(1, t, 1.2))
    # long hair streams downwind, a wave running down the strands
    wave = np.sin(TAU * 9 * t / LOOP - TAU * (yy - 1100) / 260)
    ax += m['hair_l'] * (7.5 * gg + (1.3 + 1.7 * gg) * wave
                         + 0.7 * gg * np.sin(TAU * 26 * t / LOOP + g['strand_g']))
    ay += m['hair_l'] * (1.5 * gg + 0.5 * np.sin(TAU * 7 * t / LOOP - TAU * (yy - 1100) / 300))
    ax += m['hair_r'] * (2.0 * gg + (0.8 + 0.8 * gg) * np.sin(TAU * 9 * t / LOOP - TAU * (yy - 1150) / 260 + 1.0))
    ax += m['ahoge'] * (1.8 * gg + 1.2 * cyc(14, t))
    ay += m['ahoge'] * 0.8 * cyc(11, t, 0.7)
    ax += m['ribbon'] * (4.0 * gg + (1.2 + 1.5 * gg) * cyc(15, t))
    ay += m['ribbon'] * (1.2 * gg + 0.8 * cyc(12, t, 1.0))
    dx[ys, xs] = ax
    dy[ys, xs] = ay

    # ---- boy ----
    ys, xs = box_slice(BBOX)
    m = g['boy']
    xx, yy = g['xx'][ys, xs], g['yy'][ys, xs]
    gb = float(gust(t, 560.0))
    gj = float(gust(t, 680.0))
    ax = np.zeros_like(xx)
    ay = np.zeros_like(xx)
    # slow weight shift, pivoting at the feet
    rx, ry = rot_disp(xx, yy, 0.0055 * cyc(1, t, 1.9) + 0.0025 * cyc(2, t, 0.2), 595, 1345)
    ax += m['body'] * rx
    ay += m['body'] * ry
    b = 0.5 + 0.5 * cyc(6, t, 1.0)
    ay += m['torso'] * -(yy - 1165) * 0.0065 * b
    ax += m['torso'] * -(xx - 600) * 0.0025 * b
    hx, hy = rot_disp(xx, yy, 0.020 * (0.6 * cyc(2, t, 1.3) + 0.4 * cyc(3, t, 0.2)), 560, 935)
    ax += m['head'] * (hx - 0.6 * cyc(1, t, 0.5))
    ay += m['head'] * (hy - 0.7 * cyc(2, t, 2.0))
    ax += m['hair'] * (2.8 * gb + (0.8 + 1.0 * gb) * np.sin(TAU * 13 * t / LOOP + g['strand_b'] * 1.2))
    ay += m['hair'] * (0.6 * gb + 0.5 * np.sin(TAU * 11 * t / LOOP + g['strand_b']))
    ax += m['tie'] * (3.5 * gb + (0.8 + 1.0 * gb) * cyc(8, t, 1.0))
    ay += m['tie'] * 0.6 * gb
    ax += m['jacket'] * (3.0 * gj + (0.8 + 0.9 * gj) * np.sin(TAU * 6 * t / LOOP + 2.0 - TAU * (yy - 1080) / 500))
    ax += m['shirt'] * (0.35 + 0.6 * gb) * np.sin(TAU * 10 * t / LOOP + TAU * yy / 90 + TAU * xx / 200)
    ax += m['panel'] * (2.0 * gb + 0.8 * cyc(6, t, 0.5))
    dx[ys, xs] = ax
    dy[ys, xs] = ay
    return dx, dy


def camera(t):
    cx = 3.2 * cyc(1, t) + 0.8 * cyc(2, t, 1.2)
    cy = 2.0 * cyc(1, t, 1.9) + 0.6 * cyc(3, t, 0.3)
    z = ZOOM + 0.004 * (0.5 - 0.5 * cyc(1, t, 1.6))
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


def wind_progress(t, v0=1.0, V=6.0):
    """Monotonic progress (1 per loop) whose speed follows the gusts."""
    ts, gi = G['gust_int']
    k, r = divmod(t, LOOP)
    return k + (v0 * r + V * np.interp(r, ts, gi)) / (v0 * LOOP + V * gi[-1])


def draw_motes(out, t):
    L = OUT_W + 160
    p = wind_progress(t)
    gc = float(gust(t, 470.0))
    colors = {'fluff': (205, 212, 218), 'petal': (228, 214, 208), 'leaf': (38, 58, 50)}
    for m in G['motes']:
        x = (m['x0'] * L - L * m['laps'] * p) % L - 80
        x += 8 * cyc(m['nb'] + 1, t, m['pb'])
        y = m['y0'] + m['by'] * cyc(m['nb'], t, m['pb']) - m['lift'] * gc - (G['H'] - OUT_H) / 2
        r = 7
        x0, y0 = int(x) - r, int(y) - r
        if x0 < 0 or y0 < 0 or x0 + 2 * r + 1 > OUT_W or y0 + 2 * r + 1 > OUT_H:
            continue
        ys, xs = np.mgrid[y0:y0 + 2 * r + 1, x0:x0 + 2 * r + 1].astype(np.float32)
        ddx, ddy = xs - x, ys - y
        if m['kind'] == 'fluff':
            a = np.exp(-(ddx ** 2 + ddy ** 2) / (2 * (0.75 * m['size']) ** 2))
            vis = m['alpha'] * (0.45 + 0.55 * gc)
        else:
            th = m['th0'] + TAU * m['spin'] * t / LOOP
            ln, wd = (2.4, 1.1) if m['kind'] == 'petal' else (3.3, 1.5)
            u = (ddx * np.cos(th) + ddy * np.sin(th)) / (ln * m['size'])
            v = (-ddx * np.sin(th) + ddy * np.cos(th)) / (
                wd * m['size'] * (0.25 + 0.75 * abs(np.cos(TAU * m['flip'] * t / LOOP))))
            a = np.clip(1.6 - 1.6 * np.sqrt(u * u + v * v), 0, 1)
            vis = m['alpha']
        a = (a * vis)[..., None]
        reg = out[y0:y0 + 2 * r + 1, x0:x0 + 2 * r + 1]
        reg[:] = reg * (1 - a) + np.array(colors[m['kind']], np.float32) * a


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


def remap(src, mx, my, interp=cv2.INTER_CUBIC, border=cv2.BORDER_REFLECT):
    return cv2.remap(src, mx.astype(np.float32), my.astype(np.float32), interp, borderMode=border)


def render(i):
    g = G
    t = i / FPS
    H, W = g['H'], g['W']
    bg_src, ch_src = sources(t)
    cx, cy, z = camera(t)
    bx = (W - 1) / 2 + (g['u'] - (OUT_W - 1) / 2) / z
    by = (H - 1) / 2 + (g['v'] - (OUT_H - 1) / 2) / z

    # background plate
    dx, dy = bg_fields(t)
    mx, my = bx - cx * g['par_bg'], by - cy * g['par_bg']
    xi = np.clip(mx, 0, W - 1).astype(np.int32)
    yi = np.clip(my, 0, H - 1).astype(np.int32)
    back = remap(bg_src, mx + dx[yi, xi], my + dy[yi, xi])
    # gusts brush a moonlit sheen across the meadow as the blades bend
    sheen = gust(t, g['sheen_x']) * g['sheen_m']
    back *= 1 + sheen[..., None] * np.array([0.085, 0.075, 0.04], np.float32)

    # character layer
    dx, dy = char_fields(t)
    mx, my = bx - cx * g['par_ch'], by - cy * g['par_ch']
    xi = np.clip(mx, 0, W - 1).astype(np.int32)
    yi = np.clip(my, 0, H - 1).astype(np.int32)
    mx, my = mx + dx[yi, xi], my + dy[yi, xi]
    front = remap(ch_src, mx, my)
    a = remap(g['alpha'], mx, my, cv2.INTER_LINEAR, cv2.BORDER_CONSTANT)[..., None]
    out = front * a + back * (1 - a)

    draw_motes(out, t)
    fx = np.zeros_like(out)
    gc = float(gust(t, 470.0))
    for f in g['fireflies']:
        x = f['x0'] + f['ax'] * cyc(f['nx'], t, f['px']) + f['wx'] * cyc(f['nw'], t, f['pw']) - 14 * gc
        y = f['y0'] + f['ay'] * cyc(f['ny'], t, f['py']) + f['wy'] * cyc(f['nw'] + 1, t, f['pw'] + 1)
        pulse = (0.5 + 0.5 * cyc(f['nb'], t, f['pb'])) ** 2.2
        draw_glow(fx, x - (W - OUT_W) / 2, y - (H - OUT_H) / 2, 1.0 + 0.9 * f['size'],
                  np.array([120, 225, 205], np.float32), 0.15 + 0.6 * pulse)
    shooting_star(fx, t, 8.6, 0.85, (880, 60), (700, 190), 0.55, 85)
    shooting_star(fx, t, 21.4, 0.7, (470, 420), (375, 488), 0.4, 60)
    fx = cv2.GaussianBlur(fx, (0, 0), 0.6)
    out = 255 - (255 - np.clip(out, 0, 255)) * (1 - np.clip(fx / 255, 0, 1))  # screen blend

    # subtle living film grain (luma + faint chroma), softened like the source
    rng = np.random.default_rng(1000 + i)
    gr = rng.normal(0, 2.4, out.shape[:2]).astype(np.float32)
    ch = rng.normal(0, 0.8, out.shape).astype(np.float32)
    out += cv2.GaussianBlur(gr, (0, 0), 0.55)[..., None] + cv2.GaussianBlur(ch, (0, 0), 0.8)
    return np.clip(out + 0.5, 0, 255).astype(np.uint8)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('src')
    ap.add_argument('matte')
    ap.add_argument('out')
    ap.add_argument('--preview', help='only write a few PNG frames to this dir')
    a = ap.parse_args()
    setup(a.src, a.matte)
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
