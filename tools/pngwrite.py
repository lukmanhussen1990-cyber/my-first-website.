"""Minimal dependency-free PNG writer plus a small pixel canvas.

Everything in the NPC Kingdom add-on is generated, including the art, so the
build has no third-party requirements (no Pillow, no numpy).
"""

import struct
import zlib

TRANSPARENT = (0, 0, 0, 0)


def _chunk(tag, data):
    out = struct.pack(">I", len(data)) + tag + data
    return out + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)


class Canvas:
    """RGBA pixel buffer with the handful of drawing helpers the art needs."""

    def __init__(self, width, height, fill=TRANSPARENT):
        self.w = width
        self.h = height
        self.px = [[fill for _ in range(width)] for _ in range(height)]

    def set(self, x, y, color):
        if color is None:
            return
        if 0 <= x < self.w and 0 <= y < self.h:
            self.px[y][x] = color

    def get(self, x, y):
        return self.px[y][x]

    def rect(self, x, y, w, h, color):
        for j in range(y, y + h):
            for i in range(x, x + w):
                self.set(i, j, color)

    def outline(self, x, y, w, h, color):
        for i in range(x, x + w):
            self.set(i, y, color)
            self.set(i, y + h - 1, color)
        for j in range(y, y + h):
            self.set(x, j, color)
            self.set(x + w - 1, j, color)

    def blit_art(self, x, y, art, palette):
        """Draw ASCII art. '.' and ' ' are treated as transparent."""
        for j, row in enumerate(art):
            for i, ch in enumerate(row):
                if ch in ".  ":
                    continue
                self.set(x + i, y + j, palette[ch])

    def save(self, path):
        raw = bytearray()
        for row in self.px:
            raw.append(0)  # filter type 0
            for r, g, b, a in row:
                raw += bytes((r & 255, g & 255, b & 255, a & 255))
        header = struct.pack(">IIBBBBB", self.w, self.h, 8, 6, 0, 0, 0)
        blob = (
            b"\x89PNG\r\n\x1a\n"
            + _chunk(b"IHDR", header)
            + _chunk(b"IDAT", zlib.compress(bytes(raw), 9))
            + _chunk(b"IEND", b"")
        )
        with open(path, "wb") as fh:
            fh.write(blob)


def rgb(value, alpha=255):
    """0xRRGGBB -> RGBA tuple."""
    return ((value >> 16) & 255, (value >> 8) & 255, value & 255, alpha)


def shade(color, factor):
    r, g, b, a = color
    def f(c):
        return max(0, min(255, int(c * factor)))
    return (f(r), f(g), f(b), a)


def noise(x, y, salt=0):
    """Deterministic tiny hash used for pixel-level texture grain."""
    n = (x * 73856093) ^ (y * 19349663) ^ (salt * 83492791)
    n = (n ^ (n >> 13)) * 1274126177
    return ((n ^ (n >> 16)) & 0xFFFF) / 65535.0


def grain(canvas, x, y, w, h, amount=0.10, salt=0):
    """Apply subtle per-pixel brightness variation so flat fills read as cloth
    or stone rather than plastic."""
    for j in range(y, y + h):
        for i in range(x, x + w):
            if not (0 <= i < canvas.w and 0 <= j < canvas.h):
                continue
            col = canvas.get(i, j)
            if col[3] == 0:
                continue
            factor = 1.0 - amount + (noise(i, j, salt) * amount * 2.0)
            canvas.set(i, j, shade(col, factor))
