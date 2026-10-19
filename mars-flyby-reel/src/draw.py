"""Anti-aliased vector graphics on the float canvas (lines, dashes, arcs, arrows, rings)."""
import math

import cv2
import numpy as np

SH = 4
K = 1 << SH


def _mask(canvas):
    return np.zeros(canvas.shape[:2], np.uint8)


def _apply(canvas, mask, color, alpha):
    a = (mask.astype(np.float32) / 255.0 * alpha)[..., None]
    canvas[:] = canvas * (1 - a) + np.asarray(color, np.float32) * a


def _pt(p):
    return (int(round(p[0] * K)), int(round(p[1] * K)))


def lines(canvas, segs, color, width=2, alpha=1.0, outline=None, outline_w=0):
    """segs: list of ((x0,y0),(x1,y1)). Optional dark outline under the stroke."""
    if outline is not None:
        m = _mask(canvas)
        for p0, p1 in segs:
            cv2.line(m, _pt(p0), _pt(p1), 255, int(width + 2 * outline_w), cv2.LINE_AA, SH)
        _apply(canvas, m, outline, alpha)
    m = _mask(canvas)
    for p0, p1 in segs:
        cv2.line(m, _pt(p0), _pt(p1), 255, int(width), cv2.LINE_AA, SH)
    _apply(canvas, m, color, alpha)


def polyline(canvas, pts, color, width=2, alpha=1.0, outline=None, outline_w=0):
    pts = [p for p in pts if np.all(np.isfinite(p))]
    segs = list(zip(pts[:-1], pts[1:]))
    if segs:
        lines(canvas, segs, color, width, alpha, outline, outline_w)


def dashed(canvas, p0, p1, color, width=2, dash=14, gap=10, alpha=1.0, phase=0.0):
    p0, p1 = np.asarray(p0, float), np.asarray(p1, float)
    L = np.linalg.norm(p1 - p0)
    if L < 1:
        return
    u = (p1 - p0) / L
    segs = []
    s = -phase % (dash + gap)
    s = s - (dash + gap) if s > 0 else s
    while s < L:
        a, b = max(s, 0), min(s + dash, L)
        if b > a:
            segs.append((p0 + u * a, p0 + u * b))
        s += dash + gap
    lines(canvas, segs, color, width, alpha)


def dashed_poly(canvas, pts, color, width=2, dash=14, gap=10, alpha=1.0):
    for p0, p1 in zip(pts[:-1], pts[1:]):
        dashed(canvas, p0, p1, color, width, dash, gap, alpha)


def circle(canvas, c, r, color, width=2, alpha=1.0, fill=False):
    m = _mask(canvas)
    cv2.circle(m, _pt(c), int(round(r * K)), 255, -1 if fill else int(width), cv2.LINE_AA, SH)
    _apply(canvas, m, color, alpha)


def dashed_circle(canvas, c, r, color, width=2, n=72, duty=0.55, alpha=1.0, rot=0.0):
    segs = []
    for i in range(n):
        a0 = rot + 2 * math.pi * i / n
        a1 = a0 + 2 * math.pi * duty / n
        segs.append(((c[0] + r * math.cos(a0), c[1] + r * math.sin(a0)),
                     (c[0] + r * math.cos(a1), c[1] + r * math.sin(a1))))
    lines(canvas, segs, color, width, alpha)


def arc(canvas, c, r, a0, a1, color, width=2, alpha=1.0, steps=64):
    angs = np.linspace(a0, a1, steps)
    pts = [(c[0] + r * math.cos(a), c[1] + r * math.sin(a)) for a in angs]
    polyline(canvas, pts, color, width, alpha)


def arrow(canvas, p0, p1, color, width=4, head=18, alpha=1.0, outline=None):
    p0, p1 = np.asarray(p0, float), np.asarray(p1, float)
    d = p1 - p0
    L = np.linalg.norm(d)
    if L < 1:
        return
    u = d / L
    n = np.array([-u[1], u[0]])
    base = p1 - u * head
    tri = np.array([p1, base + n * head * 0.6, base - n * head * 0.6])
    if outline is not None:
        lines(canvas, [(p0, base)], outline, width + 4, alpha)
        m = _mask(canvas)
        cv2.fillPoly(m, [np.array([_pt(p) for p in (p1 + u * 3, base + n * (head * 0.6 + 3) - u * 2,
                                                    base - n * (head * 0.6 + 3) - u * 2)])], 255, cv2.LINE_AA, SH)
        _apply(canvas, m, outline, alpha)
    lines(canvas, [(p0, base + u * 1)], color, width, alpha)
    m = _mask(canvas)
    cv2.fillPoly(m, [np.array([_pt(p) for p in tri])], 255, cv2.LINE_AA, SH)
    _apply(canvas, m, color, alpha)


def polygon(canvas, pts, color, alpha=1.0):
    m = _mask(canvas)
    cv2.fillPoly(m, [np.array([_pt(p) for p in pts])], 255, cv2.LINE_AA, SH)
    _apply(canvas, m, color, alpha)


def ellipse(canvas, c, axes, angle_deg, color, alpha=1.0, fill=True, width=2):
    m = _mask(canvas)
    cv2.ellipse(m, _pt(c), (int(axes[0] * K), int(axes[1] * K)), angle_deg, 0, 360, 255,
                -1 if fill else int(width), cv2.LINE_AA, SH)
    _apply(canvas, m, color, alpha)


def rounded_rect(canvas, x0, y0, x1, y1, r, color, alpha=1.0, fill=True, width=3):
    m = _mask(canvas)
    pts = []
    for cx, cy, a0 in ((x1 - r, y0 + r, -90), (x1 - r, y1 - r, 0), (x0 + r, y1 - r, 90), (x0 + r, y0 + r, 180)):
        for k in range(10):
            a = math.radians(a0 + 9 * k)
            pts.append((cx + r * math.cos(a), cy + r * math.sin(a)))
    arr = np.array([_pt(p) for p in pts])
    if fill:
        cv2.fillPoly(m, [arr], 255, cv2.LINE_AA, SH)
    else:
        cv2.polylines(m, [arr], True, 255, int(width), cv2.LINE_AA, SH)
    _apply(canvas, m, color, alpha)
