"""Reusable paper-cutout set pieces and props."""
import math

import skia

from engine import (C, W, H, PAL, OUTLINE, paper, flat, stroke, line, rivet, glow, xf, svg, blob, oval, circle,
                    rrect, rect, poly, torn_rect, wobbly_poly, clamp, lerp, seg, eio, eout, ein, eback, wave,
                    noise1, hash01, shade, mix, font, text_path, draw_text, _blur, with_shadow, grad_rect,
                    lin_grad, alpha_layer, SHADOW)


# ---------------------------------------------------------------- backgrounds
def wall(c, x, y, w, h, col, stripe=None, seed=0, damask=False):
    paper(c, rect(x, y, w, h), col, ol=0, seed=seed)
    if stripe:
        n = int(w / 54) + 1
        for i in range(n):
            flat(c, rect(x + i * 54 + 20, y, 14, h), stripe, 0.35)
    if damask:
        for j in range(int(h / 110) + 1):
            for i in range(int(w / 110) + 1):
                ox = x + i * 110 + (55 if j % 2 else 0)
                oy = y + j * 110
                p = svg(f"M {ox} {oy - 16} Q {ox + 12} {oy} {ox} {oy + 16} Q {ox - 12} {oy} {ox} {oy - 16} Z")
                flat(c, p, shade(col, 1.12), 0.45)


def floor_wood(c, x, y, w, h, col=PAL['wood'], seed=0, plank=60):
    paper(c, rect(x, y, w, h), col, ol=0, seed=seed)
    dk = shade(col, 0.82)
    k = 0
    yy = y + 18
    while yy < y + h:
        line(c, x, yy, x + w, yy, dk, 2.5, 0.55)
        off = (k * 137) % 240
        xx = x - off
        while xx < x + w:
            line(c, xx, yy, xx, yy + plank * (0.6 + 0.4 * (yy - y) / max(1, h)), dk, 2.0, 0.4)
            xx += 240
        yy += plank * (0.6 + 0.6 * (yy - y) / max(1, h))
        k += 1
    line(c, x, y, x + w, y, shade(col, 0.65), 6, 0.6)


def baseboard(c, x, y, w, col=PAL['wood_dk']):
    paper(c, rect(x, y - 26, w, 30), col, ol=2.5, seed=77)


def cloud(c, x, y, s=1.0, seed=0, col=0xF8F4EC, alpha=1.0):
    pts = []
    n = 9
    for i in range(n):
        a = math.pi + i / (n - 1) * math.pi
        rr = 1.0 + 0.28 * math.sin(i * 2.3 + seed)
        pts.append((math.cos(a) * 110 * rr, math.sin(a) * 52 * rr - 6))
    pts += [(112, 12), (60, 22), (0, 24), (-60, 22), (-112, 12)]
    with xf(c, x, y, 0, s):
        paper(c, blob(pts, k=0.9), col, seed=seed + 300, sh=(5, 9, 9, 0.18), ol=3, alpha=alpha)


def sun(c, x, y, r, t, col=0xF2C14E):
    glow(c, x, y, r * 2.6, 0xFFE8A0, 0.35)
    with xf(c, x, y, t * 6):
        for k in range(12):
            with xf(c, 0, 0, k * 30):
                paper(c, poly([(-12, -r - 8), (12, -r - 8), (0, -r - 34)]), col, ol=2, seed=400 + k)
    paper(c, circle(x, y, r), col, seed=410, sh=(3, 6, 8, 0.2))


def moon(c, x, y, r, col=0xF4EBC8):
    glow(c, x, y, r * 3, 0xE8E2C0, 0.25)
    paper(c, circle(x, y, r), col, seed=420)
    for (dx, dy, rr) in ((-0.3, -0.2, 0.18), (0.25, 0.15, 0.12), (0.05, 0.4, 0.1)):
        flat(c, circle(x + dx * r, y + dy * r, rr * r), shade(col, 0.9), 0.6)


def stars(c, x, y, w, h, t, n=40, seed=0):
    for i in range(n):
        sx = x + hash01(seed, i, 1) * w
        sy = y + hash01(seed, i, 2) * h
        tw = 0.5 + 0.5 * math.sin(t * 2.0 + i)
        r = 1.5 + 2.2 * hash01(seed, i, 3)
        flat(c, circle(sx, sy, r), 0xFFF6D8, 0.5 + 0.5 * tw)


def bunting(c, x0, y0, x1, y1, sag=60, n=10, t=0.0, cols=None, size=1.0, seed=0):
    cols = cols or [PAL['brick'], PAL['mustard'], PAL['teal_lt'], PAL['cream'], PAL['navy_lt']]
    pts = []
    for i in range(n + 1):
        u = i / n
        x = lerp(x0, x1, u)
        y = lerp(y0, y1, u) + sag * 4 * u * (1 - u)
        pts.append((x, y))
    p = skia.Path()
    p.moveTo(*pts[0])
    for q in pts[1:]:
        p.lineTo(*q)
    stroke(c, blob(pts, closed=False), 0x5A4A3A, 2.4)
    for i in range(n):
        ax, ay = pts[i]
        bx, by = pts[i + 1]
        mx, my = (ax + bx) / 2, (ay + by) / 2
        sw = math.sin(t * 2.2 + i * 0.9 + seed) * 4
        tri = poly([(ax + (bx - ax) * 0.1, ay + (by - ay) * 0.1), (ax + (bx - ax) * 0.9, ay + (by - ay) * 0.9),
                    (mx + sw, my + 52 * size)])
        paper(c, tri, cols[(i + seed) % len(cols)], ol=2.2, seed=500 + i + seed, sh=(2, 5, 4, 0.2))


def window(c, x, y, w, h, t=0.0, sky='day', curtains=PAL['brick'], frame=0xEFE6D2, rain=False, moon_pos=None,
           seed=0, inner=None, sill=True):
    """window with outside view. sky: 'day', 'dusk', 'night', 'grey' or a 0xRRGGBB colour"""
    with_shadow(c, lambda: paper(c, rrect(x - 14, y - 14, w + 28, h + 28, 6), frame, seed=seed + 1), 5, 9, 8, 0.25)
    skies = {'day': (0x9CCAD8, 0xD9ECEC), 'dusk': (0x6B6FA8, 0xE9A07A), 'night': (0x1D2A4E, 0x34406E),
             'grey': (0x8E9AA0, 0xB9C2C4), 'dawn': (0x8FB4D2, 0xF0D2A8)}
    top, bot = skies.get(sky, (sky, sky)) if isinstance(sky, str) else (sky, shade(sky, 1.15))
    c.save()
    c.clipRect(skia.Rect.MakeXYWH(x, y, w, h), skia.ClipOp.kIntersect, True)
    grad_rect(c, x, y, w, h, top, bot)
    if inner:
        inner(c, x, y, w, h)
    if sky == 'night' and moon_pos is not None:
        moon(c, moon_pos[0], moon_pos[1], 34)
    if sky in ('day', 'dawn'):
        cloud(c, x + w * 0.3 + (t * 12) % (w + 200) - 100, y + h * 0.3, 0.45, seed + 3)
    if rain:
        for i in range(26):
            ph = (t * 1.6 + hash01(seed, i) * 3) % 1.0
            rx = x + hash01(seed, i, 7) * w
            ry = y - 40 + ph * (h + 80)
            line(c, rx, ry, rx - 8, ry + 34, 0xDDE6EA, 2.2, 0.55)
    c.restore()
    # panes
    stroke(c, rect(x, y, w, h), frame, 10, cap='butt')
    line(c, x + w / 2, y, x + w / 2, y + h, frame, 9)
    line(c, x, y + h / 2, x + w, y + h / 2, frame, 9)
    # glass sheen
    p = poly([(x + w * 0.1, y + h * 0.9), (x + w * 0.35, y + h * 0.1), (x + w * 0.45, y + h * 0.1), (x + w * 0.2, y + h * 0.9)])
    flat(c, p, 0xFFFFFF, 0.08)
    if sill:
        paper(c, rrect(x - 30, y + h + 8, w + 60, 22, 4), shade(frame, 0.92), seed=seed + 2, sh=(2, 6, 6, 0.25))
    if curtains is not None:
        for sd in (-1, 1):
            cx = x - 40 if sd < 0 else x + w + 40
            sway = math.sin(t * 0.8 + sd) * 4
            pts = [(cx - 50, y - 50), (cx + 50, y - 50), (cx + 40 + sway, y + h * 0.5), (cx + 56 + sway, y + h + 40),
                   (cx - 56 + sway, y + h + 40), (cx - 40 + sway, y + h * 0.5)]
            if sd < 0:
                pts = [(cx - 40, y - 50), (cx + 60, y - 50), (cx + 30 + sway, y + h * 0.45), (cx + 20 + sway, y + h + 40),
                       (cx - 46 + sway, y + h + 40), (cx - 36, y + h * 0.5)]
            else:
                pts = [(cx - 60, y - 50), (cx + 40, y - 50), (cx + 36, y + h * 0.5), (cx + 46 + sway, y + h + 40),
                       (cx - 20 + sway, y + h + 40), (cx - 30 + sway, y + h * 0.45)]
            paper(c, blob(pts, k=0.5), curtains, seed=seed + 10 + sd, sh=(5, 9, 9, 0.28))
            for k in range(3):
                xx = cx - 24 + k * 22
                stroke(c, svg(f"M {xx} {y - 40} Q {xx + sway * 0.5} {y + h * 0.5} {xx + sway} {y + h + 30}"),
                       shade(curtains, 0.8), 2.4, 0.5)
        paper(c, rrect(x - 110, y - 64, w + 220, 22, 10), PAL['wood_dk'], seed=seed + 20, sh=(3, 6, 6, 0.3))


def bookshelf(c, x, y, w, h, seed=0, col=PAL['wood_dk']):
    def draw():
        paper(c, rect(x, y, w, h), col, seed=seed)
        rows = max(2, int(h / 150))
        rh = (h - 20) / rows
        for r in range(rows):
            ry = y + 10 + r * rh
            flat(c, rect(x + 10, ry, w - 20, rh - 14), shade(col, 0.6), 1)
            bx = x + 14
            k = 0
            while bx < x + w - 24:
                bw = 14 + 12 * hash01(seed, r, k)
                bh = (rh - 26) * (0.7 + 0.3 * hash01(seed, r, k, 2))
                cols = [PAL['brick'], PAL['mustard'], PAL['teal'], PAL['navy_lt'], PAL['cream_dk'], PAL['green'],
                        0x8A4F6E]
                bc = cols[int(hash01(seed, r, k, 3) * len(cols))]
                if bx + bw > x + w - 12:
                    break
                lean = 0 if hash01(seed, r, k, 4) > 0.15 else 8
                with xf(c, bx + bw / 2, ry + rh - 14, lean):
                    paper(c, rect(-bw / 2, -bh, bw, bh), bc, ol=1.6, seed=seed + r * 40 + k)
                    line(c, -bw / 2 + 3, -bh + 10, bw / 2 - 3, -bh + 10, shade(bc, 1.3), 2, 0.7)
                bx += bw + 2 + (10 if lean else 0)
                k += 1
            paper(c, rect(x, ry + rh - 14, w, 12), shade(col, 1.12), ol=2, seed=seed + 90 + r)
    with_shadow(c, draw, 7, 12, 10, 0.3)


def grandfather_clock(c, x, y, s=1.0, t=0.0, seed=0):
    def draw():
        with xf(c, x, y, 0, s):
            paper(c, rrect(-60, -480, 120, 480, 8), PAL['wood_dk'], seed=seed)
            paper(c, blob([(-72, -470), (-60, -540), (0, -575), (60, -540), (72, -470)]), PAL['wood'], seed=seed + 1)
            paper(c, circle(0, -500, 48), 0xF6EEDC, seed=seed + 2)
            for k in range(12):
                a = k / 12 * 2 * math.pi
                flat(c, circle(math.sin(a) * 38, -500 - math.cos(a) * 38, 3), 0x2A1E16)
            hm = t / 60 * 2 * math.pi * 6
            line(c, 0, -500, math.sin(hm) * 30, -500 - math.cos(hm) * 30, 0x2A1E16, 4)
            line(c, 0, -500, math.sin(hm / 12 + 1.2) * 20, -500 - math.cos(hm / 12 + 1.2) * 20, 0x2A1E16, 5)
            flat(c, circle(0, -500, 5), 0xB88E34)
            paper(c, rrect(-34, -420, 68, 300, 6), shade(PAL['wood_dk'], 0.7), seed=seed + 3, ol=2)
            sw = math.sin(t * 2 * math.pi / 2.0) * 14
            with xf(c, 0, -416, sw):
                line(c, 0, 0, 0, 220, 0xC9A043, 4)
                paper(c, circle(0, 232, 20), 0xD8B04A, ol=2, seed=seed + 4)
            paper(c, rect(-70, -40, 140, 40), PAL['wood'], seed=seed + 5)
    with_shadow(c, draw, 7 * s, 12 * s, 9 * s, 0.3)


def candle(c, x, y, s=1.0, t=0.0, lit=1.0, height=1.0, seed=0, glow_a=0.55):
    with xf(c, x, y, 0, s):
        paper(c, oval(0, 4, 40, 12), 0xC9A043, ol=2, seed=seed + 1)
        h = 90 * height
        paper(c, rrect(-14, -h, 28, h + 2, 5), 0xF6EEDC, ol=2.2, seed=seed)
        flat(c, oval(0, -h, 14, 4), 0xE8DCC2, 0.8)
        line(c, 0, -h, 0, -h - 10, 0x3A2A1E, 2.4)
        if lit > 0.01:
            fl = 1.0 + 0.12 * noise1(t * 7.0, seed) + 0.06 * math.sin(t * 23 + seed)
            sw = 3 * noise1(t * 3.0, seed + 9)
            fy = -h - 10
            glow(c, 0, fy - 14, 160 * lit * fl, 0xFFB24A, glow_a * lit)
            p = svg(f"M 0 {fy + 2} C 10 {fy - 6} {9 + sw} {fy - 22} {sw} {fy - 38 * fl} C {-9 + sw} {fy - 22} -10 {fy - 6} 0 {fy + 2} Z")
            with alpha_layer(c, lit):
                paper(c, p, 0xFFC24D, ol=0, tex=False)
                p2 = svg(f"M 0 {fy} C 5 {fy - 4} {4 + sw * 0.5} {fy - 14} {sw * 0.6} {fy - 22 * fl} C {-4 + sw * 0.5} {fy - 14} -5 {fy - 4} 0 {fy} Z")
                flat(c, p2, 0xFFF4C8, 0.95)
        else:
            pass


def smoke_wisps(c, x, y, t, amount=1.0, seed=0, col=0xCFCAC2):
    for i in range(8):
        ph = (t * 0.35 + i / 8) % 1.0
        a = amount * (1 - ph) * seg(ph, 0, 0.1)
        if a <= 0.01:
            continue
        xx = x + math.sin(ph * 6 + i + seed) * 14 * ph
        yy = y - ph * 160
        c.drawCircle(xx, yy, 8 + ph * 26, skia.Paint(AntiAlias=True, Color=C(col, 0.35 * a), MaskFilter=_blur(6)))


def frame_portrait(c, x, y, w, h, inner, oval_shape=True, col=0xC9A043, t=0.0, seed=0, pin=True, mat=0xF4EAD2):
    """gold frame with inner(c, cx, cy, w, h) drawn clipped"""
    def outer():
        if oval_shape:
            paper(c, oval(x, y, w / 2 + 22, h / 2 + 22), col, seed=seed)
            stroke(c, oval(x, y, w / 2 + 12, h / 2 + 12), shade(col, 0.75), 3, 0.7)
        else:
            paper(c, rrect(x - w / 2 - 24, y - h / 2 - 24, w + 48, h + 48, 4), col, seed=seed)
            stroke(c, rect(x - w / 2 - 12, y - h / 2 - 12, w + 24, h + 24), shade(col, 0.75), 3, 0.7)
    with_shadow(c, outer, 6, 11, 9, 0.32)
    clipp = oval(x, y, w / 2, h / 2) if oval_shape else rect(x - w / 2, y - h / 2, w, h)
    flat(c, clipp, mat)
    c.save()
    c.clipPath(clipp, skia.ClipOp.kIntersect, True)
    inner(c, x, y, w, h)
    c.restore()
    stroke(c, clipp, shade(col, 0.6), 3, 0.6)
    if pin:
        line(c, x, y - h / 2 - 22, x, y - h / 2 - 70, 0x5A4A3A, 2)
        rivet(c, x, y - h / 2 - 72, 6)


def tag(c, x, y, text, rot=-4.0, s=1.0, t=0.0, appear=1.0, col=0xF6EEDC, ink=0x1F2A44, seed=0, red_line=None):
    """small pinned paper name tag (like 'GENERAL LAFAYETTE')"""
    if appear <= 0:
        return
    f = font('Anton-Regular.ttf', 56)
    lines = text.split('\n')
    tw = max(f.measureText(l) for l in lines)
    w = tw + 70
    h = 30 + 62 * len(lines)
    sc = s * lerp(0.4, 1.0, eback(appear))
    sway = math.sin(t * 1.7 + seed) * 1.5
    with xf(c, x, y, rot + sway + (1 - eout(appear)) * 25, sc):
        with alpha_layer(c, clamp(appear * 2)):
            paper(c, torn_rect(-w / 2, -h / 2, w, h, seed=seed + 5, rough=3.5, step=8), col, ol=0,
                  sh=(4, 8, 8, 0.35), seed=seed)
            for i, ln in enumerate(lines):
                p = text_path(ln, f, 0, -h / 2 + 15 + 54 + i * 62 - 6, align='center')
                c.save()
                c.translate(2, 3)
                c.drawPath(p, skia.Paint(AntiAlias=True, Color=C(0x000000, 0.25), MaskFilter=_blur(2)))
                c.restore()
                flat(c, p, ink if (red_line is None or i != red_line) else PAL['red'])
            rivet(c, 0, -h / 2 + 10, 7)


def calendar(c, x, y, s=1.0, text='1876', sub=None, flip=0.0, next_text=None, t=0.0, seed=0, swing=0.0):
    """tear-off wall calendar. flip 0..1 tears the top page off (revealing next_text)."""
    f = font('Anton-Regular.ttf', 150)
    fs = font('Anton-Regular.ttf', 34)

    def page(txt, a=1.0):
        paper(c, rect(-120, -150, 240, 280), 0xF6EEDC, ol=2.5, seed=seed + 3, alpha=a)
        p = text_path(txt, f, 0, 60, align='center')
        flat(c, p, 0x2A2420, a)
        if sub:
            flat(c, text_path(sub, fs, 0, 105, align='center'), PAL['red'], a)
        for k in range(2):
            line(c, -80, 112 + k * 0 + 12, 80, 112 + 12, 0xB9AF9A, 2, 0.6 * a) if not sub else None

    def draw():
        with xf(c, x, y, swing, s):
            paper(c, rect(-128, -200, 256, 340), shade(0xF6EEDC, 0.92), seed=seed + 1)
            if next_text is not None and flip > 0:
                page(next_text)
            # current page (tearing away)
            if flip < 1:
                u = eio(flip)
                with xf(c, 0, -150, -u * 70, 1.0):
                    with xf(c, u * 260, 150 + u * 420):
                        page(text, 1 - seg(flip, 0.7, 1.0))
            paper(c, rect(-128, -200, 256, 62), PAL['red'], seed=seed + 2, ol=2.5)
            for k in range(5):
                rivet(c, -90 + k * 45, -184, 5)
    with_shadow(c, draw, 6 * s, 11 * s, 9 * s, 0.32)


def sound_rings(c, x, y, t, n=3, period=1.1, rmax=260, col=0xF6EEDC, alpha=1.0, width=10, arc=None, rot=0.0,
                shrink=0.0):
    """concentric paper arcs pulsing out from (x,y). arc=(start,sweep) degrees or None for full circles"""
    for i in range(n):
        ph = ((t / period) + i / n) % 1.0
        if shrink:
            ph = 1 - ph
        r = 30 + ph * rmax
        a = alpha * (1 - ph) * clamp(ph * 5)
        if a <= 0.01:
            continue
        p = skia.Path()
        if arc:
            p.addArc(skia.Rect.MakeLTRB(x - r, y - r, x + r, y + r), arc[0] + rot, arc[1])
        else:
            p.addCircle(x, y, r)
        sp = skia.Paint(AntiAlias=True, Style=skia.Paint.kStroke_Style, StrokeWidth=width + 6,
                        StrokeCap=skia.Paint.kRound_Cap, Color=C(0x1A0F08, 0.18 * a), MaskFilter=_blur(4))
        c.save()
        c.translate(3, 5)
        c.drawPath(p, sp)
        c.restore()
        stroke(c, p, 0xFFFFFF, width + 4, a * 0.9)
        stroke(c, p, col, width, a)


def heart_path(s=1.0):
    return svg("M 0 30 C -50 0 -46 -38 -22 -42 C -10 -44 -2 -36 0 -26 C 2 -36 10 -44 22 -42 C 46 -38 50 0 0 30 Z") \
        if s == 1.0 else _scaled(svg("M 0 30 C -50 0 -46 -38 -22 -42 C -10 -44 -2 -36 0 -26 C 2 -36 10 -44 22 -42 C 46 -38 50 0 0 30 Z"), s)


def _scaled(p, s):
    q = skia.Path(p)
    q.transform(skia.Matrix.Scale(s, s))
    return q


def heart(c, x, y, s=1.0, col=0xE0606E, rot=0.0, alpha=1.0, seed=0):
    with xf(c, x, y, rot, s):
        paper(c, heart_path(), col, ol=3, alpha=alpha, seed=seed + 600, sh=(2, 5, 5, 0.25 * alpha))
        flat(c, oval(-16, -22, 8, 5), 0xFFFFFF, 0.45 * alpha)


def floating_hearts(c, x, y, t, t0, n=7, spread=220, col=0xE0606E, seed=0, rise=520):
    for i in range(n):
        st = t0 + i * 0.22
        if t < st:
            continue
        u = (t - st) / 2.6
        if u > 1:
            continue
        hx = x + (hash01(seed, i) - 0.5) * spread + math.sin(u * 6 + i) * 22
        hy = y - u * rise
        sc = (0.45 + 0.4 * hash01(seed, i, 2)) * eback(clamp(u * 4))
        a = 1 - seg(u, 0.7, 1.0)
        heart(c, hx, hy, sc, col=[col, 0xF08A8A, 0xD9435A][i % 3], rot=math.sin(u * 5 + i) * 12, alpha=a, seed=i)


def dust_motes(c, x, y, w, h, t, n=30, seed=0, col=0xFFF1C8, alpha=0.6):
    for i in range(n):
        px = x + (hash01(seed, i, 1) * w + math.sin(t * 0.3 + i) * 30 + t * 6) % w
        py = y + (hash01(seed, i, 2) * h - t * (6 + 10 * hash01(seed, i, 3))) % h
        r = 1.5 + 2.5 * hash01(seed, i, 4)
        a = alpha * (0.4 + 0.6 * (0.5 + 0.5 * math.sin(t * 1.3 + i * 1.7)))
        c.drawCircle(px, py, r, skia.Paint(AntiAlias=True, Color=C(col, a), MaskFilter=_blur(1.2)))


def rain(c, t, alpha=0.5, n=90, seed=0, slant=-10, speed=1.6, col=0xD8E2E8, x0=0, x1=W, y0=0, y1=H):
    for i in range(n):
        ph = (t * speed + hash01(seed, i)) % 1.0
        rx = x0 + hash01(seed, i, 2) * (x1 - x0 + 200)
        ry = y0 - 100 + ph * (y1 - y0 + 200)
        L = 40 + 30 * hash01(seed, i, 3)
        line(c, rx, ry, rx + slant * L / 40, ry + L, col, 2.2, alpha * (0.5 + 0.5 * hash01(seed, i, 4)))


def confetti(c, t, t0, n=70, seed=0, x0=0, x1=W, alpha=1.0):
    cols = [PAL['brick'], PAL['mustard'], PAL['teal_lt'], 0xF6EEDC, 0xE0606E, PAL['navy_lt']]
    for i in range(n):
        st = t0 + hash01(seed, i) * 0.6
        if t < st:
            continue
        u = t - st
        cx = x0 + hash01(seed, i, 2) * (x1 - x0) + math.sin(u * 2 + i) * 30
        cy = -40 + u * (260 + 160 * hash01(seed, i, 3))
        if cy > H + 40:
            continue
        rot = u * 200 * (hash01(seed, i, 4) - 0.5) * 2
        with xf(c, cx, cy, rot, 1.0, abs(math.cos(u * 4 + i))):
            flat(c, rect(-8, -5, 16, 10), cols[i % len(cols)], alpha)


def petals(c, t, n=24, seed=0, alpha=1.0, col=0xF2B8C0):
    for i in range(n):
        ph = (t * 0.18 + hash01(seed, i)) % 1.0
        cx = hash01(seed, i, 2) * W + math.sin(t * 1.2 + i) * 40
        cy = -40 + ph * (H + 80)
        with xf(c, cx, cy, t * 90 + i * 40, 1.0, 0.6 + 0.4 * math.sin(t * 3 + i)):
            paper(c, oval(0, 0, 12, 7), [col, 0xFFFFFF, 0xF6D6A8][i % 3], ol=1.2, alpha=alpha, tex=False)


# ---------------------------------------------------------------- furniture
def table_top(c, x, y, w, h, col=PAL['wood'], seed=0, legs=True, leg_h=220):
    def draw():
        if legs:
            for lx in (x + 30, x + w - 60):
                paper(c, rect(lx, y + h, 30, leg_h), shade(col, 0.8), seed=seed + 3)
        paper(c, rect(x, y, w, h), col, seed=seed)
        line(c, x + 6, y + h * 0.35, x + w - 6, y + h * 0.35, shade(col, 0.85), 2, 0.5)
    with_shadow(c, draw, 6, 10, 9, 0.3)


def chair(c, x, y, s=1.0, col=PAL['wood_dk'], cushion=PAL['brick'], seed=0, flip=False):
    def draw():
        with xf(c, x, y, 0, s * (-1 if flip else 1), s):
            paper(c, rect(-70, -400, 22, 400), col, seed=seed)
            paper(c, rect(48, -200, 20, 200), col, seed=seed + 1)
            paper(c, rect(-62, -60, 18, 60), col, seed=seed + 2)
            paper(c, rrect(-80, -440, 70, 260, 18), cushion, seed=seed + 3)
            paper(c, rrect(-84, -230, 168, 40, 10), cushion, seed=seed + 4)
            paper(c, rect(-84, -194, 168, 22), col, seed=seed + 5)
            for k in range(3):
                rivet(c, -46, -400 + k * 70, 4)
    with_shadow(c, draw, 7 * s, 12 * s, 9 * s, 0.3)


def door(c, x, y, w, h, open_amt=0.0, col=PAL['wood'], frame=PAL['wood_dk'], seed=0, inside=0xF3E2B8):
    """door in wall; (x,y)=top-left of opening. open_amt 0..1 swings door (perspective squash)."""
    paper(c, rect(x - 22, y - 22, w + 44, h + 22), frame, seed=seed, sh=(5, 9, 9, 0.3))
    flat(c, rect(x, y, w, h), inside)
    grad_rect(c, x, y, w, h, shade(inside, 1.05), shade(inside, 0.8))
    dw = w * (1 - 0.82 * eio(open_amt))

    def leaf():
        paper(c, rect(x, y, dw, h), col, seed=seed + 1)
        for k in range(2):
            stroke(c, rect(x + dw * 0.15, y + 40 + k * h * 0.45, dw * 0.7, h * 0.38), shade(col, 0.8), 3, 0.7)
        flat(c, circle(x + dw * 0.85, y + h * 0.52, 9), 0xC9A043)
    with_shadow(c, leaf, 6, 8, 8, 0.3)


def chalkboard(c, x, y, w, h, seed=0, content=None, t=0.0):
    def draw():
        paper(c, rect(x - 20, y - 20, w + 40, h + 40), PAL['wood'], seed=seed)
        paper(c, rect(x, y, w, h), 0x2F4A3E, ol=0, seed=seed + 1)
        for k in range(5):
            flat(c, oval(x + w * hash01(seed, k), y + h * hash01(seed, k, 2), 120, 30), 0xFFFFFF, 0.04)
        paper(c, rect(x - 10, y + h + 4, w + 20, 16), PAL['wood_dk'], seed=seed + 2)
        flat(c, rect(x + 40, y + h - 4, 34, 10), 0xF4F0E8)
    with_shadow(c, draw, 6, 11, 9, 0.3)
    if content:
        content(c, x, y, w, h)


def chalk(c, path, w=4.0, alpha=0.9):
    stroke(c, path, 0xF2EFE6, w, alpha)


def school_desk(c, x, y, s=1.0, seed=0):
    def draw():
        with xf(c, x, y, 0, s):
            paper(c, rect(-90, -110, 18, 110), PAL['wood_dk'], seed=seed)
            paper(c, rect(72, -110, 18, 110), PAL['wood_dk'], seed=seed + 1)
            paper(c, rrect(-110, -140, 220, 34, 6), PAL['wood'], seed=seed + 2)
            paper(c, rect(-60, -170, 50, 30), 0xF6EEDC, ol=2, seed=seed + 3)
            paper(c, rect(20, -164, 46, 24), PAL['brick'], ol=2, seed=seed + 4)
    with_shadow(c, draw, 5 * s, 9 * s, 8 * s, 0.3)


def bed(c, x, y, s=1.0, seed=0, blanket=0xD9C27A):
    def draw():
        with xf(c, x, y, 0, s):
            paper(c, rrect(-330, -330, 44, 330, 10), PAL['wood_dk'], seed=seed)
            paper(c, rrect(286, -230, 44, 230, 10), PAL['wood_dk'], seed=seed + 1)
            paper(c, rect(-300, -150, 600, 70), PAL['wood'], seed=seed + 2)
            paper(c, rrect(-300, -200, 600, 70, 20), 0xF4EFE6, seed=seed + 3)
    with_shadow(c, draw, 6 * s, 10 * s, 9 * s, 0.3)


def blanket(c, x, y, s=1.0, col=0xD9C27A, seed=0, t=0.0):
    br = math.sin(t * 2 * math.pi / 3.2) * 4
    with xf(c, x, y, 0, s):
        p = blob([(-250, -190 - br), (60, -200 - br), (260, -186), (290, -150), (290, -96), (-270, -96), (-270, -150)],
                 k=0.6)
        paper(c, p, col, seed=seed + 4, sh=(3, 6, 6, 0.2))
        for k in range(6):
            for j in range(2):
                flat(c, rect(-230 + k * 86, -176 + j * 40 - br * 0.5, 36, 14), shade(col, 0.82), 0.6)


# ---------------------------------------------------------------- phones & tech
def smartphone(c, x, y, s=1.0, t=0.0, ring=0.0, screen='call', glow_a=0.0, rot=0.0, name='MABEL'):
    """modern smartphone (paper style). ring: 0..1 vibrate amount"""
    vib = ring * math.sin(t * 70) * 6
    with xf(c, x + vib, y, rot + ring * math.sin(t * 55) * 2.5, s):
        def body():
            paper(c, rrect(-150, -300, 300, 600, 46), 0x23262E, seed=801)
        with_shadow(c, body, 8, 16, 14, 0.4)
        paper(c, rrect(-136, -284, 272, 568, 36), 0x2C3E58, ol=0, seed=802)
        c.save()
        c.clipPath(rrect(-136, -284, 272, 568, 36), skia.ClipOp.kIntersect, True)
        grad_rect(c, -136, -284, 272, 568, 0x3D5A80, 0x1F2D45)
        if screen == 'call':
            # caller avatar + name + buttons
            pulse = 1 + 0.06 * math.sin(t * 6) * ring
            flat(c, circle(0, -120, 64 * pulse), 0xF6EEDC, 0.15)
            paper(c, circle(0, -120, 52), 0xE8D9BE, ol=3, seed=803)
            # little silhouette in avatar
            flat(c, circle(0, -134, 20), 0x6B4733)
            flat(c, oval(0, -88, 30, 18), 0x8E9FD6)
            f = font('Anton-Regular.ttf', 34)
            draw_text(c, 'INCOMING CALL', 0, -30, font('BebasNeue-Regular.ttf', 28), 0xDDE6F0, align='center')
            draw_text(c, name, 0, 14, f, 0xFFFFFF, align='center')
            for sd, col in ((-1, 0xD0453A), (1, 0x3FAE5A)):
                bx = sd * 70
                by = 190 + (math.sin(t * 8) * 4 * ring if sd > 0 else 0)
                paper(c, circle(bx, by, 34), col, ol=3, seed=805 + sd)
                with xf(c, bx, by, 135 if sd < 0 else 0):
                    p = svg("M -12 -10 Q -14 6 0 14 Q 6 16 12 10 L 6 4 Q 2 8 -2 4 Q -6 0 -4 -4 L -8 -14 Z")
                    flat(c, p, 0xFFFFFF)
        elif screen == 'talk':
            f = font('BebasNeue-Regular.ttf', 30)
            draw_text(c, '00:0' + str(int(t) % 10), 0, -40, f, 0xDDE6F0, align='center')
            paper(c, circle(0, -130, 52), 0xE8D9BE, ol=3, seed=803)
            flat(c, circle(0, -144, 20), 0x6B4733)
            flat(c, oval(0, -98, 30, 18), 0x8E9FD6)
        c.restore()
        if glow_a > 0:
            glow(c, 0, 0, 420, 0xBFD8FF, glow_a)
        paper(c, rrect(-40, -276, 80, 18, 9), 0x111317, ol=0, tex=False)


def candlestick_phone(c, x, y, s=1.0, seed=0, rot=0.0):
    def draw():
        with xf(c, x, y, rot, s):
            paper(c, oval(0, 0, 70, 18), 0x22201E, seed=seed)
            paper(c, rect(-12, -260, 24, 260), 0x2A2724, seed=seed + 1)
            paper(c, blob([(-40, -300), (40, -300), (30, -250), (-30, -250)]), 0x2A2724, seed=seed + 2)
            flat(c, oval(0, -300, 42, 12), 0x4A4642)
            # receiver on hook
            paper(c, rect(14, -230, 70, 14), 0x2A2724, seed=seed + 3)
            paper(c, rrect(64, -260, 28, 90, 12), 0x22201E, seed=seed + 4)
    with_shadow(c, draw, 5 * s, 9 * s, 8 * s, 0.3)


def wall_phone(c, x, y, s=1.0, t=0.0, ring=0.0, seed=0):
    """vintage wooden wall telephone with two brass bells (shake when ringing)"""
    def draw():
        with xf(c, x, y, 0, s):
            paper(c, rrect(-90, -170, 180, 340, 16), PAL['wood'], seed=seed)
            paper(c, rrect(-76, -150, 152, 120, 10), shade(PAL['wood'], 0.86), seed=seed + 1, ol=2)
            for sd in (-1, 1):
                sh = ring * math.sin(t * 60 + sd) * 7
                with xf(c, sd * 36 + sh, -96):
                    paper(c, circle(0, 0, 32), 0xD1A946, seed=seed + 2 + sd, ol=2.5)
                    flat(c, circle(-9, -9, 9), 0xF6E6A8, 0.8)
            line(c, -10 + ring * math.sin(t * 60) * 12, -96, 10 + ring * math.sin(t * 60) * 12, -96, 0x3A2A1E, 4)
            paper(c, rrect(-30, 0, 60, 90, 10), shade(PAL['wood'], 0.9), seed=seed + 5, ol=2)
            paper(c, circle(0, 26, 22), 0x2A2724, seed=seed + 6, ol=2)  # mouthpiece
            # earpiece hanging on the side
            line(c, -90, -20, -120, 40, 0x2A2724, 4)
            paper(c, rrect(-140, 30, 34, 90, 14), 0x22201E, seed=seed + 7, ol=2)
            paper(c, rrect(84, -60, 30, 16, 6), 0x2A2724, ol=2)  # crank
            paper(c, rect(108, -60, 10, 50), 0x2A2724, ol=1.5)
    with_shadow(c, draw, 6 * s, 10 * s, 9 * s, 0.32)


def bell_transmitter(c, x, y, s=1.0, seed=0, t=0.0, active=0.0):
    """Bell's 1876 liquid transmitter / 'gallows' style telephone (paper style)"""
    def draw():
        with xf(c, x, y, 0, s):
            paper(c, rrect(-130, -30, 260, 40, 8), PAL['wood'], seed=seed)
            paper(c, rect(-100, -230, 22, 200), PAL['wood_dk'], seed=seed + 1)
            paper(c, rect(-100, -240, 170, 22), PAL['wood_dk'], seed=seed + 2)
            # cone mouthpiece
            paper(c, poly([(40, -218), (110, -260), (110, -150), (40, -192)]), 0xC9A043, seed=seed + 3)
            flat(c, oval(110, -205, 14, 55), 0x8A6A20)
            # coil + diaphragm
            paper(c, rrect(-20, -150, 70, 120, 14), 0xB86A3A, seed=seed + 4)
            for k in range(6):
                line(c, -18, -140 + k * 18, 48, -140 + k * 18, 0x8A4A26, 2.4, 0.8)
            rivet(c, -89, -229, 5)
            rivet(c, 59, -229, 5)
    with_shadow(c, draw, 6 * s, 10 * s, 9 * s, 0.32)
    if active > 0:
        sound_rings(c, x + 125 * s, y - 205 * s, t, n=3, period=0.9, rmax=170 * s, alpha=active, width=7 * s,
                    arc=(-50, 100))


def receiver_box(c, x, y, s=1.0, seed=0):
    """simple receiving instrument (iron box + earpiece) for Watson's room"""
    def draw():
        with xf(c, x, y, 0, s):
            paper(c, rrect(-110, -30, 220, 40, 8), PAL['wood'], seed=seed)
            paper(c, rrect(-60, -150, 120, 120, 12), 0x5A5F6A, seed=seed + 1)
            paper(c, circle(0, -90, 40), 0x2A2724, seed=seed + 2, ol=2)
            flat(c, circle(0, -90, 14), 0x4A4642)
    with_shadow(c, draw, 6 * s, 10 * s, 9 * s, 0.32)


def wire_path(pts):
    return blob(pts, closed=False, k=0.8)


def wire(c, pts, col=0x3A2A1E, w=5.0, alpha=1.0):
    p = wire_path(pts)
    if SHADOW[0]:
        return
    c.save()
    c.translate(3, 6)
    c.drawPath(p, skia.Paint(AntiAlias=True, Style=skia.Paint.kStroke_Style, StrokeWidth=w + 2, Color=C(0, 0.18 * alpha),
                             MaskFilter=_blur(3)))
    c.restore()
    stroke(c, p, 0xF6EEDC, w + 4, alpha * 0.9)
    stroke(c, p, col, w, alpha)


def glow_pulse_along(c, pts, u, col=0xFFE08A, r=34, trail=0.18, alpha=1.0):
    """glowing sound-wave blob travelling along polyline pts at fraction u"""
    meas = skia.PathMeasure(wire_path(pts), False)
    L = meas.getLength()
    for k in range(7):
        uu = u - k * trail / 7
        if uu < 0 or uu > 1:
            continue
        pos, tan = meas.getPosTan(uu * L)
        a = alpha * (1 - k / 7)
        glow(c, pos.x(), pos.y(), r * (1.8 - k * 0.15), col, 0.55 * a)
        if k == 0:
            flat(c, circle(pos.x(), pos.y(), r * 0.32), 0xFFF8DC, a)
            # tiny wave squiggle riding on the wire
            ang = math.degrees(math.atan2(tan.y(), tan.x()))
            with xf(c, pos.x(), pos.y(), ang):
                p = svg("M -40 0 Q -30 -16 -20 0 T 0 0 T 20 0 T 40 0")
                stroke(c, p, 0xFFF4C8, 4, a)


def telegraph_pole(c, x, y, s=1.0, seed=0, col=PAL['wood_dk']):
    def draw():
        with xf(c, x, y, 0, s):
            paper(c, rect(-9, -300, 18, 300), col, seed=seed)
            paper(c, rect(-60, -280, 120, 14), col, seed=seed + 1)
            for k in (-48, -16, 16, 48):
                paper(c, rrect(k - 5, -296, 10, 16, 4), 0x9FC3CF, ol=1.5, seed=seed + 2)
    with_shadow(c, draw, 4 * s, 7 * s, 6 * s, 0.28)


def tuning_fork(c, x, y, s=1.0, rot=0.0, t=0.0, vib=0.0, seed=0):
    with xf(c, x, y, rot, s):
        sh = vib * math.sin(t * 90) * 3
        paper(c, rrect(-6, 0, 12, 90, 5), 0xB9BCC4, ol=2, seed=seed)
        paper(c, svg(f"M -26 0 L -26 -150 L {-14 + sh} -150 L {-14 + sh} -14 L {14 - sh} -14 L {14 - sh} -150 L 26 -150 L 26 0 Z"),
              0xC9CCD4, ol=2.2, seed=seed + 1)


def magnet(c, x, y, s=1.0, rot=0.0, seed=0):
    with xf(c, x, y, rot, s):
        p = svg("M -60 -40 L -60 20 C -60 70 60 70 60 20 L 60 -40 L 28 -40 L 28 20 C 28 36 -28 36 -28 20 L -28 -40 Z")
        paper(c, p, PAL['red'], ol=2.5, seed=seed)
        paper(c, rect(-60, -60, 32, 22), 0xD9D6CE, ol=2, seed=seed + 1)
        paper(c, rect(28, -60, 32, 22), 0xD9D6CE, ol=2, seed=seed + 2)


def coil(c, x, y, s=1.0, rot=0.0, seed=0, col=0xB86A3A):
    with xf(c, x, y, rot, s):
        paper(c, rrect(-60, -34, 120, 68, 14), col, ol=2.4, seed=seed)
        for k in range(9):
            line(c, -52 + k * 13, -30, -52 + k * 13, 30, shade(col, 0.72), 2.2, 0.85)
        paper(c, rect(-74, -40, 16, 80), 0x6A4024, ol=2, seed=seed + 1)
        paper(c, rect(58, -40, 16, 80), 0x6A4024, ol=2, seed=seed + 2)


def battery_jar(c, x, y, s=1.0, seed=0):
    with xf(c, x, y, 0, s):
        paper(c, rrect(-40, -110, 80, 110, 10), 0x7FB3B0, ol=2.4, seed=seed, alpha=0.95)
        flat(c, rect(-34, -60, 68, 54), 0x5E9A96, 0.6)
        paper(c, rect(-12, -136, 10, 40), 0x8A8F98, ol=1.5)
        paper(c, rect(8, -136, 10, 40), 0xB86A3A, ol=1.5)


def paper_sheet(c, x, y, s=1.0, rot=0.0, seed=0, lines=7, sketch=None, col=0xF6EEDC):
    with xf(c, x, y, rot, s):
        paper(c, rect(-70, -90, 140, 180), col, ol=2, seed=seed, sh=(3, 6, 6, 0.25))
        for k in range(lines):
            yy = -66 + k * 22
            p = skia.Path()
            p.moveTo(-50, yy)
            for j in range(10):
                p.lineTo(-50 + j * 10 + 5, yy + (3 if j % 2 else -3))
            stroke(c, p, 0x3A3A4A, 2, 0.6)
        if sketch:
            sketch(c)


def certificate(c, x, y, s=1.0, rot=0.0, seed=0, title='SHARES', alpha=1.0):
    with xf(c, x, y, rot, s):
        with alpha_layer(c, alpha):
            paper(c, rect(-170, -110, 340, 220), 0xF2E6C4, ol=2.5, seed=seed, sh=(4, 8, 8, 0.3))
            stroke(c, rect(-156, -96, 312, 192), 0x6E8B4A, 4, 0.9)
            stroke(c, rect(-146, -86, 292, 172), 0x6E8B4A, 1.6, 0.7)
            f = font('Rye-Regular.ttf', 30)
            draw_text(c, 'BELL TELEPHONE', 0, -40, f, 0x2E4A2A, align='center')
            draw_text(c, 'COMPANY', 0, -6, font('Rye-Regular.ttf', 26), 0x2E4A2A, align='center')
            draw_text(c, title, 0, 40, font('Anton-Regular.ttf', 30), PAL['red'], align='center')
            paper(c, circle(110, 60, 24), 0xC0392B, ol=2, seed=seed + 1)
            for k in range(3):
                line(c, -120, 62 + k * 10, 40, 62 + k * 10, 0x6E6450, 1.6, 0.6)


def gift_box(c, x, y, s=1.0, rot=0.0, seed=0, lid=0.0):
    with xf(c, x, y, rot, s):
        paper(c, rect(-70, -110, 140, 110), 0x5E8FB0, seed=seed, sh=(4, 8, 8, 0.3))
        paper(c, rect(-12, -110, 24, 110), 0xE57F93, ol=2, seed=seed + 1)
        with xf(c, 0, -110 - lid * 80, lid * -25):
            paper(c, rect(-80, -30, 160, 32), 0x6E9FC0, seed=seed + 2)
            paper(c, rect(-12, -30, 24, 32), 0xE57F93, ol=2, seed=seed + 3)
            paper(c, blob([(0, -30), (-34, -60), (-44, -36)], k=0.8), 0xE57F93, ol=2)
            paper(c, blob([(0, -30), (34, -60), (44, -36)], k=0.8), 0xE57F93, ol=2)


def flower_pot(c, x, y, s=1.0, seed=0, col=0xE0606E):
    with xf(c, x, y, 0, s):
        for k in range(5):
            a = -60 + k * 30
            with xf(c, 0, -60, a * 0.5):
                line(c, 0, 0, 0, -90, PAL['green_dk'], 4)
                paper(c, circle(0, -100, 20), [col, 0xF2C14E, 0xF6EEDC][k % 3], ol=2, seed=seed + k)
                flat(c, circle(0, -100, 7), 0xD9A23C)
            paper(c, oval(-20 + k * 10, -70, 16, 7), PAL['green'], ol=1.5)
        paper(c, poly([(-44, -64), (44, -64), (32, 0), (-32, 0)]), PAL['brick'], ol=2.5, seed=seed + 9)


def gravestone(c, x, y, s=1.0, seed=0, text='A.G.B.'):
    def draw():
        with xf(c, x, y, 0, s):
            paper(c, svg("M -110 0 L -110 -220 C -110 -300 110 -300 110 -220 L 110 0 Z"), 0x9AA0A0, seed=seed)
            flat(c, text_path(text, font('Rye-Regular.ttf', 44), 0, -170, align='center'), 0x5E6466, 0.9)
            flat(c, text_path('1847-1922', font('Anton-Regular.ttf', 30), 0, -120, align='center'), 0x5E6466, 0.8)
    with_shadow(c, draw, 6 * s, 10 * s, 9 * s, 0.3)


def umbrella(c, x, y, s=1.0, col=0x2A2D36, rot=0.0, seed=0):
    with xf(c, x, y, rot, s):
        line(c, 0, 0, 0, 200, 0x3A2A1E, 5)
        p = svg("M -130 0 C -120 -90 120 -90 130 0 Q 108 -12 86 0 Q 64 -12 43 0 Q 22 -12 0 0 Q -22 -12 -43 0 Q -64 -12 -86 0 Q -108 -12 -130 0 Z")
        paper(c, p, col, ol=2.5, seed=seed, sh=(4, 8, 8, 0.3))
        for k in (-86, -43, 0, 43, 86):
            stroke(c, svg(f"M 0 -64 Q {k * 0.6} -40 {k} 0"), shade(col, 1.25), 1.8, 0.6)


def stage_curtains(c, open_amt, t=0.0, col=0x8E2A2A, top=True):
    """two red curtains; open_amt 0 closed .. 1 open"""
    for sd in (-1, 1):
        def draw(sd=sd):
            w = W * 0.55 * (1 - 0.82 * eio(open_amt))
            x0 = 0 if sd < 0 else W - w
            pts = []
            n = 8
            for k in range(n + 1):
                u = k / n
                pts.append((x0 + u * w, -20 + math.sin(u * 20 + t) * 4))
            p = skia.Path()
            p.moveTo(x0, -20)
            p.lineTo(x0 + w, -20)
            sway = math.sin(t * 0.9 + sd) * 6
            p.cubicTo(x0 + w - 10 * sd, H * 0.4, x0 + w + sway, H * 0.7, x0 + w + sway * 1.5, H + 20)
            p.lineTo(x0, H + 20)
            p.close()
            paper(c, p, col, ol=3, seed=950 + sd)
            nf = max(3, int(w / 70))
            for k in range(nf):
                xx = x0 + (k + 0.5) * w / nf
                stroke(c, svg(f"M {xx} -10 C {xx + 6} {H * 0.4} {xx - 8} {H * 0.7} {xx + sway} {H + 10}"),
                       shade(col, 0.72), 6, 0.6)
                stroke(c, svg(f"M {xx + 16} -10 C {xx + 22} {H * 0.4} {xx + 8} {H * 0.7} {xx + 16 + sway} {H + 10}"),
                       shade(col, 1.2), 3, 0.35)
        with_shadow(c, draw, 10 * -sd, 8, 14, 0.4)
    if top:
        p = skia.Path()
        p.moveTo(-20, -20)
        p.lineTo(W + 20, -20)
        p.lineTo(W + 20, 120)
        for k in range(12, -1, -1):
            x = k * W / 12
            p.quadTo(x + W / 24, 170, x, 120)
        p.close()
        paper(c, p, shade(col, 0.85), ol=3, seed=960, sh=(0, 10, 12, 0.4))
        for k in range(13):
            flat(c, circle(k * W / 12, 124, 7), 0xD8B04A)


def sunburst(c, cx, cy, t, cols=(0xE8B84A, 0x3E8A8E), n=16, rot_speed=4.0, R=2400):
    with xf(c, cx, cy, t * rot_speed):
        for k in range(n):
            a0 = k / n * 360
            p = skia.Path()
            p.moveTo(0, 0)
            p.lineTo(math.cos(math.radians(a0)) * R, math.sin(math.radians(a0)) * R)
            p.lineTo(math.cos(math.radians(a0 + 360 / n)) * R, math.sin(math.radians(a0 + 360 / n)) * R)
            p.close()
            paper(c, p, cols[k % 2], ol=0, seed=970 + k)


def spotlight(c, x, y, r, a=0.9):
    """darkness everywhere except a soft circle (draw after scene)"""
    sh = skia.GradientShader.MakeRadial((x, y), r * 1.6, [C(0x000000, 0), C(0x000000, 0), C(0x05040A, a)],
                                        [0.0, 0.55, 1.0])
    c.drawRect(skia.Rect.MakeWH(W, H), skia.Paint(Shader=sh))


def brick_house(c, x, y, w, h, col=PAL['brick'], roof=0x4A3A3A, seed=0, t=0.0, smoke=True, lit=False, night=False):
    """row house; (x,y) = bottom-left"""
    def draw():
        paper(c, rect(x, y - h, w, h), col, seed=seed)
        # bricks
        for j in range(int(h / 26)):
            yy = y - h + 13 + j * 26
            off = 0 if j % 2 else 24
            for i in range(int(w / 48) + 1):
                xx = x + off + i * 48
                if xx < x + w - 8:
                    flat(c, rect(xx, yy, 36, 3), shade(col, 0.85), 0.45)
        # roof + chimney
        paper(c, rect(x + w * 0.7, y - h - 80, 34, 70), shade(col, 0.85), seed=seed + 1)
        paper(c, poly([(x - 14, y - h + 4), (x + w + 14, y - h + 4), (x + w - 10, y - h - 40), (x + 10, y - h - 40)]),
              roof, seed=seed + 2)
        # windows
        cols = max(1, int(w / 110))
        rows = max(1, int((h - 140) / 150))
        for r in range(rows):
            for k in range(cols):
                wx = x + (k + 0.5) * w / cols - 28
                wy = y - h + 40 + r * 150
                wc = 0xF6D27A if (lit or (night and hash01(seed, r, k) > 0.4)) else 0x9CC8D6
                paper(c, rect(wx, wy, 56, 84), wc, ol=3, seed=seed + 10 + r * 7 + k)
                line(c, wx + 28, wy, wx + 28, wy + 84, 0xF6EEDC, 4)
                line(c, wx, wy + 42, wx + 56, wy + 42, 0xF6EEDC, 4)
                paper(c, rect(wx - 6, wy + 84, 68, 10), 0xF6EEDC, ol=1.5)
        # door
        paper(c, rrect(x + w / 2 - 34, y - 120, 68, 120, 30), PAL['navy'], seed=seed + 5)
        flat(c, circle(x + w / 2 + 18, y - 60, 5), 0xC9A043)
        paper(c, rect(x + w / 2 - 50, y - 10, 100, 10), 0xD8CFC0, ol=1.5)
    with_shadow(c, draw, 6, 10, 9, 0.28)
    if smoke:
        smoke_wisps(c, x + w * 0.7 + 17, y - h - 84, t, 0.9, seed)


def lamp_post(c, x, y, s=1.0, lit=0.0, seed=0):
    def draw():
        with xf(c, x, y, 0, s):
            paper(c, rect(-8, -360, 16, 360), 0x2A2D36, seed=seed)
            paper(c, poly([(-30, -360), (30, -360), (20, -420), (-20, -420)]), 0x2A2D36, seed=seed + 1)
            paper(c, rect(-18, -412, 36, 46), 0xF6D27A, ol=2, seed=seed + 2)
    with_shadow(c, draw, 5 * s, 8 * s, 7 * s, 0.3)
    if lit:
        glow(c, x, y - 390 * s, 140 * s, 0xFFD27A, 0.5 * lit)


def switchboard(c, x, y, w, h, t=0.0, unplug=0.0, seed=0):
    """telephone switchboard panel with jacks + cords; unplug 0..1 removes plugs one by one"""
    def draw():
        paper(c, rect(x, y, w, h), PAL['wood_dk'], seed=seed)
        paper(c, rect(x + 20, y + 20, w - 40, h * 0.62), 0x2A2420, seed=seed + 1, ol=2)
        rows, cols = 5, 8
        for r in range(rows):
            for k in range(cols):
                jx = x + 50 + k * (w - 100) / (cols - 1)
                jy = y + 50 + r * (h * 0.62 - 60) / (rows - 1)
                flat(c, circle(jx, jy, 9), 0xC9A043)
                flat(c, circle(jx, jy, 4), 0x111111)
        paper(c, rect(x, y + h * 0.66, w, h * 0.34), PAL['wood'], seed=seed + 2)
    with_shadow(c, draw, 6, 10, 9, 0.3)
    # cords: plugged into jacks, removed progressively
    rows, cols = 5, 8
    idx = 0
    for r in range(rows):
        for k in range(cols):
            if hash01(seed, r, k) < 0.55:
                continue
            idx += 1
            order = hash01(seed, r, k, 9)
            gone = clamp((unplug - order * 0.8) * 5)
            jx = x + 50 + k * (w - 100) / (cols - 1)
            jy = y + 50 + r * (h * 0.62 - 60) / (rows - 1)
            bx = x + 40 + hash01(seed, r, k, 3) * (w - 80)
            by = y + h * 0.80
            px = lerp(jx, bx, eio(gone))
            py = lerp(jy, by - 30, eio(gone))
            col = [PAL['red'], PAL['mustard'], 0x3E7C86, 0xF6EEDC][idx % 4]
            p = skia.Path()
            p.moveTo(bx, by)
            p.cubicTo(bx, by + 60, px, py + 120 * (1 - gone) + 40, px, py + 14)
            stroke(c, p, 0x1A1A1A, 6, 0.9)
            paper(c, rrect(px - 8, py - 6, 16, 26, 6), col, ol=1.8, seed=idx)


def usa_map_path():
    # simplified contiguous USA outline in a 0..1000 x 0..600 box
    pts = [(40, 120), (90, 60), (210, 70), (380, 80), (520, 95), (600, 110), (640, 90), (700, 100), (730, 150),
           (790, 120), (860, 70), (900, 90), (880, 150), (860, 200), (900, 210), (950, 190), (940, 250), (890, 300),
           (860, 360), (830, 420), (870, 520), (850, 560), (800, 500), (760, 440), (700, 450), (640, 470), (600, 520),
           (560, 560), (520, 520), (470, 480), (400, 470), (330, 480), (260, 440), (200, 400), (140, 380), (90, 330),
           (60, 260), (40, 200)]
    return blob(pts, k=0.6)


def phone_icon(c, x, y, s=1.0, lit=1.0, seed=0):
    with xf(c, x, y, 0, s):
        col = mix(0x4A4A50, 0xF2C14E, lit)
        if lit > 0.05:
            glow(c, 0, 0, 46, 0xFFE08A, 0.55 * lit)
        paper(c, circle(0, 0, 20), col, ol=2.2, seed=seed, tex=False)
        p = svg("M -8 -7 Q -9 4 0 9 Q 4 11 8 7 L 4 3 Q 1 5 -1 3 Q -4 0 -3 -3 L -5 -9 Z")
        flat(c, p, mix(0x2A2A2E, 0x5A3A10, lit))


def clock_face(c, x, y, r, minutes=0.0, seconds=0.0, seed=0):
    def draw():
        paper(c, circle(x, y, r + 26), PAL['wood_dk'], seed=seed)
        paper(c, circle(x, y, r), 0xF6EEDC, seed=seed + 1)
    with_shadow(c, draw, 7, 12, 10, 0.32)
    for k in range(60):
        a = k / 60 * 2 * math.pi
        L = 22 if k % 5 == 0 else 9
        w = 5 if k % 5 == 0 else 2.4
        line(c, x + math.sin(a) * (r - 14), y - math.cos(a) * (r - 14), x + math.sin(a) * (r - 14 - L),
             y - math.cos(a) * (r - 14 - L), 0x2A1E16, w)
    f = font('Rye-Regular.ttf', int(r * 0.18))
    for k in range(1, 13):
        a = k / 12 * 2 * math.pi
        draw_text(c, str(k), x + math.sin(a) * (r * 0.72), y - math.cos(a) * (r * 0.72) + r * 0.065, f, 0x2A1E16,
                  align='center')
    ha = (minutes / 60.0) * 2 * math.pi / 12 * 1 + 2 * math.pi * (10 / 12)
    ma = minutes / 60.0 * 2 * math.pi
    sa = seconds / 60.0 * 2 * math.pi
    line(c, x, y, x + math.sin(ha) * r * 0.5, y - math.cos(ha) * r * 0.5, 0x2A1E16, 12)
    line(c, x, y, x + math.sin(ma) * r * 0.74, y - math.cos(ma) * r * 0.74, 0x2A1E16, 8)
    line(c, x - math.sin(sa) * r * 0.15, y + math.cos(sa) * r * 0.15, x + math.sin(sa) * r * 0.84,
         y - math.cos(sa) * r * 0.84, PAL['red'], 4)
    flat(c, circle(x, y, 12), PAL['red'])
    rivet(c, x, y, 6)


def silhouette_profile(c, x, y, s=1.0, col=0x1E1A22, alpha=1.0):
    """Victorian cameo-style paper silhouette of a young woman (profile facing right) with bun + ribbon"""
    with xf(c, x, y, 0, s):
        p = svg("M -20 -230 C 30 -250 80 -230 96 -190 C 106 -168 104 -150 112 -134 C 118 -122 132 -112 128 -102 "
                "C 124 -96 116 -96 114 -90 C 112 -84 120 -80 116 -74 C 112 -70 108 -72 108 -66 C 108 -58 112 -50 104 -42 "
                "C 96 -34 80 -36 70 -30 C 60 -22 64 -6 70 10 C 90 20 140 40 150 90 L 150 130 L -150 130 L -150 90 "
                "C -140 50 -100 30 -60 18 C -40 6 -40 -20 -50 -40 C -80 -70 -96 -110 -90 -150 C -86 -196 -60 -224 -20 -230 Z")
        paper(c, p, col, ol=4, olc=C(0xF6EEDC), alpha=alpha, seed=990)
        paper(c, circle(-70, -220, 42), col, ol=4, olc=C(0xF6EEDC), alpha=alpha, seed=991)
        # ribbon bow silhouette in the hair
        with xf(c, -30, -236, -10):
            paper(c, blob([(0, 0), (-18, -18), (-38, -16), (-40, 4), (-18, 10)], k=0.9), 0xE57F93, ol=3, alpha=alpha)
            paper(c, blob([(0, 0), (18, -18), (38, -16), (40, 4), (18, 10)], k=0.9), 0xE57F93, ol=3, alpha=alpha)
            paper(c, circle(0, 0, 8), 0xC25D73, ol=2, alpha=alpha)
