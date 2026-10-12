#!/usr/bin/env python3
"""Generate the item icons, the UI button icons, item_texture.json and the preview sheet.

Usage (from the repo root, i.e. the `cursed-eyeball-guardian` folder):

    python3 tools/gen_icons.py

Outputs (resource pack, SPEC section 10):
    textures/items/ceg/eyeball_summoner.png      32x32  Cursed Summoning Eye
    textures/items/ceg/eyeball_upgrade.png       32x32  Eyeball Upgrade Core
    textures/items/ceg/eyeball_controller.png    32x32  Eyeball Ability Controller
    textures/ceg/ui/<name>.png                   32x32  ability-menu button icons
    textures/item_texture.json                   icon keys ceg_eyeball_*
and docs/preview/icons_particles.png (nearest-neighbour contact sheet that also shows the
particle atlas built by tools/gen_particles.py).

All art is hand-placed pixel geometry (no randomness), so output is deterministic.
Style: Minecraft item pixel art, 1-px dark outline, crimson / obsidian palette.
"""
from __future__ import annotations

import json
import math
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
RP = ROOT / "packs" / "Cursed_Eyeball_Guardian_RP"
ITEM_DIR = RP / "textures" / "items" / "ceg"
UI_DIR = RP / "textures" / "ceg" / "ui"
ITEM_TEXTURE_JSON = RP / "textures" / "item_texture.json"
PREVIEW = ROOT / "docs" / "preview" / "icons_particles.png"

N = 32

# ------------------------------------------------------------------ palette (RGBA tuples)
def rgb(h, a=255):
    h = h.lstrip("#")
    return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), a)


OUT = rgb("1c0307")          # outline: near-black crimson
SCLERA = [rgb("fffaf4"), rgb("efe4dd"), rgb("dccbc6"), rgb("c3a9a8"), rgb("9c7a80")]
VEIN = rgb("c4202c")
VEIN_D = rgb("8e0f1c")
IRIS = [rgb("ffb59a"), rgb("ff5a44"), rgb("f0242a"), rgb("bf0c18"), rgb("7d000c")]
PUPIL = rgb("0e0306")
WHITE = rgb("ffffff")
OBS = [rgb("0f0a16"), rgb("1f1530"), rgb("33244a"), rgb("4b3868"), rgb("6d559a")]
TIP = [rgb("ff8a70"), rgb("ff2a2a"), rgb("b3000c")]
GOLD = [rgb("fff3a0"), rgb("fcd34a"), rgb("dba122"), rgb("9a6512")]
DIAM = [rgb("e8fffd"), rgb("8ff3ea"), rgb("2fc9c4"), rgb("15868f")]
CRIM = [rgb("ff9b96"), rgb("ff3b45"), rgb("d8102a"), rgb("9a0018"), rgb("5c0010")]
STEEL = [rgb("ffffff"), rgb("e3dde4"), rgb("b4a9b8"), rgb("7c6e85")]
PAPER = [rgb("fff2d6"), rgb("eed7a8"), rgb("c9a46a"), rgb("8d6a3a")]
MOON = [rgb("fffbe0"), rgb("f3e7a6"), rgb("cbb86a")]
SKIN_IRIS = {  # SPEC skin colours (primary / hot / dark)
    "crimson": (rgb("ff1414"), rgb("ffbfa6"), rgb("730005")),
    "void": (rgb("b833ff"), rgb("f2ccff"), rgb("4d0080")),
    "frost": (rgb("2699ff"), rgb("ccf2ff"), rgb("00388c")),
    "toxic": (rgb("40ff4d"), rgb("d9ffb3"), rgb("006614")),
}
CLEAR = (0, 0, 0, 0)


# ------------------------------------------------------------------ tiny pixel toolkit
class Icon:
    def __init__(self, n=N):
        self.n = n
        self.a = np.zeros((n, n, 4), dtype=np.uint8)
        ys, xs = np.mgrid[0:n, 0:n]
        self.x = xs + 0.5  # pixel-centre coordinates
        self.y = ys + 0.5

    # --- primitives
    def put(self, x, y, c):
        if 0 <= x < self.n and 0 <= y < self.n:
            self.a[y, x] = c

    def get(self, x, y):
        return tuple(self.a[y, x])

    def paint(self, mask, c):
        self.a[mask] = c

    def opaque(self):
        return self.a[..., 3] > 0

    def circle_mask(self, cx, cy, r):
        return (self.x - cx) ** 2 + (self.y - cy) ** 2 <= r * r

    def ellipse_mask(self, cx, cy, rx, ry):
        return ((self.x - cx) / rx) ** 2 + ((self.y - cy) / ry) ** 2 <= 1.0

    def poly_mask(self, pts):
        img = Image.new("L", (self.n, self.n), 0)
        ImageDraw.Draw(img).polygon([(round(px * 4) / 4, round(py * 4) / 4) for px, py in pts], fill=255)
        return np.array(img) > 0

    def line_mask(self, x0, y0, x1, y1, w=1.0):
        """Pixels whose centre is within w/2 of the segment."""
        px, py = self.x - x0, self.y - y0
        dx, dy = x1 - x0, y1 - y0
        L2 = dx * dx + dy * dy or 1e-9
        t = np.clip((px * dx + py * dy) / L2, 0, 1)
        d = np.hypot(px - t * dx, py - t * dy)
        return d <= w / 2.0

    def pixel_line(self, x0, y0, x1, y1, c):
        """Bresenham 1-px line in integer pixel coordinates."""
        dx, dy = abs(x1 - x0), -abs(y1 - y0)
        sx, sy = (1 if x0 < x1 else -1), (1 if y0 < y1 else -1)
        err = dx + dy
        while True:
            self.put(x0, y0, c)
            if x0 == x1 and y0 == y1:
                break
            e2 = 2 * err
            if e2 >= dy:
                err += dy
                x0 += sx
            if e2 <= dx:
                err += dx
                y0 += sy

    def bevel(self, mask, base, light, dark, light2=None):
        """Fill mask with base; top/left edge pixels light, bottom/right edge pixels dark."""
        self.paint(mask, base)
        m = mask
        up = np.zeros_like(m); up[1:] = m[:-1]
        left = np.zeros_like(m); left[:, 1:] = m[:, :-1]
        down = np.zeros_like(m); down[:-1] = m[1:]
        right = np.zeros_like(m); right[:, :-1] = m[:, 1:]
        self.paint(m & (~down | ~right), dark)
        self.paint(m & (~up | ~left) & down & right, light)
        if light2 is not None:
            self.paint(m & ~up & ~left, light2)

    def sphere(self, cx, cy, r, ramp, light=(-0.55, -0.65, 0.52), mask=None):
        """Lit sphere quantised to the colour ramp (ramp[0] brightest)."""
        m = self.circle_mask(cx, cy, r) if mask is None else mask
        nx = (self.x - cx) / r
        ny = (self.y - cy) / r
        nz = np.sqrt(np.clip(1 - nx * nx - ny * ny, 0, 1))
        lx, ly, lz = light
        ln = math.sqrt(lx * lx + ly * ly + lz * lz)
        lam = np.clip((nx * lx + ny * ly + nz * lz) / ln, 0, 1)
        idx = np.clip(((1 - lam) * (len(ramp) - 0.01)).astype(int), 0, len(ramp) - 1)
        for i, c in enumerate(ramp):
            self.paint(m & (idx == i), c)
        return m

    def outline(self, c=OUT, diagonal=False):
        """1-px outline around every opaque pixel (4-neighbour, optionally 8)."""
        m = self.opaque()
        grow = np.zeros_like(m)
        shifts = [(0, 1), (0, -1), (1, 0), (-1, 0)]
        if diagonal:
            shifts += [(1, 1), (1, -1), (-1, 1), (-1, -1)]
        for dy, dx in shifts:
            g = np.zeros_like(m)
            ys = slice(max(dy, 0), self.n + min(dy, 0))
            ys2 = slice(max(-dy, 0), self.n + min(-dy, 0))
            xs = slice(max(dx, 0), self.n + min(dx, 0))
            xs2 = slice(max(-dx, 0), self.n + min(-dx, 0))
            g[ys, xs] = m[ys2, xs2]
            grow |= g
        self.paint(grow & ~m, c)

    def image(self):
        return Image.fromarray(self.a, "RGBA")


# ------------------------------------------------------------------ shared motifs
def draw_eye_orb(ic, cx, cy, r, iris_r, pupil_r, iris=IRIS, veins=True, slit=False):
    """Bloodshot eyeball seen from the front."""
    ic.sphere(cx, cy, r, SCLERA)
    # pink, bloodshot rim
    rim = ic.circle_mask(cx, cy, r) & ~ic.circle_mask(cx, cy, r - 1.2)
    lower_rim = rim & (ic.y > cy - r * 0.2)
    ic.paint(lower_rim, rgb("c99a9c"))
    if veins:
        for ang, length, bend in ((205, 0.55, 18), (250, 0.5, -20), (330, 0.5, 15), (20, 0.45, -18),
                                  (110, 0.5, 20), (150, 0.45, -12)):
            a0 = math.radians(ang)
            pts = []
            steps = 6
            for k in range(steps + 1):
                f = k / steps
                rr = r - 0.6 - f * (r - iris_r - 0.3) * length * 1.6
                aa = a0 + math.radians(bend) * f
                pts.append((cx + math.cos(aa) * rr, cy + math.sin(aa) * rr))
            for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
                ic.paint(ic.line_mask(x0, y0, x1, y1, 1.05) & ic.circle_mask(cx, cy, r - 0.5)
                         & ~ic.circle_mask(cx, cy, iris_r + 0.8), VEIN)
            ex, ey = pts[0]
            ic.paint(ic.line_mask(ex, ey, ex, ey, 1.2) & ic.circle_mask(cx, cy, r - 0.3), VEIN_D)
    # iris: dark ring -> red -> hot near the pupil
    d = np.hypot(ic.x - cx, ic.y - cy)
    ic.paint(d <= iris_r, iris[4])
    ic.paint(d <= iris_r - 1.0, iris[3])
    ic.paint(d <= iris_r - 1.9, iris[2])
    ic.paint((d <= pupil_r + 1.2) & (d > pupil_r), iris[1])
    if slit:
        ic.paint(ic.ellipse_mask(cx, cy, max(pupil_r * 0.45, 0.6), pupil_r * 1.6), PUPIL)
    else:
        ic.paint(d <= pupil_r, PUPIL)
    # glints
    gx, gy = cx - iris_r * 0.45, cy - iris_r * 0.5
    ic.paint(ic.circle_mask(gx, gy, max(0.8, iris_r * 0.22)), iris[0])
    ic.put(int(gx), int(gy), WHITE)


def draw_almond_eye(ic, cx, cy, w, h, iris_c=None, closed=False):
    """Almond-shaped eye symbol (UI glyph)."""
    iris_c = iris_c or (IRIS[2], IRIS[0], IRIS[4])
    # almond = intersection of two circles
    half_w = w / 2
    R = (half_w ** 2 + h ** 2) / (2 * h)
    top = ic.circle_mask(cx, cy + R - h, R)
    bot = ic.circle_mask(cx, cy - R + h, R)
    m = top & bot
    if closed:
        # closed eye: a sagging lid arc (2 px) with lashes hanging below it
        def arc(t):
            return cx + t * half_w, cy - h * 0.5 + h * (1 - t * t)
        lid = np.zeros_like(m)
        steps = 24
        for k in range(steps):
            (x0, y0), (x1, y1) = arc(-1 + 2 * k / steps), arc(-1 + 2 * (k + 1) / steps)
            lid |= ic.line_mask(x0, y0, x1, y1, 2.2)
        ic.paint(lid, CRIM[2])
        for t in (-0.62, -0.21, 0.21, 0.62):
            x, y = arc(t)
            ic.paint(ic.line_mask(x, y + 1.0, x + t * 2.0, y + 3.6, 1.3), CRIM[3])
        return lid
    ic.paint(m, SCLERA[1])
    ic.paint(m & (ic.y < cy - h * 0.35), SCLERA[0])
    ic.paint(m & (ic.y > cy + h * 0.45), SCLERA[3])
    ir = h * 0.82
    d = np.hypot(ic.x - cx, ic.y - cy)
    ic.paint(m & (d <= ir), iris_c[2])
    ic.paint(m & (d <= ir - 1.0), iris_c[0])
    ic.paint(m & (d <= ir * 0.45), PUPIL)
    ic.put(int(cx - ir * 0.45), int(cy - ir * 0.45), iris_c[1])
    return m


def draw_heart(ic, cx, cy, s, ramp=CRIM):
    """Heart from two circles + triangle, s ~ half width."""
    r = s * 0.53
    m = ic.circle_mask(cx - s * 0.47, cy - s * 0.25, r) | ic.circle_mask(cx + s * 0.47, cy - s * 0.25, r)
    m |= ic.poly_mask([(cx - s * 0.98, cy - s * 0.12), (cx + s * 0.98, cy - s * 0.12), (cx, cy + s * 0.98)])
    ic.paint(m, ramp[2])
    # shade: lower-right darker, highlight on left lobe
    ic.paint(m & ((ic.x - cx) * 0.6 + (ic.y - cy) > s * 0.35), ramp[3])
    ic.paint(m & ic.circle_mask(cx - s * 0.55, cy - s * 0.4, s * 0.28), ramp[1])
    ic.paint(m & ic.circle_mask(cx - s * 0.6, cy - s * 0.48, s * 0.12), ramp[0])
    return m


def draw_plus(ic, cx, cy, arm, thick, fill, edge):
    m = ((np.abs(ic.x - cx) <= thick / 2) & (np.abs(ic.y - cy) <= arm)) | \
        ((np.abs(ic.y - cy) <= thick / 2) & (np.abs(ic.x - cx) <= arm))
    ic.paint(m, fill)
    return m


def draw_spike(ic, cx, cy, ang_deg, r0, r1, w0, ramp=OBS, tip=TIP):
    """Tapered obsidian spike from radius r0 to r1 with a glowing tip."""
    a = math.radians(ang_deg)
    ux, uy = math.cos(a), math.sin(a)
    px, py = -uy, ux
    bx, by = cx + ux * r0, cy + uy * r0
    tx, ty = cx + ux * r1, cy + uy * r1
    pts = [(bx + px * w0, by + py * w0), (tx, ty), (bx - px * w0, by - py * w0)]
    m = ic.poly_mask(pts) | ic.line_mask(bx, by, tx - ux * 0.5, ty - uy * 0.5, 1.2)
    # obsidian body: lit side / dark side, glowing tip only at the very end
    side = (ic.x - bx) * px + (ic.y - by) * py
    lit_side = side < 0 if (px + py) > 0 else side > 0
    ic.paint(m, ramp[1])
    ic.paint(m & lit_side & (np.abs(side) > 0.25), ramp[3])
    ic.paint(m & ~lit_side & (np.abs(side) > 0.25), ramp[0])
    along = (ic.x - bx) * ux + (ic.y - by) * uy
    L = r1 - r0
    ic.paint(m & (along > L - 2.0), tip[1])
    ic.paint(m & (along > L - 0.9), tip[0])
    return m


# ------------------------------------------------------------------ items
def item_summoner():
    ic = Icon()
    cx = cy = 16.0
    for k in range(8):
        ang = k * 45 + 22.5
        draw_spike(ic, cx, cy, ang, 7.5, 15.4 if k % 2 == 0 else 14.2, 3.0)
    draw_eye_orb(ic, cx, cy, 9.8, 5.6, 2.0)
    ic.outline()
    return ic


def item_upgrade():
    ic = Icon()
    cx = 16.0
    # faceted crimson crystal (hexagonal, point up/down)
    top, bot, yl, yh, xl, xr = 2.0, 28.0, 9.0, 21.0, 6.0, 26.0
    gem = ic.poly_mask([(cx, top), (xr, yl), (xr, yh), (cx, bot), (xl, yh), (xl, yl)])
    ic.paint(gem, CRIM[2])
    left = gem & (ic.x < cx)
    ic.paint(left, CRIM[1])
    ic.paint(gem & (ic.y < yl + (ic.x - xl) * 0) & (ic.y < yl) & (ic.x < cx), CRIM[0])  # upper-left facet
    ic.paint(gem & (ic.y < yl) & (ic.x >= cx), CRIM[1])                                    # upper-right facet
    ic.paint(gem & (ic.y > yh) & (ic.x < cx), CRIM[2])                                     # lower-left facet
    ic.paint(gem & (ic.y > yh) & (ic.x >= cx), CRIM[3])                                    # lower-right facet
    ic.paint(gem & (ic.x >= cx) & (ic.y >= yl) & (ic.y <= yh) & (ic.x > xr - 2.2), CRIM[3])
    # inner glow stripe + sparkle
    ic.paint(ic.line_mask(cx - 5.5, yl + 0.5, cx - 5.5, yh - 0.5, 1.0) & gem, CRIM[0])
    ic.put(10, 6, WHITE)
    ic.put(11, 5, CRIM[0])
    # eye symbol in the core
    draw_almond_eye(ic, cx, 15.5, 12, 4.2)
    # gold setting: band across the waist ends + bottom claw
    for x0 in (xl - 1, xr - 2):
        band = (ic.x >= x0) & (ic.x <= x0 + 3) & (ic.y >= yl - 1) & (ic.y <= yh + 1)
        ic.bevel(band, GOLD[1], GOLD[0], GOLD[3])
    claw = ic.poly_mask([(cx - 6, 24.5), (cx + 6, 24.5), (cx + 2.5, 30.6), (cx - 2.5, 30.6)])
    claw &= ~ic.poly_mask([(cx - 3.2, 24.0), (cx + 3.2, 24.0), (cx, 28.4)])
    ic.bevel(claw, GOLD[2], GOLD[0], GOLD[3])
    cap = ic.poly_mask([(cx - 2.6, 1.0), (cx + 2.6, 1.0), (cx, 4.4)])
    ic.bevel(cap, GOLD[1], GOLD[0], GOLD[3])
    # diamond studs on the bands
    for (sx, sy) in ((xl + 0.5, 15.5), (xr - 0.5, 15.5)):
        stud = (np.abs(ic.x - sx) + np.abs(ic.y - sy)) <= 2.0
        ic.paint(stud, DIAM[2])
        ic.paint(stud & (ic.x < sx) & (ic.y < sy), DIAM[0])
        ic.paint(stud & (ic.x > sx) & (ic.y > sy), DIAM[3])
        ic.paint(stud & (ic.x < sx) & (ic.y > sy), DIAM[1])
    ic.outline()
    return ic


def item_controller():
    ic = Icon()
    # obsidian rod, bottom-left to top-right
    x0, y0, x1, y1 = 4.5, 27.5, 19.5, 12.5
    rod = ic.line_mask(x0, y0, x1, y1, 3.3)
    ic.paint(rod, OBS[2])
    # lit upper-left edge, dark lower-right edge
    side = (ic.x - x0) * (1 / math.sqrt(2)) + (ic.y - y0) * (1 / math.sqrt(2))
    ic.paint(rod & (side < -0.55), OBS[3])
    ic.paint(rod & (side > 0.6), OBS[1])
    for k, (sx, sy) in enumerate(((8, 23), (12, 20), (15, 16), (10, 22))):
        if rod[sy, sx]:
            ic.put(sx, sy, OBS[4])
    # gold bands + crimson gem pommel
    for t in (0.36, 0.78):
        bx, by = x0 + (x1 - x0) * t, y0 + (y1 - y0) * t
        band = ic.line_mask(bx - 2.1, by - 2.1, bx + 2.1, by + 2.1, 2.0) & ic.line_mask(x0, y0, x1, y1, 4.6)
        ic.bevel(band, GOLD[1], GOLD[0], GOLD[3])
    pom = ic.circle_mask(4.0, 28.0, 2.3)
    ic.sphere(4.0, 28.0, 2.3, [CRIM[0], CRIM[1], CRIM[2], CRIM[3]], mask=pom)
    # small corrupted spikes around the eye (none toward the rod)
    cx, cy = 22.0, 10.0
    for ang in (-100, -45, 10, 60, 190):
        draw_spike(ic, cx, cy, ang, 4.5, 9.6, 1.9)
    draw_eye_orb(ic, cx, cy, 6.0, 3.6, 1.0, veins=False)
    # vein dots for the bloodshot look at this tiny size
    for (vx, vy) in ((18, 7), (26, 12), (19, 13), (25, 5)):
        if ic.get(vx, vy)[3]:
            ic.put(vx, vy, VEIN)
    ic.outline()
    return ic


# ------------------------------------------------------------------ UI icons
def ui_follow():
    ic = Icon()
    draw_almond_eye(ic, 16, 10.5, 24, 7.5)
    # arrow pointing right underneath
    shaft = (ic.x >= 5) & (ic.x <= 20) & (np.abs(ic.y - 24.5) <= 1.6)
    head = ic.poly_mask([(19, 18.0), (28.6, 24.5), (19, 31.0)])
    ic.bevel(shaft | head, CRIM[2], CRIM[1], CRIM[3])
    ic.outline()
    return ic


def ui_attack():
    ic = Icon()
    for flip in (False, True):
        def X(x):
            return 32 - x if flip else x
        blade = ic.line_mask(X(5.5), 5.5, X(21.5), 21.5, 3.8)
        ic.paint(blade, STEEL[1])
        across = (ic.x - X(5.5)) * (-1 if flip else 1) - (ic.y - 5.5)
        ic.paint(blade & (across > 0.9), STEEL[3])
        ic.paint(blade & (across < -0.9), STEEL[0])
        ic.paint(ic.line_mask(X(5.5), 5.5, X(9.5), 9.5, 2.6), CRIM[1])  # blood-red tip
        guard = ic.line_mask(X(18.5), 24.5, X(24.5), 18.5, 2.4)
        ic.paint(guard, GOLD[2])
        ic.paint(ic.line_mask(X(18.5), 24.5, X(24.5), 18.5, 1.0), GOLD[1])
        grip = ic.line_mask(X(22.5), 22.5, X(26.5), 26.5, 2.4)
        ic.paint(grip, OBS[2])
        pommel = ic.circle_mask(X(27.5), 27.5, 1.8)
        ic.paint(pommel, CRIM[2])
        ic.put(int(X(27.5)) - (1 if not flip else 0), 26, CRIM[0])
    ic.outline()
    return ic


def ui_shield():
    ic = Icon()
    cx = 16
    body = ic.poly_mask([(5, 4), (27, 4), (27, 15), (24.5, 22), (16, 29.5), (7.5, 22), (5, 15)])
    ic.paint(body, OBS[2])
    inner = ic.poly_mask([(8, 7), (24, 7), (24, 15), (22, 20.5), (16, 26.3), (10, 20.5), (8, 15)])
    ic.paint(inner, CRIM[2])
    ic.paint(inner & (ic.x < cx), CRIM[1])
    ic.paint(inner & (ic.x < 10.5) & (ic.y < 12), CRIM[0])
    ic.paint(body & ~inner & (ic.y < 6), OBS[3])
    # glowing eye emblem
    draw_almond_eye(ic, cx, 15, 11, 3.6, iris_c=(IRIS[3], IRIS[0], IRIS[4]))
    ic.outline()
    return ic


def ui_destroy():
    ic = Icon()
    # red burst behind
    pts = []
    for k in range(16):
        a = math.radians(k * 22.5 - 90)
        r = 14.8 if k % 2 == 0 else 8.5
        pts.append((16 + math.cos(a) * r, 16.5 + math.sin(a) * r))
    burst = ic.poly_mask(pts)
    ic.paint(burst, CRIM[1])
    ic.paint(burst & ic.circle_mask(16, 16.5, 8.5), GOLD[1])
    # cracked isometric block
    top = ic.poly_mask([(16, 8), (24, 12), (16, 16), (8, 12)])
    left = ic.poly_mask([(8, 12), (16, 16), (16, 25.5), (8, 21.5)]) & ~top
    right = ic.poly_mask([(16, 16), (24, 12), (24, 21.5), (16, 25.5)]) & ~top & ~left
    ic.paint(top, rgb("9c8a7e"))
    ic.paint(left, rgb("74645a"))
    ic.paint(right, rgb("4f433d"))
    for (x0, y0, x1, y1) in ((12, 10, 15, 13), (15, 13, 14, 15), (19, 13, 21, 15), (11, 15, 13, 19),
                             (13, 19, 11, 22), (18, 18, 21, 17), (21, 17, 20, 21)):
        ic.pixel_line(x0, y0, x1, y1, CRIM[4])
    # flying debris
    for (dx, dy, c) in ((4, 5, rgb("74645a")), (27, 6, rgb("9c8a7e")), (27, 26, rgb("4f433d")),
                        (5, 26, rgb("9c8a7e")), (3, 15, rgb("74645a"))):
        ic.paint((np.abs(ic.x - dx - 0.5) <= 1) & (np.abs(ic.y - dy - 0.5) <= 1), c)
    ic.outline()
    return ic


def ui_passive():
    ic = Icon()
    draw_almond_eye(ic, 16, 7.0, 24, 4.0, closed=True)
    draw_heart(ic, 16, 23.0, 7.6)
    ic.outline()
    return ic


def ui_teleport():
    ic = Icon()
    cx, cy = 16, 16
    # portal oval
    oval = ic.ellipse_mask(cx, cy, 10.5, 14)
    ic.paint(oval, OBS[1])
    ic.paint(oval & ~ic.ellipse_mask(cx, cy, 8.8, 12.3), OBS[3])
    # swirl: archimedean spiral, thick
    for k in range(260):
        t = k / 259
        a = math.radians(t * 720 + 90)
        r = 1.0 + t * 8.2
        x, y = cx + math.cos(a) * r * 0.86, cy + math.sin(a) * r * 1.12
        c = CRIM[0] if t < 0.25 else (CRIM[1] if t < 0.55 else CRIM[2])
        ic.paint(ic.circle_mask(x, y, 1.15) & oval, c)
    ic.paint(ic.circle_mask(cx, cy, 1.3), WHITE)
    ic.outline()
    return ic


def ui_night_vision():
    ic = Icon()
    # crescent moon top-right
    moon = ic.circle_mask(22, 9.5, 7.2) & ~ic.circle_mask(18.2, 6.6, 6.0)
    ic.paint(moon, MOON[1])
    ic.paint(moon & ((ic.x - 22) + (ic.y - 9.5) > 3.5), MOON[2])
    ic.paint(moon & ((ic.x - 22) + (ic.y - 9.5) < -1.0), MOON[0])
    for (sx, sy) in ((6, 5), (11, 3)):
        ic.put(sx, sy, MOON[0])
        for ddx, ddy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            ic.put(sx + ddx, sy + ddy, MOON[2])
    # glowing eye bottom
    draw_almond_eye(ic, 14, 22, 24, 7.5)
    ic.outline()
    return ic


def ui_heal():
    ic = Icon()
    draw_heart(ic, 16, 16.5, 13.0)
    draw_plus(ic, 16, 15.5, 5.2, 3.0, WHITE, OUT)
    ic.paint((np.abs(ic.x - 16) <= 1.5) & (ic.y > 18.5) & (ic.y < 21) & (np.abs(ic.x - 16) <= 1.5), rgb("e3dde4"))
    ic.outline()
    return ic


def ui_look():
    ic = Icon()
    centres = [(9.0, 9.0), (23.0, 9.0), (9.0, 23.0), (23.0, 23.0)]
    for (cx, cy), skin in zip(centres, ("crimson", "void", "frost", "toxic")):
        prim, hot, dark = SKIN_IRIS[skin]
        ic.sphere(cx, cy, 6.6, SCLERA[:4])
        d = np.hypot(ic.x - cx, ic.y - cy)
        ic.paint(d <= 4.0, dark)
        ic.paint(d <= 3.1, prim)
        ic.paint(d <= 1.5, PUPIL)
        ic.put(int(cx - 2), int(cy - 2), hot)
    ic.outline()
    return ic


def ui_status():
    ic = Icon()
    body = (ic.x >= 7) & (ic.x <= 25) & (ic.y >= 5) & (ic.y <= 27)
    ic.paint(body, PAPER[1])
    ic.paint(body & (ic.x < 9), PAPER[0])
    ic.paint(body & (ic.x > 23), PAPER[2])
    for yy in (4.5, 27.5):  # rolls
        roll = (ic.x >= 5) & (ic.x <= 27) & (np.abs(ic.y - yy) <= 1.6)
        ic.bevel(roll, PAPER[2], PAPER[1], PAPER[3])
    for i, yy in enumerate((10, 13, 16, 19)):
        w = 13 if i % 2 == 0 else 10
        ic.paint((ic.x >= 10) & (ic.x <= 10 + w) & (np.abs(ic.y - yy - 0.5) <= 0.5), PAPER[3])
    # red wax seal with an eye
    seal = ic.circle_mask(21.5, 22.5, 4.2)
    ic.sphere(21.5, 22.5, 4.2, [CRIM[0], CRIM[1], CRIM[2], CRIM[3]], mask=seal)
    ic.paint(ic.circle_mask(21.5, 22.5, 1.4), PUPIL)
    ic.outline()
    return ic


def ui_fire():
    ic = Icon()
    cx, cy = 18.5, 13.5
    ring = ic.circle_mask(cx, cy, 9.5) & ~ic.circle_mask(cx, cy, 7.4)
    ic.paint(ring, CRIM[2])
    ic.paint(ring & (ic.y < cy - 3), CRIM[1])
    for (x0, y0, x1, y1) in ((cx, cy - 12.5, cx, cy - 6.5), (cx, cy + 6.5, cx, cy + 12.5),
                             (cx - 12.5, cy, cx - 6.5, cy), (cx + 6.5, cy, cx + 12.5, cy)):
        ic.paint(ic.line_mask(x0, y0, x1, y1, 2.0), STEEL[1])
    # beam from bottom-left into the centre
    beam = ic.line_mask(2.5, 29.5, cx, cy, 3.4)
    ic.paint(beam, CRIM[1])
    ic.paint(ic.line_mask(2.5, 29.5, cx, cy, 1.2), IRIS[0])
    ic.paint(ic.circle_mask(cx, cy, 2.4), CRIM[1])
    ic.paint(ic.circle_mask(cx, cy, 1.2), WHITE)
    ic.outline()
    return ic


def ui_dismiss():
    ic = Icon()
    a = ic.line_mask(7, 7, 25, 25, 5.2)
    b = ic.line_mask(25, 7, 7, 25, 5.2)
    m = a | b
    ic.paint(m, CRIM[2])
    ic.paint(m & ((ic.y - 16) < -(ic.x - 16) * 0) & (ic.y < 13), CRIM[1])
    ic.paint(ic.line_mask(7.6, 6.4, 12, 10.8, 1.2) | ic.line_mask(24.4, 6.4, 20, 10.8, 1.2), CRIM[0])
    ic.paint(m & (ic.y > 21), CRIM[3])
    ic.outline()
    return ic


def ui_summon():
    ic = Icon()
    draw_almond_eye(ic, 14.5, 13, 25, 8.0)
    badge = ic.circle_mask(24, 24, 6.5)
    ic.sphere(24, 24, 6.5, [GOLD[0], GOLD[1], GOLD[2], GOLD[3]], mask=badge)
    draw_plus(ic, 24, 24, 4.0, 2.2, WHITE, OUT)
    ic.paint(((np.abs(ic.x - 24) <= 1.1) & (ic.y > 24) & (ic.y <= 28)) |
             ((np.abs(ic.y - 24) <= 1.1) & (ic.x > 24) & (ic.x <= 28)), rgb("f3e7d6"))
    ic.outline()
    return ic


ITEMS = {
    "eyeball_summoner": item_summoner,
    "eyeball_upgrade": item_upgrade,
    "eyeball_controller": item_controller,
}
UI = {
    "follow": ui_follow,
    "attack": ui_attack,
    "shield": ui_shield,
    "destroy": ui_destroy,
    "passive": ui_passive,
    "teleport": ui_teleport,
    "night_vision": ui_night_vision,
    "heal": ui_heal,
    "look": ui_look,
    "status": ui_status,
    "fire": ui_fire,
    "dismiss": ui_dismiss,
    "summon": ui_summon,
}


def item_texture_json():
    return {
        "resource_pack_name": "ceg",
        "texture_name": "atlas.items",
        "texture_data": {
            f"ceg_{name}": {"textures": f"textures/items/ceg/{name}"} for name in ITEMS
        },
    }


# ------------------------------------------------------------------ preview sheet
def checker(w, h, s=8, c1=(46, 40, 52), c2=(58, 52, 66)):
    img = Image.new("RGB", (w, h), c1)
    d = ImageDraw.Draw(img)
    for y in range(0, h, s):
        for x in range(0, w, s):
            if (x // s + y // s) % 2:
                d.rectangle([x, y, x + s - 1, y + s - 1], fill=c2)
    return img


def contact_sheet(items, ui, atlas):
    try:
        font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 14)
        bold = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 18)
    except OSError:
        font = bold = ImageFont.load_default()
    W = 1160
    sheet = Image.new("RGB", (W, 1240), (24, 20, 28))
    d = ImageDraw.Draw(sheet)
    y = 12
    d.text((16, y), "Cursed Eyeball Guardian - item icons (32x32 @ 6x, plus 1x / 2x hotbar size)", fill=(255, 210, 200), font=bold)
    y += 32
    x = 16
    for name, img in items.items():
        big = img.resize((192, 192), Image.NEAREST)
        bg = checker(192, 192)
        bg.paste(big, (0, 0), big)
        sheet.paste(bg, (x, y))
        # in-hotbar previews: 16x16 (downscaled) and 32x32 on a slot-grey background
        slot = Image.new("RGB", (40, 40), (139, 139, 139))
        small = img.resize((16, 16), Image.BOX)
        slot16 = Image.new("RGB", (24, 24), (139, 139, 139))
        slot16.paste(small, (4, 4), small)
        slot.paste(img, (4, 4), img)
        sheet.paste(slot16, (x + 200, y))
        sheet.paste(slot, (x + 200, y + 32))
        sheet.paste(slot16.resize((48, 48), Image.NEAREST), (x + 200, y + 80))
        d.text((x, y + 198), name, fill=(235, 235, 235), font=font)
        x += 380
    y += 230
    d.text((16, y), "UI button icons (textures/ceg/ui, 32x32 @ 4x and 1x)", fill=(255, 210, 200), font=bold)
    y += 30
    x = 16
    for i, (name, img) in enumerate(ui.items()):
        if i and i % 7 == 0:
            x = 16
            y += 176
        big = img.resize((128, 128), Image.NEAREST)
        bg = checker(128, 128)
        bg.paste(big, (0, 0), big)
        sheet.paste(bg, (x, y))
        btn = Image.new("RGB", (36, 36), (64, 64, 64))
        btn.paste(img, (2, 2), img)
        sheet.paste(btn, (x + 132, y))
        d.text((x, y + 132), name, fill=(235, 235, 235), font=font)
        x += 162
    y += 176
    d.text((16, y), "Particle atlas textures/particle/ceg_particles.png (64x64, cells @ 8x; tinted crimson below)",
           fill=(255, 210, 200), font=bold)
    y += 30
    labels = ["glow (0,0)", "spark (1,0)", "ring (2,0)", "heart (3,0)", "cube (0,1)", "smoke (1,1)",
              "rune (2,1)", "pixel (3,1)"]
    cells = [(0, 0), (16, 0), (32, 0), (48, 0), (0, 16), (16, 16), (32, 16), (48, 16)]
    x = 16
    for lab, (u, v) in zip(labels, cells):
        cell = atlas.crop((u, v, u + 16, v + 16))
        big = cell.resize((128, 128), Image.NEAREST)
        bg = Image.new("RGB", (128, 128), (10, 8, 14))
        bg.paste(big, (0, 0), big)
        sheet.paste(bg, (x, y))
        arr = np.asarray(big).astype(np.float64) / 255.0
        tint = np.array([1.0, 0.08, 0.08])
        add = np.zeros((128, 128, 3)) + np.array([10, 8, 14]) / 255.0
        add += arr[..., :3] * tint * arr[..., 3:4]
        sheet.paste(Image.fromarray((np.clip(add, 0, 1) * 255).astype(np.uint8)), (x, y + 150))
        d.text((x, y + 130), lab, fill=(235, 235, 235), font=font)
        x += 140
    y += 290
    return sheet.crop((0, 0, W, y))


def load_atlas():
    sys.dont_write_bytecode = True  # keep tools/ free of __pycache__
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    import gen_particles  # noqa: E402  (same folder)
    return gen_particles.build_atlas()


def main():
    ITEM_DIR.mkdir(parents=True, exist_ok=True)
    UI_DIR.mkdir(parents=True, exist_ok=True)
    items = {}
    for name, fn in ITEMS.items():
        img = fn().image()
        img.save(ITEM_DIR / f"{name}.png", optimize=True)
        items[name] = img
    ui = {}
    for name, fn in UI.items():
        img = fn().image()
        img.save(UI_DIR / f"{name}.png", optimize=True)
        ui[name] = img
    ITEM_TEXTURE_JSON.write_text(json.dumps(item_texture_json(), indent=2) + "\n", encoding="utf-8")
    PREVIEW.parent.mkdir(parents=True, exist_ok=True)
    contact_sheet(items, ui, load_atlas()).save(PREVIEW, optimize=True)
    print(f"wrote {len(items)} item icons, {len(ui)} UI icons, item_texture.json and {PREVIEW.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
