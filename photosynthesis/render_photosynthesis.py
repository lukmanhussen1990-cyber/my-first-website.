#!/usr/bin/env python3
"""Render a 30-second photosynthesis animation to MP4 (1280x720, 30 fps).

Frames are drawn with Pillow at 2x supersampling and piped straight into
ffmpeg (bundled via the imageio-ffmpeg wheel), so no frame files hit disk.

    python3 render_photosynthesis.py [output.mp4]
"""

import math
import subprocess
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFont

W, H, S, FPS, DUR = 1280, 720, 2, 30, 30
N = FPS * DUR
FW, FH = W * S, H * S

FONT_PATH = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
_fonts = {}


def font(size):
    key = int(size * S)
    if key not in _fonts:
        _fonts[key] = ImageFont.truetype(FONT_PATH, key)
    return _fonts[key]


# ---------------------------------------------------------------- helpers
def lerp(a, b, t):
    return a + (b - a) * t


def clamp01(x):
    return 0.0 if x < 0 else (1.0 if x > 1 else x)


def smooth(x):
    x = clamp01(x)
    return x * x * (3 - 2 * x)


def seg(t, a, b):
    return smooth((t - a) / (b - a)) if b > a else 0.0


def rgba(c, a):
    a = int(clamp01(a) * 255)
    return (c[0], c[1], c[2], a)


class Canvas:
    """Draws in 1280x720 design units, scaled up to the supersampled frame."""

    def __init__(self, img, ox=0.0, oy=0.0):
        self.d = ImageDraw.Draw(img, "RGBA")
        self.ox, self.oy = ox, oy

    def _p(self, x, y):
        return ((x + self.ox) * S, (y + self.oy) * S)

    def oval(self, cx, cy, rx, ry, fill=None, outline=None, width=1):
        x0, y0 = self._p(cx - rx, cy - ry)
        x1, y1 = self._p(cx + rx, cy + ry)
        self.d.ellipse([x0, y0, x1, y1], fill=fill, outline=outline,
                       width=max(1, int(width * S)))

    def circle(self, cx, cy, r, fill=None, outline=None, width=1):
        self.oval(cx, cy, r, r, fill, outline, width)

    def line(self, pts, fill, width=1, joint="curve"):
        self.d.line([self._p(*p) for p in pts], fill=fill,
                    width=max(1, int(width * S)), joint=joint)

    def poly(self, pts, fill=None, outline=None, width=1):
        self.d.polygon([self._p(*p) for p in pts], fill=fill, outline=outline,
                       width=max(1, int(width * S)))

    def rrect(self, x0, y0, x1, y1, r, fill=None, outline=None, width=1):
        a = self._p(x0, y0)
        b = self._p(x1, y1)
        self.d.rounded_rectangle([a, b], radius=r * S, fill=fill,
                                 outline=outline, width=max(1, int(width * S)))

    def text(self, x, y, s, f, fill, anchor="mm"):
        self.d.text(self._p(x, y), s, font=f, fill=fill, anchor=anchor)

    def width_of(self, s, f):
        return self.d.textlength(s, font=f) / S


# ---------------------------------------------------------------- scene geometry
GROUND = 560.0
BX = 500.0                 # plant base x
STEM_LEN = 335.0
SUN = (168.0, 132.0)
INSET_C = (988.0, 288.0)   # magnified chloroplast view
INSET_R = 156.0

# (height fraction on stem, angle in degrees CCW from +x, length, width, unfold time)
LEAVES = [
    (0.30, -16, 132, 45, 1.5),
    (0.46, 194, 124, 42, 1.9),
    (0.63, 13, 178, 62, 2.3),     # index 2: the main leaf
    (0.79, 166, 132, 45, 2.7),
    (0.97, 76, 108, 37, 3.1),
]
MAIN = 2


def sway(t):
    return 7.0 * math.sin(t * 1.15) + 2.5 * math.sin(t * 2.7 + 1.0)


def stem_point(frac, t, grown):
    """Point at `frac` along the stem (0 = soil, 1 = tip)."""
    frac = min(frac, max(grown, 1e-4))
    y = GROUND - STEM_LEN * frac
    x = BX + sway(t) * (frac ** 1.6)
    return x, y


def quad(p0, p1, p2, n=14):
    out = []
    for i in range(n + 1):
        u = i / n
        v = 1 - u
        out.append((v * v * p0[0] + 2 * v * u * p1[0] + u * u * p2[0],
                    v * v * p0[1] + 2 * v * u * p1[1] + u * u * p2[1]))
    return out


def leaf_shape(bx, by, ang, length, width):
    a = math.radians(ang)
    ca, sa = math.cos(a), -math.sin(a)

    def loc(u, v):
        return (bx + u * ca - v * sa, by + u * sa + v * ca)

    tip = loc(length, 0)
    base = (bx, by)
    up = quad(base, loc(length * 0.42, width), tip)
    dn = quad(tip, loc(length * 0.42, -width), base)
    return base, tip, loc, up + dn[1:]


def draw_leaf(c, bx, by, ang, length, width, glow=0.0, alpha=1.0):
    base, tip, loc, pts = leaf_shape(bx, by, ang, length, width)
    body = (74, 160, 68) if glow <= 0 else (
        int(lerp(74, 132, glow)), int(lerp(160, 206, glow)), int(lerp(68, 92, glow)))
    c.poly(pts, fill=rgba(body, alpha), outline=rgba((38, 104, 44), alpha * 0.9),
           width=2.2)
    c.line([base, tip], rgba((44, 116, 50), alpha * 0.85), 2.6)
    for k in range(1, 5):
        u = k / 5.0
        m = loc(length * u, 0)
        c.line([m, loc(length * (u + 0.16), width * 0.62 * (1 - u * 0.55))],
               rgba((48, 122, 54), alpha * 0.55), 1.6)
        c.line([m, loc(length * (u + 0.16), -width * 0.62 * (1 - u * 0.55))],
               rgba((48, 122, 54), alpha * 0.55), 1.6)
    return tip


def badge(c, x, y, r, label, fill, alpha, fsize):
    c.circle(x, y, r * 1.35, fill=rgba(fill, alpha * 0.18))
    c.circle(x, y, r, fill=rgba(fill, alpha * 0.95),
             outline=rgba((255, 255, 255), alpha * 0.85), width=2)
    c.text(x, y, label, font(fsize), rgba((255, 255, 255), alpha))


def hexagon(c, x, y, r, alpha, rot=0.0):
    pts = [(x + r * math.cos(rot + i * math.pi / 3),
            y + r * math.sin(rot + i * math.pi / 3)) for i in range(6)]
    c.poly(pts, fill=rgba((246, 196, 74), alpha * 0.96),
           outline=rgba((178, 122, 22), alpha))


def path_at(pts, u):
    """Position at fraction u along a polyline."""
    segs = [math.dist(pts[i], pts[i + 1]) for i in range(len(pts) - 1)]
    total = sum(segs) or 1.0
    d = clamp01(u) * total
    for i, L in enumerate(segs):
        if d <= L or i == len(segs) - 1:
            f = d / L if L else 0.0
            return (lerp(pts[i][0], pts[i + 1][0], f),
                    lerp(pts[i][1], pts[i + 1][1], f))
        d -= L
    return pts[-1]


# ---------------------------------------------------------------- background
def make_background():
    sky = np.zeros((FH, FW, 3), np.float32)
    hz = int(GROUND * S)
    g = np.linspace(0.0, 1.0, hz)[:, None]
    for i, (a, b) in enumerate(((58, 186), (130, 226), (206, 246))):
        sky[:hz, :, i] = lerp(a, b, g ** 0.85)
    g2 = np.linspace(0.0, 1.0, FH - hz)[:, None]
    for i, (a, b) in enumerate(((132, 62), (94, 40), (58, 26))):
        sky[hz:, :, i] = lerp(a, b, g2 ** 0.7)
    arr = sky.astype(np.uint8)
    img = Image.fromarray(arr, "RGB")
    c = Canvas(img)

    # distant hills (painted, then the soil band is restored over them)
    c.oval(210, GROUND + 46, 430, 96, fill=(120, 178, 116, 255))
    c.oval(770, GROUND + 52, 520, 84, fill=(102, 164, 104, 255))
    c.oval(1190, GROUND + 40, 350, 70, fill=(128, 184, 122, 255))
    img.paste(Image.fromarray(arr[hz:], "RGB"), (0, hz))
    c.rrect(-10, GROUND - 5, W + 10, GROUND + 9, 4, fill=(116, 172, 92, 255))

    # soil speckle
    rng = np.random.default_rng(7)
    for _ in range(900):
        x = rng.uniform(0, W)
        y = rng.uniform(GROUND + 8, H)
        r = rng.uniform(1.0, 3.4)
        v = int(rng.uniform(-26, 30))
        c.circle(x, y, r, fill=(max(0, 96 + v), max(0, 66 + v), max(0, 40 + v), 150))
    for _ in range(120):
        x = rng.uniform(0, W)
        y = rng.uniform(GROUND + 6, H)
        c.oval(x, y, rng.uniform(4, 11), rng.uniform(2, 4),
               fill=(126, 92, 58, 120))
    return img


# ---------------------------------------------------------------- chloroplast inset
GRANA = [(-78, -6), (-22, -44), (28, 18), (80, -22), (-46, 54), (44, 66)]


def draw_inset(t, open_k):
    D = int(INSET_R * 2)
    img = Image.new("RGB", (D * S, D * S), (44, 116, 66))
    c = Canvas(img, INSET_R, INSET_R)
    R = INSET_R

    c.circle(0, 0, R, fill=(14, 44, 30, 246))
    c.oval(2, 8, R * 1.02, R * 0.90, fill=(58, 138, 74, 255),
           outline=(34, 96, 52, 255), width=3)
    c.oval(2, 8, R * 0.94, R * 0.82, fill=(78, 166, 92, 255))
    for gx, gy in ((-60, -50), (66, 44), (-10, 78)):
        c.oval(gx, gy, 34, 22, fill=(104, 190, 112, 90))

    # thylakoid stacks, flashing when a photon lands
    flash = {}
    ph = []
    tp0, tpi, tpd = 10.6, 0.30, 0.85
    k = 0
    while tp0 + k * tpi < t and k < 400:
        s = tp0 + k * tpi
        gi = k % len(GRANA)
        u = (t - s) / tpd
        if 0 <= u <= 1:
            ex = (-R * 0.82, -R * 0.62)
            gxy = GRANA[gi]
            ph.append((lerp(ex[0], gxy[0], u), lerp(ex[1], gxy[1], u), 1 - u * 0.2))
        elif 0 < (t - s - tpd) < 0.55:
            flash[gi] = max(flash.get(gi, 0.0), 1 - (t - s - tpd) / 0.55)
        k += 1

    for i, (gx, gy) in enumerate(GRANA):
        f = flash.get(i, 0.0)
        if f > 0:
            c.oval(gx, gy, 40, 40, fill=(255, 236, 140, int(58 * f)))
        for j in range(5):
            y = gy - 22 + j * 11
            col = (int(lerp(24, 96, f)), int(lerp(92, 176, f)), int(lerp(48, 92, f)))
            c.oval(gx, y, 27, 6.4, fill=rgba(col, 1.0),
                   outline=(18, 70, 38, 255), width=1)

    for x, y, a in ph:
        c.circle(x, y, 12, fill=(255, 238, 150, 60))
        c.circle(x, y, 6, fill=(255, 244, 176, int(255 * a)))

    # water arriving, splitting into oxygen that leaves the top-right
    ws0, wsi, wsd = 11.0, 1.05, 1.15
    k = 0
    while ws0 + k * wsi < t and k < 400:
        s = ws0 + k * wsi
        gxy = GRANA[(k * 2) % len(GRANA)]
        u = (t - s) / wsd
        if 0 <= u <= 1:
            x = lerp(-R * 0.78, gxy[0], u)
            y = lerp(R * 0.58, gxy[1] + 26, u)
            c.circle(x, y, 9, fill=(70, 156, 236, 235),
                     outline=(232, 244, 255, 220), width=1.4)
        else:
            v = (t - s - wsd) / 1.35
            if 0 <= v <= 1:
                for sgn in (-1, 1):
                    x = lerp(gxy[0], gxy[0] + 92 + sgn * 16, v)
                    y = lerp(gxy[1], gxy[1] - 108 + sgn * 12, v) - 8 * math.sin(v * 3)
                    c.circle(x, y, 8, fill=rgba((150, 226, 250), 1 - v * 0.55),
                             outline=rgba((255, 255, 255), 0.8 * (1 - v)), width=1.4)
        k += 1

    # CO2 arriving and being built into glucose
    cs0, csi, csd = 12.2, 1.45, 1.3
    k = 0
    while cs0 + k * csi < t and k < 400:
        s = cs0 + k * csi
        u = (t - s) / csd
        if 0 <= u <= 1:
            x = lerp(R * 0.82, 6, u)
            y = lerp(R * 0.42, 84, u)
            c.circle(x, y, 9, fill=(122, 130, 142, 235),
                     outline=(238, 240, 244, 210), width=1.4)
        k += 1

    gs0, gsi = 16.4, 1.6
    k = 0
    while gs0 + k * gsi < t and k < 400:
        s = gs0 + k * gsi
        u = t - s
        if 0 <= u < 0.55:
            hexagon(c, 6, 84, 12 + 12 * smooth(u / 0.55), smooth(u / 0.9))
        elif 0.55 <= u < 1.9:
            v = (u - 0.55) / 1.35
            hexagon(c, lerp(6, -R * 0.86, v), lerp(84, R * 0.5, v), 24,
                    1 - v * 0.7, rot=v * 1.6)
        k += 1

    # lens rim and gloss
    c.circle(0, 0, R - 3, outline=(255, 255, 255, 235), width=5)
    c.circle(0, 0, R - 12, outline=(255, 255, 255, 55), width=2)

    mask = Image.new("L", (D * S, D * S), 0)
    ImageDraw.Draw(mask).ellipse([0, 0, D * S - 1, D * S - 1], fill=255)
    img = img.convert("RGBA")
    img.putalpha(mask)

    if open_k < 0.999:
        k2 = max(0.02, open_k)
        img = img.resize((max(2, int(D * S * k2)), max(2, int(D * S * k2))),
                         Image.LANCZOS)
    return img


def make_glow(radius=190, core=52.0, halo=118.0):
    n = int(radius * S)
    y, x = np.mgrid[-n:n, -n:n].astype(np.float32) / S
    d = np.hypot(x, y)
    a = (np.exp(-(d / core) ** 2) * 0.72 + np.exp(-(d / halo) ** 2) * 0.30)
    a = np.clip(a, 0, 1) * 255
    rgb = np.zeros((2 * n, 2 * n, 4), np.uint8)
    rgb[..., 0], rgb[..., 1], rgb[..., 2] = 255, 232, 140
    rgb[..., 3] = a.astype(np.uint8)
    return Image.fromarray(rgb, "RGBA")


# ---------------------------------------------------------------- one frame
BG = make_background()
GLOW = make_glow()


def frame(t):
    img = BG.copy()
    c = Canvas(img)

    grown = smooth(seg(t, 0.5, 3.6))
    sun_y = lerp(230, SUN[1], seg(t, 0.0, 2.2))
    light = seg(t, 4.2, 5.6)

    # ---- sun
    sx, sy = SUN[0], sun_y
    pulse = 1 + 0.03 * math.sin(t * 2.2)
    img.paste(GLOW, (int(sx * S - GLOW.width / 2),
                     int(sy * S - GLOW.height / 2)), GLOW)
    for i in range(16):
        a = t * 0.35 + i * math.pi / 8
        r0, r1 = 62 * pulse, (84 + 13 * math.sin(t * 2.4 + i)) * pulse
        c.line([(sx + r0 * math.cos(a), sy + r0 * math.sin(a)),
                (sx + r1 * math.cos(a), sy + r1 * math.sin(a))],
               (255, 232, 138, 170), 4.5)
    c.circle(sx, sy, 50 * pulse, fill=(255, 210, 74, 255))
    c.circle(sx, sy, 39 * pulse, fill=(255, 238, 160, 255))

    # ---- roots
    if grown > 0:
        rk = smooth(clamp01(grown * 1.3))
        for ang, ln in ((250, 130), (290, 122), (210, 96), (330, 92), (270, 150)):
            a = math.radians(ang)
            pts = [(BX, GROUND + 4)]
            for j in range(1, 6):
                u = j / 5 * rk
                pts.append((BX + math.cos(a) * ln * u + 14 * math.sin(u * 6 + ang),
                            GROUND + 4 - math.sin(a) * ln * u))
            c.line(pts, (196, 158, 104, 235), max(2, 7 - 3 * rk))

    # ---- stem
    if grown > 0.01:
        pts = [stem_point(f / 12 * grown, t, grown) for f in range(13)]
        c.line(pts, (86, 150, 70, 255), 15)
        c.line(pts, (108, 176, 84, 255), 9)
        c.circle(pts[-1][0], pts[-1][1], 7.4, fill=(96, 162, 76, 255))

    # ---- leaves
    leaf_geo = []
    for i, (fr, ang, ln, wd, t0) in enumerate(LEAVES):
        k = smooth(seg(t, t0, t0 + 1.1))
        if k <= 0.01:
            leaf_geo.append(None)
            continue
        bx, by = stem_point(fr, t, grown)
        wob = 5 * math.sin(t * 1.3 + i)
        glow = light * (0.35 + 0.2 * math.sin(t * 1.8 + i)) if i == MAIN else light * 0.2
        tip = draw_leaf(c, bx, by, ang + wob, ln * k, wd * k, glow=glow)
        leaf_geo.append((bx, by, tip))

    main_b = leaf_geo[MAIN] or (BX, 352, (660, 320))
    mx = (main_b[0] + main_b[2][0]) / 2
    my = (main_b[1] + main_b[2][1]) / 2

    # ---- light beams onto the leaves
    if light > 0:
        beam_tgts = [(mx, my)]
        for idx, dflt in ((4, (540, 240)), (1, (380, 420))):
            beam_tgts.append(leaf_geo[idx][2] if leaf_geo[idx] else dflt)
        for i, tgt in enumerate(beam_tgts):
            dx, dy = tgt[0] - sx, tgt[1] - sy
            L = math.hypot(dx, dy)
            ux, uy = dx / L, dy / L
            px, py = -uy, ux
            wdt = 14 + 4 * i
            bx0, by0 = sx + ux * L * 0.30, sy + uy * L * 0.30
            c.poly([(bx0 + px * wdt * 0.45, by0 + py * wdt * 0.45),
                    (tgt[0] + px * wdt, tgt[1] + py * wdt),
                    (tgt[0] - px * wdt, tgt[1] - py * wdt),
                    (bx0 - px * wdt * 0.45, by0 - py * wdt * 0.45)],
                   fill=(255, 226, 118, int(96 * light)))
            for j in range(6):
                u = ((t * 0.30 + j / 6.0 + i * 0.13) % 1.0)
                x, y = sx + ux * L * u, sy + uy * L * u
                a = light * (1 - abs(u - 0.5) * 1.2) * 0.9
                c.circle(x, y, 7, fill=rgba((255, 246, 186), a * 0.5))
                c.circle(x, y, 3.4, fill=rgba((255, 250, 214), a))

    # ---- CO2 drifting in from the right
    for k in range(60):
        s = 5.6 + k * 0.95
        u = (t - s) / 4.0
        if not (0 <= u <= 1.12):
            continue
        y0 = 476 + (k * 37) % 96
        x = lerp(1340, mx + 26, min(u, 1.0))
        y = lerp(y0, my + 12, smooth(min(u, 1.0) ** 1.3)) + 16 * math.sin(u * 7 + k)
        a = min(1.0, u * 6) * (1 - clamp01((u - 0.96) / 0.16))
        badge(c, x, y, 21, "CO₂", (128, 136, 148), a, 17)

    # ---- water rising from the soil
    for k in range(60):
        s = 5.0 + k * 0.9
        u = (t - s) / 3.6
        if not (0 <= u <= 1.12):
            continue
        src = (BX - 128 + (k * 71) % 250, 690 + (k * 29) % 26)
        route = [src, (BX + 6, GROUND + 26), stem_point(0.10, t, grown),
                 stem_point(LEAVES[MAIN][0], t, grown), (mx, my + 8)]
        x, y = path_at(route, min(u, 1.0))
        a = min(1.0, u * 6) * (1 - clamp01((u - 0.95) / 0.17))
        badge(c, x, y, 19, "H₂O", (52, 132, 226), a, 16)

    # ---- oxygen leaving the leaf
    for k in range(60):
        s = 12.6 + k * 0.92
        u = (t - s) / 4.2
        if not (0 <= u <= 1.0):
            continue
        x = mx + 34 + 190 * smooth(u) + 26 * math.sin(u * 5 + k) + (k % 3) * 22
        y = my - 26 - 330 * smooth(u) - (k % 2) * 18
        a = min(1.0, u * 5) * (1 - clamp01((u - 0.7) / 0.3))
        badge(c, x, y, 20, "O₂", (46, 176, 208), a, 17)

    # ---- glucose travelling down the stem
    for k in range(60):
        s = 18.0 + k * 1.6
        u = (t - s) / 4.0
        if not (0 <= u <= 1.05):
            continue
        route = [(mx, my), stem_point(LEAVES[MAIN][0], t, grown),
                 stem_point(0.42, t, grown), stem_point(0.06, t, grown),
                 (BX, GROUND + 60)]
        x, y = path_at(route, min(u, 1.0))
        a = min(1.0, u * 6) * (1 - clamp01((u - 0.82) / 0.18))
        c.circle(x, y, 26, fill=rgba((250, 208, 96), a * 0.22))
        hexagon(c, x, y, 15, a, rot=t * 1.2 + k)

    # ---- magnified chloroplast
    open_k = smooth(seg(t, 9.2, 10.4)) * (1 - smooth(seg(t, 25.6, 26.6)))
    if open_k > 0.02:
        cx, cy = INSET_C
        for p, wdt in (((mx + 40, my - 46), 2.5), ((mx + 40, my + 46), 2.5)):
            c.line([p, (cx + (p[1] - cy) * 0.0, cy)], rgba((255, 255, 255), 0.5 * open_k),
                   wdt)
        ins = draw_inset(t, open_k)
        ox = int((cx * S) - ins.width / 2)
        oy = int((cy * S) - ins.height / 2)
        img.paste(ins, (ox, oy), ins)

    # ---- summary equation
    eq = seg(t, 24.6, 26.0)
    if eq > 0:
        f = font(33)
        parts = [("6CO₂", (96, 104, 116)), ("  +  ", (60, 60, 66)),
                 ("6H₂O", (40, 118, 214)), ("  +  ", (60, 60, 66)),
                 ("@", (250, 190, 40)), ("  →  ", (60, 60, 66)),
                 ("C₆H₁₂O₆", (206, 146, 26)), ("  +  ", (60, 60, 66)),
                 ("6O₂", (36, 168, 200))]
        widths = [(38 if s == "@" else c.width_of(s, f)) for s, _ in parts]
        total = sum(widths)
        x = W / 2 - total / 2
        c.rrect(W / 2 - total / 2 - 34, 616, W / 2 + total / 2 + 34, 682, 33,
                fill=rgba((255, 255, 255), 0.86 * eq),
                outline=rgba((120, 176, 96), 0.9 * eq), width=3)
        for (s, col), wd in zip(parts, widths):
            if s == "@":
                cxx = x + wd / 2
                for i in range(10):
                    a = i * math.pi / 5 + t * 0.6
                    c.line([(cxx + 13 * math.cos(a), 649 + 13 * math.sin(a)),
                            (cxx + 19 * math.cos(a), 649 + 19 * math.sin(a))],
                           rgba((250, 190, 40), eq), 3)
                c.circle(cxx, 649, 11, fill=rgba((252, 202, 60), eq))
            else:
                c.text(x + wd / 2, 649, s, f, rgba(col, eq))
            x += wd

    # ---- open / close fades
    fade = (1 - smooth(seg(t, 0.0, 0.9))) + smooth(seg(t, 29.35, 30.0))
    if fade > 0.002:
        c.rrect(-20, -20, W + 20, H + 20, 0, fill=rgba((0, 0, 0), min(1.0, fade)))

    return img.resize((W, H), Image.LANCZOS)


# ---------------------------------------------------------------- encode
def main():
    out = sys.argv[1] if len(sys.argv) > 1 else "photosynthesis.mp4"
    import imageio_ffmpeg
    ff = imageio_ffmpeg.get_ffmpeg_exe()
    cmd = [ff, "-y", "-f", "rawvideo", "-pix_fmt", "rgb24",
           "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
           "-c:v", "libx264", "-preset", "slow", "-crf", "20",
           "-pix_fmt", "yuv420p", "-movflags", "+faststart", out]
    proc = subprocess.Popen(cmd, stdin=subprocess.PIPE,
                            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    for i in range(N):
        proc.stdin.write(frame(i / FPS).tobytes())
        if i % 60 == 0:
            print(f"frame {i}/{N}", flush=True)
    proc.stdin.close()
    proc.wait()
    print("wrote", out)


if __name__ == "__main__":
    main()
