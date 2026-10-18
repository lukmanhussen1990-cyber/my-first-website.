"""Supporting graphics designed in code: flags, course glyphs, icons and the app's
chunky-button UI pieces.

Everything is vector: lists of svg.Shape in a local unit space, so the engine can
rasterize a piece as a texture or extrude its outline into a 3D slab.  The 2D
"button" look (a darker lip under each face) is only used for review boards;
in the film the lip is real geometry.
"""

from __future__ import annotations

import math

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont

from engine import svg
from engine.svg import Shape

# ------------------------------------------------------------------ palette

FEATHER, FEATHER_HI, FEATHER_LIP = (88, 204, 2), (137, 226, 25), (88, 167, 0)
STREAK, GOLD = (255, 150, 0), (255, 200, 0)
MATH, MUSIC = (28, 176, 246), (206, 130, 255)
SURFACE, RAISED, STAGE, WHITE = (19, 31, 36), (55, 70, 79), (6, 10, 12), (255, 255, 255)
CARDINAL = (255, 75, 75)  # optional hang-up accent


def lip(rgb, k=0.82):
    """Lip colour: the base darkened in linear light (the one rule from the brief)."""
    lin = (np.array(rgb, float) / 255.0) ** 2.2 * k
    return tuple(int(round(v)) for v in (lin ** (1 / 2.2) * 255))


# ----------------------------------------------------------------- geometry

def shape(fill, contours, rule="nonzero", alpha=1.0) -> Shape:
    if isinstance(contours, np.ndarray):
        contours = [contours]
    return Shape(-1, "gfx", tuple(int(c) for c in fill), alpha, rule, [np.asarray(c, float) for c in contours])


def circle(cx, cy, r, n=None):
    n = n or max(24, int(r * 3))
    t = np.linspace(0, 2 * np.pi, n, endpoint=False)
    return np.stack([cx + r * np.cos(t), cy + r * np.sin(t)], 1)


def ellipse(cx, cy, rx, ry, rot_deg=0.0, n=96):
    t = np.linspace(0, 2 * np.pi, n, endpoint=False)
    x, y = rx * np.cos(t), ry * np.sin(t)
    a = math.radians(rot_deg)
    return np.stack([cx + x * math.cos(a) - y * math.sin(a), cy + x * math.sin(a) + y * math.cos(a)], 1)


def rrect(x, y, w, h, r):
    r = min(r, w / 2, h / 2)
    pts = []
    for cx, cy, a0 in ((x + w - r, y + r, -90), (x + w - r, y + h - r, 0), (x + r, y + h - r, 90), (x + r, y + r, 180)):
        t = np.radians(np.linspace(a0, a0 + 90, 16))
        pts.append(np.stack([cx + r * np.cos(t), cy + r * np.sin(t)], 1))
    return np.vstack(pts)


def rect(x, y, w, h):
    return np.array([[x, y], [x + w, y], [x + w, y + h], [x, y + h]], float)


def path(d):
    return svg.parse_path(d, tol=0.02)


def rounded_poly(points, r, steps=10):
    """Fillet every corner of a polygon with radius r."""
    p = np.asarray(points, float)
    out = []
    n = len(p)
    for i in range(n):
        a, b, c = p[i - 1], p[i], p[(i + 1) % n]
        u, v = a - b, c - b
        lu, lv = np.linalg.norm(u), np.linalg.norm(v)
        u, v = u / lu, v / lv
        ang = math.acos(np.clip(u @ v, -1, 1))
        if ang < 1e-3 or ang > math.pi - 1e-3:
            out.append(b)
            continue
        d = min(r / math.tan(ang / 2), lu / 2, lv / 2)
        rr = d * math.tan(ang / 2)
        p1, p2 = b + u * d, b + v * d
        bis = (u + v) / np.linalg.norm(u + v)
        center = b + bis * (rr / math.sin(ang / 2))
        a1 = math.atan2(*(p1 - center)[::-1])
        a2 = math.atan2(*(p2 - center)[::-1])
        da = (a2 - a1 + math.pi) % (2 * math.pi) - math.pi
        for t in np.linspace(0, 1, steps):
            out.append(center + rr * np.array([math.cos(a1 + da * t), math.sin(a1 + da * t)]))
    return np.array(out)


def star(cx, cy, r_out, r_in, n=5, rot=-90.0, round_r=0.0):
    pts = []
    for k in range(2 * n):
        r = r_out if k % 2 == 0 else r_in
        a = math.radians(rot + k * 180.0 / n)
        pts.append((cx + r * math.cos(a), cy + r * math.sin(a)))
    return rounded_poly(pts, round_r) if round_r else np.array(pts)


def clip_convex(poly, clip):
    """Sutherland-Hodgman: clip polygon `poly` against convex polygon `clip` (any winding)."""
    clip = np.asarray(clip, float)
    area = 0.5 * np.sum(clip[:, 0] * np.roll(clip[:, 1], -1) - np.roll(clip[:, 0], -1) * clip[:, 1])
    if area < 0:
        clip = clip[::-1]
    out = [tuple(q) for q in np.asarray(poly, float)]
    for i in range(len(clip)):
        a, b = clip[i], clip[(i + 1) % len(clip)]
        inp, out = out, []
        if not inp:
            break

        def inside(q):
            return (b[0] - a[0]) * (q[1] - a[1]) - (b[1] - a[1]) * (q[0] - a[0]) >= 0

        def inter(p, q):
            d1, d2 = np.subtract(q, p), b - a
            den = d1[0] * d2[1] - d1[1] * d2[0]
            t = ((a[0] - p[0]) * d2[1] - (a[1] - p[1]) * d2[0]) / den
            return (p[0] + t * d1[0], p[1] + t * d1[1])

        s = inp[-1]
        for e in inp:
            if inside(e):
                if not inside(s):
                    out.append(inter(s, e))
                out.append(e)
            elif inside(s):
                out.append(inter(s, e))
            s = e
    return np.array(out) if len(out) >= 3 else None


def xform(contours, M):
    return [(np.c_[c, np.ones(len(c))] @ np.asarray(M).T)[:, :2] for c in contours]


def outline_from_mask(mask, scale=1.0, offset=(0.0, 0.0), simplify=0.35):
    """Vector outline (outer contours + holes) of a binary mask, for glyphs/strokes."""
    cs, hier = cv2.findContours(mask.astype(np.uint8), cv2.RETR_CCOMP, cv2.CHAIN_APPROX_NONE)
    out = []
    for c in cs:
        c = cv2.approxPolyDP(c, simplify, True)[:, 0, :].astype(float)
        if len(c) >= 3:
            out.append(c * scale + np.array(offset))
    return out


# -------------------------------------------------------------------- flags

FLAG_W, FLAG_H, FLAG_R = 120.0, 90.0, 14.0


def _tile():
    return rrect(0, 0, FLAG_W, FLAG_H, FLAG_R)


def _clipped(fill, poly):
    c = clip_convex(poly, _tile())
    return shape(fill, c) if c is not None else None


def _hstripes(cols, ratios=None):
    ratios = ratios or [1] * len(cols)
    tot, y, out = sum(ratios), 0.0, []
    for col, r in zip(cols, ratios):
        h = FLAG_H * r / tot
        out.append(_clipped(col, rect(-1, y, FLAG_W + 2, h + (0.6 if col != cols[-1] else 1))))
        y += h
    return out


def _vstripes(cols):
    w, out = FLAG_W / len(cols), []
    for i, col in enumerate(cols):
        out.append(_clipped(col, rect(i * w - (1 if i == 0 else 0), -1, w + 0.6, FLAG_H + 2)))
    return out


def flag_es():  # Spain (civil ensign): red-yellow-red 1:2:1
    return _hstripes([(173, 21, 25), (250, 189, 0), (173, 21, 25)], [1, 2, 1])


def flag_fr():
    return _vstripes([(0, 85, 164), WHITE, (239, 65, 53)])


def flag_de():
    return _hstripes([(0, 0, 0), (221, 0, 0), (255, 206, 0)])


def flag_it():
    return _vstripes([(0, 146, 70), WHITE, (206, 43, 55)])


def flag_jp():
    return [shape(WHITE, _tile()), shape((188, 0, 45), circle(FLAG_W / 2, FLAG_H / 2, FLAG_H * 0.3))]


def flag_kr():
    """Taegukgi: taeguk tilted along the diagonal, four trigrams at the corners."""
    cx, cy, R = FLAG_W / 2, FLAG_H / 2, FLAG_H * 0.25
    ang = math.atan2(FLAG_H, FLAG_W)
    rot = np.array([[math.cos(ang), -math.sin(ang)], [math.sin(ang), math.cos(ang)]])

    def place(poly):
        return poly @ rot.T + (cx, cy)

    red, blue = (205, 46, 58), (0, 71, 160)
    t = np.linspace(np.pi, 2 * np.pi, 64)  # upper half (y down)
    upper = np.stack([R * np.cos(t), R * np.sin(t)], 1)
    shapes = [shape(WHITE, _tile()),
              shape(blue, place(circle(0, 0, R, 128))),
              shape(red, place(upper)),
              shape(red, place(circle(-R / 2, 0, R / 2, 64))),
              shape(blue, place(circle(R / 2, 0, R / 2, 64)))]
    # trigrams, perpendicular to their diagonal: geon (TL), gam (TR), ri (BL), gon (BR)
    bar_l, bar_w, gap = R * 1.0, R * 0.17, R * 0.09
    for (sx, sy), pattern in (((-1, -1), (0, 0, 0)), ((1, -1), (1, 0, 1)), ((-1, 1), (0, 1, 0)), ((1, 1), (1, 1, 1))):
        d = np.array([sx * FLAG_W, sy * FLAG_H], float)
        d /= np.linalg.norm(d)
        n = np.array([-d[1], d[0]])
        for k, broken in enumerate(pattern):
            c = np.array([cx, cy]) + d * (R * 1.55 + k * (bar_w + gap))
            pieces = [(-bar_l / 2, bar_l / 2)] if not broken else [(-bar_l / 2, -gap / 2), (gap / 2, bar_l / 2)]
            for a0, a1 in pieces:
                shapes.append(shape((0, 0, 0), np.array([c + n * a0 - d * bar_w / 2, c + n * a1 - d * bar_w / 2,
                                                            c + n * a1 + d * bar_w / 2, c + n * a0 + d * bar_w / 2])))
    return shapes


def flag_br():
    g, y, b = (0, 156, 59), (255, 223, 0), (0, 39, 118)
    mx, my = FLAG_W * 0.085, FLAG_H * 0.12
    rhombus = np.array([(FLAG_W / 2, my), (FLAG_W - mx, FLAG_H / 2), (FLAG_W / 2, FLAG_H - my), (mx, FLAG_H / 2)])
    disc = circle(FLAG_W / 2, FLAG_H / 2, FLAG_H * 0.25, 96)
    # white band: a gently curved strip across the disc, clipped to it quad by quad
    centre = np.array([FLAG_W / 2 - 4, FLAG_H / 2 + FLAG_H * 0.62])
    r1, r2 = FLAG_H * 0.62, FLAG_H * 0.675
    a = -np.pi / 2 + np.linspace(-0.6, 0.6, 40)
    top = centre + np.stack([r1 * np.cos(a), r1 * np.sin(a)], 1)
    bot = centre + np.stack([r2 * np.cos(a), r2 * np.sin(a)], 1)
    quads = [clip_convex(np.array([top[i], top[i + 1], bot[i + 1], bot[i]]), disc) for i in range(len(a) - 1)]
    band = shape(WHITE, [q for q in quads if q is not None])
    return [shape(g, _tile()), shape(y, rhombus), shape(b, disc), band]


def flag_cn():
    red, yel = (238, 28, 37), (255, 222, 0)
    u = FLAG_W / 30.0
    oy = (FLAG_H - 20 * u) / 2
    shapes = [shape(red, _tile())]
    big = np.array([5 * u, oy + 5 * u])
    shapes.append(shape(yel, star(big[0], big[1], 3 * u, 3 * u * 0.382)))
    for gx, gy in ((10, 2), (12, 4), (12, 7), (10, 9)):
        c = np.array([gx * u, oy + gy * u])
        rot = math.degrees(math.atan2(big[1] - c[1], big[0] - c[0]))
        shapes.append(shape(yel, star(c[0], c[1], u, u * 0.382, rot=rot)))
    return shapes


FLAGS = {"es": flag_es, "fr": flag_fr, "jp": flag_jp, "de": flag_de, "it": flag_it, "kr": flag_kr, "br": flag_br, "cn": flag_cn}


def flag(code):
    return [s for s in FLAGS[code]() if s is not None]


# ------------------------------------------------------------ glyphs & icons
# Custom glyphs are authored as SVG path data on a 100 x 100 grid (y down).

KNIGHT = (
    "M 31 80 C 31 71 33 64 39 58 C 33 57 27 58 22 56 C 15 54 11 49 13 43 C 15 37 20 34 24 30 "
    "C 28 25 30 20 33 14 L 36 7 C 37 4 41 4 42 7 L 43 13 C 57 13 69 22 74 37 C 78 50 77 65 73 80 Z "
    "M 33 30 C 35 30 36 31.5 36 33 C 36 34.5 35 36 33 36 C 31 36 30 34.5 30 33 C 30 31.5 31 30 33 30 Z "
    "M 24 80 L 80 80 C 83 80 84 82 84 84 L 84 90 C 84 93 82 95 79 95 L 21 95 C 18 95 16 93 16 90 L 16 84 C 16 82 18 80 21 80 Z"
)
NOTE = (
    "M 50 18 C 50 15 53 13 56 15 C 66 21 78 30 77 45 C 77 50 72 51 70 47 C 67 40 62 36 59 35 L 59 74 "
    "C 59 85 49 93 37 92 C 26 91 20 84 23 76 C 26 68 37 63 47 65 C 48 65 49 66 50 66 Z"
)
FLAME_OUTER = (
    "M 50 4 C 56 20 80 32 80 60 C 80 81 66 96 50 96 C 34 96 20 82 20 63 C 20 52 25 44 32 37 "
    "C 32 46 36 52 43 55 C 40 38 43 19 50 4 Z"
)
FLAME_INNER = (
    "M 50 46 C 56 57 66 63 66 76 C 66 86 59 92 50 92 C 41 92 34 86 34 77 C 34 70 38 65 43 61 "
    "C 43 67 46 70 50 71 C 47 63 47 54 50 46 Z"
)
CROWN = (
    "M 14 72 L 20 36 C 21 31 26 30 29 34 L 40 50 L 46 27 C 47 22 53 22 54 27 L 60 50 L 71 34 "
    "C 74 30 79 31 80 36 L 86 72 C 86 76 84 78 80 78 L 20 78 C 16 78 14 76 14 72 Z"
)
SPEAKER = (
    "M 14 40 C 14 37 16 35 19 35 L 31 35 L 48 21 C 51 19 55 21 55 25 L 55 75 C 55 79 51 81 48 79 "
    "L 31 65 L 19 65 C 16 65 14 63 14 60 Z"
)
MIC = (
    "M 50 10 C 59 10 65 16 65 25 L 65 49 C 65 58 59 64 50 64 C 41 64 35 58 35 49 L 35 25 C 35 16 41 10 50 10 Z"
)
CAMERA = (
    "M 12 32 C 12 27 16 24 21 24 L 59 24 C 64 24 68 27 68 32 L 68 68 C 68 73 64 76 59 76 L 21 76 "
    "C 16 76 12 73 12 68 Z M 72 44 L 86 34 C 89 32 92 34 92 37 L 92 63 C 92 66 89 68 86 66 L 72 56 Z"
)
HANGUP = (
    "M 8 58 C 8 46 28 36 50 36 C 72 36 92 46 92 58 L 92 64 C 92 68 89 70 85 69 L 71 66 C 67 65 65 62 65 58 "
    "L 65 52 C 56 49 44 49 35 52 L 35 58 C 35 62 33 65 29 66 L 15 69 C 11 70 8 68 8 64 Z"
)


def glyph_shapes(d, fill, M=np.eye(3), rule="evenodd"):
    return [shape(fill, xform(path(d), M), rule=rule)]


def stroke(points, width, fill, steps_per_unit=4.0, scale=8):
    """Round-capped, round-joined polyline outline (vectorised via a high-res mask)."""
    pts = np.asarray(points, float)
    lo = pts.min(0) - width
    hi = pts.max(0) + width
    size = np.ceil((hi - lo) * scale).astype(int) + 2
    m = np.zeros((size[1], size[0]), np.uint8)
    p = np.round((pts - lo) * scale).astype(np.int32)
    cv2.polylines(m, [p], False, 1, thickness=int(round(width * scale)), lineType=cv2.LINE_8)
    for q in p:
        cv2.circle(m, tuple(int(v) for v in q), int(round(width * scale / 2)), 1, -1)
    return shape(fill, outline_from_mask(m, 1 / scale, lo, simplify=0.6), rule="evenodd")


def check_mark(fill, cx=50, cy=50, s=1.0):
    return stroke([(cx - 22 * s, cy + 2 * s), (cx - 6 * s, cy + 17 * s), (cx + 24 * s, cy - 15 * s)], 12 * s, fill)


def font_glyph(ch, font_path, weight, fill, box=(0, 0, 100, 100)):
    """Outline of a font glyph (e.g. Nunito's pi) fitted into `box`."""
    f = ImageFont.truetype(str(font_path), 800)
    f.set_variation_by_axes([weight])
    x0, y0, x1, y1 = f.getbbox(ch)
    im = Image.new("L", (x1 - x0 + 40, y1 - y0 + 40), 0)
    ImageDraw.Draw(im).text((20 - x0, 20 - y0), ch, font=f, fill=255)
    m = np.asarray(im) > 127
    bx0, by0, bx1, by1 = box
    s = min((bx1 - bx0) / (x1 - x0), (by1 - by0) / (y1 - y0))
    ox = bx0 + ((bx1 - bx0) - s * (x1 - x0)) / 2 - 20 * s
    oy = by0 + ((by1 - by0) - s * (y1 - y0)) / 2 - 20 * s
    return shape(fill, outline_from_mask(m, s, (ox, oy), simplify=1.2), rule="evenodd")


# ------------------------------------------------------------- UI pieces (2D)

def button(x, y, w, h, r, face, depth, lip_col=None, border=None):
    """Duolingo 3D-button look for boards: lip under the face (in film: real extrusion)."""
    lip_col = lip_col or lip(face)
    out = [shape(lip_col, rrect(x, y + depth, w, h, r))]
    if border:
        out.append(shape(border, rrect(x, y, w, h, r)))
        out.append(shape(face, rrect(x + 3, y + 3, w - 6, h - 6, max(1, r - 3))))
    else:
        out.append(shape(face, rrect(x, y, w, h, r)))
    return out


def node_disc(cx, cy, r, lit=True, depth=None):
    """Lesson node as seen from the front-above: ellipse top + lip (board preview)."""
    depth = depth or r * 0.32
    top, lp = (FEATHER, FEATHER_LIP) if lit else (RAISED, SURFACE)
    out = [shape(lp, ellipse(cx, cy + depth, r, r * 0.62)), shape(lp, rect(cx - r, cy, 2 * r, depth)),
           shape(top, ellipse(cx, cy, r, r * 0.62))]
    if lit:
        out.append(shape(FEATHER_HI, ellipse(cx - r * 0.18, cy - r * 0.2, r * 0.55, r * 0.22), alpha=0.55))
    icon = star(cx, cy, r * 0.36, r * 0.17, round_r=r * 0.05)
    icon[:, 1] = cy + (icon[:, 1] - cy) * 0.62  # lies on the top face: foreshortened like the ellipse
    out.append(shape(WHITE if lit else (82, 101, 109), icon))
    return out


def gem(cx, cy, s, base=MATH):
    """Diamond League badge: brilliant-cut gem, blue family with white facet light."""
    light = tuple(min(255, int(c + (255 - c) * 0.55)) for c in base)
    dark = lip(base, 0.7)
    W, Ht, Hp = 46 * s, 18 * s, 44 * s
    tl, tr = (cx - W * 0.55, cy - Ht), (cx + W * 0.55, cy - Ht)
    l, r_ = (cx - W, cy), (cx + W, cy)
    bot = (cx, cy + Hp)
    crown = np.array([tl, tr, r_, l])
    shapes = [shape(dark, np.array([l, r_, bot])), shape(base, crown)]
    shapes.append(shape(light, np.array([tl, (cx, cy - Ht), (cx - W * 0.2, cy), l])))
    shapes.append(shape(lip(base, 0.85), np.array([(cx, cy - Ht), tr, r_, (cx + W * 0.2, cy)])))
    shapes.append(shape(base, np.array([(cx - W * 0.2, cy), (cx + W * 0.2, cy), bot])))
    shapes.append(shape(light, np.array([l, (cx - W * 0.2, cy), bot]), alpha=0.85))
    shapes.append(shape(WHITE, np.array([(cx - W * 0.42, cy - Ht * 0.75), (cx - W * 0.18, cy - Ht * 0.75), (cx - W * 0.3, cy - Ht * 0.15)]), alpha=0.9))
    return shapes


def render_shapes(shapes, M, size, ss=4):
    return svg.render(shapes, M, size, ss=ss)


def ring(cx, cy, rx, ry, width, fill, n=160):
    """Elliptical ring (outline) as one even-odd shape."""
    return shape(fill, [ellipse(cx, cy, rx + width / 2, ry + width / 2, n=n), ellipse(cx, cy, max(0.1, rx - width / 2), max(0.1, ry - width / 2), n=n)], rule="evenodd")


def globe(fill, cx=50, cy=50, r=38, w=7.5):
    """Languages glyph: a chunky globe (outline, meridian, equator, two latitudes)."""
    out = [ring(cx, cy, r, r, w, fill), ring(cx, cy, r * 0.42, r, w * 0.9, fill)]
    out.append(stroke([(cx - r, cy), (cx + r, cy)], w * 0.9, fill))
    for dy in (-0.52, 0.52):
        half = r * math.sqrt(1 - dy * dy)
        out.append(stroke([(cx - half * 0.96, cy + dy * r), (cx + half * 0.96, cy + dy * r)], w * 0.75, fill))
    return out


def mic(fill):
    """Microphone: capsule + stand (U arc, stem, base)."""
    t = np.linspace(0.0, np.pi, 24)
    arc = np.stack([50 + 22 * np.cos(t), 46 + 22 * np.sin(t)], 1)
    return glyph_shapes(MIC, fill, np.diag([0.78, 0.78, 1.0]) @ np.array([[1, 0, 14], [0, 1, 4], [0, 0, 1.0]]), rule="nonzero") + [
        stroke(arc, 7, fill), stroke([(50, 68), (50, 84)], 7, fill), stroke([(36, 86), (64, 86)], 7, fill)]
