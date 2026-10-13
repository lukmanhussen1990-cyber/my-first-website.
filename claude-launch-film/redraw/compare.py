#!/usr/bin/env python3
"""Side-by-side reference (left) vs redraw (right) for chosen frames.
usage: compare.py SCENE f1 f2 ... [--crop x0,y0,x1,y1] [--scale s] [--out name]
Writes rd/cmp/<name>.jpg. Reference frames: scratchpad/png/fNNNN.png."""
import sys, os, argparse, cv2, numpy as np
RD = os.path.dirname(os.path.abspath(__file__)); REF = os.path.join(os.path.dirname(RD), 'png')
ap = argparse.ArgumentParser(); ap.add_argument('scene'); ap.add_argument('frames', nargs='+', type=int)
ap.add_argument('--crop', default=''); ap.add_argument('--scale', type=float, default=0.4); ap.add_argument('--out', default='')
a = ap.parse_args()
rows = []
for f in a.frames:
    r = cv2.imread(f'{REF}/f{f:04d}.png'); o = cv2.imread(f'{RD}/out/{a.scene}/f{f:04d}.png')
    if o is None: o = np.zeros_like(r)
    if a.crop:
        x0, y0, x1, y1 = map(int, a.crop.split(',')); r = r[y0:y1, x0:x1]; o = o[y0:y1, x0:x1]
    r = cv2.resize(r, None, fx=a.scale, fy=a.scale, interpolation=cv2.INTER_AREA); o = cv2.resize(o, None, fx=a.scale, fy=a.scale, interpolation=cv2.INTER_AREA)
    row = np.hstack([r, np.full((r.shape[0], 6, 3), 255, np.uint8), o])
    cv2.putText(row, f'{f}  {(f-1)/30:.2f}s', (6, 22), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 255), 2)
    rows += [row, np.full((6, row.shape[1], 3), 255, np.uint8)]
os.makedirs(f'{RD}/cmp', exist_ok=True)
name = a.out or f'{a.scene}_{a.frames[0]}-{a.frames[-1]}'
cv2.imwrite(f'{RD}/cmp/{name}.jpg', np.vstack(rows), [cv2.IMWRITE_JPEG_QUALITY, 88])
print(f'{RD}/cmp/{name}.jpg')
