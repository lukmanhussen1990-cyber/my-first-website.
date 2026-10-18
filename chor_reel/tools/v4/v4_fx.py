"""v4 story effects (16:9). Each item appears on its key word and is taken into the moon on "ले जा", then a thin
stream carries it from the moon into the cosmic thief's hand. Positions are in set space (v4_room)."""
import os, sys, math
import numpy as np, cv2
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
for _d in ("v3", "v2"):  # shared helpers
    sys.path.insert(1, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), _d))
import v2lib as L
import v2_fx as F2
import v3_beats as B
import v4_room as RM

W, H = RM.W, RM.H
GOLD, WHITE, RED = F2.GOLD, F2.WHITE, F2.RED
VIOLET = np.array([0.80, 0.45, 0.55], np.float32)
MOONC = (RM.MOON[0], RM.MOON[1])
MOON_R = RM.MOON[2]
stream, bez, xf, draw_icon = F2.stream, F2.bez, F2.xf, F2.draw_icon
ease, ramp = B.ease, B.ramp
LN = B.LINE
SZ = 0.72                                   # icon scale vs. the v3 layout
SUB = 8


class Layer:
    """additive glow layer in output space (16:9)"""
    def __init__(self, cam):
        self.cam = cam
        self.M = RM.cam_matrix(cam)
        self.z = cam[0]
        self.img = np.zeros((H, W, 3), np.float32)
        self.used = False

    def P(self, x, y):
        x = np.asarray(x, np.float64)
        y = np.asarray(y, np.float64)
        return self.M[0, 0] * x + self.M[0, 2], self.M[1, 1] * y + self.M[1, 2]

    def poly(self, pts, col, k, w=2.0, closed=False):
        if k <= 0.003 or len(pts) < 2:
            return
        xs, ys = self.P([p[0] for p in pts], [p[1] for p in pts])
        arr = (np.stack([xs, ys], 1) * SUB).astype(np.int32)
        cv2.polylines(self.img, [arr], closed, tuple(float(v) for v in col * k), max(1, int(round(w * self.z))), cv2.LINE_AA, 3)
        self.used = True

    def dots(self, xs, ys, vals, col, r=1.6):
        xs, ys = self.P(xs, ys)
        rr = max(1, int(round(r * self.z)))
        for x, y, v in zip(np.atleast_1d(xs), np.atleast_1d(ys), np.atleast_1d(vals)):
            if v > 0.01 and -10 < x < W + 10 and -10 < y < H + 10:
                cv2.circle(self.img, (int(x * SUB), int(y * SUB)), rr * SUB // 2 + 4, tuple(float(c) for c in col * v), -1, cv2.LINE_AA, 3)
        self.used = True

    def streaks(self, x0s, y0s, x1s, y1s, vals, col, w=1.4):
        a0, b0 = self.P(x0s, y0s)
        a1, b1 = self.P(x1s, y1s)
        for xa, ya, xb, yb, v in zip(a0, b0, a1, b1, vals):
            if v > 0.01:
                cv2.line(self.img, (int(xa * SUB), int(ya * SUB)), (int(xb * SUB), int(yb * SUB)), tuple(float(c) for c in col * v),
                         max(1, int(round(w * self.z))), cv2.LINE_AA, 3)
        self.used = True

    def apply(self, img, glow=6.0, gain=1.0):
        if not self.used:
            return img
        g = L.blur(self.img, glow * self.z)
        img += (self.img + g * 1.6) * gain
        return img


def env(n, a, b, fin=4, fout=6):
    return min(ramp(n, a - fin, a), 1 - ramp(n, b, b + fout))


def moon_flash(lay, n, t, col=GOLD, k=1.0):
    v = env(n, t, t + 2, 1, 9) * k
    if v > 0:
        th = np.linspace(0, 2 * math.pi, 72)
        r = MOON_R * (1.05 + 0.30 * ramp(n, t, t + 11))
        lay.poly([(MOONC[0] + r * math.cos(a), MOONC[1] + r * math.sin(a)) for a in th], col, v * 0.8, 2.5)


def to_thief(lay, n, t, hand, col=GOLD, seed=0):
    if t - 1 <= n <= t + 30:
        stream(lay, n, MOONC, hand, t, t + 12, 60, 900 + seed, col, travel=(10, 16), spread=18, arc=(-24, 24), size=1.1,
               src_jitter=10)


# ---------------------------------------------------------------- 1-2  victory / defeat: the scales
def scales_k(n):
    a = LN['haar'][2]
    return 1 - ease(ramp(n, a + 8, a + 26))


def fx_scales(lay, n, ctx):
    for pan, nm, sd in ((RM.PANS[0], 'jeet', 11), (RM.PANS[1], 'haar', 12)):
        a, k, l = LN[nm]
        g = env(n, k, l + 6, 5, 10)
        if g > 0:
            th = np.linspace(math.pi, 2 * math.pi, 30)
            lay.poly([(pan[0] + 36 * math.cos(t), pan[1] + 2 + 11 * math.sin(t)) for t in th], GOLD, 0.95 * g, 2.6)
            lay.dots([pan[0]], [pan[1] - 6], [0.7 * g * (0.8 + 0.2 * math.sin(n * 0.7))], WHITE, r=6)
        if l - 3 <= n <= l + 40:
            stream(lay, n, (pan[0], pan[1] - 8), MOONC, l - 3, l + 12, 180, sd, GOLD, travel=(12, 20), spread=36, arc=(-110, -20),
                   size=1.4, src_jitter=12)
        moon_flash(lay, n, l + 14)
        to_thief(lay, n, l + 14, ctx['thief_hand'], seed=sd)
    a = LN['haar'][2]
    if a + 6 <= n <= a + 40:
        stream(lay, n, (RM.HOOK[0], RM.HOOK[1] + 140), MOONC, a + 8, a + 24, 110, 13, GOLD, travel=(14, 22), spread=40,
               arc=(-90, -10), size=1.2, src_jitter=50)


# ---------------------------------------------------------------- 3  fear: his wall shadow becomes a monster, then is taken
def fear_shadow(n):
    a, k, l = LN['dar']
    return ease(ramp(n, k - 2, k + 12)), ease(ramp(n, l, l + 20)), 1 - ramp(n, l + 12, l + 22)


def fx_fear(lay, n, ctx):
    a, k, l = LN['dar']
    if l <= n <= l + 40:
        stream(lay, n, ctx.get('shadow_c', (260, 500)), MOONC, l, l + 18, 160, 21, VIOLET, travel=(12, 20), spread=60, arc=(-120, 0),
               size=1.8, src_jitter=80)
    moon_flash(lay, n, l + 20, VIOLET)
    to_thief(lay, n, l + 20, ctx['thief_hand'], VIOLET, seed=3)


# ---------------------------------------------------------------- 4  home: a starry dome from the moon swallows the room
def dome(n):
    a, k, l = LN['ghar']
    t = ramp(n, l, l + 24)
    return 0.0 if t <= 0 else 30 + 1700 * t ** 1.7


def fx_home(lay, n, ctx):
    a, k, l = LN['ghar']
    r = dome(n)
    if 0 < r < 1800:
        th = np.linspace(0, 2 * math.pi, 220)
        v = 1 - ramp(n, l + 18, l + 26)
        lay.poly([(MOONC[0] + r * math.cos(t), MOONC[1] + r * math.sin(t)) for t in th], WHITE, 0.9 * v, 3.2)
        rng = np.random.default_rng(n)
        m = 90
        ang = rng.uniform(0, 2 * math.pi, m)
        ln = rng.uniform(16, 70, m)
        lay.streaks(MOONC[0] + (r - ln) * np.cos(ang), MOONC[1] + (r - ln) * np.sin(ang), MOONC[0] + (r + 5) * np.cos(ang),
                    MOONC[1] + (r + 5) * np.sin(ang), rng.uniform(0.3, 0.9, m) * v, WHITE, w=1.3)
    g = env(n, k, l + 4, 6, 4)
    if g > 0:
        rng = np.random.default_rng(55)
        m = 160
        xs, ys = rng.uniform(0, 1920, m), rng.uniform(180, 790, m)
        tw = g * rng.uniform(0.2, 0.8, m) * (0.6 + 0.4 * np.sin(rng.uniform(0, 6.3, m) + n * 0.5))
        lay.dots(xs, ys, tw, WHITE, r=1.5)
    moon_flash(lay, n, l + 2, WHITE)


# ---------------------------------------------------------------- 5  dreams: a kite on a string from his raised hand
def fx_kite(lay, n, ctx):
    a, k, l = LN['khwab']
    if not (k - 6 <= n <= l + 18):
        return
    hand = ctx['palm']
    kk = ease(ramp(n, k - 6, k + 2)) * (1 - ramp(n, l + 12, l + 16))
    rise = ease(ramp(n, k - 6, k + 20))
    pull = ramp(n, l, l + 14) ** 1.5
    kx0 = hand[0] + 50 + 110 * rise + 16 * math.sin(n * 0.17)
    ky0 = hand[1] - 80 - 190 * rise + 9 * math.sin(n * 0.23)
    x, y = kx0 + (MOONC[0] - kx0) * pull, ky0 + (MOONC[1] - ky0) * pull
    size = 110 * SZ * (1 - 0.85 * pull) / 0.72
    rot = 0.25 * math.sin(n * 0.15) + 0.3
    draw_icon(lay, xf(F2.icon_kite(), x, y, size, rot), GOLD, kk, 2.6)
    tail = [(x - size * 0.1 - u * size * 0.95 * (1 - pull) + 12 * math.sin(n * 0.3 + u * 6) * (1 - pull), y + size * 0.5 + u * size * 1.2 * (1 - pull))
            for u in np.linspace(0, 1, 14)]
    lay.poly(tail, GOLD, kk * 0.8, 1.4)
    if pull < 0.12:
        sk = kk * (1 - pull / 0.12)
        c = ((hand[0] + x) / 2 + 30, (hand[1] + y) / 2 + 40)
        xs, ys = bez(hand, (x, y + size * 0.5), c, np.linspace(0, 1, 30))
        lay.poly(list(zip(xs, ys)), WHITE, sk * 0.6, 1.1)
    if pull > 0:
        stream(lay, n, (x, y), MOONC, l, l + 12, 50, 41, GOLD, travel=(8, 12), spread=8, arc=(-16, 0), size=1.1, src_jitter=6)
    moon_flash(lay, n, l + 14)
    to_thief(lay, n, l + 14, ctx['thief_hand'], seed=5)


# ---------------------------------------------------------------- 6  secrets: a casket opens in his palms
def fx_chest(lay, n, ctx):
    a, k, l = LN['raaz']
    if not (k - 8 <= n <= l + 30):
        return
    palm = ctx['palm']
    kk = ease(ramp(n, k - 8, k)) * (1 - ramp(n, l + 4, l + 12))
    op = ease(ramp(n, k + 4, k + 14))
    cx, cy = palm[0] + 4, palm[1] - 24
    draw_icon(lay, xf(F2.icon_chest(op), cx, cy, 46), GOLD, kk, 2.0)
    if op > 0.2:
        g = np.exp(-((n - k - 12) / 12.0) ** 2)
        lay.dots([cx], [cy - 18], [g * 0.9 * kk], WHITE, r=8)
        stream(lay, n, (cx, cy - 12), MOONC, k + 10, l + 10, 220, 51, GOLD, travel=(14, 24), spread=50, arc=(-150, -30), size=1.3,
               src_jitter=8)
    moon_flash(lay, n, l + 14)
    to_thief(lay, n, l + 14, ctx['thief_hand'], seed=6)


# ---------------------------------------------------------------- 7  sorrow: he looks up; a breath of tiny stars
def fx_sorrow(lay, n, ctx):
    a, k, l = LN['gham']
    if not (k - 2 <= n <= l + 30):
        return
    stream(lay, n, ctx['chest'], MOONC, k, l + 6, 300, 61, WHITE, travel=(20, 30), spread=26, arc=(-70, -10), size=1.2, src_jitter=8)
    moon_flash(lay, n, l + 18, WHITE)
    to_thief(lay, n, l + 18, ctx['thief_hand'], WHITE, seed=7)


# ---------------------------------------------------------------- 8  wounds: red cracks glow on him, then bleed away
CRACKS = [[(-60, -610), (-34, -570), (-52, -536), (-24, -496)], [(40, -520), (66, -486), (48, -450), (76, -414)],
          [(-86, -392), (-58, -352), (-78, -318), (-52, -286)], [(70, -650), (92, -620), (80, -596)],
          [(-210, -176), (-160, -196), (-124, -170), (-90, -190)], [(120, -206), (160, -176), (204, -198), (240, -178)],
          [(10, -420), (30, -380), (14, -350)]]


def fx_wounds(lay, n, ctx):
    a, k, l = LN['zakhm']
    if not (k - 4 <= n <= l + 30):
        return
    kk = ease(ramp(n, k - 2, k + 10)) * (1 - ramp(n, l + 2, l + 14))
    to_set = ctx['torso_to_set']
    for i, cr in enumerate(CRACKS):
        pts = [to_set(p) for p in cr]
        if kk > 0:
            lay.poly(pts, RED, kk * (0.75 + 0.25 * math.sin(n * 0.5 + i)), 2.2)
        stream(lay, n, pts[len(pts) // 2], MOONC, l - 2 + i, l + 12, 55, 71 + i, RED, travel=(12, 20), spread=30, arc=(-120, -20),
               size=1.4, src_jitter=6)
    moon_flash(lay, n, l + 16, RED)
    to_thief(lay, n, l + 16, ctx['thief_hand'], RED, seed=8)


# ---------------------------------------------------------------- 9  identity: fingerprint whorl -> galaxy -> moon
def fx_identity(lay, n, ctx):
    a, k, l = LN['zaat']
    if not (k - 4 <= n <= l + 30):
        return
    palm = ctx['palm']
    kk = ease(ramp(n, k - 4, k + 4)) * (1 - ramp(n, l + 12, l + 16))
    morph = ease(ramp(n, k + 8, k + 24))
    go = ramp(n, l, l + 14) ** 1.5
    x0, y0 = palm[0] + 8, palm[1] - 80
    x, y = x0 + (MOONC[0] - x0) * go, y0 + (MOONC[1] - y0) * go
    size = 58 * (1 - 0.85 * go)
    rot = n * 0.06 * morph
    rng = np.random.default_rng(81)
    for r_ in np.linspace(0.12, 1.0, 9):
        th = np.linspace(0, 2 * math.pi * (1 - 0.2 * morph), 70)
        wob = 0.05 * np.sin(th * 3 + r_ * 9) * (1 - morph)
        rr = r_ * (1 + wob) * (1 - 0.25 * morph * th / (2 * math.pi))
        pts = [(x + size * q * math.cos(t + rot), y + size * q * 0.75 * math.sin(t + rot)) for q, t in zip(rr, th)]
        lay.poly(pts, GOLD if morph < 0.5 else WHITE * 0.5 + GOLD * 0.5, kk * (1 - 0.5 * morph), 1.3)
    if morph > 0:
        m = 160
        u = rng.uniform(0, 1, m)
        arm = rng.integers(0, 2, m)
        th = u * 3.2 * math.pi + arm * math.pi + rot * 2
        rr = 0.08 + u * 0.95
        lay.dots(x + size * rr * np.cos(th) + rng.normal(0, 1.5, m), y + size * rr * 0.75 * np.sin(th) + rng.normal(0, 1.5, m),
                 morph * kk * rng.uniform(0.3, 1.0, m), WHITE, r=1.2)
    moon_flash(lay, n, l + 14)
    to_thief(lay, n, l + 14, ctx['thief_hand'], seed=9)


# ---------------------------------------------------------------- 10  standing: his body turns to stars
def star_body(n):
    a, k, l = LN['auqaat']
    return ease(ramp(n, k - 2, k + 22))


def fx_standing(lay, n, ctx):
    a, k, l = LN['auqaat']
    if l - 2 <= n <= l + 34:
        stream(lay, n, ctx['belly'], MOONC, l - 2, l + 14, 240, 95, WHITE, travel=(14, 22), spread=50, arc=(-140, -20), size=1.2,
               src_jitter=50)
    moon_flash(lay, n, l + 16, WHITE)
    to_thief(lay, n, l + 16, ctx['thief_hand'], WHITE, seed=10)


# ---------------------------------------------------------------- 11  words: letters rise from his palms and become birds
LETTERS = ['क', 'ब', 'च', 'व', 'त', 'म', 'र', 'स', 'ल', 'ह']
_GL = {}


def letter_mask(ch, px=72):
    if ch not in _GL:
        from PIL import Image, ImageDraw, ImageFont
        f = ImageFont.truetype(L.S + '/fonts/deva2.ttf', px)
        im = Image.new('L', (px * 2, px * 2), 0)
        ImageDraw.Draw(im).text((px // 2, px // 4), ch, fill=255, font=f)
        a = np.array(im).astype(np.float32) / 255
        ys, xs = np.where(a > 0.1)
        _GL[ch] = a[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
    return _GL[ch]


def fx_words(lay, n, ctx):
    a, k, l = LN['baat']
    if not (k - 2 <= n <= l + 40):
        return
    rng = np.random.default_rng(91)
    palm = ctx['palm']
    for i, ch in enumerate(LETTERS):
        t0 = k - 2 + i * 3
        hx, hy = palm[0] + 30 + i * 26 + rng.uniform(-8, 8), palm[1] - 60 - 18 * i + rng.uniform(-10, 10)
        fly0 = l - 4 + i
        fly1 = fly0 + 24 + int(rng.integers(0, 8))
        if not (t0 <= n <= fly1 + 2):
            continue
        if n <= fly0:
            t = ease(ramp(n, t0, t0 + 18))
            x, y = palm[0] + (hx - palm[0]) * t, palm[1] - 16 + (hy - palm[1] + 16) * t
            y += 3 * math.sin(n * 0.2 + i)
            kk = ease(ramp(n, t0, t0 + 5))
            gm = letter_mask(ch)
            s = 32 * lay.z / gm.shape[0]
            X, Y = lay.P(x, y)
            g = cv2.resize(gm, None, fx=s, fy=s, interpolation=cv2.INTER_AREA)
            gh, gw = g.shape
            xa, ya = int(X - gw / 2), int(Y - gh / 2)
            m = ramp(n, fly0 - 6, fly0)
            if 0 <= xa and xa + gw < W and 0 <= ya and ya + gh < H:
                lay.img[ya:ya + gh, xa:xa + gw] += g[..., None] * GOLD * kk * 0.95 * (1 - m)
                lay.used = True
            if m > 0:
                draw_icon(lay, xf(F2.bird_strokes(n * 0.8 + i), x, y, 38), GOLD, m, 2.2)
        else:
            t = ramp(n, fly0, fly1) ** 1.3
            c = ((hx + MOONC[0]) / 2 + rng.uniform(-60, 60), (hy + MOONC[1]) / 2 - rng.uniform(30, 110))
            x, y = bez((hx, hy), MOONC, c, t)
            draw_icon(lay, xf(F2.bird_strokes(n * 0.8 + i), float(x), float(y), 38 * (1 - 0.75 * t)), GOLD,
                      1 - ramp(n, fly1 - 3, fly1 + 1), 2.2)
    moon_flash(lay, n, l + 30)
    to_thief(lay, n, l + 30, ctx['thief_hand'], seed=11)


# ---------------------------------------------------------------- 12  circumstances: the lamp's light is taken, it goes out
def lamp_k(n):
    a, k, l = LN['haalaat']
    return float(np.clip(1 - ramp(n, l - 8, l + 26) ** 1.6, 0, 1))


def fx_lamp(lay, n, ctx):
    a, k, l = LN['haalaat']
    if k <= n <= l + 40:
        stream(lay, n, ctx['flame'], MOONC, k + 4, l + 18, 280, 101, GOLD, travel=(20, 32), spread=50, arc=(-140, 30), size=1.3,
               src_jitter=8)
    moon_flash(lay, n, l + 26)
    to_thief(lay, n, l + 26, ctx['thief_hand'], seed=12)


def lamp_smoke(img, n, cam):
    a, k, l = LN['haalaat']
    t0 = l + 22
    if not (t0 <= n <= t0 + 80):
        return
    lay = Layer(cam)
    fx, fy = RM.DIYA_LIGHT
    pts = [(fx + 10 * math.sin(u * 7 + n * 0.12), fy - 8 - u * 150 * min(1.0, (n - t0) / 26.0 + 0.2)) for u in np.linspace(0, 1, 40)]
    lay.poly(pts, np.array([0.55, 0.52, 0.50], np.float32), 0.30 * (1 - ramp(n, t0 + 50, t0 + 80)), 2.0)
    lay.apply(img, glow=4, gain=0.6)


# ---------------------------------------------------------------- the thief bursts into light (16:9 version of v2's)
D0, DT = 1424.0, 26.0
_DIS = {}


def dissolve_thief(img, n, pm, M):
    a = pm[..., 3]
    key = a.shape
    if key not in _DIS:
        Hs, Ws = a.shape
        rng = np.random.default_rng(31)
        noise = cv2.GaussianBlur(rng.random((Hs, Ws)).astype(np.float32), (0, 0), 3.5)
        noise = (noise - noise.min()) / (noise.max() - noise.min() + 1e-6)
        ys, xs = np.where(a > 0.5)
        y0, y1 = ys.min(), ys.max()
        yn = np.clip((np.arange(Hs)[:, None] - y0) / max(1, y1 - y0), 0, 1)
        tmap = (D0 + DT * (0.5 * noise + 0.5 * yn)).astype(np.float32)
        k = min(2600, len(xs))
        sel = rng.choice(len(xs), k, replace=False)
        _DIS[key] = dict(tmap=tmap, px=xs[sel].astype(np.float32), py=ys[sel].astype(np.float32),
                         pt=tmap[ys[sel], xs[sel]] + rng.uniform(-1.5, 1.5, k), ang=rng.normal(0, 0.55, k),
                         spd=rng.uniform(6.0, 16.0, k), br=rng.uniform(0.45, 1.0, k))
    d = _DIS[key]
    kk = np.clip((d['tmap'] - n) / 3.0, 0, 1)
    RM.place(img, pm * kk[..., None], M)
    edge = (np.clip(1 - np.abs(d['tmap'] - n - 1.0) / 1.3, 0, 1) * (a > 0.3)).astype(np.float32)
    wpm, box = L.place_roi(img, np.dstack([edge, edge, edge, edge]), M)
    if wpm is not None:
        x0, y0, x1, y1 = box
        g = cv2.GaussianBlur(wpm[..., 3], (0, 0), 2.5)
        img[y0:y1, x0:x1] += (wpm[..., 3] * 0.5 + g * 0.4)[..., None] * np.array([1.0, 0.86, 0.80], np.float32)
    age = n - d['pt']
    live = (age > 0) & (age < 40)
    if live.any():
        P = np.stack([d['px'][live], d['py'][live], np.ones(live.sum())], 0)
        st = (M @ P).T
        sc = float(np.sqrt(abs(np.linalg.det(M[:, :2]))))
        ag = age[live]
        vx = np.sin(d['ang'][live]) * d['spd'][live] * 0.9
        vy = -np.cos(d['ang'][live]) * d['spd'][live]
        pos = lambda t: (st[:, 0] + vx * t * (1 + 0.04 * t), st[:, 1] + vy * t * (1 + 0.04 * t))
        x1, y1 = pos(ag)
        x0, y0 = pos(np.maximum(ag - 1.8, 0))
        fade = np.exp(-ag / 16.0) * np.clip(ag / 2.0, 0, 1) * d['br'][live] * 0.85 * float(np.clip((1482 - n) / 12.0, 0, 1))
        layer = np.zeros((H, W, 3), np.float32)
        th = max(1, int(round(2.0 * sc * 2)))
        col = np.array([1.0, 0.88, 0.82], np.float32)
        for i in range(len(x1)):
            cv2.line(layer, (int(x0[i] * 4), int(y0[i] * 4)), (int(x1[i] * 4), int(y1[i] * 4)), tuple(float(c) for c in col * fade[i]),
                     th, cv2.LINE_AA, 2)
        img += layer + L.blur(layer, 3.0) * 0.8


# ---------------------------------------------------------------- dispatch
def behind(img, n, cam, ctx):
    lay = Layer(cam)
    fx_scales(lay, n, ctx)
    fx_home(lay, n, ctx)
    lay.apply(img)


def front(img, n, cam, ctx):
    lay = Layer(cam)
    fx_fear(lay, n, ctx)
    fx_kite(lay, n, ctx)
    fx_chest(lay, n, ctx)
    fx_sorrow(lay, n, ctx)
    fx_wounds(lay, n, ctx)
    fx_identity(lay, n, ctx)
    fx_standing(lay, n, ctx)
    fx_words(lay, n, ctx)
    fx_lamp(lay, n, ctx)
    lay.apply(img)
    lamp_smoke(img, n, cam)
