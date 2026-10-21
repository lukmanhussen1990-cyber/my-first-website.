#!/usr/bin/env python3
"""Contact sheet of stills with the subtitle band and Instagram UI zones overlaid (for composition checks)."""
import sys, glob, os
from PIL import Image, ImageDraw
src = sys.argv[1]; out = sys.argv[2]; cols = int(sys.argv[3]) if len(sys.argv) > 3 else 6
fs = sorted(glob.glob(os.path.join(src, 't_*.png')))
tw, th = 270, 480
rows = (len(fs) + cols - 1) // cols
sheet = Image.new('RGB', (cols * tw, rows * (th + 18)), (20, 20, 20))
d = ImageDraw.Draw(sheet)
for i, f in enumerate(fs):
    im = Image.open(f).convert('RGB').resize((tw, th))
    ov = Image.new('RGBA', (tw, th), (0, 0, 0, 0)); od = ImageDraw.Draw(ov)
    od.rectangle([tw * 0.2, th * 0.365, tw * 0.78, th * 0.445], outline=(0, 255, 255, 200), width=1)  # subtitle band
    od.rectangle([0, th * 0.8, tw, th], fill=(255, 0, 0, 40))  # IG caption zone
    od.rectangle([tw * 0.86, th * 0.5, tw, th * 0.8], fill=(255, 0, 0, 40))  # IG buttons
    im = Image.alpha_composite(im.convert('RGBA'), ov).convert('RGB')
    x, y = (i % cols) * tw, (i // cols) * (th + 18)
    sheet.paste(im, (x, y + 18)); d.text((x + 4, y + 2), os.path.basename(f)[2:-4] + 's', fill=(255, 255, 255))
sheet.save(out)
print(out, len(fs))
