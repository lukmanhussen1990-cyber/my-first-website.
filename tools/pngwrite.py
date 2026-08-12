"""Minimal RGBA PNG writer (stdlib only) plus a tiny pixel-art DSL.

Bedrock only ever needs 8-bit RGBA PNGs, so a full imaging library is overkill.
"""

from __future__ import annotations

import struct
import zlib
from pathlib import Path

RGBA = tuple[int, int, int, int]


def write_png(path: str | Path, width: int, height: int, pixels: list[RGBA]) -> None:
    """pixels is a row-major list of (r, g, b, a) of length width*height."""
    if len(pixels) != width * height:
        raise ValueError(f"{path}: expected {width * height} pixels, got {len(pixels)}")

    raw = bytearray()
    for y in range(height):
        raw.append(0)  # filter type 0 (None) for every scanline
        row = pixels[y * width : (y + 1) * width]
        for r, g, b, a in row:
            raw += bytes((r & 255, g & 255, b & 255, a & 255))

    def chunk(tag: bytes, data: bytes) -> bytes:
        return (
            struct.pack(">I", len(data))
            + tag
            + data
            + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
        )

    png = b"\x89PNG\r\n\x1a\n"
    png += chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0))
    png += chunk(b"IDAT", zlib.compress(bytes(raw), 9))
    png += chunk(b"IEND", b"")

    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(png)


class Canvas:
    """Mutable RGBA raster with the handful of primitives the art needs."""

    def __init__(self, width: int, height: int, fill: RGBA = (0, 0, 0, 0)):
        self.w = width
        self.h = height
        self.px: list[RGBA] = [fill] * (width * height)

    def set(self, x: int, y: int, c: RGBA) -> None:
        if 0 <= x < self.w and 0 <= y < self.h and c[3] != 0:
            self.px[y * self.w + x] = c

    def get(self, x: int, y: int) -> RGBA:
        return self.px[y * self.w + x]

    def rect(self, x: int, y: int, w: int, h: int, c: RGBA) -> None:
        for yy in range(y, y + h):
            for xx in range(x, x + w):
                self.set(xx, yy, c)

    def outline(self, x: int, y: int, w: int, h: int, c: RGBA) -> None:
        for xx in range(x, x + w):
            self.set(xx, y, c)
            self.set(xx, y + h - 1, c)
        for yy in range(y, y + h):
            self.set(x, yy, c)
            self.set(x + w - 1, yy, c)

    def line(self, x0: int, y0: int, x1: int, y1: int, c: RGBA) -> None:
        dx, dy = abs(x1 - x0), -abs(y1 - y0)
        sx = 1 if x0 < x1 else -1
        sy = 1 if y0 < y1 else -1
        err = dx + dy
        while True:
            self.set(x0, y0, c)
            if x0 == x1 and y0 == y1:
                return
            e2 = 2 * err
            if e2 >= dy:
                err += dy
                x0 += sx
            if e2 <= dx:
                err += dx
                y0 += sy

    def art(self, x: int, y: int, rows: list[str], palette: dict[str, RGBA]) -> None:
        """Stamp a character-grid sprite. '.' and ' ' are transparent."""
        for ry, row in enumerate(rows):
            for rx, ch in enumerate(row):
                if ch in (".", " "):
                    continue
                if ch not in palette:
                    raise KeyError(f"palette missing {ch!r}")
                self.set(x + rx, y + ry, palette[ch])

    def noise(self, x: int, y: int, w: int, h: int, colors: list[RGBA], seed: int) -> None:
        """Deterministic value noise — keeps texture output reproducible."""
        state = seed & 0xFFFFFFFF
        for yy in range(y, y + h):
            for xx in range(x, x + w):
                state = (state * 1664525 + 1013904223) & 0xFFFFFFFF
                self.set(xx, yy, colors[(state >> 16) % len(colors)])

    def shade_edges(self, x: int, y: int, w: int, h: int, light: RGBA, dark: RGBA) -> None:
        for xx in range(x, x + w):
            self.set(xx, y, light)
            self.set(xx, y + h - 1, dark)
        for yy in range(y, y + h):
            self.set(x, yy, light)
            self.set(x + w - 1, yy, dark)

    def save(self, path: str | Path) -> None:
        write_png(path, self.w, self.h, self.px)
