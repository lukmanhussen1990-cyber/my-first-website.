#!/usr/bin/env python3
"""Generate the security-house block textures (16x16 PNGs, no dependencies).

Run from the repo root:  python3 tools/make_house_textures.py
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pngwrite import scale, write_png  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
N = 16


def noise(x, y, salt):
    """Deterministic per-pixel jitter in the range -1..1."""
    h = (x * 73856093) ^ (y * 19349663) ^ (salt * 83492791)
    h = (h ^ (h >> 13)) * 1274126177 & 0xFFFFFFFF
    return ((h >> 16) % 2001 - 1000) / 1000.0


def shade(color, amount):
    r, g, b, a = color
    return (
        max(0, min(255, int(r + amount))),
        max(0, min(255, int(g + amount))),
        max(0, min(255, int(b + amount))),
        a,
    )


def reinforced_wall():
    base = (74, 80, 88, 255)
    frame = (46, 51, 58, 255)
    rivet = (122, 132, 142, 255)
    px = []
    for y in range(N):
        row = []
        for x in range(N):
            c = shade(base, noise(x, y, 1) * 9)
            if x in (0, 15) or y in (0, 15) or x == 7 or y == 7:
                c = shade(frame, noise(x, y, 2) * 6)
            if (x, y) in ((2, 2), (5, 2), (2, 5), (5, 5),
                          (10, 2), (13, 2), (10, 5), (13, 5),
                          (2, 10), (5, 10), (2, 13), (5, 13),
                          (10, 10), (13, 10), (10, 13), (13, 13)):
                c = rivet
            row.append(c)
        px.append(row)
    return px


def security_floor():
    dark = (44, 48, 54, 255)
    light = (58, 63, 70, 255)
    grout = (30, 33, 38, 255)
    px = []
    for y in range(N):
        row = []
        for x in range(N):
            tile = ((x // 4) + (y // 4)) % 2
            c = shade(light if tile else dark, noise(x, y, 3) * 7)
            if x % 4 == 0 or y % 4 == 0:
                c = shade(grout, noise(x, y, 4) * 4)
            row.append(c)
        px.append(row)
    return px


def vault_wall():
    base = (52, 48, 40, 255)
    stripe = (214, 168, 34, 255)
    frame = (34, 32, 27, 255)
    px = []
    for y in range(N):
        row = []
        for x in range(N):
            c = shade(base, noise(x, y, 5) * 8)
            if ((x + y) // 3) % 3 == 0:
                c = shade(stripe, noise(x, y, 6) * 12)
            if x in (0, 15) or y in (0, 15):
                c = shade(frame, noise(x, y, 7) * 5)
            row.append(c)
        px.append(row)
    return px


def blast_glass():
    pane = (146, 196, 212, 92)
    frame = (58, 74, 82, 255)
    brace = (92, 122, 134, 190)
    px = []
    for y in range(N):
        row = []
        for x in range(N):
            if x in (0, 15) or y in (0, 15):
                c = frame
            elif x in (7, 8) or y in (7, 8):
                c = brace
            else:
                r, g, b, a = pane
                c = shade((r, g, b, a), noise(x, y, 8) * 10)
            row.append(c)
        px.append(row)
    return px


def alarm_lamp():
    core = (250, 242, 208, 255)
    glow = (255, 214, 122, 255)
    frame = (58, 52, 40, 255)
    px = []
    for y in range(N):
        row = []
        for x in range(N):
            d = max(abs(x - 7.5), abs(y - 7.5))
            if x in (0, 15) or y in (0, 15):
                c = frame
            elif d > 5.5:
                c = shade(glow, noise(x, y, 9) * 10)
            else:
                c = shade(core, noise(x, y, 10) * 8)
            row.append(c)
        px.append(row)
    return px


TEXTURES = {
    "sec_reinforced_wall": reinforced_wall,
    "sec_security_floor": security_floor,
    "sec_vault_wall": vault_wall,
    "sec_blast_glass": blast_glass,
    "sec_alarm_lamp": alarm_lamp,
}


def main():
    for name, fn in TEXTURES.items():
        path = os.path.join(ROOT, "SEC_RP/textures/blocks", name + ".png")
        write_png(path, fn())
        print("wrote", os.path.relpath(path, ROOT))

    icon = scale(vault_wall(), 8)  # 128x128 pack icon
    for pack in ("SEC_RP", "SEC_BP"):
        path = os.path.join(ROOT, pack, "pack_icon.png")
        write_png(path, icon)
        print("wrote", os.path.relpath(path, ROOT))


if __name__ == "__main__":
    main()
