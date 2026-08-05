#!/usr/bin/env python3
"""Paint the Horror Clown's 128x128 entity texture, with no dependencies.

The model uses the standard humanoid UV layout in the top-left 64x64 corner
(so vanilla humanoid animations line up), and puts the clown-only parts - nose,
hair tufts, ruff collar, big shoes - in the free space to the right.
"""

import os
import struct
import zlib

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
BP = os.path.join(ROOT, "HorrorClown_BP")
RP = os.path.join(ROOT, "HorrorClown_RP")

SIZE = 128

FACE = (243, 240, 234, 255)
FACE_S = (206, 200, 196, 255)
BLACK = (16, 13, 19, 255)
EYE_G = (58, 52, 62, 255)
RED = (198, 40, 42, 255)
RED_D = (128, 18, 24, 255)
NOSE = (228, 54, 44, 255)
NOSE_H = (255, 122, 108, 255)
HAIR = (202, 46, 36, 255)
HAIR_D = (146, 28, 24, 255)
SUIT = (86, 40, 130, 255)
SUIT_D = (60, 27, 94, 255)
DOT = (233, 196, 66, 255)
GLOVE = (238, 234, 226, 255)
RUFF = (247, 243, 233, 255)
RUFF_S = (206, 200, 186, 255)
SHOE = (33, 25, 33, 255)
SHOE_R = (150, 26, 30, 255)


# --- PNG output -------------------------------------------------------------

def write_png(path, rows):
    height = len(rows)
    width = len(rows[0])
    raw = bytearray()
    for row in rows:
        raw.append(0)
        for px in row:
            raw.extend(px)

    def chunk(tag, data):
        return (
            struct.pack(">I", len(data))
            + tag
            + data
            + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
        )

    blob = (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0))
        + chunk(b"IDAT", zlib.compress(bytes(raw), 9))
        + chunk(b"IEND", b"")
    )
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "wb") as fh:
        fh.write(blob)
    print("wrote", os.path.relpath(path, os.path.dirname(ROOT)))


# --- tiny drawing helpers ---------------------------------------------------

class Canvas(object):
    def __init__(self, size):
        self.size = size
        self.rows = [[(0, 0, 0, 0)] * size for _ in range(size)]

    def put(self, x, y, colour):
        if 0 <= x < self.size and 0 <= y < self.size:
            row = list(self.rows[y])
            row[x] = colour
            self.rows[y] = row

    def get(self, x, y):
        return self.rows[y][x]

    def fill(self, box, colour):
        x, y, w, h = box
        for yy in range(y, y + h):
            for xx in range(x, x + w):
                self.put(xx, yy, colour)

    def outline(self, box, colour):
        x, y, w, h = box
        for xx in range(x, x + w):
            self.put(xx, y, colour)
            self.put(xx, y + h - 1, colour)
        for yy in range(y, y + h):
            self.put(x, yy, colour)
            self.put(x + w - 1, yy, colour)


class Rand(object):
    """Deterministic LCG - the texture must be identical on every build."""

    def __init__(self, seed):
        self.state = seed

    def next(self, n):
        self.state = (self.state * 1103515245 + 12345) & 0x7FFFFFFF
        return (self.state >> 8) % n


def cube_faces(u, v, w, h, d):
    """UV rectangles for a Bedrock box, matching the box UV unwrap."""
    return {
        "top": (u + d, v, w, d),
        "bottom": (u + d + w, v, w, d),
        "right": (u, v + d, d, h),
        "front": (u + d, v + d, w, h),
        "left": (u + d + w, v + d, d, h),
        "back": (u + d + w + d, v + d, w, h),
    }


def footprint(u, v, w, h, d):
    return (u, v, 2 * d + 2 * w, d + h)


def shade(canvas, box, rng, amount=10):
    """Break up flat fills so the mob does not look like plastic."""
    x, y, w, h = box
    for yy in range(y, y + h):
        for xx in range(x, x + w):
            r, g, b, a = canvas.get(xx, yy)
            if a == 0:
                continue
            k = rng.next(amount * 2 + 1) - amount
            canvas.put(
                xx,
                yy,
                (
                    max(0, min(255, r + k)),
                    max(0, min(255, g + k)),
                    max(0, min(255, b + k)),
                    a,
                ),
            )


# --- the clown ---------------------------------------------------------------

def paint_head(c, rng):
    f = cube_faces(0, 0, 8, 8, 8)
    c.fill(footprint(0, 0, 8, 8, 8), FACE)

    # Wild hair covers the top, the back and the upper edge of both sides.
    c.fill(f["top"], HAIR)
    c.fill(f["back"], HAIR)
    for name in ("right", "left"):
        x, y, w, h = f[name]
        c.fill((x, y, w, 3), HAIR)
    for _ in range(40):
        x, y, w, h = f["top"]
        c.put(x + rng.next(w), y + rng.next(h), HAIR_D)
    for _ in range(24):
        x, y, w, h = f["back"]
        c.put(x + rng.next(w), y + rng.next(h), HAIR_D)

    # Face. Local (0,0) is the top-left of the front face.
    fx, fy, _, _ = f["front"]

    def p(lx, ly, colour):
        c.put(fx + lx, fy + ly, colour)

    # Sunken eyes, two by two, with a bruised socket around them.
    for lx in (1, 2, 5, 6):
        for ly in (1, 2):
            p(lx, ly, BLACK)
    for lx in (1, 2, 5, 6):
        p(lx, 0, EYE_G)
    p(0, 1, EYE_G)
    p(3, 1, EYE_G)
    p(4, 1, EYE_G)
    p(7, 1, EYE_G)
    # A single pinprick pupil in each eye - the "it has seen you" detail.
    p(2, 1, (236, 232, 240, 255))
    p(5, 1, (236, 232, 240, 255))

    # Red greasepaint running down from the eyes past the nose.
    for ly in (3, 4, 5):
        p(1, ly, RED)
        p(6, ly, RED)

    # The grin: corners hooked upward, far too wide for the face.
    p(0, 5, RED_D)
    p(7, 5, RED_D)
    for lx in range(1, 7):
        p(lx, 6, RED_D)
    for lx in range(2, 6):
        p(lx, 7, RED_D)
    # Teeth.
    p(2, 6, FACE)
    p(4, 6, FACE)
    p(6, 6, FACE)

    # Cheek shadow on the sides so the head reads as a skull, not a ball.
    for name in ("right", "left"):
        x, y, w, h = f[name]
        c.fill((x, y + h - 2, w, 2), FACE_S)


def paint_body(c, rng):
    f = cube_faces(16, 16, 8, 12, 4)
    c.fill(footprint(16, 16, 8, 12, 4), SUIT)
    c.fill(f["back"], SUIT_D)
    c.fill(f["right"], SUIT_D)

    # Polka dots, placed by a fixed seed so every build matches.
    for face in ("front", "back", "left", "right"):
        x, y, w, h = f[face]
        for _ in range(6):
            dx = x + 1 + rng.next(max(1, w - 2))
            dy = y + 1 + rng.next(max(1, h - 2))
            c.put(dx, dy, DOT)
            c.put(dx - 1, dy, DOT)
            c.put(dx, dy - 1, DOT)

    # Three buttons down the front.
    fx, fy, _, _ = f["front"]
    for i, ly in enumerate((2, 5, 8)):
        c.put(fx + 3, fy + ly, DOT if i != 1 else RED)
        c.put(fx + 4, fy + ly, DOT if i != 1 else RED)


def paint_arm(c, u, v, rng):
    f = cube_faces(u, v, 4, 12, 4)
    c.fill(footprint(u, v, 4, 12, 4), SUIT)
    c.fill(f["back"], SUIT_D)
    # White glove at the wrist.
    for face in ("front", "back", "left", "right"):
        x, y, w, h = f[face]
        c.fill((x, y + h - 3, w, 3), GLOVE)
        c.put(x, y + h - 4, DOT)
    x, y, w, h = f["bottom"]
    c.fill((x, y, w, h), GLOVE)
    for _ in range(4):
        x, y, w, h = f["front"]
        c.put(x + rng.next(w), y + rng.next(h - 4), DOT)


def paint_leg(c, u, v, rng):
    f = cube_faces(u, v, 4, 12, 4)
    c.fill(footprint(u, v, 4, 12, 4), SUIT_D)
    for face in ("front", "back", "left", "right"):
        x, y, w, h = f[face]
        c.fill((x, y + h - 2, w, 2), SHOE)
        for _ in range(3):
            c.put(x + rng.next(w), y + rng.next(h - 3), DOT)


def paint_extras(c, rng):
    # Nose - 2x2x2 at uv (64, 0).
    c.fill(footprint(64, 0, 2, 2, 2), NOSE)
    nf = cube_faces(64, 0, 2, 2, 2)
    x, y, _, _ = nf["front"]
    c.put(x, y, NOSE_H)

    # Hair tuft - 3x3x3 at uv (64, 8), used twice (one mirrored).
    c.fill(footprint(64, 8, 3, 3, 3), HAIR)
    hf = cube_faces(64, 8, 3, 3, 3)
    for face in ("front", "back", "left", "right", "top"):
        x, y, w, h = hf[face]
        for _ in range(4):
            c.put(x + rng.next(w), y + rng.next(h), HAIR_D)

    # Big shoe - 6x3x8 at uv (64, 16), used twice (one mirrored).
    c.fill(footprint(64, 16, 6, 3, 8), SHOE)
    sf = cube_faces(64, 16, 6, 3, 8)
    for face in ("front", "left", "right"):
        x, y, w, h = sf[face]
        c.fill((x, y, w, 1), SHOE_R)
    x, y, w, h = sf["top"]
    c.fill((x, y, w, 2), SHOE_R)

    # Ruff collar - 12x2x8 at uv (64, 32).
    c.fill(footprint(64, 32, 12, 2, 8), RUFF)
    rf = cube_faces(64, 32, 12, 2, 8)
    x, y, w, h = rf["top"]
    for xx in range(x, x + w, 2):
        c.fill((xx, y, 1, h), RUFF_S)
    for face in ("front", "back", "left", "right"):
        x, y, w, h = rf[face]
        c.fill((x, y + h - 1, w, 1), DOT)


def build_texture():
    c = Canvas(SIZE)
    rng = Rand(20250805)
    paint_head(c, rng)
    paint_body(c, rng)
    paint_arm(c, 40, 16, rng)   # right arm
    paint_arm(c, 32, 48, rng)   # left arm
    paint_leg(c, 0, 16, rng)    # right leg
    paint_leg(c, 16, 48, rng)   # left leg
    paint_extras(c, rng)

    grain = Rand(777)
    shade(c, (0, 0, SIZE, SIZE), grain, 7)
    return c


def scale(rows, factor):
    out = []
    for row in rows:
        big = []
        for px in row:
            big.extend([px] * factor)
        out.extend([big] * factor)
    return out


def main():
    c = build_texture()
    write_png(os.path.join(RP, "textures", "entity", "ssgm_clown.png"), c.rows)

    # Pack icons: the face, blown up on a black background.
    face = [row[8:16] for row in c.rows[8:16]]
    icon = scale(face, 8)
    icon = [[(p[0], p[1], p[2], 255) if p[3] else (10, 8, 12, 255) for p in row] for row in icon]
    write_png(os.path.join(RP, "pack_icon.png"), icon)
    write_png(os.path.join(BP, "pack_icon.png"), icon)


if __name__ == "__main__":
    main()
