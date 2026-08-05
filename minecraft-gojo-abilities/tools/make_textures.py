#!/usr/bin/env python3
"""Generate the 16x16 item icons and pack icons for the Gojo Abilities add-on.

Pure standard library (zlib + struct) so it runs anywhere without Pillow.
Run from the repo root:  python3 minecraft-gojo-abilities/tools/make_textures.py
"""

import math
import os
import struct
import zlib

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
ITEMS_DIR = os.path.join(ROOT, "RP", "textures", "items")

TRANSPARENT = (0, 0, 0, 0)


def write_png(path, pixels, width, height):
    """pixels: flat list of (r, g, b, a) tuples, row major."""
    raw = bytearray()
    for y in range(height):
        raw.append(0)  # filter type 0 (None)
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


# --------------------------------------------------------------------------
# Cursed energy sphere - shared shape for Blue, Red and Hollow Purple
# --------------------------------------------------------------------------
SPHERE = [
    "................",
    "......oooo......",
    "....ooggggoo....",
    "...oggllllggo...",
    "..ogglwwwwlggo..",
    "..oglwwwwwwlgo..",
    ".oggllwwwwllggo.",
    ".ogglwwwwwwlggo.",
    ".ogglwwwwwwlggo.",
    ".oggllwwwwllggo.",
    "..oglwwwwwwlgo..",
    "..ogglwwwwlggo..",
    "...oggllllggo...",
    "....ooggggoo....",
    "......oooo......",
    "................",
]

BLUE_PALETTE = {"o": "#041F52", "g": "#0F4FC0", "l": "#3E9BFF", "w": "#CFE9FF"}
RED_PALETTE = {"o": "#4A0707", "g": "#C21A1A", "l": "#FF5A3C", "w": "#FFE3B0"}
PURPLE_PALETTE = {"o": "#16002B", "g": "#5B0FA8", "l": "#A855F7", "w": "#F0D9FF"}

# --------------------------------------------------------------------------
# Infinity - the endless symbol
# --------------------------------------------------------------------------
def make_infinity_grid():
    """Two round loops that touch in the middle - drawn with circle maths so
    they read as an actual infinity sign instead of two boxes."""
    grid = []
    for y in range(16):
        row = ""
        for x in range(16):
            px, py = x + 0.5, y + 0.5
            edge = min(abs(math.hypot(px - cx, py - 8.0) - 3.3) for cx in (4.5, 11.5))
            if edge <= 0.85:
                row += "c"
            elif edge <= 1.7:
                row += "o"
            else:
                row += "."
        grid.append(row)
    return grid


INFINITY = make_infinity_grid()
INFINITY_PALETTE = {"o": "#0B3B6B", "c": "#7DE3FF"}

# --------------------------------------------------------------------------
# Unlimited Void - a black sphere full of information
# --------------------------------------------------------------------------
UNLIMITED_VOID = [
    "................",
    "......kkkk......",
    "....kkddddkk....",
    "...kddddddddk...",
    "..kddwdddddwdk..",
    "..kdddddwddddk..",
    ".kddwddddddwddk.",
    ".kdddddddddddwk.",
    ".kdwddddddddddk.",
    ".kddddddwdddddk.",
    "..kddddddddddk..",
    "..kdwddddddwdk..",
    "...kddddddddk...",
    "....kkddddkk....",
    "......kkkk......",
    "................",
]
UNLIMITED_VOID_PALETTE = {"k": "#05050C", "d": "#1D1B3A", "w": "#FFFFFF"}

# --------------------------------------------------------------------------
# Six Eyes - the blindfold
# --------------------------------------------------------------------------
SIX_EYES = [
    "................",
    "................",
    "................",
    "................",
    "................",
    "..kkkkkkkkkkkk..",
    "wwkkkkkkkkkkkkww",
    "wwkkcccccccckkww",
    "wwkkccbbbbcckkww",
    "wwkkcccccccckkww",
    "wwkkkkkkkkkkkkww",
    "..kkkkkkkkkkkk..",
    "................",
    "................",
    "................",
    "................",
]
SIX_EYES_PALETTE = {"w": "#D8D8D8", "k": "#0E0E16", "c": "#2F6FD0", "b": "#BFEFFF"}


ICONS = [
    ("gojo_six_eyes", SIX_EYES, SIX_EYES_PALETTE),
    ("gojo_infinity", INFINITY, INFINITY_PALETTE),
    ("gojo_blue", SPHERE, BLUE_PALETTE),
    ("gojo_red", SPHERE, RED_PALETTE),
    ("gojo_hollow_purple", SPHERE, PURPLE_PALETTE),
    ("gojo_unlimited_void", UNLIMITED_VOID, UNLIMITED_VOID_PALETTE),
]


def make_pack_icon(path):
    """64x64 pack icon: the Hollow Purple sphere on a dark background."""
    big = scale(render(SPHERE, PURPLE_PALETTE), 16, 16, 4)
    out = []
    for y in range(64):
        for x in range(64):
            top = big[y * 64 + x]
            if top[3]:
                out.append(top)
            else:
                shade = 10 + (y * 22) // 64
                out.append((shade, shade, 20 + (x * 30) // 64, 255))
    write_png(path, out, 64, 64)


def make_preview(path, factor=6):
    """All icons side by side on a dark strip, for the README."""
    cell = 16 * factor
    width, height = cell * len(ICONS), cell
    out = [(18, 18, 30, 255)] * (width * height)
    for index, (_, grid, palette) in enumerate(ICONS):
        big = scale(render(grid, palette), 16, 16, factor)
        for y in range(cell):
            for x in range(cell):
                px = big[y * cell + x]
                if px[3]:
                    out[y * width + index * cell + x] = px
    write_png(path, out, width, height)


def main():
    for name, grid, palette in ICONS:
        write_png(os.path.join(ITEMS_DIR, name + ".png"), render(grid, palette), 16, 16)
    make_pack_icon(os.path.join(ROOT, "RP", "pack_icon.png"))
    make_pack_icon(os.path.join(ROOT, "BP", "pack_icon.png"))
    make_preview(os.path.join(ROOT, "docs", "preview.png"))


if __name__ == "__main__":
    main()
