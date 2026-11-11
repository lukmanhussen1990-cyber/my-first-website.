"""2D cut-out character rigs built from low-poly facets."""
import math
import functools

import numpy as np
import skia

from engine import (Facets, paint, poly_path, smooth_path, strip_facets, capsule_pts, circle_pts, hexc, mix, mul,
                    clamp, lerp, rnd, noise1, glow_circle, argb, unit_blob, lit_col, lit_mix)

# ----------------------------------------------------------------------------
# palette
# ----------------------------------------------------------------------------
SKIN = {"you": hexc("e2a477"), "bro": hexc("c07f55")}
TOMATO = hexc("ee3b22")
HAIR = hexc("1b1a1f")
BEARD = hexc("2b1d15")
TANK = {"you": hexc("8f959d"), "bro": hexc("d52828")}
SHORTS = hexc("1c1c22")
LIPS = {"you": hexc("a85a52"), "bro": hexc("8e4a3e")}
MOUTH_IN = hexc("3d0d12")
TONGUE = hexc("d65a68")
TEETH = hexc("f6f2ea")
SCLERA = hexc("f7f3ec")
WHITE = (1, 1, 1)
DARK = hexc("16141a")


def sym(right):
    """Right half (top -> bottom, x >= 0) to full outline."""
    out = list(right)
    for x, y in reversed(right[1:-1]):
        out.append((-x, y))
    return out


def zigzag(pts, amp, seed=0, closed=True, every=1):
    out = []
    n = len(pts)
    P = np.array(pts, float)
    c = P.mean(0)
    rng_ = range(n) if closed else range(n - 1)
    for i in rng_:
        a, b = P[i], P[(i + 1) % n]
        out.append(tuple(a))
        if i % every == 0:
            m = (a + b) / 2
            d = m - c
            d /= (np.linalg.norm(d) + 1e-9)
            out.append(tuple(m + d * amp * (0.6 + 0.8 * rnd(i, seed))))
    if not closed:
        out.append(tuple(P[-1]))
    return out


# ----------------------------------------------------------------------------
# head geometry
# ----------------------------------------------------------------------------
HEAD_R = {
    "you": [(0, -238), (62, -232), (118, -212), (158, -178), (182, -128), (192, -70), (193, -10), (188, 45),
            (176, 98), (156, 145), (126, 183), (88, 208), (45, 222), (0, 227)],
    "bro": [(0, -252), (72, -247), (132, -227), (178, -188), (205, -128), (216, -60), (218, 10), (214, 75),
            (202, 135), (178, 186), (138, 224), (88, 247), (42, 256), (0, 258)],
}
FEAT = {
    "you": dict(eye_x=76, eye_y=-22, eye_w=76, eye_h=42, brow_y=-80, brow_w=96, brow_t=24, nose_y=0, mouth_y=128,
                mouth_w=96, ear_x=0, iris=(0.33, 0.22, 0.14)),
    "bro": dict(eye_x=80, eye_y=-30, eye_w=68, eye_h=34, brow_y=-86, brow_w=104, brow_t=32, nose_y=6, mouth_y=152,
                mouth_w=104, ear_x=-24, iris=(0.24, 0.16, 0.1)),
}


@functools.lru_cache(maxsize=None)
def head_parts(who):
    sk = SKIN[who]
    P = {}
    P["head"] = Facets(sym(HEAD_R[who]), sk, seed=11 if who == "you" else 12, n=30, dome=0.95, jitter=0.07,
                       spec=0.18 if who == "bro" else 0.06, shine=18)
    ex = FEAT[who]["ear_x"]
    ear = [(-182, -52), (-204, -66), (-222, -44), (-226, -6), (-218, 30), (-200, 50), (-184, 42)]
    ear = [(x + ex, y) for x, y in ear]
    P["earL"] = Facets(ear, sk, seed=3, n=5, dome=0.6)
    P["earR"] = Facets([(-x, y) for x, y in ear], sk, seed=4, n=5, dome=0.6)
    P["ear_in"] = [(x * 0.55 + (-0.45 * 205 + ex * 0.45), y * 0.6 - 2) for x, y in ear]
    nose = [(0, -50), (12, -44), (20, 10), (34, 40), (30, 58), (14, 66), (0, 62), (-14, 66), (-30, 58), (-34, 40),
            (-20, 10), (-12, -44)]
    ns = 1.0 if who == "you" else 1.28
    nose = [(x * ns, y * (1.0 if who == "you" else 1.05) + FEAT[who]["nose_y"]) for x, y in nose]
    P["nose"] = Facets(nose, sk, seed=5, n=6, dome=1.2, jitter=0.3, spec=0.12, center=(0, 30), radii=(34 * ns, 60))
    if who == "you":
        hair = [(178, -50), (195, -58), (199, -118), (186, -180), (142, -230), (76, -258), (0, -266), (-76, -258),
                (-142, -230), (-186, -180), (-199, -118), (-195, -58), (-178, -50), (-176, -150), (176, -150)]
        top = zigzag(hair[1:12], 9, seed=2, closed=False)
        hair = [hair[0]] + top + hair[12:]
        P["hair"] = Facets(hair, HAIR, seed=6, n=26, dome=0.7, jitter=0.25, spec=0.25, shine=14)
        band = [(-200, -180), (-110, -192), (0, -196), (110, -192), (200, -180), (202, -128), (110, -138),
                (0, -142), (-110, -138), (-202, -128)]
        P["band"] = Facets(band, hexc("f1f1f3"), seed=7, n=14, dome=0.5, jitter=0.12, center=(0, -60),
                           radii=(210, 130))
    else:
        outer_r = [(198, -40), (208, 30), (204, 95), (186, 158), (150, 214), (100, 256), (48, 282), (0, 290)]
        outer = outer_r + [(-x, y) for x, y in reversed(outer_r[:-1])]
        outer = zigzag(outer, 10, seed=9, closed=False)
        inner = [(-172, -40), (-156, 25), (-128, 72), (-82, 96), (-36, 88), (0, 93), (36, 88), (82, 96), (128, 72),
                 (156, 25), (172, -40)]
        P["beard"] = Facets(outer + inner, BEARD, seed=8, n=36, dome=0.75, jitter=0.2, spec=0.08,
                            center=(0, 120), radii=(210, 190))
        stache = [(-86, 136), (-62, 108), (-26, 98), (0, 104), (26, 98), (62, 108), (86, 136), (58, 128),
                  (26, 122), (0, 126), (-26, 122), (-58, 128)]
        P["stache"] = Facets(stache, mul(BEARD, 0.9), seed=10, n=8, dome=0.8, jitter=0.3)
    return P


# ----------------------------------------------------------------------------
# bust (neck + shoulders + tank) for close-ups
# ----------------------------------------------------------------------------
@functools.lru_cache(maxsize=None)
def bust_parts(who):
    sk = SKIN[who]
    P = {}
    if who == "you":
        skin_r = [(0, 110), (98, 110), (106, 258), (230, 318), (330, 345), (412, 392), (456, 470), (472, 560),
                  (484, 760), (490, 1000), (0, 1000)]
        tank_r = [(0, 420), (56, 406), (100, 360), (132, 290), (214, 312), (240, 382), (262, 452), (300, 522),
                  (346, 578), (380, 642), (394, 1000), (0, 1000)]
    else:
        skin_r = [(0, 120), (132, 120), (142, 212), (300, 282), (432, 330), (522, 400), (562, 500), (574, 620),
                  (580, 800), (585, 1000), (0, 1000)]
        tank_r = [(0, 402), (76, 386), (136, 330), (166, 242), (252, 268), (278, 352), (302, 432), (346, 512),
                  (402, 572), (442, 652), (456, 1000), (0, 1000)]
    P["skin"] = Facets(sym(skin_r), sk, seed=21, n=34, dome=0.6, jitter=0.08, spec=0.08,
                       center=(0, 560), radii=(500 if who == "you" else 590, 470))
    P["tank"] = Facets(sym(tank_r), TANK[who], seed=22, n=30, dome=0.6, jitter=0.09,
                       center=(0, 700), radii=(400 if who == "you" else 460, 380))
    if who == "bro":
        pec = [(10, 470), (60, 440), (150, 445), (250, 480), (330, 540), (300, 610), (200, 640), (90, 630),
               (20, 600)]
        P["pecR"] = Facets(pec, TANK[who], seed=23, n=10, dome=0.9, jitter=0.2)
        P["pecL"] = Facets([(-x, y) for x, y in pec], TANK[who], seed=24, n=10, dome=0.9, jitter=0.2)
        trap = [(140, 200), (300, 282), (250, 300), (150, 270)]
    return P


# ----------------------------------------------------------------------------
# face default params
# ----------------------------------------------------------------------------
FACE = dict(open=0.0, smile=0.0, wide=0.0, eyes=1.0, squeeze=0.0, look=(0.0, 0.0), brow_in=0.0, brow_up=0.0,
            red=0.0, sweat=0.0, veins=0.0, tears=0.0, turn=0.0, flare=0.0, teeth=0.0, pupil=1.0, tongue=0.0,
            blush=0.0, wrinkle=0.0, sweat_t=0.0, drip=None, brow_l=0.0, brow_r=0.0, tilt=0.0, cheek=0.0)


def face(**kw):
    f = dict(FACE)
    f.update(kw)
    return f


def skin_of(who, f, base=None):
    sk = base if base is not None else SKIN[who]
    return mix(sk, TOMATO, clamp(f.get("red", 0)) * 0.85)


# ----------------------------------------------------------------------------
# eyes / brows / mouth
# ----------------------------------------------------------------------------

def draw_eye(ctx, cx, cy, w, h, f, side, iris_col, skin):
    c = ctx.c
    op = max(0.0, f["eyes"])
    sq = f["squeeze"]
    lx, ly = f["look"]
    I = np.array([cx - side * w * 0.5, cy + h * 0.06])
    O = np.array([cx + side * w * 0.52, cy - h * 0.1])
    lid = mul(skin, 0.78)
    if sq > 0.4:
        k = clamp((sq - 0.4) / 0.6)
        # squeezed shut: tense lid shape pulled into a hard crease
        lidp = skia.Path()
        lidp.moveTo(O[0] + side * 4, O[1] - 4)
        lidp.cubicTo(O[0] - side * w * 0.3, cy - h * 0.9, I[0] + side * w * 0.3, cy - h * 0.85, I[0] - side * 2, I[1] - 6)
        lidp.cubicTo(I[0] + side * w * 0.3, cy + h * 0.25, O[0] - side * w * 0.3, cy + h * 0.3, O[0] + side * 4, O[1] - 4)
        lidp.close()
        c.drawPath(lidp, paint((0.1, 0.0, 0.05), 0.28, blur=3))
        crease = skia.Path()
        crease.moveTo(O[0] + side * 2, O[1] + 2)
        crease.cubicTo(O[0] - side * w * 0.3, cy + h * 0.05 * k, I[0] + side * w * 0.3, cy + h * 0.1 * k, I[0], I[1] - 2)
        c.drawPath(crease, paint(DARK, 1, "stroke", 8))
        # tension wrinkles at the outer corner and above
        for j in range(2):
            a = math.radians(-18 + j * 36)
            x0, y0 = O[0] + side * 6, O[1] + 2
            c.drawLine(x0, y0, x0 + side * math.cos(a) * 20, y0 + math.sin(a) * 16, paint(mul(skin, 0.5), 0.8, "stroke", 3.5))
        c.drawLine(cx - side * w * 0.05, cy - h * 0.95, cx + side * w * 0.25, cy - h * 0.8,
                   paint(mul(skin, 0.55), 0.6 * k, "stroke", 3))
        return
    if op < 0.1:
        path = skia.Path()
        path.moveTo(*I)
        path.quadTo(cx, cy + h * 0.32, O[0], O[1])
        c.drawPath(path, paint(DARK, 1, "stroke", 6))
        return
    top = h * op
    bot = h * 0.52 * min(1.0, op * 0.8 + 0.25)
    path = skia.Path()
    path.moveTo(*I)
    path.cubicTo(I[0] + side * w * 0.18, cy - top * 1.25, O[0] - side * w * 0.22, cy - top * 1.2, O[0], O[1])
    path.cubicTo(O[0] - side * w * 0.16, cy + bot * 1.15, I[0] + side * w * 0.22, cy + bot * 1.25, I[0], I[1])
    path.close()
    # socket shadow
    c.drawPath(path, paint(mul(skin, 0.55), 0.5, "stroke", 12, blur=5))
    c.drawPath(path, paint(lit_mix(ctx, SCLERA, 0.45)))
    c.save()
    c.clipPath(path, doAntiAlias=True)
    # top-lid shadow on sclera
    sh = skia.GradientShader.MakeLinear([skia.Point(cx, cy - top), skia.Point(cx, cy + bot * 0.3)],
                                        [argb((0.55, 0.45, 0.45), 0.55), argb((1, 1, 1), 0)], None)
    p = skia.Paint(AntiAlias=True)
    p.setShader(sh)
    c.drawRect(skia.Rect.MakeLTRB(cx - w, cy - h * 2, cx + w, cy + h * 2), p)
    ir = h * 0.48 * (1.0 if op <= 1 else 0.85)
    ix = cx + lx * w * 0.24 + side * w * 0.02
    iy = cy + ly * h * 0.25 + h * 0.02
    iris_col = lit_mix(ctx, iris_col, 0.4)
    c.drawCircle(ix, iy, ir, paint(iris_col))
    c.drawCircle(ix, iy, ir, paint(mul(iris_col, 0.5), 1, "stroke", 2.5))
    c.drawCircle(ix, iy, ir * 0.5 * f["pupil"], paint((0.03, 0.02, 0.03)))
    c.drawCircle(ix - ir * 0.32, iy - ir * 0.35, ir * 0.26, paint(WHITE, 0.95))
    c.drawCircle(ix + ir * 0.3, iy + ir * 0.32, ir * 0.11, paint(WHITE, 0.7))
    # tears pooling
    if f["tears"] > 0:
        tp = f["tears"]
        c.drawRect(skia.Rect.MakeLTRB(cx - w, cy + bot * (1.1 - 0.9 * tp), cx + w, cy + h * 2),
                   paint(hexc("9fd8ff"), 0.55 * tp))
        c.drawRect(skia.Rect.MakeLTRB(cx - w, cy + bot * (1.1 - 0.9 * tp), cx + w, cy + bot * (1.1 - 0.9 * tp) + 3),
                   paint(WHITE, 0.8 * tp))
    c.restore()
    # lash line + lid crease
    path = skia.Path()
    path.moveTo(*I)
    path.cubicTo(I[0] + side * w * 0.18, cy - top * 1.25, O[0] - side * w * 0.22, cy - top * 1.2, O[0], O[1])
    c.drawPath(path, paint(DARK, 1, "stroke", 6.5))
    crease = skia.Path()
    crease.moveTo(I[0] + side * w * 0.1, cy - top * 0.9 - 8)
    crease.quadTo(cx, cy - top * 1.35 - 12, O[0] - side * w * 0.05, cy - top * 0.75 - 9)
    c.drawPath(crease, paint(mul(skin, 0.62), 0.75, "stroke", 3))
    low = skia.Path()
    low.moveTo(I[0] + side * w * 0.2, cy + bot * 1.0)
    low.quadTo(cx, cy + bot * 1.25, O[0] - side * w * 0.1, cy + bot * 0.65)
    c.drawPath(low, paint(mul(skin, 0.65), 0.6, "stroke", 2.5))
    if f["tears"] > 0.55:
        k = (f["tears"] - 0.55) / 0.45
        tx, ty = O[0] - side * 6, cy + bot + 10 + k * 70
        c.drawPath(drop_path(tx, ty, 9 * k + 3, 1.4), paint(hexc("bde6ff"), 0.85 * k))


def drop_path(x, y, r, stretch=1.0):
    path = skia.Path()
    path.moveTo(x, y - r * 2.1 * stretch)
    path.cubicTo(x + r * 0.35, y - r * 1.2 * stretch, x + r, y - r * 0.6, x + r, y)
    path.cubicTo(x + r, y + r * 0.6, x + r * 0.55, y + r, x, y + r)
    path.cubicTo(x - r * 0.55, y + r, x - r, y + r * 0.6, x - r, y)
    path.cubicTo(x - r, y - r * 0.6, x - r * 0.35, y - r * 1.2 * stretch, x, y - r * 2.1 * stretch)
    path.close()
    return path


def draw_drop(c, x, y, r, stretch=1.0, alpha=1.0):
    pth = drop_path(x, y, r, stretch)
    c.drawPath(pth, paint(hexc("cfefff"), 0.55 * alpha))
    c.drawPath(pth, paint(hexc("6fa9c9"), 0.55 * alpha, "stroke", max(1.2, r * 0.16)))
    c.drawCircle(x - r * 0.35, y - r * 0.2, r * 0.3, paint(WHITE, 0.95 * alpha))


def draw_brow(ctx, cx, cy, side, w, t, inner, up, color, who):
    # inner > 0 -> inner end raised (worried); inner < 0 -> lowered (angry)
    pts = []
    widths = []
    for i in range(6):
        u = i / 5.0
        x = cx + side * (-0.5 + u * 1.05) * w
        arch = -math.sin(u * math.pi) * 9
        y = cy - up * 26 + arch - inner * 24 * (1 - u) ** 1.4 + inner * 4 * u
        pts.append((x, y))
        widths.append(t * (1.0 - 0.45 * u) * (1.0 if u > 0.02 else 0.85))
    strip_facets(ctx, pts, widths, color, seed=31 + side, spec=0.05)


def draw_mouth(ctx, cx, cy, w, f, who, skin):
    c = ctx.c
    op = clamp(f["open"], 0, 1.2)
    sm = clamp(f["smile"], -1, 1)
    tc = clamp(f["teeth"])
    hw = w * 0.5 * (1 + 0.28 * f["wide"] + 0.22 * max(sm, 0) + 0.25 * tc - 0.3 * clamp(op - 0.45) * (1 - max(sm, 0)))
    cy_c = cy - sm * 18 + max(0.0, -sm) * 4 + op * 34 * (1 - clamp(sm * 1.5)) * (1 - tc)
    top_mid = cy - 3 - op * 10 + max(sm, 0) * 2 - tc * 6
    bot_mid = cy + 5 + op * 88 + max(sm, 0) * 22 * (0.4 + op) + tc * 18
    lipc = lit_col(ctx, mix(LIPS[who], TOMATO, f["red"] * 0.4), 0.8)
    teeth = lit_mix(ctx, TEETH, 0.45)
    tongue = lit_mix(ctx, TONGUE, 0.6)
    if op < 0.04 and sm < 0.25 and tc < 0.1:
        path = skia.Path()
        path.moveTo(cx - hw, cy_c)
        path.quadTo(cx, cy + 4 - sm * 6, cx + hw, cy_c)
        c.drawPath(path, paint(mul(lipc, 0.55), 1, "stroke", 6))
        low = skia.Path()
        low.moveTo(cx - hw * 0.6, cy + 12)
        low.quadTo(cx, cy + 22, cx + hw * 0.6, cy + 12)
        c.drawPath(low, paint(mul(skin, 0.75), 0.55, "stroke", 5))
        return
    path = skia.Path()
    path.moveTo(cx - hw, cy_c)
    path.cubicTo(cx - hw * 0.55, top_mid - 2, cx + hw * 0.55, top_mid - 2, cx + hw, cy_c)
    path.cubicTo(cx + hw * 0.62, bot_mid + 2, cx - hw * 0.62, bot_mid + 2, cx - hw, cy_c)
    path.close()
    c.drawPath(path, paint(mul(skin, 0.5), 0.5, "stroke", 14, blur=6))
    c.drawPath(path, paint(MOUTH_IN))
    c.save()
    c.clipPath(path, doAntiAlias=True)
    th = 13 + 10 * max(sm, 0) + 10 * tc
    c.drawRect(skia.Rect.MakeLTRB(cx - hw, top_mid - 20, cx + hw, top_mid + th), paint(teeth))
    if tc > 0.05 or (sm > 0.5 and op < 0.5):
        lb = bot_mid - th * (0.9 + tc * 0.6)
        c.drawRect(skia.Rect.MakeLTRB(cx - hw, lb, cx + hw, bot_mid + 20), paint(teeth))
        if tc > 0.05:
            c.drawLine(cx - hw, (top_mid + bot_mid) / 2, cx + hw, (top_mid + bot_mid) / 2, paint(MOUTH_IN, 1, "stroke", 4))
            for k in range(-3, 4):
                x = cx + k * hw * 0.28
                c.drawLine(x, top_mid - 10, x, bot_mid + 10, paint(hexc("c9c2b8"), 0.8, "stroke", 2))
    if op > 0.25:
        tg = clamp((op - 0.25) / 0.5)
        c.drawOval(skia.Rect.MakeLTRB(cx - hw * 0.55, bot_mid - 26 * tg - 6, cx + hw * 0.55, bot_mid + 20),
                   paint(tongue))
        c.drawLine(cx, bot_mid - 22 * tg, cx, bot_mid, paint(mul(tongue, 0.75), 0.8, "stroke", 3))
    c.restore()
    c.drawPath(path, paint(lipc, 1, "stroke", 6.5))
    # lower lip highlight + shadow beneath
    low = skia.Path()
    low.moveTo(cx - hw * 0.5, bot_mid + 10)
    low.quadTo(cx, bot_mid + 18, cx + hw * 0.5, bot_mid + 10)
    c.drawPath(low, paint(mul(skin, 0.72), 0.55, "stroke", 6))
    # dimples / smile lines
    if sm > 0.3:
        for s in (-1, 1):
            d = skia.Path()
            d.moveTo(cx + s * (hw + 4), cy_c - 22)
            d.quadTo(cx + s * (hw + 16), cy_c, cx + s * (hw + 6), cy_c + 16)
            c.drawPath(d, paint(mul(skin, 0.66), 0.8 * sm, "stroke", 4))


# ----------------------------------------------------------------------------
# sweat system
# ----------------------------------------------------------------------------

def sweat_drops(c, t, seed, amount, region, n=7, speed=1.0):
    """Drops bead up and slide down. region=(x0, y0, x1, y1); lanes avoid the eye band in the middle."""
    if amount <= 0.02:
        return
    x0, y0, x1, y1 = region
    for i in range(n):
        period = 1.8 + rnd(i, seed) * 1.6
        off = rnd(i, seed + 5) * period
        cyc = int((t * speed + off) / period)
        u = ((t * speed + off) % period) / period
        if rnd(cyc * 13 + i, seed + 9) > 0.3 + amount * 0.55:
            continue
        lane = rnd(i * 3 + cyc, seed + 2)
        if lane < 0.35:
            x = lerp(x0, x0 + (x1 - x0) * 0.16, lane / 0.35)      # left temple
            yb = y1
        elif lane > 0.65:
            x = lerp(x1 - (x1 - x0) * 0.16, x1, (lane - 0.65) / 0.35)  # right temple
            yb = y1
        else:
            x = lerp(x0 + (x1 - x0) * 0.25, x1 - (x1 - x0) * 0.25, (lane - 0.35) / 0.3)  # forehead
            yb = y0 + (y1 - y0) * 0.22
        grow = clamp(u / 0.35)
        slide = clamp((u - 0.35) / 0.65) ** 1.8
        y = y0 + slide * (yb - y0)
        r = (7 + 5 * rnd(i, seed + 4)) * (0.5 + 0.5 * grow)
        a = clamp(amount * 1.4) * (1 - clamp((u - 0.88) / 0.12))
        draw_drop(c, x, y, r, 1.0 + slide * 0.6, a)


def draw_veins(c, pts_list, pulse, skin, amount):
    if amount <= 0.02:
        return
    w = 4.5 + 3.5 * pulse
    col = mix(mul(skin, 0.62), hexc("7a2a3a"), 0.35)
    for pts in pts_list:
        path = smooth_path(pts, close=False)
        c.drawPath(path, paint(col, 0.9 * amount, "stroke", w + 2, blur=1.5))
        c.drawPath(path, paint(mix(skin, WHITE, 0.25), 0.5 * amount, "stroke", w * 0.35))


# ----------------------------------------------------------------------------
# head
# ----------------------------------------------------------------------------

def draw_head(ctx, who, f, bust=False, t=0.0, bust_breath=0.0):
    c = ctx.c
    P = head_parts(who)
    F = FEAT[who]
    sk = skin_of(who, f)
    skl = lit_col(ctx, sk)
    turn = f["turn"]
    fx = turn * 42  # feature shift for 3/4 turns
    if bust:
        B = bust_parts(who)
        ctx.push()
        ctx.translate(0, 0)
        ctx.scale(1.0, 1.0 + bust_breath * 0.02)
        B["skin"].draw(ctx, color=sk)
        # collarbone / neck shadow
        c.drawOval(skia.Rect.MakeLTRB(-150, 160, 150, 300), paint(mul(skl, 0.4), 0.35, blur=26))
        B["tank"].draw(ctx)
        if who == "bro":
            B["pecL"].draw(ctx)
            B["pecR"].draw(ctx)
        # arm / torso separation creases + delt definition
        for s_ in (-1, 1):
            if who == "you":
                pts = [(s_ * 300, 525), (s_ * 330, 620), (s_ * 346, 760), (s_ * 352, 1000)]
                dl = [(s_ * 246, 345), (s_ * 330, 380), (s_ * 400, 470), (s_ * 420, 560)]
            else:
                pts = [(s_ * 350, 515), (s_ * 400, 610), (s_ * 420, 780), (s_ * 428, 1000)]
                dl = [(s_ * 285, 300), (s_ * 400, 350), (s_ * 490, 450), (s_ * 520, 560)]
            c.drawPath(smooth_path(pts, close=False), paint(mul(skl, 0.45), 0.55, "stroke", 9, blur=3))
            c.drawPath(smooth_path(dl, close=False), paint(mix(skl, WHITE, 0.3), 0.18, "stroke", 14, blur=6))
        # strap seams
        tank_dark = mul(TANK[who], 0.55)
        for s in (-1, 1):
            if who == "you":
                a, b = (s * 132, 290), (s * 214, 312)
            else:
                a, b = (s * 166, 242), (s * 252, 268)
            c.drawLine(a[0], a[1] + 14, b[0], b[1] + 14, paint(tank_dark, 0.45, "stroke", 3))
        # sweat sheen on shoulders
        if f["sweat"] > 0:
            for s in (-1, 1):
                x = s * (360 if who == "you" else 450)
                c.drawPath(poly_path([(x - 30 * s, 380), (x + 25 * s, 410), (x - 5 * s, 440)]),
                           paint(WHITE, 0.25 * f["sweat"]))
        ctx.pop()
    # ears (far ear hides when turned)
    for side, key in ((-1, "earL"), (1, "earR")):
        hide = clamp(turn * side * 1.5)
        if hide > 0.95:
            continue
        with ctx.at(-turn * 14 * (1 if side > 0 else 1), 0, sx=1 - 0.5 * clamp(-turn * side), sy=1):
            P[key].draw(ctx, color=sk)
            pts = P["ear_in"] if side < 0 else [(-x, y) for x, y in P["ear_in"]]
            c.drawPath(poly_path(pts), paint(mul(skl, 0.62), 0.8))
    P["head"].draw(ctx, color=sk)
    # cheek blush / redness glow
    blush = clamp(f["blush"] + f["red"] * 0.6)
    if blush > 0:
        for s in (-1, 1):
            glow_circle(c, s * 118 + fx, 52, 70, hexc("ff3b2f"), 0.35 * blush, skia.BlendMode.kSrcOver)
    if who == "you":
        P["hair"].draw(ctx)
        P["band"].draw(ctx)
        # red stripe on sweatband
        c.drawPath(smooth_path([(-200, -154), (-110, -165), (0, -168), (110, -165), (200, -154)], close=False),
                   paint(hexc("d63030"), 0.95, "stroke", 9))
    else:
        # scalp shine
        c.drawPath(poly_path([(-110, -200), (-60, -232), (-20, -238), (-70, -205)]), paint(WHITE, 0.35))
        c.drawPath(poly_path([(-138, -168), (-112, -196), (-100, -178)]), paint(WHITE, 0.25))
        c.drawPath(poly_path([(40, -236), (88, -226), (60, -218)]), paint(WHITE, 0.18))
    # forehead wrinkles when brows raised or straining
    wr = clamp(max(f["brow_up"], f["brow_in"] * 0.9, f["squeeze"] * 0.8, f["wrinkle"] * 0.6))
    if wr > 0.05:
        base_y = -118 if who == "you" else -150
        for k in range(3):
            y = base_y + k * 16
            path = skia.Path()
            path.moveTo(-70 + fx, y + 4)
            path.quadTo(fx, y - 7 - 4 * f["brow_in"], 70 + fx, y + 4)
            c.drawPath(path, paint(mul(skl, 0.62), 0.7 * wr, "stroke", 3.5))
    # veins
    pulse = 0.5 + 0.5 * math.sin(t * 2 * math.pi * 2.4)
    vy = -120 if who == "you" else -160
    draw_veins(c, [[(36 + fx, vy - 6), (48 + fx, vy + 14), (40 + fx, vy + 30), (54 + fx, vy + 42)],
                   [(48 + fx, vy + 14), (70 + fx, vy + 22)],
                   [(-150 + fx * 0.5, -96), (-160 + fx * 0.5, -60), (-150 + fx * 0.5, -30)],
                   [(150 + fx * 0.5, -96), (162 + fx * 0.5, -60), (152 + fx * 0.5, -30)]], pulse, skl, f["veins"])
    # eyes
    for side in (-1, 1):
        ex = side * F["eye_x"] + fx * (1.0 + 0.25 * side * np.sign(turn))
        draw_eye(ctx, ex, F["eye_y"], F["eye_w"] * (1 - 0.18 * clamp(-turn * side)), F["eye_h"], f, side,
                 F["iris"], skl)
    # brows
    bcol = HAIR if who == "you" else mul(BEARD, 0.8)
    for side in (-1, 1):
        extra = f["brow_l"] if side < 0 else f["brow_r"]
        draw_brow(ctx, side * F["eye_x"] + fx, F["brow_y"], side, F["brow_w"], F["brow_t"], f["brow_in"],
                  f["brow_up"] + extra, bcol, who)
    # nose
    with ctx.at(fx * 1.25, 0):
        with ctx.at(0, 0, sx=1 + 0.06 * f["flare"]):
            P["nose"].draw(ctx, color=sk)
        ny = 60 + F["nose_y"]
        nsx = (16 if who == "you" else 22) * (1 + 0.25 * f["flare"])
        for s in (-1, 1):
            c.drawOval(skia.Rect.MakeXYWH(s * nsx - 8 * (1 + f["flare"] * 0.5), ny - 5, 16 * (1 + f["flare"] * 0.5), 9),
                       paint(mul(skl, 0.3), 0.95))
        c.drawOval(skia.Rect.MakeXYWH(-36, ny + 4, 72, 18), paint(mul(skl, 0.45), 0.35, blur=6))
        if f["wrinkle"] > 0.05:
            for s in (-1, 1):
                c.drawLine(s * 8, -20, s * 26, -8, paint(mul(skl, 0.6), f["wrinkle"], "stroke", 3))
                c.drawLine(s * 10, -8, s * 28, 4, paint(mul(skl, 0.6), f["wrinkle"] * 0.8, "stroke", 3))
    if who == "bro":
        with ctx.at(fx * 0.8, 0):
            P["beard"].draw(ctx)
    draw_mouth(ctx, fx * 1.05, F["mouth_y"], F["mouth_w"], f, who, skl)
    if who == "bro":
        with ctx.at(fx * 1.05, 0):
            P["stache"].draw(ctx)
    # skin shine (sweaty highlights)
    sh = clamp(0.35 + f["sweat"] * 0.65)
    for (x, y, s) in ((-62, -112, 1.0), (52, -118, 0.8), (-128, 22, 0.8), (124, 18, 0.7), (6, 36, 0.6)):
        if who == "bro" and y > 0 and abs(x) < 100:
            continue
        x += fx * 0.8
        c.drawPath(poly_path([(x - 16 * s, y), (x + 4 * s, y - 10 * s), (x + 18 * s, y + 2), (x - 2 * s, y + 9 * s)]),
                   paint(WHITE, 0.22 * sh))
    # sweat drops sliding on face
    sweat_drops(c, t + (0 if who == "you" else 3.3), 41 if who == "you" else 43, f["sweat"],
                (-178 + fx, -122 if who == "you" else -175, 178 + fx, 120 if who == "you" else 20), n=6)
    # dripping drop (nose / chin) param: drip = phase 0..1
    if f["drip"] is not None:
        u = f["drip"]
        x = fx * 1.25
        y0 = 72 + F["nose_y"]
        if u < 0.6:
            r = 4 + 9 * (u / 0.6)
            draw_drop(c, x, y0 + r, r, 1.0 + u)
        else:
            k = (u - 0.6) / 0.4
            draw_drop(c, x, y0 + 14 + k * k * 900, 12, 1.6)


# ----------------------------------------------------------------------------
# hands
# ----------------------------------------------------------------------------
@functools.lru_cache(maxsize=None)
def hand_parts(who):
    sk = SKIN[who]
    s = 1.0 if who == "you" else 1.22
    P = {}
    fist = [(-40, -4), (40, -4), (50, 20), (52, 56), (44, 84), (0, 94), (-44, 84), (-52, 56), (-50, 20)]
    P["fist"] = Facets([(x * s, y * s) for x, y in fist], sk, seed=51, n=8, dome=0.8, jitter=0.25)
    palm = [(-38, -4), (38, -4), (48, 30), (46, 70), (-46, 70), (-50, 30)]
    P["palm"] = Facets([(x * s, y * s) for x, y in palm], sk, seed=52, n=6, dome=0.7)
    fing = capsule_pts(64, 13, 11, n_cap=4, n_side=2)
    P["finger"] = Facets([(x * s, y * s) for x, y in fing], sk, seed=53, n=3, dome=0.8)
    longf = capsule_pts(104, 15, 13, n_cap=4, n_side=3)
    P["finger_long"] = Facets([(x * s, y * s) for x, y in longf], sk, seed=55, n=4, dome=0.8)
    thumb = capsule_pts(52, 15, 12, n_cap=4, n_side=2)
    P["thumb"] = Facets([(x * s, y * s) for x, y in thumb], sk, seed=54, n=3, dome=0.8)
    P["s"] = s
    return P


def draw_hand(ctx, who, kind="fist", f_red=0.0, knuckle_white=0.0, spread=1.0):
    c = ctx.c
    P = hand_parts(who)
    s = P["s"]
    sk = mix(SKIN[who], TOMATO, f_red * 0.6)
    skl = lit_col(ctx, sk)
    if kind == "fist":
        P["fist"].draw(ctx, color=sk, outline=(mul(skl, 0.4), 2.5, 0.5))
        for k in range(4):
            x = (-30 + k * 20) * s
            c.drawLine(x, 60 * s, x + 2, 86 * s, paint(mul(skl, 0.55), 0.8, "stroke", 3))
            if knuckle_white > 0:
                c.drawOval(skia.Rect.MakeXYWH(x + 2 * s, 80 * s, 16 * s, 10 * s), paint(mix(skl, WHITE, 0.55), 0.7 * knuckle_white, blur=2))
        c.drawPath(poly_path([(-52 * s, 20 * s), (-30 * s, 30 * s), (-10 * s, 52 * s), (-40 * s, 56 * s)]),
                   paint(mul(skl, 0.8)))
    elif kind in ("open", "two"):
        if kind == "open":
            for k in range(4):
                a = (-24 + k * 16) * spread
                with ctx.at((-30 + k * 20) * s, 62 * s, rot=-a):
                    P["finger"].draw(ctx, color=sk)
            with ctx.at(-46 * s, 22 * s, rot=58 * spread):
                P["thumb"].draw(ctx, color=sk)
            P["palm"].draw(ctx, color=sk)
            c.drawPath(smooth_path([(-30 * s, 30 * s), (0, 44 * s), (28 * s, 28 * s)], close=False),
                       paint(mul(skl, 0.6), 0.6, "stroke", 3))
        else:
            # curled fist with index + middle extended along +y, drawn in front and outlined
            with ctx.at(0, 0, sx=0.9, sy=0.8):
                P["fist"].draw(ctx, color=sk, outline=(mul(skl, 0.35), 3.0, 0.7))
            for k in range(2):
                with ctx.at((-15 + k * 30) * s, 48 * s, rot=(-6 + k * 12)):
                    P["finger_long"].draw(ctx, color=mix(sk, WHITE, 0.08), outline=(mul(skl, 0.3), 3.5, 0.85))
                    c.drawLine(-6 * s, 52 * s, 6 * s, 52 * s, paint(mul(skl, 0.5), 0.8, "stroke", 2.5))
            c.drawLine(-38 * s, 40 * s, 38 * s, 40 * s, paint(mul(skl, 0.45), 0.7, "stroke", 3))


# ----------------------------------------------------------------------------
# front-view full body rig
# ----------------------------------------------------------------------------
BODY = {
    "you": dict(head_y=-1478, head_s=0.62, neck=-1330, sh_x=200, sh_y=-1258, hip_x=86, hip_y=-770, knee_y=-432,
                ankle_y=-74, ua=300, fa=270, ua_r=(56, 42), fa_r=(46, 31), delt=58, thigh_r=(74, 54),
                shin_r=(52, 33)),
    "bro": dict(head_y=-1490, head_s=0.6, neck=-1335, sh_x=282, sh_y=-1262, hip_x=100, hip_y=-780, knee_y=-440,
                ankle_y=-74, ua=305, fa=280, ua_r=(80, 60), fa_r=(62, 40), delt=98, thigh_r=(90, 64),
                shin_r=(64, 40)),
}


@functools.lru_cache(maxsize=None)
def body_parts(key):
    """key = (kind, skin hex, shirt hex, shorts hex, shoe hex, female)."""
    kind, skin_h, shirt_h, shorts_h, shoe_h, sleeve = key
    B = BODY["bro" if kind == "bro" else "you"]
    sk, shirt, shorts, shoe = hexc(skin_h), hexc(shirt_h), hexc(shorts_h), hexc(shoe_h)
    P = {}
    if kind == "bro":
        torso_r = [(0, -1405), (66, -1405), (74, -1340), (190, -1312), (300, -1286), (296, -1180), (260, -1080),
                   (200, -930), (175, -840), (168, -790), (0, -790)]
        tank_r = [(0, -1255), (60, -1270), (100, -1335), (160, -1316), (222, -1250), (240, -1150), (215, -1040),
                  (182, -920), (172, -830), (176, -790), (0, -790)]
        shorts_r = [(0, -840), (176, -840), (196, -760), (210, -560), (34, -548), (0, -640)]
    else:
        torso_r = [(0, -1400), (52, -1400), (58, -1328), (140, -1302), (214, -1278), (200, -1170), (182, -1060),
                   (152, -905), (160, -830), (152, -785), (0, -785)]
        tank_r = [(0, -1235), (52, -1250), (88, -1318), (142, -1302), (180, -1225), (182, -1130), (172, -1040),
                  (152, -905), (164, -830), (166, -785), (0, -785)]
        shorts_r = [(0, -835), (162, -835), (180, -760), (192, -566), (30, -556), (0, -640)]
        if sleeve:  # t-shirt with sleeves
            tank_r = [(0, -1262), (60, -1300), (140, -1300), (225, -1270), (262, -1150), (200, -1120),
                      (180, -1040), (152, -905), (164, -830), (166, -785), (0, -785)]
    P["torso"] = Facets(sym(torso_r), sk, seed=61, n=24, dome=0.6, jitter=0.08, center=(0, -1100),
                        radii=(300 if kind == "bro" else 220, 330))
    P["tank"] = Facets(sym(tank_r), shirt, seed=62, n=26, dome=0.62, jitter=0.09, center=(0, -1050),
                       radii=(300 if kind == "bro" else 220, 300))
    sh = sym(shorts_r)
    P["shorts"] = Facets(sh, shorts, seed=63, n=18, dome=0.55, jitter=0.1, center=(0, -700), radii=(200, 160))
    if kind == "bro":
        pec = [(8, -1230), (70, -1250), (170, -1235), (222, -1180), (200, -1110), (120, -1085), (20, -1100)]
        P["pecR"] = Facets(pec, shirt, seed=64, n=8, dome=0.9)
        P["pecL"] = Facets([(-x, y) for x, y in pec], shirt, seed=65, n=8, dome=0.9)
    ua = B["ua"]
    fa = B["fa"]
    P["ua"] = Facets(capsule_pts(ua, *B["ua_r"], n_cap=5, n_side=4), sk, seed=66, n=10, dome=0.8)
    P["fa"] = Facets(capsule_pts(fa, *B["fa_r"], bulge=0.25, bulge_pos=0.25, n_cap=5, n_side=4), sk, seed=67, n=10,
                     dome=0.8)
    r0 = B["ua_r"][0]
    P["bicep"] = Facets(circle_pts(r0 * 0.78, 12, 5, 0.06, sy=1.35), sk, seed=68, n=8, dome=1.0)
    P["delt"] = Facets(circle_pts(B["delt"], 12, 6, 0.05, sy=1.05), sk, seed=69, n=10, dome=0.9)
    if sleeve:
        P["sleeve"] = Facets(capsule_pts(110, r0 * 1.16, r0 * 1.1, n_cap=5, n_side=2), shirt, seed=70, n=8, dome=0.8)
    P["thigh"] = Facets(capsule_pts(B["knee_y"] - B["hip_y"] + 20, *B["thigh_r"], n_cap=5, n_side=3), sk, seed=71,
                        n=8, dome=0.8)
    P["shin"] = Facets(capsule_pts(B["ankle_y"] - B["knee_y"], *B["shin_r"], bulge=0.22, bulge_pos=0.3, n_cap=5,
                                   n_side=4), sk, seed=72, n=8, dome=0.8)
    shoe_pts = [(-52, -10), (-40, -44), (-20, -56), (24, -56), (46, -44), (62, -6), (70, 26), (60, 44), (-62, 44),
                (-70, 22)]
    P["shoe"] = Facets(shoe_pts, shoe, seed=73, n=8, dome=0.7, spec=0.1)
    return P


POSE = dict(arms=((8, 10, "fist"), (8, 10, "fist")), lean=0.0, bob=0.0, breath=0.0, bulge=0.0, stance=0.0,
            head_dx=0.0, head_rot=0.0, squash=1.0, vein=0.0, hide_legs=False, red=0.0, knees=(0.0, 0.0),
            legs=None)


def pose(**kw):
    p = dict(POSE)
    p.update(kw)
    return p


def bone_dir(a_deg, s):
    a = math.radians(a_deg)
    return np.array([s * math.sin(a), math.cos(a)])


def draw_arm(ctx, P, B, who, s, a, b, hand, bulge, red, vein, t, skin, arm_scale=1.0, hand_open=1.0, sleeve=None):
    c = ctx.c
    shx, shy = s * B["sh_x"], B["sh_y"] + 18
    ua, fa = B["ua"] * arm_scale, B["fa"] * arm_scale
    d1 = bone_dir(a, s)
    elbow = np.array([shx, shy]) + d1 * ua
    d2 = bone_dir(a + b, s)
    wrist = elbow + d2 * fa
    with ctx.at(shx, shy, rot=-s * a, sy=arm_scale):
        P["ua"].draw(ctx, color=skin)
        bx = s * B["ua_r"][0] * 0.32
        k = 0.82 + 0.75 * bulge
        with ctx.at(bx, B["ua"] * 0.48, sx=k * 1.05, sy=k):
            P["bicep"].draw(ctx, color=skin)
            if bulge > 0.2:
                c.drawPath(poly_path([(-10, -40), (8, -48), (14, -30)]), paint(WHITE, 0.3 * bulge))
        if vein > 0.05:
            pulse = 0.5 + 0.5 * math.sin(t * 2 * math.pi * 2.2)
            draw_veins(c, [[(bx * 0.6, 60), (bx * 0.9, 130), (bx * 0.4, 200), (bx * 0.7, 270)]], pulse, lit_col(ctx, skin), vein)
        if sleeve is not None:
            with ctx.at(0, -B["ua_r"][0] * 0.6):
                sleeve.draw(ctx)
    with ctx.at(elbow[0], elbow[1], rot=-s * (a + b), sy=arm_scale):
        P["fa"].draw(ctx, color=skin)
        if vein > 0.05:
            pulse = 0.5 + 0.5 * math.sin(t * 2 * math.pi * 2.2 + 1)
            draw_veins(c, [[(0, 40), (-s * 10, 120), (s * 6, 200)]], pulse, lit_col(ctx, skin), vein * 0.8)
        with ctx.at(0, B["fa"] - 6, sx=s * -1 if hand == "open" else 1):
            draw_hand(ctx, "bro" if who == "bro" else "you", hand, red, spread=hand_open)
    return elbow, wrist


def draw_body_front(ctx, look, ps, fc, t=0.0, head_override=None):
    """look: dict(kind, skin, shirt, shorts, shoe, hair, beard, band, female, sleeve)."""
    c = ctx.c
    kind = look.get("kind", "you")
    who = "bro" if kind == "bro" else "you"
    B = BODY[who]
    key = (kind, look.get("skin", "e2a477"), look.get("shirt", "8f959d"), look.get("shorts", "1c1c22"),
           look.get("shoe", "f4f4f4"), bool(look.get("sleeve", False)))
    P = body_parts(key)
    skin = mix(hexc(key[1]), TOMATO, ps["red"] * 0.85)
    st = ps["stance"]
    # legs
    if not ps["hide_legs"]:
        for s in (-1, 1):
            hx = s * B["hip_x"]
            kx = s * (B["hip_x"] + 8 + st * 0.6)
            kn = ps["knees"][0 if s < 0 else 1]
            ky = B["knee_y"] + kn
            ax = s * (B["hip_x"] + 14 + st)
            ay = B["ankle_y"]
            ang_t = math.degrees(math.atan2(kx - hx, ky - B["hip_y"]))
            with ctx.at(hx, B["hip_y"] - 10, rot=-ang_t):
                P["thigh"].draw(ctx, color=skin)
            ang_s = math.degrees(math.atan2(ax - kx, ay - ky))
            L = math.hypot(ax - kx, ay - ky)
            with ctx.at(kx, ky, rot=-ang_s, sy=L / (B["ankle_y"] - B["knee_y"])):
                P["shin"].draw(ctx, color=skin)
            # sock
            c.drawRect(skia.Rect.MakeLTRB(ax - 34, ay - 40, ax + 34, ay + 4), paint(hexc("f2f2f2")))
            c.drawLine(ax - 34, ay - 30, ax + 34, ay - 30, paint(hexc("d63030"), 0.9, "stroke", 5))
            with ctx.at(ax + s * 6, ay + 30, sx=s):
                P["shoe"].draw(ctx)
                c.drawRect(skia.Rect.MakeLTRB(-66, 30, 66, 44), paint(hexc("9a9aa2")))
                c.drawLine(-20, -40, 22, -40, paint(hexc("777777"), 0.8, "stroke", 3))
                c.drawLine(-22, -28, 26, -28, paint(hexc("777777"), 0.8, "stroke", 3))
    # torso block with breathing / squash
    with ctx.at(0, B["hip_y"], sx=1.0 + ps["breath"] * 0.01, sy=ps["squash"] * (1.0 + ps["breath"] * 0.012)):
        ctx.translate(0, -B["hip_y"])
        P["shorts"].draw(ctx)
        c.drawLine(0, -700, 0, -620, paint((0, 0, 0), 0.5, "stroke", 3))
        c.drawRect(skia.Rect.MakeLTRB(-170 if who == "you" else -184, -842, 170 if who == "you" else 184, -812),
                   paint(mul(hexc(key[3]), 0.7)))
        with ctx.at(ps["lean"] * 0.2, 0):
            P["torso"].draw(ctx, color=skin)
            P["tank"].draw(ctx)
            if who == "bro":
                P["pecL"].draw(ctx)
                P["pecR"].draw(ctx)
            arms = ps["arms"]
            # arms behind? draw delts + arms on top
            for idx, s in ((0, -1), (1, 1)):
                a, b, hand = arms[idx][:3]
                extra = arms[idx][3] if len(arms[idx]) > 3 else {}
                draw_arm(ctx, P, B, who, s, a, b, hand, ps["bulge"] * extra.get("bulge", 1.0), ps["red"], ps["vein"], t,
                         skin, hand_open=extra.get("spread", 1.0), sleeve=P.get("sleeve"))
                if "sleeve" not in P:
                    with ctx.at(s * B["sh_x"], B["sh_y"] + 10):
                        P["delt"].draw(ctx, color=skin)
            # head
            with ctx.at(ps["head_dx"], B["head_y"] + ps["bob"], rot=ps["head_rot"], sx=B["head_s"]):
                hl = look.get("hair", None)
                draw_generic_head(ctx, who, look, fc, t)


# ----------------------------------------------------------------------------
# generic heads for extras (reuses the hero head with hair variations)
# ----------------------------------------------------------------------------
@functools.lru_cache(maxsize=None)
def extra_hair(style, color_h):
    col = hexc(color_h)
    if style == "short":
        pts = [(178, -60), (196, -70), (198, -130), (180, -186), (136, -232), (70, -258), (0, -266), (-70, -258),
               (-136, -232), (-180, -186), (-198, -130), (-196, -70), (-178, -60), (-160, -150), (-90, -170),
               (0, -176), (90, -170), (160, -150)]
        pts = [pts[0]] + zigzag(pts[1:12], 8, seed=3, closed=False) + pts[12:]
    elif style == "ponytail":
        pts = [(182, -40), (198, -80), (200, -140), (182, -196), (136, -240), (70, -264), (0, -272), (-70, -264),
               (-136, -240), (-182, -196), (-200, -140), (-198, -80), (-182, -40), (-168, -120), (-120, -160),
               (-40, -178), (40, -182), (110, -168), (166, -126)]
    elif style == "afro":
        pts = circle_pts(270, 22, 4, 0.08, cx=0, cy=-150, sy=0.86)
        pts = [p for p in pts]
    elif style == "cap":
        pts = [(205, -110), (200, -170), (160, -228), (80, -262), (0, -270), (-80, -262), (-160, -228), (-200, -170),
               (-205, -110), (-230, -96), (-110, -120), (0, -126), (110, -120), (230, -96)]
    elif style == "bun":
        pts = [(182, -60), (198, -100), (196, -160), (170, -214), (120, -250), (60, -270), (0, -276), (-60, -270),
               (-120, -250), (-170, -214), (-196, -160), (-198, -100), (-182, -60), (-160, -140), (-80, -170),
               (0, -178), (80, -170), (160, -140)]
    else:
        return None
    return Facets(pts, col, seed=hash(style) % 97, n=20, dome=0.7, jitter=0.25, spec=0.2, shine=14)


def draw_generic_head(ctx, who, look, fc, t):
    c = ctx.c
    hair = look.get("hair", "band" if who == "you" else "bald")
    if look.get("kind") in ("you", "bro"):
        draw_head(ctx, who, fc, bust=False, t=t)
        return
    # extras: use "you" head geometry, recolored skin, custom hair
    sk = hexc(look.get("skin", "e2a477"))
    P = head_parts("you")
    hcol = look.get("hair_color", "2a1f18")
    if hair == "ponytail":
        with ctx.at(150, -150, rot=-30):
            Facets_tail = _tail(hcol)
            Facets_tail.draw(ctx)
    if hair == "afro":
        extra_hair("afro", hcol).draw(ctx)
    if hair == "bun":
        c.drawCircle(0, -300, 70, paint(mul(hexc(hcol), 0.9)))
    f = dict(fc)
    draw_head_custom(ctx, sk, f, t, hair, hcol, look)


@functools.lru_cache(maxsize=None)
def _tail(hcol):
    pts = [(-30, 0), (30, 0), (50, 90), (40, 200), (10, 280), (-20, 250), (-40, 150), (-46, 60)]
    return Facets(pts, hexc(hcol), seed=81, n=8, dome=0.8, spec=0.2)


@functools.lru_cache(maxsize=None)
def _head_custom_mesh(skin_h):
    return Facets(sym(HEAD_R["you"]), hexc(skin_h), seed=13, n=30, dome=0.9, jitter=0.16, spec=0.06)


def draw_head_custom(ctx, sk, f, t, hair, hcol, look):
    """Simplified hero head drawing for extras (same face system)."""
    c = ctx.c
    F = FEAT["you"]
    turn = f["turn"]
    fx = turn * 42
    skin_h = look.get("skin", "e2a477")
    P = head_parts("you")
    for side, key in ((-1, "earL"), (1, "earR")):
        if clamp(turn * side * 1.5) > 0.95:
            continue
        P[key].draw(ctx, color=sk)
    _head_custom_mesh(skin_h).draw(ctx)
    hm = extra_hair(hair, hcol) if hair not in ("afro", "bald", None) else None
    if hm is not None:
        hm.draw(ctx)
    if hair == "cap":
        c.drawPath(poly_path([(-220, -100), (220, -100), (250, -78), (-250, -78)]), paint(mul(hexc(hcol), 0.7)))
    for side in (-1, 1):
        draw_eye(ctx, side * F["eye_x"] + fx, F["eye_y"], F["eye_w"], F["eye_h"], f, side, (0.3, 0.2, 0.12), sk)
        draw_brow(ctx, side * F["eye_x"] + fx, F["brow_y"], side, F["brow_w"], F["brow_t"] * 0.85, f["brow_in"],
                  f["brow_up"], mul(hexc(hcol), 0.9), "you")
    with ctx.at(fx * 1.25, 0):
        P["nose"].draw(ctx, color=sk)
        for s in (-1, 1):
            c.drawOval(skia.Rect.MakeXYWH(s * 16 - 8, 55, 16, 9), paint(mul(sk, 0.3), 0.95))
    if look.get("beard"):
        with ctx.at(fx * 0.8, 0):
            head_parts("bro")["beard"].draw(ctx, color=hexc(hcol))
    draw_mouth(ctx, fx * 1.05, F["mouth_y"], F["mouth_w"], f, "you", sk)


# ----------------------------------------------------------------------------
# side-view runner (for people sprinting out)
# ----------------------------------------------------------------------------
@functools.lru_cache(maxsize=None)
def side_parts(skin_h, shirt_h, shorts_h, hair_h, hair_style, big):
    sk, shirt, shorts, hair = hexc(skin_h), hexc(shirt_h), hexc(shorts_h), hexc(hair_h)
    k = 1.25 if big else 1.0
    P = {}
    P["torso"] = Facets([(x * k, y) for x, y in capsule_pts(330, 95, 82, n_cap=6, n_side=4)], shirt, seed=91, n=12,
                        dome=0.7)
    P["hips"] = Facets([(x * k, y) for x, y in capsule_pts(110, 86, 80, n_cap=5, n_side=2)], shorts, seed=92, n=6,
                       dome=0.6)
    P["ua"] = Facets(capsule_pts(200, 36 * k, 30 * k, n_cap=4, n_side=2), sk, seed=93, n=4, dome=0.8)
    P["fa"] = Facets(capsule_pts(190, 30 * k, 24 * k, n_cap=4, n_side=2), sk, seed=94, n=4, dome=0.8)
    P["thigh"] = Facets(capsule_pts(250, 50 * k, 38 * k, n_cap=4, n_side=2), sk, seed=95, n=5, dome=0.8)
    P["shin"] = Facets(capsule_pts(240, 36 * k, 26 * k, n_cap=4, n_side=2), sk, seed=96, n=5, dome=0.8)
    P["short_leg"] = Facets(capsule_pts(120, 58 * k, 50 * k, n_cap=4, n_side=2), shorts, seed=97, n=5, dome=0.7)
    head = [(0, -120), (60, -112), (100, -78), (112, -30), (126, 0), (110, 14), (108, 50), (90, 92), (50, 118),
            (0, 122), (-60, 108), (-100, 70), (-112, 10), (-104, -60), (-66, -106)]
    P["head"] = Facets(head, sk, seed=98, n=12, dome=0.85)
    if hair_style == "bald":
        P["hair"] = None
    else:
        hp = [(-118, 20), (-122, -50), (-96, -104), (-40, -132), (30, -134), (84, -112), (110, -70), (60, -84),
              (10, -78), (-40, -60), (-70, -20), (-90, 26)]
        if hair_style == "ponytail":
            hp = hp[:-1] + [(-130, -10), (-190, 60), (-160, 90), (-100, 40)]
        P["hair"] = Facets(hp, hair, seed=99, n=8, dome=0.7, spec=0.2)
    shoe = [(-30, -20), (60, -20), (96, 0), (96, 24), (-36, 24)]
    P["shoe"] = Facets(shoe, hexc("f2f2f2"), seed=100, n=4, dome=0.6)
    return P


def limb(ctx, mesh, p0, p1, L0, **kw):
    d = np.array(p1, float) - np.array(p0, float)
    L = float(np.hypot(*d)) + 1e-6
    ang = math.degrees(math.atan2(-d[0], d[1]))
    with ctx.at(p0[0], p0[1], rot=ang, sx=1.0, sy=L / L0):
        mesh.draw(ctx, **kw)


def fk(p, ang_deg, L):
    a = math.radians(ang_deg)  # 0 = straight down, positive = forward (+x)
    return (p[0] + math.sin(a) * L, p[1] + math.cos(a) * L)


def draw_runner(ctx, look, phase, t, horror=1.0, hold_nose=True, big=False, lean=16.0):
    """Side view figure facing +x, origin at ground. phase in radians."""
    c = ctx.c
    P = side_parts(look.get("skin", "e2a477"), look.get("shirt", "3b7dd8"), look.get("shorts", "1c1c22"),
                   look.get("hair_color", "2a1f18"), look.get("hair", "short"), big)
    sk = hexc(look.get("skin", "e2a477"))
    bob = 26 * abs(math.cos(phase))
    hip = (0.0, -575 + bob)
    la = math.radians(lean)
    shoulder = (hip[0] + math.sin(la) * 300, hip[1] - math.cos(la) * 300)
    head = (hip[0] + math.sin(la) * 450 + 10, hip[1] - math.cos(la) * 450)
    dark = ((0, 0, 0), 0.28)

    def leg(ph, back):
        th = 42 * math.sin(ph)
        kn = 15 + 85 * max(0.0, math.sin(ph - 1.2)) ** 1.3
        knee = fk(hip, th, 250)
        ankle = fk(knee, th - kn, 240)
        tint = dark if back else None
        limb(ctx, P["short_leg"], hip, fk(hip, th, 120), 120, tint=tint)
        limb(ctx, P["thigh"], hip, knee, 250, color=sk, tint=tint)
        limb(ctx, P["shin"], knee, ankle, 240, color=sk, tint=tint)
        with ctx.at(ankle[0] - 10, ankle[1] + 4, rot=-0.5 * (th - kn) * 0.6):
            P["shoe"].draw(ctx, tint=tint)

    def arm(ph, back, nose=False):
        tint = dark if back else None
        if nose:
            elbow = (shoulder[0] + 175, shoulder[1] + 40)
            hand = (head[0] + 105, head[1] + 18)
            limb(ctx, P["ua"], shoulder, elbow, 200, color=sk, tint=tint)
            limb(ctx, P["fa"], elbow, hand, 190, color=sk, tint=tint)
            c.drawCircle(hand[0], hand[1], 30, paint(mul(sk, 0.92)))
            return
        sw = 55 * math.sin(ph)
        elbow = fk(shoulder, sw, 200)
        hand = fk(elbow, sw + 85, 190)
        limb(ctx, P["ua"], shoulder, elbow, 200, color=sk, tint=tint)
        limb(ctx, P["fa"], elbow, hand, 190, color=sk, tint=tint)
        c.drawCircle(hand[0], hand[1], 26, paint(mul(sk, 0.8 if back else 0.95)))

    arm(phase, True)
    leg(phase + math.pi, True)
    limb(ctx, P["torso"], shoulder, hip, 330)
    with ctx.at(hip[0], hip[1] - 20, rot=lean):
        P["hips"].draw(ctx)
    leg(phase, False)
    with ctx.at(head[0], head[1], rot=6 * math.sin(phase * 2)):
        P["head"].draw(ctx, color=sk)
        if P["hair"] is not None:
            P["hair"].draw(ctx)
        c.drawOval(skia.Rect.MakeXYWH(48, -44, 38, 48), paint(SCLERA))
        c.drawCircle(74, -18, 8, paint(DARK))
        c.drawLine(40, -68, 94, -58 - 16 * horror, paint(DARK, 1, "stroke", 10))
        c.drawOval(skia.Rect.MakeXYWH(76, 46, 32, 40 * horror + 6), paint(MOUTH_IN))
        c.drawOval(skia.Rect.MakeXYWH(-34, -12, 36, 52), paint(mul(sk, 0.75)))
    arm(phase + math.pi, False, nose=hold_nose)
