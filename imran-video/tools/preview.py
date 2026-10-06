#!/usr/bin/env python3
"""Render a labelled contact sheet of frames between two times.
usage: python3 tools/preview.py START END COUNT OUT.png [--cols 4] [--width 640] [--solo sceneId]
       python3 tools/preview.py --times 1.0,2.5,3.2 OUT.png
"""
import argparse, os, subprocess, sys, tempfile, shutil
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ap = argparse.ArgumentParser()
ap.add_argument('start', nargs='?'); ap.add_argument('end', nargs='?'); ap.add_argument('count', nargs='?')
ap.add_argument('out')
ap.add_argument('--times'); ap.add_argument('--cols', type=int, default=4); ap.add_argument('--width', type=int, default=640)
ap.add_argument('--solo')
a = ap.parse_args()
if a.times:
    times = [float(x) for x in a.times.split(',')]
else:
    s, e, n = float(a.start), float(a.end), int(a.count)
    times = [s + (e - s) * i / max(1, n - 1) for i in range(n)]
tmp = tempfile.mkdtemp()
cmd = ['node', os.path.join(ROOT, 'render.cjs'), '--times', ','.join(f'{t:.4f}' for t in times), '--out', tmp, '--format', 'jpg']
if a.solo: cmd += ['--solo', a.solo]
r = subprocess.run(cmd, capture_output=True, text=True)
sys.stderr.write(r.stderr); print(r.stdout.strip())
cols = min(a.cols, len(times)); rows = (len(times) + cols - 1) // cols
w = a.width; h = w * 9 // 16
sheet = Image.new('RGB', (cols * w, rows * (h + 22)), (30, 30, 30))
d = ImageDraw.Draw(sheet)
try: fnt = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 15)
except Exception: fnt = None
for i, t in enumerate(times):
    p = os.path.join(tmp, f't_{t:.3f}.jpg')
    if not os.path.exists(p): continue
    im = Image.open(p).resize((w, h), Image.LANCZOS)
    x, y = (i % cols) * w, (i // cols) * (h + 22)
    sheet.paste(im, (x, y + 22))
    d.text((x + 6, y + 3), f't={t:.2f}s', fill=(255, 220, 120), font=fnt)
sheet.save(a.out)
shutil.rmtree(tmp)
print('wrote', a.out, f'({len(times)} frames)')
