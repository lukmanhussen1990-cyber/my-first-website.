#!/usr/bin/env python3
"""
Extreme Blizzard - texture generator.

Writes the item sprites, the Heater block textures, particle textures, UI icons
and both pack icons:

    python3 tools/generate_blizzard_textures.py
"""

import math
import os
import random

from generate_textures import Image, noise

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RP = os.path.join(ROOT, "blizzard_RP")
BP = os.path.join(ROOT, "blizzard_BP")

random.seed(20551)


# ---------------------------------------------------------------- items ----


def item_weather_stone():
    img = Image(16, 16)
    # A rough ice-blue stone with a snowflake cut into it.
    for y in range(2, 15):
        for x in range(2, 14):
            dx, dy = x - 8, y - 8.5
            if dx * dx + dy * dy * 0.9 > 34:
                continue
            shade = 0.8 + math.sin(x * 0.8 + y * 0.6) * 0.2
            img.set(x, y, noise((120 * shade, 160 * shade, 190 * shade, 255), 8))
    # Rim light.
    for i in range(22):
        angle = i / 22 * math.pi * 2
        img.set(8 + math.cos(angle) * 5.6, 8.5 + math.sin(angle) * 5.9, (196, 226, 245, 255))
    # Snowflake.
    for i in range(3):
        angle = i * math.pi / 3
        img.line(8 - math.cos(angle) * 4, 8.5 - math.sin(angle) * 4,
                 8 + math.cos(angle) * 4, 8.5 + math.sin(angle) * 4, (240, 252, 255, 255), 1)
    img.set(8, 8, (255, 255, 255, 255))
    img.set(5, 5, (255, 255, 255, 180))
    img.save(os.path.join(RP, "textures/items/sw_weather_stone.png"))


def item_hand_warmer():
    img = Image(16, 16)
    # A little iron tin with a glowing coal grid.
    img.rect(3, 4, 13, 13, (86, 90, 96, 255))
    img.rect(4, 5, 12, 12, (128, 132, 140, 255))
    img.rect(5, 6, 11, 11, (44, 40, 40, 255))
    for y in range(6, 11):
        for x in range(5, 11):
            if (x + y) % 2 == 0:
                img.set(x, y, (255, 132, 40, 255))
            else:
                img.set(x, y, (180, 70, 20, 255))
    # Lid hinge and heat haze.
    img.line(3, 4, 12, 4, (168, 172, 180, 255))
    img.set(6, 3, (255, 200, 120, 160))
    img.set(9, 2, (255, 200, 120, 120))
    img.save(os.path.join(RP, "textures/items/sw_hand_warmer.png"))


def item_hot_cocoa():
    img = Image(16, 16)
    # Mug.
    img.rect(4, 5, 12, 14, (226, 226, 232, 255))
    img.rect(5, 6, 11, 13, (250, 250, 255, 255))
    img.rect(5, 6, 11, 8, (92, 52, 30, 255))   # the cocoa
    img.rect(5, 8, 11, 12, (120, 70, 40, 255))
    # Handle.
    img.line(12, 7, 14, 8, (226, 226, 232, 255))
    img.line(14, 8, 14, 10, (226, 226, 232, 255))
    img.line(14, 10, 12, 11, (226, 226, 232, 255))
    # Marshmallows and steam.
    img.set(6, 6, (255, 250, 240, 255))
    img.set(8, 6, (255, 250, 240, 255))
    img.set(9, 7, (245, 235, 225, 255))
    for x, y in ((6, 3), (7, 2), (9, 3), (10, 1)):
        img.set(x, y, (235, 240, 245, 150))
    img.save(os.path.join(RP, "textures/items/sw_hot_cocoa.png"))


# ---------------------------------------------------------------- block ----


def block_heater():
    side = Image(16, 16)
    # Riveted iron casing with a glowing grate down the middle.
    for y in range(16):
        for x in range(16):
            shade = 0.85 + math.sin(x * 0.7 + y * 0.4) * 0.12
            side.set(x, y, noise((92 * shade, 96 * shade, 102 * shade, 255), 6))
    side.rect(0, 0, 16, 2, (68, 72, 78, 255))
    side.rect(0, 14, 16, 16, (68, 72, 78, 255))
    side.rect(3, 4, 13, 12, (38, 34, 34, 255))
    for y in range(5, 12, 2):
        for x in range(4, 12):
            side.set(x, y, (255, 128 + (y - 5) * 12, 40, 255))
            side.set(x, y + 1, (150, 56, 16, 255))
    for x, y in ((1, 1), (14, 1), (1, 14), (14, 14)):
        side.set(x, y, (176, 180, 188, 255))
    side.save(os.path.join(RP, "textures/blocks/sw_heater_side.png"))

    top = Image(16, 16)
    for y in range(16):
        for x in range(16):
            shade = 0.9 + math.sin(x * 0.5 + y * 0.9) * 0.1
            top.set(x, y, noise((104 * shade, 108 * shade, 114 * shade, 255), 6))
    top.rect(2, 2, 14, 14, (60, 62, 68, 255))
    for y in range(3, 13):
        for x in range(3, 13):
            d = math.hypot(x - 7.5, y - 7.5)
            if d < 4.5:
                heat = 1.0 - d / 4.5
                top.set(x, y, (255, 120 + 120 * heat, 30 + 60 * heat, 255))
    top.disc(7.5, 7.5, 1.6, (255, 250, 220, 255))
    top.save(os.path.join(RP, "textures/blocks/sw_heater_top.png"))


# ------------------------------------------------------------ particles ----


def particles():
    out = os.path.join(RP, "textures/particle")

    snow = Image(16, 16)
    snow.disc(7.5, 7.5, 5.5, (255, 255, 255, 235), soft=True)
    snow.disc(7.5, 7.5, 2.2, (255, 255, 255, 255), soft=True)
    snow.save(os.path.join(out, "sw_snow.png"))

    frost = Image(16, 16)
    for i in range(3):
        angle = i * math.pi / 3
        frost.line(8 - math.cos(angle) * 6, 8 - math.sin(angle) * 6,
                   8 + math.cos(angle) * 6, 8 + math.sin(angle) * 6, (255, 255, 255, 255), 1)
        frost.line(8 + math.cos(angle) * 3, 8 + math.sin(angle) * 3,
                   8 + math.cos(angle + 0.7) * 5, 8 + math.sin(angle + 0.7) * 5, (255, 255, 255, 180), 1)
    frost.disc(8, 8, 1.6, (255, 255, 255, 255), soft=True)
    frost.save(os.path.join(out, "sw_frost.png"))

    ember = Image(16, 16)
    ember.disc(7.5, 7.5, 6.0, (255, 255, 255, 150), soft=True)
    ember.disc(7.5, 7.5, 2.5, (255, 255, 255, 255), soft=True)
    ember.save(os.path.join(out, "sw_ember.png"))


# ------------------------------------------------------------- UI icons ----


def ui_icons():
    out = os.path.join(RP, "textures/ui")

    def frame(img, tint):
        img.rect(0, 0, 32, 32, (18, 22, 28, 255))
        img.rect(1, 1, 31, 31, (40, 48, 58, 255))
        img.rect(2, 2, 30, 30, tint)

    storm = Image(32, 32)
    frame(storm, (44, 60, 78, 255))
    for _ in range(70):
        x = random.randint(2, 29)
        y = random.randint(2, 29)
        storm.set(x, y, (236, 246, 255, random.randint(140, 255)))
        storm.set(x - 1, y - 1, (200, 220, 245, 120))
    for i in range(3):
        angle = i * math.pi / 3
        storm.line(16 - math.cos(angle) * 9, 16 - math.sin(angle) * 9,
                   16 + math.cos(angle) * 9, 16 + math.sin(angle) * 9, (255, 255, 255, 255), 2)
    storm.save(os.path.join(out, "sw_icon_storm.png"))

    calm = Image(32, 32)
    frame(calm, (46, 66, 60, 255))
    calm.disc(16, 16, 8.0, (255, 226, 120, 255))
    for i in range(8):
        angle = i * math.pi / 4
        calm.line(16 + math.cos(angle) * 10, 16 + math.sin(angle) * 10,
                  16 + math.cos(angle) * 13, 16 + math.sin(angle) * 13, (255, 226, 120, 255), 2)
    calm.save(os.path.join(out, "sw_icon_calm.png"))

    shelter = Image(32, 32)
    frame(shelter, (50, 42, 34, 255))
    # A little house with a lit window.
    for y in range(14, 27):
        for x in range(7, 25):
            shelter.set(x, y, (108, 76, 50, 255))
    for i in range(11):
        shelter.line(16 - i, 14 - 0 + i - 11 + 11, 16 + i, 14 + i - 11 + 11, (150, 60, 46, 255), 1)
    for i in range(12):
        shelter.line(16 - i, 14 - i + 12 - 12 + 12 - 12, 16 + i, 14 - i, (150, 60, 46, 255), 1)
    shelter.rect(13, 18, 19, 24, (255, 200, 90, 255))
    shelter.rect(14, 19, 18, 23, (255, 228, 150, 255))
    shelter.save(os.path.join(out, "sw_icon_shelter.png"))

    gear = Image(32, 32)
    frame(gear, (40, 46, 54, 255))
    gear.disc(16, 16, 11.0, (176, 190, 206, 255))
    for i in range(8):
        angle = i * math.pi / 4
        gear.disc(16 + math.cos(angle) * 11.5, 16 + math.sin(angle) * 11.5, 2.6, (176, 190, 206, 255))
    gear.disc(16, 16, 5.0, (40, 46, 54, 255))
    gear.save(os.path.join(out, "sw_icon_settings.png"))


# ----------------------------------------------------------- pack icons ----


def pack_icons():
    img = Image(128, 128)
    # Whiteout sky over deep snow.
    for y in range(128):
        t = y / 127.0
        for x in range(128):
            base = 150 + 70 * t
            img.set(x, y, noise((base, base + 8, base + 18, 255), 4))

    # Snow drifts.
    for y in range(86, 128):
        for x in range(128):
            wave = math.sin(x * 0.09) * 5
            if y > 92 + wave:
                img.set(x, y, noise((236, 242, 250, 255), 5))

    # The one warm house.
    img.rect(40, 62, 88, 100, (96, 66, 44, 255))
    for y in range(62, 100, 4):
        img.line(40, y, 88, y, (78, 52, 34, 255))
    # Roof.
    for i in range(26):
        img.line(64 - i, 62 - 0 + i - 26 + 26 - i, 64 + i, 62 - i + 0, (140, 56, 44, 255), 2)
    for i in range(27):
        img.line(64 - i, 62 - i, 64 + i, 62 - i, (150, 62, 48, 255), 1)
    # Snow on the roof.
    for i in range(27):
        img.line(64 - i, 61 - i, 64 + i, 61 - i, (240, 246, 252, 200), 1)
    # Glowing windows and door.
    for wx in (50, 72):
        img.rect(wx, 72, wx + 12, 84, (255, 196, 84, 255))
        img.rect(wx + 2, 74, wx + 10, 82, (255, 228, 150, 255))
    img.rect(60, 86, 70, 100, (70, 46, 30, 255))
    img.rect(61, 87, 69, 100, (255, 176, 70, 255))
    # Chimney smoke.
    img.rect(78, 40, 86, 56, (86, 60, 42, 255))
    for i in range(9):
        img.disc(82 + math.sin(i * 0.8) * 5, 36 - i * 4, 3.5 - i * 0.2, (226, 230, 236, 150), soft=True)

    # Driving snow across everything.
    for _ in range(900):
        x = random.randint(0, 127)
        y = random.randint(0, 127)
        length = random.randint(2, 5)
        for i in range(length):
            img.blend(x + i, y + i // 2, (255, 255, 255, random.randint(120, 235)))

    img.save(os.path.join(RP, "pack_icon.png"))
    img.save(os.path.join(BP, "pack_icon.png"))


def main():
    item_weather_stone()
    item_hand_warmer()
    item_hot_cocoa()
    block_heater()
    particles()
    ui_icons()
    pack_icons()
    print("done")


if __name__ == "__main__":
    main()
