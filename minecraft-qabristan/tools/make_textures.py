#!/usr/bin/env python3
"""Generate the 16x16 item icons and pack icons for the Qabristan add-on.

Pure standard library (zlib + struct) so it runs anywhere without Pillow.
Run from the repo root:  python3 minecraft-qabristan/tools/make_textures.py
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


# --------------------------------------------------------------------------
GRAVEDIGGER_SHOVEL = [
    "................",
    ".........iiiii..",
    ".........isssi..",
    ".........isssi..",
    ".........isssi..",
    "..........iii...",
    "..........dh....",
    ".........dh.....",
    "........dh......",
    ".......dh.......",
    "......dh........",
    ".....dh.........",
    "....dh..........",
    "...dh...........",
    "..dd............",
    "................",
]
SHOVEL_PALETTE = {"i": "#C9CCD6", "s": "#8B909C", "h": "#8A5F32", "d": "#4A331B"}

CURSED_LANTERN = [
    "................",
    "......mmmm......",
    ".......mm.......",
    ".....mmmmmm.....",
    "....mggggggm....",
    "....mgffffgm....",
    "....mgfwwfgm....",
    "....mgfwwfgm....",
    "....mgffffgm....",
    "....mgffffgm....",
    "....mggggggm....",
    ".....mmmmmm.....",
    "......mmmm......",
    "................",
    "................",
    "................",
]
LANTERN_PALETTE = {"m": "#4A4A52", "g": "#23232B", "f": "#3FD8F0", "w": "#DFFBFF"}

SOUL_BELL = [
    "................",
    ".......dd.......",
    ".......dd.......",
    "......dggd......",
    ".....dggggd.....",
    ".....dgwwgd.....",
    "....dggwwggd....",
    "....dggwwggd....",
    "...dgggwwgggd...",
    "...dgggggggggd..",
    "..dggggggggggd..",
    "..dddddddddddd..",
    "......dkkd......",
    ".......kk.......",
    "................",
    "................",
]
BELL_PALETTE = {"g": "#E8C25A", "d": "#8A6A1F", "w": "#FFF3C4", "k": "#4A3A10"}

SPIRIT_COMPASS = [
    "................",
    ".....kkkkkk.....",
    "...kksssssskk...",
    "..kssssssssssk..",
    ".kssssssssssssk.",
    ".ksssssrrsssssk.",
    "kssssssrrssssssk",
    "kssssssrrssssssk",
    "kssssssccssssssk",
    "ksssssswwssssssk",
    ".kssssswwsssssk.",
    ".kssssssssssssk.",
    "..kssssssssssk..",
    "...kksssssskk...",
    ".....kkkkkk.....",
    "................",
]
COMPASS_PALETTE = {"k": "#2A2A38", "s": "#9AA2B2", "r": "#E33B3B", "w": "#F2F4F8", "c": "#3FD8F0"}


ICONS = [
    ("qabr_gravedigger_shovel", GRAVEDIGGER_SHOVEL, SHOVEL_PALETTE),
    ("qabr_cursed_lantern", CURSED_LANTERN, LANTERN_PALETTE),
    ("qabr_soul_bell", SOUL_BELL, BELL_PALETTE),
    ("qabr_spirit_compass", SPIRIT_COMPASS, COMPASS_PALETTE),
]


def make_pack_icon(path):
    """64x64 pack icon: the cursed lantern glowing in the dark."""
    big = scale(render(CURSED_LANTERN, LANTERN_PALETTE), 16, 16, 4)
    out = []
    for y in range(64):
        for x in range(64):
            px = big[y * 64 + x]
            if px[3]:
                out.append(px)
            else:
                shade = 8 + (y * 14) // 64
                out.append((shade, shade + 2, shade + 8, 255))
    write_png(path, out, 64, 64)


def make_preview(path, factor=6):
    cell = 16 * factor
    width, height = cell * len(ICONS), cell
    out = [(14, 14, 20, 255)] * (width * height)
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
