#!/usr/bin/env python3
"""
Generates the 64x64 entity textures and the pack icons for the
"Devil vs Angel" Bedrock add-on. Pure standard library - no Pillow needed.

Every cube in the models is unwrapped by Minecraft in the same fixed layout,
so faces() reproduces that layout from a cube's uv + size and each face gets
its own shading. That is what makes the model read as a solid shape in game
instead of as flat noise.

Run:  python3 tools/make_textures.py
"""

import os
import random
import struct
import zlib

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
ENT = os.path.join(ROOT, "addon", "RP", "textures", "entity")

# Alpha 1 instead of 255 marks a pixel as "emissive" for the
# entity_emissive_alpha material, so it glows in the dark.
GLOW = 1

# How bright each face of a cube is painted.
SHADE = {
    "up": 1.15,
    "down": 0.50,
    "north": 0.95,
    "south": 0.78,
    "east": 0.68,
    "west": 0.86,
}


def faces(u, v, w, h, d):
    """Rects of the six faces of a cube with uv [u,v] and size [w,h,d]."""
    return {
        "up":    (u + d,           v,     u + d + w,       v + d),
        "down":  (u + d + w,       v,     u + d + 2 * w,   v + d),
        "east":  (u,               v + d, u + d,           v + d + h),
        "north": (u + d,           v + d, u + d + w,       v + d + h),
        "west":  (u + d + w,       v + d, u + 2 * d + w,   v + d + h),
        "south": (u + 2 * d + w,   v + d, u + 2 * d + 2 * w, v + d + h),
    }


def tint(color, factor, jitter=0, rng=None):
    r, g, b, a = color
    j = rng.randint(-jitter, jitter) if jitter and rng else 0
    scale = lambda v: max(0, min(255, int(v * factor) + j))
    return (scale(r), scale(g), scale(b), a)


class Canvas:
    def __init__(self, w, h):
        self.w = w
        self.h = h
        self.px = [[(0, 0, 0, 0)] * w for _ in range(h)]

    def set(self, x, y, color):
        if 0 <= x < self.w and 0 <= y < self.h:
            self.px[y][x] = color

    def rect(self, x0, y0, x1, y1, color):
        for y in range(y0, y1):
            for x in range(x0, x1):
                self.set(x, y, color)

    def box(self, uv, size, base, rng, jitter=6, skip=()):
        """Paint every face of one cube with its own shading."""
        rects = faces(uv[0], uv[1], *size)
        for name, (x0, y0, x1, y1) in rects.items():
            if name in skip:
                continue
            factor = SHADE[name]
            for y in range(y0, y1):
                for x in range(x0, x1):
                    self.set(x, y, tint(base, factor, jitter, rng))
        return rects

    def speckle(self, rect, color, count, rng):
        x0, y0, x1, y1 = rect
        for _ in range(count):
            self.set(rng.randrange(x0, x1), rng.randrange(y0, y1), color)

    def crack(self, rect, color, count, rng):
        """Short jagged glowing seams inside a face."""
        x0, y0, x1, y1 = rect
        for _ in range(count):
            x = rng.randrange(x0, x1)
            y = rng.randrange(y0, y1)
            for _ in range(rng.randint(2, 5)):
                self.set(x, y, color)
                x += rng.choice((-1, 0, 0, 1))
                y += 1
                if not (x0 <= x < x1 and y0 <= y < y1):
                    break

    def save(self, path):
        raw = b""
        for row in self.px:
            raw += b"\x00" + b"".join(struct.pack("4B", *p) for p in row)

        def chunk(tag, data):
            body = tag + data
            return (struct.pack(">I", len(data)) + body
                    + struct.pack(">I", zlib.crc32(body) & 0xFFFFFFFF))

        png = b"\x89PNG\r\n\x1a\n"
        png += chunk(b"IHDR", struct.pack(">IIBBBBB", self.w, self.h, 8, 6, 0, 0, 0))
        png += chunk(b"IDAT", zlib.compress(raw, 9))
        png += chunk(b"IEND", b"")
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "wb") as fh:
            fh.write(png)
        print("wrote", os.path.relpath(path, ROOT))


# --------------------------------------------------------------------------
#  DEVIL
# --------------------------------------------------------------------------
def devil():
    rng = random.Random(6660)
    c = Canvas(64, 64)

    hide  = (58, 17, 17, 255)     # main hide
    head  = (52, 16, 16, 255)
    limb  = (46, 14, 14, 255)
    wing  = (44, 13, 14, 255)
    horn  = (48, 41, 38, 255)
    ember = (255, 108, 16, GLOW)
    hot   = (255, 186, 52, GLOW)
    eye   = (255, 238, 88, GLOW)
    dark  = (20, 8, 8, 255)
    claw  = (16, 13, 13, 255)

    # ---- head -------------------------------------------------------------
    hf = c.box((0, 0), (8, 8, 8), head, rng, jitter=5)
    fx0, fy0, fx1, fy1 = hf["north"]          # 8,8 -> 16,16

    # heavy brow ridge casting the eyes into shadow
    c.rect(fx0, fy0 + 1, fx1, fy0 + 3, dark)
    # eyes
    for ex in (fx0 + 1, fx0 + 5):
        c.rect(ex, fy0 + 3, ex + 2, fy0 + 4, eye)
        c.rect(ex, fy0 + 4, ex + 2, fy0 + 5, ember)
    # bridge of the snout between the eyes
    c.rect(fx0 + 3, fy0 + 3, fx0 + 5, fy0 + 6, tint(head, 0.6))
    # jagged grin
    c.rect(fx0, fy0 + 6, fx1, fy0 + 7, dark)
    for i in range(0, 8, 2):
        c.set(fx0 + i, fy0 + 6, hot)
    c.rect(fx0, fy0 + 7, fx1, fy0 + 8, tint(head, 0.45))
    # ember seams around the skull
    for name in ("east", "west", "south", "up"):
        c.crack(hf[name], ember, 4, rng)

    # ---- horns ------------------------------------------------------------
    hr = c.box((32, 0), (2, 5, 2), horn, rng, jitter=8)
    for name in ("north", "south", "east", "west"):
        x0, y0, x1, y1 = hr[name]
        c.rect(x0, y0, x1, y0 + 1, tint(horn, 1.5))     # pale bony tip
        c.rect(x0, y1 - 1, x1, y1, dark)                # dark root

    # ---- tail -------------------------------------------------------------
    tf = c.box((42, 0), (2, 2, 8), hide, rng, jitter=5)
    for name in ("east", "west"):
        x0, y0, x1, y1 = tf[name]
        c.rect(x1 - 3, y0, x1, y1, hot)                 # burning barb
    for name in ("north",):
        x0, y0, x1, y1 = tf[name]
        c.rect(x0, y0, x1, y1, hot)

    # ---- body -------------------------------------------------------------
    bf = c.box((16, 16), (8, 12, 4), hide, rng, jitter=5)
    x0, y0, x1, y1 = bf["north"]
    # glowing ribcage
    for i, y in enumerate(range(y0 + 2, y0 + 9, 2)):
        inset = 1 + i // 2
        c.rect(x0 + inset, y, x1 - inset, y + 1, ember)
    c.rect(x0 + 3, y0 + 4, x0 + 5, y0 + 7, hot)         # burning heart
    c.crack(bf["south"], ember, 5, rng)

    # ---- arms -------------------------------------------------------------
    af = c.box((40, 16), (4, 12, 4), limb, rng, jitter=5)
    for name in ("north", "south", "east", "west"):
        x0, y0, x1, y1 = af[name]
        c.rect(x0, y1 - 2, x1, y1, claw)                # claws
        c.crack((x0, y0, x1, y1 - 2), ember, 2, rng)
    c.rect(*af["down"][:2], af["down"][2], af["down"][3], claw)

    # ---- legs -------------------------------------------------------------
    lf = c.box((0, 16), (4, 12, 4), limb, rng, jitter=5)
    for name in ("north", "south", "east", "west"):
        x0, y0, x1, y1 = lf[name]
        c.rect(x0, y1 - 2, x1, y1, claw)                # hooves
        c.crack((x0, y0, x1, y1 - 2), ember, 2, rng)
    c.rect(*lf["down"][:2], lf["down"][2], lf["down"][3], claw)

    # ---- wings ------------------------------------------------------------
    wf = c.box((0, 40), (1, 11, 12), wing, rng, jitter=4)
    for name in ("east", "west"):
        x0, y0, x1, y1 = wf[name]
        # bat-wing finger bones running down the membrane
        for bone in range(x0 + 1, x1, 3):
            for y in range(y0, y1):
                c.set(bone, y, tint(wing, 1.9))
        # scalloped, singed trailing edge
        for x in range(x0, x1):
            c.set(x, y1 - 1, dark)
            if x % 2 == 0:
                c.set(x, y1 - 2, ember)
        c.crack((x0, y0, x1, y1 - 2), ember, 3, rng)

    c.save(os.path.join(ENT, "devil.png"))


# --------------------------------------------------------------------------
#  ANGEL
# --------------------------------------------------------------------------
def angel():
    rng = random.Random(777)
    c = Canvas(64, 64)

    skin  = (240, 232, 216, 255)
    robe  = (236, 238, 248, 255)
    hair  = (250, 238, 190, 255)
    gold  = (226, 182, 76, 255)
    glow  = (255, 232, 138, GLOW)
    eye   = (176, 238, 255, GLOW)
    wingc = (250, 250, 252, 255)
    halo  = (255, 240, 160, GLOW)
    shade = (196, 200, 214, 255)

    # ---- head -------------------------------------------------------------
    hf = c.box((0, 0), (8, 8, 8), skin, rng, jitter=4)
    # hair over the top and the back of the head
    for name in ("up", "south"):
        x0, y0, x1, y1 = hf[name]
        c.rect(x0, y0, x1, y1, tint(hair, SHADE[name], 4, rng))
    for name in ("east", "west"):
        x0, y0, x1, y1 = hf[name]
        c.rect(x0, y0, x1, y0 + 3, tint(hair, SHADE[name], 4, rng))

    fx0, fy0, fx1, fy1 = hf["north"]
    c.rect(fx0, fy0, fx1, fy0 + 2, tint(hair, 0.95, 3, rng))   # fringe
    c.rect(fx0 + 2, fy0 + 1, fx0 + 6, fy0 + 2, glow)           # forehead mark
    for ex in (fx0 + 1, fx0 + 5):
        c.rect(ex, fy0 + 3, ex + 2, fy0 + 4, eye)
    c.rect(fx0 + 3, fy0 + 6, fx0 + 5, fy0 + 7, shade)          # calm mouth

    # ---- halo (both bar shapes) -------------------------------------------
    for uv, size in (((36, 0), (8, 1, 1)), ((36, 4), (1, 1, 6))):
        rects = faces(uv[0], uv[1], *size)
        for x0, y0, x1, y1 in rects.values():
            c.rect(x0, y0, x1, y1, halo)

    # ---- body: a robe with gold collar and hem -----------------------------
    bf = c.box((16, 16), (8, 12, 4), robe, rng, jitter=4)
    for name in ("north", "south", "east", "west"):
        x0, y0, x1, y1 = bf[name]
        c.rect(x0, y0, x1, y0 + 1, tint(skin, SHADE[name]))    # neck / shoulders
        c.rect(x0, y0 + 1, x1, y0 + 2, gold)                   # collar
        c.rect(x0, y1 - 1, x1, y1, gold)                       # hem
    x0, y0, x1, y1 = bf["north"]
    c.rect(x0 + 3, y0 + 4, x0 + 5, y0 + 9, glow)               # sigil, vertical
    c.rect(x0 + 2, y0 + 5, x0 + 6, y0 + 6, glow)               # sigil, crossbar

    # ---- arms --------------------------------------------------------------
    af = c.box((40, 16), (4, 12, 4), robe, rng, jitter=4)
    for name in ("north", "south", "east", "west"):
        x0, y0, x1, y1 = af[name]
        c.rect(x0, y1 - 4, x1, y1 - 3, gold)                   # cuff
        c.rect(x0, y1 - 3, x1, y1, tint(skin, SHADE[name]))    # bare hand

    # ---- legs --------------------------------------------------------------
    lf = c.box((0, 16), (4, 12, 4), robe, rng, jitter=4)
    for name in ("north", "south", "east", "west"):
        x0, y0, x1, y1 = lf[name]
        c.rect(x0, y0 + 5, x1, y0 + 6, gold)                   # lower hem
        c.rect(x0, y0 + 6, x1, y1, tint(skin, SHADE[name], 3, rng))  # bare leg

    # ---- wings -------------------------------------------------------------
    wf = c.box((0, 34), (1, 14, 14), wingc, rng, jitter=3)
    for name in ("east", "west"):
        x0, y0, x1, y1 = wf[name]
        # three rows of feathers, longest at the trailing edge
        for row, ystart in enumerate(range(y0, y1, 5)):
            for x in range(x0, x1):
                c.set(x, ystart, shade)
                if (x - x0) % 3 == 0:
                    for y in range(ystart, min(ystart + 5, y1)):
                        c.set(x, y, tint(shade, 1.05))
        c.rect(x0, y1 - 1, x1, y1, gold)                       # gilded tips

    c.save(os.path.join(ENT, "angel.png"))


# --------------------------------------------------------------------------
#  PACK ICONS
# --------------------------------------------------------------------------
def pack_icon(path, seed):
    rng = random.Random(seed)
    c = Canvas(64, 64)
    for y in range(64):
        for x in range(32):                       # left half: hellfire
            t = y / 63.0
            c.set(x, y, (int(28 + 205 * t), int(6 + 74 * t), 8, 255))
        for x in range(32, 64):                   # right half: heaven
            t = 1.0 - y / 63.0
            c.set(x, y, (int(190 + 62 * t), int(200 + 52 * t), int(216 + 38 * t), 255))
    for i in range(10):                           # horn
        c.rect(6 + i, 22 - i, 10 + i, 26 - i, (26, 10, 10, 255))
    c.rect(38, 16, 58, 20, (255, 226, 120, 255))  # halo
    for _ in range(70):
        c.set(rng.randrange(0, 32), rng.randrange(0, 64), (255, 170, 40, 255))
    for _ in range(50):
        c.set(rng.randrange(32, 64), rng.randrange(0, 64), (255, 255, 255, 255))
    c.save(path)


if __name__ == "__main__":
    devil()
    angel()
    pack_icon(os.path.join(ROOT, "addon", "BP", "pack_icon.png"), 1)
    pack_icon(os.path.join(ROOT, "addon", "RP", "pack_icon.png"), 2)
