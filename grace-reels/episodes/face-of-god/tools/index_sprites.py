"""Index every PNG under public/sprites into public/sprites/index.json.

name -> file, size, opaque bounds and the foot point (center of the lowest opaque rows), so pose sprites
can be planted on the ground and swapped without jumping. Run after the other sprite tools.
"""
import json
from pathlib import Path

import numpy as np
from PIL import Image

EP = Path(__file__).resolve().parent.parent
SP = EP / 'public' / 'sprites'

index = {}
for png in sorted(SP.rglob('*.png')):
    name = png.relative_to(SP).with_suffix('').as_posix()
    with Image.open(png) as im:
        a = np.asarray(im.convert('RGBA'))[..., 3]
    ys, xs = np.nonzero(a >= 128)
    bottom = int(ys.max())
    foot_x = float(xs[ys >= bottom - 8].mean())
    index[name] = {
        'file': f'sprites/{name}.png', 'w': int(a.shape[1]), 'h': int(a.shape[0]),
        'bbox': [int(xs.min()), int(ys.min()), int(xs.max()), bottom], 'foot': [round(foot_x, 1), bottom],
    }
(SP / 'index.json').write_text(json.dumps(index, indent=1) + '\n')
print(len(index), 'sprites indexed')
