#!/usr/bin/env python3
"""Side-by-side grid: rendered frames (left) vs reference frames (right).

    python3 tools/compare.py <frame-dir> <out.png> <frame> [<frame> ...] [--size 400]

Reference frames come from $REF_FRAMES (1-based f_001.png naming, as
extracted by ffmpeg); rendered frames use 0-based f_000.png naming.
"""
import os, sys
from PIL import Image, ImageDraw

REF = os.environ.get('REF_FRAMES', 'reference/frames')
args = sys.argv[1:]
size = 400
if '--size' in args:
    i = args.index('--size'); size = int(args[i + 1]); del args[i:i + 2]
d, out, frames = args[0], args[1], [int(f) for f in args[2:]]
grid = Image.new('RGB', (size * 2, size * len(frames)), 'black')
dr = ImageDraw.Draw(grid)
for r, f in enumerate(frames):
    for c, (path, label) in enumerate([(f'{d}/f_{f:03d}.png', f'new {f}'), (f'{REF}/f_{f + 1:03d}.png', f'ref {f}')]):
        if os.path.exists(path):
            grid.paste(Image.open(path).convert('RGB').resize((size, size), Image.LANCZOS), (c * size, r * size))
        dr.text((c * size + 8, r * size + 6), label, fill='yellow')
grid.save(out)
print('wrote', out)
