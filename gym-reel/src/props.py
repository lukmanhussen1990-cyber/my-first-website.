"""Environment + props + FX, all low-poly vector."""
import math
import functools

import numpy as np
import skia

from engine import (W, H, Facets, Light, paint, poly_path, smooth_path, strip_facets, capsule_pts, circle_pts,
                    hexc, mix, mul, clamp, lerp, seg, smooth, ease_out, ease_io, rnd, noise1, glow_circle,
                    light_cone, argb, unit_blob, lin_grad_rect, radial_fill, draw_words)

CHARCOAL = hexc("2a2c32")
FLOOR = hexc("26272b")
RED = hexc("c9252a")
BLACKEQ = hexc("1d1d22")
CHROME = hexc("c9ced6")
GREEN = hexc("74ff2e")
GREEN_D = hexc("2fae1f")
GREEN_L = hexc("dcff7a")
WARM = hexc("ffd9a0")

# ----------------------------------------------------------------------------
# cached big meshes
# ----------------------------------------------------------------------------

@functools.lru_cache(maxsize=None)
def rect_mesh(w, h, color_h, seed=0, n=12, dome=0.25, jitter=0.12, spec=0.0):
    return Facets([(0, 0), (w, 0), (w, h), (0, h)], hexc(color_h), seed=seed, n=n, dome=dome, jitter=jitter, spec=spec,
                  rim=0.0)


@functools.lru_cache(maxsize=None)
def poly_mesh(pts, color_h, seed=0, n=8, dome=0.6, jitter=0.1, spec=0.0):
    return Facets(list(pts), hexc(color_h), seed=seed, n=n, dome=dome, jitter=jitter, spec=spec)


@functools.lru_cache(maxsize=None)
def hex_mesh(r, color_h, seed=0):
    pts = [(math.cos(math.pi / 3 * i + math.pi / 6) * r, math.sin(math.pi / 3 * i + math.pi / 6) * r) for i in range(6)]
    return Facets(pts, hexc(color_h), seed=seed, n=4, dome=0.9, jitter=0.15, spec=0.15)


# ----------------------------------------------------------------------------
# gym (front view) - world coords match the 1080x1920 frame at zoom 1
# ----------------------------------------------------------------------------
WALL_BOTTOM = 880


def draw_gym_back(ctx, t, fog=0.0, shock=None, lights_on=1.0, logo=True):
    """Back wall, mirror, ceiling lamps, racks. shock: (t0, x0) for jumping weights."""
    c = ctx.c
    # wall
    rect_mesh(2600, 1500, "2c2e35", seed=1, n=26, dome=0.15, jitter=0.1).draw(ctx) if False else None
    with ctx.at(-760, -620):
        rect_mesh(2600, 1500, "2c2e35", seed=1, n=26, dome=0.15, jitter=0.1).draw(ctx)
    # red stripe band with logo
    with ctx.at(-760, 210):
        rect_mesh(2600, 54, "b81f24", seed=2, n=20, dome=0.2, jitter=0.1).draw(ctx)
    # ceiling beams
    for x in range(-700, 1900, 260):
        c.drawRect(skia.Rect.MakeXYWH(x, -620, 26, 560), paint(hexc("1d1e22"), 0.9))
    c.drawRect(skia.Rect.MakeLTRB(-760, -80, 1840, -50), paint(hexc("1a1b1f")))
    # mirror
    mx0, my0, mx1, my1 = 90, 300, 990, 790
    c.drawRect(skia.Rect.MakeLTRB(mx0 - 16, my0 - 16, mx1 + 16, my1 + 10), paint(hexc("15161a")))
    lin_grad_rect(c, (mx0, my0, mx1, my1), (mx0, my0), (mx1, my1),
                  [(hexc("4a5562"), 1), (hexc("2a313a"), 1), (hexc("3c4652"), 1)], [0, 0.55, 1])
    # mirror reflections: soft lamp spots + diagonal streaks
    c.save()
    c.clipRect(skia.Rect.MakeLTRB(mx0, my0, mx1, my1))
    for lx in (200, 540, 880):
        glow_circle(c, lx, my0 + 40, 140, WARM, 0.25 * lights_on)
    for k, x in enumerate((180, 420, 700, 900)):
        c.drawPath(poly_path([(x, my0), (x + 60, my0), (x - 120, my1), (x - 180, my1)]), paint((1, 1, 1), 0.05 + 0.03 * (k % 2)))
    if fog > 0:
        lin_grad_rect(c, (mx0, my0, mx1, my1), (0, my1), (0, my0), [(GREEN, 0.75 * fog), (GREEN_D, 0.45 * fog)])
        for k in range(10):
            x = mx0 + rnd(k, 3) * (mx1 - mx0)
            y = my0 + rnd(k, 4) * (my1 - my0)
            glow_circle(c, x, y, 90 + 60 * rnd(k, 5), GREEN_L, 0.3 * fog)
    c.restore()
    # logo on stripe
    if logo:
        draw_words(c, [("STAG'S GYM", hexc("f3f3f3"))], 540, 237, 40, outline=0.08, shadow=False)
    # dumbbell rack (two tiers)
    rack_y = 790
    c.drawRect(skia.Rect.MakeLTRB(60, rack_y - 10, 1020, rack_y + 8), paint(hexc("17181c")))
    c.drawRect(skia.Rect.MakeLTRB(40, rack_y + 60, 1040, rack_y + 78), paint(hexc("17181c")))
    for x in (70, 1010):
        c.drawRect(skia.Rect.MakeLTRB(x - 9, rack_y - 20, x + 9, WALL_BOTTOM), paint(hexc("121316")))
    for tier, ty in enumerate((rack_y - 34, rack_y + 36)):
        for k in range(9):
            x = 120 + k * 104 + tier * 20
            jump, rot = 0.0, 0.0
            if shock is not None:
                st, sx = shock
                arrive = st + abs(x - sx) / 2600.0 + tier * 0.03
                u = t - arrive
                if u > 0:
                    jump = -abs(math.sin(min(u, 0.9) * 7.0)) * 120 * math.exp(-u * 2.2) - (0 if u < 0.9 else 0)
                    rot = math.sin(u * 9 + k) * 40 * math.exp(-u * 1.8)
            draw_dumbbell(ctx, x, ty + jump, 30 + tier * 4, RED if (k + tier) % 2 == 0 else BLACKEQ, rot, k)
    # plate tree left
    for side, px in ((-1, -40), (1, 1120)):
        c.drawRect(skia.Rect.MakeLTRB(px - 10, 520, px + 10, WALL_BOTTOM), paint(hexc("15161a")))


def draw_dumbbell(ctx, x, y, r, col, rot=0.0, seed=0):
    c = ctx.c
    with ctx.at(x, y, rot=rot):
        c.drawRect(skia.Rect.MakeLTRB(-r * 1.2, -6, r * 1.2, 6), paint(CHROME))
        for s in (-1, 1):
            with ctx.at(s * r * 1.15, 0):
                hex_mesh(r * 0.62, "%02x%02x%02x" % tuple(int(v * 255) for v in col), seed % 5).draw(ctx)


def draw_lamps(ctx, t, on=1.0, xs=(200, 540, 880), y=60, cone=True, flicker=0.0):
    c = ctx.c
    for i, x in enumerate(xs):
        c.drawLine(x, -700, x, y - 30, paint(hexc("111214"), 1, "stroke", 5))
        shade = [(x - 70, y + 20), (x - 40, y - 34), (x + 40, y - 34), (x + 70, y + 20)]
        poly_mesh(tuple(shade), "202126", seed=i, n=4, dome=0.5, spec=0.2).draw(ctx)
        if on > 0:
            if cone:
                light_cone(c, (x, y + 18), 90, 1500, 46, WARM, 0.16 * on, blur=30)
            glow_circle(c, x, y + 22, 160, WARM, 0.55 * on)
            c.drawOval(skia.Rect.MakeLTRB(x - 54, y + 12, x + 54, y + 32), paint(mix(WARM, (1, 1, 1), 0.6), on))


def draw_floor(ctx, t, y0=WALL_BOTTOM, vp=(540, 420), lights_on=1.0, x0=-900, x1=1980, y1=2600):
    c = ctx.c
    lin_grad_rect(c, (x0, y0, x1, y1), (0, y0), (0, y1), [(hexc("2e2f35"), 1), (hexc("1d1e22"), 1)])
    # perspective tile lines
    p = paint(hexc("15161a"), 0.7, "stroke", 3)
    for k in range(-14, 16):
        bx = 540 + k * 150
        tx = vp[0] + (bx - vp[0]) * (y0 - vp[1]) / (y1 - vp[1])
        c.drawLine(tx, y0, bx + (bx - vp[0]) * 0.0, y1, p)
    yy = y0
    step = 26
    while yy < y1:
        c.drawLine(x0, yy, x1, yy, p)
        step *= 1.32
        yy += step
    # light pools
    for lx in (200, 540, 880):
        c.save()
        c.translate(lx, 1300)
        c.scale(1.0, 0.32)
        glow_circle(c, 0, 0, 520, WARM, 0.16 * lights_on)
        c.restore()


# ----------------------------------------------------------------------------
# bench + barbell (front view)
# ----------------------------------------------------------------------------

def draw_bench_back(ctx):
    c = ctx.c
    # uprights
    for s in (-1, 1):
        x = 540 + s * 292
        c.drawRect(skia.Rect.MakeLTRB(x - 16, 700, x + 16, 1130), paint(hexc("17171b")))
        c.drawRect(skia.Rect.MakeLTRB(x - 16, 700, x - 8, 1130), paint(hexc("3a3b42")))
        c.drawRect(skia.Rect.MakeLTRB(x - 30, 1120, x + 30, 1140), paint(hexc("101013")))
        # J hook
        c.drawPath(poly_path([(x - 6 * s, 790), (x + 40 * s, 790), (x + 40 * s, 760), (x + 52 * s, 760),
                              (x + 52 * s, 806), (x - 6 * s, 806)]), paint(hexc("b8bcc4")))
    # pad far end + frame
    c.drawRect(skia.Rect.MakeLTRB(500, 1000, 580, 1130), paint(hexc("111114")))
    poly_mesh(((468, 980), (612, 980), (626, 1030), (454, 1030)), "b5222a", seed=3, n=4, dome=0.4, spec=0.15).draw(ctx)


def draw_bench_front(ctx):
    c = ctx.c
    # only the pad's end face shows under the hips (the body covers the top)
    poly_mesh(((432, 1478), (648, 1478), (652, 1530), (428, 1530)), "a51e26", seed=4, n=4, dome=0.4,
              spec=0.2).draw(ctx)
    c.drawRect(skia.Rect.MakeLTRB(428, 1478, 652, 1486), paint((1, 1, 1), 0.15))
    # front leg
    c.drawRect(skia.Rect.MakeLTRB(522, 1530, 558, 1710), paint(hexc("17171b")))
    c.drawRect(skia.Rect.MakeLTRB(420, 1700, 660, 1726), paint(hexc("121215")))
    c.drawRect(skia.Rect.MakeLTRB(522, 1530, 530, 1710), paint(hexc("3a3b42")))


def bar_curve(x, cx=540.0, y=860.0, bend=0.0, hands=230.0):
    dx = abs(x - cx)
    if dx <= hands:
        return y - bend * 6 * (1 - (dx / hands) ** 2)
    u = (dx - hands) / 300.0
    return y + bend * 120 * u * u * (1 + 0.4 * u)


def draw_barbell(ctx, t, bend=0.0, y=860.0, tremble=0.0, plates=5, cx=540.0, extra_y=None):
    c = ctx.c
    tr = tremble * math.sin(t * 2 * math.pi * 11) * 3
    xs = np.linspace(cx - 620, cx + 620, 33)
    pts = [(x, bar_curve(x, cx, y, bend) + tr) for x in xs]
    strip_facets(ctx, pts, 20, CHROME, seed=5, spec=0.9, shine=12)
    c.drawPath(smooth_path(pts, close=False), paint((1, 1, 1), 0.55, "stroke", 3))
    # knurl marks
    for k in range(-6, 7):
        x = cx + k * 22
        yy = bar_curve(x, cx, y, bend) + tr
        c.drawLine(x, yy - 7, x + 8, yy + 7, paint(hexc("7d828a"), 0.35, "stroke", 2))
    # plates both sides (3/4 view discs: rim band + inner face, stacked outward)
    sizes = [185, 185, 185, 165, 145, 125][:plates]
    for s in (-1, 1):
        x = cx + s * 350
        slots = []
        for i, rr in enumerate(sizes):
            th = 30 if rr >= 160 else 26
            slots.append((x + s * th / 2, rr, th, i))
            x += s * (th + 6)
        for px, rr, th, i in reversed(slots):
            py = bar_curve(px, cx, y, bend) + tr
            dx = 3.0
            ang = math.degrees(math.atan2(bar_curve(px + dx, cx, y, bend) - bar_curve(px - dx, cx, y, bend), 2 * dx))
            col = "c62428" if i % 2 == 0 else "232329"
            with ctx.at(px, py, rot=ang):
                plate_side_mesh(th, rr, mul_hex(col, 0.7)).draw(ctx)
                with ctx.at(-s * th / 2, 0):
                    plate_face_mesh(rr, col).draw(ctx)
                    c.drawOval(skia.Rect.MakeLTRB(-rr * 0.2, -rr * 0.82, rr * 0.2, rr * 0.82),
                               paint((0, 0, 0), 0.25, "stroke", 5))
                    c.drawOval(skia.Rect.MakeLTRB(-rr * 0.07, -rr * 0.22, rr * 0.07, rr * 0.22), paint(CHROME))
                    c.drawOval(skia.Rect.MakeLTRB(-rr * 0.07, -rr * 0.22, rr * 0.0, rr * 0.22), paint((1, 1, 1), 0.5))
                    c.drawOval(skia.Rect.MakeLTRB(-rr * 0.25, -rr, rr * 0.25, rr), paint((1, 1, 1), 0.12, "stroke", 3))
        # collar
        px = x + s * 10
        py = bar_curve(px, cx, y, bend) + tr
        with ctx.at(px, py):
            c.drawRect(skia.Rect.MakeLTRB(-12, -26, 12, 26), paint(CHROME))
            c.drawRect(skia.Rect.MakeLTRB(-12, -26, -4, 26), paint((1, 1, 1), 0.5))


def mul_hex(h, k):
    r, g, b = hexc(h)
    return "%02x%02x%02x" % (int(r * k * 255), int(g * k * 255), int(b * k * 255))


@functools.lru_cache(maxsize=None)
def plate_face_mesh(rr, col):
    return Facets(circle_pts(rr, 18, int(rr), 0.0, sx=0.25), hexc(col), seed=int(rr) + 3, n=8, dome=0.6, jitter=0.1,
                  spec=0.3, shine=16)


@functools.lru_cache(maxsize=None)
def plate_side_mesh(th, rr, col):
    pts = [(-th / 2, -rr + 10), (-th / 2 + 6, -rr), (th / 2 - 6, -rr), (th / 2, -rr + 10), (th / 2, rr - 10),
           (th / 2 - 6, rr), (-th / 2 + 6, rr), (-th / 2, rr - 10)]
    return Facets(pts, hexc(col), seed=int(rr + th), n=6, dome=0.7, jitter=0.12, spec=0.25, center=(0, 0),
                  radii=(th / 2, rr))


# ----------------------------------------------------------------------------
# water bottle
# ----------------------------------------------------------------------------

def draw_bottle(ctx, x, y, s, t, shake=0.0):
    c = ctx.c
    jig = shake * math.sin(t * 2 * math.pi * 9.5)
    with ctx.at(x, y, rot=jig * 5, sx=s):
        body = ((-80, -380), (80, -380), (96, -320), (96, 0), (-96, 0), (-96, -320))
        poly_mesh(body, "2b7bd6", seed=7, n=10, dome=0.8, spec=0.5).draw(ctx, alpha=0.85)
        # water inside with sloshing surface
        lvl = -200 + jig * 10
        path = poly_path([(-88, lvl - jig * 20), (88, lvl + jig * 20), (88, -8), (-88, -8)])
        c.drawPath(path, paint(hexc("8fd4ff"), 0.55))
        c.drawLine(-88, lvl - jig * 20, 88, lvl + jig * 20, paint((1, 1, 1), 0.7, "stroke", 4))
        # rings
        for yy in (-300, -120):
            c.drawRect(skia.Rect.MakeLTRB(-96, yy, 96, yy + 10), paint(hexc("1d5aa3")))
        c.drawRoundRect(skia.Rect.MakeLTRB(-62, -470, 62, -372), 14, 14, paint(hexc("1b1b22")))
        for xx in range(-50, 60, 16):
            c.drawLine(xx, -460, xx, -382, paint(hexc("3a3a46"), 0.9, "stroke", 4))
        c.drawRoundRect(skia.Rect.MakeLTRB(-62, -470, -40, -372), 10, 10, paint((1, 1, 1), 0.18))
        c.drawRect(skia.Rect.MakeLTRB(-60, -360, -40, -30), paint((1, 1, 1), 0.35))
        # label
        c.drawRect(skia.Rect.MakeLTRB(-96, -260, 96, -160), paint(hexc("c9252a"), 0.95))


# ----------------------------------------------------------------------------
# toxic cloud
# ----------------------------------------------------------------------------
CLOUD_LIGHT = Light(direction=(-0.4, -0.8, 0.6), ambient=0.72, diffuse=0.42, rim_amt=0.0)


def draw_puffs(ctx, puffs, alpha=1.0, glow=1.0):
    """puffs: list of (x, y, r, seed). Back-to-front by r (bigger behind)."""
    if not puffs:
        return
    c = ctx.c
    old = ctx.light
    ctx.light = CLOUD_LIGHT
    if glow > 0:
        for (x, y, r, sd) in puffs:
            glow_circle(c, x, y, r * 1.9, GREEN, 0.22 * glow * alpha, skia.BlendMode.kScreen)
    order = sorted(puffs, key=lambda p: -p[2])
    for (x, y, r, sd) in order:
        col = mix(GREEN, GREEN_L, 0.25 * rnd(sd, 2)) if rnd(sd, 3) > 0.3 else mix(GREEN, GREEN_D, 0.35)
        m = unit_blob(int(sd) % 6, n=12, wob=0.1, dens=9, dome=0.95, jitter=0.12)
        with ctx.at(x, y, rot=rnd(sd, 4) * 360, sx=r / 100.0):
            m.draw(ctx, color=col, alpha=alpha, outline=(GREEN_D, 4.0 * 100.0 / max(r, 1) * 0.6, 0.55))
    ctx.light = old



def blast_puffs(t, t0, origin, n=46, spread=1.0, seed=10, floor_y=None, rise=1.0):
    """Explosive cloud from origin starting at t0."""
    u = t - t0
    if u <= 0:
        return []
    out = []
    ox, oy = origin
    for i in range(n):
        delay = rnd(i, seed) * 0.25
        uu = u - delay
        if uu <= 0:
            continue
        ang = -math.pi / 2 + (rnd(i, seed + 1) * 2 - 1) * math.pi * 0.95
        sp = (700 + 1500 * rnd(i, seed + 2)) * spread
        k = 2.6
        dist = sp * (1 - math.exp(-k * uu)) / k
        x = ox + math.cos(ang) * dist * 1.35
        y = oy + math.sin(ang) * dist * 0.75 - uu * 60 * rise * (1 + rnd(i, seed + 3))
        if floor_y is not None:
            y = min(y, floor_y - 30)
        r = (40 + 110 * rnd(i, seed + 4)) * (0.3 + 0.7 * (1 - math.exp(-4 * uu))) * (1 + 0.35 * uu)
        r *= 1 + 0.06 * math.sin(uu * 5 + i)
        out.append((x, y, r, i + seed * 100))
    return out


def stink_lines(c, x, y, h, t, alpha=1.0, n=3, color=GREEN):
    for k in range(n):
        path = skia.Path()
        xx = x + (k - (n - 1) / 2) * 40
        path.moveTo(xx, y)
        for j in range(1, 7):
            yy = y - j * h / 6
            path.lineTo(xx + math.sin(t * 6 + j * 1.3 + k) * 14, yy)
        pth = smooth_path([(xx + math.sin(t * 6 + j * 1.3 + k) * 14, y - j * h / 6) for j in range(7)], close=False)
        c.drawPath(pth, paint(color, 0.8 * alpha, "stroke", 7))


# ----------------------------------------------------------------------------
# FX
# ----------------------------------------------------------------------------

def shock_ring(c, x, y, r, alpha, sy=0.3, width=18, color=(0.85, 1.0, 0.7)):
    if alpha <= 0:
        return
    c.save()
    c.translate(x, y)
    c.scale(1.0, sy)
    c.drawCircle(0, 0, r, paint(color, alpha * 0.5, "stroke", width * 2.2, blur=10))
    c.drawCircle(0, 0, r, paint((1, 1, 1), alpha, "stroke", width * 0.5))
    c.restore()


def lightning(c, p0, p1, seed, width=10, color=(0.75, 0.88, 1.0), alpha=1.0, branches=2):
    def bolt(a, b, sd, depth):
        pts = [np.array(a, float), np.array(b, float)]
        disp = np.linalg.norm(np.array(b) - np.array(a)) * 0.22
        for lvl in range(5):
            new = [pts[0]]
            for i in range(len(pts) - 1):
                m = (pts[i] + pts[i + 1]) / 2
                d = pts[i + 1] - pts[i]
                nrm = np.array([-d[1], d[0]]) / (np.linalg.norm(d) + 1e-9)
                m = m + nrm * (rnd(i * 31 + lvl * 7, sd) * 2 - 1) * disp
                new += [m, pts[i + 1]]
            pts = new
            disp *= 0.5
        return pts

    pts = bolt(p0, p1, seed, 0)
    path = poly_path(pts, close=False)
    c.drawPath(path, paint(color, 0.55 * alpha, "stroke", width * 3, blur=width * 1.2))
    c.drawPath(path, paint(color, alpha, "stroke", width))
    c.drawPath(path, paint((1, 1, 1), alpha, "stroke", width * 0.4))
    for bi in range(branches):
        i = int(len(pts) * (0.3 + 0.4 * rnd(bi, seed + 5)))
        a = pts[i]
        d = np.array(p1) - np.array(p0)
        ang = math.atan2(d[1], d[0]) + (rnd(bi, seed + 6) - 0.5) * 1.6
        L = np.linalg.norm(d) * 0.4
        b = a + np.array([math.cos(ang), math.sin(ang)]) * L
        bp = bolt(a, b, seed + 17 + bi, 1)
        bpath = poly_path(bp, close=False)
        c.drawPath(bpath, paint(color, 0.45 * alpha, "stroke", width * 1.6, blur=width))
        c.drawPath(bpath, paint((1, 1, 1), alpha, "stroke", width * 0.35))


def sparks(c, t, t0, x, y, n=60, seed=3, speed=1.0, color=(1.0, 0.85, 0.35)):
    u = t - t0
    if u <= 0 or u > 1.6:
        return
    for i in range(n):
        ang = rnd(i, seed) * 2 * math.pi
        sp = (500 + 1700 * rnd(i, seed + 1)) * speed
        life = 0.5 + 0.9 * rnd(i, seed + 2)
        if u > life:
            continue
        k = 2.2
        d = sp * (1 - math.exp(-k * u)) / k
        px = x + math.cos(ang) * d
        py = y + math.sin(ang) * d + 500 * u * u
        vx = math.cos(ang) * sp * math.exp(-k * u)
        vy = math.sin(ang) * sp * math.exp(-k * u) + 1000 * u
        a = 1 - u / life
        tail = 0.028
        col = mix(color, (1, 1, 1), rnd(i, seed + 3) * 0.6)
        c.drawLine(px, py, px - vx * tail, py - vy * tail, paint(col, a, "stroke", 5 + 4 * rnd(i, seed + 4)))
        if i % 4 == 0:
            glow_circle(c, px, py, 26, col, 0.5 * a)


CONFETTI_COLS = [hexc("ff3b5c"), hexc("ffd23f"), hexc("6cff2e"), hexc("3ec7ff"), hexc("ffffff"), hexc("ff7adf")]


def confetti(c, t, t0, n=90, seed=21, area=(0, W), y_start=-200, speed=520):
    u = t - t0
    if u <= 0:
        return
    for i in range(n):
        d = rnd(i, seed) * 0.5
        uu = u - d
        if uu <= 0:
            continue
        x = lerp(area[0], area[1], rnd(i, seed + 1)) + math.sin(uu * (2 + 2 * rnd(i, seed + 2)) + i) * 60
        y = y_start - rnd(i, seed + 3) * 500 + uu * speed * (0.7 + 0.6 * rnd(i, seed + 4))
        if y > H + 50:
            continue
        ang = uu * 300 * (rnd(i, seed + 5) - 0.5) + i * 37
        flip = math.cos(uu * (6 + 6 * rnd(i, seed + 6)) + i)
        col = CONFETTI_COLS[i % len(CONFETTI_COLS)]
        c.save()
        c.translate(x, y)
        c.rotate(ang)
        c.scale(flip, 1)
        c.drawRect(skia.Rect.MakeLTRB(-11, -7, 11, 7), paint(mul(col, 0.75 + 0.25 * abs(flip))))
        c.restore()


def breath_fog(c, t, x, y, period=0.8, alpha=0.3, dir_=(0.2, -1.0), seed=0, size=1.0):
    for k in range(3):
        u = ((t + k * period / 3) % period) / period
        px = x + dir_[0] * 220 * u * size + noise1(t * 2 + k, seed) * 20
        py = y + dir_[1] * 220 * u * size
        r = (30 + 90 * u) * size
        a = alpha * math.sin(u * math.pi)
        c.drawCircle(px, py, r, paint((1, 1, 1), a, blur=r * 0.45))


def flash(c, a, color=(1, 1, 1)):
    if a > 0.002:
        c.drawRect(skia.Rect.MakeWH(W, H), paint(color, clamp(a)))


def speed_lines(c, cx, cy, t, alpha, n=36, seed=4, r0=380, color=(1, 1, 1)):
    if alpha <= 0:
        return
    for i in range(n):
        a = rnd(i, seed) * 2 * math.pi + t * 0.3
        rr = r0 + rnd(i, seed + 1) * 200
        L = 300 + rnd(i + int(t * 30), seed + 2) * 700
        x0, y0 = cx + math.cos(a) * rr, cy + math.sin(a) * rr
        x1, y1 = cx + math.cos(a) * (rr + L), cy + math.sin(a) * (rr + L)
        c.drawPath(poly_path([(x0, y0), (x1 + math.sin(a) * 9, y1 - math.cos(a) * 9),
                              (x1 - math.sin(a) * 9, y1 + math.cos(a) * 9)]), paint(color, alpha * 0.6))


def bokeh(c, t, seed=1, n=18, color=(1.0, 0.3, 0.3), alpha=0.25, area=(0, 0, W, H)):
    for i in range(n):
        x = lerp(area[0], area[2], rnd(i, seed)) + math.sin(t * 0.3 + i) * 30
        y = lerp(area[1], area[3], rnd(i, seed + 1)) + math.cos(t * 0.25 + i * 2) * 30
        r = 40 + 110 * rnd(i, seed + 2)
        a = alpha * (0.4 + 0.6 * rnd(i, seed + 3)) * (0.75 + 0.25 * math.sin(t * 1.3 + i))
        glow_circle(c, x, y, r, mix(color, (1, 1, 1), 0.2 * rnd(i, seed + 4)), a, skia.BlendMode.kScreen)


# ----------------------------------------------------------------------------
# exit door / building / sign
# ----------------------------------------------------------------------------

def draw_door(ctx, t, open_amt=0.0, x0=700, y0=560, w=300, h=600, outside=(0.98, 0.95, 0.85)):
    """Returns nothing; door hinge on the right side, opening toward camera (shrinks in x)."""
    c = ctx.c
    # opening shows bright outside
    lin_grad_rect(c, (x0, y0, x0 + w, y0 + h), (0, y0), (0, y0 + h), [(hexc("bfe6ff"), 1), (outside, 1)])
    c.drawRect(skia.Rect.MakeLTRB(x0, y0 + h * 0.62, x0 + w, y0 + h), paint(hexc("9fb07a"), 0.8))
    glow_circle(c, x0 + w / 2, y0 + h / 2, w * 1.1, (1, 1, 0.9), 0.35)


def draw_door_panel(ctx, open_amt, x0=700, y0=560, w=300, h=600):
    c = ctx.c
    ww = w * (1 - 0.88 * open_amt)
    # panel swings toward camera: grows outward past the frame a bit while narrowing
    poly = [(x0 + w - ww, y0 - 10 * open_amt), (x0 + w, y0), (x0 + w, y0 + h), (x0 + w - ww, y0 + h + 14 * open_amt)]
    c.drawPath(poly_path(poly), paint(hexc("8c9aa8")))
    inner = [(poly[0][0] + 20, poly[0][1] + 24), (poly[1][0] - 20, poly[1][1] + 24),
             (poly[2][0] - 20, poly[2][1] - 140), (poly[3][0] + 20, poly[3][1] - 140)]
    c.drawPath(poly_path(inner), paint(hexc("cfe9ff"), 0.55))
    c.drawPath(poly_path([inner[0], (inner[0][0] + ww * 0.25, inner[0][1]), inner[3]]), paint((1, 1, 1), 0.25))
    c.drawRect(skia.Rect.MakeLTRB(poly[0][0] + 16, y0 + h * 0.52, poly[1][0] - 16, y0 + h * 0.52 + 16),
               paint(hexc("d0d4da")))


def draw_wall_frame(ctx, x0=700, y0=560, w=300, h=600):
    c = ctx.c
    c.drawRect(skia.Rect.MakeLTRB(x0 - 24, y0 - 24, x0, y0 + h), paint(hexc("15161a")))
    c.drawRect(skia.Rect.MakeLTRB(x0 + w, y0 - 24, x0 + w + 24, y0 + h), paint(hexc("15161a")))
    c.drawRect(skia.Rect.MakeLTRB(x0 - 24, y0 - 24, x0 + w + 24, y0), paint(hexc("15161a")))
    # exit sign
    sx, sy = x0 + w / 2, y0 - 90
    glow_circle(c, sx, sy, 160, hexc("ff3030"), 0.45)
    c.drawRoundRect(skia.Rect.MakeLTRB(sx - 100, sy - 38, sx + 100, sy + 38), 8, 8, paint(hexc("1a0a0a")))
    draw_words(c, [("EXIT", hexc("ff4a3a"))], sx, sy, 50, outline=0.0, shadow=False)


SIGN_FROM = list("STAG'S")
SIGN_TO = list("GAS'S")


def draw_letter_tile(ctx, ch, x, y, rot, s, lit=1.0, t=0.0, seed=0):
    c = ctx.c
    with ctx.at(x, y, rot=rot, sx=s):
        poly_mesh(((-62, -80), (62, -80), (70, -70), (70, 80), (-70, 80), (-70, -70)), "1a1b20", seed=seed, n=5,
                  dome=0.5, spec=0.3).draw(ctx)
        if lit > 0:
            glow_circle(c, 0, 0, 120, hexc("ff4040"), 0.35 * lit)
        draw_words(c, [(ch, mix(hexc("7a1416"), hexc("ff3a2e"), lit))], 0, 0, 120, outline=0.06, shadow=False,
                   gradient=True)
        for k in range(5):
            bx = -50 + k * 25
            c.drawCircle(bx, -66, 5, paint(mix(hexc("553300"), hexc("ffe9a0"), lit)))


def draw_building(ctx, t, glow_green=0.0):
    c = ctx.c
    # night sky
    lin_grad_rect(c, (-800, -1200, 1900, 1300), (0, -400), (0, 1200),
                  [(hexc("0d0b26"), 1), (hexc("2a1b4d"), 1), (hexc("6a2f63"), 1)], [0, 0.6, 1])
    for i in range(70):
        x = -700 + rnd(i, 1) * 2500
        y = -1100 + rnd(i, 2) * 1300
        tw = 0.5 + 0.5 * math.sin(t * 3 + i)
        c.drawCircle(x, y, 2 + 2 * rnd(i, 3), paint((1, 1, 1), 0.5 * tw))
    # city silhouettes (parallax handled by caller)
    for i in range(14):
        x = -800 + i * 200
        hh = 300 + 500 * rnd(i, 9)
        poly_mesh(((0, 0), (170, 0), (170, hh), (0, hh)), "1a1532", seed=i, n=4, dome=0.2).draw(ctx) if False else None
        c.drawRect(skia.Rect.MakeLTRB(x, 1150 - hh, x + 170, 1150), paint(hexc("16122c")))
        for wy in range(int(1150 - hh + 30), 1130, 60):
            for wx in range(int(x + 20), int(x + 160), 45):
                if rnd(wx * 7 + wy, 4) > 0.55:
                    c.drawRect(skia.Rect.MakeXYWH(wx, wy, 18, 26), paint(hexc("ffd27a"), 0.5))


def draw_facade(ctx, t, green=0.0):
    c = ctx.c
    with ctx.at(-120, 160):
        rect_mesh(1320, 1450, "3a2b2e", seed=31, n=40, dome=0.15, jitter=0.12).draw(ctx)
    # brick hints
    for row in range(0, 29):
        y = 180 + row * 50
        off = (row % 2) * 60
        for col in range(-2, 12):
            x = -100 + col * 120 + off
            c.drawRect(skia.Rect.MakeXYWH(x, y, 112, 44), paint(hexc("4a3336"), 0.35 + 0.25 * rnd(row * 13 + col, 2)))
    # door + windows glowing green inside
    c.drawRect(skia.Rect.MakeLTRB(370, 1080, 710, 1600), paint(hexc("101014")))
    lin_grad_rect(c, (390, 1100, 690, 1600), (0, 1100), (0, 1600),
                  [(mix(hexc("1a221a"), GREEN_D, green * 0.6), 1), (mix(hexc("101410"), GREEN_D, green * 0.8), 1)])
    for wx in (40, 790):
        c.drawRect(skia.Rect.MakeLTRB(wx, 1060, wx + 250, 1400), paint(hexc("101014")))
        lin_grad_rect(c, (wx + 16, 1076, wx + 234, 1384), (0, 1076), (0, 1384),
                      [(mix(hexc("1c2224"), GREEN_D, green * 0.5), 1), (mix(hexc("101414"), GREEN_D, green * 0.7), 1)])
        c.drawRect(skia.Rect.MakeLTRB(wx + 118, 1076, wx + 132, 1384), paint(hexc("101014")))
        c.drawRect(skia.Rect.MakeLTRB(wx + 16, 1222, wx + 234, 1236), paint(hexc("101014")))
        for k in range(3):
            glow_circle(c, wx + 60 + k * 70, 1200 + 40 * math.sin(t * 2 + k), 70, GREEN, 0.25 * green)
    if green > 0:
        for x in (520, 160, 910):
            glow_circle(c, x, 1250, 320, GREEN, 0.35 * green)
    # sidewalk
    lin_grad_rect(c, (-800, 1610, 1900, 2600), (0, 1610), (0, 2000), [(hexc("3a3a44"), 1), (hexc("1e1e26"), 1)])
    c.drawRect(skia.Rect.MakeLTRB(-800, 1610, 1900, 1626), paint(hexc("55555f")))

