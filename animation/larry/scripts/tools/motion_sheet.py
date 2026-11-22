"""Motion sheet for one shot: every 3rd frame in a grid (7 per row) + a pop score per step.
Usage: motion_sheet.py <episode number> out.png sh01"""
import sys, glob
import numpy as np
from PIL import Image, ImageDraw, ImageFont
EP, out, sh = sys.argv[1], sys.argv[2], sys.argv[3]
W = __import__('os').environ.get('LARRY_WORK', __import__('os').path.expanduser('~/larry_work'))
fs = sorted(glob.glob(f"{W}/ep{EP}/motion/{sh}/m_*.png"))
W, H, PER = 162, 288, 7
F = ImageFont.truetype("/usr/share/fonts/opentype/inter/Inter-ExtraBold.otf", 15)
ims = [Image.open(f).convert("RGB") for f in fs]
arr = [np.asarray(i.resize((54, 96))).astype(float) for i in ims]
d = [0.0] + [float(np.abs(arr[k] - arr[k - 1]).mean()) for k in range(1, len(arr))]
med = float(np.median(d[1:])) if len(d) > 2 else 1.0
rows = (len(ims) + PER - 1) // PER
s = Image.new("RGB", (W * PER, H * rows), (20, 20, 20))
for k, (f, im) in enumerate(zip(fs, ims)):
    t = im.resize((W, H)); dr = ImageDraw.Draw(t)
    pop = k > 0 and d[k] > 2.5 * med and d[k] > 4
    dr.text((4, 3), f"{int(f[-8:-4])}  d{d[k]:.1f}", fill=(255, 60, 60) if pop else (255, 255, 0), font=F)
    s.paste(t, ((k % PER) * W, (k // PER) * H))
s.save(out)
print(sh, len(ims), "frames; pops:", [int(fs[k][-8:-4]) for k in range(1, len(d)) if d[k] > 2.5 * med and d[k] > 4], "median", round(med, 2))
