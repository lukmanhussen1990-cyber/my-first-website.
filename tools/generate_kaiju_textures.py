#!/usr/bin/env python3
"""
Kaiju Rampage - texture generator.

Paints the three kaiju skins against the UV atlas written by
generate_kaiju_model.py, plus the item sprites, particle textures, UI icons and
both pack icons:

    python3 tools/generate_kaiju_model.py     # first, writes tools/kaiju_uv_map.json
    python3 tools/generate_kaiju_textures.py

Skins, by growth of anger:
    calm      charcoal hide, pale bone dorsal plates, amber eyes
    charging  the plates and mouth glow atomic blue
    enraged   scorched hide split by molten cracks, white hot plates
"""

import json
import math
import os
import random

from generate_textures import Image, noise

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TOOLS = os.path.dirname(os.path.abspath(__file__))
RP = os.path.join(ROOT, "kaiju_RP")
BP = os.path.join(ROOT, "kaiju_BP")

random.seed(31964)

SKINS = {
    "calm": {
        "hide": (52, 56, 58),
        "hide_dark": (30, 33, 36),
        "belly": (96, 94, 86),
        "spine": (206, 214, 226),
        "spine_glow": (150, 170, 200),
        "claw": (228, 222, 200),
        "eye": (255, 176, 40),
        "crack": (58, 62, 66),
    },
    "charging": {
        "hide": (48, 56, 64),
        "hide_dark": (26, 32, 40),
        "belly": (92, 98, 100),
        "spine": (150, 240, 255),
        "spine_glow": (90, 220, 255),
        "claw": (228, 236, 240),
        "eye": (140, 250, 255),
        "crack": (60, 190, 230),
    },
    "enraged": {
        "hide": (40, 32, 30),
        "hide_dark": (20, 15, 14),
        "belly": (86, 66, 56),
        "spine": (255, 236, 200),
        "spine_glow": (255, 150, 40),
        "claw": (240, 226, 196),
        "eye": (255, 70, 20),
        "crack": (255, 120, 20),
    },
}


def load_map():
    with open(os.path.join(TOOLS, "kaiju_uv_map.json")) as fh:
        return json.load(fh)


def paint_hide(img, x0, y0, x1, y1, skin, dark=False):
    """Overlapping reptile scales with a few molten cracks."""
    base = skin["hide_dark"] if dark else skin["hide"]
    for y in range(y0, y1):
        for x in range(x0, x1):
            # Two offset sine waves give a scale-like quilt.
            scale_row = math.sin(y * 0.9) * 0.5 + 0.5
            scale_col = math.sin((x + (y % 2) * 2) * 0.8) * 0.5 + 0.5
            shade = 0.78 + scale_row * 0.22 + scale_col * 0.18
            img.set(x, y, noise((base[0] * shade, base[1] * shade, base[2] * shade, 255), 2))
    # Scale edges.
    for y in range(y0, y1, 3):
        for x in range(x0, x1):
            if (x + y) % 5 == 0:
                img.set(x, y, noise(skin["hide_dark"] + (255,), 3))
    # Glowing fissures in the hide.
    area = (x1 - x0) * (y1 - y0)
    for _ in range(max(1, area // 900)):
        cx = random.randint(x0, max(x0, x1 - 1))
        cy = random.randint(y0, max(y0, y1 - 1))
        for i in range(random.randint(4, 10)):
            px = cx + i
            py = cy + int(math.sin(i * 0.8) * 2)
            if x0 <= px < x1 and y0 <= py < y1:
                img.set(px, py, skin["crack"] + (255,))


def paint_belly(img, x0, y0, x1, y1, skin):
    """Horizontal armour plates, like a crocodile's underside."""
    for y in range(y0, y1):
        band = (y - y0) % 6
        shade = 1.05 if band < 3 else 0.85
        base = skin["belly"]
        for x in range(x0, x1):
            img.set(x, y, noise((base[0] * shade, base[1] * shade, base[2] * shade, 255), 2))
        if band == 0:
            for x in range(x0, x1):
                img.set(x, y, noise((base[0] * 0.6, base[1] * 0.6, base[2] * 0.6, 255), 6))


def paint_spine(img, x0, y0, x1, y1, skin):
    """Maple-leaf dorsal plates: bright core, darker rim, glowing veins."""
    cx = (x0 + x1) / 2
    for y in range(y0, y1):
        for x in range(x0, x1):
            edge = min(x - x0, x1 - 1 - x, y - y0, y1 - 1 - y)
            t = min(1.0, edge / 3.0)
            base = skin["spine_glow"] if t < 0.5 else skin["spine"]
            shade = 0.7 + t * 0.5
            img.set(x, y, noise((base[0] * shade, base[1] * shade, base[2] * shade, 255), 2))
    for y in range(y0, y1, 2):
        px = int(cx)
        if x0 <= px < x1:
            img.set(px, y, skin["spine_glow"] + (255,))


def paint_claw(img, x0, y0, x1, y1, skin):
    for y in range(y0, y1):
        for x in range(x0, x1):
            shade = 0.85 + math.sin(x * 1.3 + y * 0.5) * 0.15
            base = skin["claw"]
            img.set(x, y, noise((base[0] * shade, base[1] * shade, base[2] * shade, 255), 2))
        if (y - y0) % 4 == 0:
            for x in range(x0, x1, 3):
                img.set(x, y, noise(skin["hide_dark"] + (255,), 3))


def paint_eye(img, x0, y0, x1, y1, skin):
    for y in range(y0, y1):
        for x in range(x0, x1):
            img.set(x, y, skin["eye"] + (255,))
    # Vertical slit pupil down the middle of every face.
    for x in range((x0 + x1) // 2 - 1, (x0 + x1) // 2 + 1):
        for y in range(y0, y1):
            img.set(x, y, (14, 6, 2, 255))


PAINTERS = {
    "hide": paint_hide,
    "belly": paint_belly,
    "spine": paint_spine,
    "claw": paint_claw,
    "eye": paint_eye,
}


def quantize(img, step=8):
    """Rounds every channel to a step. Flat colours compress far better, which
    keeps a 512x512 skin at tens of kilobytes instead of hundreds."""
    for y in range(img.h):
        row = img.px[y]
        for x in range(img.w):
            r, g, b, a = row[x]
            row[x] = (
                min(255, (r // step) * step),
                min(255, (g // step) * step),
                min(255, (b // step) * step),
                a,
            )


def skin_texture(name, uv_map):
    skin = SKINS[name]
    size = uv_map["atlas"]
    img = Image(size, size)
    # Fill the unused atlas space with dark hide so seams never show white.
    paint_hide(img, 0, 0, size, size, skin, dark=True)

    for region in uv_map["regions"]:
        x0, y0 = region["uv"]
        w, h = region["size"]
        painter = PAINTERS[region["surface"]]
        painter(img, x0, y0, min(size, x0 + w), min(size, y0 + h), skin)

    quantize(img, 16)
    img.save(os.path.join(RP, f"textures/entity/kaiju/kaiju_{name}.png"))


# ---------------------------------------------------------------- items ----


def item_kaiju_horn():
    img = Image(16, 16)
    # A curved horn wrapped in iron bands.
    body = [(3, 13), (4, 12), (5, 11), (6, 10), (7, 9), (8, 8), (9, 6), (10, 5), (11, 4)]
    for i, (x, y) in enumerate(body):
        width = 3 - i // 4
        for w in range(width):
            img.set(x + w, y, (74, 62, 52, 255))
            img.set(x + w, y + 1, (110, 94, 76, 255))
    img.set(11, 3, (206, 196, 176, 255))
    img.set(12, 3, (206, 196, 176, 255))
    img.set(12, 4, (168, 158, 140, 255))
    # Iron bands and a glowing mouthpiece.
    for x, y in ((5, 11), (7, 9)):
        img.set(x, y, (176, 180, 188, 255))
        img.set(x + 1, y + 1, (140, 146, 154, 255))
    img.disc(3.5, 13.5, 2.2, (48, 40, 34, 255))
    img.disc(3.5, 13.5, 1.2, (255, 150, 40, 255))
    img.set(2, 12, (255, 210, 120, 220))
    img.save(os.path.join(RP, "textures/items/kj_kaiju_horn.png"))


def item_kaiju_scale():
    img = Image(16, 16)
    points = [(8, 1), (13, 6), (11, 14), (5, 14), (3, 6)]
    for y in range(1, 15):
        half = 5 - abs(8 - y) // 3
        for x in range(8 - half, 8 + half):
            shade = 0.8 + math.sin(x * 0.9 + y * 0.6) * 0.2
            img.set(x, y, noise((52 * shade, 58 * shade, 62 * shade, 255), 2))
    for px, py in points:
        img.set(px, py, (30, 34, 38, 255))
    for i in range(3, 13):
        img.set(8, i, (150, 170, 200, 255))
    img.set(6, 5, (206, 214, 226, 200))
    img.save(os.path.join(RP, "textures/items/kj_kaiju_scale.png"))


def item_atomic_core():
    img = Image(16, 16)
    img.disc(8, 8, 7.0, (18, 26, 32, 255))
    img.disc(8, 8, 5.6, (30, 120, 150, 255))
    img.disc(8, 8, 4.0, (90, 220, 255, 255))
    img.disc(8, 8, 2.2, (235, 253, 255, 255))
    # Containment ring.
    for i in range(20):
        angle = i / 20 * math.pi * 2
        img.set(8 + math.cos(angle) * 6.6, 8 + math.sin(angle) * 6.6, (176, 184, 196, 255))
    for angle in (0.6, 2.7, 4.4):
        img.line(8 + math.cos(angle) * 3, 8 + math.sin(angle) * 3,
                 8 + math.cos(angle) * 7, 8 + math.sin(angle) * 7, (220, 240, 255, 220), 1)
    img.save(os.path.join(RP, "textures/items/kj_atomic_core.png"))


def particles():
    out = os.path.join(RP, "textures/particle")

    charge = Image(16, 16)
    charge.disc(7.5, 7.5, 7.0, (255, 255, 255, 160), soft=True)
    charge.disc(7.5, 7.5, 3.0, (255, 255, 255, 255), soft=True)
    charge.save(os.path.join(out, "kj_charge.png"))

    beam = Image(16, 16)
    for y in range(16):
        for x in range(16):
            d = abs(x - 7.5) / 7.5
            beam.set(x, y, (255, 255, 255, int(max(0, 255 * (1 - d * d)))))
    beam.save(os.path.join(out, "kj_beam.png"))

    dust = Image(16, 16)
    dust.disc(7.5, 7.5, 7.2, (255, 255, 255, 210), soft=True)
    for _ in range(28):
        x, y = random.randint(2, 13), random.randint(2, 13)
        r, g, b, a = dust.get(x, y)
        dust.set(x, y, (r, g, b, max(0, a - random.randint(40, 120))))
    dust.save(os.path.join(out, "kj_dust.png"))

    rubble = Image(16, 16)
    for y in range(4, 13):
        for x in range(3, 13):
            if random.random() < 0.8:
                rubble.set(x, y, noise((255, 255, 255, 255), 30))
    rubble.save(os.path.join(out, "kj_rubble.png"))

    wave = Image(16, 16)
    for i in range(28):
        angle = i / 28 * math.pi * 2
        wave.set(8 + math.cos(angle) * 7, 8 + math.sin(angle) * 7, (255, 255, 255, 255))
        wave.set(8 + math.cos(angle) * 6, 8 + math.sin(angle) * 6, (255, 255, 255, 150))
    wave.save(os.path.join(out, "kj_wave.png"))

    smoke = Image(16, 16)
    smoke.disc(7.5, 8.0, 6.5, (255, 255, 255, 170), soft=True)
    smoke.disc(5.0, 5.5, 3.0, (255, 255, 255, 140), soft=True)
    smoke.save(os.path.join(out, "kj_smoke.png"))


def kaiju_glyph(img, cx, cy, scale, skin):
    """A small kaiju silhouette for the UI icons."""
    hide = skin["hide"] + (255,)
    spine = skin["spine"] + (255,)
    img.disc(cx, cy, 5.0 * scale, hide)                     # body
    img.disc(cx, cy - 7.5 * scale, 3.2 * scale, hide)       # head
    img.line(cx, cy + 4 * scale, cx + 9 * scale, cy + 9 * scale, hide, 2)   # tail
    for side in (-1, 1):
        img.line(cx + side * 3 * scale, cy + 4 * scale, cx + side * 4 * scale, cy + 10 * scale, hide, 2)
    for i in range(4):
        img.set(cx - 1, cy - 4 * scale + i * 2.5 * scale, spine)
        img.set(cx, cy - 4 * scale + i * 2.5 * scale, spine)
    img.set(cx - 1.5 * scale, cy - 8 * scale, skin["eye"] + (255,))
    img.set(cx + 1.5 * scale, cy - 8 * scale, skin["eye"] + (255,))


def ui_icons():
    out = os.path.join(RP, "textures/ui")

    def frame(img, tint):
        img.rect(0, 0, 32, 32, (18, 18, 20, 255))
        img.rect(1, 1, 31, 31, (44, 44, 48, 255))
        img.rect(2, 2, 30, 30, tint)

    summon = Image(32, 32)
    frame(summon, (48, 22, 20, 255))
    kaiju_glyph(summon, 16, 17, 1.0, SKINS["enraged"])
    summon.save(os.path.join(out, "kj_icon_summon.png"))

    banish = Image(32, 32)
    frame(banish, (46, 40, 20, 255))
    kaiju_glyph(banish, 16, 18, 0.85, SKINS["calm"])
    banish.line(5, 5, 27, 27, (255, 208, 64, 255), 2)
    banish.line(27, 5, 5, 27, (255, 208, 64, 255), 2)
    banish.save(os.path.join(out, "kj_icon_banish.png"))

    gear = Image(32, 32)
    frame(gear, (38, 42, 48, 255))
    gear.disc(16, 16, 11.0, (176, 184, 196, 255))
    for i in range(8):
        angle = i * math.pi / 4
        gear.disc(16 + math.cos(angle) * 11.5, 16 + math.sin(angle) * 11.5, 2.6, (176, 184, 196, 255))
    gear.disc(16, 16, 5.0, (38, 42, 48, 255))
    gear.save(os.path.join(out, "kj_icon_settings.png"))


def pack_icons():
    img = Image(128, 128)
    # Burning city skyline at night.
    for y in range(128):
        for x in range(128):
            t = y / 127.0
            img.set(x, y, (14 + 40 * t, 12 + 22 * t, 24 + 20 * t, 255))
    for _ in range(70):
        x = random.randint(0, 127)
        y = random.randint(0, 60)
        img.blend(x, y, (255, 220, 160, random.randint(20, 60)))

    skyline = [(4, 96), (18, 78), (30, 88), (44, 66), (58, 84), (72, 72), (88, 90), (104, 74), (120, 92)]
    for i in range(len(skyline) - 1):
        x0, top = skyline[i]
        x1 = skyline[i + 1][0]
        for x in range(x0, x1):
            for y in range(top, 128):
                img.set(x, y, noise((28, 26, 34, 255), 6))
        for wy in range(top + 4, 124, 6):
            for wx in range(x0 + 2, x1 - 2, 5):
                if random.random() < 0.55:
                    img.set(wx, wy, (255, 190, 90, 255))

    # Fire along the ground.
    for x in range(128):
        height = random.randint(2, 9)
        for y in range(128 - height, 128):
            img.set(x, y, (255, random.randint(90, 190), 30, 255))

    # The kaiju, towering over it.
    skin = SKINS["enraged"]
    hide = skin["hide"] + (255,)
    img.disc(64, 74, 22, hide)
    img.disc(64, 44, 14, hide)
    img.line(64, 92, 104, 116, hide, 7)
    for side in (-1, 1):
        img.line(64 + side * 14, 90, 64 + side * 20, 122, hide, 6)
        img.line(64 + side * 18, 62, 64 + side * 30, 78, hide, 4)
    for i in range(6):
        y = 42 + i * 9
        img.disc(64, y, 5 - i * 0.4, skin["spine"] + (255,))
        img.disc(64, y, 7 - i * 0.4, skin["spine_glow"] + (60,), soft=True)
    for cx in (58, 70):
        img.disc(cx, 40, 2.6, skin["eye"] + (255,))
        img.disc(cx, 40, 5.0, skin["eye"] + (60,), soft=True)
    # Atomic breath pouring out of the mouth.
    for i in range(30):
        x = 64 - i * 2
        img.line(x, 50 + i * 0.4, x - 2, 52 + i * 0.4, (150, 240, 255, max(0, 255 - i * 7)), 3)

    img.save(os.path.join(RP, "pack_icon.png"))
    img.save(os.path.join(BP, "pack_icon.png"))


def main():
    uv_map = load_map()
    for name in SKINS:
        skin_texture(name, uv_map)
        print("wrote kaiju_RP/textures/entity/kaiju/kaiju_%s.png" % name)
    item_kaiju_horn()
    item_kaiju_scale()
    item_atomic_core()
    particles()
    ui_icons()
    pack_icons()
    print("done")


if __name__ == "__main__":
    main()
