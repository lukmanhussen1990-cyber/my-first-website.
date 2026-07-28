"""Compare brightness and edge sharpness of edited text against the original."""
import cv2, numpy as np, glob
import render as R
from preview import edit
from traj import build

files = sorted(glob.glob('all/*.png'))
traj, _ = build()

def stats(img, box, s, tx, ty):
    x0, y0, x1, y1 = box
    X0, Y0 = int(round(x0 * s + tx)), int(round(y0 * s + ty))
    X1, Y1 = int(round(x1 * s + tx)), int(round(y1 * s + ty))
    H, W = img.shape[:2]
    X0, Y0, X1, Y1 = max(0, X0), max(0, Y0), min(W, X1), min(H, Y1)
    if X1 - X0 < 6 or Y1 - Y0 < 6:
        return None
    g = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY).astype(np.float32)[Y0:Y1, X0:X1]
    bg = np.percentile(g, 12)
    peak = np.percentile(g, 99.5) - bg
    gx = cv2.Sobel(g, cv2.CV_32F, 1, 0, ksize=3)
    gy = cv2.Sobel(g, cv2.CV_32F, 0, 1, ksize=3)
    grad = np.percentile(np.hypot(gx, gy), 99.5)
    return peak, grad, float(g.mean() - bg)

print(f"{'frame':>5} {'job':6} {'peak orig':>10} {'peak edit':>10} "
      f"{'grad orig':>10} {'grad edit':>10} {'mean orig':>10} {'mean edit':>10}")
for fr in [72, 92, 100, 128, 144, 152, 160]:
    if fr not in traj:
        continue
    s, tx, ty = traj[fr]
    a = cv2.imread(files[fr - 1])
    b = edit(fr)
    for job in R.JOBS:
        sa = stats(a, job['ink'], s, tx, ty)
        sb = stats(b, job['ink'], s, tx, ty)
        if not sa or not sb:
            continue
        print(f"{fr:5d} {job['key']:6} {sa[0]:10.1f} {sb[0]:10.1f} "
              f"{sa[1]:10.1f} {sb[1]:10.1f} {sa[2]:10.1f} {sb[2]:10.1f}")
