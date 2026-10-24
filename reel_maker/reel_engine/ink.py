"""Hand-drawn line primitives on top of cairo.

Every stroke is a dense polyline displaced along its normal by smooth noise:
a stable "hand" wobble per stroke plus a small "boil" component whose seed
changes BOIL_FPS times per second (the classic boiling-line look of the
reference). Strokes can be drawn on progressively (0..1) and dashed.
"""
from __future__ import annotations

import math
import zlib
from functools import lru_cache
from pathlib import Path

import cairo
import numpy as np

W, H = 1080, 1920
GROUND_Y = 1120          # 58% of the frame, as measured on the reference
BOIL_FPS = 8.0           # re-jitter rate (reference: every 3-4 frames)
WOBBLE = 1.3             # px, stable hand wobble (long, gentle bends)
BOIL = 0.75              # px, boiling jitter

FONT_DIR = Path(__file__).resolve().parent.parent / "assets" / "fonts"
FONT_BOLD = FONT_DIR / "Kalam-Bold.ttf"
FONT_REG = FONT_DIR / "Kalam-Regular.ttf"


def hex2rgb(h: str):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) / 255 for i in (0, 2, 4))


PALETTE = {
    "ink": hex2rgb("#efecea"),
    "dim": hex2rgb("#77736f"),
    "grey": hex2rgb("#8d8a86"),
    "dark": hex2rgb("#4b4b4a"),
    "fill": hex2rgb("#0c0c0d"),      # interior of heads and props
    "yellow": hex2rgb("#ecd462"),
    "gold": hex2rgb("#d9c55a"),
    "pink": hex2rgb("#f27aa6"),
    "green": hex2rgb("#6fcf6a"),
    "red": hex2rgb("#e0464f"),
    "deepred": hex2rgb("#a8344f"),
    "blue": hex2rgb("#7fa9dc"),
    "tan": hex2rgb("#c4a768"),
    "screen": hex2rgb("#dfe9ff"),
}


def color(c):
    if isinstance(c, str):
        return PALETTE[c] if c in PALETTE else hex2rgb(c)
    return c


# ------------------------------------------------------------------ noise
def stable_seed(seed) -> int:
    """Process-independent hash (str hash() is randomised per process)."""
    return zlib.crc32(repr(seed).encode())


def _rng(seed) -> np.random.Generator:
    return np.random.default_rng(stable_seed(seed))


@lru_cache(maxsize=20000)
def _noise_params(seed):
    r = _rng(seed)
    freqs = r.uniform(0.16, 0.75, 3) / 100.0   # cycles per px: one or two gentle bends per limb
    phases = r.uniform(0, 2 * math.pi, 3)
    amps = np.array([1.0, 0.55, 0.3])
    return freqs, phases, amps / amps.sum()


def noise1(s: np.ndarray, seed) -> np.ndarray:
    f, p, a = _noise_params(seed)
    return (a[:, None] * np.sin(2 * math.pi * f[:, None] * s[None, :] + p[:, None])).sum(0)


def boil_index(t: float) -> int:
    return int(math.floor(t * BOIL_FPS))


# ------------------------------------------------------------------ geometry
def resample(pts: np.ndarray, step: float = 6.0) -> np.ndarray:
    pts = np.asarray(pts, float)
    if len(pts) < 2:
        return pts
    seg = np.hypot(*np.diff(pts, axis=0).T)
    s = np.concatenate([[0], np.cumsum(seg)])
    if s[-1] < 1e-6:
        return pts[:1]
    n = max(2, int(s[-1] / step) + 1)
    u = np.linspace(0, s[-1], n)
    return np.stack([np.interp(u, s, pts[:, 0]), np.interp(u, s, pts[:, 1])], 1)


def arclen(pts):
    return np.concatenate([[0], np.cumsum(np.hypot(*np.diff(pts, axis=0).T))])


def line(p0, p1, n=2):
    return np.linspace(p0, p1, n)


def quad(p0, c, p2, n=24):
    t = np.linspace(0, 1, n)[:, None]
    p0, c, p2 = map(np.asarray, (p0, c, p2))
    return (1 - t) ** 2 * p0 + 2 * (1 - t) * t * c + t ** 2 * p2


def cubic(p0, c1, c2, p3, n=32):
    t = np.linspace(0, 1, n)[:, None]
    p0, c1, c2, p3 = map(np.asarray, (p0, c1, c2, p3))
    return (1 - t) ** 3 * p0 + 3 * (1 - t) ** 2 * t * c1 + 3 * (1 - t) * t ** 2 * c2 + t ** 3 * p3


def through(p0, mid, p2, n=24):
    """Quadratic curve from p0 to p2 that passes through `mid`."""
    p0, mid, p2 = map(np.asarray, (p0, mid, p2))
    return quad(p0, 2 * mid - (p0 + p2) / 2, p2, n)


def bent(p0, joint, p2, r=0.22, n=10):
    """Two straight segments with only the corner at `joint` rounded."""
    p0, joint, p2 = map(np.asarray, (p0, joint, p2))
    a = joint + (p0 - joint) * r
    b = joint + (p2 - joint) * r
    return np.vstack([p0, quad(a, joint, b, n), p2])


def arc(cx, cy, rx, ry, a0, a1, n=None):
    n = n or max(8, int(abs(a1 - a0) * max(rx, ry) / 5))
    a = np.linspace(a0, a1, n)
    return np.stack([cx + rx * np.cos(a), cy + ry * np.sin(a)], 1)


def spline(points, n_per=12, closed=False):
    """Catmull-Rom spline through points."""
    P = np.asarray(points, float)
    if closed:
        P = np.vstack([P[-1], P, P[0], P[1]])
    else:
        P = np.vstack([P[0], P, P[-1]])
    out = []
    for i in range(1, len(P) - 2):
        p0, p1, p2, p3 = P[i - 1], P[i], P[i + 1], P[i + 2]
        t = np.linspace(0, 1, n_per, endpoint=False)[:, None]
        out.append(0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t ** 2
                          + (-p0 + 3 * p1 - 3 * p2 + p3) * t ** 3))
    out.append(P[-2][None])
    return np.vstack(out)


def rot(pts, ang, cx=0.0, cy=0.0):
    c, s = math.cos(ang), math.sin(ang)
    p = np.asarray(pts, float) - (cx, cy)
    return np.stack([p[:, 0] * c - p[:, 1] * s, p[:, 0] * s + p[:, 1] * c], 1) + (cx, cy)


def hand_circle(cx, cy, r, seed, overshoot=0.32):
    """Circle drawn in one stroke that overshoots where it closes (small tail)."""
    rr = _rng(("circ", seed))
    a0 = rr.uniform(-2.3, -1.2)
    a = np.linspace(a0, a0 + 2 * math.pi + overshoot, max(24, int(r * 1.2)))
    k = (a - a0) / (2 * math.pi + overshoot)
    rad = r * (1 + 0.025 * np.sin(2 * a + rr.uniform(0, 6))) * (1 - 0.06 * np.clip((k - 0.9) / 0.1, 0, 1))
    return np.stack([cx + rad * np.cos(a), cy + rad * np.sin(a)], 1)


# ------------------------------------------------------------------ canvas
class Canvas:
    """A cairo surface plus the current time (for boil) and global alpha."""

    def __init__(self, t: float):
        self.surface = cairo.ImageSurface(cairo.FORMAT_ARGB32, W, H)
        self.cr = cairo.Context(self.surface)
        self.t = t
        self.boil = boil_index(t)
        self.cr.set_line_cap(cairo.LINE_CAP_ROUND)
        self.cr.set_line_join(cairo.LINE_JOIN_ROUND)

    # --- layers -------------------------------------------------------
    def begin(self, alpha=1.0):
        if alpha < 0.999:
            self.cr.push_group()
        return alpha

    def end(self, alpha):
        if alpha < 0.999:
            self.cr.pop_group_to_source()
            self.cr.paint_with_alpha(max(0.0, alpha))

    # --- strokes ------------------------------------------------------
    def wobbled(self, pts, seed, wobble=WOBBLE, boil=BOIL, step=6.0):
        pts = resample(pts, step)
        if len(pts) < 2 or (wobble <= 0 and boil <= 0):
            return pts
        s = arclen(pts)
        d = np.gradient(pts, axis=0)
        nrm = np.stack([-d[:, 1], d[:, 0]], 1)
        nrm /= np.maximum(np.hypot(*nrm.T), 1e-9)[:, None]
        off = wobble * noise1(s, seed) + boil * noise1(s, (seed, self.boil))
        # whole-stroke boil drift (lines shift slightly, not only bend)
        rr = _rng((seed, self.boil, "drift"))
        drift = rr.uniform(-0.6, 0.6, 2) * boil
        return pts + nrm * off[:, None] + drift

    def stroke(self, pts, seed, width=6.5, col="ink", alpha=1.0, progress=1.0, dash=None,
               wobble=WOBBLE, boil=BOIL, closed=False):
        if alpha <= 0.003 or progress <= 0:
            return
        pts = np.asarray(pts, float)
        if closed:
            pts = np.vstack([pts, pts[:1]])
        p = self.wobbled(pts, seed, wobble, boil)
        if progress < 1:
            s = arclen(p)
            cut = progress * s[-1]
            k = int(np.searchsorted(s, cut))
            if k <= 0:
                return
            if k < len(p):
                f = (cut - s[k - 1]) / max(s[k] - s[k - 1], 1e-9)
                p = np.vstack([p[:k], p[k - 1] + f * (p[k] - p[k - 1])])
        cr = self.cr
        cr.new_path()
        cr.move_to(*p[0])
        for x, y in p[1:]:
            cr.line_to(x, y)
        r, g, b = color(col)
        cr.set_source_rgba(r, g, b, alpha)
        cr.set_line_width(width)
        if dash:
            cr.set_dash(dash)
        cr.stroke()
        if dash:
            cr.set_dash([])

    def fill(self, pts, seed, col="fill", alpha=1.0, wobble=WOBBLE * 0.6, boil=BOIL * 0.6):
        if alpha <= 0.003:
            return
        p = self.wobbled(np.vstack([pts, pts[:1]]), seed, wobble, boil)
        cr = self.cr
        cr.new_path()
        cr.move_to(*p[0])
        for x, y in p[1:]:
            cr.line_to(x, y)
        cr.close_path()
        r, g, b = color(col)
        cr.set_source_rgba(r, g, b, alpha)
        cr.fill()

    def dot(self, x, y, r, col="ink", alpha=1.0):
        rr = _rng(("dot", self.boil, round(x), round(y)))
        x, y = x + rr.uniform(-0.4, 0.4), y + rr.uniform(-0.4, 0.4)
        self.cr.new_path()
        self.cr.arc(x, y, r, 0, 2 * math.pi)
        cr, cg, cb = color(col)
        self.cr.set_source_rgba(cr, cg, cb, alpha)
        self.cr.fill()

    def glow(self, x, y, radius, col="yellow", alpha=0.5):
        if alpha <= 0.003:
            return
        r, g, b = color(col)
        grad = cairo.RadialGradient(x, y, 0, x, y, radius)
        grad.add_color_stop_rgba(0, r, g, b, alpha)
        grad.add_color_stop_rgba(0.35, r, g, b, alpha * 0.45)
        grad.add_color_stop_rgba(1, r, g, b, 0)
        self.cr.new_path()
        self.cr.arc(x, y, radius, 0, 2 * math.pi)
        self.cr.set_source(grad)
        self.cr.fill()

    # --- text ---------------------------------------------------------
    def text(self, s, x, y, size, col="ink", alpha=1.0, anchor="c", bold=True, scale=1.0, angle=0.0,
             jitter=True):
        """Draw text centred (anchor c), left (l) or right (r) on baseline-ish centre y."""
        if alpha <= 0.003 or not s:
            return
        m = text_mask(s, int(round(size)), bold)
        surf, w, h, ox, oy = m
        cr = self.cr
        cr.save()
        if jitter:
            rr = _rng(("txt", s, self.boil))
            x += rr.uniform(-0.5, 0.5)
            y += rr.uniform(-0.5, 0.5)
            angle += rr.uniform(-0.004, 0.004)
        cr.translate(x, y)
        if angle:
            cr.rotate(angle)
        if scale != 1.0:
            cr.scale(scale, scale)
        ax = {"c": -w / 2, "l": 0, "r": -w}[anchor]
        r, g, b = color(col)
        cr.set_source_rgba(r, g, b, alpha)
        cr.mask_surface(surf, ax - ox, -h / 2 - oy)
        cr.restore()


_KEEP = []  # pixel buffers backing cached cairo surfaces


@lru_cache(maxsize=4096)
def _font(size, bold):
    from PIL import ImageFont
    return ImageFont.truetype(str(FONT_BOLD if bold else FONT_REG), size)


def text_width(s, size, bold=True):
    return _font(int(round(size)), bold).getlength(s)


@lru_cache(maxsize=4096)
def text_mask(s, size, bold=True):
    """Pillow-rendered alpha mask as a cairo A8 surface.
    Returns (surface, ink_width, ink_height, offset_x, offset_y): the mask is
    positioned so that (0,0) + offsets is the top-left of the visible ink box
    whose vertical centre is the x-height centre of the line."""
    from PIL import Image, ImageDraw
    f = _font(size, bold)
    pad = int(size * 0.5)
    w = int(f.getlength(s)) + 2 * pad
    asc, desc = f.getmetrics()
    h = asc + desc + 2 * pad
    img = Image.new("L", (w, h), 0)
    ImageDraw.Draw(img).text((pad, pad), s, font=f, fill=255)
    stride = cairo.ImageSurface.format_stride_for_width(cairo.FORMAT_A8, w)
    buf = np.zeros((h, stride), np.uint8)
    buf[:, :w] = np.asarray(img)
    surf = cairo.ImageSurface.create_for_data(memoryview(buf), cairo.FORMAT_A8, w, h, stride)
    _KEEP.append(buf)  # cairo does not own the pixels; keep them alive with the cached surface
    # visual centre of a line = halfway between x-height top and baseline;
    # Canvas.text places the image top at -h/2 - oy so this line lands on y.
    x_top = pad + f.getbbox("x")[1]
    base = pad + asc
    oy = (x_top + base) / 2 - h / 2
    return surf, f.getlength(s), h, pad, oy


# ------------------------------------------------------------------ background
_BG = None


def background_surface():
    """Near-black stage with the reference's soft radial glow (computed once)."""
    global _BG
    if _BG is None:
        yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
        cx, cy = W * 0.5, H * 0.38
        d = np.sqrt(((xx - cx) / (W * 0.62)) ** 2 + ((yy - cy) / (H * 0.36)) ** 2)
        k = np.clip(1 - d, 0, 1) ** 1.6
        centre = np.array([0x17, 0x16, 0x1B], np.float32)
        edge = np.array([0x03, 0x03, 0x03], np.float32)
        img = edge + (centre - edge) * k[..., None]
        # tiny dither to avoid banding on phone screens
        img += np.random.default_rng(7).uniform(-0.6, 0.6, img.shape).astype(np.float32)
        img = np.clip(img, 0, 255).astype(np.uint8)
        bgra = np.zeros((H, W, 4), np.uint8)
        bgra[..., 0], bgra[..., 1], bgra[..., 2], bgra[..., 3] = img[..., 2], img[..., 1], img[..., 0], 255
        surf = cairo.ImageSurface.create_for_data(memoryview(bgra), cairo.FORMAT_ARGB32, W, H, W * 4)
        _KEEP.append(bgra)
        _BG = surf
    return _BG
