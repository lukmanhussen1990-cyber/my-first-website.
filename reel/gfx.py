"""A small vector-drawing layer over Pillow.

Everything is drawn as polygons through an affine transform stack onto a
supersampled frame, which is box-filtered down at the end for clean edges.
Design coordinates are always the final 1080x1920 frame.
"""
import math
from contextlib import contextmanager
from functools import lru_cache

import numpy as np
from PIL import Image, ImageDraw, ImageFont

W, H, FPS = 1080, 1920, 30
FONT_DIR = "/usr/share/fonts/opentype/inter/"
FONTS = {
    "black": "InterDisplay-Black.otf",
    "xbold": "InterDisplay-ExtraBold.otf",
    "bold": "InterDisplay-Bold.otf",
}
INK = "#2A1E3C"


# ---------------------------------------------------------------- easing

def clamp(x, a=0.0, b=1.0):
    return a if x < a else b if x > b else x


def lerp(a, b, t):
    return a + (b - a) * t


def prog(t, t0, dur):
    """0..1 progress of an animation that starts at t0 and lasts dur seconds."""
    return clamp((t - t0) / dur) if dur > 0 else float(t >= t0)


def ease_out(p):
    return 1 - (1 - p) ** 3


def ease_in(p):
    return p ** 3


def ease_io(p):
    return 4 * p ** 3 if p < 0.5 else 1 - (-2 * p + 2) ** 3 / 2


def back(p, s=1.9):
    p -= 1
    return 1 + (s + 1) * p ** 3 + s * p ** 2


def elastic(p):
    if p <= 0 or p >= 1:
        return clamp(p)
    return 2 ** (-10 * p) * math.sin((p * 10 - 0.75) * 2 * math.pi / 3) + 1


def pop(t, t0, dur=0.45, s=1.9):
    """Scale for a pop-in: 0 -> overshoot -> 1."""
    p = prog(t, t0, dur)
    return 0.0 if p <= 0 else back(p, s)


def shake(t, t0, dur=0.6, amp=1.0, freq=22.0, seed=0):
    """Decaying random-ish shake value in [-amp, amp]."""
    p = prog(t, t0, dur)
    if p <= 0 or p >= 1:
        return 0.0
    x = (t - t0) * freq
    v = math.sin(x * 2.1 + seed) * 0.6 + math.sin(x * 3.7 + seed * 1.3) * 0.4
    return v * amp * (1 - p) ** 2


def wobble(t, amp=1.0, freq=0.5, seed=0.0):
    return amp * math.sin(2 * math.pi * freq * t + seed)


# ---------------------------------------------------------------- colors

@lru_cache(maxsize=None)
def rgba(c):
    if isinstance(c, tuple):
        return c if len(c) == 4 else (*c, 255)
    h = c.lstrip("#")
    a = int(h[6:8], 16) if len(h) == 8 else 255
    return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), a)


def mix(c1, c2, p):
    a, b = rgba(c1), rgba(c2)
    return tuple(int(round(lerp(x, y, p))) for x, y in zip(a, b))


def fade(c, alpha):
    r, g, b, a = rgba(c)
    return (r, g, b, int(a * clamp(alpha)))


# ---------------------------------------------------------------- fonts / text

@lru_cache(maxsize=256)
def font(name, px):
    return ImageFont.truetype(FONT_DIR + FONTS[name], px)


@lru_cache(maxsize=512)
def rich_sprite(lines, px, name="black", stroke=0, stroke_fill=(0, 0, 0, 255),
                line_gap=1.08, shadow=0):
    """Render lines of (text, color) runs into one centered RGBA sprite.

    lines: tuple of lines, each a tuple of (text, color) runs.
    """
    f = font(name, px)
    space = f.getlength(" ") * 1.3
    asc, desc = f.getmetrics()
    lh = int(px * line_gap)
    widths = [sum(f.getlength(t) for t, _ in ln) + space * (len(ln) - 1) for ln in lines]
    pad = stroke + shadow + 4
    w = int(max(widths)) + 2 * pad
    h = lh * (len(lines) - 1) + asc + desc + 2 * pad
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    for pass_ in ("shadow", "main") if shadow else ("main",):
        for i, ln in enumerate(lines):
            x = pad + (w - 2 * pad - widths[i]) / 2
            y = pad + i * lh
            for txt, col in ln:
                if pass_ == "shadow":
                    d.text((x + shadow * 0.4, y + shadow), txt, font=f, fill=(0, 0, 0, 90),
                           stroke_width=stroke, stroke_fill=(0, 0, 0, 90))
                else:
                    d.text((x, y), txt, font=f, fill=rgba(col), stroke_width=stroke,
                           stroke_fill=rgba(stroke_fill))
                x += f.getlength(txt) + space
    return img


def text_width(text, px, name="black"):
    return font(name, px).getlength(text)


# ---------------------------------------------------------------- geometry helpers

def bezier(p0, p1, p2, p3, n=24):
    t = np.linspace(0, 1, n)[:, None]
    p0, p1, p2, p3 = map(np.asarray, (p0, p1, p2, p3))
    return (1 - t) ** 3 * p0 + 3 * (1 - t) ** 2 * t * p1 + 3 * (1 - t) * t ** 2 * p2 + t ** 3 * p3


def ellipse_pts(cx, cy, rx, ry, a0=0.0, a1=360.0, n=64):
    th = np.radians(np.linspace(a0, a1, n, endpoint=(a1 - a0) % 360 != 0))
    return np.c_[cx + rx * np.cos(th), cy + ry * np.sin(th)]


def rrect_pts(x0, y0, x1, y1, r, n=8):
    r = min(r, (x1 - x0) / 2, (y1 - y0) / 2)
    pts = []
    for cx, cy, a in ((x1 - r, y0 + r, -90), (x1 - r, y1 - r, 0), (x0 + r, y1 - r, 90), (x0 + r, y0 + r, 180)):
        th = np.radians(np.linspace(a, a + 90, n))
        pts.append(np.c_[cx + r * np.cos(th), cy + r * np.sin(th)])
    return np.vstack(pts)


def star_pts(cx, cy, r_out, r_in, n=5, rot=-90):
    th = np.radians(rot + np.arange(2 * n) * 180 / n)
    r = np.where(np.arange(2 * n) % 2 == 0, r_out, r_in)
    return np.c_[cx + r * np.cos(th), cy + r * np.sin(th)]


# ---------------------------------------------------------------- canvas

class Canvas:
    def __init__(self, img, ss, origin=(0, 0)):
        self.img = img
        self.d = ImageDraw.Draw(img, "RGBA")
        self.ss = ss
        self.m = np.array([[ss, 0, -origin[0]], [0, ss, -origin[1]], [0, 0, 1]], float)
        self.alpha = 1.0
        self._stack = []

    # -- transform stack
    def _mul(self, t):
        self.m = self.m @ t

    def translate(self, x, y):
        self._mul(np.array([[1, 0, x], [0, 1, y], [0, 0, 1]], float))

    def scale(self, sx, sy=None):
        sy = sx if sy is None else sy
        self._mul(np.array([[sx, 0, 0], [0, sy, 0], [0, 0, 1]], float))

    def rotate(self, deg):
        if deg:
            c, s = math.cos(math.radians(deg)), math.sin(math.radians(deg))
            self._mul(np.array([[c, -s, 0], [s, c, 0], [0, 0, 1]], float))

    @contextmanager
    def group(self, x=0.0, y=0.0, s=1.0, sx=None, sy=None, rot=0.0, alpha=1.0):
        self._stack.append((self.m.copy(), self.alpha))
        self.translate(x, y)
        self.rotate(rot)
        self.scale(s * (1 if sx is None else sx), s * (1 if sy is None else sy))
        self.alpha *= alpha
        try:
            yield self
        finally:
            self.m, self.alpha = self._stack.pop()

    def P(self, pts):
        a = np.asarray(pts, float).reshape(-1, 2)
        m = self.m
        x = a[:, 0] * m[0, 0] + a[:, 1] * m[0, 1] + m[0, 2]
        y = a[:, 0] * m[1, 0] + a[:, 1] * m[1, 1] + m[1, 2]
        return list(zip(x.tolist(), y.tolist()))

    def k(self):
        return math.sqrt(abs(np.linalg.det(self.m[:2, :2])))

    def angle(self):
        return math.degrees(math.atan2(self.m[1, 0], self.m[0, 0]))

    def col(self, c):
        if c is None:
            return None
        r, g, b, a = rgba(c)
        return (r, g, b, int(a * self.alpha))

    # -- primitives
    def poly(self, pts, fill=None, line=None, lw=0):
        if self.alpha <= 0.003:
            return
        P = self.P(pts)
        if len(P) < 3:
            return
        if fill is not None:
            self.d.polygon(P, fill=self.col(fill))
        if line is not None and lw > 0:
            w = max(1, int(round(lw * self.k())))
            self.d.line(P + P[:2], fill=self.col(line), width=w, joint="curve")

    def ellipse(self, cx, cy, rx, ry=None, fill=None, line=None, lw=0):
        ry = rx if ry is None else ry
        n = int(clamp(max(abs(rx), abs(ry)) * self.k() * 0.5, 24, 200))
        self.poly(ellipse_pts(cx, cy, rx, ry, n=n), fill, line, lw)

    def circle(self, cx, cy, r, fill=None, line=None, lw=0):
        self.ellipse(cx, cy, r, r, fill, line, lw)

    def rrect(self, x0, y0, x1, y1, r, fill=None, line=None, lw=0):
        self.poly(rrect_pts(x0, y0, x1, y1, r), fill, line, lw)

    def stroke(self, pts, lw, color, cap=True):
        if self.alpha <= 0.003:
            return
        P = self.P(pts)
        w = max(1, int(round(lw * self.k())))
        c = self.col(color)
        self.d.line(P, fill=c, width=w, joint="curve")
        if cap and w > 2:
            r = w / 2
            for x, y in (P[0], P[-1]):
                self.d.ellipse((x - r, y - r, x + r, y + r), fill=c)

    def ostroke(self, pts, lw, color, ol=6, ink=INK):
        """Stroke with a dark outline around it."""
        self.stroke(pts, lw + 2 * ol, ink)
        self.stroke(pts, lw, color)

    def arc(self, cx, cy, rx, ry, a0, a1, lw, color, cap=True):
        n = int(clamp(abs(a1 - a0) / 4, 8, 120))
        th = np.radians(np.linspace(a0, a1, n))
        self.stroke(np.c_[cx + rx * np.cos(th), cy + ry * np.sin(th)], lw, color, cap)

    def soft_shadow(self, cx, cy, rx, ry, alpha=0.22, color="#000000", steps=7):
        """Cheap blurred ellipse: stacked translucent ellipses."""
        for i in range(steps):
            f = 1.0 + 0.5 * (1 - i / (steps - 1))
            self.ellipse(cx, cy, rx * f, ry * f, fill=fade(color, alpha / steps * 1.6))

    def glow(self, cx, cy, r, color, alpha=0.35, steps=8):
        for i in range(steps):
            f = 1 - i / steps
            self.circle(cx, cy, r * f, fill=fade(color, alpha / steps))

    # -- text
    def text(self, lines, x, y, size, color="#FFFFFF", name="black", stroke=0,
             stroke_fill=INK, scale=1.0, rot=0.0, alpha=1.0, shadow=0, line_gap=1.08):
        """Draw text centered at (x, y). lines: str, or tuple of lines of (text, color) runs."""
        a = alpha * self.alpha
        if scale <= 0.01 or a <= 0.01:
            return
        if isinstance(lines, str):
            lines = tuple(((ln, color),) for ln in lines.split("\n"))
        k = self.k() * scale
        px = max(4, int(round(size * k)))
        spr = rich_sprite(lines, px, name, int(round(stroke * k)), rgba(stroke_fill), line_gap,
                          int(round(shadow * k)))
        rot = rot + self.angle()
        if abs(rot) > 0.05:
            spr = spr.rotate(-rot, resample=Image.BICUBIC, expand=True)
        if a < 0.999:
            spr = spr.copy()
            spr.putalpha(spr.getchannel("A").point(lambda v: int(v * a)))
        cx, cy = self.P([(x, y)])[0]
        self.img.paste(spr, (int(round(cx - spr.width / 2)), int(round(cy - spr.height / 2))), spr)

    # -- clipping: draw into a region of the frame, then paste back through a mask
    @contextmanager
    def clip(self, pts):
        P = self.P(pts)
        xs, ys = zip(*P)
        x0, y0 = max(0, int(min(xs)) - 2), max(0, int(min(ys)) - 2)
        x1, y1 = min(self.img.width, int(max(xs)) + 3), min(self.img.height, int(max(ys)) + 3)
        if x1 <= x0 or y1 <= y0:
            yield None
            return
        sub = self.img.crop((x0, y0, x1, y1))
        mask = Image.new("L", sub.size, 0)
        ImageDraw.Draw(mask).polygon([(x - x0, y - y0) for x, y in P], fill=255)
        child = Canvas(sub, self.ss)
        child.m = self.m.copy()
        child.m[0, 2] -= x0
        child.m[1, 2] -= y0
        child.alpha = self.alpha
        yield child
        self.img.paste(sub, (x0, y0), mask)


# ---------------------------------------------------------------- backgrounds

@lru_cache(maxsize=16)
def gradient(top, bottom, ss):
    """Vertical gradient as an RGB image at supersampled size."""
    h, w = H * ss, W * ss
    t = np.linspace(0, 1, h, dtype=np.float32)[:, None]
    t = t * t * (3 - 2 * t)
    a = np.array(rgba(top)[:3], np.float32)
    b = np.array(rgba(bottom)[:3], np.float32)
    col = (a * (1 - t) + b * t).astype(np.uint8)
    arr = np.broadcast_to(col[:, None, :], (h, w, 3))
    return Image.fromarray(np.ascontiguousarray(arr), "RGB")
