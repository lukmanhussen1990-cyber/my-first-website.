#!/usr/bin/env python3
"""
Imran Security House - texture generator.

Writes the two zombie skins (standard 64x64 humanoid layout), the item sprites,
particle textures, UI icons and both pack icons:

    python3 tools/generate_imran_textures.py
"""

import math
import os
import random

from generate_textures import Image, noise

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RP = os.path.join(ROOT, "imran_RP")
BP = os.path.join(ROOT, "imran_BP")

random.seed(77345)

# Regions of the vanilla humanoid skin layout that the model uses.
SKIN_PARTS = {
    "head": (0, 0, 32, 16),
    "hat": (32, 0, 32, 16),
    "torso": (16, 16, 24, 16),
    "right_arm": (40, 16, 16, 16),
    "left_arm": (32, 48, 16, 16),
    "right_leg": (0, 16, 16, 16),
    "left_leg": (16, 48, 16, 16),
}

SKINS = {
    "violent": {
        "file": "violent_zombie",
        "flesh": (96, 122, 74),
        "flesh_dark": (62, 82, 48),
        "cloth": (58, 66, 84),
        "cloth_dark": (38, 44, 58),
        "blood": (128, 24, 24),
        "eye": (255, 40, 20),
        "bone": (226, 220, 198),
    },
    "bomber": {
        "file": "bomber_zombie",
        "flesh": (118, 96, 60),
        "flesh_dark": (76, 58, 34),
        "cloth": (86, 40, 30),
        "cloth_dark": (52, 22, 16),
        "blood": (196, 60, 20),
        "eye": (255, 190, 40),
        "bone": (236, 226, 200),
    },
}


def rotten(img, x0, y0, x1, y1, skin, cloth=False):
    """Blotchy dead flesh, or torn clothing over it."""
    base = skin["cloth"] if cloth else skin["flesh"]
    dark = skin["cloth_dark"] if cloth else skin["flesh_dark"]
    for y in range(y0, y1):
        for x in range(x0, x1):
            blotch = math.sin(x * 0.8 + y * 0.5) * math.cos(x * 0.3 - y * 0.7)
            shade = 0.86 + blotch * 0.22
            img.set(x, y, noise((base[0] * shade, base[1] * shade, base[2] * shade, 255), 5))
    # Rot patches.
    area = (x1 - x0) * (y1 - y0)
    for _ in range(max(2, area // 40)):
        cx = random.randint(x0, max(x0, x1 - 1))
        cy = random.randint(y0, max(y0, y1 - 1))
        for i in range(random.randint(2, 5)):
            px, py = cx + random.randint(-1, 1), cy + i
            if x0 <= px < x1 and y0 <= py < y1:
                img.set(px, py, noise(dark + (255,), 6))
    # Blood running down.
    for _ in range(max(1, area // 90)):
        cx = random.randint(x0, max(x0, x1 - 1))
        cy = random.randint(y0, max(y0, y1 - 1))
        for i in range(random.randint(2, 6)):
            py = cy + i
            if x0 <= cx < x1 and y0 <= py < y1:
                img.set(cx, py, skin["blood"] + (255,))


def zombie_skin(name):
    skin = SKINS[name]
    img = Image(64, 64)

    # Head, then a face on the front panel of the box UV net.
    hx, hy, hw, hh = SKIN_PARTS["head"]
    rotten(img, hx, hy, hx + hw, hy + hh, skin)
    face_x, face_y = hx + 8, hy + 8
    for ey in (face_y + 2, face_y + 3):
        for ex in (face_x + 1, face_x + 2, face_x + 5, face_x + 6):
            img.set(ex, ey, skin["eye"] + (255,))
    for ex in (face_x + 1, face_x + 6):
        img.set(ex, face_y + 2, (255, 255, 220, 255))
    for ex in range(face_x + 2, face_x + 6):
        img.set(ex, face_y + 5, (28, 14, 14, 255))
        img.set(ex, face_y + 6, skin["blood"] + (255,))
    for ex in range(face_x + 2, face_x + 6, 2):
        img.set(ex, face_y + 5, skin["bone"] + (255,))

    # Hat layer: matted strands only, mostly clear.
    ox, oy, ow, oh = SKIN_PARTS["hat"]
    for y in range(oy, oy + oh):
        for x in range(ox, ox + ow):
            if random.random() < 0.16:
                img.set(x, y, noise(skin["flesh_dark"] + (255,), 8))

    # Torso: torn shirt with ribs showing through.
    tx, ty, tw, th = SKIN_PARTS["torso"]
    rotten(img, tx, ty, tx + tw, ty + th, skin, cloth=True)
    for rib in range(3):
        y = ty + 6 + rib * 2
        for x in range(tx + 10, tx + 16):
            img.set(x, y, skin["bone"] + (255,))

    for part in ("right_arm", "left_arm"):
        px, py, pw, ph = SKIN_PARTS[part]
        rotten(img, px, py, px + pw, py + ph, skin)
    for part in ("right_leg", "left_leg"):
        px, py, pw, ph = SKIN_PARTS[part]
        rotten(img, px, py, px + pw, py + ph, skin, cloth=True)

    img.save(os.path.join(RP, f"textures/entity/imran/{skin['file']}.png"))
    print(f"wrote imran_RP/textures/entity/imran/{skin['file']}.png")


# ---------------------------------------------------------------- items ----


def item_house_deployer():
    img = Image(16, 16)
    # A blueprint of the house on a slab of iron.
    img.rect(1, 1, 15, 15, (72, 78, 86, 255))
    img.rect(2, 2, 14, 14, (150, 158, 170, 255))
    img.rect(3, 3, 13, 13, (52, 74, 108, 255))
    for i in range(6):
        img.set(8 - i, 7 - i + 3, (232, 240, 255, 255))
        img.set(8 + i, 7 - i + 3, (232, 240, 255, 255))
    img.rect(5, 8, 12, 13, (232, 240, 255, 255))
    img.rect(6, 9, 11, 13, (52, 74, 108, 255))
    img.rect(8, 10, 10, 13, (255, 200, 80, 255))
    img.set(4, 4, (255, 214, 92, 255))
    img.save(os.path.join(RP, "textures/items/ih_house_deployer.png"))


def item_horde_totem():
    img = Image(16, 16)
    # A rotten skull on a stick.
    img.line(8, 15, 8, 9, (96, 70, 44, 255))
    img.line(9, 15, 9, 9, (72, 52, 32, 255))
    img.disc(8, 6, 4.4, (206, 200, 178, 255))
    img.rect(6, 8, 11, 11, (206, 200, 178, 255))
    for ex in (6, 9):
        img.rect(ex, 5, ex + 2, 7, (24, 18, 14, 255))
        img.set(ex, 5, (196, 40, 24, 255))
    for ex in range(6, 11, 2):
        img.set(ex, 10, (40, 30, 24, 255))
    img.set(5, 9, (96, 122, 74, 255))
    img.set(11, 8, (96, 122, 74, 255))
    img.set(12, 10, (96, 122, 74, 180))
    img.save(os.path.join(RP, "textures/items/ih_horde_totem.png"))


def particles():
    out = os.path.join(RP, "textures/particle")

    rot = Image(16, 16)
    for y in range(4, 13):
        for x in range(4, 13):
            if random.random() < 0.8:
                rot.set(x, y, noise((255, 255, 255, 255), 28))
    rot.save(os.path.join(out, "ih_rot.png"))

    spark = Image(16, 16)
    spark.line(7, 1, 7, 14, (255, 255, 255, 255), 1)
    spark.line(2, 7, 13, 7, (255, 255, 255, 220), 1)
    spark.disc(7.5, 7.5, 2.6, (255, 255, 255, 255), soft=True)
    spark.save(os.path.join(out, "ih_spark.png"))


def ui_icons():
    out = os.path.join(RP, "textures/ui")

    def frame(img, tint):
        img.rect(0, 0, 32, 32, (20, 20, 22, 255))
        img.rect(1, 1, 31, 31, (46, 46, 50, 255))
        img.rect(2, 2, 30, 30, tint)

    house = Image(32, 32)
    frame(house, (44, 52, 66, 255))
    for i in range(12):
        house.line(16 - i, 20 - i, 16 + i, 20 - i, (168, 60, 48, 255), 1)
    house.rect(6, 14, 26, 27, (150, 158, 170, 255))
    house.rect(8, 16, 24, 25, (96, 104, 116, 255))
    house.rect(14, 19, 18, 27, (70, 74, 82, 255))
    house.rect(9, 17, 12, 20, (255, 208, 96, 255))
    house.rect(20, 17, 23, 20, (255, 208, 96, 255))
    for x in range(7, 26, 2):
        house.set(x, 12, (255, 206, 60, 255))
    house.save(os.path.join(out, "ih_icon_house.png"))

    remove = Image(32, 32)
    frame(remove, (52, 46, 44, 255))
    remove.rect(6, 16, 26, 27, (120, 120, 128, 255))
    remove.line(5, 5, 27, 27, (230, 90, 70, 255), 2)
    remove.line(27, 5, 5, 27, (230, 90, 70, 255), 2)
    remove.save(os.path.join(out, "ih_icon_remove.png"))

    horde = Image(32, 32)
    frame(horde, (36, 46, 30, 255))
    for cx, cy, s in ((10, 18, 1.0), (20, 16, 1.1), (15, 23, 0.9), (25, 22, 0.8)):
        horde.disc(cx, cy, 3.4 * s, (96, 122, 74, 255))
        horde.set(cx - 1, cy - 1, (255, 40, 20, 255))
        horde.set(cx + 1, cy - 1, (255, 40, 20, 255))
    horde.save(os.path.join(out, "ih_icon_horde.png"))

    stop = Image(32, 32)
    frame(stop, (30, 52, 36, 255))
    stop.disc(16, 16, 11.0, (70, 170, 90, 255))
    stop.rect(11, 11, 21, 21, (235, 245, 235, 255))
    stop.save(os.path.join(out, "ih_icon_stop.png"))

    gear = Image(32, 32)
    frame(gear, (42, 44, 50, 255))
    gear.disc(16, 16, 11.0, (176, 184, 196, 255))
    for i in range(8):
        angle = i * math.pi / 4
        gear.disc(16 + math.cos(angle) * 11.5, 16 + math.sin(angle) * 11.5, 2.6, (176, 184, 196, 255))
    gear.disc(16, 16, 5.0, (42, 44, 50, 255))
    gear.save(os.path.join(out, "ih_icon_settings.png"))


def pack_icons():
    img = Image(128, 128)
    # Night sky over a dark field.
    for y in range(128):
        t = y / 127.0
        for x in range(128):
            img.set(x, y, (12 + 18 * t, 14 + 22 * t, 24 + 20 * t, 255))
    for _ in range(50):
        img.set(random.randint(0, 127), random.randint(0, 50), (220, 226, 240, random.randint(80, 200)))
    for y in range(92, 128):
        for x in range(128):
            img.set(x, y, noise((28, 40, 24, 255), 6))

    # The house, lit up, with IMRAN on the parapet.
    img.rect(24, 52, 104, 100, (120, 128, 140, 255))
    img.rect(26, 54, 102, 98, (86, 94, 106, 255))
    for x in range(24, 105, 16):
        img.rect(x, 52, x + 4, 100, (196, 200, 210, 255))
    img.rect(24, 38, 104, 52, (150, 158, 170, 255))

    font = {
        "I": ["111", "010", "010", "010", "111"],
        "M": ["101", "111", "111", "101", "101"],
        "R": ["110", "101", "110", "101", "101"],
        "A": ["010", "101", "111", "101", "101"],
        "N": ["101", "111", "111", "111", "101"],
    }
    cell = 2
    x0 = 30
    for letter in "IMRAN":
        rows = font[letter]
        for ry, row in enumerate(rows):
            for rx, on in enumerate(row):
                if on != "1":
                    continue
                px = x0 + rx * cell
                py = 40 + ry * cell
                img.rect(px, py, px + cell, py + cell, (255, 206, 60, 255))
        x0 += 4 * cell + cell

    for wx in (36, 56, 76, 92):
        img.rect(wx, 62, wx + 10, 74, (255, 200, 84, 255))
        img.rect(wx + 2, 64, wx + 8, 72, (255, 228, 150, 255))
    img.rect(58, 80, 70, 100, (70, 74, 82, 255))
    img.rect(60, 82, 68, 100, (150, 158, 170, 255))

    # The horde closing in.
    for i in range(16):
        x = 6 + (i * 8) % 120
        y = 104 + (i % 3) * 7
        img.disc(x, y, 3.6, (96, 122, 74, 255))
        img.rect(x - 3, y + 3, x + 3, y + 11, (58, 66, 84, 255))
        img.set(x - 1, y - 1, (255, 40, 20, 255))
        img.set(x + 1, y - 1, (255, 40, 20, 255))

    img.save(os.path.join(RP, "pack_icon.png"))
    img.save(os.path.join(BP, "pack_icon.png"))


def main():
    for name in SKINS:
        zombie_skin(name)
    item_house_deployer()
    item_horde_totem()
    particles()
    ui_icons()
    pack_icons()
    print("done")


if __name__ == "__main__":
    main()
