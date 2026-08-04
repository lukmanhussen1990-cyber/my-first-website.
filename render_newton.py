#!/usr/bin/env python3
"""
Newton and the Apple -- a frame-by-frame rendered animated short.

Renders a golden-hour orchard scene: Isaac Newton sits reading beneath an
apple tree, an apple works loose, falls under real gravity, strikes his
head, and the idea arrives.

Everything is drawn procedurally with Pillow at 2x supersampling and
encoded to H.264 MP4.

    python3 render_newton.py              # full render
    python3 render_newton.py --peek 95    # render one frame to peek.png
"""

import argparse
import math
import os
import random
import subprocess

import numpy as np
from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageFont

# --------------------------------------------------------------------------
# configuration
# --------------------------------------------------------------------------

W, H = 1920, 1080          # design units (final output resolution)
SS = 2                     # supersample factor
FPS = 30
DURATION = 9.0
NFRAMES = int(FPS * DURATION)

OUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "build")
FRAME_DIR = os.path.join(OUT_DIR, "frames")
MP4_PATH = os.path.join(OUT_DIR, "newton_apple.mp4")

FONT_SERIF = "/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf"
FONT_SERIF_BOLD = "/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf"

# --- key timings (seconds) ------------------------------------------------
T_STRESS = 1.55            # stem starts to give
T_DROP = 2.30              # apple lets go
T_FALL = 0.55              # free-fall duration
T_HIT = T_DROP + T_FALL    # impact
T_LOOK_DOWN = T_HIT + 1.25
T_LOOK_UP = T_HIT + 2.45
T_IDEA = T_HIT + 3.45

# --- palette --------------------------------------------------------------
SKY_TOP = (74, 122, 179)
SKY_MID = (146, 183, 206)
SKY_LOW = (238, 214, 168)
SUN = (255, 241, 202)

HILL_FAR = (150, 172, 158)
HILL_NEAR = (118, 148, 116)

GRASS_FAR = (128, 156, 96)
GRASS_NEAR = (74, 104, 56)

BARK = (86, 66, 52)
BARK_LIT = (134, 106, 80)
BARK_DARK = (48, 36, 28)

LEAF_DARK = (38, 66, 38)
LEAF_MID = (66, 104, 50)
LEAF_LIT = (128, 164, 70)
LEAF_HOT = (186, 205, 108)

SKIN = (231, 188, 158)
SKIN_SHADE = (186, 137, 111)
SKIN_DEEP = (145, 99, 82)
SKIN_LIT = (250, 222, 195)

WIG = (222, 219, 214)
WIG_SHADE = (168, 165, 165)
WIG_DEEP = (124, 122, 126)

COAT = (92, 44, 48)
COAT_LIT = (140, 74, 72)
COAT_DARK = (52, 24, 30)

BREECH = (58, 54, 74)
BREECH_LIT = (92, 88, 112)

LINEN = (243, 238, 226)
LINEN_SHADE = (198, 190, 176)

APPLE_RED = (192, 42, 40)
APPLE_LIT = (232, 96, 62)
APPLE_DARK = (108, 20, 26)

# --------------------------------------------------------------------------
# layer helper -- all drawing is done in design units, scaled up internally
# --------------------------------------------------------------------------


class Layer:
    """An RGBA drawing surface, optionally cropped to a sub-region."""

    def __init__(self, box=None, color=(0, 0, 0, 0)):
        if box is None:
            box = (0, 0, W, H)
        x0, y0, x1, y1 = box
        self.ox, self.oy = int(x0), int(y0)
        w = max(1, int((x1 - x0) * SS))
        h = max(1, int((y1 - y0) * SS))
        self.img = Image.new("RGBA", (w, h), color)
        self.d = ImageDraw.Draw(self.img)

    # -- coordinate mapping ------------------------------------------------
    def _pt(self, p):
        return ((p[0] - self.ox) * SS, (p[1] - self.oy) * SS)

    def _box(self, b):
        return [
            (b[0] - self.ox) * SS,
            (b[1] - self.oy) * SS,
            (b[2] - self.ox) * SS,
            (b[3] - self.oy) * SS,
        ]

    # -- primitives --------------------------------------------------------
    def ell(self, box, fill=None, outline=None, width=1):
        self.d.ellipse(self._box(box), fill=fill, outline=outline, width=int(width * SS))

    def circ(self, cx, cy, r, fill=None, outline=None, width=1):
        self.ell((cx - r, cy - r, cx + r, cy + r), fill, outline, width)

    def poly(self, pts, fill=None, outline=None, width=1):
        self.d.polygon([self._pt(p) for p in pts], fill=fill, outline=outline,
                       width=int(width * SS))

    def line(self, pts, fill=None, width=1, joint="curve"):
        self.d.line([self._pt(p) for p in pts], fill=fill, width=max(1, int(width * SS)),
                    joint=joint)

    def rect(self, box, fill=None, outline=None, width=1):
        self.d.rectangle(self._box(box), fill=fill, outline=outline, width=int(width * SS))

    def rrect(self, box, r, fill=None, outline=None, width=1):
        self.d.rounded_rectangle(self._box(box), radius=r * SS, fill=fill,
                                 outline=outline, width=int(width * SS))

    def arc(self, box, a0, a1, fill=None, width=1):
        self.d.arc(self._box(box), a0, a1, fill=fill, width=max(1, int(width * SS)))

    def pie(self, box, a0, a1, fill=None):
        self.d.pieslice(self._box(box), a0, a1, fill=fill)

    def chord(self, box, a0, a1, fill=None):
        self.d.chord(self._box(box), a0, a1, fill=fill)

    def text(self, p, s, font, fill, anchor="mm"):
        self.d.text(self._pt(p), s, font=font, fill=fill, anchor=anchor)

    # -- compositing -------------------------------------------------------
    def blur(self, r):
        self.img = self.img.filter(ImageFilter.GaussianBlur(r * SS))
        self.d = ImageDraw.Draw(self.img)
        return self

    def fade(self, a):
        """Scale the whole layer's alpha by a in [0,1]."""
        if a >= 1.0:
            return self
        alpha = self.img.getchannel("A").point(lambda v: int(v * a))
        self.img.putalpha(alpha)
        return self

    def onto(self, dest, dx=0, dy=0):
        px = int((self.ox - dest.ox + dx) * SS)
        py = int((self.oy - dest.oy + dy) * SS)
        dest.img.alpha_composite(self.img, (px, py))
        return self

    def rotated(self, deg, pivot):
        """Rotate this layer's contents about a pivot given in design units."""
        c = self._pt(pivot)
        self.img = self.img.rotate(deg, resample=Image.BICUBIC, center=c)
        self.d = ImageDraw.Draw(self.img)
        return self


def soft(dest, box, drawfn, blur_r, alpha=1.0):
    """Draw something into a scratch patch, blur it, composite it down."""
    lay = Layer(box)
    drawfn(lay)
    lay.blur(blur_r)
    if alpha < 1.0:
        lay.fade(alpha)
    lay.onto(dest)


# --------------------------------------------------------------------------
# math / easing
# --------------------------------------------------------------------------


def clamp(v, a=0.0, b=1.0):
    return a if v < a else (b if v > b else v)


def lerp(a, b, t):
    return a + (b - a) * t


def mix(c1, c2, t):
    t = clamp(t)
    return tuple(int(round(lerp(c1[i], c2[i], t))) for i in range(len(c1)))


def smooth(t):
    t = clamp(t)
    return t * t * (3 - 2 * t)


def ease_out(t):
    t = clamp(t)
    return 1 - (1 - t) ** 3


def ease_in(t):
    t = clamp(t)
    return t ** 3


def span(t, a, b):
    """Normalise t into 0..1 across the window [a, b]."""
    if b <= a:
        return 1.0 if t >= b else 0.0
    return clamp((t - a) / (b - a))


def wobble(u, freq, decay):
    """Decaying oscillation, 1.0 at u=0, settling to 0."""
    if u < 0:
        return 0.0
    return math.exp(-decay * u) * math.cos(freq * u)


def gradient_v(box, c_top, c_bot, stops=None):
    """Vertical gradient image sized to a design-unit box."""
    x0, y0, x1, y1 = box
    w, h = int((x1 - x0) * SS), int((y1 - y0) * SS)
    ramp = np.linspace(0.0, 1.0, h)[:, None]
    if stops is None:
        arr = np.zeros((h, 3))
        for i in range(3):
            arr[:, i] = lerp(c_top[i], c_bot[i], ramp[:, 0])
    else:
        arr = np.zeros((h, 3))
        pos = np.array([s[0] for s in stops])
        for i in range(3):
            arr[:, i] = np.interp(ramp[:, 0], pos, [s[1][i] for s in stops])
    img = np.repeat(arr[:, None, :], w, axis=1).astype(np.uint8)
    out = Image.fromarray(img, "RGB").convert("RGBA")
    return out


# --------------------------------------------------------------------------
# background: sky, sun, clouds, hills, meadow
# --------------------------------------------------------------------------


def build_sky():
    base = Layer()
    sky = gradient_v(
        (0, 0, W, H),
        None, None,
        stops=[(0.00, SKY_TOP), (0.34, SKY_MID), (0.58, SKY_LOW), (1.00, SKY_LOW)],
    )
    base.img.alpha_composite(sky)

    # low sun with a broad warm bloom (full-canvas layers so the blur never
    # meets a patch edge and leaves a seam in the sky)
    sun_x, sun_y = 1610, 300
    for r, a in ((520, 34), (330, 46), (200, 62), (118, 96)):
        soft(base, None,
             lambda l, rr=r, aa=a: l.circ(sun_x, sun_y, rr, fill=SUN + (aa,)), r * 0.34)
    soft(base, None,
         lambda l: l.circ(sun_x, sun_y, 54, fill=(255, 252, 236, 235)), 10)

    return base


def build_clouds(base):
    rng = random.Random(7)
    for cx, cy, sc, alpha in (
        (300, 175, 1.35, 150), (760, 120, 0.95, 120), (1240, 235, 1.15, 135),
        (1700, 130, 0.85, 110), (520, 300, 0.75, 95), (1480, 355, 0.9, 88),
        (980, 330, 0.7, 78),
    ):
        pad = 120 * sc          # keep the blur well clear of the patch edge
        box = (cx - 340 * sc - pad, cy - 150 * sc - pad,
               cx + 340 * sc + pad, cy + 150 * sc + pad)
        def draw(l, cx=cx, cy=cy, sc=sc, alpha=alpha, rng=rng):
            # underside is cooler, top catches the sun
            for i in range(16):
                ox = rng.uniform(-190, 190) * sc
                oy = rng.uniform(-24, 30) * sc
                r = rng.uniform(38, 92) * sc
                l.circ(cx + ox, cy + oy, r, fill=(214, 206, 214, alpha))
            for i in range(12):
                ox = rng.uniform(-160, 170) * sc
                oy = rng.uniform(-40, 4) * sc
                r = rng.uniform(30, 76) * sc
                l.circ(cx + ox, cy + oy, r, fill=(255, 246, 232, alpha))
        soft(base, box, draw, 14 * sc)
    return base


def build_hills(base):
    rng = random.Random(21)
    horizon = 646

    # far ridge -- hazy, low contrast
    def far(l):
        pts = [(-40, horizon + 20)]
        x = -40
        while x < W + 60:
            pts.append((x, horizon - 34 - 46 * math.sin(x / 340.0) - 18 * math.sin(x / 97.0)))
            x += 24
        pts += [(W + 60, horizon + 40), (-40, horizon + 40)]
        l.poly(pts, fill=HILL_FAR + (215,))
    soft(base, (0, horizon - 150, W, horizon + 60), far, 3)

    # near ridge
    def near(l):
        pts = [(-40, horizon + 30)]
        x = -40
        while x < W + 60:
            pts.append((x, horizon - 6 - 26 * math.sin(x / 210.0 + 1.7) - 10 * math.sin(x / 71.0)))
            x += 22
        pts += [(W + 60, horizon + 50), (-40, horizon + 50)]
        l.poly(pts, fill=HILL_NEAR + (235,))
    soft(base, (0, horizon - 90, W, horizon + 70), near, 2)

    # a few distant trees along the ridge for scale
    def far_trees(l):
        for i in range(26):
            x = rng.uniform(-20, W + 20)
            y = horizon - 8 - 22 * math.sin(x / 210.0 + 1.7) + rng.uniform(-4, 4)
            hgt = rng.uniform(14, 30)
            wid = hgt * rng.uniform(0.5, 0.8)
            l.ell((x - wid, y - hgt, x + wid, y + 4), fill=(84, 108, 84, 210))
            l.line([(x, y + 4), (x, y - hgt * 0.2)], fill=(70, 88, 72, 210), width=2)
    soft(base, (0, horizon - 60, W, horizon + 30), far_trees, 1.6)

    return base


def build_meadow(base):
    horizon = 646
    rng = random.Random(33)

    ground = gradient_v(
        (0, horizon, W, H), None, None,
        stops=[(0.0, GRASS_FAR), (0.28, (108, 138, 78)), (0.7, (86, 116, 62)),
               (1.0, GRASS_NEAR)],
    )
    g = Layer((0, horizon, W, H))
    g.img.alpha_composite(ground)
    g.onto(base)

    # broad sun sweep across the meadow
    def sweep(l):
        l.poly([(760, horizon), (W, horizon), (W, 980), (520, H), (150, H)],
               fill=(238, 216, 150, 58))
    soft(base, (100, horizon - 10, W, H), sweep, 90)

    # grass texture: short strokes, denser and larger toward the camera
    def blades(l):
        for _ in range(9000):
            u = rng.random() ** 0.6
            y = horizon + 6 + u * (H - horizon)
            x = rng.uniform(-20, W + 20)
            depth = (y - horizon) / (H - horizon)
            ln = lerp(4, 26, depth) * rng.uniform(0.6, 1.4)
            lean = rng.uniform(-0.42, 0.42)
            base_c = mix((132, 158, 92), (58, 84, 44), rng.random() * 0.9)
            if rng.random() < 0.22:
                base_c = mix(base_c, (198, 208, 122), 0.55)   # sunlit tips
            l.line([(x, y), (x + lean * ln, y - ln)], fill=base_c + (190,),
                   width=max(1, int(lerp(1, 3, depth))))
    soft(base, (0, horizon, W, H), blades, 0.7)

    # scattered wildflowers
    def flowers(l):
        for _ in range(150):
            u = rng.random() ** 0.5
            y = horizon + 30 + u * (H - horizon - 30)
            x = rng.uniform(0, W)
            r = lerp(1.6, 4.0, u) * rng.uniform(0.7, 1.3)
            col = rng.choice([(250, 244, 216), (246, 226, 130), (232, 214, 236)])
            l.circ(x, y, r, fill=col + (200,))
    soft(base, (0, horizon, W, H), flowers, 1.1)

    return base


# --------------------------------------------------------------------------
# the tree
# --------------------------------------------------------------------------

TRUNK_X = 430
GROUND_Y = 916          # where the trunk meets the grass
APPLE_HOME = (1086, 196)


def _branch(l, pts, w0, w1, col):
    """Taper a branch along a polyline."""
    n = len(pts)
    for i in range(n - 1):
        t0, t1 = i / (n - 1), (i + 1) / (n - 1)
        wa, wb = lerp(w0, w1, t0), lerp(w0, w1, t1)
        (x0, y0), (x1, y1) = pts[i], pts[i + 1]
        dx, dy = x1 - x0, y1 - y0
        ln = math.hypot(dx, dy) or 1
        nx, ny = -dy / ln, dx / ln
        l.poly([(x0 + nx * wa / 2, y0 + ny * wa / 2),
                (x1 + nx * wb / 2, y1 + ny * wb / 2),
                (x1 - nx * wb / 2, y1 - ny * wb / 2),
                (x0 - nx * wa / 2, y0 - ny * wa / 2)], fill=col)
        l.circ(x1, y1, wb / 2, fill=col)


MAIN_BRANCH = [(452, 372), (560, 322), (700, 268), (860, 218), (1000, 190), (1130, 184)]


def build_tree(base):
    rng = random.Random(5)
    box = (100, 0, 1500, GROUND_Y + 40)
    tree = Layer(box)

    # --- trunk with a flared, rooted base ---
    trunk = [
        (TRUNK_X - 118, GROUND_Y + 12), (TRUNK_X - 76, 860), (TRUNK_X - 62, 760),
        (TRUNK_X - 58, 640), (TRUNK_X - 54, 520), (TRUNK_X - 48, 420),
        (TRUNK_X - 40, 340),
        (TRUNK_X + 38, 336), (TRUNK_X + 46, 430), (TRUNK_X + 52, 540),
        (TRUNK_X + 60, 660), (TRUNK_X + 72, 780), (TRUNK_X + 96, 870),
        (TRUNK_X + 132, GROUND_Y + 12),
    ]
    tree.poly(trunk, fill=BARK)

    # root flare
    for rx, rw in ((-140, 30), (-96, 22), (110, 26), (154, 20)):
        tree.poly([(TRUNK_X + rx, GROUND_Y + 14),
                   (TRUNK_X + rx * 0.45, 848),
                   (TRUNK_X + rx * 0.45 + rw, 852),
                   (TRUNK_X + rx + rw * 1.6, GROUND_Y + 14)], fill=BARK)

    # limbs
    _branch(tree, MAIN_BRANCH, 62, 15, BARK)
    _branch(tree, [(438, 356), (330, 286), (232, 232), (150, 208)], 44, 10, BARK)
    _branch(tree, [(470, 400), (600, 372), (712, 392), (806, 430)], 30, 8, BARK)
    _branch(tree, [(444, 348), (470, 250), (500, 150), (516, 74)], 40, 9, BARK)
    _branch(tree, [(880, 214), (940, 262), (986, 320)], 14, 5, BARK)
    _branch(tree, [(700, 268), (742, 200), (770, 132)], 16, 5, BARK)

    # everything below is surface detail -- it gets clipped to the silhouette
    # we have drawn so far, otherwise blurred strokes bleed into the sky
    silhouette = tree.img.getchannel("A")
    detail = Layer(box)

    # bark: lit edge, shadowed edge, vertical grain
    def barklight(l):
        l.poly([(TRUNK_X + 20, 340), (TRUNK_X + 44, 430), (TRUNK_X + 52, 560),
                (TRUNK_X + 66, 700), (TRUNK_X + 92, 870), (TRUNK_X + 126, GROUND_Y + 10),
                (TRUNK_X + 76, GROUND_Y + 10), (TRUNK_X + 44, 800), (TRUNK_X + 30, 640),
                (TRUNK_X + 16, 480)], fill=BARK_LIT + (215,))
        _branch(l, [(p[0], p[1] - 12) for p in MAIN_BRANCH], 26, 5, BARK_LIT + (190,))
    soft(detail, box, barklight, 5)

    def barkdark(l):
        l.poly([(TRUNK_X - 118, GROUND_Y + 12), (TRUNK_X - 74, 856), (TRUNK_X - 60, 700),
                (TRUNK_X - 54, 520), (TRUNK_X - 42, 340), (TRUNK_X - 14, 338),
                (TRUNK_X - 24, 500), (TRUNK_X - 30, 700), (TRUNK_X - 44, 860),
                (TRUNK_X - 72, GROUND_Y + 12)], fill=BARK_DARK + (200,))
    soft(detail, box, barkdark, 7)

    def grain(l):
        for _ in range(150):
            x = TRUNK_X + rng.uniform(-58, 96)
            y = rng.uniform(345, GROUND_Y)
            ln = rng.uniform(40, 190)
            cur = rng.uniform(-9, 9)
            col = BARK_DARK if rng.random() < 0.6 else BARK_LIT
            l.line([(x, y), (x + cur * 0.5, y + ln * 0.5), (x + cur, y + ln)],
                   fill=col + (110,), width=rng.uniform(1.2, 3.2))
    soft(detail, box, grain, 1.2)

    detail.img.putalpha(ImageChops.multiply(detail.img.getchannel("A"), silhouette))
    detail.onto(tree)

    tree.onto(base)
    return base


def build_canopy(seed=1, dense=True):
    """The leaf canopy, returned as its own layer so it can sway."""
    rng = random.Random(seed)
    box = (0, 0, W, 520)
    can = Layer(box)

    # cluster anchors follow the limbs and fill the top of the frame
    anchors = []
    for i in range(len(MAIN_BRANCH) - 1):
        (x0, y0), (x1, y1) = MAIN_BRANCH[i], MAIN_BRANCH[i + 1]
        for k in range(7):
            t = k / 6.0
            anchors.append((lerp(x0, x1, t), lerp(y0, y1, t) - 34))
    for x in range(80, 1420, 52):
        anchors.append((x, 120 - 70 * math.sin(x / 420.0) + rng.uniform(-46, 46)))
    for x in range(120, 900, 60):
        anchors.append((x, 250 + rng.uniform(-70, 40)))
    anchors += [(190, 214), (300, 168), (250, 300), (610, 330), (800, 348), (960, 300)]

    # three passes: deep shade, mid body, sunlit crown
    for col, dy, rad, count, alpha in (
        (LEAF_DARK, 26, 88, 3, 235),
        (LEAF_MID, 6, 74, 3, 230),
        (LEAF_LIT, -22, 52, 2, 215),
        (LEAF_HOT, -40, 30, 1, 190),
    ):
        lay = Layer(box)
        for ax, ay in anchors:
            for _ in range(count):
                x = ax + rng.uniform(-46, 46)
                y = ay + dy + rng.uniform(-30, 30)
                r = rad * rng.uniform(0.55, 1.25)
                c = mix(col, LEAF_HOT, clamp((1400 - x) / 2600.0) * 0.35)
                lay.circ(x, y, r, fill=c + (alpha,))
        lay.blur(7)
        lay.onto(can)

    # individual leaves on the silhouette edge -- keeps it from reading as blobs
    edge = Layer(box)
    for _ in range(900):
        ax, ay = rng.choice(anchors)
        x = ax + rng.uniform(-96, 96)
        y = ay + rng.uniform(-72, 62)
        if y > 420:
            continue
        ln = rng.uniform(9, 20)
        ang = rng.uniform(0, math.tau)
        dx, dy2 = math.cos(ang) * ln, math.sin(ang) * ln
        px, py = -dy2 * 0.36, dx * 0.36
        c = rng.choice([LEAF_MID, LEAF_LIT, LEAF_HOT, LEAF_DARK])
        edge.poly([(x - dx, y - dy2), (x + px, y + py), (x + dx, y + dy2),
                   (x - px, y - py)], fill=c + (225,))
    edge.blur(0.8)
    edge.onto(can)

    return can


# --------------------------------------------------------------------------
# the apple
# --------------------------------------------------------------------------


def draw_apple(dest, cx, cy, r=27, rot=0.0, squash=0.0, with_stem=True, alpha=1.0):
    pad = r * 3 + 30
    box = (cx - pad, cy - pad, cx + pad, cy + pad)
    lay = Layer(box)

    rx = r * (1 + squash * 0.42)
    ry = r * (1 - squash * 0.40)

    # contact shadow side
    lay.ell((cx - rx, cy - ry, cx + rx, cy + ry), fill=APPLE_RED)

    def shade(l):
        l.ell((cx - rx * 0.5, cy - ry * 0.55, cx + rx * 1.08, cy + ry * 1.06),
              fill=APPLE_DARK + (220,))
    soft(lay, box, shade, r * 0.30)

    def lit(l):
        l.ell((cx - rx * 0.95, cy - ry * 0.98, cx + rx * 0.25, cy + ry * 0.30),
              fill=APPLE_LIT + (185,))
    soft(lay, box, lit, r * 0.32)

    def spec(l):
        l.ell((cx - rx * 0.62, cy - ry * 0.74, cx - rx * 0.14, cy - ry * 0.24),
              fill=(255, 236, 214, 225))
        l.circ(cx + rx * 0.34, cy + ry * 0.42, r * 0.16, fill=(255, 190, 160, 90))
    soft(lay, box, spec, r * 0.10)

    # the dimple at the top plus stem
    def dimple(l):
        l.ell((cx - rx * 0.30, cy - ry * 1.02, cx + rx * 0.30, cy - ry * 0.70),
              fill=APPLE_DARK + (190,))
    soft(lay, box, dimple, r * 0.14)

    if with_stem:
        lay.line([(cx, cy - ry * 0.88), (cx + r * 0.10, cy - ry * 1.28),
                  (cx + r * 0.30, cy - ry * 1.62)], fill=(84, 58, 34), width=r * 0.13)
        # a single leaf on the stem
        lx, ly = cx + r * 0.34, cy - ry * 1.52
        lay.poly([(lx, ly), (lx + r * 0.52, ly - r * 0.30), (lx + r * 0.78, ly + r * 0.06),
                  (lx + r * 0.30, ly + r * 0.20)], fill=LEAF_MID)

    if rot:
        lay.rotated(rot, (cx, cy))
    if alpha < 1.0:
        lay.fade(alpha)
    lay.onto(dest)


# --------------------------------------------------------------------------
# Newton
# --------------------------------------------------------------------------

# anchor points for the seated figure (design units)
HEAD_C = (1082, 556)          # centre of the skull
NECK_PIVOT = (1078, 664)      # head rotates about this
SHOULDER_L = (1176, 704)      # near shoulder (our right)
SHOULDER_R = (992, 710)       # far shoulder
HIP = (1062, 884)


def draw_head(dest, st):
    """Head, wig and face. Drawn upright then rotated about the neck."""
    box = (900, 380, 1290, 720)
    lay = Layer(box)

    cx, cy = HEAD_C[0] + st["head_dx"], HEAD_C[1] + st["head_dy"]
    rx, ry = 55, 66
    mid = cx + 14                      # face midline, three-quarter view to the right

    # --- wig, back mass (behind the face) ---
    wb = Layer(box)
    wig_dy = st["wig_dy"]
    for ox, oy, r in ((-46, -6, 56), (-30, 44, 54), (-38, 92, 46), (46, -2, 52),
                      (62, 48, 48), (54, 96, 40), (0, -34, 58), (8, 104, 44)):
        wb.circ(cx + ox, cy + oy + wig_dy * (0.5 + abs(oy) / 160.0), r, fill=WIG_SHADE)
    wb.blur(2.0)
    wb.onto(lay)

    # --- neck ---
    lay.poly([(cx - 22, cy + 44), (cx + 24, cy + 44), (cx + 28, cy + 116),
              (cx - 26, cy + 116)], fill=SKIN_SHADE)
    soft(lay, box, lambda l: l.poly(
        [(cx - 24, cy + 40), (cx + 26, cy + 40), (cx + 26, cy + 84), (cx - 24, cy + 84)],
        fill=SKIN_DEEP + (200,)), 9)

    # --- skull / face base ---
    lay.ell((cx - rx, cy - ry, cx + rx, cy + ry), fill=SKIN)
    # jaw and chin
    lay.ell((cx - rx * 0.74, cy + ry * 0.08, cx + rx * 0.92, cy + ry * 1.16), fill=SKIN)

    # form shading: light comes from the upper right
    def core_shadow(l):
        l.ell((cx - rx * 1.12, cy - ry * 0.92, cx + rx * 0.10, cy + ry * 1.10),
              fill=SKIN_SHADE + (185,))
    soft(lay, box, core_shadow, 13)

    def cheek_plane(l):
        l.ell((cx - rx * 0.30, cy + ry * 0.10, cx + rx * 0.86, cy + ry * 0.86),
              fill=SKIN_LIT + (120,))
        l.ell((cx + rx * 0.10, cy - ry * 0.66, cx + rx * 0.92, cy - ry * 0.02),
              fill=SKIN_LIT + (135,))
    soft(lay, box, cheek_plane, 12)

    # occlusion where the wig meets the forehead and under the jaw
    def occlusion(l):
        l.ell((cx - rx * 1.05, cy - ry * 1.20, cx + rx * 1.05, cy - ry * 0.38),
              fill=SKIN_DEEP + (170,))
        l.ell((cx - rx * 0.70, cy + ry * 0.86, cx + rx * 0.88, cy + ry * 1.34),
              fill=SKIN_DEEP + (150,))
    soft(lay, box, occlusion, 11)

    # warmth in the cheek and nose
    def blush(l):
        l.circ(mid + 30, cy + 20, 22, fill=(214, 128, 108, 105))
        l.circ(mid - 34, cy + 16, 17, fill=(214, 128, 108, 78))
        l.circ(mid + 8, cy + 32, 13, fill=(212, 132, 110, 92))
    soft(lay, box, blush, 12)

    # --- brows ---
    brow_y = cy - 30 - st["brow"] * 12
    bw, bc = 4.4, (108, 96, 88)
    lay.line([(mid - 44, brow_y + 5 + st["brow_tilt"]), (mid - 30, brow_y - 3),
              (mid - 12, brow_y - 1)], fill=bc, width=bw)
    lay.line([(mid + 14, brow_y - 2), (mid + 32, brow_y - 5 - st["brow_tilt"] * 0.4),
              (mid + 47, brow_y + 3)], fill=bc, width=bw)

    # --- eyes ---
    def eye(ex, ey, ew, eh, near):
        op = clamp(st["eye"], 0.0, 1.6)
        h = eh * op
        if h < 1.2:
            # closed: a soft lid line
            lay.line([(ex - ew, ey + 1), (ex, ey + 3), (ex + ew, ey)],
                     fill=(126, 96, 84), width=2.6)
            return
        lay.ell((ex - ew, ey - h, ex + ew, ey + h), fill=(246, 242, 236))
        # shadow cast by the upper lid
        soft(lay, box, lambda l: l.ell(
            (ex - ew, ey - h * 1.25, ex + ew, ey + h * 0.15),
            fill=(160, 146, 140, 150)), 3)
        # iris follows the gaze
        ix = ex + st["pupil_x"] * ew * 0.42
        iy = ey + st["pupil_y"] * h * 0.42
        ir = min(h * 0.94, ew * 0.56)
        lay.circ(ix, iy, ir, fill=(94, 118, 96))
        lay.circ(ix, iy, ir * 0.72, fill=(62, 88, 70))
        lay.circ(ix, iy, ir * 0.40, fill=(24, 22, 24))
        lay.circ(ix - ir * 0.34, iy - ir * 0.36, ir * 0.28, fill=(255, 255, 252, 240))
        lay.circ(ix + ir * 0.30, iy + ir * 0.34, ir * 0.14, fill=(255, 255, 252, 120))
        # lids
        lay.arc((ex - ew, ey - h * 1.06, ex + ew, ey + h * 1.06), 182, 358,
                fill=(96, 74, 64), width=2.6)
        if near:
            lay.arc((ex - ew, ey - h * 1.0, ex + ew, ey + h * 1.14), 8, 172,
                    fill=(168, 130, 112), width=1.8)

    eye_y = cy - 4
    eye(mid - 27, eye_y + 1, 11.8, 7.2, False)      # far eye, foreshortened
    eye(mid + 29, eye_y, 13.6, 8.2, True)           # near eye

    # --- nose ---
    nx, ny = mid + 8, cy + 16
    def nose_shade(l):
        l.poly([(nx - 4, ny - 26), (nx + 14, ny + 6), (nx + 6, ny + 18),
                (nx - 12, ny + 12)], fill=SKIN_DEEP + (150,))
    soft(lay, box, nose_shade, 6)
    def nose_lit(l):
        l.poly([(nx + 1, ny - 24), (nx + 10, ny + 2), (nx + 4, ny + 10),
                (nx - 1, ny - 6)], fill=SKIN_LIT + (190,))
    soft(lay, box, nose_lit, 3.5)
    lay.arc((nx - 13, ny - 2, nx + 15, ny + 22), 20, 170, fill=SKIN_DEEP + (190,), width=2.2)
    lay.circ(nx + 10, ny + 12, 3.0, fill=(150, 100, 84, 190))
    lay.circ(nx - 7, ny + 11, 2.6, fill=(150, 100, 84, 165))

    # --- mouth ---
    my = cy + 52
    mo = st["mouth"]
    if mo > 0.12:
        mw, mh = 15 + mo * 5, 4 + mo * 20
        lay.ell((mid - mw + 2, my - mh * 0.55, mid + mw + 2, my + mh * 0.75),
                fill=(112, 52, 52))
        lay.chord((mid - mw + 2, my + mh * 0.05, mid + mw + 2, my + mh * 1.05), 0, 180,
                  fill=(178, 96, 92))
        soft(lay, box, lambda l: l.ell(
            (mid - mw + 2, my - mh * 0.60, mid + mw + 2, my + mh * 0.10),
            fill=(58, 26, 30, 200)), 3)
    else:
        sm = st["smile"]
        lay.line([(mid - 17, my - sm * 2), (mid + 2, my + 3 + sm * 1),
                  (mid + 20, my - 1 - sm * 5)], fill=(146, 84, 76), width=3.0)
    # lower lip catch-light
    soft(lay, box, lambda l: l.ell(
        (mid - 10, my + 6, mid + 16, my + 15), fill=(240, 176, 158, 130)), 4)

    # --- chin and philtrum ---
    soft(lay, box, lambda l: l.line(
        [(mid + 6, my - 16), (mid + 6, my - 6)], fill=SKIN_DEEP + (120,), width=3), 3)
    soft(lay, box, lambda l: l.ell(
        (mid - 14, my + 20, mid + 20, my + 34), fill=SKIN_DEEP + (110,)), 7)

    # --- wig, front mass: baroque curls framing the face ---
    wf = Layer(box)
    top = [(-52, -44, 34), (-24, -62, 36), (10, -68, 34), (44, -58, 30), (66, -34, 26),
           (-66, -16, 30), (-72, 16, 28)]
    for ox, oy, r in top:
        wf.circ(cx + ox, cy + oy + wig_dy * 0.85, r, fill=WIG)
    # side curls, hanging and lagging behind the head
    for i, (ox, oy, r) in enumerate((
        (-70, 34, 26), (-74, 70, 24), (-66, 104, 21), (-52, 132, 18),
        (76, 26, 24), (82, 62, 22), (76, 96, 19), (62, 124, 16))):
        f = 0.6 + i % 4 * 0.22
        wf.circ(cx + ox, cy + oy + wig_dy * f, r, fill=WIG)
    wf.blur(1.4)
    wf.onto(lay)

    # wig volume: shade the underside, light the crown
    def wig_shade(l):
        for ox, oy, r in ((-70, 60, 30), (-64, 104, 24), (74, 62, 26), (68, 100, 22),
                          (-64, -18, 26), (-40, -44, 26)):
            l.circ(cx + ox, cy + oy + wig_dy * 0.7, r, fill=WIG_DEEP + (190,))
    soft(lay, box, wig_shade, 12)

    def wig_light(l):
        for ox, oy, r in ((6, -62, 26), (40, -52, 22), (-22, -58, 22), (70, -22, 18)):
            l.circ(cx + ox, cy + oy + wig_dy * 0.85, r, fill=(255, 252, 246, 190))
    soft(lay, box, wig_light, 9)

    # curl detail -- small arcs read as ringlets
    rngc = random.Random(11)
    for i in range(34):
        a = rngc.uniform(0, math.tau)
        rr = rngc.uniform(46, 82)
        ox = math.cos(a) * rr * 1.05
        oy = math.sin(a) * rr * 0.95 - 10
        if oy > 130 or (abs(ox) < 42 and -20 < oy < 60):
            continue
        cr = rngc.uniform(7, 13)
        col = WIG_DEEP if rngc.random() < 0.5 else (255, 253, 248)
        lay.arc((cx + ox - cr, cy + oy - cr + wig_dy * 0.8,
                 cx + ox + cr, cy + oy + cr + wig_dy * 0.8),
                rngc.uniform(0, 200), rngc.uniform(220, 360),
                fill=col + (150,), width=2.0)

    lay.rotated(st["head_ang"], NECK_PIVOT)
    lay.onto(dest)


def capsule(l, p0, p1, w0, w1, col):
    """A tapered limb segment with rounded joints."""
    (x0, y0), (x1, y1) = p0, p1
    dx, dy = x1 - x0, y1 - y0
    ln = math.hypot(dx, dy) or 1.0
    nx, ny = -dy / ln, dx / ln
    l.poly([(x0 + nx * w0 / 2, y0 + ny * w0 / 2),
            (x1 + nx * w1 / 2, y1 + ny * w1 / 2),
            (x1 - nx * w1 / 2, y1 - ny * w1 / 2),
            (x0 - nx * w0 / 2, y0 - ny * w0 / 2)], fill=col)
    l.circ(x0, y0, w0 / 2, fill=col)
    l.circ(x1, y1, w1 / 2, fill=col)


def draw_hand(lay, box, pos, ang, sc=1.0, spread=0.0):
    """Palm, four fanned fingers and a thumb -- reads far better than a blob."""
    x, y = pos
    ca, sa = math.cos(ang), math.sin(ang)

    def P(fwd, side):
        return (x + ca * fwd - sa * side, y + sa * fwd + ca * side)

    px, py = P(5 * sc, 0)
    lay.circ(px, py, 15 * sc, fill=SKIN)
    lay.poly([P(-8 * sc, -14 * sc), P(17 * sc, -12 * sc),
              P(19 * sc, 12 * sc), P(-6 * sc, 15 * sc)], fill=SKIN)

    for i in range(4):
        side = (i - 1.5) * 8.2 * sc
        ln = (25 - abs(i - 1.1) * 3.6) * sc
        a = ang + (i - 1.5) * (0.13 + spread * 0.12)
        bx, by = P(15 * sc, side)
        capsule(lay, (bx, by), (bx + math.cos(a) * ln, by + math.sin(a) * ln),
                8.6 * sc, 7.0 * sc, SKIN)

    ta = ang - 1.05
    bx, by = P(2 * sc, -12 * sc)
    capsule(lay, (bx, by), (bx + math.cos(ta) * 19 * sc, by + math.sin(ta) * 19 * sc),
            10.5 * sc, 8.0 * sc, SKIN)

    def sh(l):
        l.circ(*P(6 * sc, 7 * sc), 14 * sc, fill=SKIN_SHADE + (185,))
        for i in range(3):
            side = (i - 1.0) * 8.2 * sc
            b = P(20 * sc, side + 4 * sc)
            l.circ(b[0], b[1], 4.4 * sc, fill=SKIN_DEEP + (120,))
    soft(lay, box, sh, 5 * sc)

    def lt(l):
        l.circ(*P(6 * sc, -6 * sc), 11 * sc, fill=SKIN_LIT + (175,))
    soft(lay, box, lt, 6 * sc)


def draw_cuff(l, elbow, wrist, w=34):
    """A turned-back cuff band, laid across the arm rather than around it."""
    dx, dy = wrist[0] - elbow[0], wrist[1] - elbow[1]
    ln = math.hypot(dx, dy) or 1.0
    ux, uy = dx / ln, dy / ln
    px, py = -uy, ux
    cx, cy = wrist[0] - ux * 12, wrist[1] - uy * 12
    capsule(l, (cx - px * w / 2, cy - py * w / 2), (cx + px * w / 2, cy + py * w / 2),
            25, 25, COAT_LIT)
    capsule(l, (cx - px * (w - 10) / 2, cy - py * (w - 10) / 2),
            (cx + px * (w - 10) / 2, cy + py * (w - 10) / 2), 18, 18, LINEN)


def draw_shoe(l, ankle, dark):
    """Square-toed buckled shoe of the period."""
    ax, ay = ankle
    w, h = 72, 20
    l.rrect((ax - 16, ay + h - 9, ax + w + 2, ay + h + 7), 5, fill=(16, 14, 16))
    l.rrect((ax - 14, ay - h, ax + w - 8, ay + h), 10, fill=dark)
    l.poly([(ax + w - 34, ay - h + 2), (ax + w, ay - 4), (ax + w + 2, ay + h - 3),
            (ax + w - 38, ay + h)], fill=dark)
    l.rrect((ax - 2, ay - h - 7, ax + 24, ay + 2), 6, fill=dark)
    l.rrect((ax + 1, ay - h - 3, ax + 21, ay - h + 8), 3, fill=(212, 190, 130))
    l.rrect((ax + 6, ay - h + 1, ax + 16, ay - h + 5), 2, fill=dark)


def draw_leg(lay, box, hip, knee, ankle, breech, stocking, dim=0):
    """One seated leg: breeches to the knee, stocking, buckled shoe."""
    capsule(lay, hip, knee, 78, 56, breech)
    capsule(lay, knee, ankle, 44, 29, stocking)

    # gathered breeches band just below the knee
    dx, dy = ankle[0] - knee[0], ankle[1] - knee[1]
    ln = math.hypot(dx, dy) or 1.0
    bx, by = knee[0] + dx / ln * 22, knee[1] + dy / ln * 22
    capsule(lay, knee, (bx, by), 56, 48, breech)
    lay.circ(bx, by, 24, fill=mix(breech, (255, 255, 255), 0.22))

    draw_shoe(lay, ankle, (32, 28, 32))

    # form: shadow along the underside, light along the top
    def sh(l):
        capsule(l, (hip[0], hip[1] + 20), (knee[0], knee[1] + 18), 46, 34, (0, 0, 0, 130))
        capsule(l, (knee[0], knee[1] + 14), (ankle[0] + 4, ankle[1] + 10), 26, 18,
                (0, 0, 0, 105))
    soft(lay, box, sh, 13)

    def lt(l):
        capsule(l, (hip[0], hip[1] - 22), (knee[0], knee[1] - 20), 34, 26,
                mix(breech, (255, 240, 210), 0.55) + (185,))
        capsule(l, (knee[0], knee[1] - 14), (ankle[0], ankle[1] - 10), 20, 13,
                (255, 250, 238, 175))
    soft(lay, box, lt, 10)

    if dim:
        # push the far leg back with a touch of atmosphere
        def d(l):
            capsule(l, hip, knee, 82, 60, (34, 44, 52, dim))
            capsule(l, knee, ankle, 48, 34, (34, 44, 52, dim))
            l.rrect((ankle[0] - 16, ankle[1] - 22, ankle[0] + 74, ankle[1] + 28), 12,
                    fill=(34, 44, 52, dim))
        soft(lay, box, d, 6)


def draw_body(dest, st):
    box = (840, 590, 1600, 1020)
    lay = Layer(box)
    bob = st["breath"]

    sl = (SHOULDER_L[0], SHOULDER_L[1] + bob)          # near shoulder
    sr = (SHOULDER_R[0], SHOULDER_R[1] + bob)          # far shoulder

    # ---------------------------------------------------------------- far arm
    f_elbow, f_hand = (932, 800), (912, 876)
    capsule(lay, sr, f_elbow, 50, 42, COAT_DARK)
    capsule(lay, f_elbow, f_hand, 42, 32, COAT_DARK)
    draw_cuff(lay, f_elbow, f_hand, 30)
    draw_hand(lay, box, (f_hand[0] - 2, f_hand[1] + 12), 1.42, 0.92, spread=0.8)
    soft(lay, box, lambda l: capsule(
        l, (sr[0], sr[1] - 16), (f_elbow[0] - 6, f_elbow[1] - 16), 22, 18,
        COAT_LIT + (110,)), 10)

    # ------------------------------------------------------------------ torso
    torso = [
        (sr[0] - 30, sr[1] - 6), (1082, sr[1] - 26), (sl[0] + 28, sl[1] - 6),
        (sl[0] + 36, 802), (1204, 872), (1188, 932),
        (1060, 950), (964, 936), (944, 868), (sr[0] - 40, 800),
    ]
    lay.poly(torso, fill=COAT)
    # coat skirts pooling on the grass, kept tight so he does not read as a mound
    lay.ell((950, 878, 1198, 958), fill=COAT)
    lay.poly([(946, 880), (1000, 862), (1010, 950), (930, 946)], fill=COAT_DARK)

    def coat_light(l):
        l.poly([(1112, 706), (sl[0] + 26, sl[1] - 6), (sl[0] + 40, 806),
                (1200, 878), (1146, 900), (1116, 806)], fill=COAT_LIT + (205,))
        l.ell((1096, 884, 1200, 950), fill=COAT_LIT + (110,))
    soft(lay, box, coat_light, 15)

    def coat_dark(l):
        l.poly([(sr[0] - 34, sr[1]), (1014, 710), (996, 846), (962, 934), (942, 866)],
               fill=COAT_DARK + (215,))
        l.ell((944, 890, 1064, 956), fill=COAT_DARK + (140,))
    soft(lay, box, coat_dark, 15)

    for a, b, c in (((1078, 728), (1068, 806), (1056, 884)),
                    ((1136, 734), (1142, 818), (1156, 888)),
                    ((1022, 724), (1010, 800), (1000, 862))):
        soft(lay, box, lambda l, a=a, b=b, c=c: l.line(
            [a, b, c], fill=COAT_DARK + (165,), width=5), 4)

    # ----------------------------------------------- waistcoat and shirt front
    lay.poly([(1044, 694), (1124, 698), (1140, 846), (1082, 876), (1030, 840)],
             fill=(190, 168, 120))
    soft(lay, box, lambda l: l.poly(
        [(1102, 704), (1124, 698), (1140, 846), (1096, 864)],
        fill=(228, 208, 158, 190)), 8)
    for by in (730, 766, 802, 834):
        lay.circ(1086, by, 4.4, fill=(120, 100, 62))

    # ----------------------------------------------------------------- lapels
    lay.poly([(sr[0] - 22, sr[1] - 4), (1050, 690), (1036, 850), (990, 832), (982, 710)],
             fill=COAT_LIT)
    lay.poly([(sl[0] + 22, sl[1] - 4), (1128, 694), (1150, 856), (1192, 832),
              (1196, 708)], fill=COAT_LIT)
    soft(lay, box, lambda l: (
        l.line([(1050, 690), (1036, 850)], fill=COAT_DARK + (200,), width=5),
        l.line([(1128, 694), (1150, 856)], fill=COAT_DARK + (200,), width=5)), 3)

    # ---------------------------------------------------------------- cravat
    cv = Layer(box)
    cv.poly([(1048, 668), (1118, 670), (1130, 710), (1106, 770), (1074, 788),
             (1046, 762), (1038, 708)], fill=LINEN)
    for i in range(4):
        y = 698 + i * 24
        cv.arc((1040 + i * 3, y - 16, 1130 - i * 3, y + 18), 10, 170,
               fill=LINEN_SHADE, width=3.4)
    cv.onto(lay)
    soft(lay, box, lambda l: l.poly(
        [(1038, 672), (1076, 676), (1062, 786), (1040, 750)],
        fill=LINEN_SHADE + (190,)), 8)
    soft(lay, box, lambda l: l.ell(
        (1038, 658, 1132, 704), fill=(120, 96, 88, 175)), 10)

    # ------------------------------------------------------------------- legs
    # far leg first, dimmed slightly so it sits behind
    draw_leg(lay, box, (1046, 892), (1276, 872), (1382, 950),
             (44, 40, 58), (198, 196, 190), dim=70)
    draw_leg(lay, box, (1098, 882), (1320, 828), (1430, 940),
             BREECH, (230, 227, 216))

    # the coat skirt drapes back over the lap, so the thighs emerge from cloth
    # rather than being pasted across the front of the coat
    flap = Layer(box)
    flap.poly([(978, 852), (1084, 858), (1152, 886), (1160, 940), (1030, 952),
               (966, 930)], fill=COAT)
    flap.onto(lay)
    soft(lay, box, lambda l: l.poly(
        [(1090, 860), (1152, 888), (1158, 936), (1104, 944)],
        fill=COAT_LIT + (150,)), 12)
    soft(lay, box, lambda l: l.line(
        [(1084, 858), (1150, 890), (1158, 936)], fill=COAT_DARK + (185,), width=6), 5)

    # where the thighs meet the cloth, a soft contact shadow
    soft(lay, box, lambda l: l.ell((1120, 846, 1240, 906), fill=(30, 16, 20, 140)), 16)

    lay.onto(dest)


def draw_near_arm(dest, st):
    """His near arm, drawn after the book so the hand rests on top of it."""
    box = (1050, 560, 1420, 980)
    lay = Layer(box)
    bob = st["breath"]
    sl = (SHOULDER_L[0], SHOULDER_L[1] + bob)

    r = st["rub"]
    # the raised pose keeps the forearm clear of the wig, so the gesture reads
    elbow = (lerp(1244, 1256, r), lerp(802, 760, r) + bob * 0.4)
    wrist = (lerp(1270, 1218, r), lerp(866, 636, r) + bob * 0.2)
    # the hand turns over as it comes up: fingers across the page, then to the wig
    hand_ang = lerp(2.95, -1.75, r)

    # the sleeve is lifted in value so it separates from the coat behind it
    sleeve = mix(COAT, COAT_LIT, 0.42)
    capsule(lay, sl, elbow, 58, 47, sleeve)
    capsule(lay, elbow, wrist, 47, 36, sleeve)

    cx, cy = lerp(elbow[0], wrist[0], 0.72), lerp(elbow[1], wrist[1], 0.72)
    draw_cuff(lay, elbow, wrist, 36)

    hand = (wrist[0] + math.cos(hand_ang) * 14, wrist[1] + math.sin(hand_ang) * 14)
    draw_hand(lay, box, hand, hand_ang, 1.0, spread=0.25)

    # a cast shadow along the inside edge reads as the arm standing off the coat
    def seam(l):
        capsule(l, (sl[0] - 14, sl[1] + 10), (elbow[0] - 18, elbow[1] + 12), 30, 24,
                COAT_DARK + (215,))
        capsule(l, (elbow[0] - 14, elbow[1] + 14), (wrist[0] - 10, wrist[1] + 12), 24, 17,
                COAT_DARK + (185,))
    soft(lay, box, seam, 9)

    def rim(l):
        capsule(l, (sl[0] + 4, sl[1] - 20), (elbow[0] + 8, elbow[1] - 17), 21, 17,
                COAT_LIT + (225,))
        capsule(l, (elbow[0] + 6, elbow[1] - 15), (cx, cy - 13), 17, 13,
                COAT_LIT + (195,))
    soft(lay, box, rim, 8)

    # shoulder cap catching the light
    soft(lay, box, lambda l: l.ell(
        (sl[0] - 42, sl[1] - 32, sl[0] + 42, sl[1] + 22), fill=COAT_LIT + (155,)), 14)

    lay.onto(dest)


def draw_book(dest, st):
    """The open book on his lap, held by the near hand."""
    box = (1080, 760, 1420, 980)
    lay = Layer(box)
    bx, by = 1208, 842
    tilt = st["book_tilt"]

    # pages: two leaves meeting at the spine
    lay.poly([(bx - 92, by - 6), (bx - 4, by - 26), (bx - 4, by + 30), (bx - 88, by + 46)],
             fill=(242, 236, 218))
    lay.poly([(bx + 4, by - 26), (bx + 96, by - 2), (bx + 92, by + 50), (bx + 4, by + 30)],
             fill=(248, 243, 228))
    # covers
    lay.poly([(bx - 96, by + 2), (bx - 4, by - 18), (bx - 4, by + 36), (bx - 92, by + 52)],
             fill=(96, 58, 40))
    lay.poly([(bx + 4, by - 18), (bx + 100, by + 6), (bx + 96, by + 56), (bx + 4, by + 36)],
             fill=(110, 66, 44))
    lay.poly([(bx - 90, by - 2), (bx - 6, by - 22), (bx - 6, by + 28), (bx - 86, by + 44)],
             fill=(244, 239, 222))
    lay.poly([(bx + 6, by - 22), (bx + 94, by + 2), (bx + 90, by + 48), (bx + 6, by + 28)],
             fill=(250, 246, 232))

    # ruled text
    for i in range(7):
        t = i / 6.0
        y0 = lerp(by - 12, by + 30, t)
        y1 = lerp(by - 16, by + 26, t)
        lay.line([(bx - 78, y0 + 4), (bx - 16, y1 + 2)], fill=(150, 138, 118), width=1.6)
        lay.line([(bx + 16, y1 + 2), (bx + 80, y0 + 6)], fill=(150, 138, 118), width=1.6)

    soft(lay, box, lambda l: l.poly(
        [(bx - 20, by - 24), (bx + 20, by - 24), (bx + 18, by + 34), (bx - 18, by + 34)],
        fill=(150, 132, 104, 170)), 8)   # gutter shadow

    if tilt:
        lay.rotated(tilt, (bx, by))
    lay.onto(dest)


def draw_ground_shadow(dest):
    """Contact shadow anchoring the figure and the tree to the grass."""
    def sh(l):
        l.ell((880, 900, 1500, 1000), fill=(28, 44, 26, 150))
        l.ell((930, 916, 1240, 986), fill=(20, 34, 20, 130))
        l.ell((250, 890, 700, 972), fill=(28, 44, 26, 130))
    soft(dest, (200, 850, 1560, 1020), sh, 26)

    # long raking shadow cast across the meadow away from the sun
    def cast(l):
        l.poly([(1010, 930), (1180, 946), (700, 1080), (420, 1052)],
               fill=(30, 48, 28, 95))
        l.poly([(430, 916), (560, 918), (180, 1046), (40, 1000)],
               fill=(30, 48, 28, 80))
    soft(dest, (0, 880, 1300, H), cast, 30)


# --------------------------------------------------------------------------
# apple flight: real free-fall, then a simulated bounce
# --------------------------------------------------------------------------


def head_top_y(st):
    """Approximate y of the top of the wig, where the apple lands."""
    return HEAD_C[1] + st["head_dy"] - 66 - 40 + st["wig_dy"] * 0.85


IMPACT_Y = HEAD_C[1] - 66 - 40          # nominal, before any jolt
APPLE_R = 27


def simulate_bounce():
    """Ballistic bounce off the head, then roll to rest on the grass."""
    dt = 1.0 / FPS
    g = 1650.0
    ground = 958.0
    x, y = APPLE_HOME[0] + 6, IMPACT_Y - APPLE_R + 8
    # it is deflected sideways far more than it is kicked upward -- a big
    # vertical rebound is what makes a bounce read as floaty
    vx, vy = 250.0, -125.0
    rot = 0.0
    out = []
    for _ in range(NFRAMES):
        vy += g * dt
        x += vx * dt
        y += vy * dt
        rot -= vx * dt * 0.9
        if y > ground:
            y = ground - (y - ground) * 0.42
            vy = -vy * 0.42
            vx *= 0.74
            if abs(vy) < 70:
                vy = 0.0
                y = ground
                vx *= 0.86
        if y >= ground - 0.6:
            vx *= 0.94                    # rolling friction
            if abs(vx) < 6:
                vx = 0.0
        out.append((x, y, rot))
    return out


BOUNCE = simulate_bounce()


# --------------------------------------------------------------------------
# animation state for a given time
# --------------------------------------------------------------------------


def state_at(t):
    st = {
        "head_ang": 0.0, "head_dx": 0.0, "head_dy": 0.0, "wig_dy": 0.0,
        "eye": 1.0, "brow": 0.0, "brow_tilt": 0.0, "mouth": 0.0, "smile": 0.4,
        "pupil_x": 0.0, "pupil_y": 0.0, "breath": 0.0, "rub": 0.0,
        "book_tilt": -6.0, "sway": 0.0, "glow": 0.0, "eq": 0.0, "flash": 0.0,
        "apple": None, "stem_stretch": 0.0, "impact_u": -1.0,
    }

    # --- idle life: breathing and blinks run the whole time ---
    st["breath"] = math.sin(t * 1.9) * 3.0 + math.sin(t * 0.7) * 1.4
    st["head_ang"] = math.sin(t * 0.8 + 1.1) * 0.8
    st["head_dy"] = math.sin(t * 1.9 + 0.4) * 1.6

    for bt in (0.75, 3.95, 5.35, 6.9, 8.35):
        b = span(t, bt, bt + 0.16)
        if 0.0 < b < 1.0:
            st["eye"] *= abs(math.cos(b * math.pi)) ** 0.6

    # reading pose: head tipped down toward the book
    st["head_ang"] += 7.0
    st["pupil_x"], st["pupil_y"] = 0.55, 0.60
    st["smile"] = 0.5

    # canopy sway
    st["sway"] = math.sin(t * 1.15) * 5.0 + math.sin(t * 2.3 + 1.0) * 2.0

    # --- the apple ---
    if t < T_DROP:
        # hanging, with a growing tremble as the stem gives way
        stress = span(t, T_STRESS, T_DROP)
        amp = 1.2 + stress * 7.0
        freq = 5.0 + stress * 16.0
        ax = APPLE_HOME[0] + math.sin(t * freq) * amp * 0.8
        ay = APPLE_HOME[1] + math.cos(t * freq * 0.9) * amp * 0.35 + stress * 5
        st["apple"] = (ax, ay, math.sin(t * freq) * 7 * (0.3 + stress), 0.0, True)
        st["stem_stretch"] = stress
    elif t < T_HIT:
        # free fall: distance grows with the square of elapsed time
        u = (t - T_DROP) / T_FALL
        y0 = APPLE_HOME[1] + 5
        y1 = IMPACT_Y - APPLE_R + 4
        ay = y0 + (y1 - y0) * (u * u)
        ax = APPLE_HOME[0] + 4 * u
        st["apple"] = (ax, ay, -18 * u * u, 0.0, True)
    else:
        idx = min(len(BOUNCE) - 1, int((t - T_HIT) * FPS))
        ax, ay, rot = BOUNCE[idx]
        sq = 0.0
        u = t - T_HIT
        if u < 0.10:
            sq = math.sin(clamp(u / 0.10) * math.pi) * 0.34
        st["apple"] = (ax, ay, rot, sq, False)

    # --- impact reaction ---
    if t >= T_HIT:
        u = t - T_HIT
        st["impact_u"] = u

        # head is driven down, then springs back with decreasing overshoot
        st["head_dy"] += 19.0 * math.exp(-6.5 * u) * math.cos(19.0 * u)
        st["head_ang"] += 5.5 * math.exp(-6.0 * u) * math.cos(17.0 * u + 0.3)
        st["head_dx"] += 4.0 * math.exp(-6.0 * u) * math.cos(16.0 * u + 0.8)
        # the wig lags the skull, then keeps jiggling a beat longer
        st["wig_dy"] = 15.0 * math.exp(-4.2 * u) * math.cos(13.0 * u - 0.85)
        st["breath"] += 8.0 * math.exp(-7.0 * u) * math.cos(18.0 * u)

        st["flash"] = max(0.0, 1.0 - u / 0.22)

        # eyes: clamp shut on contact, then fly wide
        if u < 0.13:
            st["eye"] = 0.04
        elif u < 0.30:
            st["eye"] = lerp(0.04, 1.45, smooth(span(u, 0.13, 0.30)))
        elif u < 1.1:
            st["eye"] = lerp(1.45, 1.12, smooth(span(u, 0.30, 1.1)))
        else:
            st["eye"] = lerp(1.12, 1.0, smooth(span(u, 1.1, 2.2)))
        for bt in (3.95, 5.35, 6.9, 8.35):
            b = span(t, bt, bt + 0.16)
            if 0.0 < b < 1.0:
                st["eye"] *= abs(math.cos(b * math.pi)) ** 0.6

        st["brow"] = smooth(span(u, 0.10, 0.34)) * 1.0
        st["brow"] *= lerp(1.0, 0.55, smooth(span(u, 1.4, 3.0)))
        st["brow_tilt"] = -3.0 * smooth(span(u, 0.10, 0.30))

        # a startled "oh"
        st["mouth"] = smooth(span(u, 0.08, 0.26)) * 1.0
        st["mouth"] *= 1.0 - smooth(span(u, 0.9, 1.5))
        st["smile"] = 0.1

        # the free hand comes up to rub the sore spot, then drops back
        st["rub"] = smooth(span(u, 0.35, 0.80)) * (1 - smooth(span(u, 1.30, 1.95)))
        st["book_tilt"] = -6.0 - 22.0 * smooth(span(u, 0.05, 0.4)) * \
            (1 - smooth(span(u, 2.4, 3.2)))

    # --- gaze: down at the apple, then up at the tree, then the idea ---
    if t >= T_HIT:
        u = t - T_HIT
        # startled scan
        gx, gy = 0.2, -0.15
        if t >= T_LOOK_DOWN:
            d = smooth(span(t, T_LOOK_DOWN, T_LOOK_DOWN + 0.45))
            gx = lerp(gx, 0.85, d)
            gy = lerp(gy, 0.75, d)
            st["head_ang"] += 5.0 * d
        if t >= T_LOOK_UP:
            d = smooth(span(t, T_LOOK_UP, T_LOOK_UP + 0.55))
            gx = lerp(gx, -0.15, d)
            gy = lerp(gy, -0.85, d)
            st["head_ang"] += lerp(0, -19.0, d)
            st["head_dy"] += lerp(0, -6.0, d)
        if t >= T_IDEA:
            d = smooth(span(t, T_IDEA, T_IDEA + 0.6))
            gx = lerp(gx, 0.05, d)
            gy = lerp(gy, -0.2, d)
            st["head_ang"] += lerp(0, 9.0, d)
            # an "oh!" that resolves into a satisfied closed smile
            oh = d * (1 - smooth(span(t, T_IDEA + 0.9, T_IDEA + 1.7)))
            st["mouth"] = max(st["mouth"] * (1 - d), 0.34 * oh)
            st["brow"] = max(st["brow"], 0.9 * d)
            st["smile"] = 1.0
            st["glow"] = smooth(span(t, T_IDEA + 0.1, T_IDEA + 0.8))
            st["eq"] = smooth(span(t, T_IDEA + 0.45, T_IDEA + 1.25))
            # a small satisfied nod
            st["head_ang"] += 2.2 * math.sin((t - T_IDEA) * 5.0) * \
                math.exp(-1.2 * (t - T_IDEA))
        st["pupil_x"], st["pupil_y"] = gx, gy

    return st


# --------------------------------------------------------------------------
# effects
# --------------------------------------------------------------------------


def draw_stem(dest, st, t):
    """The stem on the branch, stretching before it snaps."""
    if t >= T_DROP:
        return
    ax, ay = st["apple"][0], st["apple"][1]
    lay = Layer((980, 120, 1200, 270))
    sx, sy = 1092, 182
    # the twig it hangs from, so the attachment reads against the leaves
    lay.line([(1006, 158), (1050, 170), (1092, 182)], fill=(94, 68, 40), width=6)
    lay.line([(1050, 170), (1074, 148)], fill=(94, 68, 40), width=4)
    lay.line([(sx, sy), (lerp(sx, ax, 0.5) + 3, lerp(sy, ay, 0.5) - 4),
              (ax + 8, ay - 30)], fill=(88, 62, 36), width=3.4)
    lay.onto(dest)


def draw_impact(dest, st):
    u = st["impact_u"]
    if u < 0 or u > 0.85:
        return
    cx, cy = HEAD_C[0] + st["head_dx"] + 6, IMPACT_Y + st["head_dy"] * 0.5
    box = (cx - 300, cy - 240, cx + 300, cy + 200)

    # expanding shock rings
    for i, delay in enumerate((0.0, 0.09)):
        p = span(u, delay, delay + 0.42)
        if 0.0 < p < 1.0:
            r = lerp(18, 132, ease_out(p))
            a = int(210 * (1 - p) ** 1.6)
            lay = Layer(box)
            lay.ell((cx - r * 1.25, cy - r * 0.7, cx + r * 1.25, cy + r * 0.7),
                    outline=(255, 246, 214, a), width=max(1.5, 6 * (1 - p)))
            lay.onto(dest)

    # radiating impact lines
    p = span(u, 0.0, 0.30)
    if p < 1.0:
        lay = Layer(box)
        a = int(235 * (1 - p))
        for k in range(9):
            ang = math.radians(-172 + k * 18.5 + math.sin(k) * 5)
            r0 = lerp(24, 62, ease_out(p))
            r1 = r0 + lerp(30, 8, p)
            lay.line([(cx + math.cos(ang) * r0, cy + math.sin(ang) * r0 * 0.8),
                      (cx + math.cos(ang) * r1, cy + math.sin(ang) * r1 * 0.8)],
                     fill=(255, 240, 200, a), width=lerp(6, 2, p))
        lay.onto(dest)

    # tumbling stars
    p = span(u, 0.05, 0.85)
    if 0.0 < p < 1.0:
        lay = Layer(box)
        a = int(255 * (1 - p) ** 1.3)
        for k in range(6):
            ang = math.radians(-160 + k * 24)
            d = lerp(30, 150, ease_out(p))
            sx = cx + math.cos(ang) * d
            sy = cy + math.sin(ang) * d * 0.75 + p * p * 60
            rr = lerp(15, 7, p)
            spin = p * 220 + k * 40
            pts = []
            for j in range(10):
                aa = math.radians(spin + j * 36 - 90)
                rad = rr if j % 2 == 0 else rr * 0.42
                pts.append((sx + math.cos(aa) * rad, sy + math.sin(aa) * rad))
            lay.poly(pts, fill=(255, 232, 150, a))
        lay.blur(0.8)
        lay.onto(dest)

    # bright flash at the contact point
    if st["flash"] > 0:
        soft(dest, box, lambda l: l.circ(cx, cy, 46, fill=(255, 248, 220, 200)), 26,
             alpha=st["flash"])


def _text_w(font, s):
    """Width of a string in design units."""
    return _MEASURE.textlength(s, font=font) / SS


_MEASURE = ImageDraw.Draw(Image.new("L", (8, 8)))


def draw_idea(dest, st, t, font_eq, font_cap):
    if st["glow"] <= 0.001:
        return
    g = st["glow"]
    cx, cy = HEAD_C[0] + 10, HEAD_C[1] - 30

    # warm halo behind the head -- full-canvas layers, so the wide blur never
    # runs into a patch edge and banks up as a visible seam
    for r, a in ((300, 20), (200, 27), (128, 34)):
        soft(dest, None,
             lambda l, rr=r, aa=a: l.circ(cx, cy - 40, rr, fill=(255, 226, 150, aa)),
             r * 0.4, alpha=g)

    # the law itself, set as a proper fraction in a period serif
    if st["eq"] > 0.01:
        e = st["eq"]
        ey = 452
        drift = (1 - e) * 18
        # generous padding: the backing glow is blurred hard, and a tight box
        # would clip that blur into a visible rectangle in the sky
        box = (1110, 220, 1920, 710)
        lay = Layer(box)

        lead = "F = G"
        x0 = 1268
        lay.text((x0, ey + drift), lead, font=font_eq, fill=(54, 38, 24), anchor="lm")

        # the fraction sits to the right of the lead-in, centred on the rule
        num, den = "m\u2081m\u2082", "r\u00b2"
        half = max(_text_w(font_cap, num), _text_w(font_cap, den)) / 2 + 22
        fx = x0 + _text_w(font_eq, lead) + 34 + half

        lay.text((fx, ey - 40 + drift), num, font=font_cap, fill=(54, 38, 24))
        lay.text((fx, ey + 42 + drift), den, font=font_cap, fill=(54, 38, 24))
        lay.line([(fx - half, ey + drift), (fx + half, ey + drift)],
                 fill=(54, 38, 24), width=4)

        # a soft light behind it so the dark serif holds against the sky
        glow = Layer(box)
        glow.rrect((x0 - 54, ey - 104 + drift, fx + half + 54, ey + 104 + drift), 52,
                   fill=(255, 246, 214, 112))
        glow.blur(34).fade(e * 0.8)
        glow.onto(dest)

        lay.fade(e * 0.96).onto(dest)


def draw_motes(dest, t, seed=99):
    """Pollen drifting in the sun -- cheap, and it sells the depth."""
    rng = random.Random(seed)
    lay = Layer((0, 200, W, H))
    for _ in range(90):
        bx = rng.uniform(0, W)
        by = rng.uniform(240, H - 40)
        sp = rng.uniform(0.15, 0.7)
        ph = rng.uniform(0, math.tau)
        x = bx + math.sin(t * sp + ph) * 40 + t * sp * 14
        y = by - t * sp * 10 + math.cos(t * sp * 1.4 + ph) * 18
        x = 0 + (x % W)
        r = rng.uniform(1.4, 4.2)
        a = int(rng.uniform(70, 190) * (0.5 + 0.5 * math.sin(t * 2 + ph)))
        lay.circ(x, y, r, fill=(255, 246, 208, max(0, a)))
    lay.blur(1.6)
    lay.onto(dest)


def draw_falling_leaves(dest, t):
    """A couple of leaves shaken loose by the impact."""
    if t < T_HIT:
        return
    u = t - T_HIT
    rng = random.Random(4)
    lay = Layer((860, 180, 1400, 1000))
    starts = ((996, 214), (1052, 196), (1118, 208), (1074, 244), (1156, 230))
    for k in range(5):
        d = u - k * 0.22
        if d < 0:
            continue
        sx, sy = starts[k]
        # leaves do not fall, they slip sideways as they turn over
        x = sx + math.sin(d * 2.2 + k * 1.7) * 62 + d * 26
        y = sy + d * 118 + d * d * 22
        if y > 960:
            continue
        ang = math.sin(d * 4 + k) * 60
        ln = 13
        dx, dy = math.cos(math.radians(ang)) * ln, math.sin(math.radians(ang)) * ln
        px, py = -dy * 0.4, dx * 0.4
        a = int(235 * clamp(1 - (y - 860) / 100.0))
        lay.poly([(x - dx, y - dy), (x + px, y + py), (x + dx, y + dy),
                  (x - px, y - py)], fill=LEAF_LIT + (a,))
    lay.onto(dest)


# --------------------------------------------------------------------------
# grade: dappled light, vignette, grain
# --------------------------------------------------------------------------


def build_foreground_grass():
    """Blades that overlap the figure's base so he is seated *in* the meadow."""
    rng = random.Random(202)
    lay = Layer((0, 880, W, H))
    for _ in range(2600):
        x = rng.uniform(-20, W + 20)
        y = rng.uniform(918, H + 20)
        depth = clamp((y - 918) / (H - 918))
        ln = lerp(20, 62, depth) * rng.uniform(0.6, 1.35)
        lean = rng.uniform(-0.45, 0.45)
        c = mix((96, 128, 66), (38, 62, 34), rng.random())
        if rng.random() < 0.16:
            c = mix(c, (196, 206, 118), 0.5)
        lay.line([(x, y), (x + lean * ln * 0.5, y - ln * 0.55), (x + lean * ln, y - ln)],
                 fill=c + (235,), width=max(1, int(lerp(2, 4, depth))))
    lay.blur(0.8)
    return lay


def build_dapple():
    rng = random.Random(77)
    lay = Layer()
    for _ in range(70):
        x = rng.uniform(0, W)
        y = rng.uniform(560, H)
        r = rng.uniform(28, 110)
        lay.ell((x - r, y - r * 0.45, x + r, y + r * 0.45),
                fill=(255, 238, 186, rng.randint(20, 52)))
    lay.blur(22)
    return lay


def build_vignette():
    yy, xx = np.mgrid[0:H * SS, 0:W * SS]
    cx, cy = W * SS / 2, H * SS / 2
    d = np.sqrt(((xx - cx) / (W * SS * 0.62)) ** 2 + ((yy - cy) / (H * SS * 0.66)) ** 2)
    a = np.clip((d - 0.72) * 210, 0, 118).astype(np.uint8)
    v = np.zeros((H * SS, W * SS, 4), dtype=np.uint8)
    v[..., 0] = 24
    v[..., 1] = 22
    v[..., 2] = 34
    v[..., 3] = a
    return Image.fromarray(v, "RGBA")


def finish(frame_layer, vignette, grain_seed):
    img = frame_layer.img
    img.alpha_composite(vignette)
    rgb = img.convert("RGB").resize((W, H), Image.LANCZOS)

    arr = np.asarray(rgb).astype(np.int16)
    # gentle warm grade: lift the highlights warm, cool the shadows
    lum = arr.mean(axis=2) / 255.0
    arr[..., 0] += (lum * 9 - 3).astype(np.int16)
    arr[..., 2] += ((1 - lum) * 8 - 3).astype(np.int16)
    # film grain
    rng = np.random.default_rng(grain_seed)
    arr += rng.integers(-3, 4, arr.shape, dtype=np.int16)
    return Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8), "RGB")


# --------------------------------------------------------------------------
# render
# --------------------------------------------------------------------------


def render_frame(f, cache, fonts):
    t = f / FPS
    st = state_at(t)

    frame = Layer()
    frame.img.alpha_composite(cache["bg"].img)

    # canopy sways as one mass
    canopy = cache["canopy"]
    canopy.onto(frame, dx=st["sway"], dy=st["sway"] * 0.25)

    draw_ground_shadow(frame)
    draw_body(frame, st)
    draw_book(frame, st)
    draw_near_arm(frame, st)
    draw_head(frame, st)

    # foreground grass goes in before the apple, so the apple that has come to
    # rest still reads instead of disappearing into the blades
    cache["fg_grass"].onto(frame)

    # apple, with a motion streak while it is falling fast
    ax, ay, arot, asq, stem = st["apple"]
    if T_DROP <= t < T_HIT:
        u = (t - T_DROP) / T_FALL
        speed = u * (IMPACT_Y - APPLE_HOME[1]) * 2 / T_FALL
        trail = clamp(speed / 900.0)
        for k in (3, 2, 1):
            back = ay - k * 9 * trail
            draw_apple(frame, ax, back, APPLE_R, arot, 0.0, stem,
                       alpha=0.16 * trail * (4 - k) / 3)
    draw_apple(frame, ax, ay, APPLE_R, arot, asq, stem)
    draw_stem(frame, st, t)

    draw_falling_leaves(frame, t)
    draw_impact(frame, st)
    draw_idea(frame, st, t, fonts["eq"], fonts["cap"])

    cache["dapple"].onto(frame, dx=st["sway"] * 0.6)
    draw_motes(frame, t)

    return finish(frame, cache["vignette"], f)


def build_cache():
    bg = build_sky()
    build_clouds(bg)
    build_hills(bg)
    build_meadow(bg)
    build_tree(bg)
    return {
        "bg": bg,
        "canopy": build_canopy(),
        "fg_grass": build_foreground_grass(),
        "dapple": build_dapple(),
        "vignette": build_vignette(),
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--peek", type=int, default=None,
                    help="render a single frame to build/peek_<n>.png and stop")
    ap.add_argument("--peeks", type=str, default=None,
                    help="comma-separated frame numbers to render as stills")
    args = ap.parse_args()

    os.makedirs(FRAME_DIR, exist_ok=True)

    fonts = {
        "eq": ImageFont.truetype(FONT_SERIF_BOLD, 86 * SS),
        "cap": ImageFont.truetype(FONT_SERIF_BOLD, 46 * SS),
    }

    print("building static scene layers ...")
    cache = build_cache()

    if args.peek is not None or args.peeks:
        nums = [args.peek] if args.peek is not None else \
            [int(s) for s in args.peeks.split(",")]
        for n in nums:
            img = render_frame(n, cache, fonts)
            p = os.path.join(OUT_DIR, f"peek_{n:04d}.png")
            img.save(p)
            print("wrote", p)
        return

    print(f"rendering {NFRAMES} frames ...")
    for f in range(NFRAMES):
        img = render_frame(f, cache, fonts)
        img.save(os.path.join(FRAME_DIR, f"f{f:04d}.png"))
        if f % 15 == 0:
            print(f"  frame {f}/{NFRAMES}")

    print("encoding mp4 ...")
    import imageio_ffmpeg
    ff = imageio_ffmpeg.get_ffmpeg_exe()
    subprocess.run([
        ff, "-y", "-framerate", str(FPS),
        "-i", os.path.join(FRAME_DIR, "f%04d.png"),
        "-c:v", "libx264", "-preset", "slow", "-crf", "17",
        "-pix_fmt", "yuv420p", "-movflags", "+faststart",
        MP4_PATH,
    ], check=True)
    print("wrote", MP4_PATH)


if __name__ == "__main__":
    main()
