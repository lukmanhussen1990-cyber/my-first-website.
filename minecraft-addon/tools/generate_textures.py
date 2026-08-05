#!/usr/bin/env python3
"""Generate the addon's PNG textures with no third-party dependencies.

Minecraft Bedrock item icons are 16x16 RGBA PNGs; pack icons are 64x64.
Everything here is drawn from a small character-grid so the art stays
editable without an image editor.
"""

import os
import struct
import zlib

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
BP = os.path.join(ROOT, "SecondSight_BP")
RP = os.path.join(ROOT, "SecondSight_RP")


def write_png(path, width, height, rows):
    """rows: list of height lists, each of width (r, g, b, a) tuples."""
    raw = bytearray()
    for row in rows:
        raw.append(0)  # filter type 0 (None) for every scanline
        for px in row:
            raw.extend(px)

    def chunk(tag, data):
        return (
            struct.pack(">I", len(data))
            + tag
            + data
            + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
        )

    ihdr = struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0)
    blob = (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", ihdr)
        + chunk(b"IDAT", zlib.compress(bytes(raw), 9))
        + chunk(b"IEND", b"")
    )
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "wb") as fh:
        fh.write(blob)
    print("wrote", os.path.relpath(path, ROOT))


def grid_to_rows(grid, palette):
    return [[palette[ch] for ch in line] for line in grid]


def scale(rows, factor):
    out = []
    for row in rows:
        big = []
        for px in row:
            big.extend([px] * factor)
        out.extend([big] * factor)
    return out


def over(bg, rows):
    """Composite rows (RGBA) onto a solid background colour."""
    out = []
    for row in rows:
        line = []
        for r, g, b, a in row:
            if a == 0:
                line.append(bg)
            else:
                line.append((r, g, b, 255))
        out.append(line)
    return out


# --- Perspective Lens: an eye, for the second-person camera -----------------
LENS_PALETTE = {
    ".": (0, 0, 0, 0),
    "k": (26, 22, 36, 255),      # outline
    "w": (232, 240, 255, 255),   # sclera
    "c": (72, 206, 232, 255),    # iris rim
    "d": (26, 124, 168, 255),    # iris body
    "p": (14, 18, 30, 255),      # pupil
    "h": (255, 255, 255, 255),   # highlight
}

LENS = [
    "................",
    "................",
    ".....kkkkkk.....",
    "...kkwwwwwwkk...",
    "..kwwwwwwwwwwk..",
    ".kwwwwccccwwwwk.",
    ".kwwwcddddcwwwk.",
    "kwwwcddhpddcwwwk",
    "kwwwcddppddcwwwk",
    ".kwwwcddddcwwwk.",
    ".kwwwwccccwwwwk.",
    "..kwwwwwwwwwwk..",
    "...kkwwwwwwkk...",
    ".....kkkkkk.....",
    "................",
    "................",
]

# --- God Core: a glowing orb, for the god-mode toggle -----------------------
CORE_PALETTE = {
    ".": (0, 0, 0, 0),
    "k": (58, 38, 10, 255),      # outline
    "o": (214, 132, 32, 255),    # deep gold
    "y": (255, 202, 74, 255),    # gold
    "h": (255, 248, 206, 255),   # core glow
}

CORE = [
    "................",
    "......kkkk......",
    "....kkooookk....",
    "...koyyyyyyok...",
    "..koyyhhhhyyok..",
    ".koyyhhhhhhyyok.",
    ".koyhhhyyhhhyok.",
    "koyyhhyyyyhhyyok",
    "koyyhhyyyyhhyyok",
    ".koyhhhyyhhhyok.",
    ".koyyhhhhhhyyok.",
    "..koyyhhhhyyok..",
    "...koyyyyyyok...",
    "....kkooookk....",
    "......kkkk......",
    "................",
]


def main():
    for name, grid, palette in (
        ("ssgm_perspective_lens", LENS, LENS_PALETTE),
        ("ssgm_god_core", CORE, CORE_PALETTE),
    ):
        for line in grid:
            assert len(line) == 16, (name, line, len(line))
        assert len(grid) == 16, name
        rows = grid_to_rows(grid, palette)
        write_png(os.path.join(RP, "textures", "items", name + ".png"), 16, 16, rows)

    # Pack icons: the same art at 4x on a dark slate background.
    lens_big = over((22, 26, 38, 255), scale(grid_to_rows(LENS, LENS_PALETTE), 4))
    core_big = over((30, 24, 16, 255), scale(grid_to_rows(CORE, CORE_PALETTE), 4))
    write_png(os.path.join(RP, "pack_icon.png"), 64, 64, lens_big)
    write_png(os.path.join(BP, "pack_icon.png"), 64, 64, core_big)


if __name__ == "__main__":
    main()
