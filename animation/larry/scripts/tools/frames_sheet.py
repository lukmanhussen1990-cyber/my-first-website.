# Review helper: every Kth final frame of one or more shots in a grid, with a frame-difference pop score.
# Usage: python3 frames_sheet.py <frames_dir> <out.png> <K> sh01 [sh02 ...]
import sys, glob, os
import numpy as np
from PIL import Image, ImageDraw, ImageFont
FD, OUT, K, shots = sys.argv[1], sys.argv[2], int(sys.argv[3]), sys.argv[4:]
F = ImageFont.truetype("/usr/share/fonts/opentype/inter/Inter-ExtraBold.otf", 15)
TW, TH, PER = 135, 240, 8
tiles = []
for sh in shots:
    fs = sorted(glob.glob(f"{FD}/{sh}/f_*.png"))
    ims = [Image.open(f).convert("RGB") for f in fs]
    arr = [np.asarray(i.resize((54, 96))).astype(float) for i in ims]
    d = [0.0] + [float(np.abs(arr[k] - arr[k - 1]).mean()) for k in range(1, len(arr))]
    med = float(np.median(d[1:])) if len(d) > 2 else 1.0
    pops = [k + 1 for k in range(1, len(d)) if d[k] > 3 * med and d[k] > 5]
    print(sh, len(fs), "frames; pops at frames", pops, "median diff", round(med, 2))
    for k in range(0, len(ims), K):
        t = ims[k].resize((TW, TH)); dr = ImageDraw.Draw(t)
        dr.text((3, 2), f"{sh} {k + 1}", fill=(255, 255, 0), font=F, stroke_width=2, stroke_fill=(0, 0, 0))
        tiles.append(t)
rows = (len(tiles) + PER - 1) // PER
s = Image.new("RGB", (TW * PER, TH * rows), (20, 20, 20))
for i, t in enumerate(tiles):
    s.paste(t, ((i % PER) * TW, (i // PER) * TH))
s.save(OUT)
print(OUT, s.size)
