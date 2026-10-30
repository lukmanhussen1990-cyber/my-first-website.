"""Scene props, all flat vector shapes with a dark outline."""
import math

import numpy as np

from gfx import INK, bezier, clamp, fade, lerp, rrect_pts, star_pts, text_width

OL = 5.0
YELLOW = "#FFD93B"
RED = "#FF4D5E"


def badge(cv, text, x, y, scale=1.0, rot=0.0, fill="#FFFFFF", fg=INK, icon=None, size=62):
    if scale <= 0.01:
        return
    tw = text_width(text, size)
    iw = 70 if icon else 0
    w, h = tw + iw + 76, size * 1.62
    with cv.group(x, y, s=scale, rot=rot):
        cv.rrect(-w / 2 + 6, -h / 2 + 10, w / 2 + 6, h / 2 + 10, h / 2, fill=fade("#000000", 0.18))
        cv.rrect(-w / 2, -h / 2, w / 2, h / 2, h / 2, fill=fill, line=INK, lw=OL + 1)
        if icon == "clock":
            mini_clock(cv, -w / 2 + 38 + 26, 0, 28)
        elif icon == "moon":
            crescent(cv, -w / 2 + 38 + 26, 0, 27, "#FFD54A")
        elif icon == "up":
            cv.poly([(-w / 2 + 64, -28), (-w / 2 + 92, 4), (-w / 2 + 74, 4), (-w / 2 + 74, 28),
                     (-w / 2 + 54, 28), (-w / 2 + 54, 4), (-w / 2 + 36, 4)], fill="#2ECC71", line=INK, lw=4)
        cv.text(text, iw / 2, 2, size, color=fg, rot=rot)


def mini_clock(cv, x, y, r):
    cv.circle(x, y, r, fill="#FF6B6B", line=INK, lw=4)
    cv.circle(x, y, r * 0.72, fill="#FFFFFF")
    cv.stroke([(x, y), (x, y - r * 0.5)], 5, INK)
    cv.stroke([(x, y), (x + r * 0.38, y)], 5, INK)


def clock(cv, x, y, r, minute_deg, hour_deg, rim="#FF6B6B"):
    cv.soft_shadow(x + 8, y + 14, r * 0.98, r * 0.98, alpha=0.18)
    cv.circle(x, y, r, fill=rim, line=INK, lw=OL + 1)
    cv.circle(x, y, r * 0.82, fill="#FFFFFF", line=INK, lw=3)
    for i in range(12):
        a = math.radians(i * 30)
        r0 = r * (0.62 if i % 3 == 0 else 0.68)
        cv.stroke([(x + r0 * math.sin(a), y - r0 * math.cos(a)),
                   (x + r * 0.74 * math.sin(a), y - r * 0.74 * math.cos(a))],
                  7 if i % 3 == 0 else 4, INK)
    for deg, ln, lw in ((hour_deg, 0.42, 12), (minute_deg, 0.62, 8)):
        a = math.radians(deg)
        cv.stroke([(x, y), (x + r * ln * math.sin(a), y - r * ln * math.cos(a))], lw, INK)
    cv.circle(x, y, 10, fill=RED, line=INK, lw=3)
    # bells
    for side in (-1, 1):
        cv.ellipse(x + side * r * 0.62, y - r * 0.92, r * 0.24, r * 0.16, fill=rim, line=INK, lw=4)


def mirror(cv, x, y, w, h):
    """Draw a standing mirror, return the glass outline for clipping."""
    cv.soft_shadow(x, y + h / 2 + 6, w * 0.55, 18, alpha=0.25)
    cv.rrect(x - w / 2, y - h / 2, x + w / 2, y + h / 2, w * 0.5, fill="#F6B44B", line=INK, lw=OL + 1)
    cv.rrect(x - w / 2 + 12, y - h / 2 + 12, x + w / 2 - 12, y + h / 2 - 12, w * 0.45,
             fill=fade("#FFD27A", 1.0))
    gx0, gy0, gx1, gy1 = x - w / 2 + 26, y - h / 2 + 26, x + w / 2 - 26, y + h / 2 - 26
    glass = rrect_pts(gx0, gy0, gx1, gy1, (gx1 - gx0) * 0.5, n=14)
    cv.poly(glass, fill="#CFEFFF", line=INK, lw=4)
    return glass


def mirror_shine(cv, x, y, w, h, t):
    gx0, gy0 = x - w / 2 + 26, y - h / 2 + 26
    for i, (dx, ww) in enumerate(((0.18, 34), (0.38, 16))):
        o = (t * 0.25 + i * 0.1) % 1.0
        cx = gx0 + (w - 52) * (dx + 0.15 * math.sin(o * 6.28))
        pts = [(cx, gy0 + 60), (cx + ww, gy0 + 60), (cx + ww - 90, gy0 + 260), (cx - 90, gy0 + 260)]
        cv.poly(pts, fill=fade("#FFFFFF", 0.45))


def sparkle(cv, x, y, r, alpha=1.0, color="#FFFFFF", rot=0.0):
    if alpha <= 0 or r <= 0:
        return
    with cv.group(x, y, rot=rot, alpha=alpha):
        cv.poly(star_pts(0, 0, r, r * 0.28, n=4), fill=color)


def burst(cv, x, y, t, t0, n=8, r0=40, r1=170, dur=0.6, color=YELLOW, size=22):
    p = (t - t0) / dur
    if p <= 0 or p >= 1:
        return
    e = 1 - (1 - p) ** 2
    for i in range(n):
        a = math.radians(i * 360 / n + 12)
        r = lerp(r0, r1, e)
        sparkle(cv, x + r * math.cos(a), y + r * math.sin(a), size * (1 - p) + 4, 1 - p ** 2, color,
                rot=p * 90)


def starburst(cv, x, y, r, text, scale=1.0, rot=0.0, fill=YELLOW, size=48):
    if scale <= 0.01:
        return
    with cv.group(x, y, s=scale, rot=rot):
        cv.poly(star_pts(4, 8, r, r * 0.72, n=12), fill=fade("#000000", 0.18))
        cv.poly(star_pts(0, 0, r, r * 0.72, n=12), fill=fill, line=INK, lw=OL)
        cv.text(text, 0, 2, size, color=INK, rot=rot)


def no_sign(cv, x, y, r, alpha=1.0, lw=None):
    lw = lw or r * 0.22
    with cv.group(x, y, alpha=alpha):
        cv.circle(0, 0, r, line=INK, lw=lw + 10)
        cv.circle(0, 0, r, line=RED, lw=lw)
        a = math.radians(45)
        d = r - 2
        cv.ostroke([(-d * math.cos(a), -d * math.sin(a)), (d * math.cos(a), d * math.sin(a))], lw, RED, 5)
        cv.circle(0, 0, r, line=RED, lw=lw * 0.7)


def lock_icon(cv, x, y, s, color="#FFFFFF", body="#FFC93C"):
    with cv.group(x, y, s=s):
        cv.arc(0, -18, 26, 30, 180, 360, 13, INK, cap=True)
        cv.arc(0, -18, 26, 30, 180, 360, 7, color, cap=True)
        cv.stroke([(-26, -18), (-26, 2)], 13, INK)
        cv.stroke([(26, -18), (26, 2)], 13, INK)
        cv.stroke([(-26, -18), (-26, 2)], 7, color)
        cv.stroke([(26, -18), (26, 2)], 7, color)
        cv.rrect(-40, -4, 40, 52, 12, fill=body, line=INK, lw=OL)
        cv.circle(0, 18, 8, fill=INK)
        cv.stroke([(0, 20), (0, 36)], 7, INK)


def phone(cv, x, y, w, h, screen_on=1.0, lock=0.0, no=0.0, rot=0.0, scale=1.0, t=0.0):
    if scale <= 0.01:
        return
    with cv.group(x, y, s=scale, rot=rot):
        cv.rrect(-w / 2 + 8, -h / 2 + 14, w / 2 + 8, h / 2 + 14, 26, fill=fade("#000000", 0.2))
        if screen_on > 0.01:
            cv.glow(0, 0, h * 0.75, "#9FE3FF", alpha=0.45 * screen_on)
        cv.rrect(-w / 2, -h / 2, w / 2, h / 2, 26, fill="#262A44", line=INK, lw=OL)
        sx0, sy0, sx1, sy1 = -w / 2 + 10, -h / 2 + 22, w / 2 - 10, h / 2 - 22
        cv.rrect(sx0, sy0, sx1, sy1, 14, fill="#11132A")
        if screen_on > 0.01:
            with cv.group(alpha=screen_on):
                cv.rrect(sx0, sy0, sx1, sy1, 14, fill="#7FD0FF")
                cv.rrect(sx0, sy0, sx1, sy0 + (sy1 - sy0) * 0.45, 14, fill="#A9E4FF")
                for i in range(3):
                    yy = sy0 + (sy1 - sy0) * (0.58 + i * 0.12)
                    cv.rrect(sx0 + 14, yy, sx1 - 14 - i * 18, yy + 10, 5, fill=fade("#FFFFFF", 0.8))
        cv.rrect(-w * 0.14, -h / 2 + 8, w * 0.14, -h / 2 + 14, 3, fill="#4A4F72")
        if lock > 0.01:
            lock_icon(cv, 0, -h * 0.06, (w / 150) * lock)
        if no > 0.01:
            no_sign(cv, 0, 0, w * 0.62 * no)


def crescent(cv, x, y, r, color, lw=3.5):
    """Moon crescent: the outer disc minus an offset disc, as one polygon."""
    ox, oy, r2 = x + r * 0.45, y - r * 0.32, r * 0.8
    th = np.linspace(0, 2 * np.pi, 160, endpoint=False)
    outer = np.c_[x + r * np.cos(th), y + r * np.sin(th)]
    inner = np.c_[ox + r2 * np.cos(th), oy + r2 * np.sin(th)]
    keep_o = np.hypot(outer[:, 0] - ox, outer[:, 1] - oy) > r2
    keep_i = np.hypot(inner[:, 0] - x, inner[:, 1] - y) < r
    start = int(np.argmin(keep_o))
    outer, keep_o = np.roll(outer, -start, 0), np.roll(keep_o, -start)
    start = int(np.argmin(keep_i))
    inner, keep_i = np.roll(inner, -start, 0), np.roll(keep_i, -start)
    arc_o, arc_i = outer[keep_o], inner[keep_i]
    # join the outer arc's end to the nearer end of the inner arc
    if np.hypot(*(arc_o[-1] - arc_i[0])) > np.hypot(*(arc_o[-1] - arc_i[-1])):
        arc_i = arc_i[::-1]
    cv.poly(np.vstack([arc_o, arc_i]), fill=color, line=INK, lw=lw)


def heart_pts(cx, cy, s, n=90):
    t = np.linspace(0, 2 * np.pi, n, endpoint=False)
    x = 16 * np.sin(t) ** 3
    y = -(13 * np.cos(t) - 5 * np.cos(2 * t) - 2 * np.cos(3 * t) - np.cos(4 * t))
    return np.c_[cx + x * s / 16, cy + (y + 2) * s / 16]


def heart(cv, x, y, s, color="#FF5C7C", alpha=1.0):
    with cv.group(alpha=alpha):
        cv.poly(heart_pts(x + 8, y + 14, s), fill=fade("#000000", 0.16))
        cv.poly(heart_pts(x, y, s), fill=color, line=INK, lw=OL + 1)
        cv.ellipse(x - s * 0.45, y - s * 0.38, s * 0.16, s * 0.24, fill=fade("#FFFFFF", 0.55))


def wave(cv, base_y, height, t, alpha=1.0):
    """A big cartoon wave rising from base_y."""
    if height <= 2 or alpha <= 0.01:
        return
    xs = np.linspace(-60, 1140, 90)
    with cv.group(alpha=alpha):
        for layer, (col, hf, ph, sp) in enumerate((("#2F6FE0", 1.0, 0.0, 1.0),
                                                   ("#4B95FF", 0.82, 1.7, 1.4))):
            h = height * hf
            crest = 540 + 160 * math.sin(t * 0.7 + layer)
            top = base_y - h * (0.72 + 0.1 * np.sin(xs / 150 + t * 2.0 * sp + ph)
                                + 0.32 * np.exp(-((xs - crest) / 170) ** 2))
            pts = np.vstack([np.c_[xs, top], [[1140, base_y + 400], [-60, base_y + 400]]])
            cv.poly(pts, fill=col, line=INK, lw=OL)
            cv.stroke(np.c_[xs, top + 10], 14, fade("#FFFFFF", 0.85), cap=False)
            for fx in np.arange(-40 + (t * 60 * sp) % 70, 1140, 70):
                fy = np.interp(fx, xs, top)
                cv.circle(fx, fy + 4, 13, fill=fade("#FFFFFF", 0.9))
            for i in range(9):
                bx = (i * 137 + t * 40 * sp) % 1200 - 60
                by = base_y - h * (0.25 + 0.4 * ((i * 0.37) % 1))
                cv.circle(bx, by, 7 + (i % 3) * 4, fill=fade("#FFFFFF", 0.35))


def hourglass(cv, x, y, h, rot, top_amt, bot_amt, flowing, t, scale=1.0):
    if scale <= 0.01:
        return
    hi = h * 0.40
    wmax, neck = h * 0.27, h * 0.03
    ys = np.linspace(-hi, hi, 60)
    u = np.abs(ys) / hi
    hw = neck + (wmax - neck) * np.sin(np.pi * u * 0.88) ** 0.75
    with cv.group(x, y, s=scale, rot=rot):
        glass = np.vstack([np.c_[hw, ys], np.c_[-hw, ys][::-1]])
        cv.poly(glass, fill=fade("#E3F6FF", 0.9))
        if top_amt > 0.01:
            lv = -hi * 0.9 * top_amt
            m = ys <= 0
            yy, ww = ys[m], hw[m]
            keep = yy >= lv
            yy, ww = yy[keep], ww[keep]
            if len(yy) > 1:
                pts = np.vstack([np.c_[ww, yy], np.c_[-ww, yy][::-1]])
                cv.poly(pts, fill="#FFC23D")
        if bot_amt > 0.01:
            m = ys >= 0
            yy, ww = ys[m], hw[m]
            ph = hi * 0.85 * bot_amt
            keep = yy >= hi - ph
            yy, ww = yy[keep], ww[keep]
            if len(yy) > 1:
                mound = hi - ph - ph * 0.35
                pts = np.vstack([np.c_[ww, yy][::-1], np.c_[-ww, yy],
                                 bezier((-ww[0], yy[0]), (-ww[0] * 0.3, mound), (ww[0] * 0.3, mound),
                                        (ww[0], yy[0]), 16)])
                cv.poly(pts, fill="#FFC23D")
        if flowing:
            pile = hi - hi * 0.85 * bot_amt - hi * 0.3 * bot_amt
            cv.stroke([(0, -4), (0, pile)], 5, "#FFC23D")
            for i in range(3):
                yy = ((t * 2.5 + i / 3) % 1) * pile
                cv.circle(0, yy, 4, fill="#FFB000")
        cv.poly(glass, line=INK, lw=OL)
        cv.poly([(hw[8] * 0.7, -hi * 0.75), (hw[8] * 0.85, -hi * 0.75), (hw[20] * 0.5, -hi * 0.3)],
                fill=fade("#FFFFFF", 0.7))
        for sgn in (-1, 1):
            cv.rrect(-wmax - 30, sgn * hi - 18, wmax + 30, sgn * hi + 18, 14, fill="#B9733B",
                     line=INK, lw=OL)
        for sx in (-1, 1):
            cv.ostroke([(sx * (wmax + 16), -hi + 14), (sx * (wmax + 16), hi - 14)], 12, "#D98B4A", 4.5)


def icon_bubble(cv, x, y, r, kind, scale=1.0, rot=0.0):
    if scale <= 0.01:
        return
    with cv.group(x, y, s=scale, rot=rot):
        cv.circle(6, 12, r, fill=fade("#000000", 0.16))
        cv.circle(0, 0, r, fill="#FFFFFF", line=INK, lw=OL + 1)
        if kind == "dumbbell":
            cv.rrect(-48, -7, 48, 7, 6, fill="#A7AFC4", line=INK, lw=4)
            for sx in (-1, 1):
                cv.rrect(sx * 30 - 9, -30, sx * 30 + 9, 30, 6, fill="#5865F2", line=INK, lw=4)
                cv.rrect(sx * 46 - 7, -21, sx * 46 + 7, 21, 5, fill="#5865F2", line=INK, lw=4)
        elif kind == "book":
            cv.poly([(-52, -30), (0, -20), (52, -30), (52, 34), (0, 44), (-52, 34)], fill="#29B6F6",
                    line=INK, lw=4)
            cv.poly([(-46, -34), (-2, -24), (-2, 36), (-46, 26)], fill="#FFFFFF", line=INK, lw=3.5)
            cv.poly([(46, -34), (2, -24), (2, 36), (46, 26)], fill="#FFFFFF", line=INK, lw=3.5)
            for i in range(3):
                yy = -12 + i * 14
                cv.stroke([(-38, yy - 4), (-10, yy + 2)], 3.5, "#9DB0C8")
                cv.stroke([(10, yy + 2), (38, yy - 4)], 3.5, "#9DB0C8")
        elif kind == "friends":
            for dx, col, s in ((-24, "#8E7CFF", 1.0), (24, "#FFB020", 1.0)):
                cv.ellipse(dx, 34, 26 * s, 24, fill=col, line=INK, lw=4)
                cv.circle(dx, -6, 19 * s, fill="#F7C594", line=INK, lw=4)
                cv.circle(dx - 6, -9, 3, fill=INK)
                cv.circle(dx + 6, -9, 3, fill=INK)
                cv.arc(dx, -4, 8, 6, 20, 160, 3, INK)
            heart(cv, 0, -44, 13, alpha=1.0)


def cloud_bubble(cv, x, y, w, h, tail=(-1, 1), scale=1.0, alpha=1.0):
    if scale <= 0.01 or alpha <= 0.01:
        return
    with cv.group(x, y, s=scale, alpha=alpha):
        blobs = [(-w * 0.3, 0, h * 0.45), (0, -h * 0.12, h * 0.55), (w * 0.3, 0, h * 0.45),
                 (-w * 0.12, h * 0.15, h * 0.42), (w * 0.14, h * 0.15, h * 0.42)]
        for bx, by, r in blobs:
            cv.circle(bx, by, r, line=INK, lw=OL * 2)
        for bx, by, r in blobs:
            cv.circle(bx, by, r, fill="#FFFFFF")
        tx, ty = tail
        cv.circle(tx * w * 0.32, ty * h * 0.62, h * 0.12, fill="#FFFFFF", line=INK, lw=OL)
        cv.circle(tx * w * 0.42, ty * h * 0.85, h * 0.07, fill="#FFFFFF", line=INK, lw=OL)


def gauge(cv, x, y, r, value, label_alpha=1.0):
    """Semicircle meter centered at hub (x, y). value 0..1 sweeps left -> right."""
    band = r * 0.17
    segs = (("#7FB2FF", 180, 240), ("#4CD18A", 240, 300), ("#FF9F43", 300, 360))
    for col, a0, a1 in segs:
        cv.arc(x, y, r, r, a0, a1, band + 10, INK, cap=False)
    for col, a0, a1 in segs:
        cv.arc(x, y, r, r, a0 + 0.6, a1 - 0.6, band, col, cap=False)
    for i in range(11):
        a = math.radians(180 + i * 18)
        r0, r1 = r - band / 2 - 30, r - band / 2 - 10
        cv.stroke([(x + r0 * math.cos(a), y + r0 * math.sin(a)), (x + r1 * math.cos(a), y + r1 * math.sin(a))],
                  6 if i % 5 == 0 else 4, INK)
    a = math.radians(180 + 180 * clamp(value))
    tip = (x + (r - band / 2 - 24) * math.cos(a), y + (r - band / 2 - 24) * math.sin(a))
    cv.ostroke([(x, y), tip], 14, RED, 4.5)
    cv.circle(x, y, 24, fill="#FFFFFF", line=INK, lw=OL)
    cv.circle(x, y, 9, fill=RED)


def calendar(cv, x, y, w, h, day, flip, scale=1.0):
    """Tear-off calendar; flip in 0..1 animates the top page folding away."""
    if scale <= 0.01:
        return
    with cv.group(x, y, s=scale):
        cv.rrect(-w / 2 + 8, -h / 2 + 14, w / 2 + 8, h / 2 + 14, 24, fill=fade("#000000", 0.18))
        cv.rrect(-w / 2, -h / 2, w / 2, h / 2, 24, fill="#FFFFFF", line=INK, lw=OL + 1)
        hdr = -h / 2 + h * 0.28
        corners = rrect_pts(-w / 2, -h / 2, w / 2, hdr + 40, 24)
        top_edge = np.vstack([corners[24:32], corners[0:8]])  # top-left then top-right corner
        cv.poly(np.vstack([top_edge, [[w / 2, hdr], [-w / 2, hdr]]]), fill=RED)
        cv.stroke([(-w / 2 + 3, hdr), (w / 2 - 3, hdr)], OL, INK)
        cv.text("DAY", 0, -h / 2 + h * 0.15, h * 0.13, color="#FFFFFF")
        for sx in (-1, 1):
            cv.rrect(sx * w * 0.25 - 8, -h / 2 - 22, sx * w * 0.25 + 8, -h / 2 + 18, 8, fill="#C9CEDB",
                     line=INK, lw=4)
        mid = (hdr + h / 2) / 2
        if flip > 0:
            nxt = str(day + 1)
            cv.text(nxt, 0, mid + 6, h * 0.5, color=INK)
            sy = math.cos(flip * math.pi / 2)
            if sy > 0.02:
                with cv.group(0, hdr, sy=sy):
                    cv.rrect(-w / 2 + 6, 0, w / 2 - 6, h / 2 - hdr - 6, 18, fill="#FFFFFF")
                    cv.text(str(day), 0, (h / 2 - hdr) / 2 + 6, h * 0.5, color=INK)
                cv.stroke([(-w / 2 + 6, hdr + (h / 2 - hdr - 6) * sy), (w / 2 - 6, hdr + (h / 2 - hdr - 6) * sy)],
                          3, fade(INK, 0.5))
        else:
            cv.text(str(day), 0, mid + 6, h * 0.5, color=INK)


def bed(cv, x0, y_top, x1, y_floor):
    """Bed frame + mattress; returns the y of the mattress top."""
    cv.soft_shadow((x0 + x1) / 2, y_floor + 4, (x1 - x0) * 0.52, 22, alpha=0.3)
    cv.rrect(x0, y_top - 120, x0 + 56, y_floor, 24, fill="#8A5A3C", line=INK, lw=OL)
    for xx in (x0 + 70, x1 - 30):
        cv.rrect(xx - 12, y_floor - 60, xx + 12, y_floor, 6, fill="#6E452D", line=INK, lw=4)
    cv.rrect(x0 + 40, y_top + 40, x1, y_floor - 46, 16, fill="#A06A46", line=INK, lw=OL)
    cv.rrect(x0 + 46, y_top, x1 - 6, y_top + 62, 22, fill="#F1F4FF", line=INK, lw=OL)
    return y_top


def nightstand(cv, x, y_floor, w=190, h=170):
    cv.soft_shadow(x, y_floor + 4, w * 0.55, 16, alpha=0.3)
    cv.rrect(x - w / 2, y_floor - h, x + w / 2, y_floor, 16, fill="#9B6B47", line=INK, lw=OL)
    cv.rrect(x - w / 2 + 16, y_floor - h + 26, x + w / 2 - 16, y_floor - h / 2 - 6, 10, fill="#B78057",
             line=INK, lw=4)
    cv.circle(x, y_floor - h * 0.72 + 3, 7, fill=INK)
    return y_floor - h


def follow_button(cv, x, y, scale=1.0, pressed=0.0):
    if scale <= 0.01:
        return
    with cv.group(x, y, s=scale * (1 - 0.08 * pressed)):
        cv.rrect(-160 + 6, -48 + 10, 160 + 6, 48 + 10, 48, fill=fade("#000000", 0.2))
        cv.rrect(-160, -48, 160, 48, 48, fill="#FF3D7F", line=INK, lw=OL + 1)
        cv.text("+ FOLLOW", 0, 2, 48, color="#FFFFFF")


def confetti(cv, t, seed=3, n=36, alpha=1.0, y0=-60):
    rng = np.random.default_rng(seed)
    cols = ["#FFD93B", "#FF6B9A", "#4DD0E1", "#7CFF8A", "#FFFFFF", "#FF9F43"]
    xs, sp, ph, ci, sz = rng.uniform(0, 1080, n), rng.uniform(140, 260, n), rng.uniform(0, 1, n), \
        rng.integers(0, len(cols), n), rng.uniform(12, 22, n)
    with cv.group(alpha=alpha):
        for i in range(n):
            yy = (ph[i] * 2200 + t * sp[i]) % 2200 + y0
            xx = xs[i] + 40 * math.sin(t * 2 + i)
            with cv.group(xx, yy, rot=t * 180 + i * 37):
                cv.rrect(-sz[i] / 2, -sz[i] / 4, sz[i] / 2, sz[i] / 4, 3, fill=cols[ci[i]])


def floaters(cv, t, seed, color="#FFFFFF", alpha=0.18, n=14, rmin=18, rmax=70):
    """Slow drifting soft circles for background motion."""
    rng = np.random.default_rng(seed)
    xs, ys = rng.uniform(0, 1080, n), rng.uniform(0, 1920, n)
    rs, sp, ph = rng.uniform(rmin, rmax, n), rng.uniform(10, 30, n), rng.uniform(0, 6.28, n)
    for i in range(n):
        x = (xs[i] + 30 * math.sin(t * 0.4 + ph[i])) % 1180 - 50
        y = (ys[i] - t * sp[i]) % 2040 - 60
        cv.circle(x, y, rs[i], fill=fade(color, alpha))


def ground(cv, y, color, alpha=1.0):
    pts = np.vstack([bezier((-40, y + 20), (300, y - 30), (780, y - 30), (1120, y + 20), 30),
                     [[1120, 1960], [-40, 1960]]])
    cv.poly(pts, fill=fade(color, alpha))


def exclaim(cv, x, y, s, alpha=1.0, rot=0.0):
    if s <= 0.01:
        return
    with cv.group(x, y, s=s, rot=rot, alpha=alpha):
        cv.poly([(-11, -50), (11, -50), (6, 12), (-6, 12)], fill=YELLOW, line=INK, lw=4.5)
        cv.circle(0, 34, 10, fill=YELLOW, line=INK, lw=4.5)



def bolt(cv, x, y, s=1.0, color="#FFD93B"):
    with cv.group(x, y, s=s):
        cv.poly([(14, -64), (-34, 8), (-2, 8), (-16, 64), (34, -12), (2, -12), (22, -64)], fill=color,
                line=INK, lw=OL)


def rays(cv, cx, cy, rot, n=16, color="#FFFFFF", alpha=0.12, r=2600):
    for i in range(n):
        a0 = math.radians(rot + i * 360 / n)
        a1 = a0 + math.radians(180 / n)
        cv.poly([(cx, cy), (cx + r * math.cos(a0), cy + r * math.sin(a0)),
                 (cx + r * math.cos(a1), cy + r * math.sin(a1))], fill=fade(color, alpha))


def pill(cv, text, x, y, size, scale=1.0, rot=0.0, fill="#FFFFFF", fg=INK):
    badge(cv, text, x, y, scale, rot, fill, fg, size=size)
