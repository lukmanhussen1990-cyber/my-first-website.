#!/usr/bin/env python3
"""Tile still frames into a labelled contact sheet; marks the subtitle band (36-45% from top)
and Instagram's bottom 20% / right-edge UI zones so framing can be checked at a glance."""
import sys, glob, os
from PIL import Image, ImageDraw, ImageFont
out = sys.argv[1]; files = sys.argv[2:]
cols = 4 if len(files) > 4 else len(files)
tw, th = 405, 720
rows = (len(files) + cols - 1) // cols
sheet = Image.new('RGB', (cols * tw, rows * th), (20, 20, 20))
try: font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 26)
except Exception: font = ImageFont.load_default()
for i, f in enumerate(files):
    im = Image.open(f).convert('RGB').resize((tw, th), Image.LANCZOS)
    d = ImageDraw.Draw(im, 'RGBA')
    d.rectangle([0, int(th * 0.36), tw, int(th * 0.45)], outline=(255, 255, 0, 180), width=2)
    d.rectangle([0, int(th * 0.80), tw, th], fill=(255, 0, 0, 28))
    d.rectangle([int(tw * 0.88), int(th * 0.45), tw, th], fill=(255, 0, 0, 28))
    lab = os.path.basename(f).replace('still_', '').replace('.png', '')
    d.text((8, 6), lab, fill=(255, 255, 255, 255), font=font, stroke_width=3, stroke_fill=(0, 0, 0, 255))
    sheet.paste(im, ((i % cols) * tw, (i // cols) * th))
sheet.save(out)
print(out, sheet.size)
