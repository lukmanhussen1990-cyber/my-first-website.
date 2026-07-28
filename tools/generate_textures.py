#!/usr/bin/env python3
"""
Natural Disasters - texture generator.

Writes every PNG used by the resource pack (items, entities, particles, UI icons
and both pack icons). Pure standard library, so it runs anywhere Python 3 does:

    python3 tools/generate_textures.py

Re-run it after changing a colour or a shape below; nothing else depends on it at
runtime, the generated PNGs are committed to the repository.
"""

import math
import os
import random
import struct
import zlib

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RP = os.path.join(ROOT, "natural_disasters_RP")
BP = os.path.join(ROOT, "natural_disasters_BP")

random.seed(20240728)  # stable output between runs


# --------------------------------------------------------------------- canvas


class Image:
    """A tiny RGBA image with just enough drawing helpers."""

    def __init__(self, width, height):
        self.w = width
        self.h = height
        self.px = [[(0, 0, 0, 0) for _ in range(width)] for _ in range(height)]

    def set(self, x, y, color):
        x, y = int(x), int(y)
        if 0 <= x < self.w and 0 <= y < self.h:
            self.px[y][x] = tuple(max(0, min(255, int(c))) for c in color)

    def get(self, x, y):
        if 0 <= x < self.w and 0 <= y < self.h:
            return self.px[int(y)][int(x)]
        return (0, 0, 0, 0)

    def blend(self, x, y, color):
        """Alpha blends `color` over whatever is already there."""
        r, g, b, a = color
        if a <= 0:
            return
        dr, dg, db, da = self.get(x, y)
        alpha = a / 255.0
        out = (
            r * alpha + dr * (1 - alpha),
            g * alpha + dg * (1 - alpha),
            b * alpha + db * (1 - alpha),
            max(a, da),
        )
        self.set(x, y, out)

    def rect(self, x0, y0, x1, y1, color):
        for y in range(int(y0), int(y1)):
            for x in range(int(x0), int(x1)):
                self.set(x, y, color)

    def line(self, x0, y0, x1, y1, color, thickness=1):
        steps = int(max(abs(x1 - x0), abs(y1 - y0)) * 2) + 1
        for i in range(steps + 1):
            t = i / steps
            x = x0 + (x1 - x0) * t
            y = y0 + (y1 - y0) * t
            for ox in range(-(thickness - 1), thickness):
                for oy in range(-(thickness - 1), thickness):
                    self.set(round(x) + ox, round(y) + oy, color)

    def disc(self, cx, cy, radius, color, soft=False):
        for y in range(int(cy - radius) - 1, int(cy + radius) + 2):
            for x in range(int(cx - radius) - 1, int(cx + radius) + 2):
                d = math.hypot(x - cx, y - cy)
                if d <= radius:
                    if soft:
                        fade = max(0.0, 1.0 - (d / radius) ** 1.6)
                        self.blend(x, y, (color[0], color[1], color[2], color[3] * fade))
                    else:
                        self.set(x, y, color)

    def save(self, path):
        os.makedirs(os.path.dirname(path), exist_ok=True)
        raw = bytearray()
        for row in self.px:
            raw.append(0)  # filter type 0
            for r, g, b, a in row:
                raw += bytes((r, g, b, a))

        def chunk(tag, data):
            out = struct.pack(">I", len(data)) + tag + data
            return out + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)

        header = struct.pack(">IIBBBBB", self.w, self.h, 8, 6, 0, 0, 0)
        png = (
            b"\x89PNG\r\n\x1a\n"
            + chunk(b"IHDR", header)
            + chunk(b"IDAT", zlib.compress(bytes(raw), 9))
            + chunk(b"IEND", b"")
        )
        with open(path, "wb") as handle:
            handle.write(png)
        print("wrote", os.path.relpath(path, ROOT))


def noise(base, amount):
    """Jitters a colour a little so flat areas look hand painted."""
    delta = random.randint(-amount, amount)
    return (base[0] + delta, base[1] + delta, base[2] + delta, base[3])


# ---------------------------------------------------------------------- items


def item_disaster_wand():
    img = Image(16, 16)
    handle_dark = (74, 48, 28, 255)
    handle_light = (122, 84, 48, 255)

    # Wooden shaft running from the bottom left to the top right.
    img.line(3, 13, 10, 5, handle_dark, 2)
    img.line(3, 12, 10, 4, handle_light, 1)
    img.set(2, 14, handle_dark)
    img.set(3, 14, handle_dark)

    # Storm orb on the tip.
    img.disc(11.5, 3.5, 3.4, (36, 42, 60, 255))
    img.disc(11.5, 3.5, 2.6, (86, 168, 214, 255))
    img.disc(11.0, 3.0, 1.5, (196, 240, 255, 255))

    # Little funnel swirl inside the orb.
    for i in range(9):
        angle = i * 0.9
        radius = 0.4 + i * 0.22
        img.set(11.5 + math.cos(angle) * radius, 3.5 + math.sin(angle) * radius * 0.7, (255, 255, 255, 235))

    # Sparks.
    for sx, sy in ((14, 1), (8, 1), (14, 7), (9, 8)):
        img.set(sx, sy, (255, 246, 180, 230))
    img.set(15, 2, (255, 246, 180, 160))

    img.save(os.path.join(RP, "textures/items/nd_disaster_wand.png"))


def item_disaster_detector():
    img = Image(16, 16)
    body = (58, 62, 70, 255)
    body_dark = (34, 37, 43, 255)
    body_light = (92, 98, 108, 255)

    img.rect(2, 3, 14, 15, body_dark)
    img.rect(3, 4, 13, 14, body)
    img.line(3, 4, 12, 4, body_light)
    img.line(3, 4, 3, 13, body_light)

    # Screen with a seismograph trace.
    img.rect(4, 6, 12, 11, (18, 30, 22, 255))
    trace = [(4, 9), (5, 9), (6, 7), (7, 10), (8, 8), (9, 9), (10, 9), (11, 9)]
    for x, y in trace:
        img.set(x, y, (120, 255, 140, 255))
    for x, y in trace:
        img.blend(x, y - 1, (120, 255, 140, 70))

    # Antenna + status light.
    img.line(8, 3, 8, 0, (150, 156, 166, 255))
    img.set(8, 0, (255, 92, 76, 255))
    img.set(9, 0, (255, 92, 76, 140))
    img.set(5, 12, (255, 196, 70, 255))
    img.set(7, 12, (110, 200, 255, 255))
    img.set(9, 12, (120, 255, 140, 255))
    img.rect(11, 12, 13, 13, (44, 47, 54, 255))

    img.save(os.path.join(RP, "textures/items/nd_disaster_detector.png"))


# ------------------------------------------------------------------- entities


def entity_tornado():
    """64x64: two 32x32 side panels (top row) and two 32x32 caps (bottom row)."""
    img = Image(64, 64)

    def side_panel(ox, oy, base, alpha_top, alpha_bottom):
        for y in range(32):
            t = y / 31.0
            alpha = alpha_bottom + (alpha_top - alpha_bottom) * t
            for x in range(32):
                # Diagonal streaks make the spin read clearly once it rotates.
                streak = math.sin((x * 0.7 + y * 1.9)) * 0.5 + 0.5
                shade = 0.72 + streak * 0.4
                color = (base[0] * shade, base[1] * shade, base[2] * shade, alpha * (0.55 + streak * 0.6))
                img.set(ox + x, oy + y, noise(tuple(int(c) for c in color), 6))
                # Punch a few holes so the funnel looks like moving dust.
                if random.random() < 0.06:
                    img.set(ox + x, oy + y, (0, 0, 0, 0))

    def cap_panel(ox, oy, base, alpha):
        for y in range(32):
            for x in range(32):
                dx, dy = x - 15.5, y - 15.5
                d = math.hypot(dx, dy) / 16.0
                if d > 1.0:
                    img.set(ox + x, oy + y, (0, 0, 0, 0))
                    continue
                swirl = math.sin(math.atan2(dy, dx) * 3 + d * 9) * 0.5 + 0.5
                shade = 0.7 + swirl * 0.45
                a = alpha * (1.0 - d * 0.65) * (0.6 + swirl * 0.5)
                img.set(ox + x, oy + y, (base[0] * shade, base[1] * shade, base[2] * shade, a))

    side_panel(0, 0, (128, 122, 112), 150, 205)   # lower funnel: dirty and dense
    cap_panel(32, 0, (140, 134, 124), 170)
    side_panel(0, 32, (170, 168, 168), 95, 150)   # upper funnel: paler and thinner
    cap_panel(32, 32, (180, 178, 178), 110)

    img.save(os.path.join(RP, "textures/entity/natural_disasters/tornado.png"))


def entity_meteor():
    """32x32 atlas: two rock faces, a rock cap, three bumps and a flame halo."""
    img = Image(32, 32)

    def rock(ox, oy, size, base):
        for y in range(size):
            for x in range(size):
                shade = 0.8 + (math.sin(x * 1.3) + math.cos(y * 1.7)) * 0.06
                img.set(ox + x, oy + y, noise((base[0] * shade, base[1] * shade, base[2] * shade, 255), 10))
        # Craters and glowing cracks.
        for _ in range(size // 3):
            cx, cy = random.uniform(2, size - 3), random.uniform(2, size - 3)
            img.disc(ox + cx, oy + cy, random.uniform(1.0, 2.2), (38, 34, 32, 255))
        for _ in range(size // 4):
            x = random.randint(1, size - 2)
            y = random.randint(1, size - 2)
            img.set(ox + x, oy + y, (255, 138, 40, 255))
            img.set(ox + x + 1, oy + y, (200, 80, 20, 255))

    rock(0, 0, 16, (86, 80, 76))    # north / south
    rock(16, 0, 16, (72, 66, 62))   # east / west
    rock(0, 16, 16, (96, 90, 84))   # up / down
    rock(16, 16, 8, (78, 72, 68))   # bump A
    rock(24, 16, 8, (88, 82, 76))   # bump B
    rock(16, 24, 8, (68, 62, 58))   # bump C

    # Flame halo: transparent in the middle, fiery at the edges.
    for y in range(8):
        for x in range(8):
            dx, dy = x - 3.5, y - 3.5
            d = math.hypot(dx, dy) / 4.0
            if d < 0.45 or d > 1.05:
                img.set(24 + x, 24 + y, (0, 0, 0, 0))
                continue
            heat = 1.0 - abs(d - 0.8) / 0.35
            img.set(24 + x, 24 + y, (255, 150 + 90 * heat, 40 + 60 * heat, 150 + 90 * heat))

    img.save(os.path.join(RP, "textures/entity/natural_disasters/meteor.png"))


def entity_wave():
    """32x32 atlas: a 32x16 water wall, a 16x16 side and a 16x16 foam patch."""
    img = Image(32, 32)

    for y in range(16):
        for x in range(32):
            t = y / 15.0
            base = (30 + 40 * t, 90 + 70 * t, 170 + 60 * t)
            ripple = math.sin(x * 0.8 + y * 0.5) * 0.5 + 0.5
            shade = 0.85 + ripple * 0.3
            img.set(x, y, (base[0] * shade, base[1] * shade, base[2] * shade, 215))

    for y in range(16):
        for x in range(16):
            t = y / 15.0
            ripple = math.sin(x * 1.1 + y * 0.9) * 0.5 + 0.5
            img.set(x, 16 + y, (26 + 30 * t, 80 + 60 * t, 160 + 50 * t, int(190 + 40 * ripple)))

    for y in range(16):
        for x in range(16):
            bubble = random.random()
            if bubble < 0.42:
                img.set(16 + x, 16 + y, (245, 252, 255, 235))
            elif bubble < 0.72:
                img.set(16 + x, 16 + y, (205, 232, 250, 200))
            else:
                img.set(16 + x, 16 + y, (150, 200, 240, 120))

    img.save(os.path.join(RP, "textures/entity/natural_disasters/wave.png"))


# ------------------------------------------------------------------ particles


def particle_textures():
    out = os.path.join(RP, "textures/particle")

    # Chunky bit of torn up ground.
    debris = Image(16, 16)
    for y in range(4, 13):
        for x in range(3, 13):
            if random.random() < 0.82:
                debris.set(x, y, noise((110, 92, 68, 255), 24))
    for _ in range(10):
        debris.set(random.randint(3, 12), random.randint(4, 12), noise((70, 56, 40, 255), 14))
    debris.save(os.path.join(out, "nd_debris.png"))

    # Soft round puff used for the funnel core.
    core = Image(16, 16)
    core.disc(7.5, 7.5, 7.5, (255, 255, 255, 255), soft=True)
    core.save(os.path.join(out, "nd_core.png"))

    # Dust cloud: soft, slightly grainy.
    dust = Image(16, 16)
    dust.disc(7.5, 7.5, 7.0, (255, 255, 255, 220), soft=True)
    for _ in range(26):
        x, y = random.randint(2, 13), random.randint(2, 13)
        r, g, b, a = dust.get(x, y)
        dust.set(x, y, (r, g, b, max(0, a - random.randint(30, 90))))
    dust.save(os.path.join(out, "nd_dust.png"))

    # Ember: bright core, fast falloff.
    ember = Image(16, 16)
    ember.disc(7.5, 7.5, 6.5, (255, 200, 120, 190), soft=True)
    ember.disc(7.5, 7.5, 3.2, (255, 255, 235, 255), soft=True)
    ember.save(os.path.join(out, "nd_ember.png"))

    # Water droplet.
    spray = Image(16, 16)
    spray.disc(7.5, 9.0, 4.6, (255, 255, 255, 255), soft=True)
    spray.line(7, 2, 7, 6, (255, 255, 255, 210), 1)
    spray.line(8, 3, 8, 6, (255, 255, 255, 160), 1)
    spray.save(os.path.join(out, "nd_spray.png"))

    # Spark: four pointed star.
    spark = Image(16, 16)
    spark.line(7, 1, 7, 14, (255, 255, 255, 255), 1)
    spark.line(8, 1, 8, 14, (255, 255, 255, 200), 1)
    spark.line(1, 7, 14, 7, (255, 255, 255, 255), 1)
    spark.line(1, 8, 14, 8, (255, 255, 255, 200), 1)
    spark.disc(7.5, 7.5, 3.0, (255, 255, 255, 255), soft=True)
    spark.save(os.path.join(out, "nd_spark.png"))


# ------------------------------------------------------------------ UI icons


def ui_icons():
    out = os.path.join(RP, "textures/ui")

    def frame(img, tint):
        img.rect(0, 0, 32, 32, (28, 30, 36, 255))
        img.rect(1, 1, 31, 31, (48, 52, 62, 255))
        img.rect(2, 2, 30, 30, tint)

    tornado = Image(32, 32)
    frame(tornado, (70, 76, 88, 255))
    for y in range(4, 28):
        t = (y - 4) / 23.0
        half = 1.5 + (1.0 - t) * 10.5
        wobble = math.sin(y * 0.9) * 1.6
        tornado.line(16 - half + wobble, y, 16 + half + wobble, y, (206, 210, 218, 255))
        tornado.line(16 - half + wobble, y, 16 - half + 2 + wobble, y, (150, 156, 168, 255))
    tornado.save(os.path.join(out, "nd_icon_tornado.png"))

    quake = Image(32, 32)
    frame(quake, (72, 58, 42, 255))
    quake.rect(2, 18, 30, 30, (120, 92, 58, 255))
    quake.rect(2, 18, 30, 21, (96, 154, 74, 255))
    zig = [(6, 30), (11, 22), (14, 26), (19, 18), (23, 24), (27, 20)]
    for i in range(len(zig) - 1):
        quake.line(zig[i][0], zig[i][1], zig[i + 1][0], zig[i + 1][1], (32, 26, 20, 255), 2)
    quake.save(os.path.join(out, "nd_icon_earthquake.png"))

    rock = Image(32, 32)
    frame(rock, (34, 36, 52, 255))
    for i in range(14):
        rock.line(2 + i, 2 + i, 6 + i, 6 + i, (255, 170 - i * 6, 60, 220 - i * 12), 2)
    rock.disc(21, 21, 7.5, (96, 88, 82, 255))
    rock.disc(19, 19, 2.2, (58, 52, 48, 255))
    rock.disc(24, 23, 1.6, (58, 52, 48, 255))
    rock.disc(21, 21, 8.5, (255, 140, 40, 90), soft=True)
    rock.save(os.path.join(out, "nd_icon_meteor.png"))

    wave = Image(32, 32)
    frame(wave, (28, 58, 96, 255))
    for y in range(10, 30):
        width = 2 + (y - 10) * 1.4
        wave.line(16 - width, y, 16 + width, y, (46, 120 + y * 2, 200, 255))
    for x in range(4, 28):
        wave.set(x, 12 + math.sin(x * 0.6) * 2, (235, 248, 255, 255))
        wave.set(x, 13 + math.sin(x * 0.6) * 2, (200, 232, 255, 255))
    wave.save(os.path.join(out, "nd_icon_tsunami.png"))

    fire = Image(32, 32)
    frame(fire, (58, 30, 22, 255))
    for y in range(6, 29):
        t = (y - 6) / 22.0
        half = 2 + t * 8
        flicker = math.sin(y * 1.3) * 1.2
        fire.line(16 - half + flicker, y, 16 + half + flicker, y, (255, 90 + t * 60, 20, 255))
    for y in range(14, 29):
        t = (y - 14) / 14.0
        half = 1 + t * 4
        fire.line(16 - half, y, 16 + half, y, (255, 214, 90, 255))
    fire.save(os.path.join(out, "nd_icon_wildfire.png"))

    storm = Image(32, 32)
    frame(storm, (30, 34, 58, 255))
    storm.rect(3, 5, 29, 13, (78, 84, 104, 255))
    storm.rect(5, 3, 27, 9, (104, 110, 132, 255))
    bolt = [(18, 11), (12, 20), (16, 20), (11, 29), (21, 17), (17, 17), (21, 11)]
    for i in range(len(bolt) - 1):
        storm.line(bolt[i][0], bolt[i][1], bolt[i + 1][0], bolt[i + 1][1], (255, 232, 96, 255), 2)
    storm.save(os.path.join(out, "nd_icon_storm.png"))

    dice = Image(32, 32)
    frame(dice, (62, 40, 84, 255))
    dice.rect(7, 7, 25, 25, (226, 220, 236, 255))
    dice.rect(8, 8, 24, 24, (250, 246, 255, 255))
    for cx, cy in ((12, 12), (20, 12), (16, 16), (12, 20), (20, 20)):
        dice.disc(cx, cy, 2.0, (72, 44, 96, 255))
    dice.save(os.path.join(out, "nd_icon_random.png"))

    stop = Image(32, 32)
    frame(stop, (78, 26, 26, 255))
    stop.disc(16, 16, 11.5, (198, 42, 42, 255))
    stop.disc(16, 16, 9.5, (238, 68, 60, 255))
    stop.line(10, 10, 22, 22, (255, 244, 244, 255), 2)
    stop.line(22, 10, 10, 22, (255, 244, 244, 255), 2)
    stop.save(os.path.join(out, "nd_icon_stop.png"))

    gear = Image(32, 32)
    frame(gear, (44, 52, 62, 255))
    gear.disc(16, 16, 11.0, (176, 184, 196, 255))
    for i in range(8):
        angle = i * math.pi / 4
        gear.disc(16 + math.cos(angle) * 11.5, 16 + math.sin(angle) * 11.5, 2.6, (176, 184, 196, 255))
    gear.disc(16, 16, 5.0, (44, 52, 62, 255))
    gear.save(os.path.join(out, "nd_icon_settings.png"))


# ----------------------------------------------------------------- pack icons


def pack_icons():
    img = Image(128, 128)
    # Stormy sky background.
    for y in range(128):
        t = y / 127.0
        for x in range(128):
            img.set(x, y, (26 + 30 * t, 30 + 34 * t, 48 + 40 * t, 255))
    # Ground.
    for y in range(96, 128):
        for x in range(128):
            img.set(x, y, noise((62 + (y - 96), 92 - (y - 96), 48, 255), 6))

    # Funnel.
    for y in range(18, 100):
        t = (y - 18) / 82.0
        half = 3 + (1.0 - t) * 30
        wobble = math.sin(y * 0.12) * 7
        for x in range(int(52 - half + wobble), int(52 + half + wobble)):
            shade = 0.75 + math.sin((x * 0.4 + y * 0.7)) * 0.25
            img.set(x, y, (185 * shade, 189 * shade, 198 * shade, 245))

    # Lightning bolt on the right.
    bolt = [(96, 14), (84, 56), (95, 56), (80, 104), (104, 48), (92, 48), (106, 14)]
    for i in range(len(bolt) - 1):
        img.line(bolt[i][0], bolt[i][1], bolt[i + 1][0], bolt[i + 1][1], (255, 232, 96, 255), 3)

    # Meteor streaking in from the top left.
    for i in range(22):
        img.line(6 + i, 4 + i, 10 + i, 8 + i, (255, 170 - i * 5, 60, 230 - i * 8), 2)
    img.disc(32, 30, 6.0, (110, 100, 92, 255))
    img.disc(32, 30, 8.0, (255, 140, 40, 70), soft=True)

    path_rp = os.path.join(RP, "pack_icon.png")
    path_bp = os.path.join(BP, "pack_icon.png")
    img.save(path_rp)
    img.save(path_bp)


def main():
    item_disaster_wand()
    item_disaster_detector()
    entity_tornado()
    entity_meteor()
    entity_wave()
    particle_textures()
    ui_icons()
    pack_icons()
    print("done")


if __name__ == "__main__":
    main()
