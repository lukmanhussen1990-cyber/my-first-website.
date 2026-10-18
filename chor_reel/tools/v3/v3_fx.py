"""v3 story effects, each locked to its lyric line (v3_beats.LINES): the thing appears on its key word and is taken
into the moon on "ले जा", then a thin stream carries it from the moon to the thief's hand.
Set-space positions go through the shot camera (v2_fx.Layer)."""
import os, sys, math
import numpy as np, cv2
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(1, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "v2"))  # v2 helpers
import v2lib as L
import v2_fx as F2
import v3_beats as B
import v3_room as RM

W, H = RM.W, RM.H
GOLD, WHITE, RED = F2.GOLD, F2.WHITE, F2.RED
VIOLET = np.array([0.80, 0.45, 0.55], np.float32)
MOONC = (RM.MOON[0], RM.MOON[1])
MOON_R = RM.MOON[2]
Layer, stream, bez, xf, draw_icon = F2.Layer, F2.stream, F2.bez, F2.xf, F2.draw_icon
ease, ramp = B.ease, B.ramp
LN = B.LINE                       # name -> (start, key, leja)
HX, HY = RM.HOOK
PAN_L, PAN_R = (HX - 76, HY + 190), (HX + 76, HY + 190)


def env(n, a, b, fin=4, fout=6):
    return min(ramp(n, a - fin, a), 1 - ramp(n, b, b + fout))


def moon_flash(lay, n, t, col=GOLD, k=1.0):
    v = env(n, t, t + 2, 1, 9) * k
    if v > 0:
        th = np.linspace(0, 2 * math.pi, 72)
        r = MOON_R * (1.05 + 0.30 * ramp(n, t, t + 11))
        lay.poly([(MOONC[0] + r * math.cos(a), MOONC[1] + r * math.sin(a)) for a in th], col, v * 0.8, 3)


def to_thief(lay, n, t, hand, col=GOLD, seed=0):
    """after the moon takes it: a thin stream from the moon into the thief's open hand"""
    if t - 1 <= n <= t + 30:
        stream(lay, n, MOONC, hand, t, t + 12, 70, 900 + seed, col, travel=(10, 16), spread=24, arc=(-30, 30), size=1.2,
               src_jitter=14)


# ---------------------------------------------------------------- 1-2  victory / defeat: the two pans of the scales
def scales_k(n):
    """the brass scales vanish from the niche after 'हार भी ले जा'"""
    a = LN['haar'][2]
    return 1 - ease(ramp(n, a + 8, a + 26))


def fx_scales(lay, n, ctx):
    for pan, nm, sd in ((PAN_L, 'jeet', 11), (PAN_R, 'haar', 12)):
        a, k, l = LN[nm]
        g = env(n, k, l + 6, 5, 10)
        if g > 0:
            th = np.linspace(math.pi, 2 * math.pi, 30)
            lay.poly([(pan[0] + 40 * math.cos(t), pan[1] + 2 + 12 * math.sin(t)) for t in th], GOLD, 0.95 * g, 3)
            lay.dots([pan[0]], [pan[1] - 6], [0.7 * g * (0.8 + 0.2 * math.sin(n * 0.7))], WHITE, r=7)
        if l - 3 <= n <= l + 40:
            stream(lay, n, (pan[0], pan[1] - 8), MOONC, l - 3, l + 12, 200, sd, GOLD, travel=(12, 20), spread=50, arc=(-150, -30),
                   size=1.6, src_jitter=16)
        moon_flash(lay, n, l + 14)
        to_thief(lay, n, l + 14, ctx['thief_hand'], seed=sd)
    # the whole scales break into sparkles when they are taken
    a = LN['haar'][2]
    if a + 6 <= n <= a + 40:
        stream(lay, n, (HX, HY + 120), MOONC, a + 8, a + 24, 120, 13, GOLD, travel=(14, 22), spread=60, arc=(-120, -20), size=1.3,
               src_jitter=60)


# ---------------------------------------------------------------- 3  fear: his shadow on the wall turns into a monster
def fear_shadow(n):
    """-> (grow 0..1 horns/claws, lift 0..1 pulled into the moon, keep 0..1 shadow strength)"""
    a, k, l = LN['dar']
    grow = ease(ramp(n, k - 2, k + 12))
    lift = ease(ramp(n, l, l + 20))
    keep = 1 - ramp(n, l + 12, l + 22)
    return grow, lift, keep


def fx_fear(lay, n, ctx):
    a, k, l = LN['dar']
    if l <= n <= l + 40:
        src = ctx.get('shadow_c', (150, 1000))
        stream(lay, n, src, MOONC, l, l + 18, 160, 21, VIOLET, travel=(12, 20), spread=70, arc=(-120, 0), size=2.0, src_jitter=90)
    moon_flash(lay, n, l + 20, VIOLET)
    to_thief(lay, n, l + 20, ctx['thief_hand'], VIOLET, seed=3)


# ---------------------------------------------------------------- 4  home: the room is taken (a starry dome from the moon)
def dome(n):
    """radius (set px) of the star dome around the moon, 0 before 'घर भी ले जा'"""
    a, k, l = LN['ghar']
    t = ramp(n, l, l + 24)
    return 0.0 if t <= 0 else 40 + 2100 * t ** 1.7


def fx_home(lay, n, ctx):
    a, k, l = LN['ghar']
    r = dome(n)
    if 0 < r < 2300:
        th = np.linspace(0, 2 * math.pi, 220)
        v = 1 - ramp(n, l + 18, l + 26)
        lay.poly([(MOONC[0] + r * math.cos(t), MOONC[1] + r * math.sin(t)) for t in th], WHITE, 0.9 * v, 4)
        rng = np.random.default_rng(n)
        m = 90
        ang = rng.uniform(0, 2 * math.pi, m)
        ln = rng.uniform(20, 90, m)
        x0, y0 = MOONC[0] + (r - ln) * np.cos(ang), MOONC[1] + (r - ln) * np.sin(ang)
        x1, y1 = MOONC[0] + (r + 6) * np.cos(ang), MOONC[1] + (r + 6) * np.sin(ang)
        lay.streaks(x0, y0, x1, y1, rng.uniform(0.3, 0.9, m) * v, WHITE, w=1.4)
    # tiny stars appear on the walls on 'घर'
    g = env(n, k, l + 4, 6, 4)
    if g > 0:
        rng = np.random.default_rng(55)
        m = 140
        xs, ys = rng.uniform(0, 1080, m), rng.uniform(340, 1400, m)
        tw = g * rng.uniform(0.2, 0.8, m) * (0.6 + 0.4 * np.sin(rng.uniform(0, 6.3, m) + n * 0.5))
        lay.dots(xs, ys, tw, WHITE, r=1.6)
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
    kx0 = hand[0] + 60 + 120 * rise + 22 * math.sin(n * 0.17)
    ky0 = hand[1] - 120 - 330 * rise + 12 * math.sin(n * 0.23)
    x, y = kx0 + (MOONC[0] - kx0) * pull, ky0 + (MOONC[1] - ky0) * pull
    size = 150 * (1 - 0.85 * pull)
    rot = 0.25 * math.sin(n * 0.15) + 0.3
    draw_icon(lay, xf(F2.icon_kite(), x, y, size, rot), GOLD, kk, 3.0)
    tail = [(x - size * 0.1 - u * size * 0.95 * (1 - pull) + 16 * math.sin(n * 0.3 + u * 6) * (1 - pull), y + size * 0.5 + u * size * 1.2 * (1 - pull))
            for u in np.linspace(0, 1, 14)]
    lay.poly(tail, GOLD, kk * 0.8, 1.6)
    if pull < 0.12:
        sk = kk * (1 - pull / 0.12)
        c = ((hand[0] + x) / 2 + 40, (hand[1] + y) / 2 + 60)
        xs, ys = bez(hand, (x, y + size * 0.5), c, np.linspace(0, 1, 30))
        lay.poly(list(zip(xs, ys)), WHITE, sk * 0.6, 1.2)
    if pull > 0:
        stream(lay, n, (x, y), MOONC, l, l + 12, 50, 41, GOLD, travel=(8, 12), spread=10, arc=(-20, 0), size=1.2, src_jitter=8)
    moon_flash(lay, n, l + 14)
    to_thief(lay, n, l + 14, ctx['thief_hand'], seed=5)


# ---------------------------------------------------------------- 6  secrets: a small casket opens in his palms
def fx_chest(lay, n, ctx):
    a, k, l = LN['raaz']
    if not (k - 8 <= n <= l + 30):
        return
    palm = ctx['palm']
    kk = ease(ramp(n, k - 8, k)) * (1 - ramp(n, l + 4, l + 12))
    op = ease(ramp(n, k + 4, k + 14))
    cx, cy = palm[0] + 6, palm[1] - 34
    draw_icon(lay, xf(F2.icon_chest(op), cx, cy, 64), GOLD, kk, 2.4)
    if op > 0.2:
        g = np.exp(-((n - k - 12) / 12.0) ** 2)
        lay.dots([cx], [cy - 26], [g * 0.9 * kk], WHITE, r=10)
        stream(lay, n, (cx, cy - 18), MOONC, k + 10, l + 10, 240, 51, GOLD, travel=(14, 24), spread=70, arc=(-200, -40), size=1.5,
               src_jitter=10)
    moon_flash(lay, n, l + 14)
    to_thief(lay, n, l + 14, ctx['thief_hand'], seed=6)


# ---------------------------------------------------------------- 7  sorrow: he looks up; a breath of tiny stars to the moon
def fx_sorrow(lay, n, ctx):
    a, k, l = LN['gham']
    if not (k - 2 <= n <= l + 30):
        return
    stream(lay, n, ctx['chest'], MOONC, k, l + 6, 320, 61, WHITE, travel=(20, 30), spread=30, arc=(-90, -10), size=1.3, src_jitter=10)
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
            lay.poly(pts, RED, kk * (0.75 + 0.25 * math.sin(n * 0.5 + i)), 2.6)
        stream(lay, n, pts[len(pts) // 2], MOONC, l - 2 + i, l + 12, 60, 71 + i, RED, travel=(12, 20), spread=40, arc=(-160, -20),
               size=1.6, src_jitter=8)
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
    x0, y0 = palm[0] + 10, palm[1] - 110
    x, y = x0 + (MOONC[0] - x0) * go, y0 + (MOONC[1] - y0) * go
    size = 80 * (1 - 0.85 * go)
    rot = n * 0.06 * morph
    rng = np.random.default_rng(81)
    for r_ in np.linspace(0.12, 1.0, 9):
        th = np.linspace(0, 2 * math.pi * (1 - 0.2 * morph), 70)
        wob = 0.05 * np.sin(th * 3 + r_ * 9) * (1 - morph)
        rr = r_ * (1 + wob) * (1 - 0.25 * morph * th / (2 * math.pi))
        pts = [(x + size * q * math.cos(t + rot), y + size * q * 0.75 * math.sin(t + rot)) for q, t in zip(rr, th)]
        lay.poly(pts, GOLD if morph < 0.5 else WHITE * 0.5 + GOLD * 0.5, kk * (1 - 0.5 * morph), 1.5)
    if morph > 0:
        m = 160
        u = rng.uniform(0, 1, m)
        arm = rng.integers(0, 2, m)
        th = u * 3.2 * math.pi + arm * math.pi + rot * 2
        rr = 0.08 + u * 0.95
        lay.dots(x + size * rr * np.cos(th) + rng.normal(0, 2, m), y + size * rr * 0.75 * np.sin(th) + rng.normal(0, 2, m),
                 morph * kk * rng.uniform(0.3, 1.0, m), WHITE, r=1.4)
    moon_flash(lay, n, l + 14)
    to_thief(lay, n, l + 14, ctx['thief_hand'], seed=9)


# ---------------------------------------------------------------- 10  standing: his body turns to stars
def star_body(n):
    a, k, l = LN['auqaat']
    return ease(ramp(n, k - 2, k + 22))


def fx_standing(lay, n, ctx):
    a, k, l = LN['auqaat']
    if l - 2 <= n <= l + 34:
        stream(lay, n, ctx['belly'], MOONC, l - 2, l + 14, 260, 95, WHITE, travel=(14, 22), spread=60, arc=(-160, -20), size=1.3,
               src_jitter=60)
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
        hx, hy = palm[0] + 40 + i * 30 + rng.uniform(-10, 10), palm[1] - 150 - 26 * i + rng.uniform(-14, 14)
        fly0 = l - 4 + i
        fly1 = fly0 + 26 + int(rng.integers(0, 8))
        if not (t0 <= n <= fly1 + 2):
            continue
        if n <= fly0:
            t = ease(ramp(n, t0, t0 + 18))
            x, y = palm[0] + (hx - palm[0]) * t, palm[1] - 20 + (hy - palm[1] + 20) * t
            y += 4 * math.sin(n * 0.2 + i)
            kk = ease(ramp(n, t0, t0 + 5))
            gm = letter_mask(ch)
            s = 46 * lay.z / gm.shape[0]
            X, Y = lay.P(x, y)
            g = cv2.resize(gm, None, fx=s, fy=s, interpolation=cv2.INTER_AREA)
            gh, gw = g.shape
            xa, ya = int(X - gw / 2), int(Y - gh / 2)
            m = ramp(n, fly0 - 6, fly0)
            if 0 <= xa and xa + gw < W and 0 <= ya and ya + gh < H:
                lay.img[ya:ya + gh, xa:xa + gw] += g[..., None] * GOLD * kk * 0.95 * (1 - m)
                lay.used = True
            if m > 0:
                draw_icon(lay, xf(F2.bird_strokes(n * 0.8 + i), x, y, 52), GOLD, m, 2.6)
        else:
            t = ramp(n, fly0, fly1) ** 1.3
            c = ((hx + MOONC[0]) / 2 + rng.uniform(-90, 90), (hy + MOONC[1]) / 2 - rng.uniform(40, 160))
            x, y = bez((hx, hy), MOONC, c, t)
            draw_icon(lay, xf(F2.bird_strokes(n * 0.8 + i), float(x), float(y), 52 * (1 - 0.75 * t)), GOLD,
                      1 - ramp(n, fly1 - 3, fly1 + 1), 2.6)
    moon_flash(lay, n, l + 30)
    to_thief(lay, n, l + 30, ctx['thief_hand'], seed=11)


# ---------------------------------------------------------------- 12  circumstances: the lamp's light is taken, it goes out
def lamp_k(n):
    a, k, l = LN['haalaat']
    return float(np.clip(1 - ramp(n, l - 8, l + 26) ** 1.6, 0, 1))


def fx_lamp(lay, n, ctx):
    a, k, l = LN['haalaat']
    if k <= n <= l + 40:
        fl = ctx['flame']
        stream(lay, n, fl, MOONC, k + 4, l + 18, 300, 101, GOLD, travel=(20, 32), spread=70, arc=(-160, 40), size=1.5, src_jitter=10)
    moon_flash(lay, n, l + 26)
    to_thief(lay, n, l + 26, ctx['thief_hand'], seed=12)


def lamp_smoke(img, n, cam):
    a, k, l = LN['haalaat']
    t0 = l + 22
    if not (t0 <= n <= t0 + 80):
        return
    lay = Layer(cam)
    fx, fy = RM.DIYA_LIGHT
    pts = []
    for i in range(40):
        u = i / 39
        hgt = u * 200 * min(1.0, (n - t0) / 26.0 + 0.2)
        pts.append((fx + 14 * math.sin(u * 7 + n * 0.12), fy - 10 - hgt))
    lay.poly(pts, np.array([0.55, 0.52, 0.50], np.float32), 0.30 * (1 - ramp(n, t0 + 50, t0 + 80)), 2.4)
    lay.apply(img, glow=4, gain=0.6)


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
