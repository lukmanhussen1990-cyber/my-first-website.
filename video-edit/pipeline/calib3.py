"""Does the source's softness scale with the camera zoom, or is it fixed in pixels?

Fit blur sigma for the same string at several camera scales; if sigma is
roughly constant the softness is an encoder artefact, if it tracks s it is part
of the composition.
"""
import cv2, numpy as np, itertools, glob
import render as R
from traj import build

files = sorted(glob.glob('all/*.png'))
traj, _ = build()

CASES = [
    dict(name='greet', parts=['Elon'], font=R.SERIF, size=69, cond=0.96,
         sizescale=0.94, ink=(363, 185, 488, 234), align='left',
         frames=[72, 78, 92, 100, 128, 144, 152, 160]),
    dict(name='chip', parts=['Sonnet 4.6', 'Adapative'], font=R.SANS, size=38,
         cond=1.04, sizescale=0.90, ink=(246, 436, 565, 467), align='right',
         gap=17, frames=[92, 100, 128, 144, 152, 160]),
]

for c in CASES:
    print(f"--- {c['name']} ---")
    for fr in c['frames']:
        if fr not in traj:
            continue
        s, tx, ty = traj[fr]
        g = cv2.cvtColor(cv2.imread(files[fr - 1]), cv2.COLOR_BGR2GRAY).astype(np.float32)
        ix0, iy0, ix1, iy1 = c['ink']
        fx0, fy0 = ix0 * s + tx, iy0 * s + ty
        fx1, fy1 = ix1 * s + tx, iy1 * s + ty
        pad = 14
        X0, Y0 = int(round(fx0 - pad)), int(round(fy0 - pad))
        X1, Y1 = int(round(fx1 + pad)), int(round(fy1 + pad))
        if X0 < 0 or Y0 < 0 or X1 > g.shape[1] or Y1 > g.shape[0]:
            print(f"  frame {fr}: off-screen, skipped"); continue
        target = g[Y0:Y1, X0:X1] - np.percentile(g[Y0:Y1, X0:X1], 12)
        best = None
        for sigma in [0.0, 0.4, 0.8, 1.2, 1.6, 2.0, 2.4, 2.8, 3.2, 3.8, 4.5]:
            a, wh = R.render_block(c['parts'], c['font'], c['size'] * c['sizescale'] * s,
                                   c['size'], c['cond'], c.get('gap', 0))
            if a is None:
                continue
            if sigma > 0:
                a = cv2.GaussianBlur(a, (0, 0), sigma)
            h, w = a.shape
            canvas = np.zeros_like(target)
            oy = int(round(fy1 - Y0)) - h
            ox = pad if c['align'] == 'left' else int(round(fx1 - X0)) - w
            y0, x0 = max(0, oy), max(0, ox)
            y1, x1 = min(canvas.shape[0], oy + h), min(canvas.shape[1], ox + w)
            if y1 <= y0 or x1 <= x0:
                continue
            canvas[y0:y1, x0:x1] = a[y0 - oy:y1 - oy, x0 - ox:x1 - ox]
            d = float((canvas * canvas).sum())
            if d < 1e-6:
                continue
            k = float((canvas * target).sum()) / d
            err = float(((target - k * canvas) ** 2).mean())
            if best is None or err < best[0]:
                best = (err, sigma, k)
        if best:
            print(f"  frame {fr}: s={s:.3f}  sigma={best[1]:.1f}  amp={best[2]:6.1f} "
                  f" rmse={np.sqrt(best[0]):.1f}   sigma/s={best[1]/s:.2f}")
