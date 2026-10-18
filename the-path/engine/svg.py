"""Minimal SVG reader and rasterizer for the official brand artwork.

Supports what the official Duo and wordmark files use: <path> (all commands,
absolute and relative, including arcs), <rect>, <circle>, <ellipse>,
<polygon>, <polyline>, nested <g> with transforms, solid fills with
fill-opacity / opacity, and nonzero / evenodd fill rules.  <defs>, clip paths
and strokes are ignored (the files rely on none of them for their artwork).

Shapes keep their document order and index so a rig can address existing parts
(wings, eyes, beak...) without redrawing anything.  Rasterization composites
every shape at a supersampled resolution and only then downsamples, so shapes
that abut leave no hairline seams.
"""

from __future__ import annotations

import math
import re
import xml.etree.ElementTree as ET
from dataclasses import dataclass, field
from pathlib import Path

import cv2
import numpy as np

NAMED = {"white": (255, 255, 255), "black": (0, 0, 0), "red": (255, 0, 0), "none": None}
_NUM = re.compile(r"[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?")
_CMD = re.compile(r"([MmLlHhVvCcSsQqTtAaZz])")
FLATTEN_REL = 2e-5  # flattening tolerance as a fraction of the document size (1080-unit file -> 0.02 units)


@dataclass
class Shape:
    index: int
    tag: str
    fill: tuple[int, int, int]
    alpha: float
    rule: str  # "nonzero" | "evenodd"
    contours: list[np.ndarray]  # each (N, 2) float64, user space, element transform applied
    attrs: dict = field(default_factory=dict)

    @property
    def bbox(self):
        pts = np.vstack(self.contours)
        return pts[:, 0].min(), pts[:, 1].min(), pts[:, 0].max(), pts[:, 1].max()

    @property
    def centroid(self):
        x0, y0, x1, y1 = self.bbox
        return (x0 + x1) / 2, (y0 + y1) / 2

    def hex(self):
        return "#%02X%02X%02X" % self.fill


@dataclass
class SvgDoc:
    width: float
    height: float
    viewbox: tuple[float, float, float, float]
    shapes: list[Shape]


# ------------------------------------------------------------------ parsing

def _color(v):
    if v is None:
        return None
    v = v.strip()
    if v.startswith("#"):
        h = v[1:]
        if len(h) == 3:
            h = "".join(c * 2 for c in h)
        return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))
    if v.startswith("rgb("):
        return tuple(int(float(x)) for x in v[4:-1].split(","))
    if v in NAMED:
        return NAMED[v]
    if v.startswith("url("):
        return None  # gradients are not used by the brand files
    return (0, 0, 0)


def _style(el):
    """Presentation attributes overridden by inline CSS.  Like a browser, a CSS
    value this reader cannot use (e.g. `fill: color(display-p3 ...)` written
    after an sRGB fallback) is skipped, so the earlier sRGB declaration wins."""
    st = dict(el.attrib)
    if "style" in st:
        for decl in st.pop("style").split(";"):
            if ":" in decl:
                k, v = (x.strip() for x in decl.split(":", 1))
                if v.startswith(("color(", "var(", "oklch(", "lab(", "lch(")):
                    continue
                st[k] = v
    return st


def _transform(s):
    m = np.eye(3)
    for name, args in re.findall(r"(\w+)\s*\(([^)]*)\)", s or ""):
        a = [float(x) for x in _NUM.findall(args)]
        t = np.eye(3)
        if name == "matrix":
            t[0, :], t[1, :] = [a[0], a[2], a[4]], [a[1], a[3], a[5]]
        elif name == "translate":
            t[0, 2], t[1, 2] = a[0], (a[1] if len(a) > 1 else 0.0)
        elif name == "scale":
            t[0, 0], t[1, 1] = a[0], (a[1] if len(a) > 1 else a[0])
        elif name == "rotate":
            r = math.radians(a[0])
            c, s_ = math.cos(r), math.sin(r)
            rot = np.array([[c, -s_, 0], [s_, c, 0], [0, 0, 1]])
            if len(a) == 3:
                pre = np.array([[1, 0, a[1]], [0, 1, a[2]], [0, 0, 1]])
                post = np.array([[1, 0, -a[1]], [0, 1, -a[2]], [0, 0, 1]])
                rot = pre @ rot @ post
            t = rot
        elif name == "skewX":
            t[0, 1] = math.tan(math.radians(a[0]))
        elif name == "skewY":
            t[1, 0] = math.tan(math.radians(a[0]))
        m = m @ t
    return m


def _cubic(p0, p1, p2, p3, tol):
    # uniform steps: chord error <= M / (8 n^2) with M = max|B''| <= 6 max|p_i - 2p_i+1 + p_i+2|
    d = max(np.linalg.norm(p0 - 2 * p1 + p2), np.linalg.norm(p1 - 2 * p2 + p3))
    n = int(min(512, max(2, math.ceil(math.sqrt(0.75 * d / tol)))))
    t = np.linspace(0, 1, n + 1)[1:, None]
    mt = 1 - t
    return mt ** 3 * p0 + 3 * mt * mt * t * p1 + 3 * mt * t * t * p2 + t ** 3 * p3


def _quad(p0, p1, p2, tol):
    d = np.linalg.norm(p0 - 2 * p1 + p2)
    n = int(min(512, max(2, math.ceil(math.sqrt(0.25 * d / tol)))))
    t = np.linspace(0, 1, n + 1)[1:, None]
    mt = 1 - t
    return mt * mt * p0 + 2 * mt * t * p1 + t * t * p2


def _arc_steps(sweep_rad, radius, tol):
    if radius <= tol:
        return 4
    step = 2 * math.acos(max(-1.0, 1 - tol / radius))
    return int(min(2048, max(4, math.ceil(abs(sweep_rad) / step))))


def _arc(p0, rx, ry, phi_deg, large, sweep, p1, tol):
    """SVG endpoint arc -> points (SVG 1.1 implementation notes F.6.5)."""
    if np.allclose(p0, p1):
        return np.empty((0, 2))
    rx, ry = abs(rx), abs(ry)
    if rx == 0 or ry == 0:
        return p1[None, :]
    phi = math.radians(phi_deg)
    c, s = math.cos(phi), math.sin(phi)
    dx, dy = (p0 - p1) / 2
    x1p, y1p = c * dx + s * dy, -s * dx + c * dy
    lam = (x1p ** 2) / rx ** 2 + (y1p ** 2) / ry ** 2
    if lam > 1:
        rx, ry = rx * math.sqrt(lam), ry * math.sqrt(lam)
    num = rx * rx * ry * ry - rx * rx * y1p * y1p - ry * ry * x1p * x1p
    den = rx * rx * y1p * y1p + ry * ry * x1p * x1p
    coef = math.sqrt(max(0.0, num / den)) if den else 0.0
    if large == sweep:
        coef = -coef
    cxp, cyp = coef * rx * y1p / ry, -coef * ry * x1p / rx
    cx = c * cxp - s * cyp + (p0[0] + p1[0]) / 2
    cy = s * cxp + c * cyp + (p0[1] + p1[1]) / 2

    def ang(u, v):
        a = math.atan2(u[0] * v[1] - u[1] * v[0], u[0] * v[0] + u[1] * v[1])
        return a

    t1 = ang((1, 0), ((x1p - cxp) / rx, (y1p - cyp) / ry))
    dt = ang(((x1p - cxp) / rx, (y1p - cyp) / ry), ((-x1p - cxp) / rx, (-y1p - cyp) / ry))
    if not sweep and dt > 0:
        dt -= 2 * math.pi
    elif sweep and dt < 0:
        dt += 2 * math.pi
    n = _arc_steps(dt, max(rx, ry), tol)
    tt = t1 + dt * np.linspace(0, 1, n + 1)[1:]
    xs = cx + rx * np.cos(tt) * c - ry * np.sin(tt) * s
    ys = cy + rx * np.cos(tt) * s + ry * np.sin(tt) * c
    pts = np.stack([xs, ys], axis=1)
    pts[-1] = p1
    return pts


def parse_path(d: str, tol: float = 0.01) -> list[np.ndarray]:
    tokens = []
    for part in _CMD.split(d):
        part = part.strip()
        if not part:
            continue
        if _CMD.fullmatch(part):
            tokens.append(part)
        else:
            tokens.extend(float(x) for x in _NUM.findall(part))
    contours, cur = [], []
    pos = np.zeros(2)
    start = np.zeros(2)
    last_ctrl = None
    last_cmd = ""
    i = 0
    cmd = None

    def take(k):
        nonlocal i
        vals = tokens[i:i + k]
        i += k
        return [float(v) for v in vals]

    def close_current():
        nonlocal cur
        if len(cur) > 2:
            contours.append(np.array(cur))
        cur = []

    while i < len(tokens):
        if isinstance(tokens[i], str):
            cmd = tokens[i]
            i += 1
            if cmd in "Zz":
                close_current()
                pos = start.copy()
                last_ctrl, last_cmd = None, cmd
                continue
        elif cmd is None:
            raise ValueError("path data must start with a command")
        rel = cmd.islower()
        C = cmd.upper()
        base = pos if rel else np.zeros(2)
        if C == "M":
            x, y = take(2)
            close_current()
            pos = base + (x, y)
            start = pos.copy()
            cur = [pos.copy()]
            cmd = "l" if rel else "L"  # implicit lineto after the first pair
            last_ctrl = None
        elif C == "L":
            x, y = take(2)
            pos = base + (x, y)
            cur.append(pos.copy())
            last_ctrl = None
        elif C == "H":
            (x,) = take(1)
            pos = np.array([pos[0] + x if rel else x, pos[1]])
            cur.append(pos.copy())
            last_ctrl = None
        elif C == "V":
            (y,) = take(1)
            pos = np.array([pos[0], pos[1] + y if rel else y])
            cur.append(pos.copy())
            last_ctrl = None
        elif C == "C":
            a = np.array(take(6)).reshape(3, 2) + base
            cur.extend(_cubic(pos, a[0], a[1], a[2], tol))
            last_ctrl, pos = a[1], a[2]
        elif C == "S":
            a = np.array(take(4)).reshape(2, 2) + base
            c1 = 2 * pos - last_ctrl if (last_ctrl is not None and last_cmd in "CcSs") else pos
            cur.extend(_cubic(pos, c1, a[0], a[1], tol))
            last_ctrl, pos = a[0], a[1]
        elif C == "Q":
            a = np.array(take(4)).reshape(2, 2) + base
            cur.extend(_quad(pos, a[0], a[1], tol))
            last_ctrl, pos = a[0], a[1]
        elif C == "T":
            a = np.array(take(2)) + base
            c1 = 2 * pos - last_ctrl if (last_ctrl is not None and last_cmd in "QqTt") else pos
            cur.extend(_quad(pos, c1, a, tol))
            last_ctrl, pos = c1, a
        elif C == "A":
            rx, ry, phi, large, sweep, x, y = take(7)
            end = base + (x, y)
            cur.extend(_arc(pos, rx, ry, phi, int(large), int(sweep), end, tol))
            pos = end
            last_ctrl = None
        last_cmd = cmd
        if not cur:
            cur = [pos.copy()]
    close_current()
    return contours


def _ellipse(cx, cy, rx, ry, tol):
    t = np.linspace(0, 2 * np.pi, _arc_steps(2 * np.pi, max(rx, ry), tol), endpoint=False)
    return np.stack([cx + rx * np.cos(t), cy + ry * np.sin(t)], axis=1)


def _rect(x, y, w, h, rx, ry):
    if rx <= 0 and ry <= 0:
        return np.array([[x, y], [x + w, y], [x + w, y + h], [x, y + h]], float)
    rx = min(rx or ry, w / 2)
    ry = min(ry or rx, h / 2)
    pts = []
    for cx, cy, a0 in ((x + w - rx, y + ry, -90), (x + w - rx, y + h - ry, 0), (x + rx, y + h - ry, 90), (x + rx, y + ry, 180)):
        t = np.radians(np.linspace(a0, a0 + 90, 24))
        pts.append(np.stack([cx + rx * np.cos(t), cy + ry * np.sin(t)], axis=1))
    return np.vstack(pts)


def load(path: str | Path) -> SvgDoc:
    root = ET.parse(path).getroot()
    vb = root.get("viewBox")
    vb = tuple(float(v) for v in _NUM.findall(vb)) if vb else (0, 0, float(root.get("width")), float(root.get("height")))
    width = float(_NUM.findall(root.get("width", str(vb[2])))[0])
    height = float(_NUM.findall(root.get("height", str(vb[3])))[0])
    shapes: list[Shape] = []
    tol = max(vb[2], vb[3]) * FLATTEN_REL

    def walk(el, m, inherited):
        tag = el.tag.split("}")[-1]
        if tag in ("defs", "clipPath", "mask", "title", "desc", "metadata", "linearGradient", "radialGradient"):
            return
        st = {**inherited, **{k: v for k, v in _style(el).items() if k in ("fill", "fill-opacity", "opacity", "fill-rule")}}
        if "opacity" in _style(el):
            st["_op"] = inherited.get("_op", 1.0) * float(_style(el)["opacity"])
        m = m @ _transform(el.get("transform"))
        contours = None
        if tag == "path":
            contours = parse_path(el.get("d", ""), tol)
        elif tag == "rect":
            g = lambda k, d=0.0: float(_NUM.findall(el.get(k, str(d)))[0])
            contours = [_rect(g("x"), g("y"), g("width"), g("height"), g("rx"), g("ry"))]
        elif tag == "circle":
            r = float(el.get("r"))
            contours = [_ellipse(float(el.get("cx", 0)), float(el.get("cy", 0)), r, r, tol)]
        elif tag == "ellipse":
            contours = [_ellipse(float(el.get("cx", 0)), float(el.get("cy", 0)), float(el.get("rx")), float(el.get("ry")), tol)]
        elif tag in ("polygon", "polyline"):
            pts = np.array([float(v) for v in _NUM.findall(el.get("points", ""))]).reshape(-1, 2)
            contours = [pts]
        if contours is not None:
            fill = _color(st.get("fill", "#000000"))
            if fill is not None and contours:
                alpha = float(st.get("fill-opacity", 1.0)) * st.get("_op", 1.0)
                tc = [((np.c_[c, np.ones(len(c))] @ m.T)[:, :2]) for c in contours if len(c) >= 3]
                if tc:
                    shapes.append(Shape(len(shapes), tag, fill, alpha, st.get("fill-rule", "nonzero"), tc,
                                        {k: v for k, v in el.attrib.items() if k != "d"}))
        for child in el:
            walk(child, m, st)

    walk(root, np.eye(3), {})
    return SvgDoc(width, height, vb, shapes)


# ------------------------------------------------------------- rasterizing

SHIFT = 4  # 1/16 sub-pixel precision for cv2.fillPoly


def coverage(contours_px: list[np.ndarray], rule: str, size: tuple[int, int]) -> np.ndarray:
    """Binary coverage mask (uint8 0/1) of contours already in pixel space."""
    h, w = size
    pts = [np.round(c * (1 << SHIFT)).astype(np.int32).reshape(-1, 1, 2) for c in contours_px]
    if len(pts) == 1:
        m = np.zeros((h, w), np.uint8)
        cv2.fillPoly(m, pts, 1, lineType=cv2.LINE_8, shift=SHIFT)
        return m
    acc = np.zeros((h, w), np.int16)
    for c, p in zip(contours_px, pts):
        m = np.zeros((h, w), np.uint8)
        cv2.fillPoly(m, [p], 1, lineType=cv2.LINE_8, shift=SHIFT)
        if rule == "evenodd":
            acc ^= m.astype(np.int16)
        else:
            x, y = c[:, 0], c[:, 1]
            area = 0.5 * np.sum(x * np.roll(y, -1) - np.roll(x, -1) * y)
            acc += m.astype(np.int16) * (1 if area >= 0 else -1)
    return (acc != 0).astype(np.uint8)


def render(shapes: list[Shape], matrix: np.ndarray, size: tuple[int, int], ss: int = 4,
           part_transforms: dict[int, np.ndarray] | None = None) -> np.ndarray:
    """Render shapes to a straight-alpha RGBA float32 image of `size` (h, w).

    matrix: 3x3 user->pixel transform.  part_transforms optionally maps a shape
    index to an extra 3x3 transform applied in user space before `matrix`
    (used by rigs to rotate a wing, scale an eye, ...).  The artwork's own
    colors and shapes are never altered.
    """
    h, w = size
    H, W = h * ss, w * ss
    S = np.diag([ss, ss, 1.0]) @ matrix
    rgb = np.zeros((H, W, 3), np.float32)
    a = np.zeros((H, W), np.float32)
    for sh in shapes:
        M = S @ part_transforms[sh.index] if part_transforms and sh.index in part_transforms else S
        # SVG puts integer coordinates on pixel corners; cv2.fillPoly on pixel centres
        cps = [(np.c_[c, np.ones(len(c))] @ M.T)[:, :2] - 0.5 for c in sh.contours]
        x0 = min(int(np.floor(c[:, 0].min())) for c in cps)
        y0 = min(int(np.floor(c[:, 1].min())) for c in cps)
        x1 = max(int(np.ceil(c[:, 0].max())) for c in cps) + 1
        y1 = max(int(np.ceil(c[:, 1].max())) for c in cps) + 1
        bx0, by0, bx1, by1 = max(0, x0), max(0, y0), min(W, x1), min(H, y1)
        if bx1 <= bx0 or by1 <= by0:
            continue
        cov = coverage([c - (bx0, by0) for c in cps], sh.rule, (by1 - by0, bx1 - bx0)).astype(np.float32) * sh.alpha
        col = np.array(sh.fill, np.float32) / 255.0
        sl = (slice(by0, by1), slice(bx0, bx1))
        rgb[sl] = rgb[sl] * (1 - cov[..., None]) + col * cov[..., None]
        a[sl] = a[sl] + cov * (1 - a[sl])
    # rgb holds premultiplied colour; box-downsample, then un-premultiply
    prem = cv2.resize(rgb, (w, h), interpolation=cv2.INTER_AREA)
    alpha = cv2.resize(a, (w, h), interpolation=cv2.INTER_AREA)
    out = np.zeros((h, w, 4), np.float32)
    nz = alpha > 1e-6
    out[..., :3][nz] = prem[nz] / alpha[nz, None]
    out[..., 3] = alpha
    return out


def fit_matrix(bbox, size, pad=0.0, align="center"):
    """User->pixel matrix that fits bbox (x0,y0,x1,y1) into size (h,w) uniformly."""
    x0, y0, x1, y1 = bbox
    h, w = size
    s = min((w - 2 * pad) / (x1 - x0), (h - 2 * pad) / (y1 - y0))
    tx = (w - s * (x1 - x0)) / 2 - s * x0
    ty = (h - s * (y1 - y0)) / 2 - s * y0
    return np.array([[s, 0, tx], [0, s, ty], [0, 0, 1.0]])


def to_uint8(rgba: np.ndarray, background=None) -> np.ndarray:
    """Straight-alpha float RGBA -> uint8 RGBA, or RGB composited over `background`."""
    if background is None:
        return np.clip(np.round(rgba * 255), 0, 255).astype(np.uint8)
    bg = np.array(background, np.float32) / 255.0
    rgb = rgba[..., :3] * rgba[..., 3:4] + bg * (1 - rgba[..., 3:4])
    return np.clip(np.round(rgb * 255), 0, 255).astype(np.uint8)
