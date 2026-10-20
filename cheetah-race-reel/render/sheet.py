#!/usr/bin/env python3
"""Render a list of times at low resolution and tile them into a contact sheet.
usage: sheet.py out.png "t1,t2,..." [w h samples cols]"""
import json, subprocess, sys, os
out, times = sys.argv[1], [float(x) for x in sys.argv[2].split(',')]
w, h = int(sys.argv[3]) if len(sys.argv) > 3 else 270, int(sys.argv[4]) if len(sys.argv) > 4 else 480
n = int(sys.argv[5]) if len(sys.argv) > 5 else 1
cols = int(sys.argv[6]) if len(sys.argv) > 6 else 8
tmp = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'work', 'sheet_tmp')
os.makedirs(tmp, exist_ok=True)
jobs = [{"query": f"mode=film&w={w}&h={h}", "out": f"{tmp}/f_{t:07.3f}.png", "t": t, "samples": n} for t in times]
json.dump(jobs, open(f'{tmp}/jobs.json', 'w'))
r = subprocess.run(['node', 'render/stills.mjs', f'{tmp}/jobs.json'], env={**os.environ, 'DISPLAY': ':99'}, capture_output=True, text=True)
print(r.stdout[-2000:], r.stderr[-2000:])
from PIL import Image, ImageDraw
ims = [Image.open(j['out']) for j in jobs]
rows = (len(ims) + cols - 1) // cols
sheet = Image.new('RGB', (cols * w, rows * (h + 18)), (20, 20, 20))
d = ImageDraw.Draw(sheet)
for i, (im, t) in enumerate(zip(ims, times)):
    x, y = (i % cols) * w, (i // cols) * (h + 18)
    sheet.paste(im, (x, y + 18)); d.text((x + 4, y + 3), f't={t:.2f}', fill=(255, 255, 0))
    # subtitle band guide (36-44% of the height)
    for fy in (0.36, 0.44):
        d.line([(x, y + 18 + int(fy * h)), (x + w - 1, y + 18 + int(fy * h))], fill=(255, 40, 40), width=1)
sheet.save(out)
