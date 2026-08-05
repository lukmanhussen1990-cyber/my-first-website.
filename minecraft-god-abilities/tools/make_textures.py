#!/usr/bin/env python3
"""Generate the 16x16 item icons and the pack icons for the God Abilities add-on.

Pure standard library (zlib + struct) so it runs anywhere without Pillow.
Run from the repo root:  python3 minecraft-god-abilities/tools/make_textures.py
"""

import os
import struct
import zlib

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
ITEMS_DIR = os.path.join(ROOT, "RP", "textures", "items")


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


TRANSPARENT = (0, 0, 0, 0)


def render(grid, palette):
    pixels = []
    for row in grid:
        assert len(row) == 16, "row must be 16 px wide: %r (%d)" % (row, len(row))
        for ch in row:
            pixels.append(TRANSPARENT if ch == "." else hex_rgba(palette[ch]))
    assert len(grid) == 16, "grid must be 16 rows tall"
    return pixels


def scale(pixels, width, height, factor):
    out = []
    for y in range(height * factor):
        for x in range(width * factor):
            out.append(pixels[(y // factor) * width + (x // factor)])
    return out


# --------------------------------------------------------------------------
# Divine Wrath - lightning bolt
# --------------------------------------------------------------------------
DIVINE_WRATH = [
    "................",
    ".......oo.......",
    "......oyyo......",
    ".....oyyo.......",
    "....oyybo.......",
    "...oyybbo.......",
    "..oyybbyyyyyo...",
    "..oyybbbyyyoo...",
    "....oyybbyyo....",
    ".....oybbyo.....",
    "......oybyo.....",
    ".....oybbo......",
    "....oybbo.......",
    "...oybyo........",
    "...oyyo.........",
    "....oo..........",
]
DIVINE_WRATH_PALETTE = {"o": "#B45B00", "y": "#FFD23F", "b": "#FFFFFF"}

# --------------------------------------------------------------------------
# Genesis Core - orb of life
# --------------------------------------------------------------------------
GENESIS_CORE = [
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
GENESIS_CORE_PALETTE = {"o": "#14532D", "g": "#2FA14B", "l": "#8CE99A", "w": "#F2FFF4"}

# --------------------------------------------------------------------------
# Wings of Heaven
# --------------------------------------------------------------------------
HEAVEN_WINGS = [
    "................",
    "..o..........o..",
    ".ow..........wo.",
    ".owc........cwo.",
    "owwc..gggg..cwwo",
    "owwcc.gwwg.ccwwo",
    "owwwc.gwwg.cwwwo",
    ".owwc.gwwg.cwwo.",
    ".owwcc.gg.ccwwo.",
    "..owwc.gg.cwwo..",
    "..owwc.gg.cwwo..",
    "...owc.gg.cwo...",
    "....oc.gg.co....",
    ".......gg.......",
    ".......og.......",
    "................",
]
HEAVEN_WINGS_PALETTE = {"o": "#5A8FB5", "w": "#FFFFFF", "c": "#C6EBFF", "g": "#FFD84A"}

# --------------------------------------------------------------------------
# Void Ripper - collapsing vortex
# --------------------------------------------------------------------------
VOID_RIPPER = [
    "................",
    "....kkkkkkkk....",
    "..kkppppppppkk..",
    ".kppmmmmmmmmppk.",
    "kppmmkkkkkkmmppk",
    "kpmmkkwwwwkkmmpk",
    "kpmkkwwkkwwkkmpk",
    "kpmkwwkkkkwwkmpk",
    "kpmkwwkkkkwwkmpk",
    "kpmkkwwkkwwkkmpk",
    "kpmmkkwwwwkkmmpk",
    "kppmmkkkkkkmmppk",
    ".kppmmmmmmmmppk.",
    "..kkppppppppkk..",
    "....kkkkkkkk....",
    "................",
]
VOID_RIPPER_PALETTE = {"k": "#140021", "p": "#6B21A8", "m": "#C084FC", "w": "#F5E9FF"}

# --------------------------------------------------------------------------
# Chrono Scepter - hourglass on a golden rod
# --------------------------------------------------------------------------
CHRONO_SCEPTER = [
    "................",
    "...dggggggggd...",
    "...dbbbbbbbbd...",
    "....dccccccd....",
    ".....dccccd.....",
    "......dccd......",
    ".......dd.......",
    "......dccd......",
    ".....dcwwcd.....",
    "....dcwwwwcd....",
    "...dbbbbbbbbd...",
    "...dggggggggd...",
    "......dgd.......",
    "......dgd.......",
    "......dgd.......",
    ".....ddgdd......",
]
CHRONO_SCEPTER_PALETTE = {"d": "#6B4E11", "g": "#E8C25A", "b": "#1E5F8A", "c": "#6FE8FF", "w": "#FFFFFF"}


ICONS = [
    ("godmod_divine_wrath", DIVINE_WRATH, DIVINE_WRATH_PALETTE),
    ("godmod_genesis_core", GENESIS_CORE, GENESIS_CORE_PALETTE),
    ("godmod_heaven_wings", HEAVEN_WINGS, HEAVEN_WINGS_PALETTE),
    ("godmod_void_ripper", VOID_RIPPER, VOID_RIPPER_PALETTE),
    ("godmod_chrono_scepter", CHRONO_SCEPTER, CHRONO_SCEPTER_PALETTE),
]


def make_pack_icon(path):
    """64x64 pack icon: dark storm-sky background with the lightning bolt on top."""
    bolt = render(DIVINE_WRATH, DIVINE_WRATH_PALETTE)
    big = scale(bolt, 16, 16, 4)
    out = []
    for y in range(64):
        for x in range(64):
            top = big[y * 64 + x]
            if top[3]:
                out.append(top)
            else:
                shade = 18 + (y * 34) // 64
                out.append((shade, 8 + shade // 3, 40 + (x * 25) // 64, 255))
    write_png(path, out, 64, 64)


def make_preview(path, factor=6):
    """All five icons side by side on a dark strip, for the README."""
    cell = 16 * factor
    width, height = cell * len(ICONS), cell
    out = [(24, 20, 34, 255)] * (width * height)
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
