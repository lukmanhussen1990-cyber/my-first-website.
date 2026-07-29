#!/usr/bin/env python3
"""
Legendary Weapons - texture generator.

Writes every PNG used by the weapons resource pack: 7 item sprites, 6 particle
textures, 7 UI icons and both pack icons. Standard library only:

    python3 tools/generate_weapon_textures.py
"""

import math
import os
import random

from generate_textures import Image, noise

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RP = os.path.join(ROOT, "weapons_RP")
BP = os.path.join(ROOT, "weapons_BP")

random.seed(917733)


def blade(img, tip, hilt, edge, core, glow):
    """Draws a diagonal blade from the lower left to the upper right."""
    for i in range(11):
        x = 3 + i
        y = 12 - i
        img.set(x, y, edge)
        img.set(x + 1, y, core)
        img.set(x, y + 1, core)
        img.set(x + 1, y + 1, edge)
    img.set(tip[0], tip[1], glow)
    img.set(tip[0] - 1, tip[1] + 1, glow)
    # Guard and grip.
    img.line(2, 11, 6, 15, hilt, 1)
    img.line(1, 12, 5, 16, hilt, 1)
    img.set(2, 13, (58, 40, 26, 255))
    img.set(3, 14, (58, 40, 26, 255))


def item_thunder_blade():
    img = Image(16, 16)
    blade(
        img,
        tip=(14, 1),
        hilt=(196, 148, 44, 255),
        edge=(226, 236, 248, 255),
        core=(146, 178, 216, 255),
        glow=(255, 248, 150, 255),
    )
    # Arcs of electricity leaping off the blade.
    for x, y in ((10, 2), (12, 4), (8, 5), (13, 2), (6, 8)):
        img.set(x, y, (255, 244, 120, 255))
    img.set(11, 3, (255, 255, 210, 230))
    img.set(7, 7, (255, 255, 210, 200))
    img.save(os.path.join(RP, "textures/items/wm_thunder_blade.png"))


def item_frost_scythe():
    img = Image(16, 16)
    # Long shaft.
    img.line(4, 15, 9, 4, (86, 66, 52, 255), 1)
    img.line(5, 15, 10, 4, (120, 96, 74, 255), 1)
    # Curved icy blade along the top.
    curve = [(10, 3), (11, 2), (12, 2), (13, 3), (14, 4), (14, 6), (13, 7)]
    for i, (x, y) in enumerate(curve):
        img.set(x, y, (222, 246, 255, 255))
        img.set(x, y + 1, (140, 200, 240, 255))
        if i % 2 == 0:
            img.set(x - 1, y + 1, (96, 166, 220, 255))
    img.set(9, 3, (255, 255, 255, 255))
    # Frost crystals hanging from it.
    for x, y in ((12, 9), (10, 8), (14, 8)):
        img.set(x, y, (176, 226, 255, 235))
    img.save(os.path.join(RP, "textures/items/wm_frost_scythe.png"))


def item_inferno_cannon():
    img = Image(16, 16)
    # Barrel.
    img.rect(3, 6, 13, 10, (72, 68, 76, 255))
    img.rect(3, 6, 13, 7, (108, 104, 112, 255))
    img.rect(3, 9, 13, 10, (46, 42, 50, 255))
    # Muzzle glow.
    img.rect(12, 5, 15, 11, (54, 50, 58, 255))
    img.disc(14, 8, 2.2, (255, 138, 30, 255))
    img.disc(14, 8, 1.1, (255, 232, 140, 255))
    # Grip and heat vents.
    img.rect(4, 10, 7, 14, (60, 56, 64, 255))
    img.rect(5, 11, 6, 14, (40, 36, 44, 255))
    for x in (6, 8, 10):
        img.set(x, 7, (255, 108, 24, 255))
        img.set(x, 8, (255, 168, 60, 200))
    img.save(os.path.join(RP, "textures/items/wm_inferno_cannon.png"))


def item_void_ripper():
    img = Image(16, 16)
    # Short curved dagger.
    for i in range(8):
        x = 5 + i
        y = 10 - i
        img.set(x, y, (222, 196, 255, 255))
        img.set(x + 1, y, (150, 96, 210, 255))
    img.set(13, 2, (255, 255, 255, 255))
    img.set(12, 3, (240, 220, 255, 255))
    # Handle.
    img.line(3, 13, 6, 10, (48, 30, 62, 255), 1)
    img.line(2, 12, 5, 9, (72, 48, 92, 255), 1)
    # Void motes trailing off the edge.
    for x, y in ((8, 6), (10, 4), (6, 9), (11, 6)):
        img.set(x, y, (176, 90, 255, 220))
    img.set(9, 5, (40, 4, 60, 255))
    img.save(os.path.join(RP, "textures/items/wm_void_ripper.png"))


def item_earthshaker():
    img = Image(16, 16)
    # Handle.
    img.line(4, 15, 9, 6, (92, 66, 44, 255), 1)
    img.line(5, 15, 10, 6, (128, 96, 62, 255), 1)
    # Heavy stone head.
    img.rect(7, 1, 15, 7, (78, 74, 80, 255))
    img.rect(8, 2, 14, 6, (112, 106, 112, 255))
    img.rect(9, 3, 13, 5, (86, 80, 88, 255))
    for _ in range(9):
        img.set(random.randint(8, 13), random.randint(2, 5), (58, 52, 58, 255))
    # Molten cracks.
    img.set(10, 3, (255, 150, 40, 255))
    img.set(11, 4, (255, 180, 60, 255))
    img.set(9, 5, (255, 120, 20, 255))
    img.save(os.path.join(RP, "textures/items/wm_earthshaker.png"))


def item_singularity_staff():
    img = Image(16, 16)
    # Shaft.
    img.line(3, 15, 9, 6, (46, 38, 58, 255), 1)
    img.line(4, 15, 10, 6, (78, 64, 96, 255), 1)
    # Claw holding the orb.
    img.set(8, 5, (150, 130, 176, 255))
    img.set(12, 5, (150, 130, 176, 255))
    img.set(9, 3, (150, 130, 176, 255))
    img.set(11, 3, (150, 130, 176, 255))
    # The singularity itself: bright ring, black centre.
    img.disc(10.5, 4.5, 3.4, (168, 92, 255, 255))
    img.disc(10.5, 4.5, 2.3, (92, 30, 168, 255))
    img.disc(10.5, 4.5, 1.2, (10, 0, 18, 255))
    img.set(9, 2, (236, 200, 255, 235))
    img.set(13, 7, (200, 140, 255, 200))
    img.save(os.path.join(RP, "textures/items/wm_singularity_staff.png"))


def item_weapon_core():
    img = Image(16, 16)
    # Faceted crystal core.
    points = [(8, 2), (12, 6), (12, 10), (8, 14), (4, 10), (4, 6)]
    for y in range(2, 15):
        for x in range(3, 14):
            dx, dy = x - 8, (y - 8) * 0.8
            d = math.hypot(dx, dy)
            if d > 5.6:
                continue
            shade = 1.0 - d / 8.0
            img.set(x, y, noise((70 + 150 * shade, 40 + 90 * shade, 150 + 100 * shade, 255), 10))
    for px, py in points:
        img.line(8, 8, px, py, (206, 176, 255, 220), 1)
    img.disc(8, 8, 2.0, (240, 226, 255, 255), soft=True)
    img.set(6, 5, (255, 255, 255, 220))
    img.save(os.path.join(RP, "textures/items/wm_weapon_core.png"))


def particles():
    out = os.path.join(RP, "textures/particle")

    spark = Image(16, 16)
    spark.line(7, 0, 7, 15, (255, 255, 255, 255), 1)
    spark.line(8, 0, 8, 15, (255, 255, 255, 190), 1)
    spark.line(2, 7, 13, 7, (255, 255, 255, 210), 1)
    spark.disc(7.5, 7.5, 3.0, (255, 255, 255, 255), soft=True)
    spark.save(os.path.join(out, "wm_spark.png"))

    shard = Image(16, 16)
    for y in range(2, 14):
        half = max(1, 5 - abs(8 - y) // 2)
        for x in range(8 - half, 8 + half):
            shard.set(x, y, (255, 255, 255, 235))
    shard.line(8, 2, 8, 13, (255, 255, 255, 255), 1)
    shard.save(os.path.join(out, "wm_shard.png"))

    flame = Image(16, 16)
    flame.disc(7.5, 9.0, 6.0, (255, 255, 255, 190), soft=True)
    flame.disc(7.5, 8.0, 3.0, (255, 255, 255, 255), soft=True)
    flame.line(7, 1, 7, 5, (255, 255, 255, 200), 1)
    flame.save(os.path.join(out, "wm_flame.png"))

    rift = Image(16, 16)
    for i in range(24):
        angle = i / 24 * math.pi * 2
        rift.set(8 + math.cos(angle) * 6, 8 + math.sin(angle) * 6, (255, 255, 255, 240))
        rift.set(8 + math.cos(angle) * 4, 8 + math.sin(angle) * 4, (255, 255, 255, 160))
    rift.disc(8, 8, 2.4, (255, 255, 255, 255), soft=True)
    rift.save(os.path.join(out, "wm_rift.png"))

    dust = Image(16, 16)
    dust.disc(7.5, 7.5, 7.0, (255, 255, 255, 215), soft=True)
    for _ in range(24):
        x, y = random.randint(2, 13), random.randint(2, 13)
        r, g, b, a = dust.get(x, y)
        dust.set(x, y, (r, g, b, max(0, a - random.randint(40, 110))))
    dust.save(os.path.join(out, "wm_dust.png"))

    core = Image(16, 16)
    core.disc(7.5, 7.5, 7.5, (255, 255, 255, 150), soft=True)
    core.disc(7.5, 7.5, 4.0, (255, 255, 255, 255), soft=True)
    core.save(os.path.join(out, "wm_core.png"))


def ui_icons():
    out = os.path.join(RP, "textures/ui")

    def frame(img, tint):
        img.rect(0, 0, 32, 32, (22, 20, 26, 255))
        img.rect(1, 1, 31, 31, (46, 42, 52, 255))
        img.rect(2, 2, 30, 30, tint)

    thunder = Image(32, 32)
    frame(thunder, (40, 40, 58, 255))
    bolt = [(19, 4), (12, 16), (17, 16), (11, 28), (22, 13), (17, 13), (22, 4)]
    for i in range(len(bolt) - 1):
        thunder.line(bolt[i][0], bolt[i][1], bolt[i + 1][0], bolt[i + 1][1], (255, 236, 100, 255), 2)
    thunder.save(os.path.join(out, "wm_icon_thunder.png"))

    frost = Image(32, 32)
    frame(frost, (26, 48, 68, 255))
    for i in range(6):
        angle = i * math.pi / 3
        frost.line(16, 16, 16 + math.cos(angle) * 11, 16 + math.sin(angle) * 11, (206, 240, 255, 255), 2)
        frost.line(16 + math.cos(angle) * 7, 16 + math.sin(angle) * 7,
                   16 + math.cos(angle + 0.6) * 10, 16 + math.sin(angle + 0.6) * 10, (150, 210, 250, 255), 1)
    frost.disc(16, 16, 2.5, (255, 255, 255, 255))
    frost.save(os.path.join(out, "wm_icon_frost.png"))

    inferno = Image(32, 32)
    frame(inferno, (58, 26, 20, 255))
    for y in range(6, 28):
        t = (y - 6) / 21.0
        half = 2 + t * 9
        flicker = math.sin(y * 1.2) * 1.5
        inferno.line(16 - half + flicker, y, 16 + half + flicker, y, (255, 96 + t * 60, 20, 255))
    for y in range(14, 28):
        t = (y - 14) / 13.0
        inferno.line(16 - 1 - t * 3, y, 16 + 1 + t * 3, y, (255, 218, 96, 255))
    inferno.save(os.path.join(out, "wm_icon_inferno.png"))

    void = Image(32, 32)
    frame(void, (36, 20, 52, 255))
    for i in range(40):
        angle = i / 40 * math.pi * 6
        radius = 12 - i * 0.28
        void.set(16 + math.cos(angle) * radius, 16 + math.sin(angle) * radius, (196, 120, 255, 255))
    void.disc(16, 16, 3.0, (16, 2, 24, 255))
    void.save(os.path.join(out, "wm_icon_void.png"))

    quake = Image(32, 32)
    frame(quake, (58, 44, 26, 255))
    quake.rect(2, 18, 30, 30, (120, 92, 58, 255))
    zig = [(5, 30), (10, 21), (14, 25), (19, 18), (24, 24), (28, 20)]
    for i in range(len(zig) - 1):
        quake.line(zig[i][0], zig[i][1], zig[i + 1][0], zig[i + 1][1], (36, 28, 20, 255), 2)
    quake.rect(10, 5, 22, 12, (110, 104, 110, 255))
    quake.rect(15, 12, 17, 18, (92, 66, 44, 255))
    quake.save(os.path.join(out, "wm_icon_quake.png"))

    singularity = Image(32, 32)
    frame(singularity, (28, 18, 44, 255))
    for i in range(90):
        angle = i / 90 * math.pi * 8
        radius = 13 - i * 0.13
        shade = 1.0 - i / 110
        singularity.set(16 + math.cos(angle) * radius, 16 + math.sin(angle) * radius,
                        (150 + 90 * shade, 60 + 60 * shade, 220, 255))
    singularity.disc(16, 16, 4.5, (8, 0, 14, 255))
    singularity.disc(16, 16, 5.5, (200, 140, 255, 60), soft=True)
    singularity.save(os.path.join(out, "wm_icon_singularity.png"))

    gear = Image(32, 32)
    frame(gear, (42, 42, 48, 255))
    gear.disc(16, 16, 11.0, (176, 184, 196, 255))
    for i in range(8):
        angle = i * math.pi / 4
        gear.disc(16 + math.cos(angle) * 11.5, 16 + math.sin(angle) * 11.5, 2.6, (176, 184, 196, 255))
    gear.disc(16, 16, 5.0, (42, 42, 48, 255))
    gear.save(os.path.join(out, "wm_icon_settings.png"))


def pack_icons():
    img = Image(128, 128)
    # Dark forge background with a glow behind the weapons.
    for y in range(128):
        for x in range(128):
            d = math.hypot(x - 64, y - 70) / 90.0
            base = 40 * (1 - d)
            img.set(x, y, noise((18 + base, 16 + base * 0.8, 26 + base * 1.4, 255), 6))
    img.disc(64, 68, 46, (120, 70, 200, 40), soft=True)

    # Two crossed blades.
    for i in range(58):
        x = 22 + i
        y = 106 - i
        img.line(x, y, x + 3, y, (226, 236, 248, 255), 1)
        img.line(x + 3, y, x + 5, y, (140, 172, 212, 255), 1)
    for i in range(58):
        x = 106 - i
        y = 106 - i
        img.line(x, y, x + 3, y, (222, 196, 255, 255), 1)
        img.line(x - 2, y, x, y, (150, 96, 210, 255), 1)
    # Hilts.
    img.line(14, 104, 34, 118, (196, 148, 44, 255), 3)
    img.line(114, 104, 94, 118, (120, 90, 160, 255), 3)

    # Weapon core burning between them.
    img.disc(64, 48, 18, (150, 90, 240, 255))
    img.disc(64, 48, 12, (200, 160, 255, 255))
    img.disc(64, 48, 6, (255, 250, 255, 255))
    for i in range(10):
        angle = i / 10 * math.pi * 2
        img.line(64 + math.cos(angle) * 18, 48 + math.sin(angle) * 18,
                 64 + math.cos(angle) * 26, 48 + math.sin(angle) * 26, (196, 140, 255, 200), 2)
    # Sparks.
    for _ in range(60):
        x = random.randint(0, 127)
        y = random.randint(0, 127)
        img.blend(x, y, (255, 236, 140, random.randint(30, 110)))

    img.save(os.path.join(RP, "pack_icon.png"))
    img.save(os.path.join(BP, "pack_icon.png"))


def main():
    item_thunder_blade()
    item_frost_scythe()
    item_inferno_cannon()
    item_void_ripper()
    item_earthshaker()
    item_singularity_staff()
    item_weapon_core()
    particles()
    ui_icons()
    pack_icons()
    print("done")


if __name__ == "__main__":
    main()
