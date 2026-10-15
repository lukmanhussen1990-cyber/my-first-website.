"""An original witch mouse for the "Sixth dimension" scene, drawn in code.

The mouse is built from vector shapes on a 4x canvas, back to front, with
white fills hiding whatever sits behind each part. The result is returned as
ink/pink probability maps in band coordinates, so render.py gives it the same
crayon grain and 10 fps boil as everything else.

Run directly to preview: python3 mouse.py -> output/mouse_preview.png
"""
import math
import os

import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage

HERE = os.path.dirname(os.path.abspath(__file__))
W, BH = 720, 528
SS = 4                      # supersampling factor
LINE = 8.0                  # main line width in band pixels (matches the plates)

# Placement of the design in the band: head centre, scale and tilt.
CENTER = (272.0, 268.0)
SCALE = 1.0
TILT = math.radians(-14)


class Canvas:
    def __init__(self):
        self.ink = Image.new("L", (W * SS, BH * SS), 0)
        self.pink = Image.new("L", (W * SS, BH * SS), 0)
        self.di = ImageDraw.Draw(self.ink)
        self.dp = ImageDraw.Draw(self.pink)

    @staticmethod
    def T(p):
        """Design coords (head at origin, y down) -> supersampled canvas."""
        x, y = p
        c, s = math.cos(TILT), math.sin(TILT)
        xr, yr = x * c - y * s, x * s + y * c
        return ((CENTER[0] + xr * SCALE) * SS, (CENTER[1] + yr * SCALE) * SS)

    def stroke(self, pts, width=LINE):
        pts = [self.T(p) for p in pts]
        w = width * SCALE * SS
        self.di.line(pts, fill=255, width=int(round(w)))
        r = w / 2
        for x, y in pts:                      # round joins and caps
            self.di.ellipse((x - r, y - r, x + r, y + r), fill=255)

    def white(self, pts):
        pts = [self.T(p) for p in pts]
        self.di.polygon(pts, fill=0)
        self.dp.polygon(pts, fill=0)

    def pinkfill(self, pts):
        self.dp.polygon([self.T(p) for p in pts], fill=255)

    def inkfill(self, pts):
        self.di.polygon([self.T(p) for p in pts], fill=255)

    def whitefill(self, pts):
        """White fill that only erases ink (keeps pink), for highlights."""
        self.di.polygon([self.T(p) for p in pts], fill=0)

    def maps(self):
        ink = np.asarray(self.ink.resize((W, BH), Image.BOX), np.float32) / 255
        pink = np.asarray(self.pink.resize((W, BH), Image.BOX), np.float32) / 255
        # A slightly wider edge ramp lets the crayon grain wobble the outline.
        ink = ndimage.gaussian_filter(ink, 0.8)
        pink = ndimage.gaussian_filter(pink, 0.6)
        pink = np.minimum(pink, 1.0 - ink)
        return ink, pink


def ellipse(cx, cy, rx, ry, rot=0.0, n=48, a0=0.0, a1=2 * math.pi):
    c, s = math.cos(rot), math.sin(rot)
    pts = []
    for i in range(n + 1):
        t = a0 + (a1 - a0) * i / n
        x, y = rx * math.cos(t), ry * math.sin(t)
        pts.append((cx + x * c - y * s, cy + x * s + y * c))
    return pts


def bezier(p0, p1, p2, p3, n=24):
    pts = []
    for i in range(n + 1):
        t = i / n
        u = 1 - t
        pts.append((u ** 3 * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t ** 3 * p3[0],
                    u ** 3 * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t ** 3 * p3[1]))
    return pts


def sparkle(cx, cy, r, n=10):
    """Four-point twinkle star outline with concave sides."""
    pts = []
    for k in range(4):
        a = k * math.pi / 2 - math.pi / 2
        tip = (cx + r * math.cos(a), cy + r * math.sin(a))
        nxt = ((k + 1) * math.pi / 2) - math.pi / 2
        tip2 = (cx + r * math.cos(nxt), cy + r * math.sin(nxt))
        ctrl = (cx + 0.18 * r * math.cos((a + nxt) / 2), cy + 0.18 * r * math.sin((a + nxt) / 2))
        pts += bezier(tip, ctrl, ctrl, tip2, n)[:-1]
    return pts + [pts[0]]


def star5(cx, cy, r, inner=0.45, rot=-math.pi / 2):
    pts = []
    for k in range(10):
        rr = r if k % 2 == 0 else r * inner
        a = rot + k * math.pi / 5
        pts.append((cx + rr * math.cos(a), cy + rr * math.sin(a)))
    return pts + [pts[0]]


def heart(cx, cy, s):
    pts = []
    for i in range(41):
        t = 2 * math.pi * i / 40
        x = 16 * math.sin(t) ** 3
        y = -(13 * math.cos(t) - 5 * math.cos(2 * t) - 2 * math.cos(3 * t) - math.cos(4 * t))
        pts.append((cx + x * s / 16, cy + y * s / 16))
    return pts


def witch_mouse():
    cv = Canvas()

    # --- sparkles and stardust around the mouse (furthest back) ---
    for cx, cy, r in [(-118, -92, 17), (100, -118, 13), (-132, 72, 13)]:
        cv.stroke(sparkle(cx, cy, r), 5.5)
    for cx, cy in [(-92, -136), (-150, 4), (128, -66)]:
        cv.inkfill(ellipse(cx, cy, 4, 4))

    # --- curly tail with a heart tip (behind the body) ---
    tail = bezier((88, 100), (124, 126), (162, 106), (146, 66))
    cv.stroke(tail, 5.5)
    h = heart(146, 50, 15)
    cv.white(h)
    cv.pinkfill(h)
    cv.stroke(h, 5.0)

    # --- body (behind the head) ---
    body = ellipse(50, 80, 50, 44, rot=math.radians(28))
    cv.white(body)
    cv.stroke(body)

    # feet
    for fx, fy in [(30, 124), (82, 118)]:
        foot = ellipse(fx, fy, 15, 11, rot=math.radians(20))
        cv.white(foot)
        cv.stroke(foot)
        cv.pinkfill(ellipse(fx + 1, fy + 2, 6, 4, rot=math.radians(20)))

    # right arm holding the wand
    cv.stroke(bezier((86, 60), (100, 48), (108, 40), (116, 34)), LINE)
    cv.stroke([(118, 34), (152, -12)], 5.0)
    st = star5(158, -22, 19)
    cv.white(st)
    cv.stroke(st, 5.0)
    paw = ellipse(116, 36, 10, 9)
    cv.white(paw)
    cv.stroke(paw)

    # --- ears (behind the head) ---
    for ex, ey, rot in [(-60, -38, -0.3), (62, -36, 0.3)]:
        ear = ellipse(ex, ey, 31, 29, rot=rot)
        cv.white(ear)
        cv.stroke(ear)
        cv.pinkfill(ellipse(ex * 0.97, ey + 3, 17, 15, rot=rot))

    # left paw peeking out from under the chin
    arm = ellipse(-30, 62, 14, 12, rot=math.radians(-30))
    cv.white(arm)
    cv.stroke(arm)

    # --- head ---
    head = ellipse(0, 0, 70, 58)
    cv.white(head)
    cv.stroke(head)

    # --- witch hat: cone, star, band, brim ---
    cone = bezier((-34, -54), (-28, -88), (-10, -120), (22, -142)) + \
        bezier((22, -142), (32, -146), (38, -138), (33, -132))[1:] + \
        bezier((33, -132), (30, -110), (32, -84), (36, -54))[1:]
    cv.white(cone + [(-34, -54)])
    cv.stroke(cone)
    cv.stroke(bezier((-31, -72), (-10, -64), (14, -64), (35, -72)), 5.0)
    cv.stroke(star5(2, -98, 10), 4.0)
    brim = ellipse(0, -52, 64, 15, rot=math.radians(-4))
    cv.white(brim)
    cv.stroke(brim)

    # --- face ---
    for sx in (-1, 1):
        ex, ey = 26 * sx, 8
        cv.inkfill(ellipse(ex, ey, 10, 13))
        cv.whitefill(ellipse(ex - 3.5, ey - 5, 4, 4))
        cv.whitefill(ellipse(ex + 3.5, ey + 5, 2, 2))
        cv.pinkfill(ellipse(46 * sx, 28, 13, 8.5))
        for dy, tilt in ((18, -6), (27, 5)):
            cv.stroke([(60 * sx, dy), (86 * sx, dy + tilt)], 4.0)
    cv.pinkfill(ellipse(0, 22, 6, 4.2))
    cv.stroke([(-11, 30), (-6, 35.5), (0, 31), (6, 35.5), (11, 30)], 4.0)

    return cv.maps()


if __name__ == "__main__":
    ink, pink = witch_mouse()
    img = np.full((BH, W, 3), 253, np.float32)
    img = img * (1 - pink[..., None]) + np.array([252, 127, 173]) * pink[..., None]
    img = img * (1 - ink[..., None])
    os.makedirs(os.path.join(HERE, "output"), exist_ok=True)
    Image.fromarray(img.clip(0, 255).astype(np.uint8)).save(
        os.path.join(HERE, "output", "mouse_preview.png"))
    print("wrote output/mouse_preview.png")
