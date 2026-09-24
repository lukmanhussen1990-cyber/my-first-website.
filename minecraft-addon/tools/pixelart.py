"""Tiny dependency-free pixel-art toolkit used to build the add-on textures.

Sprites are drawn as ASCII grids. Each character maps to a colour in the
sprite's palette; "." is transparent. After the fill is drawn, an outline
is added automatically around every filled pixel (4-neighbour), which is
how vanilla Minecraft item sprites are shaded.
"""
import struct
import zlib


def hex_rgba(value):
    value = value.lstrip("#")
    if len(value) == 6:
        value += "ff"
    return tuple(int(value[i:i + 2], 16) for i in range(0, 8, 2))


class Canvas:
    def __init__(self, width, height):
        self.width = width
        self.height = height
        self.px = [[(0, 0, 0, 0) for _ in range(width)] for _ in range(height)]

    def get(self, x, y):
        if 0 <= x < self.width and 0 <= y < self.height:
            return self.px[y][x]
        return (0, 0, 0, 0)

    def set(self, x, y, rgba):
        if 0 <= x < self.width and 0 <= y < self.height:
            self.px[y][x] = rgba

    def blend(self, x, y, rgba):
        """Alpha-composite a colour over the existing pixel."""
        if not (0 <= x < self.width and 0 <= y < self.height):
            return
        sr, sg, sb, sa = rgba
        dr, dg, db, da = self.px[y][x]
        a = sa / 255.0
        out_a = sa + da * (1 - a)
        if out_a <= 0:
            self.px[y][x] = (0, 0, 0, 0)
            return
        def mix(s, d):
            return int(round((s * sa + d * da * (1 - a)) / out_a))
        self.px[y][x] = (mix(sr, dr), mix(sg, dg), mix(sb, db), int(round(out_a)))

    def paste(self, other, ox, oy, scale=1):
        for y in range(other.height):
            for x in range(other.width):
                c = other.px[y][x]
                if c[3] == 0:
                    continue
                for dy in range(scale):
                    for dx in range(scale):
                        self.blend(ox + x * scale + dx, oy + y * scale + dy, c)

    def to_png(self):
        raw = b"".join(
            b"\x00" + b"".join(struct.pack("BBBB", *p) for p in row) for row in self.px
        )

        def chunk(tag, data):
            body = tag + data
            return struct.pack(">I", len(data)) + body + struct.pack(">I", zlib.crc32(body) & 0xFFFFFFFF)

        header = struct.pack(">IIBBBBB", self.width, self.height, 8, 6, 0, 0, 0)
        return (
            b"\x89PNG\r\n\x1a\n"
            + chunk(b"IHDR", header)
            + chunk(b"IDAT", zlib.compress(raw, 9))
            + chunk(b"IEND", b"")
        )

    def save(self, path):
        with open(path, "wb") as fh:
            fh.write(self.to_png())


def sprite(grid, palette, outline=None, no_outline=""):
    """Build a Canvas from an ASCII grid.

    grid      list of equal-length strings
    palette   dict char -> "#rrggbb" / "#rrggbbaa"
    outline   colour for the automatic outline (None = no outline)
    no_outline characters that should NOT receive an outline (glow pixels)
    """
    h = len(grid)
    w = len(grid[0])
    for row in grid:
        if len(row) != w:
            raise ValueError("ragged sprite row: %r" % row)
    canvas = Canvas(w, h)
    filled = [[False] * w for _ in range(h)]
    for y, row in enumerate(grid):
        for x, ch in enumerate(row):
            if ch == ".":
                continue
            if ch not in palette:
                raise KeyError("colour %r missing from palette" % ch)
            canvas.set(x, y, hex_rgba(palette[ch]))
            filled[y][x] = ch not in no_outline
    if outline:
        oc = hex_rgba(outline)
        for y in range(h):
            for x in range(w):
                if grid[y][x] != ".":
                    continue
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    nx, ny = x + dx, y + dy
                    if 0 <= nx < w and 0 <= ny < h and filled[ny][nx]:
                        canvas.set(x, y, oc)
                        break
    return canvas
