#!/usr/bin/env python3
"""Generate the SCP-096 addon textures (no third-party deps).

Outputs:
  addon/SCP096_RP/textures/entity/scp_096.png       64x64 entity skin
  addon/SCP096_RP/textures/items/scp_096_spawn_egg.png  16x16 spawn egg icon
"""

import os
import random
import struct
import zlib

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RP = os.path.join(ROOT, "addon", "SCP096_RP")


class Image:
    def __init__(self, w, h, fill=(0, 0, 0, 0)):
        self.w, self.h = w, h
        self.px = [list(fill) for _ in range(w * h)]

    def put(self, x, y, rgba):
        if 0 <= x < self.w and 0 <= y < self.h:
            self.px[y * self.w + x] = list(rgba)

    def get(self, x, y):
        return self.px[y * self.w + x]

    def rect(self, x, y, w, h, rgba):
        for j in range(y, y + h):
            for i in range(x, x + w):
                self.put(i, j, rgba)

    def save(self, path):
        raw = bytearray()
        for y in range(self.h):
            raw.append(0)  # filter type 0
            for x in range(self.w):
                raw.extend(self.px[y * self.w + x])

        def chunk(tag, data):
            out = struct.pack(">I", len(data)) + tag + data
            return out + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)

        png = b"\x89PNG\r\n\x1a\n"
        png += chunk(b"IHDR", struct.pack(">IIBBBBB", self.w, self.h, 8, 6, 0, 0, 0))
        png += chunk(b"IDAT", zlib.compress(bytes(raw), 9))
        png += chunk(b"IEND", b"")
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "wb") as fh:
            fh.write(png)
        print("wrote", os.path.relpath(path, ROOT))


def shade(base, amount):
    return tuple(max(0, min(255, int(c * amount))) for c in base[:3]) + (base[3],)


SKIN = (226, 214, 199, 255)
SKIN_DARK = (188, 174, 158, 255)
BLOOD = (122, 26, 26, 255)
MOUTH = (18, 8, 10, 255)
TEETH = (232, 226, 210, 255)


def entity_texture():
    rnd = random.Random(96)
    img = Image(64, 64, (0, 0, 0, 0))

    # Blanket the whole sheet in mottled, sickly pale skin so every face of
    # every cube lands on valid pixels.
    for y in range(64):
        for x in range(64):
            n = rnd.randint(-14, 10)
            img.put(x, y, (
                max(0, min(255, SKIN[0] + n)),
                max(0, min(255, SKIN[1] + n - 2)),
                max(0, min(255, SKIN[2] + n - 4)),
                255,
            ))

    # Rib / sinew shading down the torso front (body front face: 20,20 8x14).
    for j in range(14):
        for i in range(8):
            if j in (3, 5, 7) and 1 <= i <= 6:
                img.put(20 + i, 20 + j, shade(SKIN_DARK, 0.88))
    # Sunken sternum line
    for j in range(2, 12):
        img.put(24, 20 + j, shade(SKIN_DARK, 0.8))

    # Torso back: spine ridge (back face: 32,20 8x14).
    for j in range(14):
        img.put(36, 20 + j, shade(SKIN_DARK, 0.78))
        if j % 2 == 0:
            img.put(35, 20 + j, shade(SKIN_DARK, 0.86))
            img.put(37, 20 + j, shade(SKIN_DARK, 0.86))

    # --- Head front face lives at (8,8) -> 8x8 -------------------------------
    fx, fy = 8, 8
    # gaunt shading around the temples
    for j in range(8):
        img.put(fx, fy + j, shade(SKIN_DARK, 0.9))
        img.put(fx + 7, fy + j, shade(SKIN_DARK, 0.9))

    # Eyes: black sunken sockets
    for ex in (fx + 1, fx + 5):
        img.rect(ex, fy + 2, 2, 2, (12, 10, 12, 255))
        img.put(ex, fy + 1, shade(SKIN_DARK, 0.7))
        img.put(ex + 1, fy + 1, shade(SKIN_DARK, 0.7))
    # tear streaks
    img.put(fx + 1, fy + 4, shade(BLOOD, 0.9))
    img.put(fx + 6, fy + 4, shade(BLOOD, 0.9))

    # The scream: an oversized gaping mouth
    img.rect(fx + 1, fy + 5, 6, 3, MOUTH)
    img.rect(fx + 2, fy + 6, 4, 1, BLOOD)
    for i in range(fx + 1, fx + 7):
        if i % 2 == 0:
            img.put(i, fy + 5, TEETH)
            img.put(i, fy + 7, TEETH)

    # Blood smeared down the chin/neck onto the torso front
    img.put(fx + 3, fy + 7, BLOOD)
    img.put(24, 20, shade(BLOOD, 0.8))
    img.put(23, 21, shade(BLOOD, 0.7))

    # Long arms: bony highlight + grime near the hands.
    for (ax, ay) in ((40, 19), (32, 41)):
        for j in range(18):
            img.put(ax + 1, ay + j, shade(SKIN_DARK, 0.92))
        for j in range(15, 18):
            for i in range(3):
                img.put(ax + i, ay + j, shade(BLOOD, 0.55 + 0.1 * (j - 15)))

    # Legs: knee shading.
    for (lx, ly) in ((0, 23), (0, 43)):
        for i in range(3):
            img.put(lx + i, ly + 8, shade(SKIN_DARK, 0.86))
            img.put(lx + i, ly + 9, shade(SKIN_DARK, 0.92))

    img.save(os.path.join(RP, "textures", "entity", "scp_096.png"))


def spawn_egg_icon():
    img = Image(16, 16, (0, 0, 0, 0))
    # Classic spawn-egg silhouette
    spans = {
        2: (6, 4), 3: (5, 6), 4: (4, 8), 5: (3, 10), 6: (3, 10), 7: (2, 12),
        8: (2, 12), 9: (2, 12), 10: (2, 12), 11: (3, 10), 12: (3, 10),
        13: (4, 8), 14: (6, 4),
    }
    for y, (x0, w) in spans.items():
        for x in range(x0, x0 + w):
            edge = x == x0 or x == x0 + w - 1 or y in (2, 14)
            img.put(x, y, (198, 186, 172, 255) if edge else (232, 222, 208, 255))

    # Blood-red blotches (the "overlay colour" of the egg)
    blotches = [(6, 4), (9, 5), (4, 7), (7, 8), (11, 8), (5, 10), (9, 11), (7, 12)]
    for (x, y) in blotches:
        img.put(x, y, BLOOD)
        img.put(x + 1, y, shade(BLOOD, 1.25))

    # Highlight
    img.put(6, 3, (255, 252, 245, 255))
    img.put(5, 4, (250, 245, 236, 255))

    img.save(os.path.join(RP, "textures", "items", "scp_096_spawn_egg.png"))


def pack_icon():
    """128x128 icon: a pale screaming face on a dark containment-grey field."""
    rnd = random.Random(1996)
    img = Image(128, 128)
    for y in range(128):
        for x in range(128):
            n = rnd.randint(-6, 6)
            v = 26 + n + int(18 * (y / 128.0))
            img.put(x, y, (v, v, v + 2, 255))

    # Hazard stripes along the bottom
    for y in range(112, 128):
        for x in range(128):
            band = ((x + (127 - y)) // 10) % 2
            img.put(x, y, (196, 168, 32, 255) if band else (24, 24, 24, 255))

    # Face plate
    fx, fy, fw, fh = 30, 16, 68, 84
    for y in range(fy, fy + fh):
        for x in range(fx, fx + fw):
            edge = min(x - fx, fx + fw - 1 - x, y - fy, fy + fh - 1 - y)
            tone = 0.62 + 0.38 * min(1.0, edge / 12.0)
            n = rnd.randint(-8, 6)
            img.put(x, y, (
                max(0, min(255, int(SKIN[0] * tone) + n)),
                max(0, min(255, int(SKIN[1] * tone) + n)),
                max(0, min(255, int(SKIN[2] * tone) + n)),
                255,
            ))

    # Eyes
    for ex in (44, 74):
        img.rect(ex, 40, 12, 9, (10, 8, 10, 255))
        img.rect(ex + 2, 42, 8, 5, (4, 3, 4, 255))
        for j in range(9, 26):
            img.rect(ex + 4, 40 + j, 3, 1, shade(BLOOD, 0.6 + j * 0.012))

    # Screaming mouth
    img.rect(40, 66, 48, 26, MOUTH)
    img.rect(46, 72, 36, 14, shade(BLOOD, 0.85))
    for i in range(40, 88, 8):
        img.rect(i, 66, 4, 6, TEETH)
        img.rect(i + 4, 86, 4, 6, TEETH)

    for name in ("SCP096_BP", "SCP096_RP"):
        img.save(os.path.join(ROOT, "addon", name, "pack_icon.png"))


if __name__ == "__main__":
    entity_texture()
    spawn_egg_icon()
    pack_icon()
