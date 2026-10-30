"""Tile preview PNGs into one contact sheet: python3 sheet.py out.png a.png b.png ...
Optional crop box via env CROP="x0,y0,x1,y1" (frame pixels) and SCALE."""
import os
import sys
from PIL import Image, ImageDraw

out, files = sys.argv[1], sys.argv[2:]
crop = os.environ.get("CROP")
scale = float(os.environ.get("SCALE", "0.3"))
cols = int(os.environ.get("COLS", "4"))
ims = []
for f in files:
    im = Image.open(f).convert("RGB")
    if crop:
        im = im.crop(tuple(int(v) for v in crop.split(",")))
    im = im.resize((int(im.width * scale), int(im.height * scale)), Image.LANCZOS)
    ImageDraw.Draw(im).text((6, 6), os.path.basename(f), fill=(255, 255, 0))
    ims.append(im)
w, h = ims[0].size
rows = (len(ims) + cols - 1) // cols
sheet = Image.new("RGB", (w * min(cols, len(ims)), h * rows))
for i, im in enumerate(ims):
    sheet.paste(im, ((i % cols) * w, (i // cols) * h))
sheet.save(out)
