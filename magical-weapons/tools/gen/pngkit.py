"""Tiny dependency-free RGBA canvas, PNG writer and drawing helpers.

Used by the asset generator so the add-on can be rebuilt on any machine with
only the Python standard library (no Pillow / numpy needed).
"""
import math
import random
import struct
import zlib


def hex_rgb(h):
    h = h.lstrip('#')
    return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16))


def clamp8(v):
    return 0 if v < 0 else 255 if v > 255 else int(round(v))


def lerp(a, b, t):
    return a + (b - a) * t


def mix(c1, c2, t):
    """Blend two colours (RGB or RGBA tuples)."""
    n = max(len(c1), len(c2))
    c1 = tuple(c1) + (255,) * (n - len(c1))
    c2 = tuple(c2) + (255,) * (n - len(c2))
    return tuple(clamp8(lerp(c1[i], c2[i], t)) for i in range(n))


def shade(c, f):
    """Multiply brightness (f<1 darker, f>1 lighter, clamped)."""
    return (clamp8(c[0] * f), clamp8(c[1] * f), clamp8(c[2] * f)) + tuple(c[3:])


def ramp(colors, t):
    """Sample a colour ramp (list of colours) at t in [0,1]."""
    t = max(0.0, min(1.0, t))
    if len(colors) == 1:
        return colors[0]
    pos = t * (len(colors) - 1)
    i = min(int(pos), len(colors) - 2)
    return mix(colors[i], colors[i + 1], pos - i)


class Canvas:
    def __init__(self, w, h, fill=(0, 0, 0, 0)):
        self.w = w
        self.h = h
        self.px = [list(fill) for _ in range(w * h)]

    # ---- pixel access
    def inside(self, x, y):
        return 0 <= x < self.w and 0 <= y < self.h

    def get(self, x, y):
        return tuple(self.px[y * self.w + x])

    def set(self, x, y, c):
        if 0 <= x < self.w and 0 <= y < self.h:
            if len(c) == 3:
                c = (c[0], c[1], c[2], 255)
            self.px[y * self.w + x] = [c[0], c[1], c[2], c[3]]

    def over(self, x, y, c):
        """Alpha-composite c over the existing pixel."""
        if not self.inside(x, y):
            return
        if len(c) == 3 or c[3] >= 255:
            self.set(x, y, c)
            return
        a = c[3] / 255.0
        d = self.px[y * self.w + x]
        da = d[3] / 255.0
        oa = a + da * (1 - a)
        if oa <= 0:
            return
        self.px[y * self.w + x] = [
            clamp8((c[0] * a + d[0] * da * (1 - a)) / oa),
            clamp8((c[1] * a + d[1] * da * (1 - a)) / oa),
            clamp8((c[2] * a + d[2] * da * (1 - a)) / oa),
            clamp8(oa * 255),
        ]

    # ---- shapes
    def rect(self, x, y, w, h, c):
        for yy in range(y, y + h):
            for xx in range(x, x + w):
                self.set(xx, yy, c)

    def hline(self, x, y, w, c):
        for xx in range(x, x + w):
            self.set(xx, y, c)

    def vline(self, x, y, h, c):
        for yy in range(y, y + h):
            self.set(x, yy, c)

    def line(self, x0, y0, x1, y1, c, width=1):
        dx, dy = abs(x1 - x0), -abs(y1 - y0)
        sx = 1 if x0 < x1 else -1
        sy = 1 if y0 < y1 else -1
        err = dx + dy
        while True:
            for ox in range(width):
                for oy in range(width):
                    self.set(x0 + ox - width // 2, y0 + oy - width // 2, c)
            if x0 == x1 and y0 == y1:
                break
            e2 = 2 * err
            if e2 >= dy:
                err += dy
                x0 += sx
            if e2 <= dx:
                err += dx
                y0 += sy

    def disc(self, cx, cy, r, c):
        for yy in range(int(cy - r - 1), int(cy + r + 2)):
            for xx in range(int(cx - r - 1), int(cx + r + 2)):
                if (xx + 0.5 - cx) ** 2 + (yy + 0.5 - cy) ** 2 <= r * r:
                    self.set(xx, yy, c)

    def blit(self, src, dx, dy, skip_transparent=False):
        for y in range(src.h):
            for x in range(src.w):
                p = src.px[y * src.w + x]
                if skip_transparent and p[3] == 0:
                    continue
                self.set(dx + x, dy + y, p)

    def map_pixels(self, fn):
        for y in range(self.h):
            for x in range(self.w):
                p = self.px[y * self.w + x]
                r = fn(x, y, tuple(p))
                if r is not None:
                    self.set(x, y, r)

    def outline(self, color, diagonal=False):
        """Add a 1px outline around all opaque pixels (icons)."""
        out = Canvas(self.w, self.h)
        out.px = [list(p) for p in self.px]
        for y in range(self.h):
            for x in range(self.w):
                if self.px[y * self.w + x][3] != 0:
                    continue
                nbrs = [(1, 0), (-1, 0), (0, 1), (0, -1)]
                if diagonal:
                    nbrs += [(1, 1), (1, -1), (-1, 1), (-1, -1)]
                for ox, oy in nbrs:
                    xx, yy = x + ox, y + oy
                    if self.inside(xx, yy) and self.px[yy * self.w + xx][3] > 0:
                        out.set(x, y, color)
                        break
        self.px = out.px

    def scaled(self, k):
        """Nearest-neighbour upscale by integer k."""
        out = Canvas(self.w * k, self.h * k)
        for y in range(out.h):
            for x in range(out.w):
                out.px[y * out.w + x] = list(self.px[(y // k) * self.w + (x // k)])
        return out

    # ---- output
    def png_bytes(self):
        raw = bytearray()
        for y in range(self.h):
            raw.append(0)
            row = self.px[y * self.w:(y + 1) * self.w]
            for p in row:
                raw += bytes((p[0], p[1], p[2], p[3]))

        def chunk(tag, data):
            body = tag + data
            return struct.pack('>I', len(data)) + body + struct.pack('>I', zlib.crc32(body) & 0xFFFFFFFF)

        ihdr = struct.pack('>IIBBBBB', self.w, self.h, 8, 6, 0, 0, 0)
        return b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', ihdr) + chunk(b'IDAT', zlib.compress(bytes(raw), 9)) + chunk(b'IEND', b'')

    def save(self, path):
        with open(path, 'wb') as f:
            f.write(self.png_bytes())


def rng_for(*parts):
    """Deterministic RNG from arbitrary parts, so builds are reproducible."""
    return random.Random('|'.join(str(p) for p in parts))
