"""Tiny RGBA canvas + PNG encoder (no third-party imaging libraries needed)."""
import random
import struct
import zlib


def hexc(s, a=255):
    s = s.lstrip("#")
    return (int(s[0:2], 16), int(s[2:4], 16), int(s[4:6], 16), a)


def shade(c, f):
    return (max(0, min(255, int(c[0] * f))), max(0, min(255, int(c[1] * f))),
            max(0, min(255, int(c[2] * f))), c[3])


def mix(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(4))


CLEAR = (0, 0, 0, 0)


class Canvas:
    def __init__(self, w, h, fill=CLEAR):
        self.w, self.h = w, h
        self.px = [[fill for _ in range(w)] for _ in range(h)]

    def put(self, x, y, c):
        if 0 <= x < self.w and 0 <= y < self.h:
            self.px[y][x] = c

    def get(self, x, y):
        return self.px[y][x]

    def rect(self, x, y, w, h, c):
        for yy in range(y, y + h):
            for xx in range(x, x + w):
                self.put(xx, yy, c)

    def noise(self, x, y, w, h, base, var, rng, alpha=None):
        for yy in range(y, y + h):
            for xx in range(x, x + w):
                f = 1.0 + rng.uniform(-var, var)
                c = shade(base, f)
                if alpha is not None:
                    c = (c[0], c[1], c[2], alpha)
                self.put(xx, yy, c)

    def speckle(self, x, y, w, h, c, prob, rng):
        for yy in range(y, y + h):
            for xx in range(x, x + w):
                if rng.random() < prob:
                    self.put(xx, yy, c)

    def border(self, x, y, w, h, c):
        for xx in range(x, x + w):
            self.put(xx, y, c)
            self.put(xx, y + h - 1, c)
        for yy in range(y, y + h):
            self.put(x, yy, c)
            self.put(x + w - 1, yy, c)

    def hline(self, x0, x1, y, c):
        for x in range(x0, x1 + 1):
            self.put(x, y, c)

    def vline(self, x, y0, y1, c):
        for y in range(y0, y1 + 1):
            self.put(x, y, c)

    def stamp(self, x, y, rows, palette):
        for dy, row in enumerate(rows):
            for dx, ch in enumerate(row):
                if ch in palette:
                    self.put(x + dx, y + dy, palette[ch])

    def blit(self, other, x, y):
        for yy in range(other.h):
            for xx in range(other.w):
                c = other.px[yy][xx]
                if c[3]:
                    self.put(x + xx, y + yy, c)

    def copy(self):
        c = Canvas(self.w, self.h)
        c.px = [row[:] for row in self.px]
        return c

    def scaled(self, k):
        c = Canvas(self.w * k, self.h * k)
        for y in range(self.h):
            for x in range(self.w):
                c.rect(x * k, y * k, k, k, self.px[y][x])
        return c

    def png_bytes(self):
        raw = bytearray()
        for row in self.px:
            raw.append(0)
            for (r, g, b, a) in row:
                raw += bytes((r, g, b, a))

        def chunk(tag, data):
            body = tag + data
            return struct.pack(">I", len(data)) + body + struct.pack(">I", zlib.crc32(body) & 0xFFFFFFFF)

        ihdr = struct.pack(">IIBBBBB", self.w, self.h, 8, 6, 0, 0, 0)
        return (b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", ihdr)
                + chunk(b"IDAT", zlib.compress(bytes(raw), 9)) + chunk(b"IEND", b""))

    def save(self, path):
        with open(path, "wb") as f:
            f.write(self.png_bytes())


def rng(seed):
    return random.Random(seed)


def box_faces(u, v, w, h, d):
    """Bedrock box-UV face rectangles for a cube of size (w, h, d) at uv (u, v)."""
    return {
        "top": (u + d, v, w, d),
        "bottom": (u + d + w, v, w, d),
        "right": (u, v + d, d, h),
        "front": (u + d, v + d, w, h),
        "left": (u + d + w, v + d, d, h),
        "back": (u + 2 * d + w, v + d, w, h),
    }
