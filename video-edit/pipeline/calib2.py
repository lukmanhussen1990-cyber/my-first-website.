"""Calibrate render softness against the source.

The video is a heavily compressed 559 kb/s H.264, so its glyphs are far softer
than a clean rasterisation. We render the *original* strings with our own fonts
and fit blur / size / weight so they match the real pixels; the winning
parameters then carry over to the replacement strings.
"""
import cv2, numpy as np, itertools
import render as R

frame = cv2.imread('all/0144.png')
gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY).astype(np.float32)

CASES = [
    dict(name='greet', parts=['Elon'], font=R.SERIF, size=69,
         ink=(363, 185, 488, 234), align='left'),
    dict(name='chip', parts=['Sonnet 4.6', 'Adapative'], font=R.SANS, size=38,
         ink=(246, 436, 565, 467), align='right', gap=17),
]

for c in CASES:
    ix0, iy0, ix1, iy1 = c['ink']
    pad = 14
    patch = gray[iy0 - pad:iy1 + pad, ix0 - pad:ix1 + pad]
    bg = np.percentile(patch, 12)
    target = patch - bg
    best = None
    for cond, scale, sigma in itertools.product(
            [0.86,0.89,0.92,0.95,0.98,1.01,1.04], [0.90,0.93,0.96,0.99,1.02,1.05],
            [0.5,0.6,0.7,0.8,0.9]):
        a, wh = R.render_block(c['parts'], c['font'], c['size'] * scale,
                              c['size'], cond, c.get('gap', 0))
        if a is None:
            continue
        if sigma > 0:
            a = cv2.GaussianBlur(a, (0, 0), sigma)
        w, h = a.shape[1], a.shape[0]
        canvas = np.zeros_like(target)
        # align: ink bottom to iy1, left or right edge to the ink box
        oy = (iy1 - iy0 + pad) - h
        ox = pad if c['align'] == 'left' else (ix1 - ix0 + pad) - w
        y0, x0 = max(0, oy), max(0, ox)
        y1, x1 = min(canvas.shape[0], oy + h), min(canvas.shape[1], ox + w)
        if y1 <= y0 or x1 <= x0:
            continue
        canvas[y0:y1, x0:x1] = a[y0 - oy:y1 - oy, x0 - ox:x1 - ox]
        # best least-squares amplitude for this shape
        denom = float((canvas * canvas).sum())
        if denom < 1e-6:
            continue
        k = float((canvas * target).sum()) / denom
        err = float(((target - k * canvas) ** 2).mean())
        if best is None or err < best[0]:
            best = (err, cond, scale, sigma, k)
    err, cond, scale, sigma, k = best
    print(f"{c['name']}: condense={cond} size_scale={scale} sigma={sigma} "
          f"peak_amp={k:.1f} rmse={np.sqrt(err):.2f}")
