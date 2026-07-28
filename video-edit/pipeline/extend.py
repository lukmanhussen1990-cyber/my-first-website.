"""Extend the trajectory over the fade-out tail.

The greeting is still legible for a few frames after the tracker's confidence
drops, so we walk forward frame by frame with the search constrained to a
neighbourhood of the previous estimate.
"""
import cv2, numpy as np, json, glob, sys
from match import hp, ncc_floored
from traj import build

files = sorted(glob.glob('all/*.png'))
refh = hp(cv2.imread(files[143], cv2.IMREAD_GRAYSCALE))
BOX = (95, 173, 345, 250)                   # "morning," in scene space
ox, oy, x1, y1 = BOX
tpl = refh[oy:y1, ox:x1]

traj, _ = build()
last = max(traj)
cur = list(traj[last])
extra = {}

def pad(img, p):
    return cv2.copyMakeBorder(img, p, p, p, p, cv2.BORDER_CONSTANT, value=0)

for i in range(last + 1, last + 8):
    if i > len(files):
        break
    g = cv2.imread(files[i - 1], cv2.IMREAD_GRAYSCALE)
    fh = hp(g)
    p = int(max(tpl.shape) * 0.6)
    fhp = pad(fh, p)
    s0, tx0, ty0 = cur
    best = None
    for s in np.arange(s0 - 0.04, s0 + 0.041, 0.005):
        t = cv2.resize(tpl, (int(round(tpl.shape[1] * s)), int(round(tpl.shape[0] * s))),
                       interpolation=cv2.INTER_AREA if s < 1 else cv2.INTER_CUBIC)
        r = ncc_floored(fhp, t)
        if r is None:
            continue
        # constrain to a window around the predicted position
        gx, gy = ox * s + tx0 + p, oy * s + ty0 + p
        X0, X1 = int(max(0, gx - 45)), int(min(r.shape[1], gx + 45))
        Y0, Y1 = int(max(0, gy - 45)), int(min(r.shape[0], gy + 45))
        if X1 <= X0 or Y1 <= Y0:
            continue
        _, mx, _, ml = cv2.minMaxLoc(r[Y0:Y1, X0:X1])
        fx, fy = ml[0] + X0 - p, ml[1] + Y0 - p
        if best is None or mx > best[0]:
            best = (float(mx), s, fx - ox * s, fy - oy * s)
    if best is None or best[0] < 0.22:
        print(f"{i}: stop (score {best[0] if best else 0:.2f})")
        break
    cur = [best[1], best[2], best[3]]
    extra[i] = cur
    print(f"{i}: score={best[0]:.2f} s={cur[0]:.3f} tx={cur[1]:.1f} ty={cur[2]:.1f}")

json.dump(extra, open('traj_extra.json', 'w'))
