#!/usr/bin/env python3
"""Generate the blueprint item icon and pack icons for the Instant Base add-on.

Pure standard library (zlib + struct) so it runs anywhere without Pillow.
Run from the repo root:  python3 minecraft-instant-base/tools/make_textures.py
"""

import os
import struct
import zlib

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
ITEMS_DIR = os.path.join(ROOT, "RP", "textures", "items")

TRANSPARENT = (0, 0, 0, 0)


def write_png(path, pixels, width, height):
    raw = bytearray()
    for y in range(height):
        raw.append(0)
        for x in range(width):
            raw.extend(pixels[y * width + x])

    def chunk(tag, data):
        body = tag + data
        return struct.pack(">I", len(data)) + body + struct.pack(">I", zlib.crc32(body) & 0xFFFFFFFF)

    png = b"\x89PNG\r\n\x1a\n"
    png += chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0))
    png += chunk(b"IDAT", zlib.compress(bytes(raw), 9))
    png += chunk(b"IEND", b"")

    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "wb") as handle:
        handle.write(png)
    print("wrote", os.path.relpath(path, ROOT))


def hex_rgba(value):
    value = value.lstrip("#")
    return (int(value[0:2], 16), int(value[2:4], 16), int(value[4:6], 16), 255)


def render(grid, palette):
    assert len(grid) == 16, "grid must be 16 rows tall"
    pixels = []
    for row in grid:
        assert len(row) == 16, "row must be 16 px wide: %r (%d)" % (row, len(row))
        for ch in row:
            pixels.append(TRANSPARENT if ch == "." else hex_rgba(palette[ch]))
    return pixels


def scale(pixels, width, height, factor):
    out = []
    for y in range(height * factor):
        for x in range(width * factor):
            out.append(pixels[(y // factor) * width + (x // factor)])
    return out


# A rolled-out blueprint sheet with a little house drawn on it.
BLUEPRINT = [
    "................",
    ".dddddddddddddd.",
    ".dbbbbbbbbbbbbd.",
    ".dbbbbbwwbbbbbd.",
    ".dbbbbwbbwbbbbd.",
    ".dbbbwbbbbwbbbd.",
    ".dbbwwwwwwwwbbd.",
    ".dbbwbbbbbbwbbd.",
    ".dbbwbbwwbbwbbd.",
    ".dbbwbbwwbbwbbd.",
    ".dbbwwwwwwwwbbd.",
    ".dbbbbbbbbbbbbd.",
    ".dbwbwbwbwbwbbd.",
    ".dbbbbbbbbbbbbd.",
    ".dddddddddddddd.",
    "................",
]
BLUEPRINT_PALETTE = {"d": "#0A1F45", "b": "#15408C", "w": "#EAF4FF"}


def make_pack_icon(path):
    big = scale(render(BLUEPRINT, BLUEPRINT_PALETTE), 16, 16, 4)
    out = []
    for y in range(64):
        for x in range(64):
            px = big[y * 64 + x]
            out.append(px if px[3] else (26, 24, 20, 255))
    write_png(path, out, 64, 64)


def main():
    write_png(os.path.join(ITEMS_DIR, "base_blueprint.png"), render(BLUEPRINT, BLUEPRINT_PALETTE), 16, 16)
    make_pack_icon(os.path.join(ROOT, "RP", "pack_icon.png"))
    make_pack_icon(os.path.join(ROOT, "BP", "pack_icon.png"))
    make_pack_icon(os.path.join(ROOT, "docs", "preview.png"))


if __name__ == "__main__":
    main()
