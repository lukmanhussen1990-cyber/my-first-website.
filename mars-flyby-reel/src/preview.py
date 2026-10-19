"""Render selected timestamps to a contact sheet: python preview.py out.png t1 t2 ..."""
import sys
import time

import numpy as np
from PIL import Image, ImageDraw

import scenes

out = sys.argv[1]
ts = [float(x) for x in sys.argv[2:]]
thumbs = []
for t in ts:
    t0 = time.time()
    img, info = scenes.frame(t)
    im = Image.fromarray((np.clip(img, 0, 1) * 255).astype(np.uint8))
    im.save(out.replace(".png", f"_{t:05.2f}.png"))
    th = im.resize((360, 640), Image.LANCZOS)
    ImageDraw.Draw(th).text((8, 8), f"{t:.2f}s", fill=(255, 255, 0))
    thumbs.append(th)
    print(f"t={t:6.2f}  {time.time() - t0:5.2f}s  " +
          " ".join(f"{k}:({v['x']:.0f},{v['y']:.0f},r{v['r_px']:.1f})" for k, v in info.items() if v))
cols = min(len(thumbs), 4)
rows = (len(thumbs) + cols - 1) // cols
sheet = Image.new("RGB", (cols * 360, rows * 640), (40, 40, 40))
for i, th in enumerate(thumbs):
    sheet.paste(th, ((i % cols) * 360, (i // cols) * 640))
sheet.save(out)
