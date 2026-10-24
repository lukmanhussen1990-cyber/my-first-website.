"""Prop library, drawn in the same line style as the characters.

Each prop is `draw(cv, P, seed)` where P holds its (animated) parameters plus
`tl` (seconds since the prop appeared) and `draw` (0..1 line draw-on).
Coordinates are canvas pixels (1080x1920).
"""
from __future__ import annotations

import math

import cairo
import numpy as np

from .ink import GROUND_Y, Canvas, _rng, arc, color, hand_circle, quad, rot, spline, text_width, through

PW = 4.5  # prop stroke width


def rect_pts(x0, y0, x1, y1):
    return np.array([(x0, y0), (x1, y0), (x1, y1), (x0, y1)], float)


def rrect_pts(x0, y0, x1, y1, r, n=5):
    pts = []
    for cx, cy, a0 in ((x1 - r, y0 + r, -math.pi / 2), (x1 - r, y1 - r, 0), (x0 + r, y1 - r, math.pi / 2),
                       (x0 + r, y0 + r, math.pi)):
        for a in np.linspace(a0, a0 + math.pi / 2, n):
            pts.append((cx + r * math.cos(a), cy + r * math.sin(a)))
    return np.array(pts)


def heart_pts(cx, cy, s, n=40):
    t = np.linspace(0, 2 * math.pi, n, endpoint=False)
    x = 16 * np.sin(t) ** 3
    y = -(13 * np.cos(t) - 5 * np.cos(2 * t) - 2 * np.cos(3 * t) - np.cos(4 * t))
    return np.stack([cx + x * s / 16, cy + y * s / 16], 1)


def bumpy(cx, cy, rx, ry, bumps, seed, depth=0.16, n_per=14):
    """Cloud / canopy / brain outline: ellipse of round bumps."""
    rr = _rng(("bumpy", seed))
    a = np.linspace(0, 2 * math.pi, bumps, endpoint=False) + rr.uniform(0, 0.5)
    pts = []
    for i in range(bumps):
        a0, a1 = a[i], a[(i + 1) % bumps] + (2 * math.pi if i == bumps - 1 else 0)
        for u in np.linspace(0, 1, n_per, endpoint=False):
            ang = a0 + (a1 - a0) * u
            bump = 1 + depth * math.sin(math.pi * u) * (0.85 + 0.3 * rr.uniform())
            pts.append((cx + rx * bump * math.cos(ang), cy + ry * bump * math.sin(ang)))
    return np.array(pts)


def outlined(cv: Canvas, pts, seed, fill="fill", stroke="ink", width=PW, progress=1.0, fill_alpha=1.0,
             stroke_alpha=1.0, dash=None):
    if fill:
        cv.fill(pts, (seed, "f"), fill, alpha=fill_alpha * min(1.0, progress * 1.6))
    cv.stroke(pts, (seed, "s"), width, stroke, alpha=stroke_alpha, progress=progress, closed=True, dash=dash)


# --------------------------------------------------------------------- props
def draw_ground(cv, P, seed):
    x0, x1, y = P.get("x0", 75), P.get("x1", 1005), P.get("y", GROUND_Y)
    cv.stroke(np.array([(x0, y), (x1, y)]), seed, P.get("width", 5.5), P.get("col", "ink"),
              progress=P.get("draw", 1.0))


def draw_chair(cv, P, seed):
    x, f, s = P["x"], P.get("facing", 1), P.get("scale", 1.0)
    sy = GROUND_Y - 84 * s
    d = P.get("draw", 1.0)
    pts = lambda *p: np.array([(x + f * a * s, b) for a, b in p])  # noqa: E731
    cv.stroke(pts((-56, sy), (44, sy)), (seed, 1), PW, progress=d)
    cv.stroke(pts((-54, sy + 2), (-64, sy - 132 * s)), (seed, 2), PW, progress=d)
    cv.stroke(pts((-50, sy), (-52, GROUND_Y)), (seed, 3), PW, progress=d)
    cv.stroke(pts((38, sy), (40, GROUND_Y)), (seed, 4), PW, progress=d)


def draw_table(cv, P, seed):
    x0, x1, ty = P["x0"], P["x1"], P.get("top", GROUND_Y - 150)
    d = P.get("draw", 1.0)
    cv.stroke(np.array([(x0 - 6, ty), (x1 + 6, ty)]), (seed, 1), PW, progress=d)
    cv.stroke(np.array([(x0 + 8, ty), (x0 + 4, GROUND_Y)]), (seed, 2), PW, progress=d)
    cv.stroke(np.array([(x1 - 8, ty), (x1 - 4, GROUND_Y)]), (seed, 3), PW, progress=d)


def draw_phone(cv, P, seed):
    x, y, s = P["x"], P["y"], P.get("scale", 1.0)
    ang = P.get("angle", 0.0)
    on = P.get("screen", 1.0)
    w, h = 62 * s, 110 * s
    body = rot(rrect_pts(x - w / 2, y - h / 2, x + w / 2, y + h / 2, 10 * s), ang, x, y)
    if on > 0.01 and P.get("glow", True):
        cv.glow(x, y, 210 * s, "screen", 0.22 * on)
    cv.fill(body, (seed, "body"), "fill")
    sx0, sy0, sx1, sy1 = x - w / 2 + 6 * s, y - h / 2 + 12 * s, x + w / 2 - 6 * s, y + h / 2 - 12 * s
    scr = rot(rect_pts(sx0, sy0, sx1, sy1), ang, x, y)
    if on > 0.01:
        cv.fill(scr, (seed, "scr"), "screen", alpha=0.92 * on, wobble=0.3, boil=0.3)
        if P.get("scroll", False):
            cr = cv.cr
            cr.save()
            cr.new_path()
            cr.move_to(*scr[0])
            for p in scr[1:]:
                cr.line_to(*p)
            cr.close_path()
            cr.clip()
            sp = 26 * s
            off = (P["tl"] * P.get("scroll_speed", 95) * s) % (3 * sp)
            for k in range(-1, 7):
                yy = sy1 - (k * sp + off) + 3 * sp
                if k % 3 == 0:  # a "post": image block
                    pts = rect_pts(sx0 + 5 * s, yy - 16 * s, sx1 - 5 * s, yy + 2 * s)
                    cv.fill(rot(pts, ang, x, y), (seed, "card", k), "#9aa4b8", alpha=0.75 * on, wobble=0, boil=0)
                else:
                    ww = (sx1 - sx0 - 12 * s) * (0.85 if k % 3 == 1 else 0.55)
                    cv.stroke(rot(np.array([(sx0 + 6 * s, yy), (sx0 + 6 * s + ww, yy)]), ang, x, y),
                              (seed, "ln", k), 3.2 * s, "#7c8598", alpha=on, wobble=0.2, boil=0.2)
            cr.restore()
    cv.stroke(body, (seed, "out"), PW * 0.9 * max(s, 0.7), closed=True, progress=P.get("draw", 1.0))


def draw_label(cv, P, seed):
    txt = P["text"]
    size = P.get("size", 62)
    x, y = P["x"], P["y"]
    col = P.get("col", "yellow")
    if P.get("box", False):
        w = text_width(txt, size) + size * 0.9
        h = size * 1.15
        bx = rect_pts(x - w / 2, y - h / 2, x + w / 2, y + h / 2)
        outlined(cv, bx, (seed, "box"), "fill", P.get("box_col", col), 3.2, progress=P.get("draw", 1.0),
                 fill_alpha=0.9)
    cv.text(txt, x, y, size, col, P.get("text_alpha", 1.0) * min(1.0, P.get("draw", 1.0) * 1.25))
    if P.get("underline", False):
        w = text_width(txt, size)
        k = P.get("underline_draw", 1.0)
        cv.stroke(through((x - w / 2, y + size * 0.42), (x, y + size * 0.47), (x + w / 2, y + size * 0.40)),
                  (seed, "ul"), 5, col, progress=k)


def draw_qmark(cv, P, seed):
    cv.text("?", P["x"], P["y"], P.get("size", 64), P.get("col", "grey"))


def draw_calendar(cv, P, seed):
    """Tear-off calendar. `pages` lists the numbers; `page` (float) animates the flips."""
    x, y, s = P["x"], P["y"], P.get("scale", 1.0)
    w, h = 200 * s, 212 * s
    x0, y0, x1, y1 = x - w / 2, y - h / 2, x + w / 2, y + h / 2
    hb = y0 + 48 * s
    d = P.get("draw", 1.0)
    outlined(cv, rect_pts(x0, y0, x1, y1), (seed, "body"), progress=d)
    cv.fill(rect_pts(x0 + 2, y0 + 2, x1 - 2, hb), (seed, "band"), "deepred", alpha=0.85 * min(1, d * 1.5))
    cv.stroke(np.array([(x0, hb), (x1, hb)]), (seed, "hb"), PW * 0.8, progress=d)
    cv.text(P.get("header", "DAYS"), x, (y0 + hb) / 2 + 2, 30 * s, "ink")
    for rx in (x - w * 0.27, x + w * 0.27):
        cv.stroke(arc(rx, y0, 9 * s, 16 * s, math.pi * 0.95, math.pi * 2.05), (seed, "ring", rx), PW * 0.8)
    pages = P.get("pages", [30])
    pg = float(np.clip(P.get("page", len(pages) - 1), 0, len(pages) - 1))
    i = int(math.floor(pg))
    flip = pg - i
    body_cy = (hb + y1) / 2
    if flip > 1e-3 and i + 1 < len(pages):
        cur, nxt = pages[i], pages[i + 1]
    else:
        cur, nxt, flip = pages[i], None, 0.0
    num_col = P.get("num_col", "ink") if (nxt or cur) == pages[-1] and P.get("highlight_last") else "ink"
    cv.text(str(nxt if nxt is not None else cur), x, body_cy, 118 * s, num_col if nxt is None or flip > 0.5 else "ink")
    if nxt is not None:  # the old page folds up into the band
        k = math.cos(flip * math.pi / 2)
        top = hb + 2
        ph = (y1 - 2 - top) * k
        cv.fill(rect_pts(x0 + 3, top, x1 - 3, top + ph), (seed, "page"), "fill", wobble=0.3, boil=0.3)
        cv.stroke(np.array([(x0 + 3, top + ph), (x1 - 3, top + ph)]), (seed, "pageedge"), PW * 0.8)
        if k > 0.2:
            cr = cv.cr
            cr.save()
            cr.translate(x, top)
            cr.scale(1, k)
            cv.text(str(cur), 0, body_cy - top, 118 * s, "ink")
            cr.restore()


def draw_box(cv, P, seed):
    x, yb, s = P["x"], P.get("y", GROUND_Y), P.get("scale", 1.0)
    w, h = 250 * s, 160 * s
    x0, x1, y0 = x - w / 2, x + w / 2, yb - h
    d = P.get("draw", 1.0)
    shut = P.get("closed", 0.0)  # 0 open flaps, 1 closed
    # flaps hinge at the top corners; open = pointing up/outwards
    for sgn, hx in ((-1, x0), (1, x1)):
        ang = (1 - shut) * (math.pi * 0.62)  # angle above horizontal-inwards
        L = w / 2 + 2
        ex = hx - sgn * L * math.cos(ang)
        ey = y0 - L * math.sin(ang)
        cv.stroke(np.array([(hx, y0), (ex, ey)]), (seed, "flap", sgn), PW, progress=d)
    if P.get("ghost_phone", False):
        a = P.get("ghost_alpha", 0.75)
        ph = rrect_pts(x - 28 * s, y0 + 30 * s, x + 28 * s, y0 + 128 * s, 9 * s)
        cv.stroke(ph, (seed, "ghost"), 3.4, "grey", alpha=a, closed=True, dash=[10, 8])
    front = rect_pts(x0, y0, x1, yb)
    cv.fill(front, (seed, "front"), "fill", alpha=0.0 if P.get("ghost_phone", False) else 1.0)
    cv.stroke(front, (seed, "frontl"), PW, closed=True, progress=d)
    # tape / seam
    if shut > 0.98:
        cv.stroke(np.array([(x, y0 - 2), (x, y0 + 26 * s)]), (seed, "tape"), PW * 0.7, "tan")
    if P.get("label"):
        cv.text(P["label"], x, yb - h * 0.42, P.get("label_size", 50) * s, P.get("label_col", "yellow"),
                P.get("label_alpha", 1.0))


def draw_brain(cv, P, seed):
    x, y, s = P["x"], P["y"], P.get("scale", 1.0)
    pulse = 1 + P.get("pulse", 0.0) * 0.035 * math.sin(P["tl"] * 2 * math.pi * 2.2)
    tremble = P.get("tremble", 0.0)
    if tremble:
        rr = _rng(("brain", cv.boil))
        x += rr.uniform(-2, 2) * tremble
        y += rr.uniform(-1.5, 1.5) * tremble
    rx, ry = 92 * s * pulse, 66 * s * pulse
    out = bumpy(x, y, rx, ry, 9, (seed, "o"), depth=0.13)
    cv.fill(out, (seed, "f"), P.get("fill", "#5a2c47"), alpha=0.95)
    d = P.get("draw", 1.0)
    cv.stroke(out, (seed, "s"), PW, closed=True, progress=d)
    cv.stroke(spline([(x - 4, y - ry * 0.95), (x + 6, y - ry * 0.4), (x - 6, y + ry * 0.2), (x + 2, y + ry * 0.9)]),
              (seed, "mid"), 3.4, progress=d)
    for k, (px, py, a) in enumerate(((-0.55, -0.25, 0.3), (-0.45, 0.35, -0.4), (0.5, -0.3, -0.3), (0.52, 0.32, 0.5))):
        cx, cy = x + px * rx, y + py * ry
        pts = rot(spline([(-26 * s, 0), (-10 * s, -12 * s), (6 * s, 6 * s), (24 * s, -6 * s)]), a) + (cx, cy)
        cv.stroke(pts, (seed, "sq", k), 3.2, progress=d)


def draw_battery(cv, P, seed):
    x, y, s = P["x"], P["y"], P.get("scale", 1.0)
    w, h = 190 * s, 84 * s
    x0, y0, x1, y1 = x - w / 2, y - h / 2, x + w / 2, y + h / 2
    lvl = float(np.clip(P.get("level", 1.0), 0, 1))
    mode = P.get("fill_col", "auto")
    if mode == "auto":
        col = "green" if lvl > 0.55 else ("yellow" if lvl > 0.3 else "red")
    else:
        col = mode
    a = 1.0
    if P.get("flash", 0) > 0:
        a = 0.35 + 0.65 * (0.5 + 0.5 * math.cos(P["tl"] * 2 * math.pi * 2.4)) * P["flash"] + (1 - P["flash"])
    d = P.get("draw", 1.0)
    outlined(cv, rect_pts(x0, y0, x1, y1), (seed, "b"), progress=d)
    cv.fill(rect_pts(x1 + 2, y - 14 * s, x1 + 14 * s, y + 14 * s), (seed, "nubf"), "ink", alpha=d)
    pad = 10 * s
    seg_w = (w - 2 * pad - 3 * 7 * s) / 4
    for k in range(4):
        fill_k = np.clip(lvl * 4 - k, 0, 1)
        if fill_k <= 0.02:
            continue
        sx0 = x0 + pad + k * (seg_w + 7 * s)
        cv.fill(rect_pts(sx0, y0 + pad, sx0 + seg_w * fill_k, y1 - pad), (seed, "seg", k), col, alpha=0.92 * a,
                wobble=0.4, boil=0.4)
    if P.get("label"):
        cv.text(P["label"], x, y1 + 44 * s, P.get("label_size", 44) * s, P.get("label_col", "grey"),
                P.get("label_alpha", 1.0))


def draw_cloud(cv, P, seed):
    """Thought cloud with a grey scribble inside (boredom)."""
    x, y, s = P["x"], P["y"], P.get("scale", 1.0)
    rx, ry = 150 * s, 92 * s
    out = bumpy(x, y, rx, ry, 8, (seed, "c"), depth=0.2)
    oa = P.get("outline_alpha", 1.0)
    cv.fill(out, (seed, "cf"), "fill", alpha=0.9 * oa)
    cv.stroke(out, (seed, "cs"), PW, P.get("col", "grey"), alpha=oa, closed=True, progress=P.get("draw", 1.0))
    # thought dots towards the head
    for k, (dx, dy, r) in enumerate(P.get("dots", [(-0.55, 1.35, 10), (-0.75, 1.75, 7)])):
        cv.stroke(arc(x + dx * rx, y + dy * ry, r * s, r * s, 0, 2 * math.pi), (seed, "dot", k), 3.6, "grey",
                  alpha=oa * P.get("draw", 1.0))
    sa = P.get("scribble", 1.0)
    if sa > 0.01:
        rr = _rng(("scr", seed))
        pts = []
        cxs = np.linspace(x - rx * 0.62, x + rx * 0.62, 9)
        for i, cx in enumerate(cxs):
            r = rr.uniform(26, 44) * s
            a0 = rr.uniform(0, 6.28)
            cy = y + rr.uniform(-0.25, 0.25) * ry
            for a in np.linspace(a0, a0 + 2 * math.pi * rr.uniform(0.9, 1.4), 14):
                pts.append((cx + r * math.cos(a), cy + 0.75 * r * math.sin(a) + rr.uniform(-8, 8) * s))
        pts = spline(pts, 4)
        # slow churn: the scribble keeps re-drawing itself a little
        cv.stroke(pts, (seed, "scribble"), 3.4, "grey", alpha=sa * oa, progress=P.get("scribble_draw", 1.0),
                  wobble=2.2, boil=1.4)


def draw_bulb(cv, P, seed):
    x, y, s = P["x"], P["y"], P.get("scale", 1.0)
    on = P.get("on", 0.0)
    r = 34 * s
    if on > 0.01:
        cv.glow(x, y, 150 * s, "yellow", 0.45 * on)
    glass = np.vstack([arc(x, y, r, r, math.pi * 0.72, math.pi * 2.28),
                       [(x + r * 0.42, y + r * 1.25), (x - r * 0.42, y + r * 1.25)]])
    cv.fill(glass, (seed, "gf"), "yellow" if on > 0.5 else "fill", alpha=max(0.9 * on, 1.0 if on <= 0.5 else 0))
    cv.stroke(glass, (seed, "g"), PW * 0.9, "ink", closed=True, progress=P.get("draw", 1.0))
    for k, dy in enumerate((1.42, 1.62)):
        cv.stroke(np.array([(x - r * 0.4, y + r * dy), (x + r * 0.4, y + r * dy)]), (seed, "base", k), PW * 0.8)
    if on > 0.5:
        cv.stroke(spline([(x - r * 0.3, y + r * 0.6), (x - r * 0.15, y), (x, y + r * 0.35), (x + r * 0.15, y),
                          (x + r * 0.3, y + r * 0.6)]), (seed, "fil"), 2.6, "#7a5b10")
        for k in range(7):
            a = -math.pi / 2 + (k - 3) * 0.42
            r0, r1 = r * 1.45, r * (1.95 + 0.12 * math.sin(P["tl"] * 9 + k))
            cv.stroke(np.array([(x + r0 * math.cos(a), y + r0 * math.sin(a)),
                                (x + r1 * math.cos(a), y + r1 * math.sin(a))]), (seed, "ray", k), 3.6, "yellow",
                      alpha=on)


def draw_clock(cv, P, seed):
    x, y, s = P["x"], P["y"], P.get("scale", 1.0)
    r = 72 * s
    circ = hand_circle(x, y, r, (seed, "c"), overshoot=0.15)
    cv.fill(circ, (seed, "cf"), "fill")
    d = P.get("draw", 1.0)
    cv.stroke(circ, (seed, "cs"), PW, progress=d)
    for k in range(12):
        a = k * math.pi / 6
        r0 = r * (0.78 if k % 3 == 0 else 0.84)
        cv.stroke(np.array([(x + r0 * math.cos(a), y + r0 * math.sin(a)), (x + r * 0.9 * math.cos(a),
                                                                           y + r * 0.9 * math.sin(a))]),
                  (seed, "tick", k), 3.0, alpha=d, wobble=0.2, boil=0.2)
    # slow, heavy ticking second hand (jumps once per second with a small overshoot)
    tl = P["tl"] * P.get("rate", 1.0)
    sec = math.floor(tl)
    frac = tl - sec
    over = math.sin(min(frac / 0.18, 1) * math.pi) * 0.12 if frac < 0.18 else 0
    a_sec = -math.pi / 2 + (sec + min(frac / 0.08, 1) + over) * (2 * math.pi / 60) * P.get("sec_step", 5)
    cv.stroke(np.array([(x, y), (x + r * 0.7 * math.cos(a_sec), y + r * 0.7 * math.sin(a_sec))]), (seed, "sh"), 2.8,
              "red", wobble=0.1, boil=0.2)
    a_min = -math.pi / 2 + 0.9 + tl * 0.02
    cv.stroke(np.array([(x, y), (x + r * 0.55 * math.cos(a_min), y + r * 0.55 * math.sin(a_min))]), (seed, "mh"),
              PW, wobble=0.2, boil=0.3)
    a_hr = -math.pi / 2 + 2.6
    cv.stroke(np.array([(x, y), (x + r * 0.38 * math.cos(a_hr), y + r * 0.38 * math.sin(a_hr))]), (seed, "hh"),
              PW, wobble=0.2, boil=0.3)
    cv.dot(x, y, 5, "ink")


def draw_paper(cv, P, seed):
    x, y, s = P["x"], P["y"], P.get("scale", 1.0)
    ang = P.get("angle", -0.06)
    w, h = 150 * s, 30 * s  # paper lying on the table, seen slightly from above
    pts = rot(np.array([(x - w / 2, y - h / 2), (x + w / 2, y - h / 2 - 4), (x + w / 2 + 6, y + h / 2),
                        (x - w / 2 + 4, y + h / 2 + 2)]), ang, x, y)
    outlined(cv, pts, (seed, "p"), "fill", "ink", 3.6, progress=P.get("draw", 1.0))


def draw_sketch(cv, P, seed):
    """The doodle growing on the paper: shown above the table as a floating sheet."""
    x, y, s = P["x"], P["y"], P.get("scale", 1.0)
    k = P.get("progress", 0.0)
    w, h = 210 * s, 170 * s
    sheet = rot(rect_pts(x - w / 2, y - h / 2, x + w / 2, y + h / 2), P.get("angle", 0.05), x, y)
    outlined(cv, sheet, (seed, "sh"), "fill", "ink", 3.6, progress=P.get("draw", 1.0))
    # doodle: a little sun over hills (drawn progressively)
    strokes = [
        hand_circle(x + 40 * s, y - 25 * s, 24 * s, (seed, "sun")),
        spline([(x - 85 * s, y + 55 * s), (x - 40 * s, y + 12 * s), (x + 5 * s, y + 50 * s), (x + 45 * s, y + 20 * s),
                (x + 85 * s, y + 55 * s)]),
    ]
    for i in range(6):
        a = i * math.pi / 3 + 0.3
        strokes.append(np.array([(x + 40 * s + 32 * s * math.cos(a), y - 25 * s + 32 * s * math.sin(a)),
                                 (x + 40 * s + 44 * s * math.cos(a), y - 25 * s + 44 * s * math.sin(a))]))
    n = len(strokes)
    cols = ["yellow", "green"] + ["yellow"] * 6
    for i, st in enumerate(strokes):
        pk = np.clip(k * n - i, 0, 1)
        if pk > 0:
            cv.stroke(st, (seed, "dood", i), 3.6, cols[i], progress=pk, wobble=0.8, boil=0.6)


def draw_pencil(cv, P, seed):
    x, y = P["x"], P["y"]  # tip
    a = P.get("angle", -1.0)
    L = 74
    ex, ey = x + L * math.cos(a), y + L * math.sin(a)
    cv.stroke(np.array([(x + 12 * math.cos(a), y + 12 * math.sin(a)), (ex, ey)]), (seed, "body"), 7.5, "tan",
              wobble=0.2, boil=0.3)
    cv.stroke(np.array([(x, y), (x + 13 * math.cos(a), y + 13 * math.sin(a))]), (seed, "tip"), 4.5, "ink",
              wobble=0.1, boil=0.2)


def draw_meter(cv, P, seed):
    x, yb, s = P["x"], P["y"], P.get("scale", 1.0)
    w, h = 92 * s, 360 * s
    x0, x1, y0 = x - w / 2, x + w / 2, yb - h
    lvl = float(np.clip(P.get("level", 0.0), 0, 1))
    d = P.get("draw", 1.0)
    outlined(cv, rect_pts(x0, y0, x1, yb), (seed, "m"), progress=d)
    if lvl > 0.005:
        c_red, c_yel, c_grn = (np.array(color(c)) for c in ("red", "yellow", "green"))
        c = c_red + (c_yel - c_red) * min(1, lvl / 0.5) if lvl < 0.5 else c_yel + (c_grn - c_yel) * min(1, (lvl - 0.5) / 0.4)
        if P.get("fill_col"):
            c = np.array(color(P["fill_col"]))
        cv.fill(rect_pts(x0 + 9, yb - 9 - (h - 18) * lvl, x1 - 9, yb - 9), (seed, "lvl"), tuple(c), alpha=0.92,
                wobble=0.3, boil=0.3)
    for k in range(1, 4):
        yy = yb - h * k / 4
        cv.stroke(np.array([(x1 - 18, yy), (x1 - 4, yy)]), (seed, "tk", k), 3, alpha=0.7 * d)
    if P.get("label"):
        cv.text(P["label"], x, yb + 46 * s, P.get("label_size", 46) * s, P.get("label_col", "ink"))


def draw_book(cv, P, seed):
    x, y, s = P["x"], P["y"], P.get("scale", 1.0)
    pw, ph = 74 * s, 96 * s
    tilt = P.get("angle", 0.0)
    left = np.array([(x, y - ph / 2 + 8 * s), (x - pw, y - ph / 2), (x - pw, y + ph / 2), (x, y + ph / 2 + 8 * s)])
    right = left * np.array([-1, 1]) + np.array([2 * x, 0])
    for k, pg in enumerate((left, right)):
        pg = rot(pg, tilt, x, y)
        outlined(cv, pg, (seed, "pg", k), "fill", "ink", 3.8, progress=P.get("draw", 1.0))
        for i in range(4):  # text lines
            yy = y - ph / 2 + 24 * s + i * 17 * s
            xs = (x - pw + 14 * s, x - 12 * s) if k == 0 else (x + 12 * s, x + pw - 14 * s)
            cv.stroke(rot(np.array([(xs[0], yy), (xs[1] - (14 * s if i == 3 else 0), yy)]), tilt, x, y),
                      (seed, "tl", k, i), 2.6, "grey", wobble=0.3, boil=0.3)
    flip = P.get("flip", 0.0)
    if 0 < flip < 1:  # page swinging from right to left over the spine
        a = math.pi * flip
        ex = x + pw * math.cos(a)
        lift = 26 * s * math.sin(a)
        pg = np.array([(x, y - ph / 2 + 8 * s), (ex, y - ph / 2 - lift), (ex, y + ph / 2 - lift), (x, y + ph / 2 + 8 * s)])
        pg = rot(pg, tilt, x, y)
        outlined(cv, pg, (seed, "flip"), "fill", "ink", 3.6)


def draw_sun(cv, P, seed):
    x, y, s = P["x"], P["y"], P.get("scale", 1.0)
    r = 54 * s
    d = P.get("draw", 1.0)
    cv.glow(x, y, 190 * s, "yellow", 0.22 * d)
    c = hand_circle(x, y, r, (seed, "c"))
    cv.fill(c, (seed, "f"), "#3a3214", alpha=0.9 * d)
    cv.stroke(c, (seed, "s"), PW, "yellow", progress=d)
    rotn = P["tl"] * 0.35
    for k in range(10):
        a = rotn + k * 2 * math.pi / 10
        r0, r1 = r * 1.3, r * (1.62 + 0.08 * math.sin(P["tl"] * 3 + k))
        cv.stroke(np.array([(x + r0 * math.cos(a), y + r0 * math.sin(a)), (x + r1 * math.cos(a), y + r1 * math.sin(a))]),
                  (seed, "r", k), 4, "yellow", progress=d)


def draw_tree(cv, P, seed):
    x, yb, s = P["x"], P.get("y", GROUND_Y), P.get("scale", 1.0)
    d = P.get("draw", 1.0)
    sway = 0.012 * math.sin(P["tl"] * 1.3)
    top = yb - 190 * s
    cv.stroke(np.array([(x - 12 * s, yb), (x - 8 * s, top)]), (seed, "t1"), PW, progress=d)
    cv.stroke(np.array([(x + 12 * s, yb), (x + 8 * s, top)]), (seed, "t2"), PW, progress=d)
    cv.stroke(np.array([(x, top + 40 * s), (x + 34 * s, top + 4 * s)]), (seed, "br"), PW * 0.8, progress=d)
    can = rot(bumpy(x, top - 70 * s, 118 * s, 96 * s, 9, (seed, "can"), depth=0.18), sway, x, yb)
    cv.fill(can, (seed, "cf"), "#20402a", alpha=d)
    cv.stroke(can, (seed, "cs"), PW, "green", progress=d)


def draw_heart(cv, P, seed):
    x, y = P["x"], P["y"] - P.get("rise", 0.0) * P["tl"]
    s = P.get("size", 40)
    pts = heart_pts(x, y, s)
    sp = P.get("sparkle", 0.0)
    if sp > 0.01:
        for k in range(10):
            a = k * 2 * math.pi / 10 + 0.15
            r0, r1 = s * 1.5, s * (2.1 + 0.15 * math.sin(P["tl"] * 6 + k))
            cv.stroke(np.array([(x + r0 * math.cos(a), y + r0 * math.sin(a)), (x + r1 * math.cos(a), y + r1 * math.sin(a))]),
                      (seed, "sp", k), 3.4, "gold", alpha=sp)
    cv.fill(pts, (seed, "f"), P.get("col", "pink"))
    cv.stroke(pts, (seed, "s"), 3.0, "ink", closed=True, alpha=0.9, wobble=0.6, boil=0.5)


def draw_tick(cv, P, seed):
    x, y, s = P["x"], P["y"], P.get("scale", 1.0)
    b = 34 * s
    outlined(cv, rect_pts(x - b, y - b, x + b, y + b), (seed, "b"), "fill", "ink", 4, progress=P.get("draw", 1.0))
    k = P.get("check", 1.0)
    if k > 0:
        cv.stroke(np.array([(x - b * 0.55, y + 2), (x - b * 0.12, y + b * 0.45), (x + b * 0.62, y - b * 0.5)]),
                  (seed, "c"), 6, "green", progress=k, wobble=0.5, boil=0.4)


def draw_orb(cv, P, seed):
    x, y = P["x"], P["y"]
    r = P.get("r", 22)
    tx, ty = P.get("trail_x", x), P.get("trail_y", y)
    for k in range(1, 7):  # comet trail towards where it was 0.12 s ago
        f = k / 7
        cv.glow(x + (tx - x) * f, y + (ty - y) * f, r * (2.2 - 1.4 * f), "yellow", 0.30 * (1 - f))
    cv.glow(x, y, r * 4.0, "yellow", 0.55)
    cv.cr.new_path()
    cv.cr.arc(x, y, r * 0.75, 0, 2 * math.pi)
    cv.cr.set_source_rgba(1, 0.97, 0.8, 0.95)
    cv.cr.fill()


def draw_bookmark(cv, P, seed):
    x, y, s = P["x"], P["y"], P.get("scale", 1.0)
    w, h = 150 * s, 200 * s
    pts = np.array([(x - w / 2, y - h / 2), (x + w / 2, y - h / 2), (x + w / 2, y + h / 2), (x, y + h / 2 - 52 * s),
                    (x - w / 2, y + h / 2)])
    fill_k = P.get("fill", 0.0)
    cv.fill(pts, (seed, "f"), "fill")
    if fill_k > 0:
        cv.fill(pts, (seed, "f2"), "yellow", alpha=0.9 * fill_k)
    cv.stroke(pts, (seed, "s"), 6, "yellow", closed=True, progress=P.get("draw", 1.0))
    cv.text(P.get("text", "save"), x, y - 18 * s, 54 * s, "ink" if fill_k < 0.5 else "fill")


def draw_eyeline(cv, P, seed):
    """Dotted line of sight; starts at (x0, y0) or at a held point (x, y), e.g. an actor's head."""
    x0, y0 = P.get("x0", P.get("x")), P.get("y0", P.get("y"))
    x1, y1 = P["x1"], P["y1"]
    bend = P.get("bend", 0.0)  # bows the line upwards (over other people's heads)
    pts = quad((x0, y0), ((x0 + x1) / 2, (y0 + y1) / 2 - 2 * bend), (x1, y1), 24) if bend else np.array([(x0, y0), (x1, y1)])
    cv.stroke(pts, seed, 3.4, P.get("col", "grey"), progress=P.get("draw", 1.0), dash=[6, 11], wobble=0.5, boil=0.4)


def draw_floaters(cv, P, seed):
    """Small icons (hearts / likes) rising from a point, deterministic in time."""
    x, y = P["x"], P["y"]
    rate = P.get("rate", 2.2)
    life = P.get("life", 1.6)
    tl = P["tl"]
    first = max(0, math.floor((tl - life) * rate))
    for i in range(first, math.floor(tl * rate) + 1):
        t0 = i / rate
        age = tl - t0
        if not (0 <= age <= life):
            continue
        rr = _rng(("float", seed, i))
        k = age / life
        px = x + rr.uniform(-30, 30) + 18 * math.sin(age * 4 + i) + P.get("drift", 0.0) * k
        py = y - 230 * k * P.get("height", 1.0)
        a = min(1, k * 6) * (1 - k) ** (0.55 if P.get("icon") == "notes" else 1.2)
        size = rr.uniform(13, 19) * (0.7 + 0.5 * min(1, k * 5))
        kind = P.get("icon", "hearts")
        if kind == "notes":
            _note(cv, px, py, size * 1.5, (seed, "n", i), a, double=(i % 3 == 1), tilt=0.25 * math.sin(age * 5 + i))
        elif kind == "hearts" or i % 3:
            pts = heart_pts(px, py, size)
            cv.fill(pts, (seed, "h", i), "pink", alpha=a * 0.9, wobble=0.2, boil=0.2)
        else:
            cv.text("+1", px, py, 30, "yellow", a)


def draw_grass(cv, P, seed):
    xs = P.get("xs", [140, 260, 690, 930])
    d = P.get("draw", 1.0)
    for k, x in enumerate(xs):
        pts = np.array([(x - 14, GROUND_Y), (x - 8, GROUND_Y - 18), (x - 2, GROUND_Y), (x + 4, GROUND_Y - 24),
                        (x + 10, GROUND_Y), (x + 16, GROUND_Y - 14)])
        cv.stroke(pts, (seed, k), 3.2, "green", alpha=0.85, progress=d)


def draw_arrow(cv, P, seed):
    """Hand-drawn curved arrow from (x0, y0) to (x1, y1); `bend` bows it sideways."""
    p0, p1 = np.array([P["x0"], P["y0"]], float), np.array([P["x1"], P["y1"]], float)
    d = p1 - p0
    n = np.array([-d[1], d[0]]) / (np.hypot(*d) + 1e-9)
    ctrl = (p0 + p1) / 2 + n * P.get("bend", 60)
    pts = quad(p0, ctrl, p1, 30)
    k = P.get("draw", 1.0)
    col = P.get("col", "yellow")
    cv.stroke(pts, (seed, "shaft"), 4.2, col, progress=k)
    if k > 0.97:
        tang = pts[-1] - pts[-3]
        a = math.atan2(tang[1], tang[0])
        for sgn in (-1, 1):
            b = a + math.pi + sgn * 0.5
            tip = pts[-1]
            cv.stroke(np.array([tip, tip + 26 * np.array([math.cos(b), math.sin(b)])]), (seed, "head", sgn), 4.2,
                      col, wobble=0.3, boil=0.4)


def draw_buzz(cv, P, seed):
    """Phantom vibration marks: (( )) around a point, jittering."""
    x, y, s = P["x"], P["y"], P.get("scale", 1.0)
    rr = _rng(("buzz", cv.boil))
    for sgn in (-1, 1):
        for k, (dx, r) in enumerate(((150, 30), (176, 46))):
            cx = x + sgn * dx * s + rr.uniform(-2, 2)
            a0, a1 = (math.pi * 0.72, math.pi * 1.28) if sgn < 0 else (-math.pi * 0.28, math.pi * 0.28)
            cv.stroke(arc(cx - sgn * r * s, y, r * s, r * s, a0, a1), (seed, sgn, k), 3.6, P.get("col", "ink"),
                      wobble=0.4, boil=0.8)


def draw_glow(cv, P, seed):
    k = P.get("pulse", 0.0)
    a = P.get("strength", 0.5) * (1 + k * 0.25 * math.sin(P["tl"] * 2 * math.pi * 3))
    cv.glow(P["x"], P["y"], P.get("r", 120), P.get("col", "yellow"), a)

def _note(cv, x, y, s, seed, alpha, double=False, tilt=0.0, col="yellow"):
    """A hand-drawn quaver (or a pair of beamed quavers)."""
    heads = [(x, y)] if not double else [(x - 0.55 * s, y + 0.1 * s), (x + 0.55 * s, y - 0.1 * s)]
    tops = []
    for k, (hx, hy) in enumerate(heads):
        head = rot(np.array([(hx + 0.42 * s * math.cos(a), hy + 0.3 * s * math.sin(a))
                             for a in np.linspace(0, 2 * math.pi, 14)]), -0.4 + tilt, hx, hy)
        cv.fill(head, (seed, "h", k), col, alpha=alpha, wobble=0.2, boil=0.3)
        sx = hx + 0.38 * s
        tops.append((sx, hy - 1.5 * s))
        cv.stroke(np.array([(sx, hy - 0.05 * s), (sx, hy - 1.5 * s)]), (seed, "st", k), 3.4, col, alpha=alpha,
                  wobble=0.2, boil=0.3)
    if double:
        cv.stroke(np.array([tops[0], tops[1]]), (seed, "beam"), 5, col, alpha=alpha, wobble=0.2, boil=0.3)
    else:
        sx, sy = tops[0]
        cv.stroke(np.array([(sx, sy), (sx + 0.45 * s, sy + 0.55 * s), (sx + 0.3 * s, sy + 0.95 * s)]), (seed, "fl"),
                  3.4, col, alpha=alpha, wobble=0.2, boil=0.3)


def draw_spotlight(cv, P, seed):
    """Stage spotlight: a soft translucent cone from (x, top_y) down onto the ground at x."""
    on = P.get("on", 1.0)
    if on <= 0.01:
        return
    x, ground = P["x"], P.get("y", GROUND_Y)
    sx = P.get("src_x", x)
    top = P.get("top_y", -60)
    tw, w = P.get("top_w", 70) / 2, P.get("w", 200)
    r, g, b = color(P.get("col", "#fff1c4"))
    cr = cv.cr
    cone = [(sx - tw, top), (sx + tw, top), (x + w, ground), (x - w, ground)]
    grad = cairo.LinearGradient(0, top, 0, ground)
    grad.add_color_stop_rgba(0, r, g, b, 0.10 * on)
    grad.add_color_stop_rgba(1, r, g, b, 0.26 * on)
    cr.new_path()
    cr.move_to(*cone[0])
    for pt in cone[1:]:
        cr.line_to(*pt)
    cr.close_path()
    cr.set_source(grad)
    cr.fill()
    # pool of light on the floor
    pool = cairo.RadialGradient(x, ground, 0, x, ground, w * 1.15)
    pool.add_color_stop_rgba(0, r, g, b, 0.42 * on)
    pool.add_color_stop_rgba(1, r, g, b, 0.0)
    cr.save()
    cr.translate(x, ground)
    cr.scale(1, 0.2)
    cr.translate(-x, -ground)
    cr.new_path()
    cr.arc(x, ground, w * 1.15, 0, 2 * math.pi)
    cr.set_source(pool)
    cr.fill()
    cr.restore()
    # faint hand-drawn edges keep it in the line style
    for k, (a, b2) in enumerate(((cone[0], cone[3]), (cone[1], cone[2]))):
        cv.stroke(np.array([a, b2]), (seed, "edge", k), 2.4, P.get("col", "#fff1c4"), alpha=0.35 * on,
                  wobble=0.8, boil=0.6)
    if P.get("lamp", top > 0):  # a little stage lamp at the source
        lw = max(tw * 1.6, 16)
        can = np.array([(sx - lw * 0.55, top - lw * 1.15), (sx + lw * 0.55, top - lw * 1.15), (sx + lw, top),
                        (sx - lw, top)])
        cv.fill(can, (seed, "can"), "fill")
        cv.stroke(can, (seed, "cans"), 3.0, "ink", closed=True, wobble=0.4, boil=0.4)
        cv.glow(sx, top, lw * 1.6, P.get("col", "#fff1c4"), 0.35 * on)


def draw_bubble(cv, P, seed):
    """Speech bubble with a tail pointing at the speaker (ax, ay)."""
    x, y = P["x"], P["y"]
    size = P.get("size", 50)
    lines = P["text"].split("\n")
    w = max(text_width(t, size) for t in lines) + size * 1.0
    h = size * (1.05 * len(lines) + 0.65)
    box = rrect_pts(x - w / 2, y - h / 2, x + w / 2, y + h / 2, min(h / 2, 34))
    ax, ay = P.get("ax", x - w / 2), P.get("ay", y + h)
    tip = (x + (ax - x) * 0.72, y + (ay - y) * 0.72)
    base_x = x - w * 0.18 if ax < x else x + w * 0.18
    tail = np.array([(base_x - 18, y + h / 2 - 4), tip, (base_x + 18, y + h / 2 - 4)])
    d = P.get("draw", 1.0)
    cv.fill(box, (seed, "f"), "fill")
    cv.fill(tail, (seed, "tf"), "fill")
    cv.stroke(box, (seed, "s"), 3.6, P.get("col", "ink"), closed=True, progress=d)
    cv.stroke(tail, (seed, "t"), 3.6, P.get("col", "ink"), progress=d)
    for i, t in enumerate(lines):
        cv.text(t, x, y + (i - (len(lines) - 1) / 2) * size * 1.05, size, P.get("text_col", "ink"), min(1, d * 1.3))


def draw_thought(cv, P, seed):
    """Thought cloud with text; dots lead to the thinker (ax, ay). Optional mini face and strike-through."""
    x, y = P["x"], P["y"]
    size = P.get("size", 44)
    lines = P["text"].split("\n")
    face = P.get("face")
    tw = max(text_width(t, size) for t in lines)
    rx = tw / 2 + size * (1.05 if not face else 1.9)
    ry = size * (0.62 * len(lines) + 0.55)
    out = bumpy(x, y, rx, ry, max(7, int(rx / 34)), (seed, "c"), depth=0.14)
    d = P.get("draw", 1.0)
    col = P.get("col", "ink")
    cv.fill(out, (seed, "cf"), "fill", alpha=0.95)
    cv.stroke(out, (seed, "cs"), 3.4, col, closed=True, progress=d)
    ax, ay = P.get("x1", P.get("ax")), P.get("y1", P.get("ay"))
    if ax is not None:
        ex, ey = x, y + ry * 1.05
        for k, (f, r) in enumerate(((0.42, 10), (0.68, 7))):
            cx, cy = ex + (ax - ex) * f, ey + (ay - ey) * f
            cv.stroke(arc(cx, cy, r, r, 0, 2 * math.pi), (seed, "dot", k), 3.0, col, alpha=min(1, d * 1.5),
                      wobble=0.3, boil=0.3)
    tx = x + (size * 0.45 if face else 0)
    for i, t in enumerate(lines):
        ty = y + (i - (len(lines) - 1) / 2) * size * 1.08
        cv.text(t, tx, ty, size, P.get("text_col", "ink"), min(1, d * 1.3))
        if i == 0 and P.get("strike", 0) > 0:  # cross out the first line
            w0 = text_width(t.split()[0], size) if P.get("strike_word", True) else text_width(t, size)
            lw = text_width(t, size)
            x0 = tx - lw / 2 - 8
            cv.stroke(np.array([(x0, ty + 6), (x0 + w0 + 16, ty - 8)]), (seed, "strike"), 7, "red",
                      progress=P["strike"], wobble=0.5, boil=0.5)
    if face:  # tiny worried face
        fx, fy, fr = x - rx + size * 0.95, y, size * 0.42
        c = hand_circle(fx, fy, fr, (seed, "fc"))
        cv.stroke(c, (seed, "fcs"), 3.0, col)
        for sgn in (-1, 1):
            cv.dot(fx + sgn * fr * 0.36, fy + fr * 0.05, 2.6, col)
            cv.stroke(np.array([(fx + sgn * fr * 0.15, fy - fr * 0.42), (fx + sgn * fr * 0.55, fy - fr * 0.3)]),
                      (seed, "fb", sgn), 2.4, col, wobble=0.1, boil=0.2)
        xs = np.linspace(-fr * 0.35, fr * 0.35, 10)
        cv.stroke(np.array([(fx + u, fy + fr * 0.48 + 2.2 * math.sin(u / fr * 9)) for u in xs]), (seed, "fm"), 2.4,
                  col, wobble=0.1, boil=0.2)


def draw_hair(cv, P, seed):
    """Messy scribble of hair on top of a head (attach with hold=(actor, "head"))."""
    x, y = P["x"], P["y"]
    r = 46 * P.get("scale", 1.0)
    mess = P.get("mess", 1.0)
    rr = _rng(("hair", seed))
    pts = []
    n = 11
    for i in range(n):
        a = math.pi * (1.08 + 0.84 * i / (n - 1))  # across the top of the head
        base = (x + r * math.cos(a), y + r * math.sin(a))
        lift = r * (0.25 + 0.55 * rr.uniform()) * mess
        tip = (x + (r + lift) * math.cos(a + rr.uniform(-0.35, 0.35) * mess),
               y + (r + lift) * math.sin(a + rr.uniform(-0.35, 0.35) * mess))
        pts += [base, tip]
    pts.append((x + r * math.cos(math.pi * 1.92), y + r * math.sin(math.pi * 1.92)))
    cv.stroke(spline(pts, 5), (seed, "h"), 4.0, P.get("col", "ink"), progress=P.get("draw", 1.0),
              wobble=1.2 * mess + 0.3, boil=0.9)


def draw_palm(cv, P, seed):
    """A small mitten-shaped hand (e.g. covering the face)."""
    x, y, s = P["x"], P["y"], P.get("size", 30)
    a = P.get("angle", -0.3)
    pts = [(x + s * 0.55 * math.cos(t), y + s * 0.7 * math.sin(t)) for t in np.linspace(0, 2 * math.pi, 18, endpoint=False)]
    pts = rot(np.array(pts), a, x, y)
    cv.fill(pts, (seed, "f"), "fill")
    cv.stroke(pts, (seed, "s"), 4.0, "ink", closed=True, wobble=0.4, boil=0.4)
    th = rot(np.array([(x - s * 0.5, y + s * 0.05), (x - s * 0.95, y - s * 0.35)]), a, x, y)
    cv.stroke(th, (seed, "th"), 4.0, "ink", wobble=0.3, boil=0.3)


def draw_doorway(cv, P, seed):
    x0, x1 = P.get("x0", 50), P.get("x1", 230)
    top = GROUND_Y - P.get("h", 380)
    d = P.get("draw", 1.0)
    cv.stroke(np.array([(x0, GROUND_Y), (x0, top), (x1, top), (x1, GROUND_Y)]), (seed, "frame"), 5.0, progress=d)
    open_k = P.get("open", 1.0)  # door panel swings toward the viewer
    wdt = (x1 - x0) * (1 - 0.62 * open_k)
    skew = 34 * open_k
    panel = np.array([(x0, top + 6), (x0 + wdt, top + 6 - skew), (x0 + wdt, GROUND_Y - 4 + skew * 0.35),
                      (x0, GROUND_Y - 4)])
    cv.fill(panel, (seed, "pf"), "fill", alpha=d)
    cv.stroke(panel, (seed, "p"), 3.6, closed=True, progress=d)
    cv.dot(x0 + wdt * 0.82, (top + GROUND_Y) / 2 - skew * 0.3, 5, "ink", alpha=d)


def draw_shirt(cv, P, seed):
    """T-shirt drawn around an actor's torso (hold=(actor, "body")), with a silly face printed on it."""
    j = P.get("joints")
    if j is None:
        return
    s = j.get("scale", 1.0)
    neck, hip = np.asarray(j["neck"]), np.asarray(j["hip"])
    up = (neck - hip) / (np.hypot(*(neck - hip)) + 1e-9)
    side = np.array([-up[1], up[0]])
    if side[0] < 0:
        side = -side
    hw = 38 * s
    bottom = hip + up * 34 * s
    sh = neck - up * 9 * s
    el_b, el_a = np.asarray(j["elbow_b"]), np.asarray(j["elbow_a"])
    if el_b[0] > el_a[0]:
        el_b, el_a = el_a, el_b

    def sleeve(elbow, sgn):
        shoulder = sh + side * sgn * hw * 0.95
        dvec = elbow - (neck - up * 4 * s)
        dvec /= np.hypot(*dvec) + 1e-9
        # keep sleeves splayed at least ~40 degrees from the body so the shirt reads as a T
        out = side * sgn
        cos_out = float(np.dot(dvec, out))
        if cos_out < 0.64:
            down = -up
            dvec = 0.64 * out + 0.77 * down
        end = shoulder + dvec * 40 * s
        nrm = np.array([-dvec[1], dvec[0]]) * 15 * s
        return shoulder, end + nrm, end - nrm

    shl_l, sl_l1, sl_l2 = sleeve(el_b, -1)
    shl_r, sl_r1, sl_r2 = sleeve(el_a, 1)
    collar_l = neck + side * -15 * s - up * 1 * s
    collar_r = neck + side * 15 * s - up * 1 * s
    collar_m = neck - up * 12 * s
    arm_l = sh + side * -hw * 0.9 - up * 30 * s
    arm_r = sh + side * hw * 0.9 - up * 30 * s
    bot_l = bottom + side * -hw * 0.98
    bot_r = bottom + side * hw * 0.98
    # order around the outline
    ordered = [collar_l, shl_l, *sorted([sl_l1, sl_l2], key=lambda p: p[1]), arm_l, bot_l, bot_r, arm_r,
               *sorted([sl_r1, sl_r2], key=lambda p: -p[1]), shl_r, collar_r, collar_m]
    pts = np.array(ordered)
    d = P.get("draw", 1.0)
    cv.fill(pts, (seed, "f"), P.get("fill", "#d9b84c"), alpha=0.92 * d)
    cv.stroke(pts, (seed, "s"), 4.2 * s, "ink", closed=True, progress=d)
    if d > 0.6:  # the embarrassing print: googly eyes and a big tongue-out grin
        c = (neck + bottom) / 2 + up * 4 * s
        for sgn in (-1, 1):
            e = c + side * sgn * 11 * s + up * 9 * s
            cv.stroke(arc(e[0], e[1], 7 * s, 7 * s, 0, 2 * math.pi), (seed, "eye", sgn), 2.6, "fill", wobble=0.2, boil=0.3)
            cv.dot(e[0] + sgn * 2 * s, e[1] + 2 * s, 2.6 * s, "fill")
        m = [c + side * u * 18 * s - up * (4 * s + 9 * s * (1 - (u ** 2))) for u in np.linspace(-1, 1, 9)]
        cv.stroke(np.array(m), (seed, "grin"), 2.8, "fill", wobble=0.2, boil=0.3)
        t0 = c + side * 5 * s - up * 12 * s
        tongue = [t0 + side * 6 * s * math.cos(a) - up * 6 * s * math.sin(a) for a in np.linspace(0, math.pi, 8)]
        cv.fill(np.array(tongue), (seed, "tongue"), "#c2416a", wobble=0.2, boil=0.2)


def draw_notebook(cv, P, seed):
    x, y, s = P["x"], P["y"], P.get("scale", 1.0)
    w, h = 46 * s, 58 * s
    pts = rect_pts(x - w / 2, y - h / 2, x + w / 2, y + h / 2)
    d = P.get("draw", 1.0)
    col = P.get("col", "yellow")
    cv.fill(pts, (seed, "f"), "fill")
    cv.stroke(pts, (seed, "s"), 3.4, col, closed=True, progress=d)
    for k in range(4):
        yy = y - h / 2 + 10 * s + k * 12 * s
        cv.stroke(arc(x - w / 2, yy, 5 * s, 4 * s, math.pi * 0.5, math.pi * 1.5), (seed, "ring", k), 2.6, col, alpha=d)
        if k < 3:
            cv.stroke(np.array([(x - w / 2 + 12 * s, yy + 6 * s), (x + w / 2 - 8 * s, yy + 6 * s)]), (seed, "l", k), 2.2,
                      col, alpha=0.8 * d, wobble=0.2, boil=0.2)


PROPS = {name[5:]: fn for name, fn in globals().items() if name.startswith("draw_")}
