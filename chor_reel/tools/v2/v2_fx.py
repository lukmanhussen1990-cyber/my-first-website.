"""Story effects: each thing the narrator gives away flies into the moon on its lyric line.
All positions are in set space (1080x1920 master) and go through the shot camera."""
import os, sys, math
import numpy as np, cv2
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import v2lib as L
import v2_room as RM
from v2_room import W, H, NARR, THIEF, MOON

GOLD = np.array([0.32, 0.74, 1.0], np.float32)
WHITE = np.array([1.0, 0.95, 0.90], np.float32)
RED = np.array([0.22, 0.25, 1.0], np.float32)
SUB = 8                                         # cv2 sub-pixel shift (3 bits)


def ease(t):
    t = float(np.clip(t, 0, 1))
    return t * t * (3 - 2 * t)


def ramp(n, a, b):
    return float(np.clip((n - a) / max(1e-6, b - a), 0, 1))


def env(n, a, b, fin=4, fout=6):
    """1 inside [a, b] with soft edges."""
    return min(ramp(n, a - fin, a), 1 - ramp(n, b, b + fout))


# ---------------------------------------------------------------- anchors (sprite px -> set)
def narr_pt(px, py):
    arr, g = RM.spr('thin_st')
    s = NARR['h'] / g['h']
    return (NARR['x'] + s * (px - g['cx']), NARR['y'] + s * (py - g['bot']))


MOUTH = narr_pt(405, 205)
HANDS = narr_pt(440, 700)
LEAF = narr_pt(545, 718)
CHEST = narr_pt(250, 520)
THIEF_HAND = (THIEF['x'] + (THIEF['h'] / 1014.0) * (40 - 465), THIEF['y'] - (THIEF['h'] / 1014.0) * (1024 - 263))
MOONC = (MOON[0], MOON[1])
PAN_L = (RM.SCALE_HOOK[0] - 106, RM.SCALE_HOOK[1] + 232)
PAN_R = (RM.SCALE_HOOK[0] + 106, RM.SCALE_HOOK[1] + 232)


def bez(p0, p1, c, t):
    t = np.asarray(t, np.float64)
    x = (1 - t) ** 2 * p0[0] + 2 * (1 - t) * t * c[0] + t ** 2 * p1[0]
    y = (1 - t) ** 2 * p0[1] + 2 * (1 - t) * t * c[1] + t ** 2 * p1[1]
    return x, y


class Layer:
    """Additive glow layer in output space."""
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
        for x, y, v in zip(xs, ys, vals):
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

    def apply(self, img, glow=7.0, gain=1.0):
        if not self.used:
            return img
        g = L.blur(self.img, glow * self.z)
        img += (self.img * 1.0 + g * 1.6) * gain
        return img


# ---------------------------------------------------------------- icon line-art (unit coords, y down)
def icon_house():
    s = []
    s.append([(-0.55, 0.05), (-0.30, -0.28), (0.30, -0.28), (0.55, 0.05)])          # hip roof
    s.append([(-0.18, -0.28), (0.0, -0.48), (0.18, -0.28)])                            # gable
    s.append([(-0.45, 0.05), (-0.45, 0.42), (0.45, 0.42), (0.45, 0.05)])                # walls
    s.append([(-0.08, 0.42), (-0.08, 0.16), (0.08, 0.16), (0.08, 0.42)])                # door
    s.append([(-0.34, 0.15), (-0.20, 0.15), (-0.20, 0.25), (-0.34, 0.25), (-0.34, 0.15)])
    s.append([(0.20, 0.15), (0.34, 0.15), (0.34, 0.25), (0.20, 0.25), (0.20, 0.15)])
    for k in range(5):
        x = -0.40 + k * 0.2
        s.append([(x, 0.02), (x + 0.12, -0.24)])                                        # tile courses
    return s


def icon_kite():
    s = [[(0, -0.5), (0.32, -0.05), (0, 0.5), (-0.32, -0.05), (0, -0.5)], [(0, -0.5), (0, 0.5)], [(-0.32, -0.05), (0.32, -0.05)]]
    return s


def icon_chest(open_k):
    a = -1.9 * open_k
    s = [[(-0.5, -0.05), (0.5, -0.05), (0.5, 0.42), (-0.5, 0.42), (-0.5, -0.05)],
         [(-0.5, 0.12), (0.5, 0.12)], [(-0.07, 0.12), (-0.07, 0.24), (0.07, 0.24), (0.07, 0.12)]]
    lid = [(-0.5, -0.05), (-0.5, -0.25), (-0.3, -0.36), (0.3, -0.36), (0.5, -0.25), (0.5, -0.05)]
    c, s_ = math.cos(a), math.sin(a)
    hx, hy = 0.5, -0.05                                                                # hinge at the back right
    lid = [(hx + (x - hx) * c - (y - hy) * s_, hy + (x - hx) * s_ + (y - hy) * c) for x, y in lid]
    s.append(lid)
    return s


def xf(strokes, cx, cy, size, rot=0.0):
    c, s_ = math.cos(rot), math.sin(rot)
    return [[(cx + size * (x * c - y * s_), cy + size * (x * s_ + y * c)) for x, y in st] for st in strokes]


def draw_icon(lay, strokes, col, k, w=2.2):
    for st in strokes:
        lay.poly(st, col, k, w)


# ---------------------------------------------------------------- particle streams
def stream(lay, n, src, dst, t0, t1, count, seed, col, travel=(16, 26), spread=40, arc=(-180, -40), size=1.8, trail=2.5,
           src_jitter=18, twinkle=True):
    """Particles emitted from src between t0 and t1, each flying on a curved path into dst."""
    rng = np.random.default_rng(seed)
    te = rng.uniform(t0, t1, count)
    tt = rng.uniform(*travel, count)
    jx, jy = rng.normal(0, src_jitter, count), rng.normal(0, src_jitter * 0.6, count)
    cxo, cyo = rng.normal(0, spread, count), rng.uniform(*arc, count)
    br = rng.uniform(0.45, 1.0, count)
    ph = rng.uniform(0, 6.28, count)
    age = (n - te) / tt
    live = (age >= 0) & (age <= 1)
    if not live.any():
        return
    sx, sy = src[0] + jx, src[1] + jy
    c = ((sx + dst[0]) / 2 + cxo, (sy + dst[1]) / 2 + cyo)
    a = age[live]
    e = a ** 1.4
    x1, y1 = bez((sx[live], sy[live]), dst, (c[0][live], c[1][live]), e)
    e0 = np.clip(e - trail / tt[live], 0, 1)
    x0, y0 = bez((sx[live], sy[live]), dst, (c[0][live], c[1][live]), e0)
    v = br[live] * np.clip(a * 6, 0, 1) * np.clip((1 - a) * 4, 0, 1) * 0.9
    if twinkle:
        v = v * (0.7 + 0.3 * np.sin(ph[live] + n * 0.9))
    lay.streaks(x0, y0, x1, y1, v, col, w=size)


def moon_flash(lay, n, t, col=GOLD, k=1.0):
    """Brief brightening of the moon when something arrives."""
    v = env(n, t, t + 2, 1, 8) * k
    if v > 0:
        th = np.linspace(0, 2 * math.pi, 60)
        r = MOON[2] * (1.05 + 0.25 * ramp(n, t, t + 10))
        lay.poly([(MOONC[0] + r * math.cos(a), MOONC[1] + r * math.sin(a)) for a in th], col, v * 0.8, 3)


# ---------------------------------------------------------------- per-beat effects
def fx_scales(lay, n):
    """Victory (left pan) and defeat (right pan): gold dust streams from the brass scales into the moon."""
    for pan, a, b, sd in ((PAN_L, 702, 728, 11), (PAN_R, 762, 786, 12)):
        g = env(n, a, b + 10, 6, 10)
        if g > 0:
            th = np.linspace(math.pi, 2 * math.pi, 30)
            lay.poly([(pan[0] + 54 * math.cos(t), pan[1] + 4 + 10 * math.sin(t)) for t in th], GOLD, 0.9 * g, 3)
            stream(lay, n, (pan[0], pan[1] - 6), MOONC, a, b, 260, sd, GOLD, travel=(14, 24), spread=60, arc=(-160, -30),
                   size=1.6, src_jitter=20)
        moon_flash(lay, n, b + 16)


def shadow_extra(n):
    """Fear: the narrator's shadow lifts off the wall and is pulled into the moon. -> (matrix|None, strength)"""
    if n < 795:
        return None, 1.0
    if n > 842:
        return None, 0.0
    t = ease((n - 795) / 42.0)
    s = 1 - 0.92 * t
    sx, sy = 120.0, 900.0                                     # approx. centre of the cast shadow
    tx = sx + (MOONC[0] - sx) * t
    ty = sy + (MOONC[1] - sy) * t - 120 * math.sin(math.pi * t)
    M = np.array([[s, 0, tx - s * sx], [0, s, ty - s * sy]], np.float64)
    strength = 1 - ramp(n, 828, 842)
    return M, strength


def fx_home(lay, n):
    """Home: a glowing Kerala-house icon rises from his hands into the moon."""
    a, b = 836, 878
    if not (a <= n <= b + 12):
        return
    t = ramp(n, a + 10, b)
    e = t ** 1.5
    x, y = bez(HANDS, MOONC, (HANDS[0] - 40, MOONC[1] + 60), e)
    size = 120 * (1 - 0.85 * e) * ease(ramp(n, a, a + 8))
    k = ease(ramp(n, a, a + 6)) * (1 - ramp(n, b - 3, b + 1))
    draw_icon(lay, xf(icon_house(), float(x), float(y), size), GOLD, k)
    stream(lay, n, (float(x), float(y)), MOONC, a + 8, b - 4, 60, 31, GOLD, travel=(8, 14), spread=20, arc=(-40, 0), size=1.2, src_jitter=10)
    moon_flash(lay, n, b)


def fx_ring(lay, n):
    """The ring around the moon before the room dissolves."""
    v = env(n, 879, 892, 3, 8)
    if v > 0:
        r = MOON[2] * (1.1 + 0.9 * ramp(n, 876, 896))
        th = np.linspace(0, 2 * math.pi, 120)
        lay.poly([(MOONC[0] + r * math.cos(a), MOONC[1] + r * math.sin(a)) for a in th], WHITE, 0.9 * v, 3)


def fx_kite(lay, n):
    """Dreams: a kite rises on a string from his hand, then is pulled into the moon."""
    a, b = 896, 962
    if not (a <= n <= b + 6):
        return
    k = ease(ramp(n, a, a + 6)) * (1 - ramp(n, b - 2, b + 2))
    rise = ease(ramp(n, a, a + 34))
    pull = ramp(n, a + 36, b) ** 1.6
    kx0 = HANDS[0] + 40 + 200 * rise + 25 * math.sin(n * 0.18)
    ky0 = HANDS[1] - 80 - 420 * rise + 12 * math.sin(n * 0.23)
    x = kx0 + (MOONC[0] - kx0) * pull
    y = ky0 + (MOONC[1] - ky0) * pull
    size = 170 * (1 - 0.85 * pull)
    rot = 0.25 * math.sin(n * 0.15) + 0.3
    draw_icon(lay, xf(icon_kite(), x, y, size, rot), GOLD, k, 3.2)
    # tail with little bows
    tail = []
    for i in range(14):
        u = i / 13
        tail.append((x - size * 0.1 - u * size * 1.2 * (1 - pull) * 0.8 + 18 * math.sin(n * 0.3 + u * 6) * (1 - pull),
                     y + size * 0.5 + u * size * 1.4 * (1 - pull)))
    lay.poly(tail, GOLD, k * 0.8, 1.6)
    # string to his hand until it snaps
    if pull < 0.15:
        sk = k * (1 - pull / 0.15)
        c = ((HANDS[0] + x) / 2 - 60, (HANDS[1] + y) / 2 + 80)
        xs, ys = bez(HANDS, (x, y + size * 0.5), c, np.linspace(0, 1, 30))
        lay.poly(list(zip(xs, ys)), WHITE, sk * 0.55, 1.2)
    if pull > 0:
        stream(lay, n, (x, y), MOONC, a + 36, b - 4, 50, 41, GOLD, travel=(8, 12), spread=10, arc=(-20, 0), size=1.2, src_jitter=8)
    moon_flash(lay, n, b - 1)


def fx_chest(lay, n):
    """Secrets: a small chest opens in his hands; its sparks stream into the moon."""
    a, b = 966, 1022
    if not (a <= n <= b + 6):
        return
    k = ease(ramp(n, a, a + 8)) * (1 - ramp(n, b - 10, b))
    op = ease(ramp(n, a + 12, a + 22))
    cx, cy = HANDS[0] + 18, HANDS[1] - 38
    draw_icon(lay, xf(icon_chest(op), cx, cy, 70), GOLD, k, 2.4)
    if op > 0.2:
        g = np.exp(-((n - a - 20) / 12.0) ** 2)
        lay.dots([cx], [cy - 30], [g * 0.9], WHITE, r=10)
        stream(lay, n, (cx, cy - 20), MOONC, a + 18, b - 12, 220, 51, GOLD, travel=(14, 24), spread=70, arc=(-200, -40), size=1.5, src_jitter=12)
    moon_flash(lay, n, b - 2)


def fx_sorrow(lay, n):
    """Sorrow: he looks up and breathes out a stream of tiny stars that drift into the moon."""
    a, b = 1030, 1078
    if not (a - 2 <= n <= b + 30):
        return
    stream(lay, n, MOUTH, MOONC, a, b, 320, 61, WHITE, travel=(20, 32), spread=30, arc=(-90, -10), size=1.3, src_jitter=6)
    moon_flash(lay, n, b + 24, WHITE)


WOUNDS = [[(245, 470), (275, 505), (255, 540), (290, 575)], [(330, 610), (360, 640), (345, 668)],
          [(170, 640), (200, 690), (185, 730), (215, 760)], [(410, 470), (430, 500), (415, 525)]]


def fx_wounds(lay, n):
    """Wounds: red cracks glow on his body, then bleed away as red streaks into the moon."""
    a, b = 1090, 1142
    if not (a <= n <= b + 6):
        return
    k = ease(ramp(n, a, a + 10)) * (1 - ramp(n, b - 14, b))
    for i, wd in enumerate(WOUNDS):
        pts = [narr_pt(x, y) for x, y in wd]
        lay.poly(pts, RED, k * (0.8 + 0.2 * math.sin(n * 0.5 + i)), 2.6)
        stream(lay, n, pts[len(pts) // 2], MOONC, a + 12 + i * 2, b - 8, 70, 71 + i, RED, travel=(14, 22), spread=40,
               arc=(-160, -20), size=1.6, src_jitter=10)
    moon_flash(lay, n, b, RED)


def fx_identity(lay, n):
    """Identity: a fingerprint whorl rises from his hand, turns into a spiral galaxy and drifts into the moon."""
    a, b = 1148, 1202
    if not (a <= n <= b + 6):
        return
    k = ease(ramp(n, a, a + 8)) * (1 - ramp(n, b - 4, b + 1))
    morph = ease(ramp(n, a + 14, a + 30))
    go = ramp(n, a + 30, b) ** 1.5
    x0, y0 = HANDS[0] + 30, HANDS[1] - 170
    x, y = x0 + (MOONC[0] - x0) * go, y0 + (MOONC[1] - y0) * go
    size = 85 * (1 - 0.85 * go)
    rot = n * 0.06 * morph
    rng = np.random.default_rng(81)
    for r_ in np.linspace(0.12, 1.0, 9):
        th = np.linspace(0, 2 * math.pi * (1 - 0.2 * morph), 70)
        wob = 0.05 * np.sin(th * 3 + r_ * 9) * (1 - morph)
        rr = r_ * (1 + wob) * (1 - 0.25 * morph * th / (2 * math.pi))
        ell = 0.75
        pts = [(x + size * rr_ * math.cos(t + rot) , y + size * rr_ * ell * math.sin(t + rot)) for rr_, t in zip(rr, th)]
        lay.poly(pts, GOLD if morph < 0.5 else WHITE * 0.5 + GOLD * 0.5, k * (1 - 0.5 * morph), 1.5)
    if morph > 0:
        m = 160
        u = rng.uniform(0, 1, m)
        arm = rng.integers(0, 2, m)
        th = u * 3.2 * math.pi + arm * math.pi + rot * 2
        rr = 0.08 + u * 0.95
        xs = x + size * rr * np.cos(th) + rng.normal(0, 2, m)
        ys = y + size * rr * 0.75 * np.sin(th) + rng.normal(0, 2, m)
        lay.dots(xs, ys, morph * k * rng.uniform(0.3, 1.0, m), WHITE, r=1.4)
    moon_flash(lay, n, b)


GLYPHS = ['അ', 'ക', 'മ', 'ര', 'ല', 'ന', 'ത', 'വ', 'സ', 'പ', 'ഇ', 'ഉ']
_GLYPH = {}


def glyph_mask(ch, px=64):
    if ch not in _GLYPH:
        from PIL import Image, ImageDraw, ImageFont
        f = ImageFont.truetype('/usr/share/fonts/truetype/freefont/FreeSans.ttf', px)
        im = Image.new('L', (px * 2, px * 2), 0)
        d = ImageDraw.Draw(im)
        d.text((px // 2, px // 4), ch, fill=255, font=f)
        a = np.array(im).astype(np.float32) / 255
        ys, xs = np.where(a > 0.1)
        a = a[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
        _GLYPH[ch] = a
    return _GLYPH[ch]


def bird_strokes(phase):
    up = math.sin(phase)
    return [[(-0.5, -0.15 * up), (-0.22, -0.30 * up - 0.05), (0.0, 0.05)], [(0.0, 0.05), (0.22, -0.30 * up - 0.05), (0.5, -0.15 * up)]]


def fx_words(lay, img, n):
    """Words: letters rise from his palm-leaf book, become birds and fly into the moon."""
    a, b = 1252, 1345
    if not (a <= n <= b + 8):
        return
    rng = np.random.default_rng(91)
    cnt = len(GLYPHS)
    for i, ch in enumerate(GLYPHS):
        t0 = a + i * 4
        rise_end = t0 + 22
        fly_end = rise_end + 34 + rng.integers(0, 10)
        if not (t0 <= n <= fly_end + 2):
            continue
        sx, sy = LEAF[0] - 30 + rng.uniform(-30, 30), LEAF[1] - 10
        hx, hy = sx + rng.uniform(-90, 120), sy - 160 - rng.uniform(0, 160)
        if n <= rise_end:
            t = ease(ramp(n, t0, rise_end))
            x, y = sx + (hx - sx) * t, sy + (hy - sy) * t
            k = ease(ramp(n, t0, t0 + 5))
            gm = glyph_mask(ch)
            s = 66 * lay.z / gm.shape[0]
            X, Y = lay.P(x, y)
            g = cv2.resize(gm, None, fx=s, fy=s, interpolation=cv2.INTER_AREA)
            gh, gw = g.shape
            xa, ya = int(X - gw / 2), int(Y - gh / 2)
            if 0 <= xa and xa + gw < W and 0 <= ya and ya + gh < H:
                lay.img[ya:ya + gh, xa:xa + gw] += g[..., None] * GOLD * k * 0.9
                lay.used = True
            # morph: a bird fades in over the letter near the end of the rise
            m = ramp(n, rise_end - 6, rise_end)
            if m > 0:
                draw_icon(lay, xf(bird_strokes(n * 0.8 + i), x, y, 64), GOLD, m, 2.8)
        else:
            t = ramp(n, rise_end, fly_end) ** 1.3
            c = ((hx + MOONC[0]) / 2 + rng.uniform(-120, 120), (hy + MOONC[1]) / 2 - rng.uniform(60, 200))
            x, y = bez((hx, hy), MOONC, c, t)
            size = 64 * (1 - 0.75 * t)
            k = 1 - ramp(n, fly_end - 3, fly_end + 1)
            draw_icon(lay, xf(bird_strokes(n * 0.8 + i), float(x), float(y), size), GOLD, k, 2.8)
    moon_flash(lay, n, b)


def lamp_flame(n):
    """Flame size factor: 'take my circumstances' - the lamp's light is drawn away, then it goes out."""
    if n < 1330:
        return 1.0
    return float(np.clip(1 - ramp(n, 1330, 1398) ** 1.8, 0, 1))


def fx_lamp_light(lay, n):
    a, b = 1318, 1392
    if not (a <= n <= b + 30):
        return
    lx, ly = RM.LAMP[0], RM.LAMP[1] - 40
    stream(lay, n, (lx, ly), MOONC, a, b, 300, 101, GOLD, travel=(22, 34), spread=80, arc=(-150, 50), size=1.5, src_jitter=60)
    moon_flash(lay, n, b + 26)


def lamp_smoke(img, n, cam):
    a, b = 1394, 1470
    if not (a <= n <= b):
        return
    lay = Layer(cam)
    lx, ly = RM.LAMP[0], RM.LAMP[1] - 30
    for j in range(3):
        pts = []
        for i in range(40):
            u = i / 39
            age = (n - a) / 30.0
            hgt = u * 260 * min(1.0, age + 0.2)
            pts.append((lx + (j - 1) * 150 * (1 - u * 0.6) + 22 * math.sin(u * 7 + n * 0.12 + j), ly - 20 - hgt))
        lay.poly(pts, np.array([0.55, 0.52, 0.50], np.float32), 0.28 * (1 - ramp(n, b - 30, b)), 3)
    lay.apply(img, glow=5, gain=0.6)


# ---------------------------------------------------------------- thief dissolve (shot 16)
D0, DT = 1424.0, 26.0


def thief_dissolving(n):
    return n >= D0


_DIS = {}


def dissolve_thief(img, n, pm, M):
    """The thief breaks up from the top down into rising streaks of light (his own colours fading to white)."""
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
    pm2 = pm * kk[..., None]
    RM.place(img, pm2, M)
    edge = (np.clip(1 - np.abs(d['tmap'] - n - 1.0) / 1.3, 0, 1) * (a > 0.3)).astype(np.float32)
    e4 = np.dstack([edge, edge, edge, edge])
    wpm, box = L.place_roi(img, e4, M)
    if wpm is not None:
        x0, y0, x1, y1 = box
        g = cv2.GaussianBlur(wpm[..., 3], (0, 0), 2.5)
        img[y0:y1, x0:x1] += (wpm[..., 3] * 0.5 + g * 0.4)[..., None] * np.array([0.95, 0.82, 0.85], np.float32)
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
        col = np.array([0.95, 0.88, 0.88], np.float32)
        for i in range(len(x1)):
            cv2.line(layer, (int(x0[i] * 4), int(y0[i] * 4)), (int(x1[i] * 4), int(y1[i] * 4)), tuple(float(c) for c in col * fade[i]),
                     th, cv2.LINE_AA, 2)
        img += layer + L.blur(layer, 3.0) * 0.8


# ---------------------------------------------------------------- dispatch from the story renderer
def behind_characters(img, n, sid, cam):
    lay = Layer(cam)
    fx_ring(lay, n)
    fx_scales(lay, n)
    lay.apply(img)


def front_of_characters(img, n, sid, cam):
    lay = Layer(cam)
    fx_home(lay, n)
    fx_kite(lay, n)
    fx_chest(lay, n)
    fx_sorrow(lay, n)
    fx_wounds(lay, n)
    fx_identity(lay, n)
    fx_words(lay, img, n)
    fx_lamp_light(lay, n)
    lay.apply(img)


# ---------------------------------------------------------------- shot 5: the hand close-up
def hand_closeup(n):
    cam = (2.25 - 0.06 * ease(ramp(n, 408, 464)), 600, 1040)
    img, _ = __import__('v2_story').base_layers(n, cam)
    arr, g = RM.spr('hand')
    hand = arr[0]
    # palm-up hand (faces left) reaching in from the right toward the moon
    s = 0.92
    drift = 30 * ease(ramp(n, 408, 464))
    tremble = 2.0 * math.sin(n * 0.7)
    tip_x, tip_y = 230 - drift, 1330 + tremble
    M = np.array([[s, 0, tip_x - s * 8], [0, s, tip_y - s * 111]], np.float64)
    pm = RM.room_lit(hand, (-5, 4), (-3, -5), exposure=1.0)
    RM.place(img, pm, M)
    # warm lamplight from below
    yy = np.linspace(0, 1, H, dtype=np.float32)[:, None, None]
    img *= (0.92 + 0.14 * yy)
    return img
