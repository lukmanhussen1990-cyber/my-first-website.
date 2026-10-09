#!/usr/bin/env python3
"""Builds every Loe logo asset from art/loe-logo.png (the logo on black).

Run from loe-android/:  python3 tools/logo/build_icons.py
Needs Pillow and numpy."""
import os
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

SRC = 'art/loe-logo.png'
RES = 'app/src/main/res'
DENSITIES = {'mdpi': 1, 'hdpi': 1.5, 'xhdpi': 2, 'xxhdpi': 3, 'xxxhdpi': 4}

rgb = np.asarray(Image.open(SRC).convert('RGB')).astype(np.float32)
h, w = rgb.shape[:2]
peak = rgb.max(axis=2)

# ---- Cut the logo out of the black background ----------------------------------------------
# Dark pixels joined to the image border are background. The dark visor is enclosed by the
# white body, so it stays opaque.
dark = Image.fromarray(np.where(peak < 100, 255, 0).astype(np.uint8)).copy()  # copy: arrays give read-only images
ImageDraw.floodfill(dark, (0, 0), 128)
background = np.asarray(dark) == 128
edge = np.asarray(Image.fromarray(background.astype(np.uint8) * 255).filter(ImageFilter.MaxFilter(7))) > 0
# On a black background a pixel is alpha * colour, so peak / 255 recovers alpha for glows and edges.
alpha = np.where(edge, np.clip(peak / 255.0, 0, 1), 1.0)
colour = np.where(alpha[..., None] > 0, np.clip(rgb / np.maximum(alpha, 1e-6)[..., None], 0, 255), 0)
cutout = Image.fromarray(np.dstack([colour, alpha * 255]).round().astype(np.uint8), 'RGBA')

# Smallest circle around everything visible, so the logo can be centred and sized by it.
ys, xs = np.where(peak > 24)
pts = np.stack([xs, ys], 1).astype(np.float64)
centre = pts.mean(0)
for step in (64, 32, 16, 8, 4, 2, 1, 0.5):
    while True:
        radius = np.sqrt(((pts - centre) ** 2).sum(1)).max()
        moves = [centre + d for d in ((step, 0), (-step, 0), (0, step), (0, -step))]
        best = min(moves, key=lambda c: np.sqrt(((pts - c) ** 2).sum(1)).max())
        if np.sqrt(((pts - best) ** 2).sum(1)).max() >= radius: break
        centre = best
radius = np.sqrt(((pts - centre) ** 2).sum(1)).max()

def framed(image, size, fill, background=(0, 0, 0, 0)):
    """The logo centred on a size x size canvas, its enclosing circle `fill` of the width across."""
    scale = size * fill / (2 * radius)
    big = image.resize((round(w * scale), round(h * scale)), Image.LANCZOS)
    canvas = Image.new(image.mode, (size, size), background if image.mode == 'RGBA' else 0)
    canvas.paste(big, (round(size / 2 - centre[0] * scale), round(size / 2 - centre[1] * scale)))
    return canvas

def save(image, path, **kw):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    image.save(path, **kw)

# In-app art. The splash draws loe_logo at 288 dp under a 192 dp circle (67%), so the logo spans 62%.
save(framed(cutout, 1024, 0.62), f'{RES}/drawable-nodpi/loe_logo.webp', quality=92, alpha_quality=100, method=6)
tile = Image.alpha_composite(Image.new('RGBA', (384, 384), (0, 0, 0, 255)), framed(cutout, 384, 0.88))
save(tile.convert('RGB'), f'{RES}/drawable-nodpi/loe_logo_tile.webp', quality=92, method=6)

# Launcher icon: 108 dp layers; the logo fits a 64 dp circle, inside the 66 dp every launcher shows.
glyph = Image.fromarray((np.clip((peak - 90) / 80, 0, 1) * 255).astype(np.uint8))
mono = Image.merge('RGBA', [Image.new('L', (w, h), 255)] * 3 + [glyph])
for name, d in DENSITIES.items():
    px = round(108 * d)
    save(framed(cutout, px, 64 / 108), f'{RES}/mipmap-{name}/ic_launcher_foreground.webp', lossless=True, method=6)
    save(framed(mono, px, 64 / 108), f'{RES}/mipmap-{name}/ic_launcher_monochrome.webp', lossless=True, method=6)

# Status bar icon: the bubble and bow with the face screen cut out and two round eyes (the trailing
# lines and fine details vanish at 24 dp).
solid = Image.fromarray(np.where(peak > 110, 255, 0).astype(np.uint8)).copy()  # copy: arrays give read-only images
ImageDraw.floodfill(solid, (430, 260), 128)   # a point on the white body
body = np.asarray(solid) == 128
screen = (peak < 100) & ~background
sy, sx = np.where(screen)
screen_box = (sx.min(), sy.min(), sx.max(), sy.max())
shape = Image.fromarray(np.where(body, 255, 0).astype(np.uint8))
draw = ImageDraw.Draw(shape)
draw.rounded_rectangle(screen_box, radius=(screen_box[3] - screen_box[1]) * 0.32, fill=0)
eye_y = screen_box[1] + (screen_box[3] - screen_box[1]) * 0.42
eye_r = (screen_box[3] - screen_box[1]) * 0.16
for fx in (0.3, 0.7):
    ex = screen_box[0] + (screen_box[2] - screen_box[0]) * fx
    draw.ellipse((ex - eye_r, eye_y - eye_r, ex + eye_r, eye_y + eye_r), fill=255)
shape = shape.crop(shape.getbbox())
for name, d in DENSITIES.items():
    px = round(24 * d)
    k = round(22 * d) / max(shape.size)
    small = shape.resize((max(1, round(shape.width * k)), max(1, round(shape.height * k))), Image.LANCZOS)
    icon = Image.new('RGBA', (px, px), (255, 255, 255, 0))
    icon.paste(Image.new('RGBA', small.size, (255, 255, 255, 255)), ((px - small.width) // 2, (px - small.height) // 2), small)
    save(icon, f'{RES}/drawable-{name}/ic_notification.png', optimize=True)

# README icon: the tile with rounded corners.
corner = Image.new('L', (384, 384), 0)
ImageDraw.Draw(corner).rounded_rectangle((0, 0, 383, 383), radius=92, fill=255)
readme = tile.copy()
readme.putalpha(corner)
save(readme.resize((160, 160), Image.LANCZOS), 'docs/loe-icon.png', optimize=True)
print(f'centre={centre.round(1)} radius={radius:.1f}')
