#!/usr/bin/env python3
"""Contact sheet: python3 scripts/sheet.py out.jpg img1 img2 ... [--w 270] [--cols 4]"""
import sys
from PIL import Image, ImageDraw
args = sys.argv[1:]
w = 270; cols = 4
if '--w' in args: i = args.index('--w'); w = int(args[i + 1]); del args[i:i + 2]
if '--cols' in args: i = args.index('--cols'); cols = int(args[i + 1]); del args[i:i + 2]
out, files = args[0], args[1:]
h = int(w * 1920 / 1080)
rows = (len(files) + cols - 1) // cols
S = Image.new('RGB', (cols * w + (cols - 1) * 4, rows * (h + 22)), (20, 20, 20))
d = ImageDraw.Draw(S)
for k, f in enumerate(files):
    im = Image.open(f).convert('RGB').resize((w, h), Image.LANCZOS)
    x, y = (k % cols) * (w + 4), (k // cols) * (h + 22)
    S.paste(im, (x, y + 20)); d.text((x + 4, y + 4), f.split('/')[-1], fill=(230, 230, 230))
S.save(out, quality=88)
print(out, S.size)
