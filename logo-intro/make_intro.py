"""Render the animated Sora opening logo.

    python3 make_intro.py                 # full 1080p60 MP4 with sound
    python3 make_intro.py --stills 1.6 3  # preview PNGs at the given times

Needs: numpy, scipy, pillow, imageio-ffmpeg (bundles an ffmpeg binary).
"""
import argparse
import os
import subprocess
import sys
import tempfile
from multiprocessing import Pool

import numpy as np
from PIL import Image
from scipy import ndimage as ndi

import extract
import sound

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, "sora-logo.jpg")

W, H, FPS, DUR = 1920, 1080, 60, 8.0
S = H / 630.0                        # screen px per source px in the final layout
P0 = np.array([604.0, 315.0])        # centre of the logo in the source image
C = np.array([W / 2.0, H / 2.0])

# ---- timeline (seconds) -----------------------------------------------------
T_FADE_IN = 0.6
T_RISER = 0.25
T_IMPACT = 1.5
T_EYES = 2.0
T_SPARKLE = (2.18, 2.25)
T_GLIDE = (2.6, 3.35)
T_TEXT = 3.0
LETTER_GAP = 0.085
T_SWEEP = (4.0, 4.8)
T_GLINT = 4.5
T_BLINKS = (5.45,)
T_FADE_OUT = (7.25, 8.0)
HERO_SCALE = 1.55

SKY = np.array([0.78, 0.87, 1.0], np.float32)     # tint of stars and light effects


# ---- easing -------------------------------------------------------------------
def c01(x):
    return np.clip(x, 0.0, 1.0)


def smooth(x):
    x = c01(x)
    return x * x * (3 - 2 * x)


def out_cubic(x):
    return 1 - (1 - c01(x)) ** 3


def out_quint(x):
    return 1 - (1 - c01(x)) ** 5


def in_out_cubic(x):
    x = c01(x)
    return np.where(x < 0.5, 4 * x ** 3, 1 - (-2 * x + 2) ** 3 / 2)


def out_back(x, k=1.70158):
    x = c01(x) - 1
    return 1 + (k + 1) * x ** 3 + k * x ** 2


def spring(t, freq, damp):
    return 0.0 if t <= 0 else 1 - np.exp(-damp * t) * np.cos(2 * np.pi * freq * t)


def rot(a):
    c, s = np.cos(a), np.sin(a)
    return np.array([[c, -s], [s, c]])


# ---- scene state ------------------------------------------------------------------
class Scene:
    def __init__(self):
        self.logo = extract.load(SRC)
        L = self.logo
        yy, xx = np.mgrid[0:H, 0:W].astype(np.float32) + 0.5
        self.xx, self.yy = xx, yy
        self.rC = np.hypot(xx - C[0], yy - C[1])
        self.dxC, self.dyC = np.abs(xx - C[0]), np.abs(yy - C[1])

        # background plate fitted from the source image, stretched to 16:9
        plate = np.stack([np.asarray(Image.fromarray(np.ascontiguousarray(L.background[..., c]), "F")
                                     .resize((W, H), Image.BICUBIC)) for c in range(3)], -1)
        self.plate = (plate / 255.0).astype(np.float32)
        vig = 1 - 0.2 * np.clip(((xx - C[0]) / (W * 0.62)) ** 2 +
                                ((yy - C[1]) / (H * 0.75)) ** 2, 0, 1.4)
        self.vignette = vig[..., None].astype(np.float32)
        self.halo = np.exp(-(self.rC / 620.0) ** 2)[..., None] * \
            np.array([0.10, 0.28, 0.60], np.float32)

        rng = np.random.default_rng(11)
        # stars: final screen positions over an area large enough that the
        # zoomed-out start of the fly-through is still covered.  Density and
        # brightness are matched to the star field in the source image.
        ext = 2.7
        n = int(11500 * ext * ext)
        self.sf = np.c_[rng.uniform(-ext, ext, n) * W / 2, rng.uniform(-ext, ext, n) * H / 2]
        self.sz = 1.0 + 7.0 * rng.random(n) ** 1.3
        b = np.clip(rng.lognormal(-2.05, 1.05, n), 0.02, 1.4)
        self.sb = b.astype(np.float32)
        self.stw = np.where(rng.random(n) < 0.4, rng.uniform(0.2, 0.6, n), 0.0)
        self.stf = rng.uniform(0.4, 1.6, n)
        self.stp = rng.uniform(0, 2 * np.pi, n)
        self.bright = np.flatnonzero(b > 0.45)       # these get a soft halo
        self.glint = np.flatnonzero(b > 1.1)         # and these a cross glint

        # camera travel along z (fly-through that halts at the impact)
        ts = np.linspace(0, DUR, 4001)
        v = np.where(ts < T_IMPACT, 0.25 + 1.55 * smooth(ts / 1.25),
                     0.03 + 1.77 * np.exp(-(ts - T_IMPACT) / 0.11))
        cam = np.r_[0, np.cumsum((v[1:] + v[:-1]) / 2 * np.diff(ts))]
        self.cam_t, self.cam = ts, cam
        self.cam_end = cam[-1]

        # particles that gather into the core before the impact
        m = 220
        self.gs = rng.uniform(T_RISER, 1.0, m)
        self.gd = T_IMPACT - self.gs - rng.uniform(0.0, 0.12, m)
        self.gr = rng.uniform(260, 950, m)
        self.ga = rng.uniform(0, 2 * np.pi, m)
        self.gspin = rng.uniform(1.0, 2.4, m) * rng.choice([-1, 1], m)
        self.gb = rng.uniform(0.35, 1.0, m)

        # burst particles at the impact
        k = 140
        self.ba = rng.uniform(0, 2 * np.pi, k)
        self.bv = rng.uniform(260, 1500, k) * rng.uniform(0.6, 1, k)
        self.bk = rng.uniform(2.2, 4.0, k)
        self.bl = rng.uniform(0.7, 1.9, k)
        self.bs = rng.uniform(0.3, 1.0, k) ** 2
        self.bbig = rng.random(k) < 0.18
        self.bph = rng.uniform(0, 2 * np.pi, k)

    # -- camera -------------------------------------------------------------------
    def cam_at(self, t):
        return np.interp(t, self.cam_t, self.cam)

    def speed(self, t):
        return np.interp(t, self.cam_t[1:], np.diff(self.cam) / np.diff(self.cam_t))

    def zoom(self, t):
        return 1 + 0.035 * out_cubic((t - T_IMPACT) / (DUR - T_IMPACT))

    def layout(self, p, t):
        """Final-layout screen position of source point p."""
        return C + self.zoom(t) * S * (np.asarray(p) - P0)


# ---- drawing helpers ------------------------------------------------------------
class Splat:
    """Collects weighted points, then splats them bilinearly in one pass."""

    def __init__(self):
        self.pts = []

    def add(self, x, y, w):
        x, y, w = np.broadcast_arrays(x, y, w)
        self.pts.append((x.ravel(), y.ravel(), w.ravel()))

    def render(self, sigma):
        buf = np.zeros(W * H, np.float32)
        if self.pts:
            x, y, w = (np.concatenate(v) for v in zip(*self.pts))
            ok = (x >= 0) & (x < W - 1) & (y >= 0) & (y < H - 1) & (w > 0)
            x, y, w = x[ok], y[ok], w[ok]
            x0 = np.floor(x).astype(np.int64)
            y0 = np.floor(y).astype(np.int64)
            fx, fy = x - x0, y - y0
            i = y0 * W + x0
            idx = np.concatenate([i, i + 1, i + W, i + W + 1])
            wt = np.concatenate([w * (1 - fx) * (1 - fy), w * fx * (1 - fy),
                                 w * (1 - fx) * fy, w * fx * fy])
            buf += np.bincount(idx, wt, minlength=W * H).astype(np.float32)
        return ndi.gaussian_filter(buf.reshape(H, W), sigma, truncate=3)


def sample(layer, px, py):
    rows = (py - layer.origin[1]) * extract.SS
    cols = (px - layer.origin[0]) * extract.SS
    return ndi.map_coordinates(layer.sdf, [rows, cols], order=1, mode="constant",
                               cval=float(layer.sdf.min()), prefilter=False)


def coverage(d, fw, blur=0.0):
    w = 1.0 + blur
    x = np.clip(d / fw / w + 0.5, 0, 1)
    return x * x * (3 - 2 * x) if blur > 0 else x


def numeric_fw(d):
    gy, gx = np.gradient(d)
    return np.maximum(np.hypot(gx, gy), 1e-3)


def bbox(corners, pad):
    x0 = int(max(np.floor(corners[:, 0].min()) - pad, 0))
    x1 = int(min(np.ceil(corners[:, 0].max()) + pad, W))
    y0 = int(max(np.floor(corners[:, 1].min()) - pad, 0))
    y1 = int(min(np.ceil(corners[:, 1].max()) + pad, H))
    return x0, x1, y0, y1


def layer_corners(layer):
    h, w = layer.sdf.shape
    o = layer.origin
    return np.array([o, o + [w / extract.SS, 0], o + [0, h / extract.SS],
                     o + [w / extract.SS, h / extract.SS]])


def over(frame, x0, x1, y0, y1, rgb, a):
    reg = frame[y0:y1, x0:x1]
    reg *= 1 - a[..., None]
    reg += rgb * a[..., None]


def star_field(u, v, p):
    """Norm-like field of a 4-point star: >0 inside, 0 on the edge."""
    return 1.0 - (np.abs(u) ** p + np.abs(v) ** p) ** (1 / p)


# ---- per-frame animation state ------------------------------------------------
def cloud_state(sc, t):
    L = sc.logo
    tau = max(t - T_IMPACT, 0)
    final = sc.layout(L.cloud.center, t)
    g = in_out_cubic((t - T_GLIDE[0]) / (T_GLIDE[1] - T_GLIDE[0]))
    pos = C + (final - C) * g
    k = HERO_SCALE + (1.0 - HERO_SCALE) * g
    s = spring(t - T_IMPACT, 1.9, 6.0)
    a = 0.2 * np.exp(-5 * tau) * np.cos(2 * np.pi * 2.4 * tau)
    sx, sy = s * (1 - 0.7 * a), s * (1 + a)
    ang = np.radians(6) * np.exp(-4 * tau) * np.sin(2 * np.pi * 1.6 * tau)
    ang -= np.radians(4.5) * np.sin(np.pi * g)          # lean into the glide
    idle = smooth((t - 2.3) / 0.8)
    pos = pos + [0, idle * 3.2 * np.sin(2 * np.pi * (t - 2.3) / 2.7)]
    ang += idle * np.radians(0.9) * np.sin(2 * np.pi * (t - 2.3) / 3.4 + 0.8)
    breathe = 1 + idle * 0.006 * np.sin(2 * np.pi * (t - 2.3) / 1.9)
    M = sc.zoom(t) * S * k * breathe * rot(ang) @ np.diag([sx, sy])
    return pos, M, s


def blink(t):
    if t < T_EYES:
        b = 0.1
    else:
        b = 0.1 + 0.9 * out_back((t - T_EYES) / 0.2, 2.6)
    for tb in T_BLINKS:
        u = t - tb
        if 0 <= u < 0.08:
            b = min(b, 1 - 0.92 * smooth(u / 0.08))
        elif 0.08 <= u < 0.11:
            b = min(b, 0.08)
        elif 0.11 <= u < 0.25:
            b = min(b, 0.08 + 0.92 * out_cubic((u - 0.11) / 0.14))
    return max(b, 0.02)


def glance(t):
    """Eyes follow the letters as they arrive, then look back out."""
    return 3.2 * (in_out_cubic((t - T_TEXT) / 0.3) - in_out_cubic((t - 4.0) / 0.4))


def sweep(x, y, t):
    u = (t - T_SWEEP[0]) / (T_SWEEP[1] - T_SWEEP[0])
    if not 0 < u < 1:
        return None
    pos = -400 + (W + 800) * in_out_cubic(u)
    q = x + 0.42 * (y - C[1])
    return 0.95 * np.exp(-((q - pos) / 70.0) ** 2) + 0.3 * np.exp(-((q - pos) / 220.0) ** 2)


# ---- drawing the layers -----------------------------------------------------------
def draw_cloud(sc, frame, t):
    L = sc.logo
    pos, M, s = cloud_state(sc, t)
    if s <= 0.01:
        return None
    Mi = np.linalg.inv(M)
    cc = L.cloud.center
    corners = (layer_corners(L.cloud) - cc) @ M.T + pos
    x0, x1, y0, y1 = bbox(corners, 4)
    if x1 <= x0 or y1 <= y0:
        return None
    xs, ys = sc.xx[y0:y1, x0:x1], sc.yy[y0:y1, x0:x1]
    dx, dy = xs - pos[0], ys - pos[1]
    px = cc[0] + Mi[0, 0] * dx + Mi[0, 1] * dy
    py = cc[1] + Mi[1, 0] * dx + Mi[1, 1] * dy
    scale = np.sqrt(abs(np.linalg.det(M)))

    a_cloud = coverage(sample(L.cloud, px, py), extract.SS / scale)

    lo, d, span, lut = L.cloud_color
    tt = np.clip((px * d[0] + py * d[1] - lo) / span, 0, 1) * (len(lut) - 1)
    i0 = np.floor(tt).astype(int)
    i1 = np.minimum(i0 + 1, len(lut) - 1)
    fr = (tt - i0)[..., None]
    rgb = (lut[i0] * (1 - fr) + lut[i1] * fr) / 255.0

    # white-hot as it bursts out of the core
    tau = t - T_IMPACT
    flash = np.exp(-tau / 0.16) if tau >= 0 else 0
    rgb = rgb + (1.25 - rgb) * flash * 0.85

    sw = sweep(xs, ys, t)
    if sw is not None:
        rgb = rgb + sw[..., None] * 0.55

    # eyes, each carrying its sparkle and dot
    b = blink(t)
    g = glance(t)
    hi_fw = 1.0 / (scale * np.sqrt(b))      # sparkle fields are in source px
    eye_a = np.zeros_like(a_cloud)
    hi_a = np.zeros_like(a_cloud)
    for idx, eye in enumerate(L.eyes):
        maj = eye.extra["major"]
        mnr = np.array([maj[1], -maj[0]])
        # the lid closes towards a point slightly below the centre
        ec = eye.center + [g, 0] + maj * 1.5 * (1 - b)
        lx, ly = px - ec[0], py - ec[1]
        am = (lx * maj[0] + ly * maj[1]) / b
        an = lx * mnr[0] + ly * mnr[1]
        ex = eye.center[0] + am * maj[0] + an * mnr[0]
        ey = eye.center[1] + am * maj[1] + an * mnr[1]
        de = sample(eye, ex, ey)
        eye_a = np.maximum(eye_a, coverage(de, numeric_fw(de)))

        st = L.stars[idx]
        dt_ = t - T_SPARKLE[idx]
        sp = out_back(dt_ / 0.34, 3.2) * (1 + 0.07 * np.sin(2 * np.pi * 0.8 * t + idx * 2.1))
        if sp > 0.01:
            ang = st.angle - (1 - out_cubic(dt_ / 0.45)) * np.pi / 2
            r = st.radius * sp
            hx, hy = ex - st.center[0], ey - st.center[1]
            c_, s_ = np.cos(ang), np.sin(ang)
            f = star_field((c_ * hx + s_ * hy) / r, (-s_ * hx + c_ * hy) / r, st.power) * r
            hi_a = np.maximum(hi_a, coverage(f, hi_fw))
        dc, dr = L.dots[idx]
        dp = out_back((dt_ - 0.07) / 0.3, 2.5)
        if dp > 0.01:
            f = dr * dp - np.hypot(ex - dc[0], ey - dc[1])
            hi_a = np.maximum(hi_a, coverage(f, hi_fw))

    eye_a *= a_cloud
    hi_a *= eye_a
    eye_rgb = L.eye_rgb / 255.0
    rgb = rgb * (1 - eye_a[..., None]) + eye_rgb * eye_a[..., None]
    hl = np.array([0.95, 0.97, 1.0])
    if sw is not None:
        hl = hl + sw[..., None] * 0.3
    rgb = rgb * (1 - hi_a[..., None]) + hl * hi_a[..., None]

    over(frame, x0, x1, y0, y1, rgb, a_cloud)
    return pos, M, cc


def draw_text(sc, frame, t):
    L = sc.logo
    col = L.text_rgb / 255.0
    track = 1 - out_quint((t - T_TEXT) / 1.2)
    for i, lt in enumerate(L.letters):
        u = t - (T_TEXT + i * LETTER_GAP)
        if u <= 0:
            continue
        op = out_cubic(u / 0.38)
        blur = 16 * (1 - out_cubic(u / 0.55))
        yoff = 42 * (1 - out_back(u / 0.62, 2.2))
        k = sc.zoom(t) * S * (1 + 0.18 * (1 - out_cubic(u / 0.6)))
        # the word arrives from the right, trailing the cloud's glide
        pos = sc.layout(lt.center, t) + [(i + 1.5) * 24 * track, yoff]
        corners = (layer_corners(lt) - lt.center) * k + pos
        x0, x1, y0, y1 = bbox(corners, 6 + blur)
        if x1 <= x0 or y1 <= y0:
            continue
        xs, ys = sc.xx[y0:y1, x0:x1], sc.yy[y0:y1, x0:x1]
        px = lt.center[0] + (xs - pos[0]) / k
        py = lt.center[1] + (ys - pos[1]) / k
        a = coverage(sample(lt, px, py), extract.SS / k, blur) * op
        rgb = np.broadcast_to(col, a.shape + (3,))
        sw = sweep(xs, ys, t)
        if sw is not None:
            rgb = rgb + sw[..., None] * 0.8
        over(frame, x0, x1, y0, y1, rgb, a)


def draw_twinkle(frame, p, amp, ang, size):
    """Additive 4-point lens twinkle centred on screen point p."""
    r = size * amp + 1
    R = int(size * 4.5) + 8
    x0, x1 = int(max(p[0] - R, 0)), int(min(p[0] + R, W))
    y0, y1 = int(max(p[1] - R, 0)), int(min(p[1] + R, H))
    if x1 <= x0 or y1 <= y0:
        return
    yy, xx = np.mgrid[y0:y1, x0:x1] + 0.5
    hx, hy = xx - p[0], yy - p[1]
    c_, s_ = np.cos(ang), np.sin(ang)
    uu, vv = c_ * hx + s_ * hy, -s_ * hx + c_ * hy
    core = np.clip(star_field(uu / r, vv / r, 0.55) * r + 0.5, 0, 1)
    ray = size * 1.8 * amp + 1
    rays = (np.exp(-np.abs(vv) / 1.2) * np.exp(-np.abs(uu) / ray) +
            np.exp(-np.abs(uu) / 1.2) * np.exp(-np.abs(vv) / ray))
    halo = np.exp(-(hx ** 2 + hy ** 2) / (2 * (0.55 * size * amp + 1) ** 2))
    light = (core * 1.3 + rays * 0.9 + halo * 0.6) * amp
    frame[y0:y1, x0:x1] += light[..., None] * SKY


def render_frame(sc, t):
    L = sc.logo
    frame = sc.plate.copy()
    tau = t - T_IMPACT

    # soft light behind the logo that swells with the core and then settles
    core_u = float(c01((t - 0.45) / (T_IMPACT - 0.45)))
    glow = 0.25 * core_u ** 2 if tau < 0 else 0.13 + 0.45 * np.exp(-tau / 0.5)
    frame += sc.halo * glow

    fine, soft = Splat(), Splat()

    # ---- stars: fly-through, halting at the impact -------------------------------
    shutter = 2.2 / FPS
    z_now = sc.sz + sc.cam_end - sc.cam_at(t)
    z_prev = sc.sz + sc.cam_end - sc.cam_at(t - shutter)
    p_now = sc.sf * (sc.sz / z_now)[:, None]
    p_prev = sc.sf * (sc.sz / z_prev)[:, None]
    on = (np.abs(p_now[:, 0]) < W / 2 + 60) & (np.abs(p_now[:, 1]) < H / 2 + 60)
    disp = np.hypot(*(p_now[on] - p_prev[on]).T)
    K = int(np.clip(np.ceil(disp.max() / 1.0), 1, 72)) if disp.size else 1
    warp = 1 + 0.5 * min(sc.speed(t) / 1.8, 1)
    tw = 1 + sc.stw * np.sin(2 * np.pi * sc.stf * t + sc.stp)
    w = sc.sb * tw * (sc.sz / z_now) ** 0.35 * warp
    for j in range(K):
        q = p_prev[on] + (p_now[on] - p_prev[on]) * ((j + 0.5) / K) + C
        fine.add(q[:, 0], q[:, 1], w[on] * 1.6 / K)
    bi = sc.bright[on[sc.bright]]
    q = p_now[bi] + C
    soft.add(q[:, 0], q[:, 1], w[bi] * 0.9)
    gl = sc.glint[on[sc.glint]]
    if gl.size and K == 1:
        q = p_now[gl] + C
        offs = np.linspace(-10, 10, 41)
        fall = (np.exp(-np.abs(offs) / 2.6) * 0.14)[:, None]
        wg = w[gl][None, :] * fall
        fine.add(q[None, :, 0] + offs[:, None], np.broadcast_to(q[:, 1], wg.shape), wg)
        fine.add(np.broadcast_to(q[:, 0], wg.shape), q[None, :, 1] + offs[:, None], wg)

    # ---- particles gathering into the core ---------------------------------------
    if tau < 0.05:
        u = (t - sc.gs) / sc.gd
        live = (u > 0) & (u < 1)
        if live.any():
            n = 24
            for j in range(n):
                # trail: positions over the last ~70 ms of each particle's path
                uj = np.clip(u[live] - j * (0.07 / n) / sc.gd[live], 0, 1)
                r = sc.gr[live] * (1 - uj ** 2.2)
                a = sc.ga[live] + sc.gspin[live] * uj ** 2
                x = C[0] + r * np.cos(a)
                y = C[1] + r * np.sin(a) * 0.8
                wj = sc.gb[live] * smooth(uj / 0.12) * (0.35 + 1.3 * uj) * \
                    (1 - j / n) ** 1.5 / n * 6
                soft.add(x, y, wj * 2.2)
                fine.add(x, y, wj * 1.2)

    # ---- burst of sparks at the impact ---------------------------------------------
    if 0 <= tau < 2.0:
        n = 10
        for j in range(n):
            tj = max(tau - j * shutter / n, 0)
            dist = sc.bv / sc.bk * (1 - np.exp(-sc.bk * tj)) + 30
            x = C[0] + dist * np.cos(sc.ba)
            y = C[1] + dist * np.sin(sc.ba)
            life = np.clip(1 - tj / sc.bl, 0, 1) ** 1.6
            wj = sc.bs * life * (0.75 + 0.25 * np.sin(22 * tj + sc.bph)) / n
            fine.add(x, y, wj * 2.4)
            soft.add(x[sc.bbig], y[sc.bbig], wj[sc.bbig] * 5)

    frame += (fine.render(0.65) + soft.render(2.2))[..., None] * SKY

    # ---- core, flash, shockwaves, anamorphic streak ------------------------------
    if tau < 0:
        R = 5 + 34 * core_u ** 2.5
        core = core_u ** 2 * (1.3 * np.exp(-(sc.rC / R) ** 2) +
                              0.35 * np.exp(-sc.rC / (R * 3.5)))
        frame += core[..., None] * np.array([0.75, 0.88, 1.0], np.float32)
        streak = 0.5 * core_u ** 3
    else:
        fl = np.exp(-tau / 0.12)
        frame += (fl * (0.9 * np.exp(-(sc.rC / 300.0) ** 2) + 0.12))[..., None] * SKY
        for delay, amp, spd, thick, col in ((0.0, 0.85, 1150, 26, (0.55, 0.78, 1.0)),
                                            (0.07, 0.55, 800, 12, (0.9, 0.95, 1.0))):
            tr = tau - delay
            if 0 <= tr < 1.6:
                r = 40 + spd * (1 - np.exp(-3.0 * tr))
                th = 5 + thick * tr
                a = amp * np.exp(-2.4 * tr) * smooth(tr / 0.03)
                frame += (a * np.exp(-((sc.rC - r) / th) ** 2))[..., None] * \
                    np.array(col, np.float32)
        streak = 0.9 * np.exp(-tau / 0.35)
    if streak > 0.004:
        s_ = streak * np.exp(-sc.dyC / 2.5) * np.exp(-sc.dxC / 700.0) + \
            streak * 0.25 * np.exp(-sc.dyC / 14.0) * np.exp(-sc.dxC / 380.0)
        frame += s_[..., None] * np.array([0.45, 0.68, 1.0], np.float32)

    # ---- logo -------------------------------------------------------------------
    cloud = draw_cloud(sc, frame, t)
    draw_text(sc, frame, t)
    u = (t - T_GLINT) / 0.7
    if cloud is not None and 0 < u < 1:
        pos, M, cc = cloud
        draw_twinkle(frame, pos + M @ (np.array([543.0, 262.0]) - cc),
                     np.sin(np.pi * u) ** 2, u * 1.4, 32)

    # ---- post: bloom, vignette, fades, grain ------------------------------------
    lum = frame @ np.array([0.3, 0.55, 0.15], np.float32)
    hot = np.maximum(lum - 0.75, 0)
    lo = hot.reshape(H // 4, 4, W // 4, 4).mean((1, 3))
    bl = 0.4 * ndi.gaussian_filter(lo, 2.5) + 0.5 * ndi.gaussian_filter(lo, 11.0)
    up = np.asarray(Image.fromarray(bl.astype(np.float32), "F").resize((W, H), Image.BILINEAR))
    # screen blend: the glow spills into the dark sky without washing out the logo
    frame = 1 - (1 - frame) * (1 - np.minimum(up[..., None] * SKY, 1))

    frame *= sc.vignette
    fade = smooth(t / T_FADE_IN) * (1 - smooth((t - T_FADE_OUT[0]) /
                                               (T_FADE_OUT[1] - T_FADE_OUT[0])))
    frame *= fade
    rng = np.random.default_rng(int(round(t * FPS)) + 1000)
    frame += rng.standard_normal((H, W, 1), np.float32) * (0.9 / 255)
    return (np.clip(frame, 0, 1) * 255 + 0.5).astype(np.uint8)


# ---- workers ----------------------------------------------------------------------------
_scene = None


def _init():
    global _scene
    _scene = Scene()


def _render(i):
    return render_frame(_scene, i / FPS).tobytes()


def cues():
    return {
        "riser": T_RISER, "impact": T_IMPACT, "sparkles": T_SPARKLE,
        "glide": T_GLIDE, "letters": [T_TEXT + i * LETTER_GAP for i in range(4)],
        "sweep": T_SWEEP, "glint": T_GLINT, "blinks": T_BLINKS, "fade": T_FADE_OUT,
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default=os.path.join(HERE, "sora-intro.mp4"))
    ap.add_argument("--stills", nargs="*", type=float)
    ap.add_argument("--workers", type=int, default=os.cpu_count())
    args = ap.parse_args()

    if args.stills:
        sc = Scene()
        for t in args.stills:
            Image.fromarray(render_frame(sc, t)).save(
                os.path.join(HERE, f"still_{t:05.2f}.png"))
        return

    import imageio_ffmpeg
    ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()
    with tempfile.TemporaryDirectory() as tmp:
        wav = os.path.join(tmp, "audio.wav")
        sound.render(DUR, cues(), wav)
        cmd = [ffmpeg, "-y", "-loglevel", "error",
               "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS),
               "-i", "-", "-i", wav,
               "-vf", "scale=out_color_matrix=bt709:out_range=tv,format=yuv420p",
               "-c:v", "libx264", "-preset", "slow", "-crf", "16",
               "-profile:v", "high", "-color_primaries", "bt709", "-color_trc", "bt709",
               "-colorspace", "bt709",
               "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", "-shortest",
               args.out]
        enc = subprocess.Popen(cmd, stdin=subprocess.PIPE)
        n = int(DUR * FPS)
        with Pool(args.workers, initializer=_init) as pool:
            for i, buf in enumerate(pool.imap(_render, range(n), chunksize=2)):
                enc.stdin.write(buf)
                if i % 60 == 0:
                    print(f"frame {i}/{n}", file=sys.stderr, flush=True)
        enc.stdin.close()
        if enc.wait():
            sys.exit("ffmpeg failed")
    print("wrote", args.out)


if __name__ == "__main__":
    main()
