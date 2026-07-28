"""Pick sigma/peak by matching perceptual statistics, not MSE.

A least-squares fit happily over-blurs, because blur hides the residual shape
difference between our font and the original one. Matching peak brightness and
edge-gradient energy instead keeps the replacement as crisp as its neighbours.
Calibration renders the ORIGINAL strings so it can be scored against the real
pixels.
"""
import cv2, numpy as np, glob, copy
import render as R
from traj import build

files = sorted(glob.glob('all/*.png'))
traj, _ = build()

ORIG = {'greet': (['Elon'], 0), 'chip': (['Sonnet 4.6', 'Adapative'], 17)}
FRAMES = [100, 144, 152, 160]

def measure(img, box, s, tx, ty):
    x0, y0, x1, y1 = box
    X0, Y0 = int(round(x0 * s + tx)), int(round(y0 * s + ty))
    X1, Y1 = int(round(x1 * s + tx)), int(round(y1 * s + ty))
    H, W = img.shape[:2]
    X0, Y0, X1, Y1 = max(0, X0), max(0, Y0), min(W, X1), min(H, Y1)
    if X1 - X0 < 6 or Y1 - Y0 < 6:
        return None
    g = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY).astype(np.float32)[Y0:Y1, X0:X1]
    bg = np.percentile(g, 12)
    gx = cv2.Sobel(g, cv2.CV_32F, 1, 0, ksize=3)
    gy = cv2.Sobel(g, cv2.CV_32F, 0, 1, ksize=3)
    return np.percentile(g, 99.5) - bg, np.percentile(np.hypot(gx, gy), 99.5)

def synth(job, parts, gap, fr, sigma_k, peak):
    s, tx, ty = traj[fr]
    frame = cv2.imread(files[fr - 1])
    frame, _ = R.inpaint_region(frame, job['erase'], s, tx, ty)
    alpha, wh = R.render_block(parts, job['font'], job['size'] * s, job['size'],
                               job['condense'], gap)
    if alpha is None:
        return None
    w, h = wh
    ix0, iy0, ix1, iy1 = job['ink']
    ox = (int(round(ix0 * s + tx)) if job['align'] == 'left'
          else int(round(ix1 * s + tx)) - w)
    oy = int(round(iy1 * s + ty)) - h
    return R.composite(frame, alpha, ox, oy, job['color'], peak, sigma_k * s)

for job in R.JOBS:
    parts, gap = ORIG[job['key']]
    tgt = []
    for fr in FRAMES:
        m = measure(cv2.imread(files[fr - 1]), job['ink'], *traj[fr])
        if m:
            tgt.append((fr, m))
    best = None
    for sk in [0.3, 0.5, 0.7, 0.9, 1.1, 1.3, 1.6, 2.0]:
        for peak in [150, 175, 200, 225, 250, 280, 320]:
            errs = []
            for fr, (tp, tg) in tgt:
                out = synth(job, parts, gap, fr, sk, peak)
                if out is None:
                    continue
                m = measure(out, job['ink'], *traj[fr])
                if not m:
                    continue
                errs.append((abs(m[0] - tp) / tp, abs(m[1] - tg) / tg))
            if not errs:
                continue
            e = float(np.mean([a + b for a, b in errs]))
            if best is None or e < best[0]:
                best = (e, sk, peak, np.mean([a for a, _ in errs]),
                        np.mean([b for _, b in errs]))
    print(f"{job['key']}: sigma_k={best[1]} peak={best[2]}  "
          f"peak_err={best[3]*100:.1f}%  grad_err={best[4]*100:.1f}%")
    print("   targets:", [(fr, f"peak={m[0]:.0f} grad={m[1]:.0f}") for fr, m in tgt])
