"""Tiny pixel-art toolkit used to generate every texture of the Bunker Arsenal add-on.

Everything is deterministic: the same script always produces the same PNG bytes,
so textures can be regenerated at any time.
"""
from PIL import Image
import os, math

# ---------------------------------------------------------------- palette ----
def hex2rgba(h, a=255):
    h = h.lstrip('#')
    return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), a)

P = {
    # steel / concrete (tuff-like greys from the reference image)
    'steel0': '2e3236', 'steel1': '3f4347', 'steel2': '565b60', 'steel3': '6e747a', 'steel4': '868d94', 'steel5': 'a3aab0',
    # copper (reference image copper blocks)
    'cop0': '5a2d14', 'cop1': '7a3f1f', 'cop2': 'b25f33', 'cop3': 'd4824c', 'cop4': 'e7a06a',
    # oxidized copper teal (reference image)
    'teal0': '1f3f36', 'teal1': '2f5f52', 'teal2': '3f8068', 'teal3': '54a386', 'teal4': '7cc0a4', 'teal5': 'a6dcc4',
    # hazard
    'yel0': '8a6a12', 'yel1': 'c79a26', 'yel2': 'e8c04a', 'yel3': 'f6dd86', 'blk': '1b1b1b', 'blk2': '2b2b2b',
    # light
    'lamp0': 'b89a4a', 'lamp1': 'e8d58a', 'lamp2': 'f5e9b8', 'lamp3': 'fff8dc', 'red0': '7a1f14', 'red1': 'b3301f', 'red2': 'd94b3a', 'red3': 'f08a7a',
    # gunmetal
    'gm0': '17191c', 'gm1': '23262a', 'gm2': '383c41', 'gm3': '4f555b', 'gm4': '6b7279', 'gm5': '8b939b', 'gm6': 'aab1b8',
    # wood
    'wd0': '3d2614', 'wd1': '5c3b22', 'wd2': '7a4f2d', 'wd3': '9a6a3f', 'wd4': 'b98a5a',
    # energy / sci-fi
    'cy0': '0b4c66', 'cy1': '1a8fb8', 'cy2': '4fd1ff', 'cy3': '9ff1ff', 'cy4': 'e2fbff',
    'gr0': '1d5a23', 'gr1': '2f9a38', 'gr2': '6cf26c', 'gr3': 'c8ffc0',
    'pu0': '3b1d66', 'pu1': '6a35b5', 'pu2': 'a56cff', 'pu3': 'd9c2ff',
    'or0': '7a2f08', 'or1': 'c6560f', 'or2': 'ff8c2a', 'or3': 'ffc78a',
    # misc
    'white': 'f4f4f4', 'grey': 'c8c8c8', 'brass0': '7a5a1a', 'brass1': 'b8902e', 'brass2': 'e0bc55', 'brass3': 'f3dc8c',
    'skin': 'd6a070', 'olive0': '3a3f22', 'olive1': '555c2e', 'olive2': '737b41', 'olive3': '98a05a',
    'blue0': '1d3561', 'blue1': '2f58a6', 'blue2': '5b8ae0', 'blue3': 'a9c4f5',
}
C = {k: hex2rgba(v) for k, v in P.items()}
T = (0, 0, 0, 0)

def shade(rgba, f):
    """Multiply rgb by f (f<1 darker, f>1 lighter)."""
    r, g, b, a = rgba
    return (max(0, min(255, int(r * f))), max(0, min(255, int(g * f))), max(0, min(255, int(b * f))), a)

def hashn(x, y, seed=0):
    """Deterministic pseudo-random float in [0,1)."""
    n = (x * 374761393 + y * 668265263 + seed * 982451653) & 0xffffffff
    n = (n ^ (n >> 13)) * 1274126177 & 0xffffffff
    return ((n ^ (n >> 16)) & 0xffff) / 65536.0

# ----------------------------------------------------------------- canvas ----
class Canvas:
    def __init__(self, w=16, h=16, fill=T):
        self.w, self.h = w, h
        self.px = [[fill for _ in range(w)] for _ in range(h)]

    def inb(self, x, y):
        return 0 <= x < self.w and 0 <= y < self.h

    def get(self, x, y):
        return self.px[y][x] if self.inb(x, y) else T

    def set(self, x, y, col):
        if self.inb(x, y):
            self.px[y][x] = col

    def rect(self, x0, y0, x1, y1, col):
        for y in range(min(y0, y1), max(y0, y1) + 1):
            for x in range(min(x0, x1), max(x0, x1) + 1):
                self.set(x, y, col)

    def box(self, x0, y0, x1, y1, col):
        self.hline(x0, x1, y0, col); self.hline(x0, x1, y1, col)
        self.vline(x0, y0, y1, col); self.vline(x1, y0, y1, col)

    def hline(self, x0, x1, y, col):
        for x in range(min(x0, x1), max(x0, x1) + 1):
            self.set(x, y, col)

    def vline(self, x, y0, y1, col):
        for y in range(min(y0, y1), max(y0, y1) + 1):
            self.set(x, y, col)

    def line(self, x0, y0, x1, y1, col):
        dx, dy = abs(x1 - x0), -abs(y1 - y0)
        sx, sy = (1 if x0 < x1 else -1), (1 if y0 < y1 else -1)
        err = dx + dy
        while True:
            self.set(x0, y0, col)
            if x0 == x1 and y0 == y1:
                break
            e2 = 2 * err
            if e2 >= dy:
                err += dy; x0 += sx
            if e2 <= dx:
                err += dx; y0 += sy

    def fill_noise(self, x0, y0, x1, y1, base, amount=0.08, seed=0, cols=None):
        """Fill a rect with a base colour plus subtle deterministic noise (or pick from cols)."""
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                r = hashn(x, y, seed)
                if cols:
                    self.set(x, y, cols[int(r * len(cols)) % len(cols)])
                else:
                    self.set(x, y, shade(base, 1 - amount + 2 * amount * r))

    def blit(self, other, ox, oy):
        for y in range(other.h):
            for x in range(other.w):
                c = other.px[y][x]
                if c[3] > 0:
                    self.set(ox + x, oy + y, c)

    def filled(self, x, y):
        return self.get(x, y)[3] > 0

    def outline_inner(self, dark=0.45, light=1.35, light_dirs=((0, -1), (-1, 0)), dark_dirs=((0, 1), (1, 0))):
        """Classic Minecraft look: darken silhouette edge pixels, lighten the top/left edge."""
        src = [row[:] for row in self.px]
        def f(x, y):
            return 0 <= x < self.w and 0 <= y < self.h and src[y][x][3] > 0
        for y in range(self.h):
            for x in range(self.w):
                if not f(x, y):
                    continue
                edge_dark = any(not f(x + dx, y + dy) for dx, dy in dark_dirs)
                edge_light = any(not f(x + dx, y + dy) for dx, dy in light_dirs)
                if edge_dark:
                    self.px[y][x] = shade(src[y][x], dark)
                elif edge_light:
                    self.px[y][x] = shade(src[y][x], light)

    def silhouette_outline(self, col):
        """Darken every silhouette boundary pixel with a fixed colour (inner outline)."""
        src = [row[:] for row in self.px]
        def f(x, y):
            return 0 <= x < self.w and 0 <= y < self.h and src[y][x][3] > 0
        for y in range(self.h):
            for x in range(self.w):
                if f(x, y) and any(not f(x + dx, y + dy) for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                    self.px[y][x] = col

    def to_image(self):
        im = Image.new('RGBA', (self.w, self.h))
        im.putdata([c for row in self.px for c in row])
        return im

    def save(self, path):
        os.makedirs(os.path.dirname(path), exist_ok=True)
        self.to_image().save(path, optimize=True)

# ------------------------------------------------------- diagonal builder ----
class Diag:
    """Draw in a rotated (u, v) space: u runs along the barrel toward the top-right,
    v runs across (positive = toward bottom-right). Produces vanilla-style 45 degree art."""
    def __init__(self, canvas, x0=2, y0=13):
        self.c, self.x0, self.y0 = canvas, x0, y0
        self.even = {}   # (x,y) -> colour for 'even' lattice pixels
        self.parts = []

    def map(self, u, v):
        return self.x0 + u + v, self.y0 - u + v

    def rect(self, u0, u1, v0, v1, col):
        for u in range(min(u0, u1), max(u0, u1) + 1):
            for v in range(min(v0, v1), max(v0, v1) + 1):
                self.even[self.map(u, v)] = col

    def dot(self, u, v, col):
        self.even[self.map(u, v)] = col

    def commit(self, min_neighbors=3):
        """Write even pixels, then fill the 'odd' lattice gaps where the shape is solid."""
        for (x, y), col in self.even.items():
            self.c.set(x, y, col)
        odd = {}
        for (x, y), col in self.even.items():
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                p = (x + dx, y + dy)
                if p in self.even:
                    continue
                n = [self.even.get((p[0] + ex, p[1] + ey)) for ex, ey in ((1, 0), (-1, 0), (0, 1), (0, -1))]
                n = [q for q in n if q is not None]
                if len(n) >= min_neighbors:
                    # majority colour
                    best = max(set(n), key=n.count)
                    odd[p] = best
        for (x, y), col in odd.items():
            self.c.set(x, y, col)

# ----------------------------------------------------------------- preview ---
def preview_sheet(paths, out, scale=6, cols=8, label=True):
    """Build a scaled-up contact sheet of many PNGs for visual inspection."""
    from PIL import ImageDraw
    ims = [Image.open(p).convert('RGBA') for p in paths]
    cw = max(im.width for im in ims) * scale + 4
    ch = max(im.height for im in ims) * scale + (14 if label else 4)
    rows = math.ceil(len(ims) / cols)
    sheet = Image.new('RGBA', (cols * cw, rows * ch), (120, 120, 120, 255))
    d = ImageDraw.Draw(sheet)
    for i, (im, p) in enumerate(zip(ims, paths)):
        x, y = (i % cols) * cw, (i // cols) * ch
        # checker background
        for yy in range(0, im.height * scale, scale):
            for xx in range(0, im.width * scale, scale):
                col = (150, 150, 150, 255) if ((xx + yy) // scale) % 2 == 0 else (105, 105, 105, 255)
                d.rectangle([x + 2 + xx, y + 2 + yy, x + 2 + xx + scale - 1, y + 2 + yy + scale - 1], fill=col)
        big = im.resize((im.width * scale, im.height * scale), Image.NEAREST)
        sheet.alpha_composite(big, (x + 2, y + 2))
        if label:
            d.text((x + 2, y + im.height * scale + 2), os.path.basename(p)[:18], fill=(255, 255, 255, 255))
    os.makedirs(os.path.dirname(out), exist_ok=True)
    sheet.save(out)
    return out
