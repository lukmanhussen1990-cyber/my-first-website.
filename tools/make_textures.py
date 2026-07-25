#!/usr/bin/env python3
"""Generate the addon's PNG textures with no third-party dependencies.

Run from the repo root:  python3 tools/make_textures.py
"""

import os
import struct
import zlib

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# Shared 16x16 fist sprite.
#   . transparent   # outline   O glove   L glove highlight
#   K knuckle shade  W cuff     G glow (aura, serious punch only)
FIST = [
    "................",
    "..############..",
    "..#KK#KK#KK#K#..",
    "..#KK#KK#KK#K#..",
    "..#LO#LO#LO#L#..",
    "..#LO#LO#LO#L#..",
    "..#LO#LO#LO#L#..",
    "..#LO#LO#LO#L#..",
    "..#LO#LO#LO#L#..",
    "..#OO#OO#OO#O#..",
    "..#KKKKKKKKKK#..",
    "..############..",
    "...#WWWWWWWW#...",
    "...#WWWWWWWW#...",
    "...##########...",
    "................",
]

# Aura ring painted onto transparent pixels for the Serious Punch icon.
GLOW = [
    "..GG........GG..",
    "...G........G...",
    "................",
    "................",
    ".G..............",
    "................",
    "..............G.",
    "................",
    "................",
    ".G............G.",
    "................",
    "................",
    "...G........G...",
    "................",
    "...G........G...",
    "..GG........GG..",
]

NORMAL_COLORS = {
    ".": (0, 0, 0, 0),
    "#": (58, 13, 13, 255),
    "O": (216, 59, 47, 255),
    "L": (240, 110, 96, 255),
    "K": (156, 36, 28, 255),
    "W": (236, 236, 236, 255),
    "G": (0, 0, 0, 0),
}

SERIOUS_COLORS = {
    ".": (0, 0, 0, 0),
    "#": (74, 30, 0, 255),
    "O": (240, 150, 26, 255),
    "L": (255, 214, 92, 255),
    "K": (188, 92, 8, 255),
    "W": (255, 245, 214, 255),
    "G": (255, 226, 122, 255),
}


def build_pixels(colors, with_glow):
    pixels = []
    for y, row in enumerate(FIST):
        line = []
        for x, ch in enumerate(row):
            rgba = colors[ch]
            if with_glow and ch == "." and GLOW[y][x] == "G":
                rgba = colors["G"]
            line.append(rgba)
        pixels.append(line)
    return pixels


def scale(pixels, factor):
    out = []
    for row in pixels:
        big = []
        for px in row:
            big.extend([px] * factor)
        out.extend([big] * factor)
    return out


def write_png(path, pixels):
    height = len(pixels)
    width = len(pixels[0])
    raw = bytearray()
    for row in pixels:
        raw.append(0)  # filter type: none
        for r, g, b, a in row:
            raw += bytes((r, g, b, a))

    def chunk(tag, data):
        body = tag + data
        return struct.pack(">I", len(data)) + body + struct.pack(">I", zlib.crc32(body) & 0xFFFFFFFF)

    png = b"\x89PNG\r\n\x1a\n"
    png += chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0))
    png += chunk(b"IDAT", zlib.compress(bytes(raw), 9))
    png += chunk(b"IEND", b"")

    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "wb") as fh:
        fh.write(png)
    print("wrote", os.path.relpath(path, ROOT))


def main():
    normal = build_pixels(NORMAL_COLORS, with_glow=False)
    serious = build_pixels(SERIOUS_COLORS, with_glow=True)
    blank = [[(0, 0, 0, 0)] * 16 for _ in range(16)]

    write_png(os.path.join(ROOT, "OPM_RP/textures/items/opm_normal_punch.png"), normal)
    write_png(os.path.join(ROOT, "OPM_RP/textures/items/opm_serious_punch.png"), serious)
    write_png(os.path.join(ROOT, "OPM_RP/textures/entity/opm_blank.png"), blank)

    icon = scale(serious, 8)  # 128x128 pack icon
    write_png(os.path.join(ROOT, "OPM_RP/pack_icon.png"), icon)
    write_png(os.path.join(ROOT, "OPM_BP/pack_icon.png"), icon)


if __name__ == "__main__":
    main()
