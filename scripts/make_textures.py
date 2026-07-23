#!/usr/bin/env python3
"""Generate PNG textures for the Haunted House Add-On (no external deps)."""
import struct
import zlib
import os

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def write_png(path, pixels, w, h):
    """pixels: list of (r,g,b,a) rows-major, length w*h."""
    raw = bytearray()
    for y in range(h):
        raw.append(0)  # filter type 0
        for x in range(w):
            r, g, b, a = pixels[y * w + x]
            raw += bytes((r, g, b, a))

    def chunk(tag, data):
        c = tag + data
        return struct.pack(">I", len(data)) + c + struct.pack(">I", zlib.crc32(c) & 0xFFFFFFFF)

    sig = b"\x89PNG\r\n\x1a\n"
    ihdr = struct.pack(">IIBBBBB", w, h, 8, 6, 0, 0, 0)  # 8-bit RGBA
    idat = zlib.compress(bytes(raw), 9)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "wb") as f:
        f.write(sig + chunk(b"IHDR", ihdr) + chunk(b"IDAT", idat) + chunk(b"IEND", b""))
    print("wrote", os.path.relpath(path, BASE))


def blank(w, h, color):
    return [color] * (w * h)


def px(buf, w, x, y, color):
    if 0 <= x < w and 0 <= y < len(buf) // w:
        buf[y * w + x] = color


def rect(buf, w, x0, y0, x1, y1, color):
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            px(buf, w, x, y, color)


# ---------- Pack icon (128x128): purple sky, moon, haunted house ----------
def make_pack_icon(path, accent):
    W = H = 128
    sky_top = (26, 18, 38, 255)
    sky_bot = (58, 40, 78, 255)
    buf = blank(W, H, sky_top)
    # vertical gradient sky
    for y in range(H):
        t = y / (H - 1)
        r = int(sky_top[0] + (sky_bot[0] - sky_top[0]) * t)
        g = int(sky_top[1] + (sky_bot[1] - sky_top[1]) * t)
        b = int(sky_top[2] + (sky_bot[2] - sky_top[2]) * t)
        for x in range(W):
            buf[y * W + x] = (r, g, b, 255)
    # moon
    moon = (222, 214, 180, 255)
    cx, cy, rad = 96, 30, 16
    for y in range(cy - rad, cy + rad):
        for x in range(cx - rad, cx + rad):
            if (x - cx) ** 2 + (y - cy) ** 2 <= rad * rad:
                px(buf, W, x, y, moon)
    # ground
    rect(buf, W, 0, 104, W - 1, H - 1, (20, 26, 20, 255))
    # house body
    wall = (46, 34, 26, 255)
    dark = (30, 22, 18, 255)
    rect(buf, W, 30, 62, 92, 108, wall)
    # roof (triangle)
    for i in range(24):
        rect(buf, W, 30 + i, 62 - 1 - i, 92 - i, 62 - 1 - i, dark)
    # windows (glowing)
    glow = accent
    rect(buf, W, 40, 72, 48, 82, glow)
    rect(buf, W, 74, 72, 82, 82, glow)
    # window bars
    for y in range(72, 83):
        px(buf, W, 44, y, dark)
        px(buf, W, 78, y, dark)
    # door
    rect(buf, W, 56, 88, 66, 108, dark)
    rect(buf, W, 58, 90, 64, 106, (12, 8, 6, 255))
    # chimney
    rect(buf, W, 78, 44, 86, 62, dark)
    write_png(path, buf, W, H)


# ---------- Cursed key (16x16) ----------
def make_key(path):
    W = H = 16
    clear = (0, 0, 0, 0)
    buf = blank(W, H, clear)
    gold = (196, 150, 60, 255)
    glow = (170, 90, 220, 255)   # cursed purple glint
    dark = (90, 66, 24, 255)
    # bow (ring) of the key
    for y in range(2, 8):
        for x in range(3, 9):
            if (x - 5) ** 2 + (y - 5) ** 2 <= 9 and (x - 5) ** 2 + (y - 5) ** 2 >= 3:
                px(buf, W, x, y, gold)
    px(buf, W, 5, 4, glow)
    px(buf, W, 6, 5, glow)
    # shaft
    for y in range(7, 14):
        px(buf, W, 6, y, gold)
        px(buf, W, 7, y, dark)
    # teeth
    px(buf, W, 8, 11, gold)
    px(buf, W, 8, 13, gold)
    px(buf, W, 9, 13, gold)
    write_png(path, buf, W, H)


make_pack_icon(os.path.join(BASE, "behavior_pack", "pack_icon.png"), (150, 90, 210, 255))
make_pack_icon(os.path.join(BASE, "resource_pack", "pack_icon.png"), (120, 200, 150, 255))
make_key(os.path.join(BASE, "resource_pack", "textures", "items", "cursed_key.png"))
print("done")
