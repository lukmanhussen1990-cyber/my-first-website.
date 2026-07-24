#!/usr/bin/env python3
"""Generate the binary assets for the addon: pack icons and the marble textures.

Everything is drawn in code so the repository stays free of opaque binaries
that nobody can edit.

Run:  python3 tools/make_assets.py
"""

import math
import os
import random
import struct
import zlib

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BP = os.path.join(ROOT, "behavior_packs", "luxury_house_bp")
RP = os.path.join(ROOT, "resource_packs", "luxury_house_rp")


def write_png(path, rows):
    """rows: list of lists of (r, g, b) tuples."""
    height = len(rows)
    width = len(rows[0])
    raw = b"".join(b"\x00" + b"".join(struct.pack("BBB", *px) for px in row) for row in rows)

    def chunk(tag, data):
        body = tag + data
        return struct.pack(">I", len(data)) + body + struct.pack(">I", zlib.crc32(body) & 0xFFFFFFFF)

    png = b"\x89PNG\r\n\x1a\n"
    png += chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0))
    png += chunk(b"IDAT", zlib.compress(raw, 9))
    png += chunk(b"IEND", b"")

    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "wb") as handle:
        handle.write(png)
    print("wrote %s (%dx%d)" % (os.path.relpath(path, ROOT), width, height))


# --- pack icon ---------------------------------------------------------------

ICON = [
    "................",
    "....gggggggg....",
    "...gggggggggg...",
    "..WWWWWWWWWWWW..",
    "..WbbWWWWWWbbW..",
    "..WbbWWWWWWbbW..",
    "..WWWWWWWWWWWW..",
    "..WbbWWddWWbbW..",
    "..WWWWWddWWWWW..",
    "..WWWWWddWWWWW..",
    "GGGGGGGGGGGGGGGG",
    "GGGPPPPPPPPPPGGG",
    "GGGPPPPPPPPPPGGG",
    "GGGGGGGGGGGGGGGG",
    "................",
    "................",
]

ICON_COLORS = {
    ".": (14, 22, 34),
    "g": (232, 181, 75),
    "W": (242, 244, 247),
    "b": (127, 211, 247),
    "d": (77, 52, 33),
    "G": (62, 122, 58),
    "P": (46, 155, 214),
}


def make_icon(scale=8):
    rows = []
    for line in ICON:
        row = []
        for char in line:
            row.extend([ICON_COLORS[char]] * scale)
        rows.extend([row] * scale)
    return rows


# --- marble ------------------------------------------------------------------


def marble(seed, base=(238, 240, 243), vein=(203, 208, 216), size=16):
    """A quiet marble tile: soft grain plus a couple of diagonal veins."""
    rnd = random.Random(seed)
    rows = []
    for y in range(size):
        row = []
        for x in range(size):
            # two soft veins running across the tile
            v1 = abs(math.sin((x * 0.55 + y * 0.85 + seed) * 0.6))
            v2 = abs(math.sin((x * 0.9 - y * 0.4 + seed * 2) * 0.35))
            strength = max(0.0, 1.0 - min(v1, v2) * 6.0)
            grain = rnd.randint(-4, 4)
            px = []
            for channel in range(3):
                value = base[channel] + (vein[channel] - base[channel]) * strength + grain
                px.append(max(0, min(255, int(value))))
            row.append(tuple(px))
        rows.append(row)
    return rows


def main():
    icon = make_icon()
    write_png(os.path.join(BP, "pack_icon.png"), icon)
    write_png(os.path.join(RP, "pack_icon.png"), icon)

    blocks = os.path.join(RP, "textures", "blocks")
    write_png(os.path.join(blocks, "quartz_block_side.png"), marble(1))
    write_png(os.path.join(blocks, "quartz_block_top.png"), marble(2))
    write_png(os.path.join(blocks, "quartz_block_bottom.png"), marble(3))
    write_png(os.path.join(blocks, "quartz_block_chiseled.png"),
              marble(4, base=(236, 238, 242), vein=(214, 190, 132)))
    write_png(os.path.join(blocks, "quartz_block_chiseled_top.png"),
              marble(5, base=(236, 238, 242), vein=(214, 190, 132)))


if __name__ == "__main__":
    main()
