"""Clawd's late-night study session -- 1080x1080, 30fps, 10s pixel-art loop.

The whole scene is drawn on a 216x216 pixel grid and upscaled 5x with
nearest-neighbour sampling, so every drawn pixel stays a crisp square block.
"""
import math
import os
import subprocess
import sys

import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import font as F

W = H = 216
OUT = 1080
FPS = 30
NF = 300                       # 10 seconds
BEAT = 18.75                   # frames per beat @ 96 BPM
BAR = BEAT * 4

# ---------------------------------------------------------------- palette
C = {
    'wall_hi':   (74, 55, 48),
    'wall_lo':   (46, 34, 31),
    'wall_warm': (92, 66, 52),
    'sky':       (18, 24, 42),
    'sky_lo':    (28, 36, 58),
    'city':      (40, 48, 72),
    'city_lit':  (214, 168, 78),
    'rain':      (96, 122, 158),
    'rain_hi':   (140, 168, 200),
    'frame':     (120, 84, 54),
    'frame_hi':  (150, 108, 70),
    'frame_lo':  (78, 52, 32),
    'desk':      (146, 100, 60),
    'desk_hi':   (176, 126, 78),
    'desk_lo':   (96, 62, 36),
    'desk_edge': (70, 44, 26),
    'chair':     (128, 86, 48),
    'chair_hi':  (158, 112, 66),
    'chair_lo':  (86, 56, 30),
    'body':      (232, 85, 63),
    'body_lit':  (255, 122, 90),
    'body_sh':   (176, 64, 47),
    'eye':       (14, 14, 16),
    'band':      (242, 239, 230),
    'band_sh':   (206, 200, 188),
    'band_txt':  (40, 38, 40),
    'page':      (238, 228, 205),
    'page_sh':   (208, 194, 168),
    'page_line': (176, 166, 148),
    'bookcov':   (150, 58, 58),
    'bookcov_lo': (108, 40, 40),
    'note':      (232, 224, 200),
    'notecov':   (62, 92, 122),
    'ink':       (66, 74, 96),
    'pencil':    (232, 186, 74),
    'pencil_lo': (176, 134, 46),
    'lead':      (46, 44, 48),
    'clockf':    (238, 228, 208),
    'clockr':    (86, 62, 44),
    'hand':      (54, 46, 44),
    'player':    (58, 68, 84),
    'player_lo': (40, 48, 62),
    'screen':    (16, 24, 32),
    'bar_a':     (110, 226, 178),
    'bar_b':     (255, 206, 108),
    'lamp_sh':   (198, 118, 52),
    'lamp_sh_lo': (150, 84, 36),
    'lamp_pole': (108, 88, 72),
    'bulb':      (255, 226, 160),
    'shelf':     (120, 82, 50),
    'plant':     (86, 132, 84),
    'dust':      (255, 236, 196),
    'glow':      (255, 214, 130),
    'glow_core': (255, 249, 224),
    'spark':     (255, 240, 190),
}


# ------------------------------------------------------------- primitives
def rect(img, x, y, w, h, col, a=1.0):
    x0, y0 = int(round(x)), int(round(y))
    x1, y1 = x0 + int(round(w)), y0 + int(round(h))
    x0, y0 = max(0, x0), max(0, y0)
    x1, y1 = min(W, x1), min(H, y1)
    if x1 <= x0 or y1 <= y0 or a <= 0:
        return
    if a >= 1.0:
        img[y0:y1, x0:x1] = col
    else:
        reg = img[y0:y1, x0:x1].astype(np.float32)
        img[y0:y1, x0:x1] = (reg * (1 - a) + np.array(col, np.float32) * a).astype(np.uint8)


def vgrad(img, x, y, w, h, top, bot):
    for i in range(int(h)):
        t = i / max(1, h - 1)
        col = tuple(int(top[k] + (bot[k] - top[k]) * t) for k in range(3))
        rect(img, x, y + i, w, 1, col)


def text(img, s, x, y, scale, col, a=1.0):
    for (px, py, w, h) in F.text_cells(s, x, y, scale):
        rect(img, px, py, w, h, col, a)


def thick_line(img, x0, y0, x1, y1, t, col):
    n = int(max(abs(x1 - x0), abs(y1 - y0))) + 1
    for i in range(n + 1):
        u = i / max(1, n)
        rect(img, x0 + (x1 - x0) * u - t / 2, y0 + (y1 - y0) * u - t / 2, t, t, col)


def smoothstep(a, b, x):
    if b == a:
        return 0.0
    t = min(1.0, max(0.0, (x - a) / (b - a)))
    return t * t * (3 - 2 * t)


def window_env(f, a, b, fade=8):
    """1.0 inside [a,b] with smooth shoulders, 0 outside."""
    return smoothstep(a, a + fade, f) * (1 - smoothstep(b - fade, b, f))


# -------------------------------------------------------------- geometry
BX, BY, BW, BH = 78, 74, 60, 60          # Clawd's body block
ARM_W, ARM_H = 12, 15
ARM_Y = 15                                # from body top
LEGS = [(0, 9), (15, 24), (36, 45), (51, 60)]
EYE = 9
DESK_Y = 130                              # far edge of the desk surface
DESK_FRONT = 166

RNG = np.random.default_rng(7)
DUST = [(RNG.uniform(0, W), RNG.uniform(0, H), RNG.uniform(0, 6.28),
         RNG.uniform(1.5, 5.0), RNG.integers(1, 3)) for _ in range(46)]
DROPS = [(RNG.uniform(0, 1), RNG.uniform(0, 1), RNG.integers(3, 7),
          RNG.uniform(0.6, 1.0)) for _ in range(34)]
CRACK = [(RNG.uniform(0, W), RNG.uniform(0, H)) for _ in range(60)]


# ----------------------------------------------------------------- scene
def draw_wall(img):
    vgrad(img, 0, 0, W, DESK_Y + 2, C['wall_lo'], C['wall_warm'])
    for x in range(0, W, 27):                       # faint wallpaper stripes
        rect(img, x, 0, 1, DESK_Y, C['wall_hi'], 0.30)


def draw_window(img, f):
    wx, wy, ww, wh = 12, 16, 64, 68
    rect(img, wx - 3, wy - 3, ww + 6, wh + 6, C['frame_lo'])
    rect(img, wx - 3, wy - 3, ww + 6, 3, C['frame_hi'])
    gx, gy, gw, gh = wx, wy, ww, wh
    vgrad(img, gx, gy, gw, gh, C['sky'], C['sky_lo'])

    # distant skyline with a few lit windows
    sky = [(2, 30, 22), (16, 24, 14), (26, 38, 18), (40, 28, 16), (50, 34, 20)]
    for (bx, bh_, bw_) in sky:
        rect(img, gx + bx, gy + gh - bh_, bw_, bh_, C['city'])
        for ly in range(gy + gh - bh_ + 3, gy + gh - 3, 5):
            for lx in range(gx + bx + 2, gx + bx + bw_ - 2, 5):
                if (lx * 7 + ly * 13 + int(f / 40)) % 6 < 2:
                    rect(img, lx, ly, 1, 2, C['city_lit'], 0.75)

    # rain: each streak wraps exactly over 300 frames -> seamless loop
    for (u, v, ln, br) in DROPS:
        speed = 3.6
        y = (v * gh + f * speed) % (gh + ln) - ln
        x = gx + (u * gw + f * 0.5) % gw
        col = C['rain_hi'] if br > 0.85 else C['rain']
        rect(img, x, gy + y, 1, ln, col, 0.55 * br)
    # water beading on the glass
    for i, (u, v, ln, br) in enumerate(DROPS[:10]):
        yy = gy + (v * gh * 1.7 + (f * 0.55 + i * 9) % gh) % gh
        rect(img, gx + 4 + int(u * (gw - 8)), yy, 1, 2, C['rain_hi'], 0.35)

    rect(img, gx + gw // 2 - 1, gy, 2, gh, C['frame'])      # mullions
    rect(img, gx, gy + gh // 2 - 1, gw, 2, C['frame'])
    rect(img, gx - 5, gy + gh + 3, ww + 10, 4, C['frame'])  # sill
    rect(img, gx - 5, gy + gh + 3, ww + 10, 1, C['frame_hi'])


def draw_shelf(img):
    sx, sy = 156, 44
    rect(img, sx, sy, 48, 3, C['shelf'])
    rect(img, sx, sy, 48, 1, C['frame_hi'])
    books = [(3, 14, 5, (150, 74, 66)), (9, 17, 4, (86, 112, 140)),
             (14, 12, 6, (196, 158, 84)), (21, 16, 4, (110, 140, 108)),
             (26, 13, 5, (140, 96, 150))]
    for (bx, bh_, bw_, col) in books:
        rect(img, sx + bx, sy - bh_, bw_, bh_, col)
        rect(img, sx + bx, sy - bh_, 1, bh_, tuple(min(255, c + 26) for c in col))
    rect(img, sx + 36, sy - 7, 8, 7, (128, 88, 62))         # little plant pot
    rect(img, sx + 37, sy - 13, 6, 6, C['plant'])
    rect(img, sx + 39, sy - 16, 2, 4, C['plant'])


def draw_chair(img):
    rect(img, 62, 100, 8, DESK_Y - 96, C['chair'])                # side posts
    rect(img, 148, 100, 8, DESK_Y - 96, C['chair'])
    rect(img, 62, 100, 2, DESK_Y - 96, C['chair_hi'])
    rect(img, 148, 100, 2, DESK_Y - 96, C['chair_hi'])
    rect(img, 58, 94, 102, 8, C['chair'])                        # top rail
    rect(img, 58, 94, 102, 2, C['chair_hi'])
    rect(img, 58, 100, 102, 2, C['chair_lo'])
    for i in range(4):                                           # back slats
        rect(img, 72 + i * 20, 106, 6, 24, C['chair_lo'])
        rect(img, 72 + i * 20, 106, 2, 24, C['chair'])


def draw_clawd(img, st):
    ox, oy = st['ox'], st['oy']
    bx, by = BX + ox, BY + oy - st['breath']
    bh = BH + st['breath']

    # contact shadow on the chair
    rect(img, bx - 10, by + bh - 6, BW + 20, 8, (40, 26, 22), 0.30)

    # ---- side arm nubs (part of the reference silhouette)
    ay = by + ARM_Y + st['arm_bob']
    rect(img, bx - ARM_W, ay, ARM_W, ARM_H, C['body'])
    rect(img, bx - ARM_W, ay, ARM_W, 2, C['body_lit'], 0.5)
    rect(img, bx + BW, ay, ARM_W, ARM_H, C['body'])
    rect(img, bx + BW + ARM_W - 3, ay, 3, ARM_H, C['body_lit'])

    # ---- torso + four legs
    solid_h = bh - 18
    rect(img, bx, by, BW, solid_h, C['body'])
    for (lx0, lx1) in LEGS:
        rect(img, bx + lx0, by + solid_h, lx1 - lx0, 18, C['body'])
        rect(img, bx + lx0, by + solid_h, 2, 18, C['body_sh'], 0.45)
    # lamp is stage-right, so light wraps the right edge, shadow on the left
    rect(img, bx + BW - 7, by, 7, solid_h, C['body_lit'], 0.85)
    rect(img, bx + LEGS[-1][0], by + solid_h, LEGS[-1][1] - LEGS[-1][0], 18,
         C['body_lit'], 0.45)
    rect(img, bx, by, 7, solid_h, C['body_sh'], 0.75)
    rect(img, bx, by, BW, 2, C['body_lit'], 0.35)

    # ---- square black eyes (never anything more human than this)
    eh = st['eye_h']
    for ex in (bx + 9, bx + 42):
        rect(img, ex, by + 6 + (EYE - eh), EYE, eh, C['eye'])
    if st['sparkle'] > 0.25 and eh >= 6:
        for ex in (bx + 9, bx + 42):
            rect(img, ex + 6, by + 7, 2, 2, C['spark'], st['sparkle'])

    # ---- KEEP GOING headband
    hb = st['band_off']
    byt = by - 2 + hb
    rect(img, bx - 1, byt, BW + 2, 7, C['band'])
    rect(img, bx - 1, byt + 6, BW + 2, 1, C['band_sh'])
    tw = F.text_width('KEEP GOING', 1)
    text(img, 'KEEP GOING', bx + (BW - tw) // 2, byt + 1, 1, C['band_txt'])
    # knot + two tails that swing as he moves
    sw = st['tail']
    rect(img, bx - 4, byt + 1, 4, 5, C['band'])
    rect(img, bx - 6 + sw, byt + 5, 4, 7, C['band'])
    rect(img, bx - 8 + int(sw * 1.6), byt + 10, 4, 6, C['band_sh'])
    return bx, by, ay


def draw_desk(img):
    rect(img, 0, DESK_Y, W, DESK_FRONT - DESK_Y, C['desk'])
    rect(img, 0, DESK_Y, W, 2, C['desk_hi'])
    for x in range(0, W, 13):                       # wood grain
        rect(img, x + 3, DESK_Y + 4, 7, 1, C['desk_lo'], 0.35)
        rect(img, x + 8, DESK_Y + 16, 9, 1, C['desk_lo'], 0.28)
    rect(img, 0, DESK_FRONT, W, 5, C['desk_edge'])
    rect(img, 0, DESK_FRONT, W, 1, C['desk_hi'], 0.5)
    vgrad(img, 0, DESK_FRONT + 5, W, H - DESK_FRONT - 5, C['desk_lo'], (58, 36, 22))
    rect(img, 44, DESK_FRONT + 10, 128, 30, (108, 70, 40))       # drawer front
    rect(img, 44, DESK_FRONT + 10, 128, 2, (140, 96, 58))
    rect(img, 44, DESK_FRONT + 38, 128, 2, (72, 44, 26))
    rect(img, 96, DESK_FRONT + 22, 24, 5, (168, 124, 74))        # handle
    rect(img, 96, DESK_FRONT + 22, 24, 2, (206, 158, 96))


def draw_clock(img, f):
    x, y = 16, 130
    rect(img, x + 5, y + 21, 12, 3, (40, 26, 22), 0.35)
    rect(img, x, y, 22, 22, C['clockr'])
    rect(img, x + 2, y + 2, 18, 18, C['clockf'])
    rect(img, x, y, 22, 2, (118, 88, 64))
    rect(img, x + 1, y - 4, 5, 4, C['clockr'])          # bells
    rect(img, x + 16, y - 4, 5, 4, C['clockr'])
    rect(img, x + 8, y - 2, 6, 2, C['clockr'])
    rect(img, x + 2, y + 2, 18, 2, (246, 240, 228))
    rect(img, x, y + 22, 4, 3, C['clockr'])
    rect(img, x + 18, y + 22, 4, 3, C['clockr'])
    cx, cy = x + 11, y + 11
    for i in range(4):                              # tick marks
        a = i * math.pi / 2
        rect(img, cx + math.sin(a) * 7, cy - math.cos(a) * 7, 1, 1, C['hand'])
    a = (f / NF) * 2 * math.pi * 2                  # minute hand, 2 turns/loop
    thick_line(img, cx, cy, cx + math.sin(a) * 6, cy - math.cos(a) * 6, 1, C['hand'])
    thick_line(img, cx, cy, cx + math.sin(a / 6 + 2.1) * 4,
               cy - math.cos(a / 6 + 2.1) * 4, 1, C['hand'])


def draw_player(img, f):
    x, y = 44, 136
    rect(img, x + 2, y + 23, 30, 3, (40, 26, 22), 0.35)
    rect(img, x, y, 32, 24, C['player'])
    rect(img, x, y, 32, 2, (86, 100, 122))
    rect(img, x, y + 22, 32, 2, C['player_lo'])
    rect(img, x + 3, y + 4, 20, 15, C['screen'])
    for i in range(5):                              # EQ bars locked to the beat
        ph = f / BEAT * 2 * math.pi + i * 1.15
        lvl = 0.5 + 0.5 * math.sin(ph) * math.cos(f / (NF / 3) * 2 * math.pi + i)
        hgt = max(2, int(2 + lvl * 11))
        bx = x + 5 + i * 4
        col = C['bar_a'] if i % 2 == 0 else C['bar_b']
        rect(img, bx, y + 17 - hgt, 3, hgt, col)
        rect(img, bx, y + 17 - hgt, 3, 1, (255, 255, 255), 0.55)
    rect(img, x + 25, y + 6, 5, 5, (30, 38, 50))    # speaker + play light
    rect(img, x + 26, y + 7, 3, 3, (96, 110, 130))
    pulse = 0.45 + 0.55 * abs(math.sin(f / BEAT * math.pi))
    rect(img, x + 26, y + 15, 3, 3, C['bar_a'], pulse)


def draw_book(img, st):
    x, y, w = 80, 138, 62
    rect(img, x + 2, y + 20, w - 4, 3, (40, 26, 22), 0.35)
    rect(img, x, y, w, 22, C['bookcov'])
    rect(img, x, y, w, 1, (186, 84, 84))
    rect(img, x + 2, y + 2, 27, 19, C['page'])
    rect(img, x + 31, y + 2, 27, 19, C['page'])
    rect(img, x + 29, y, 2, 22, C['bookcov_lo'])
    for i in range(4):
        rect(img, x + 5, y + 6 + i * 4, 21, 1, C['page_line'], 0.7)
        rect(img, x + 34, y + 6 + i * 4, 21, 1, C['page_line'], 0.7)
    p = st['page']
    if p > 0:
        lift = int(math.sin(p * math.pi) * 7)
        if p < 0.5:
            pw = int(27 * (1 - p * 2))
            px = x + 31
        else:
            pw = int(27 * (p * 2 - 1))
            px = x + 29 - pw
        if pw > 0:
            rect(img, px, y + 2 - lift, pw, 19, C['page_sh'])
            rect(img, px, y + 2 - lift, pw, 1, (250, 244, 226))
            rect(img, px, y + 2 - lift, 1, 19, C['page_line'])


def draw_notebook(img, st):
    x, y, w, h = 148, 138, 34, 22
    rect(img, x + 2, y + h - 2, w - 4, 3, (40, 26, 22), 0.35)
    rect(img, x, y, w, h, C['notecov'])
    rect(img, x + 2, y + 2, w - 4, h - 4, C['note'])
    for i in range(4):
        rect(img, x + 4, y + 6 + i * 4, w - 8, 1, C['page_line'], 0.55)
    rect(img, x, y, 2, h, (30, 52, 76))
    n = st['marks']
    for i in range(9):
        if n > i:
            frac = min(1.0, n - i)
            row, colm = divmod(i, 3)
            ln = int((6 + (i * 5) % 7) * frac)
            rect(img, x + 4 + colm * 9, y + 6 + row * 4, ln, 1,
                 C['ink'], st['mark_a'])


def draw_lamp(img, f):
    rect(img, 182, 154, 22, 6, (92, 74, 60))        # base
    rect(img, 182, 154, 22, 2, (128, 106, 86))
    rect(img, 191, 118, 4, 38, C['lamp_pole'])
    for i in range(7):                              # conical shade
        rect(img, 178 + i, 100 + i * 2, 30 - i * 2, 2, C['lamp_sh'])
    rect(img, 178, 100, 30, 2, (226, 148, 74))
    rect(img, 180, 112, 26, 2, C['lamp_sh_lo'])
    flick = 0.86 + 0.14 * math.sin(f / 11.0) * math.sin(f / 4.3)
    rect(img, 183, 113, 20, 3, C['bulb'], flick)
    for i in range(1, 22):                          # soft light cone
        a = 0.15 * (1 - i / 24) * flick
        rect(img, 182 - i * 1.6, 114 + i * 2, 22 + i * 3.2, 2, C['glow'], a)


def draw_arm(img, sx, sy, ex, ey, hx, hy, lit):
    """Upper arm + forearm with an elbow, so the limb reads as an arm."""
    for (x0, y0, x1, y1) in ((sx, sy, ex, ey), (ex, ey, hx, hy)):
        thick_line(img, x0, y0, x1, y1, 8, C['body_sh'])
        thick_line(img, x0, y0 - 1, x1, y1 - 1, 6, C['body'])
    rect(img, ex - 4, ey - 4, 8, 8, C['body'])              # elbow joint
    rect(img, hx - 4, hy - 4, 9, 7, C['body'])              # hand
    rect(img, hx - 4, hy - 4, 9, 2, C['body_lit'] if lit else C['body_sh'], 0.7)


def draw_pencil(img, hx, hy, ang):
    dx, dy = math.cos(ang) * 9, math.sin(ang) * 9
    thick_line(img, hx, hy, hx + dx, hy + dy, 2, C['pencil'])
    rect(img, hx + dx - 1, hy + dy - 1, 2, 2, C['lead'])
    rect(img, hx - dx * 0.35, hy - dy * 0.35, 2, 2, C['pencil_lo'])


# ------------------------------------------------------------- lighting
def build_light():
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    d = np.sqrt((xx - 194) ** 2 + ((yy - 122) * 1.15) ** 2)
    lamp = np.clip(np.exp(-d / 78.0), 0, 1)
    d2 = np.sqrt((xx - 120) ** 2 + ((yy - 148) * 1.3) ** 2)
    lamp = np.maximum(lamp, 0.50 * np.exp(-d2 / 78.0))
    r = np.sqrt(((xx - 108) / 118.0) ** 2 + ((yy - 108) / 118.0) ** 2)
    vig = np.clip(1.06 - 0.38 * r ** 2.3, 0.42, 1.06)
    cool = np.clip(np.exp(-np.sqrt((xx - 44) ** 2 + (yy - 50) ** 2) / 72.0), 0, 1)
    return lamp.astype(np.float32), vig.astype(np.float32), cool.astype(np.float32)


LAMP, VIG, COOL = build_light()


def grade(img, dim):
    f = img.astype(np.float32)
    gain = (0.80 + 0.70 * LAMP) * VIG * dim
    f *= gain[..., None]
    f += (LAMP * 46)[..., None] * np.array([1.0, 0.55, 0.12], np.float32)
    f += (COOL * 16)[..., None] * np.array([0.15, 0.45, 1.0], np.float32)
    return np.clip(f, 0, 255).astype(np.uint8)


def draw_dust(img, f):
    for (x0, y0, ph, amp, sz) in DUST:
        y = (y0 - f * 0.72) % H
        x = (x0 + math.sin(f / NF * 2 * math.pi * 2 + ph) * amp) % W
        b = 0.20 + 0.32 * (0.5 + 0.5 * math.sin(f / 24.0 + ph))
        b *= 0.35 + 0.9 * float(LAMP[int(y) % H, int(x) % W])
        rect(img, x, y, int(sz), int(sz), C['dust'], min(0.85, b))


# --------------------------------------------------------------- staging
MSG = ["YOUR FUTURE IS", "CREATED BY WHAT", "YOU DO TODAY."]


def draw_message(img, amt):
    if amt <= 0.01:
        return
    rect(img, 34, 12, 148, 60, (18, 12, 14), 0.60 * amt)
    for i in range(3):
        rect(img, 34 - i, 12 - i, 148 + i * 2, 60 + i * 2, C['glow'], 0.05 * amt)
    for li, line in enumerate(MSG):
        tw = F.text_width(line, 2)
        x = 108 - tw // 2
        y = 20 + li * 15
        rev = min(1.0, max(0.0, amt * 3.2 - li * 0.55))
        if rev <= 0:
            continue
        for dx, dy in ((-1, 0), (1, 0), (0, -1), (0, 1), (-1, -1), (1, 1)):
            text(img, line, x + dx, y + dy, 2, C['glow'], 0.30 * rev * amt)
        text(img, line, x, y, 2, C['glow_core'], min(1.0, rev * amt * 1.4))


def sparkles(img, f, bx, by, amt):
    if amt <= 0.05:
        return
    pts = [(-14, -12, 0), (BW + 6, -18, 0.4), (BW + 14, 4, 0.8), (-20, 6, 1.2)]
    for i, (dx, dy, ph) in enumerate(pts):
        a = amt * (0.45 + 0.55 * math.sin(f / 3.0 + ph * 3))
        if a <= 0.05:
            continue
        x, y = bx + dx, by + dy - int(amt * 4)
        rect(img, x, y - 2, 1, 5, C['spark'], a)
        rect(img, x - 2, y, 5, 1, C['spark'], a)
        rect(img, x, y, 1, 1, (255, 255, 255), a)


def state_at(f):
    st = {}
    # --- soft breathing + gentle nod on the beat
    st['breath'] = int(round(0.9 * math.sin(f / 60.0 * 2 * math.pi)))
    nod = max(0.0, math.sin((f % (BEAT * 2)) / (BEAT * 2) * 2 * math.pi))
    tired = window_env(f, 150, 196, 16)
    determined = window_env(f, 196, 226, 10)
    st['tired'] = tired
    st['sparkle'] = determined * 0.9

    oy = round(nod * 2.0) + round(tired * 3.4) - round(determined * 2.2)
    st['oy'] = int(oy)
    st['ox'] = int(round(1.2 * math.sin(f / 150.0 * 2 * math.pi)))
    st['arm_bob'] = int(round(nod * 1.4))
    # headband lags the head by a couple of frames, so it lifts and settles
    lag = state_lag(f)
    st['band_off'] = int(round(max(-1, min(2, (oy - lag) * 0.9 - determined))))
    st['tail'] = int(round(2.2 * math.sin(f / 21.0) + nod))

    # --- blinking (and heavy lids when tired)
    openness = 1.0
    for b in (30, 108, 232, 268):
        d = abs(f - b)
        if d <= 3:
            openness = min(openness, d / 3.0)
    for b in (168, 182):
        d = abs(f - b)
        if d <= 6:
            openness = min(openness, d / 6.0)
    st['eye_h'] = max(1, int(round(EYE * openness * (1 - 0.5 * tired))))

    # --- page turns
    st['page'] = 0.0
    for (a, b) in ((52, 78), (224, 250)):
        if a <= f <= b:
            st['page'] = (f - a) / (b - a)

    # --- writing notes
    write = window_env(f, 80, 150, 14)
    st['write'] = write
    st['marks'] = min(9.0, max(0.0, (f - 80) / 7.0))
    st['mark_a'] = 1.0 - smoothstep(226, 246, f)

    # --- confident raised arm near the end
    st['raise'] = window_env(f, 240, 284, 14)
    st['scribble'] = f
    st['msg'] = window_env(f, 246, 294, 18)
    st['dim'] = 1.0 - 0.22 * st['msg']
    st['zoom'] = 1.0 + 0.055 * (1 - math.cos(f / NF * 2 * math.pi)) / 2
    return st


def state_lag(f):
    g = f - 3
    nod = max(0.0, math.sin((g % (BEAT * 2)) / (BEAT * 2) * 2 * math.pi))
    tired = window_env(g, 150, 196, 16)
    determined = window_env(g, 196, 226, 10)
    return round(nod * 2.0) + round(tired * 3.4) - round(determined * 2.2)


def render(f):
    st = state_at(f)
    img = np.zeros((H, W, 3), np.uint8)
    draw_wall(img)
    draw_window(img, f)
    draw_shelf(img)
    draw_chair(img)
    bx, by, ay = draw_clawd(img, st)

    # right arm: resting on the desk -> writing -> punching the air
    w, r = st['write'], st['raise']
    base = 1.0 - w - r
    jitx = math.sin(f / 2.2) * 2.6
    jity = math.sin(f / 5.0) * 1.2
    sh_r = (BX + BW + ARM_W - 4 + st['ox'], ay + ARM_H - 2)
    sh_l = (BX - ARM_W + 4 + st['ox'], ay + ARM_H - 2)

    hand_r = (152 * base + (162 + jitx) * w + (sh_r[0] + 10) * r,
              (DESK_Y + 5) * base + (DESK_Y + 15 + jity) * w + 56 * r)
    elb_r = (158 * base + 170 * w + (sh_r[0] + 8) * r,
             (DESK_Y - 9) * base + (DESK_Y - 4) * w + 84 * r)

    pg = st['page']
    hand_l = (68 + st['ox'] + 16 * pg, DESK_Y + 5 + 4 * pg)
    elb_l = (58 + st['ox'] + 8 * pg, DESK_Y - 9)

    draw_desk(img)
    draw_clock(img, f)
    draw_player(img, f)
    draw_book(img, st)
    draw_notebook(img, st)
    draw_lamp(img, f)

    draw_arm(img, sh_l[0], sh_l[1], elb_l[0], elb_l[1], hand_l[0], hand_l[1], False)
    draw_arm(img, sh_r[0], sh_r[1], elb_r[0], elb_r[1], hand_r[0], hand_r[1], True)
    if r < 0.4:
        draw_pencil(img, hand_r[0] + 2, hand_r[1] + 2,
                    1.15 + math.sin(f / 2.2) * 0.28 * w)
    else:
        draw_pencil(img, 166, DESK_Y + 20, 0.4)

    sparkles(img, f, bx, by, st['sparkle'])
    img = grade(img, st['dim'])
    draw_dust(img, f)
    draw_message(img, st['msg'])

    # zoom / pull-back, then nearest-neighbour blow-up to 1080
    z = st['zoom']
    cw = W / z
    box = (108 - cw / 2, 108 - cw / 2, 108 + cw / 2, 108 + cw / 2)
    return Image.fromarray(img).resize((OUT, OUT), Image.NEAREST, box=box)


def main():
    if '--preview' in sys.argv:
        d = os.path.dirname(os.path.abspath(__file__))
        for f in (0, 60, 100, 160, 210, 240, 262, 290):
            render(f).save(os.path.join(d, f'prev_{f:03d}.png'))
        print('preview written')
        return
    out = sys.argv[1]
    import imageio_ffmpeg
    ff = imageio_ffmpeg.get_ffmpeg_exe()
    audio = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'audio.wav')
    cmd = [ff, '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{OUT}x{OUT}',
           '-r', str(FPS), '-i', '-']
    if os.path.exists(audio):
        cmd += ['-i', audio, '-c:a', 'aac', '-b:a', '192k']
    cmd += ['-c:v', 'libx264', '-preset', 'slow', '-crf', '17',
            '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-shortest', out]
    p = subprocess.Popen(cmd, stdin=subprocess.PIPE, stdout=subprocess.DEVNULL,
                         stderr=subprocess.PIPE)
    for f in range(NF):
        p.stdin.write(np.asarray(render(f), np.uint8).tobytes())
    p.stdin.close()
    err = p.stderr.read().decode()
    if p.wait() != 0:
        print(err[-3000:])
        sys.exit(1)
    print('wrote', out)


if __name__ == '__main__':
    main()
