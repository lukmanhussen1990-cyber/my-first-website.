"""Generates the entity textures and pack icons (needs Pillow).

Textures are drawn at 2x the resolution declared in the geometry files, which
Bedrock scales automatically. Both mobs use the `entity_emissive_alpha`
material, so pixels with a LOW alpha value glow in the dark (eyes and teeth).
"""
import os
import random

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RP = os.path.join(ROOT, "UrbanLegends_RP")
BP = os.path.join(ROOT, "UrbanLegends_BP")
S = 2  # texture scale

GLOW_WHITE = (255, 255, 255, 18)
TEETH = (242, 236, 216, 70)
GUM = (88, 4, 4, 255)
MOUTH = (18, 0, 0, 255)


class Canvas:
    def __init__(self, w, h, seed, base):
        self.img = Image.new("RGBA", (w * S, h * S), (0, 0, 0, 255))
        self.px = self.img.load()
        self.rnd = random.Random(seed)
        self.base = base
        self.fill(0, 0, w, h, lambda lx, ly: self.noise(base))

    def noise(self, c, amount=3):
        n = self.rnd.randint(-amount, amount)
        return (max(0, min(255, c[0] + n)), max(0, min(255, c[1] + n)), max(0, min(255, c[2] + n)), 255)

    def put(self, x, y, c):
        w, h = self.img.size
        if 0 <= x < w and 0 <= y < h:
            self.px[x, y] = c if len(c) == 4 else (*c, 255)

    def fill(self, u, v, w, h, fn):
        """Fill a region given in *declared* texture units; fn gets 2x-local pixel coords."""
        for ly in range(int(h * S)):
            for lx in range(int(w * S)):
                self.put(int(u * S) + lx, int(v * S) + ly, fn(lx, ly))

    def save(self, path):
        os.makedirs(os.path.dirname(path), exist_ok=True)
        self.img.save(path)


def box_faces(u, v, w, h, d):
    """Bedrock box-UV layout (declared units): name -> (u, v, width, height)."""
    return {
        "top": (u + d, v, w, d), "bottom": (u + d + w, v, w, d),
        "right": (u, v + d, d, h), "front": (u + d, v + d, w, h),
        "left": (u + d + w, v + d, d, h), "back": (u + 2 * d + w, v + d, w, h),
    }


def draw_grin(put, x0, y0, width, face_h, teeth_period=3):
    """A too-wide grin. (x0, y0) = top-left of the strip in image pixels."""
    half = width / 2.0
    for i in range(width):
        s = (i + 0.5 - half) / half
        yc = face_h * 0.69 - face_h * 0.2 * s * s
        hh = face_h * 0.15 * (1 - s * s) + 0.7
        for fy in range(face_h):
            dy = (fy + 0.5) - yc
            if abs(dy) > hh + 0.7:
                continue
            if abs(dy) > hh or hh < 1.3:
                c = GUM
            elif dy < -hh + 1.4:
                c = TEETH if i % teeth_period != teeth_period - 1 else GUM
            elif dy > hh - 1.4:
                c = TEETH if (i + 1) % teeth_period != teeth_period - 1 else GUM
            else:
                c = MOUTH
            put(x0 + i, y0 + fy, c)


def draw_eyes(put, x0, y0, face_w):
    """Two glowing, smiling '^ ^' eyes on a face that is face_w pixels wide."""
    k = face_w / 16.0
    for cx in (4.5, 11.5):
        for dx, dy in ((-0.5, 0), (0.5, 0), (-1.5, 1), (1.5, 1)):
            for sx in range(max(1, int(k))):
                for sy in range(max(1, int(k))):
                    put(int(x0 + (cx + dx) * k) + sx, int(y0 + (4 + dy) * k) + sy, GLOW_WHITE)


def grinning_man():
    c = Canvas(64, 64, 1337, (13, 13, 16))
    head = box_faces(0, 0, 8, 8, 8)
    fu, fv = head["front"][0] * S, head["front"][1] * S
    # dark eye sockets, then glowing eyes, then the grin wrapping onto both cheeks
    c.fill(9.5, 9.5, 2.5, 1.5, lambda lx, ly: (5, 5, 7, 255))
    c.fill(12.5, 9.5, 2.5, 1.5, lambda lx, ly: (5, 5, 7, 255))
    draw_eyes(c.put, fu, fv, 8 * S)
    draw_grin(c.put, fu - 6, fv, 8 * S + 12, 8 * S)

    body = box_faces(32, 0, 7, 13, 3)
    bu, bv, bw, bh = body["front"]

    def ribs(lx, ly):
        mid = abs(lx + 0.5 - bw) / bw  # 0 at the sternum, 1 at the sides
        for rib_y in (4, 8, 12, 16):
            if lx not in (6, 7) and int(rib_y + mid * 2) == ly:
                return (34, 32, 38, 255)
        if ly >= 20:
            return c.noise((7, 7, 9))
        return c.noise(c.base)
    c.fill(bu, bv, bw, bh, ribs)
    ku, kv, kw, kh = body["back"]
    c.fill(ku, kv, kw, kh, lambda lx, ly: (30, 29, 34, 255) if lx in (6, 7) and ly % 3 == 0 else c.noise(c.base))

    # knobbly knees and elbows on the thin limbs
    for u, length in ((0, 24), (8, 24), (16, 25), (24, 25)):
        for name in ("right", "front", "left", "back"):
            fu2, fv2, fw2, fh2 = box_faces(u, 16, 2, length, 2)[name]
            c.fill(fu2, fv2 + 12, fw2, 1, lambda lx, ly: (27, 27, 32, 255) if ly == 0 else (6, 6, 8, 255))

    # bony claw tips on the fingers
    for name in ("right", "front", "left", "back"):
        fu2, fv2, fw2, fh2 = box_faces(32, 16, 1, 7, 1)[name]

        def claw(lx, ly):
            if ly >= 12:
                return (205, 196, 180, 255)
            if ly >= 9:
                return (150, 142, 128, 255)
            return c.noise((15, 15, 18))
        c.fill(fu2, fv2, fw2, fh2, claw)
    bu2, bv2, _, _ = box_faces(32, 16, 1, 7, 1)["bottom"]
    c.fill(bu2, bv2, 1, 1, lambda lx, ly: (205, 196, 180, 255))
    c.save(os.path.join(RP, "textures", "entity", "grinning_man.png"))


def parasite():
    flesh = (201, 163, 155)
    c = Canvas(32, 32, 666, flesh)
    rnd = c.rnd

    def fleshy(lx, ly, base=flesh, seg=3):
        if ly % seg == seg - 1:
            return (122, 62, 60, 255)
        if rnd.random() < 0.08:
            return (128, 18, 18, 255)  # veins
        return c.noise(base, 8)

    t = box_faces(0, 0, 4, 2, 5)
    c.fill(*t["top"], lambda lx, ly: (228, 198, 190, 255) if lx in (3, 4) and ly % 3 != 2 else fleshy(lx, ly))
    c.fill(*t["bottom"], lambda lx, ly: fleshy(lx, ly, (215, 186, 176)))
    for name in ("right", "front", "left", "back"):
        c.fill(*t[name], lambda lx, ly: (120, 80, 76, 255) if ly == 3 else c.noise((165, 122, 114), 6))

    a = box_faces(0, 7, 3, 2, 3)
    c.fill(*a["top"], lambda lx, ly: (140, 20, 20, 255) if rnd.random() < 0.18 else c.noise((214, 170, 160), 8))
    for name in ("right", "front", "left", "back", "bottom"):
        c.fill(*a[name], lambda lx, ly: c.noise((160, 110, 104), 6))
    c.fill(12, 7, 6, 3, lambda lx, ly: c.noise((112, 30, 30), 6))  # tail tip

    c.fill(18, 0, 10, 4, lambda lx, ly: c.noise((92, 36, 36), 5))  # head
    hu, hv = box_faces(18, 0, 3, 2, 2)["front"][:2]
    for ex, ey in ((1, 1), (4, 1), (2, 0), (3, 0)):
        c.put(int(hu * S) + ex, int(hv * S) + ey, (255, 36, 24, 22))

    c.fill(18, 4, 6, 3, lambda lx, ly: c.noise((230, 217, 184), 6))  # mandibles
    mu, mv = box_faces(18, 4, 1, 1, 2)["front"][:2]
    c.fill(mu, mv, 1, 1, lambda lx, ly: (60, 28, 20, 255))

    c.fill(0, 12, 8, 2, lambda lx, ly: (190, 160, 150, 255) if lx % 6 in (2, 3) else c.noise((74, 28, 28), 5))
    c.save(os.path.join(RP, "textures", "entity", "parasite.png"))


def pack_icon():
    size = 32
    img = Image.new("RGBA", (size, size), (0, 0, 0, 255))
    px = img.load()
    for y in range(size):
        for x in range(size):
            d = ((x - 15.5) ** 2 + (y - 15.5) ** 2) ** 0.5 / 22.0
            r = int(70 * min(1.0, d))
            px[x, y] = (r, 0, 0, 255)
    for y in range(3, 30):
        for x in range(5, 27):
            if ((x - 15.5) / 11.0) ** 2 + ((y - 16.5) / 13.5) ** 2 <= 1.0:
                px[x, y] = (10, 10, 12, 255)

    def put(x, y, col):
        if 0 <= x < size and 0 <= y < size:
            px[x, y] = (col[0], col[1], col[2], 255)
    draw_eyes(put, 8, 4, 16)
    draw_grin(put, 5, 5, 22, 20, teeth_period=3)
    img = img.resize((128, 128), Image.NEAREST)
    for pack in (RP, BP):
        img.save(os.path.join(pack, "pack_icon.png"))


if __name__ == "__main__":
    grinning_man()
    parasite()
    pack_icon()
    print("entity textures + pack icons written")
