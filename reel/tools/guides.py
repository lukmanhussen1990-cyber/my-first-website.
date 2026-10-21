#!/usr/bin/env python3
"""Overlay review guides on stills: subtitle band, Instagram UI zones. Makes a contact sheet."""
import sys, glob, os
from PIL import Image, ImageDraw, ImageFont
files = sorted(sys.argv[2:]) if len(sys.argv) > 2 else []
out = sys.argv[1]
tiles = []
for f in files:
    im = Image.open(f).convert('RGB'); W, H = im.size
    ov = Image.new('RGBA', im.size, (0, 0, 0, 0)); d = ImageDraw.Draw(ov)
    d.rectangle([0, int(H * 0.80), W, H], fill=(255, 0, 0, 40))           # bottom UI zone
    d.rectangle([int(W * 0.86), int(H * 0.45), W, H], fill=(255, 0, 0, 40))  # right buttons
    d.rectangle([int(W * 0.2), int(H * 0.375), int(W * 0.8), int(H * 0.455)], outline=(255, 255, 0, 200), width=2)  # subtitle band
    im = Image.alpha_composite(im.convert('RGBA'), ov).convert('RGB')
    d = ImageDraw.Draw(im); d.text((8, 8), os.path.basename(f), fill=(255, 255, 255))
    tiles.append(im)
if tiles:
    w, h = tiles[0].size; cols = min(4, len(tiles)); rows = (len(tiles) + cols - 1) // cols
    sheet = Image.new('RGB', (w * cols, h * rows), (20, 20, 20))
    for i, t in enumerate(tiles): sheet.paste(t, ((i % cols) * w, (i // cols) * h))
    sheet.save(out); print('wrote', out, sheet.size)
