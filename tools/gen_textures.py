#!/usr/bin/env python3
"""Generates every item / block / armour / icon / particle PNG in the resource pack.

Built procedurally so the art stays reproducible and no binary blobs are checked
in by hand. Entity skins are generated separately by gen_entity_art.py, which
also emits the matching geometry so the UVs cannot drift apart.

Run: python3 tools/gen_textures.py
"""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from pngwrite import Canvas  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
RP = ROOT / "src" / "resource_pack"
BP = ROOT / "src" / "behavior_pack"

# ---------------------------------------------------------------- palette ---
T = (0, 0, 0, 0)
K = (22, 20, 26, 255)          # outline
DG = (52, 55, 62, 255)         # dark grey
GY = (104, 110, 120, 255)      # grey
LG = (172, 179, 188, 255)      # light grey
WH = (236, 240, 244, 255)      # white
CY = (74, 214, 206, 255)       # cyan
CYD = (24, 116, 120, 255)      # dark cyan
GR = (112, 222, 122, 255)      # green
GRD = (40, 132, 62, 255)
PU = (152, 88, 198, 255)       # mycelium purple
PUD = (84, 42, 118, 255)
PUL = (196, 140, 236, 255)
RE = (206, 62, 62, 255)
RED = (126, 28, 28, 255)
YE = (232, 196, 64, 255)
OR = (226, 140, 52, 255)
BL = (76, 140, 230, 255)
BR = (96, 70, 50, 255)
PK = (224, 134, 206, 255)


def out_item(name: str, c: Canvas) -> None:
    c.save(RP / "textures" / "items" / f"{name}.png")


def out_block(name: str, c: Canvas) -> None:
    c.save(RP / "textures" / "blocks" / f"{name}.png")


# ------------------------------------------------------------------ items ---
def item_scanner() -> Canvas:
    """Handheld scanner: dark chassis, green readout, stubby antenna."""
    c = Canvas(16, 16)
    c.rect(9, 1, 1, 3, GY)          # antenna
    c.set(9, 0, CY)
    c.rect(4, 3, 8, 12, K)          # chassis outline
    c.rect(5, 4, 6, 10, DG)
    c.rect(5, 4, 6, 5, CYD)         # screen bezel
    c.rect(6, 5, 4, 3, (16, 34, 30, 255))
    c.line(6, 7, 9, 7, GR)          # waveform
    c.set(7, 6, GR)
    c.set(8, 5, GR)
    for i, y in enumerate((10, 12)):  # keypad
        for x in (6, 8):
            c.rect(x, y, 2, 1, LG if i == 0 else GY)
    c.shade_edges(5, 4, 6, 10, (72, 78, 88, 255), (34, 36, 42, 255))
    return c


def item_spore_mask() -> Canvas:
    """Respirator: rounded shell, twin filters, tinted lenses."""
    c = Canvas(16, 16)
    c.rect(3, 3, 10, 9, K)
    c.rect(4, 4, 8, 7, (74, 80, 74, 255))
    c.rect(4, 3, 8, 1, (54, 60, 54, 255))   # brow strap
    c.rect(5, 5, 3, 3, K)                    # lenses
    c.rect(8, 5, 3, 3, K)
    c.rect(5, 5, 3, 2, CY)
    c.rect(8, 5, 3, 2, CY)
    c.set(5, 5, WH)
    c.set(8, 5, WH)
    c.rect(6, 9, 4, 3, K)                    # filter housing
    c.rect(6, 9, 4, 2, GY)
    c.set(7, 10, GR)
    c.set(8, 10, GR)
    c.rect(2, 5, 1, 3, GY)                   # straps
    c.rect(13, 5, 1, 3, GY)
    return c


def item_protective_suit() -> Canvas:
    """Hazmat chest piece with hood and visor."""
    c = Canvas(16, 16)
    c.rect(4, 1, 8, 6, K)         # hood
    c.rect(5, 2, 6, 4, YE)
    c.rect(6, 3, 4, 2, CYD)       # visor
    c.rect(6, 3, 4, 1, CY)
    c.rect(3, 7, 10, 8, K)        # torso
    c.rect(4, 8, 8, 6, YE)
    c.rect(4, 8, 8, 1, (250, 220, 96, 255))
    c.rect(7, 8, 2, 6, (208, 172, 44, 255))  # front seam
    c.rect(4, 11, 3, 2, GY)                  # chest pack
    c.set(5, 11, GR)
    c.rect(10, 12, 2, 2, (208, 172, 44, 255))
    c.rect(3, 14, 10, 1, (150, 122, 30, 255))
    return c


def item_medkit() -> Canvas:
    """Emergency medical kit: white case, red cross, handle."""
    c = Canvas(16, 16)
    c.rect(6, 2, 4, 1, GY)        # handle
    c.set(6, 3, GY)
    c.set(9, 3, GY)
    c.rect(2, 4, 12, 10, K)
    c.rect(3, 5, 10, 8, WH)
    c.rect(3, 5, 10, 1, (206, 212, 218, 255))
    c.rect(7, 6, 2, 6, RE)        # cross
    c.rect(5, 8, 6, 2, RE)
    c.rect(3, 9, 10, 1, (188, 194, 202, 255))  # lid seam
    c.rect(7, 12, 2, 1, GY)       # latch
    return c


def item_suppressant() -> Canvas:
    """Mycelium suppressant: syringe with cyan payload."""
    c = Canvas(16, 16)
    c.line(2, 13, 5, 10, LG)      # needle
    c.rect(5, 8, 5, 5, K)         # barrel
    c.rect(6, 9, 3, 3, WH)
    c.rect(6, 10, 3, 2, CY)
    c.rect(9, 6, 5, 5, K)         # plunger housing
    c.rect(10, 7, 3, 3, LG)
    c.line(11, 6, 13, 4, GY)      # plunger rod
    c.rect(12, 2, 3, 3, K)
    c.rect(12, 2, 3, 2, LG)
    c.set(7, 10, WH)              # highlight
    return c


def item_contamination_detector() -> Canvas:
    """Geiger-style detector: dial face, needle, probe."""
    c = Canvas(16, 16)
    c.rect(3, 5, 9, 9, K)
    c.rect(4, 6, 7, 7, DG)
    c.rect(4, 6, 7, 4, LG)        # dial face
    c.line(7, 9, 9, 7, RE)        # needle
    c.set(5, 9, K)
    c.set(9, 9, K)
    c.rect(5, 11, 5, 1, GY)       # grille
    c.rect(5, 12, 5, 1, GY)
    c.rect(11, 3, 2, 4, GY)       # probe
    c.rect(11, 2, 2, 1, PU)
    c.line(11, 7, 11, 9, DG)
    c.set(9, 6, GR)               # power led
    return c


def item_spore_sample() -> Canvas:
    """Sealed sample tube of Mycelium-X spores."""
    c = Canvas(16, 16)
    c.rect(5, 1, 6, 2, K)         # cap
    c.rect(6, 1, 4, 1, GY)
    c.rect(5, 3, 6, 12, K)        # tube
    c.rect(6, 4, 4, 10, (196, 214, 222, 120))
    c.rect(6, 8, 4, 6, PUD)       # contents
    c.rect(6, 8, 4, 1, PU)
    c.set(7, 10, PUL)
    c.set(8, 12, PUL)
    c.set(7, 6, PUL)              # floating spore
    c.rect(6, 4, 1, 10, (238, 244, 248, 90))  # glass highlight
    return c


def item_biofilter() -> Canvas:
    """Replacement filter cartridge for the mask."""
    c = Canvas(16, 16)
    c.rect(3, 4, 10, 8, K)
    c.rect(4, 5, 8, 6, GY)
    for x in range(4, 12, 2):     # filter fins
        c.rect(x, 5, 1, 6, LG)
    c.rect(4, 5, 8, 1, (140, 146, 156, 255))
    c.rect(11, 6, 3, 4, K)        # collar
    c.rect(12, 7, 2, 2, CYD)
    c.rect(2, 6, 2, 4, K)
    c.rect(2, 7, 2, 2, GR)        # freshness indicator
    return c


# ----------------------------------------------------------------- blocks ---
def block_fungal_growth() -> Canvas:
    c = Canvas(16, 16)
    c.noise(0, 0, 16, 16, [PUD, (68, 34, 96, 255), (98, 50, 134, 255)], 0xA11CE)
    for (x, y, r) in ((3, 4, 2), (10, 3, 2), (6, 11, 2), (12, 10, 1), (1, 9, 1)):
        c.rect(x, y, r, r, PU)
        c.set(x, y, PUL)
    c.set(8, 7, PUL)
    c.set(14, 5, PUL)
    return c


def block_infected_block() -> Canvas:
    c = Canvas(16, 16)
    c.noise(0, 0, 16, 16, [(78, 78, 82, 255), (64, 64, 68, 255), (92, 92, 96, 255)], 0xBEEF)
    c.line(2, 0, 5, 8, PUD)       # veins
    c.line(5, 8, 3, 15, PUD)
    c.line(11, 1, 9, 7, PUD)
    c.line(9, 7, 13, 14, PUD)
    c.line(5, 8, 10, 9, PU)
    c.set(5, 8, PUL)
    c.set(9, 7, PUL)
    return c


def block_nest() -> Canvas:
    c = Canvas(16, 16)
    c.noise(0, 0, 16, 16, [(58, 28, 78, 255), (46, 22, 62, 255)], 0xC0FFEE)
    c.rect(4, 4, 8, 8, PUD)       # pod body
    c.rect(5, 3, 6, 10, PUD)
    c.rect(6, 5, 4, 6, PU)
    c.rect(7, 6, 2, 4, PUL)
    c.set(7, 7, WH)
    for (x, y) in ((1, 2), (14, 3), (2, 13), (13, 12)):
        c.set(x, y, PU)
    return c


def block_spore_vent() -> Canvas:
    c = Canvas(16, 16)
    c.rect(0, 0, 16, 16, (40, 40, 46, 255))
    c.noise(0, 0, 16, 16, [(40, 40, 46, 255), (48, 48, 54, 255)], 7)
    for y in (3, 7, 11):
        c.rect(2, y, 12, 2, K)
        c.rect(2, y, 12, 1, PU)
        c.rect(3, y + 1, 10, 1, PUD)
    c.outline(0, 0, 16, 16, (30, 30, 34, 255))
    return c


def block_lab_panel() -> Canvas:
    c = Canvas(16, 16)
    c.rect(0, 0, 16, 16, WH)
    c.rect(0, 0, 16, 1, (250, 252, 254, 255))
    c.rect(0, 15, 16, 1, (196, 202, 210, 255))
    c.rect(0, 7, 16, 1, (208, 214, 222, 255))   # seam
    c.rect(7, 0, 1, 16, (208, 214, 222, 255))
    c.rect(2, 2, 4, 4, (222, 232, 240, 255))
    c.rect(10, 10, 4, 4, (222, 232, 240, 255))
    c.set(3, 3, CY)
    c.set(12, 12, CY)
    return c


def block_server_rack() -> Canvas:
    c = Canvas(16, 16)
    c.rect(0, 0, 16, 16, (28, 30, 36, 255))
    c.outline(0, 0, 16, 16, (16, 18, 22, 255))
    for i, y in enumerate(range(1, 15, 3)):
        c.rect(1, y, 14, 2, (44, 47, 55, 255))
        c.rect(1, y, 14, 1, (56, 60, 70, 255))
        for j, x in enumerate(range(2, 8, 2)):
            c.set(x, y, GR if (i + j) % 3 else YE)
        c.rect(10, y, 4, 1, (34, 36, 42, 255))  # vent slots
    return c


def block_screen() -> Canvas:
    c = Canvas(16, 16)
    c.rect(0, 0, 16, 16, (18, 18, 22, 255))
    c.rect(1, 1, 14, 14, (10, 16, 20, 255))
    c.rect(2, 2, 12, 2, CYD)                     # header bar
    c.rect(2, 2, 8, 1, CY)
    for i, y in enumerate((6, 8, 10)):           # text lines
        c.rect(3, y, 9 - i * 2, 1, (36, 92, 96, 255))
    c.rect(3, 12, 10, 2, (14, 40, 44, 255))      # graph
    c.line(3, 13, 6, 12, GR)
    c.line(6, 12, 9, 13, GR)
    c.line(9, 13, 12, 12, GR)
    return c


def block_alarm_light() -> Canvas:
    c = Canvas(16, 16)
    c.rect(0, 0, 16, 16, (46, 46, 52, 255))
    c.noise(0, 0, 16, 16, [(46, 46, 52, 255), (54, 54, 60, 255)], 11)
    c.rect(3, 3, 10, 10, K)
    c.rect(4, 4, 8, 8, RED)
    c.rect(5, 5, 6, 6, RE)
    c.rect(6, 6, 4, 4, (246, 116, 96, 255))
    c.rect(7, 7, 2, 2, (255, 220, 200, 255))
    c.rect(3, 2, 10, 1, GY)      # housing lip
    c.rect(3, 13, 10, 1, GY)
    return c


def block_alarm_light_on() -> Canvas:
    """Lit twin of the alarm light — lockdown must read at a glance."""
    c = Canvas(16, 16)
    c.rect(0, 0, 16, 16, (86, 42, 42, 255))
    c.noise(0, 0, 16, 16, [(86, 42, 42, 255), (98, 50, 50, 255)], 11)
    c.rect(2, 2, 12, 12, (150, 40, 40, 255))
    c.rect(3, 3, 10, 10, K)
    c.rect(4, 4, 8, 8, (232, 64, 52, 255))
    c.rect(5, 5, 6, 6, (255, 116, 88, 255))
    c.rect(6, 6, 4, 4, (255, 196, 168, 255))
    c.rect(7, 7, 2, 2, (255, 255, 250, 255))
    for (x, y) in ((1, 1), (14, 1), (1, 14), (14, 14)):  # glow spill
        c.set(x, y, (200, 90, 80, 255))
    c.rect(3, 1, 10, 1, (188, 78, 70, 255))
    c.rect(3, 14, 10, 1, (188, 78, 70, 255))
    return c


def block_emergency_light() -> Canvas:
    """Red-washed ceiling panel used while the mansion is sealed."""
    c = Canvas(16, 16)
    c.rect(0, 0, 16, 16, (196, 86, 78, 255))
    c.noise(1, 1, 14, 14, [(196, 86, 78, 255), (206, 96, 86, 255)], 5)
    c.rect(0, 0, 16, 1, (236, 138, 124, 255))
    c.rect(0, 15, 16, 1, (140, 52, 48, 255))
    c.rect(0, 0, 1, 16, (236, 138, 124, 255))
    c.rect(15, 0, 1, 16, (140, 52, 48, 255))
    c.rect(2, 2, 12, 5, (255, 168, 150, 255))   # lit strip
    c.rect(2, 9, 12, 5, (255, 168, 150, 255))
    c.rect(3, 3, 10, 3, (255, 226, 214, 255))
    c.rect(3, 10, 10, 3, (255, 226, 214, 255))
    c.rect(0, 7, 16, 2, (150, 58, 54, 255))     # housing seam
    return c


def block_clean_panel() -> Canvas:
    c = Canvas(16, 16)
    c.rect(0, 0, 16, 16, (216, 220, 226, 255))
    c.noise(1, 1, 14, 14, [(216, 220, 226, 255), (212, 216, 223, 255)], 3)
    c.rect(0, 0, 16, 1, (238, 242, 246, 255))
    c.rect(0, 15, 16, 1, (176, 182, 190, 255))
    c.rect(0, 0, 1, 16, (238, 242, 246, 255))
    c.rect(15, 0, 1, 16, (176, 182, 190, 255))
    c.rect(0, 7, 16, 1, (192, 198, 206, 255))
    return c


# ------------------------------------------------- armour / icons / misc ---
def armor_layer1() -> Canvas:
    """64x32 armour layer 1: helmet + chestplate + boots regions."""
    c = Canvas(64, 32)
    suit = YE
    dark = (186, 154, 38, 255)
    glass = (58, 150, 158, 255)

    # Helmet (head box, uv 0,0 in armour layout)
    c.rect(8, 0, 16, 8, dark)       # top / bottom of head
    c.rect(0, 8, 32, 8, suit)       # the four head sides
    c.rect(8, 8, 8, 8, dark)        # face plate
    c.rect(9, 10, 6, 4, glass)      # visor
    c.rect(9, 10, 6, 1, (120, 220, 226, 255))
    c.rect(11, 14, 2, 2, GY)        # filter

    # Chestplate (body, uv 16,16)
    c.rect(20, 16, 16, 4, dark)
    c.rect(16, 20, 24, 12, suit)
    c.rect(20, 20, 8, 12, suit)
    c.rect(23, 20, 2, 12, dark)     # centre seam
    c.rect(21, 26, 3, 3, GY)        # chest unit
    c.set(22, 27, GR)

    # Arms (uv 40,16 right / 40,16 mirrored for left in layer 1)
    c.rect(44, 16, 8, 4, dark)
    c.rect(40, 20, 16, 12, suit)
    c.rect(40, 20, 16, 1, (250, 220, 96, 255))

    # Boots share the leg region (uv 0,16)
    c.rect(4, 16, 8, 4, dark)
    c.rect(0, 20, 16, 12, suit)
    c.rect(0, 28, 16, 4, (120, 100, 26, 255))   # sole
    return c


def armor_layer2() -> Canvas:
    """64x32 armour layer 2: leggings region."""
    c = Canvas(64, 32)
    suit = (208, 176, 48, 255)
    c.rect(20, 16, 16, 4, suit)      # belt top
    c.rect(16, 20, 24, 12, suit)
    c.rect(16, 20, 24, 2, (150, 122, 30, 255))  # belt
    c.rect(4, 16, 8, 4, suit)
    c.rect(0, 20, 16, 12, suit)
    c.rect(0, 20, 16, 1, (150, 122, 30, 255))
    return c


def particle_spore() -> Canvas:
    """16x16 sheet: four 8x8 spore blobs the particle JSON samples by uv."""
    c = Canvas(16, 16)
    blobs = [
        (0, 0, PUL),
        (8, 0, PU),
        (0, 8, PUD),
        (8, 8, (216, 176, 250, 255)),
    ]
    for ox, oy, col in blobs:
        c.rect(ox + 2, oy + 1, 4, 6, col)
        c.rect(ox + 1, oy + 2, 6, 4, col)
        c.set(ox + 2, oy + 2, (255, 255, 255, 190))
    return c


def pack_icon(primary, accent, glyph: str) -> Canvas:
    """128x128 pack icon: gradient plate, mansion silhouette, spore mark."""
    c = Canvas(128, 128)
    for y in range(128):
        t = y / 127
        col = (
            int(primary[0] * (1 - t) + accent[0] * t),
            int(primary[1] * (1 - t) + accent[1] * t),
            int(primary[2] * (1 - t) + accent[2] * t),
            255,
        )
        c.rect(0, y, 128, 1, col)

    # Mansion silhouette
    c.rect(18, 74, 92, 40, (18, 20, 26, 255))
    c.rect(26, 58, 34, 18, (18, 20, 26, 255))
    c.rect(68, 48, 34, 28, (18, 20, 26, 255))
    for row in range(4):
        for col_i in range(9):
            x = 24 + col_i * 10
            y = 80 + row * 9
            if y < 112 and x < 106:
                c.rect(x, y, 6, 5, CY if (row + col_i) % 3 else (30, 90, 96, 255))
    for col_i in range(3):
        c.rect(72 + col_i * 10, 54, 6, 14, CY)

    # Spore mark
    cx, cy = 96, 30
    for r, col in ((16, PUD), (11, PU), (6, PUL)):
        for y in range(cy - r, cy + r + 1):
            for x in range(cx - r, cx + r + 1):
                if (x - cx) ** 2 + (y - cy) ** 2 <= r * r:
                    c.set(x, y, col)
    c.rect(cx - 1, cy - 1, 3, 3, WH)
    c.rect(0, 0, 128, 3, (10, 12, 16, 255))
    c.rect(0, 125, 128, 3, (10, 12, 16, 255))
    return c


ITEMS = {
    "myc_scanner": item_scanner,
    "myc_spore_mask": item_spore_mask,
    "myc_protective_suit": item_protective_suit,
    "myc_medkit": item_medkit,
    "myc_suppressant": item_suppressant,
    "myc_contamination_detector": item_contamination_detector,
    "myc_spore_sample": item_spore_sample,
    "myc_biofilter": item_biofilter,
}

BLOCKS = {
    "myc_fungal_growth": block_fungal_growth,
    "myc_infected_block": block_infected_block,
    "myc_nest": block_nest,
    "myc_spore_vent": block_spore_vent,
    "myc_lab_panel": block_lab_panel,
    "myc_server_rack": block_server_rack,
    "myc_screen": block_screen,
    "myc_alarm_light": block_alarm_light,
    "myc_alarm_light_on": block_alarm_light_on,
    "myc_emergency_light": block_emergency_light,
    "myc_clean_panel": block_clean_panel,
}


def main() -> None:
    for name, fn in ITEMS.items():
        out_item(name, fn())
    for name, fn in BLOCKS.items():
        out_block(name, fn())

    armor_layer1().save(RP / "textures" / "models" / "armor" / "myc_suit_1.png")
    armor_layer2().save(RP / "textures" / "models" / "armor" / "myc_suit_2.png")
    particle_spore().save(RP / "textures" / "particle" / "myc_spores.png")

    icon = pack_icon((26, 30, 42), (74, 40, 96), "M")
    icon.save(RP / "pack_icon.png")
    icon.save(BP / "pack_icon.png")

    total = len(ITEMS) + len(BLOCKS) + 5
    print(f"wrote {total} textures ({len(ITEMS)} items, {len(BLOCKS)} blocks, armour x2, particle, icons)")


if __name__ == "__main__":
    main()
