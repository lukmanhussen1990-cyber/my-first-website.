#!/usr/bin/env python3
"""
Parasite - texture generator.

Writes every PNG used by the parasite resource pack. Reuses the tiny PNG writer
from generate_textures.py, so it needs nothing but the standard library:

    python3 tools/generate_parasite_textures.py

The entity texture is a 64x64 atlas laid out to match the box UVs in
parasite_RP/models/entity/parasite.geo.json:

    body    (0,0)-(48,21)     skull   (0,22)-(28,34)
    jaw up  (28,22)-(50,29)   jaw low (28,30)-(50,36)
    mandible(0,35)-(16,43)    eyes    (16,35)-(22,38)
    spike   (24,35)-(32,41)   tail    (0,44)-(24,56)
    stinger (24,44)-(36,50)   leg     (36,44)-(44,51)
    claw    (44,44)-(54,49)
"""

import math
import os
import random

from generate_textures import Image, noise

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RP = os.path.join(ROOT, "parasite_RP")
BP = os.path.join(ROOT, "parasite_BP")

random.seed(66613)

# Growth stages: (chitin, chitin_dark, vein, bone, eye)
PALETTES = {
    "small": {
        "chitin": (150, 96, 104),
        "dark": (96, 54, 62),
        "vein": (198, 140, 148),
        "bone": (226, 214, 190),
        "eye": (236, 244, 90),
        "glow": (140, 200, 70),
    },
    "large": {
        "chitin": (118, 26, 36),
        "dark": (62, 12, 20),
        "vein": (196, 52, 44),
        "bone": (214, 200, 172),
        "eye": (255, 214, 40),
        "glow": (188, 236, 60),
    },
    "apex": {
        "chitin": (46, 18, 44),
        "dark": (20, 8, 22),
        "vein": (226, 92, 20),
        "bone": (186, 176, 158),
        "eye": (255, 122, 20),
        "glow": (255, 150, 30),
    },
}


def fill_chitin(img, x0, y0, x1, y1, palette, veins=True):
    """Segmented carapace with a wet sheen and pulsing veins."""
    for y in range(y0, y1):
        for x in range(x0, x1):
            band = math.sin((y - y0) * 1.5) * 0.5 + 0.5
            shade = 0.72 + band * 0.45
            base = palette["chitin"]
            img.set(x, y, noise((base[0] * shade, base[1] * shade, base[2] * shade, 255), 9))
    if not veins:
        return
    for _ in range((x1 - x0) * (y1 - y0) // 22):
        vx = random.randint(x0, x1 - 1)
        vy = random.randint(y0, y1 - 1)
        length = random.randint(2, 5)
        for i in range(length):
            img.set(vx + i, vy + int(math.sin(i * 1.2) * 1.5), noise(palette["vein"] + (255,), 12))
    # Dark pits.
    for _ in range((x1 - x0) * (y1 - y0) // 40):
        px = random.randint(x0, x1 - 1)
        py = random.randint(y0, y1 - 1)
        img.set(px, py, palette["dark"] + (255,))


def fill_bone(img, x0, y0, x1, y1, palette, teeth=False):
    for y in range(y0, y1):
        for x in range(x0, x1):
            shade = 0.85 + math.sin(x * 0.9 + y * 0.4) * 0.15
            base = palette["bone"]
            img.set(x, y, noise((base[0] * shade, base[1] * shade, base[2] * shade, 255), 8))
    if not teeth:
        return
    # A row of fangs along the bottom edge.
    for x in range(x0, x1):
        if (x - x0) % 3 == 0:
            img.set(x, y1 - 1, (255, 252, 240, 255))
            img.set(x, y1 - 2, (238, 230, 210, 255))
        else:
            img.set(x, y1 - 1, palette["dark"] + (255,))


def fill_eye(img, x0, y0, x1, y1, palette):
    for y in range(y0, y1):
        for x in range(x0, x1):
            img.set(x, y, palette["eye"] + (255,))
    cx = (x0 + x1) // 2
    cy = (y0 + y1) // 2
    img.set(cx, cy, (30, 0, 0, 255))
    img.set(cx - 1, cy, (90, 10, 10, 255))


def entity_texture(stage):
    palette = PALETTES[stage]
    img = Image(64, 64)

    fill_chitin(img, 0, 0, 48, 21, palette)          # body
    fill_chitin(img, 0, 22, 28, 34, palette)         # skull
    fill_bone(img, 28, 22, 50, 29, palette, teeth=True)   # upper jaw
    fill_bone(img, 28, 30, 50, 36, palette, teeth=True)   # lower jaw
    fill_bone(img, 0, 35, 16, 43, palette)           # mandibles
    fill_eye(img, 16, 35, 22, 38, palette)           # eyes
    fill_bone(img, 24, 35, 32, 41, palette)          # back spikes
    fill_chitin(img, 0, 44, 24, 56, palette)         # tail
    fill_bone(img, 24, 44, 36, 50, palette)          # stinger
    fill_chitin(img, 36, 44, 44, 51, palette, veins=False)  # legs
    fill_bone(img, 44, 44, 54, 49, palette)          # claws

    # Glowing ridge down the back of the body panel.
    for x in range(6, 42):
        glow = palette["glow"]
        img.set(x, 10, (glow[0], glow[1], glow[2], 255))
        img.blend(x, 9, (glow[0], glow[1], glow[2], 110))
        img.blend(x, 11, (glow[0], glow[1], glow[2], 110))

    img.save(os.path.join(RP, f"textures/entity/parasite/parasite_{stage}.png"))


def item_sample():
    img = Image(16, 16)
    glass = (198, 226, 232, 140)
    glass_edge = (150, 186, 196, 220)

    img.rect(4, 3, 12, 15, glass)
    img.line(4, 3, 4, 14, glass_edge)
    img.line(11, 3, 11, 14, glass_edge)
    img.line(4, 14, 11, 14, glass_edge)

    # Cork.
    img.rect(5, 1, 11, 3, (128, 92, 52, 255))
    img.rect(5, 1, 11, 2, (162, 120, 70, 255))

    # Larva curled up inside.
    for i, (x, y) in enumerate([(6, 11), (7, 10), (8, 9), (9, 9), (9, 8), (8, 7), (7, 7)]):
        shade = 1.0 - i * 0.05
        img.set(x, y, (140 * shade, 30 * shade, 40 * shade, 255))
        img.set(x, y + 1, (96 * shade, 20 * shade, 28 * shade, 255))
    img.set(7, 6, (236, 244, 90, 255))  # eye
    img.set(6, 12, (188, 236, 60, 255))  # spore

    # Fluid line + highlight.
    for x in range(5, 11):
        img.blend(x, 13, (120, 200, 90, 90))
    img.set(5, 5, (255, 255, 255, 190))
    img.set(5, 6, (255, 255, 255, 120))

    img.save(os.path.join(RP, "textures/items/pm_parasite_sample.png"))


def block_flesh():
    img = Image(16, 16)
    for y in range(16):
        for x in range(16):
            lumps = math.sin(x * 1.1) * math.cos(y * 0.9)
            shade = 0.75 + (lumps * 0.5 + 0.5) * 0.5
            img.set(x, y, noise((122 * shade, 34 * shade, 46 * shade, 255), 12))
    # Sinew strands.
    for _ in range(9):
        x = random.randint(0, 15)
        y = random.randint(0, 15)
        for i in range(random.randint(3, 6)):
            img.set((x + i) % 16, (y + int(math.sin(i) * 2)) % 16, noise((188, 74, 70, 255), 14))
    # Breathing holes with a faint glow.
    for _ in range(5):
        cx = random.randint(2, 13)
        cy = random.randint(2, 13)
        img.set(cx, cy, (28, 6, 12, 255))
        img.blend(cx + 1, cy, (255, 140, 60, 70))
        img.blend(cx, cy + 1, (255, 140, 60, 50))
    img.save(os.path.join(RP, "textures/blocks/pm_infested_flesh.png"))


def particles():
    out = os.path.join(RP, "textures/particle")

    spore = Image(16, 16)
    spore.disc(7.5, 7.5, 6.0, (255, 255, 255, 235), soft=True)
    spore.disc(7.5, 7.5, 2.0, (255, 255, 255, 255), soft=True)
    spore.save(os.path.join(out, "pm_spore.png"))

    bit = Image(16, 16)
    for y in range(5, 12):
        for x in range(5, 12):
            if random.random() < 0.85:
                bit.set(x, y, noise((255, 255, 255, 255), 20))
    bit.save(os.path.join(out, "pm_bit.png"))

    gore = Image(16, 16)
    gore.disc(7.0, 8.0, 4.5, (255, 255, 255, 255), soft=True)
    gore.disc(10.0, 5.0, 2.0, (255, 255, 255, 255), soft=True)
    gore.disc(4.5, 5.5, 1.6, (255, 255, 255, 235), soft=True)
    gore.save(os.path.join(out, "pm_gore.png"))


def parasite_glyph(img, cx, cy, scale, palette, with_eyes=True):
    """Draws a small top down parasite silhouette into an icon."""
    body = palette["chitin"] + (255,)
    dark = palette["dark"] + (255,)
    img.disc(cx, cy, 4.2 * scale, body)
    img.disc(cx, cy - 4.5 * scale, 2.8 * scale, body)
    img.disc(cx, cy + 5.0 * scale, 2.2 * scale, dark)
    for side in (-1, 1):
        for i, offset in enumerate((-3, 0, 3)):
            x0 = cx + side * 3.2 * scale
            y0 = cy + offset * scale
            img.line(x0, y0, x0 + side * 5.0 * scale, y0 + (i - 1) * 2.5 * scale, dark, 1)
    # Mandibles.
    img.line(cx - 2 * scale, cy - 6 * scale, cx - 4 * scale, cy - 9 * scale, palette["bone"] + (255,), 1)
    img.line(cx + 2 * scale, cy - 6 * scale, cx + 4 * scale, cy - 9 * scale, palette["bone"] + (255,), 1)
    if with_eyes:
        img.set(cx - 1 * scale, cy - 5 * scale, palette["eye"] + (255,))
        img.set(cx + 1 * scale, cy - 5 * scale, palette["eye"] + (255,))


def ui_icons():
    out = os.path.join(RP, "textures/ui")

    def frame(img, tint):
        img.rect(0, 0, 32, 32, (24, 18, 22, 255))
        img.rect(1, 1, 31, 31, (48, 34, 40, 255))
        img.rect(2, 2, 30, 30, tint)

    release = Image(32, 32)
    frame(release, (58, 26, 32, 255))
    parasite_glyph(release, 16, 17, 1.0, PALETTES["large"])
    release.save(os.path.join(out, "pm_icon_release.png"))

    swarm = Image(32, 32)
    frame(swarm, (44, 18, 24, 255))
    parasite_glyph(swarm, 10, 12, 0.6, PALETTES["large"])
    parasite_glyph(swarm, 22, 14, 0.6, PALETTES["small"])
    parasite_glyph(swarm, 15, 23, 0.7, PALETTES["apex"])
    swarm.save(os.path.join(out, "pm_icon_swarm.png"))

    purge = Image(32, 32)
    frame(purge, (52, 44, 20, 255))
    parasite_glyph(purge, 16, 18, 0.85, PALETTES["small"], with_eyes=False)
    purge.line(6, 6, 26, 26, (255, 208, 64, 255), 2)
    purge.line(26, 6, 6, 26, (255, 208, 64, 255), 2)
    purge.save(os.path.join(out, "pm_icon_purge.png"))

    purge_all = Image(32, 32)
    frame(purge_all, (56, 30, 12, 255))
    for y in range(8, 22):
        for x in range(9, 23):
            purge_all.set(x, y, (232, 226, 210, 255))
    purge_all.rect(11, 12, 15, 16, (30, 24, 22, 255))
    purge_all.rect(17, 12, 21, 16, (30, 24, 22, 255))
    purge_all.rect(14, 18, 18, 21, (30, 24, 22, 255))
    purge_all.rect(12, 22, 20, 26, (232, 226, 210, 255))
    for x in range(12, 20, 2):
        purge_all.line(x, 22, x, 26, (150, 144, 132, 255))
    purge_all.save(os.path.join(out, "pm_icon_purge_all.png"))

    gear = Image(32, 32)
    frame(gear, (40, 40, 46, 255))
    gear.disc(16, 16, 11.0, (176, 184, 196, 255))
    for i in range(8):
        angle = i * math.pi / 4
        gear.disc(16 + math.cos(angle) * 11.5, 16 + math.sin(angle) * 11.5, 2.6, (176, 184, 196, 255))
    gear.disc(16, 16, 5.0, (40, 40, 46, 255))
    gear.save(os.path.join(out, "pm_icon_settings.png"))


def pack_icons():
    img = Image(128, 128)
    # Damp cave wall.
    for y in range(128):
        for x in range(128):
            t = y / 127.0
            img.set(x, y, noise((30 + 22 * t, 16 + 10 * t, 20 + 12 * t, 255), 7))
    # Infested flesh creeping up from the floor.
    for y in range(78, 128):
        for x in range(128):
            if random.random() < (y - 78) / 50.0:
                img.set(x, y, noise((116, 30, 42, 255), 16))
    for _ in range(70):
        cx = random.randint(0, 127)
        cy = random.randint(80, 127)
        img.disc(cx, cy, random.uniform(1.5, 4.0), noise((92, 22, 34, 255), 14))

    # The parasite itself, big and close.
    palette = PALETTES["apex"]
    img.disc(64, 74, 26, palette["chitin"] + (255,))
    img.disc(64, 46, 18, palette["chitin"] + (255,))
    img.disc(64, 104, 14, palette["dark"] + (255,))
    for side in (-1, 1):
        for i, offset in enumerate((-14, 0, 14)):
            x0 = 64 + side * 22
            y0 = 74 + offset
            img.line(x0, y0, x0 + side * 34, y0 + (i - 1) * 16, palette["dark"] + (255,), 3)
            img.line(x0 + side * 34, y0 + (i - 1) * 16, x0 + side * 40, y0 + (i - 1) * 16 + 18,
                     palette["dark"] + (255,), 2)
    # Mandibles and fangs.
    img.line(52, 34, 40, 14, palette["bone"] + (255,), 3)
    img.line(76, 34, 88, 14, palette["bone"] + (255,), 3)
    for x in range(50, 79, 5):
        img.line(x, 54, x + 2, 62, (226, 216, 196, 255), 2)
    # Glowing eyes.
    for cx in (56, 72):
        img.disc(cx, 42, 5.0, palette["eye"] + (255,))
        img.disc(cx, 42, 8.0, palette["eye"] + (70,), soft=True)
        img.disc(cx, 42, 2.0, (40, 4, 0, 255))
    # Spore haze.
    for _ in range(60):
        x = random.randint(0, 127)
        y = random.randint(0, 127)
        img.blend(x, y, (palette["glow"][0], palette["glow"][1], palette["glow"][2], random.randint(40, 120)))

    img.save(os.path.join(RP, "pack_icon.png"))
    img.save(os.path.join(BP, "pack_icon.png"))


def main():
    for stage in PALETTES:
        entity_texture(stage)
    item_sample()
    block_flesh()
    particles()
    ui_icons()
    pack_icons()
    print("done")


if __name__ == "__main__":
    main()
