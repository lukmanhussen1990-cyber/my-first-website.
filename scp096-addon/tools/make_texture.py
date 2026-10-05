#!/usr/bin/env python3
"""Paint the SCP-096 texture (128x128 RGBA, deterministic) from the cube table in make_model.py.

Every cube face is painted on its own canvas that is oriented the way a viewer sees the face from
outside (make_model.CANVAS_AXES), then blitted into the UV rectangle that make_model assigned.
Because the UV layout comes from make_model.build_model(), painted features can never drift away
from the geometry.

Run:  python3 tools/make_texture.py            -> SCP096_RP/textures/entity/scp096.png
"""
from __future__ import annotations

import os
import sys
import zlib

import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import make_model as M  # noqa: E402

OUT_PATH = os.path.join(M.ROOT, "SCP096_RP", "textures", "entity", "scp096.png")
SEED = 96096

# ----------------------------------------------------------------------------- palette
SKIN = np.array([238.0, 234.0, 224.0])        # very pale, faint warm/yellow-grey
SKIN_COOL = np.array([226.0, 230.0, 236.0])   # shadow tint (faint cool grey)
VEIN = np.array([170.0, 186.0, 204.0])        # faint blue-grey
WHITE = np.array([255.0, 255.0, 255.0])
SOCKET_D = np.array([86.0, 88.0, 102.0])
SOCKET_M = np.array([122.0, 124.0, 138.0])
SOCKET_L = np.array([176.0, 178.0, 190.0])
LIP = np.array([218.0, 206.0, 208.0])         # thin pale mauve-grey lips
MOUTH_LINE = np.array([66.0, 44.0, 50.0])
CRACK = np.array([150.0, 140.0, 144.0])
CAV_DARK = np.array([22.0, 5.0, 9.0])         # dark red-black inner mouth
CAV_MID = np.array([66.0, 14.0, 22.0])
CAV_RED = np.array([112.0, 30.0, 42.0])
GUM = np.array([168.0, 108.0, 112.0])
TOOTH = np.array([212.0, 208.0, 192.0])
TOOTH_DARK = np.array([176.0, 172.0, 156.0])
NAIL = np.array([190.0, 178.0, 166.0])

FACE_LIGHT = {"up": 1.04, "north": 1.0, "south": 0.95, "west": 0.90, "east": 0.90, "down": 0.74}


def _seed_for(*parts):
    return zlib.crc32(("|".join(str(p) for p in parts)).encode()) ^ SEED


# ----------------------------------------------------------------------------- canvas helpers
def face_shape(c, face):
    w, h, d = c["size"]
    return {"north": (h, w), "south": (h, w), "west": (h, d), "east": (h, d), "up": (d, w), "down": (d, w)}[face]


def skin_canvas(shape, face, rng, tone=1.0, noise=2.0, vgrad=0.0):
    """Pale skin with per-face fake lighting, value noise and a faint cool tint in shadow."""
    h, w = shape
    f = FACE_LIGHT[face]
    base = SKIN * tone
    cv = np.empty((h, w, 3))
    cv[:] = base
    # vertical gradient (slightly darker towards the bottom of tall faces)
    if vgrad and h > 1:
        g = 1.0 - vgrad * (np.arange(h)[:, None] / (h - 1))
        cv *= g[..., None]
    cv = cv * f
    if f < 1:  # shadow tint: drift towards a faint cool grey
        k = (1 - f) * 0.6
        cv = cv * (1 - k) + cv * (SKIN_COOL / SKIN) * k
    # value noise: texel-level + 2x2 cells
    n1 = rng.normal(0, noise, (h, w))
    cells = rng.normal(0, noise * 0.8, ((h + 1) // 2, (w + 1) // 2))
    n2 = np.kron(cells, np.ones((2, 2)))[:h, :w]
    cv += (n1 + n2)[..., None]
    return cv


def put(cv, r, c, color, a=1.0):
    h, w = cv.shape[:2]
    if 0 <= r < h and 0 <= c < w:
        cv[r, c] = cv[r, c] * (1 - a) + np.asarray(color, dtype=float) * a


def hline(cv, r, c0, c1, color, a=1.0):
    for c in range(c0, c1 + 1):
        put(cv, r, c, color, a)


def vline(cv, c, r0, r1, color, a=1.0):
    for r in range(r0, r1 + 1):
        put(cv, r, c, color, a)


def shade_px(cv, r, c, k):
    h, w = cv.shape[:2]
    if 0 <= r < h and 0 <= c < w:
        cv[r, c] = cv[r, c] * k


def vein(cv, rng, vertical=True, length=(4, 9), a=0.42, color=VEIN):
    h, w = cv.shape[:2]
    L = int(rng.integers(length[0], length[1] + 1))
    if vertical:
        c = int(rng.integers(0, w))
        r = int(rng.integers(0, max(1, h - 2)))
        for _ in range(L):
            put(cv, r, c, color, a)
            r += 1
            c = int(np.clip(c + rng.choice([-1, 0, 0, 0, 1]), 0, w - 1))
            if r >= h:
                break
    else:
        r = int(rng.integers(0, h))
        c = int(rng.integers(0, max(1, w - 2)))
        for _ in range(L):
            put(cv, r, c, color, a)
            c += 1
            r = int(np.clip(r + rng.choice([-1, 0, 0, 0, 1]), 0, h - 1))
            if c >= w:
                break


def bevel(cv, k=0.035):
    """Subtle pixel-art edge definition: top edge lighter, bottom edge darker."""
    h, w = cv.shape[:2]
    if h >= 3 and w >= 2:
        cv[0] *= 1 + k
        cv[-1] *= 1 - k * 1.4


# ----------------------------------------------------------------------------- per-kind painters
def paint_generic_limb(c, cv, rng, veins=1, vertical=True):
    for fn in ("north", "south", "west", "east"):
        for _ in range(veins):
            if rng.random() < 0.75:
                vein(cv[fn], rng, vertical=vertical)
        bevel(cv[fn], 0.02)


# face rows of the cranium's north face (7 cols x 7 rows, row 0 = top = y 45..44)
R_FOREHEAD, R_BROW, R_SHADOW, R_EYES, R_BAG, R_LIP = 0, 1, 2, (3, 4), 5, 6
EYE_COLS = (1, 2, 4, 5)


def paint_cranium(c, cv, rng):
    """Face layout (north face, 7 cols x 7 rows):
         r0 bald forehead   r1 hidden behind the brow ridge   r2 shadow under the brow
         r3-r4 eyes: [socket, WHITE, WHITE, bridge, WHITE, WHITE, socket]   r5 eye bags / nostril slits / hollow cheeks
         r6 thin upper lip (the dark mouth line itself is the top row of the jaw)."""
    n = cv["north"]
    h, w = n.shape[:2]
    assert (h, w) == (7, 7), (h, w)
    sk = n.copy()

    def mix(r, col, color, a):
        n[r, col] = sk[r, col] * (1 - a) + np.asarray(color, dtype=float) * a

    put(n, R_FOREHEAD, 1, CRACK, 0.22)
    put(n, R_FOREHEAD, 5, VEIN, 0.30)
    put(n, R_BROW, 2, VEIN, 0.3)
    # r2: shadow cast by the brow ridge; r3-r4: individual sunken sockets with pure white, pupil-less eyes
    for col in EYE_COLS:
        mix(R_SHADOW, col, SOCKET_D, 0.88)
    for col in (0, 3, 6):
        mix(R_SHADOW, col, SOCKET_D, 0.42)
    for r in R_EYES:
        for col in (0, 3, 6):
            mix(r, col, SOCKET_M, 0.50)
        for col in EYE_COLS:
            n[r, col] = WHITE
    mix(R_EYES[0], 0, SOCKET_D, 0.35)
    mix(R_EYES[0], 6, SOCKET_D, 0.35)
    # r5: eye bags, nostril slits (barely-there nose), hollow cheeks
    for col in EYE_COLS:
        mix(R_BAG, col, SOCKET_M, 0.55)
    for col in (2, 4):
        mix(R_BAG, col, np.array([96.0, 84.0, 92.0]), 0.75)
    mix(R_BAG, 3, SOCKET_L, 0.15)
    for col in (0, 6):
        mix(R_BAG, col, SOCKET_M, 0.40)
    # r6: thin pale upper lip with faint stitch / crack marks crossing the mouth line
    for col in range(7):
        mix(R_LIP, col, LIP, 0.70)
    for col in (1, 3, 5):
        put(n, R_LIP, col, CRACK, 0.6)
    put(n, R_BAG, 0, CRACK, 0.5)
    put(n, R_BAG, 6, CRACK, 0.45)
    # sides: temple veins; the lip row continues all the way back (the mouth is huge)
    for fn in ("west", "east"):
        s_ = cv[fn]
        vein(s_, rng, vertical=False, length=(3, 5), a=0.4)
        vein(s_, rng, vertical=True, length=(2, 4), a=0.35)
        for col in range(s_.shape[1]):
            s_[R_LIP, col] = s_[R_LIP, col] * 0.35 + LIP * 0.65 * FACE_LIGHT[fn]
        s_[R_SHADOW, :] *= 0.93
        put(s_, R_LIP, 1, CRACK, 0.5)
        put(s_, R_LIP, 3, CRACK, 0.5)
    vein(cv["south"], rng, vertical=True, length=(3, 5))
    vein(cv["south"], rng, vertical=True, length=(3, 5))
    vein(cv["up"], rng, vertical=False, length=(3, 6), a=0.35)
    vein(cv["up"], rng, vertical=True, length=(3, 5), a=0.30)
    # underside = roof of the mouth (dark red-black), visible when the jaw opens
    d = cv["down"]  # 7 cols x 7 rows, row 0 = front
    hh, ww = d.shape[:2]
    for r in range(hh):
        t = r / (hh - 1)  # 0 front .. 1 back
        d[r, :] = np.clip(CAV_MID * (1 - 0.75 * t) + CAV_DARK * (0.75 * t), 0, 255)
    for r in (1, 3, 5):  # palate ridges
        d[r, 1:ww - 1] = np.clip(d[r, 1:ww - 1] * 1.55 + 6, 0, 255)
    d[0, :] = np.array([186.0, 144.0, 150.0])  # lip rim at the front
    d[1:, 0] = np.array([140.0, 100.0, 106.0])
    d[1:, ww - 1] = np.array([140.0, 100.0, 106.0])
    d[hh - 1, :] = CAV_DARK
    d += rng.normal(0, 2.0, d.shape)


def paint_dome(c, cv, rng):
    vein(cv["up"], rng, vertical=False, length=(3, 6), a=0.35)
    vein(cv["up"], rng, vertical=True, length=(3, 6), a=0.30)
    for fn in ("north", "south", "west", "east"):
        cv[fn] *= 0.98


def paint_brow(c, cv, rng):
    cv["north"][:] = cv["north"] * 0.97
    cv["down"][:] = SOCKET_D * 0.85 + rng.normal(0, 1.5, cv["down"].shape)  # deep shadow under the brow ridge
    cv["west"][:] *= 0.96
    cv["east"][:] *= 0.96


def paint_jaw(c, cv, rng):
    n = cv["north"]  # 7 x 3
    w = n.shape[1]
    hline(n, 0, 0, w - 1, MOUTH_LINE)       # the fine dark mouth line (seam between the lips)
    for col in range(w):
        n[1, col] = n[1, col] * 0.35 + LIP * 0.65
    for col in (1, 3, 5):                   # faint stitch marks crossing the lower lip
        put(n, 1, col, CRACK, 0.6)
    put(n, 2, 3, CRACK, 0.35)
    put(n, 2, 0, CRACK, 0.3)
    for fn in ("west", "east"):             # mouth line continues to the hinge, fading
        s_ = cv[fn]  # 3 rows x 6 cols; for west col 0 = back, for east col 0 = front
        for col in range(s_.shape[1]):
            back_idx = col if fn == "west" else s_.shape[1] - 1 - col
            a = 1.0 if back_idx >= 2 else 0.55
            put(s_, 0, col, MOUTH_LINE, a)
            s_[1, col] = s_[1, col] * 0.5 + LIP * 0.5 * FACE_LIGHT[fn]
        vein(s_, rng, vertical=False, length=(2, 3), a=0.3)
    cv["down"][:] = cv["down"] * 0.95        # chin underside
    # open-mouth floor (top of the jaw): dark red-black cavity with a tongue
    u = cv["up"]  # 7 cols x 6 rows, row 0 = back, row 5 = front
    hh, ww = u.shape[:2]
    for r in range(hh):
        t = r / (hh - 1)  # 0 back .. 1 front
        u[r, :] = CAV_DARK * (1 - t) + CAV_MID * t
    for r in range(1, hh - 1):  # tongue
        u[r, 2:ww - 2] = CAV_MID * 0.4 + CAV_RED * 0.6 + (r - 3) * 2
    u[1:hh - 1, ww // 2] *= 0.8
    u[hh - 1, :] = np.array([186.0, 144.0, 150.0])  # front lip rim
    u[:, 0] = np.array([136.0, 98.0, 104.0])
    u[:, ww - 1] = np.array([136.0, 98.0, 104.0])
    u[0, :] = CAV_DARK
    u += rng.normal(0, 2.0, u.shape)


def paint_throat(c, cv, rng):
    for fn, a in cv.items():
        hh = a.shape[0]
        for r in range(hh):
            t = r / max(hh - 1, 1)
            a[r, :] = CAV_MID * (1 - 0.5 * t) * 0.8 + CAV_DARK * (0.2 + 0.5 * t)
        a += rng.normal(0, 1.5, a.shape)


def paint_tooth(c, cv, rng):
    up = c["kind"] == "tooth_up"  # root at the top for upper teeth, at the bottom for lower teeth
    for fn in ("north", "south", "west", "east"):
        a = cv[fn]
        h = a.shape[0]
        for r in range(h):
            t = r / max(h - 1, 1)             # 0 top .. 1 bottom
            tip = t if up else 1 - t           # 0 root .. 1 tip
            col = GUM * (1 - min(1, tip * 2.2)) + TOOTH * min(1, tip * 2.2)
            if tip > 0.99:
                col = TOOTH_DARK * 0.4 + TOOTH * 0.6
            a[r, :] = col * FACE_LIGHT[fn] ** 0.5
    cv["up"][:] = GUM if up else TOOTH
    cv["down"][:] = TOOTH_DARK if up else GUM


def paint_ear(c, cv, rng):
    for fn in ("west", "east"):
        cv[fn][:] = cv[fn] * 0.93
    cv["up"][:] *= 1.0
    for fn in ("north", "south"):
        put(cv[fn], 0, 0, LIP, 0.35)


def paint_neck(c, cv, rng):
    for fn in ("north", "west", "east"):
        a = cv[fn]
        for r in range(a.shape[0]):
            a[r, 0] *= 0.96
            a[r, -1] *= 0.96
    put(cv["north"], 2, 1, VEIN, 0.5)
    put(cv["north"], 3, 1, VEIN, 0.4)
    vein(cv["south"], rng, vertical=True, length=(3, 4))
    # the upper two rows sit behind the chin and are seen through the open mouth: throat colours
    for fn in ("north", "west", "east"):
        a = cv[fn]
        a[0, :] = CAV_DARK * 1.1
        a[1, :] = CAV_MID * 0.85
        a[2, :] = a[2, :] * 0.7 + CAV_MID * 0.3


def paint_ribcage(c, cv, rng):
    n = cv["north"]  # 7 cols x 7 rows
    for r in (0, 2, 4, 6):                 # exposed gaps between the rib rings: intercostal shadow
        n[r, :] = n[r, :] * 0.86
    for r in (1, 3, 5):                    # rows hidden behind rings (still painted)
        n[r, :] = n[r, :] * 0.98
    vline(n, 3, 0, 6, np.array([252.0, 250.0, 246.0]), 0.55)  # sternum
    put(n, 0, 1, VEIN, 0.5)
    put(n, 0, 2, VEIN, 0.4)
    put(n, 0, 4, VEIN, 0.4)
    put(n, 0, 5, VEIN, 0.5)                # collar bones
    for fn in ("west", "east"):
        s = cv[fn]
        for r in (0, 2, 4, 6):
            s[r, :] = s[r, :] * 0.86
        vein(s, rng, vertical=True, length=(2, 4))
    b = cv["south"]                        # 7 x 7 : back
    vline(b, 3, 0, 6, np.array([196.0, 192.0, 190.0]), 0.7)   # spine groove
    for r in (1, 2, 3):                    # shoulder blades
        put(b, r, 1, SKIN_COOL * 0.8, 0.5)
        put(b, r, 5, SKIN_COOL * 0.8, 0.5)
    for r in (0, 2, 4, 6):
        b[r, :] = b[r, :] * 0.93
    vein(b, rng, vertical=True, length=(3, 5))
    cv["up"][:] *= 1.0
    cv["down"][:] *= 0.9


def paint_rib_ring(c, cv, rng):
    hi = np.array([248.0, 246.0, 240.0])
    n = cv["north"]  # 8 x 1
    n[0, :] = n[0, :] * 0.3 + hi * 0.7
    n[0, 0] *= 0.93
    n[0, 7] *= 0.93
    put(n, 0, 3, VEIN, 0.3)
    for fn in ("west", "east", "south"):
        cv[fn][:] = cv[fn] * 0.5 + hi * 0.5 * FACE_LIGHT[fn]
    cv["up"][:] = cv["up"] * 0.6 + hi * 0.4
    cv["down"][:] = cv["down"] * 0.85


def paint_spine(c, cv, rng):
    for fn, a in cv.items():
        a[:] = a * 0.94 + np.array([250.0, 248.0, 242.0]) * 0.06


def paint_abdomen(c, cv, rng):
    n = cv["north"]  # 5 x 3
    n[:] = n * 0.95
    n[1, 2] *= 0.88  # navel
    put(n, 0, 0, VEIN, 0.3)
    put(n, 2, 4, VEIN, 0.3)
    for fn in ("west", "east"):
        cv[fn][:] *= 0.95


def paint_pelvis(c, cv, rng):
    n = cv["north"]  # 7 x 4
    for col in (0, 6):
        n[:, col] *= 0.93
    n[3, :] *= 0.92
    vein(cv["west"], rng)
    vein(cv["east"], rng)


def paint_upper_arm(c, cv, rng):
    paint_generic_limb(c, cv, rng, veins=1)
    out = "west" if c["side"] < 0 else "east"
    vein(cv[out], rng, vertical=True, length=(5, 8), a=0.5)
    cv["up"][:] *= 1.0


def paint_elbow(c, cv, rng):
    for fn in ("north", "south", "west", "east", "up"):
        cv[fn][:] = cv[fn] * 0.8 + np.array([250.0, 248.0, 244.0]) * 0.2 * FACE_LIGHT[fn]
    put(cv["south"], 0, 1, CRACK, 0.35)
    put(cv["south"], 1, 1, CRACK, 0.35)


def paint_forearm(c, cv, rng):
    paint_generic_limb(c, cv, rng, veins=2)
    out = "west" if c["side"] < 0 else "east"
    vein(cv[out], rng, vertical=True, length=(6, 9), a=0.5)
    # slightly yellow-grey, more tendon shadow near the wrist
    for fn in ("north", "south", "west", "east"):
        cv[fn][-2:, :] *= 0.97


def paint_palm(c, cv, rng):
    for fn in ("north", "south", "west", "east", "up", "down"):
        cv[fn][:] = cv[fn] * np.array([0.99, 0.985, 0.97])
    n = cv["north"]  # 4 x 2 : back-of-hand / front face; knuckles on the bottom row
    for col in range(4):
        put(n, 1, col, np.array([250.0, 248.0, 242.0]), 0.55)
    put(n, 0, 1, VEIN, 0.4)
    put(n, 0, 2, VEIN, 0.35)
    s = cv["south"]
    put(s, 0, 1, VEIN, 0.3)
    for col in range(4):
        put(s, 1, col, np.array([250.0, 248.0, 242.0]), 0.45)
    cv["down"][:] = cv["down"] * 0.85


def paint_finger(c, cv, rng):
    idx = c["finger"]
    tone = 0.97 if idx % 2 else 1.0
    knuckle = np.array([252.0, 250.0, 246.0])
    for fn in ("north", "south", "west", "east"):
        a = cv[fn]
        a[:] *= tone
        h = a.shape[0]
        put(a, 0, 0, knuckle, 0.55)                 # knuckle highlight where the finger leaves the palm
        for j in (max(2, h // 3 + 1), max(3, 2 * h // 3 + 1)):  # finger joints
            if j < h - 1:
                a[j, :] *= 0.92
        a[h - 1, :] = NAIL * (0.9 + 0.1 * FACE_LIGHT[fn])        # darker fingernail at the tip (last texel row)
    cv["down"][:] = NAIL * 0.9
    cv["up"][:] = cv["up"] * 0.9


def paint_thumb(c, cv, rng):
    paint_finger(dict(c, length=3, finger=0), cv, rng)


def paint_thigh(c, cv, rng):
    paint_generic_limb(c, cv, rng, veins=1)
    out = "west" if c["side"] < 0 else "east"
    vein(cv[out], rng, vertical=True, length=(6, 10), a=0.45)
    for fn in ("north", "south", "west", "east"):
        cv[fn][:] *= 0.985


def paint_knee(c, cv, rng):
    for fn in ("north", "south", "west", "east", "up", "down"):
        cv[fn][:] = cv[fn] * 0.78 + np.array([252.0, 250.0, 246.0]) * 0.22 * min(1.0, FACE_LIGHT[fn] + 0.08)
    put(cv["north"], 0, 0, CRACK, 0.3)


def paint_shin(c, cv, rng):
    paint_generic_limb(c, cv, rng, veins=1)
    n = cv["north"]
    vline(n, 0, 0, n.shape[0] - 1, np.array([252.0, 250.0, 246.0]), 0.35)   # tibia ridge
    out = "west" if c["side"] < 0 else "east"
    vein(cv[out], rng, vertical=True, length=(4, 7), a=0.45)


def paint_foot(c, cv, rng):
    u = cv["up"]  # 3 cols x 8 rows (row 0 = back/heel, row 7 = front)
    for col, rr in ((0, (1, 5)), (2, (2, 6))):      # tendons on the top of the foot
        vline(u, col, rr[0], rr[1], VEIN, 0.4)
    vein(u, rng, vertical=True, length=(3, 5), a=0.35)
    cv["down"][:] = cv["down"] * 0.9                 # sole
    for fn in ("west", "east"):
        cv[fn][-1:, :] *= 0.93
    hl = np.array([252.0, 250.0, 246.0])
    put(cv["south"], 0, 1, hl, 0.3)                  # heel bone


def paint_toes(c, cv, rng):
    n = cv["north"]  # 3 x 1
    for col in range(3):
        a = 0.0 if col == 1 else 0.25
        n[0, col] = n[0, col] * (1 - a) + SKIN_COOL * 0.8 * a
    u = cv["up"]  # 3 cols x 2 rows (row 1 = tip): toenails
    for col in range(3):
        put(u, 1, col, NAIL, 0.85)
    cv["down"][:] = cv["down"] * 0.9


PAINTERS = {
    "cranium": paint_cranium, "dome": paint_dome, "brow": paint_brow, "jaw": paint_jaw, "throat": paint_throat,
    "tooth_up": paint_tooth, "tooth_lo": paint_tooth, "ear": paint_ear, "neck": paint_neck,
    "ribcage": paint_ribcage, "rib_ring": paint_rib_ring, "spine": paint_spine, "abdomen": paint_abdomen,
    "pelvis": paint_pelvis, "upper_arm": paint_upper_arm, "elbow": paint_elbow, "forearm": paint_forearm,
    "palm": paint_palm, "finger": paint_finger, "thumb": paint_thumb, "thigh": paint_thigh, "knee": paint_knee,
    "shin": paint_shin, "foot": paint_foot, "toes": paint_toes,
}
# per-kind overall skin tone multiplier (hands/feet a hair greyer-yellow)
TONE = {"palm": 0.985, "finger": 0.975, "thumb": 0.975, "foot": 0.98, "toes": 0.98, "knee": 1.0, "ear": 0.97}
NO_SKIN = {"throat"}  # kinds that repaint every face themselves


# ----------------------------------------------------------------------------- assembly
def paint(verbose=False):
    bones, cubes = M.build_model()
    tex = np.zeros((M.TEX_H, M.TEX_W, 4), dtype=np.uint8)
    filled = np.zeros((M.TEX_H, M.TEX_W), dtype=bool)
    stats = {}
    for c in cubes:
        rects = M.face_rects(c)
        cv = {}
        for fn in rects:
            rng = np.random.default_rng(_seed_for(c["name"], fn))
            cv[fn] = skin_canvas(face_shape(c, fn), fn, rng, tone=TONE.get(c["kind"], 1.0))
        rng = np.random.default_rng(_seed_for(c["name"], "paint"))
        fn_paint = PAINTERS.get(c["kind"])
        if fn_paint:
            fn_paint(c, cv, rng)
        for fn, (x, y, w, h) in rects.items():
            a = np.clip(np.rint(cv[fn]), 0, 255).astype(np.uint8)
            assert a.shape[:2] == (h, w), (c["name"], fn, a.shape, (h, w))
            tex[y:y + h, x:x + w, :3] = a
            tex[y:y + h, x:x + w, 3] = 255
            filled[y:y + h, x:x + w] = True
    # re-assert the pure-white eyes (painters above must not have altered them)
    cr = next(c for c in cubes if c["kind"] == "cranium")
    ex, ey, ew, eh = M.face_rects(cr)["north"]
    for r in R_EYES:
        for col in EYE_COLS:
            tex[ey + r, ex + col, :3] = 255
    # 1-px gutter bleed (opaque copy of the nearest painted texel) so mip-mapping / filtering can never pull
    # in transparent or foreign colours; everything else stays fully transparent (RGB = skin tone).
    out = tex.copy()
    skin_fill = np.rint(SKIN).astype(np.uint8)
    out[~filled, :3] = skin_fill
    out[~filled, 3] = 0
    ys, xs = np.nonzero(filled)
    H, W = filled.shape
    for y in range(H):
        for x in range(W):
            if filled[y, x]:
                continue
            best = None
            for dy in (-1, 0, 1):
                for dx in (-1, 0, 1):
                    yy, xx = y + dy, x + dx
                    if 0 <= yy < H and 0 <= xx < W and filled[yy, xx]:
                        d = abs(dy) + abs(dx)
                        if best is None or d < best[0]:
                            best = (d, yy, xx)
            if best:
                out[y, x, :3] = tex[best[1], best[2], :3]
                out[y, x, 3] = 255
    return out, filled, cubes


def save(path=OUT_PATH):
    out, filled, cubes = paint()
    os.makedirs(os.path.dirname(path), exist_ok=True)
    Image.fromarray(out, "RGBA").save(path, optimize=True)
    return out, filled, cubes


def stats(out, filled):
    rgb = out[..., :3].astype(float)
    lum = 0.2126 * rgb[..., 0] + 0.7152 * rgb[..., 1] + 0.0722 * rgb[..., 2]
    opaque = out[..., 3] == 255
    a = out[..., 3]
    print(f"size {out.shape[1]}x{out.shape[0]} RGBA   alpha values present: {sorted(set(a.ravel().tolist()))}")
    print(f"painted texels {int(filled.sum())}  opaque (incl. gutter bleed) {int(opaque.sum())}")
    print(f"mean luminance of painted texels {lum[filled].mean():.1f}/255  (median {np.median(lum[filled]):.1f})")
    print(f"mean luminance of skin-like texels (lum>170) {lum[filled & (lum > 170)].mean():.1f}  share {(lum[filled] > 170).mean() * 100:.0f}%")


def check(path=OUT_PATH):
    """Hard checks on the written PNG (raises AssertionError)."""
    import hashlib
    im = Image.open(path)
    assert im.size == (M.TEX_W, M.TEX_H) and im.mode == "RGBA", (im.size, im.mode)
    tex = np.array(im)
    assert set(np.unique(tex[..., 3]).tolist()) <= {0, 255}, "semi-transparent texels present"
    bones, cubes = M.build_model()
    # every texel of every face rectangle must be opaque
    for c in cubes:
        for fn, (x, y, w, h) in M.face_rects(c).items():
            assert (tex[y:y + h, x:x + w, 3] == 255).all(), (c["name"], fn)
    cr = next(c for c in cubes if c["kind"] == "cranium")
    jw = next(c for c in cubes if c["kind"] == "jaw")
    ex, ey, ew, eh = M.face_rects(cr)["north"]
    # pure white, pupil-less eyes exactly where the geometry puts them (cranium north face rows 4-5)
    eyes = [(ey + r, ex + col) for r in R_EYES for col in EYE_COLS]
    assert all(tuple(tex[y, x, :3]) == (255, 255, 255) for y, x in eyes), "eyes not pure white"
    # sockets are darker than the skin around the eyes
    assert tex[ey + R_SHADOW, ex + 1, :3].mean() < 140 and tex[ey + R_SHADOW, ex + 5, :3].mean() < 140
    # mouth line = top row of the jaw's north face; inner mouth = jaw top face + cranium underside
    jx, jy, jw_, jh = M.face_rects(jw)["north"]
    assert tex[jy, jx:jx + jw_, :3].mean() < 90, "mouth line missing"
    ux, uy, uw, uh = M.face_rects(jw)["up"]
    assert tex[uy:uy + uh, ux:ux + uw, :3].mean(axis=(0, 1))[0] < 130 and tex[uy:uy + uh, ux:ux + uw, :3].mean() < 90
    dx, dy, dw, dh = M.face_rects(cr)["down"]
    assert tex[dy:dy + dh, dx:dx + dw, :3].mean() < 110
    # pale skin overall
    filled = np.zeros(tex.shape[:2], bool)
    for c in cubes:
        for fn, (x, y, w, h) in M.face_rects(c).items():
            filled[y:y + h, x:x + w] = True
    lum = 0.2126 * tex[..., 0] + 0.7152 * tex[..., 1] + 0.0722 * tex[..., 2]
    skin = [c for c in cubes if c["kind"] in ("thigh", "shin", "upper_arm", "forearm", "ribcage", "abdomen", "pelvis")]
    skin_l = np.mean([lum[y:y + h, x:x + w].mean() for c in skin for fn, (x, y, w, h) in M.face_rects(c).items()
                      if fn != "down"])
    assert skin_l > 195, skin_l
    # determinism: painting twice gives identical bytes
    a1, _, _ = paint()
    a2, _, _ = paint()
    assert hashlib.sha256(a1.tobytes()).digest() == hashlib.sha256(a2.tobytes()).digest(), "non-deterministic"
    assert (a1 == tex).all(), "PNG on disk differs from a fresh paint"
    return dict(skin_luminance=float(skin_l), sha256=hashlib.sha256(open(path, "rb").read()).hexdigest())


if __name__ == "__main__":
    import argparse
    ap = argparse.ArgumentParser()
    ap.add_argument("--check", action="store_true")
    a = ap.parse_args()
    out, filled, cubes = save()
    print("wrote", OUT_PATH)
    stats(out, filled)
    if a.check:
        r = check()
        print("check OK:", r)
