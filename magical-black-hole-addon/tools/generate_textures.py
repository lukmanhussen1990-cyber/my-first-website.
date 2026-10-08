#!/usr/bin/env python3
"""Generates every PNG used by the Magical Black Hole add-on.

Run from anywhere:  python3 tools/generate_textures.py
Requires Pillow.  Output is deterministic (fixed random seed).
"""
import math
import os
import random

from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BP = os.path.join(ROOT, "packs", "MagicalBlackHole_BP")
RP = os.path.join(ROOT, "packs", "MagicalBlackHole_RP")


def lerp(a, b, t):
    return a + (b - a) * t


def lerp_rgb(c1, c2, t):
    t = max(0.0, min(1.0, t))
    return tuple(int(round(lerp(c1[i], c2[i], t))) for i in range(3))


def gradient(stops, t):
    """stops: list of (position 0..1, (r,g,b))"""
    t = max(0.0, min(1.0, t))
    for i in range(len(stops) - 1):
        p1, c1 = stops[i]
        p2, c2 = stops[i + 1]
        if t <= p2:
            return lerp_rgb(c1, c2, (t - p1) / (p2 - p1) if p2 > p1 else 0)
    return stops[-1][1]


def save(img, *parts):
    path = os.path.join(*parts)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    img.save(path, optimize=True)
    print("wrote", os.path.relpath(path, ROOT), img.size)


# ---------------------------------------------------------------- item icon
def item_icon():
    """16x16 pixel-art icon: black core, bright photon ring, swirling disk."""
    size = 16
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    px = img.load()
    c = 7.5
    disk = [
        (0.0, (255, 244, 214)),
        (0.25, (255, 176, 64)),
        (0.55, (225, 60, 160)),
        (1.0, (110, 30, 190)),
    ]
    for y in range(size):
        for x in range(size):
            dx, dy = x - c, y - c
            r = math.hypot(dx, dy)
            a = math.atan2(dy, dx)
            if r < 3.1:
                px[x, y] = (4, 0, 10, 255)
            elif r < 4.0:
                # photon ring, brighter on the side spinning towards us
                beam = 0.5 + 0.5 * math.cos(a + 0.8)
                px[x, y] = lerp_rgb((200, 120, 255), (255, 246, 255), beam) + (255,)
            elif r < 7.4:
                t = (r - 4.0) / 3.4
                arm = math.sin(2 * a + r * 1.5)
                if arm > -0.45 or r < 5.0:
                    col = gradient(disk, t)
                    if arm < 0.25:
                        col = lerp_rgb(col, (40, 8, 70), 0.6)
                    px[x, y] = col + (255,)
    # dark outline so the icon reads well on any slot background
    out = img.copy()
    opx = out.load()
    for y in range(size):
        for x in range(size):
            if px[x, y][3] == 0:
                for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                    if 0 <= nx < size and 0 <= ny < size and px[nx, ny][3] == 255:
                        opx[x, y] = (24, 0, 40, 255)
                        break
    # little magic sparkles
    for sx, sy in ((1, 2), (14, 1), (14, 13), (1, 14)):
        if opx[sx, sy][3] == 0:
            opx[sx, sy] = (255, 236, 255, 255)
    save(out, RP, "textures", "items", "magic_black_hole.png")


# ------------------------------------------------------------ entity texture
def entity_texture():
    """128x128 atlas.
    (0,0)-(64,64)   accretion disk (cutout ring)
    (64,0)-(128,64) magic rune ring (cutout ring)
    (0,64)-(16,80)  black core
    """
    rnd = random.Random(7)
    img = Image.new("RGBA", (128, 128), (0, 0, 0, 0))
    px = img.load()

    disk = [
        (0.0, (255, 250, 235)),
        (0.15, (255, 214, 120)),
        (0.4, (255, 140, 40)),
        (0.65, (235, 60, 120)),
        (1.0, (130, 40, 210)),
    ]
    c = 31.5
    for y in range(64):
        for x in range(64):
            dx, dy = x - c, y - c
            r = math.hypot(dx, dy)
            a = math.atan2(dy, dx)
            if 9.0 <= r <= 31.5:
                t = (r - 9.0) / 22.5
                streak = math.sin(3 * a + r * 0.55) + 0.35 * math.sin(11 * a - r * 0.9)
                keep = t < 0.45 or streak > -0.55 + t * 0.9
                if keep:
                    col = gradient(disk, t)
                    shade = 0.82 + 0.18 * math.sin(5 * a + r * 0.8)
                    col = tuple(min(255, int(ch * shade)) for ch in col)
                    px[x, y] = col + (255,)

    rune = [(0.0, (120, 245, 255)), (1.0, (190, 110, 255))]
    c2x, c2y = 64 + 31.5, 31.5
    for y in range(64):
        for x in range(64, 128):
            dx, dy = x - c2x, y - c2y
            r = math.hypot(dx, dy)
            a = math.degrees(math.atan2(dy, dx)) % 360
            if 24.0 <= r <= 26.0:
                px[x, y] = rune[0][1] + (255,)
            elif 29.0 <= r <= 31.0 and (a % 30) < 22:
                px[x, y] = rune[1][1] + (255,)
            elif 26.5 <= r <= 28.5 and (a % 15) < 3:
                px[x, y] = lerp_rgb(rune[0][1], rune[1][1], 0.5) + (255,)

    for y in range(64, 80):
        for x in range(0, 16):
            v = rnd.random()
            px[x, y] = (10, 0, 22, 255) if v < 0.12 else (2, 0, 6, 255)

    save(img, RP, "textures", "entity", "black_hole.png")


# ------------------------------------------------------------ particle atlas
def particle_texture():
    """32x16: (0,0) soft glow, (16,0) four point sparkle. White, tinted in JSON."""
    img = Image.new("RGBA", (32, 16), (0, 0, 0, 0))
    px = img.load()
    for y in range(16):
        for x in range(16):
            r = math.hypot(x - 7.5, y - 7.5) / 7.5
            if r < 1:
                px[x, y] = (255, 255, 255, int(255 * (1 - r) ** 1.6))
    for y in range(16):
        for x in range(16):
            dx, dy = abs(x - 7.5), abs(y - 7.5)
            vert = max(0.0, 1 - dy / 8.0) * max(0.0, 1 - dx / 1.6)
            horiz = max(0.0, 1 - dx / 8.0) * max(0.0, 1 - dy / 1.6)
            core = max(0.0, 1 - math.hypot(dx, dy) / 3.0)
            a = min(1.0, vert + horiz + core)
            if a > 0.02:
                px[16 + x, y] = (255, 255, 255, int(255 * a))
    save(img, RP, "textures", "particle", "black_hole_particles.png")


# ---------------------------------------------------------------- pack icon
def pack_icon():
    S = 4  # supersample
    W = 256 * S
    rnd = random.Random(42)
    bg = Image.new("RGB", (W, W))
    d = ImageDraw.Draw(bg)
    for y in range(W):
        t = y / W
        d.line([(0, y), (W, y)], fill=lerp_rgb((18, 6, 40), (4, 2, 14), t))
    for _ in range(170):
        x, y = rnd.randrange(W), rnd.randrange(W)
        rad = rnd.choice((1, 1, 2, 2, 3)) * S // 2 + 1
        b = rnd.randint(150, 255)
        d.ellipse([x - rad, y - rad, x + rad, y + rad], fill=(b, b, min(255, b + 30)))

    cx = cy = W // 2
    glow = Image.new("RGB", (W, W), (0, 0, 0))
    gd = ImageDraw.Draw(glow)
    # back half of the lensed ring (above the hole)
    for i in range(40, 0, -1):
        t = i / 40
        col = gradient([(0, (255, 245, 220)), (0.4, (255, 150, 50)), (1, (150, 40, 200))], t)
        rx, ry = (70 + 40 * t) * S, (70 + 40 * t) * S
        gd.ellipse([cx - rx, cy - ry, cx + rx, cy + ry], outline=col, width=3 * S)
    glow = glow.filter(ImageFilter.GaussianBlur(3 * S))
    img = Image.composite(glow, bg, glow.convert("L").point(lambda v: min(255, v * 2)))

    # accretion disk (flattened ellipse) drawn as additive glow
    disk = Image.new("RGB", (W, W), (0, 0, 0))
    dd = ImageDraw.Draw(disk)
    for i in range(60, 0, -1):
        t = i / 60
        col = gradient([(0, (255, 250, 230)), (0.3, (255, 170, 60)), (0.7, (230, 60, 140)), (1, (90, 30, 170))], t)
        rx, ry = (64 + 60 * t) * S, (14 + 16 * t) * S
        dd.ellipse([cx - rx, cy - ry, cx + rx, cy + ry], outline=col, width=3 * S)
    disk = disk.filter(ImageFilter.GaussianBlur(2 * S))
    img = Image.composite(disk, img, disk.convert("L").point(lambda v: min(255, v * 2)))

    # black core + photon ring
    d = ImageDraw.Draw(img)
    pr = 60 * S
    d.ellipse([cx - pr, cy - pr, cx + pr, cy + pr], outline=(255, 236, 255), width=3 * S)
    core = 56 * S
    d.ellipse([cx - core, cy - core, cx + core, cy + core], fill=(0, 0, 0))

    # front sliver of the disk passes in front of the core
    front = Image.new("L", (W, W), 0)
    fd = ImageDraw.Draw(front)
    fd.rectangle([0, cy, W, W], fill=255)
    disk_front = Image.new("RGB", (W, W), (0, 0, 0))
    dfd = ImageDraw.Draw(disk_front)
    for i in range(30, 0, -1):
        t = i / 30
        col = gradient([(0, (255, 250, 230)), (0.5, (255, 160, 60)), (1, (220, 70, 150))], t)
        rx, ry = (62 + 22 * t) * S, (8 + 7 * t) * S
        dfd.ellipse([cx - rx, cy - ry, cx + rx, cy + ry], outline=col, width=3 * S)
    disk_front = disk_front.filter(ImageFilter.GaussianBlur(1.5 * S))
    mask = Image.composite(disk_front.convert("L").point(lambda v: min(255, v * 2)), Image.new("L", (W, W), 0), front)
    img = Image.composite(disk_front, img, mask)

    # magic sparkles
    d = ImageDraw.Draw(img)
    for sx, sy, s in ((44, 52, 10), (210, 40, 8), (200, 205, 12), (52, 200, 7)):
        sx, sy, s = sx * S, sy * S, s * S
        d.polygon([(sx, sy - s), (sx + s // 4, sy), (sx, sy + s), (sx - s // 4, sy)], fill=(240, 210, 255))
        d.polygon([(sx - s, sy), (sx, sy - s // 4), (sx + s, sy), (sx, sy + s // 4)], fill=(240, 210, 255))

    icon = img.resize((256, 256), Image.LANCZOS)
    save(icon, BP, "pack_icon.png")
    save(icon, RP, "pack_icon.png")


if __name__ == "__main__":
    item_icon()
    entity_texture()
    particle_texture()
    pack_icon()
