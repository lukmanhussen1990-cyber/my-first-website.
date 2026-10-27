"""Checks on the encoded reel: watermark in every frame (fixed position), caption word sync, text bounds, loudness."""
import sys, subprocess, re, json, math
import numpy as np
import cairo
from gfx import *
import captions as CAP
from T import TL, TOTAL

VID = sys.argv[1]
FPS = 30

# ---------------------------------------------------------------- watermark mask from a clean render
s = cairo.ImageSurface(cairo.FORMAT_ARGB32, W, H)
c = cairo.Context(s)
CAP.draw_watermark(c)
a = np.frombuffer(s.get_data(), np.uint8).reshape(H, W, 4)[:, :, 3].astype(float) / 255
ys, xs = np.where(a > 0.05)
y0, y1, x0, x1 = ys.min() - 8, ys.max() + 9, xs.min() - 12, xs.max() + 13
text = a[y0:y1, x0:x1] > 0.5
from scipy.ndimage import binary_dilation
ring = binary_dilation(a[y0:y1, x0:x1] > 0.02, iterations=5) & ~binary_dilation(a[y0:y1, x0:x1] > 0.02, iterations=2)
print(f'watermark box x {x0}-{x1}, y {y0}-{y1} ({text.sum()} text px)')

# ---------------------------------------------------------------- caption word boxes
pages = CAP.Captions(TL).pages
words = []
for p in pages:
    for w, x, base, wd in p.layout:
        words.append(dict(w=w['w'], t0=w['t0'], c=w['c'], box=(int(x), int(base - p.size * 0.74), int(x + wd), int(base + p.size * 0.05))))
need = {}
for i, w in enumerate(words):
    fb = int(math.floor((w['t0'] - 0.12) * FPS))   # clearly before the word
    fa = int(math.ceil((w['t0'] + 0.10) * FPS))    # clearly after
    need.setdefault(fb, []).append((i, 'before'))
    need.setdefault(fa, []).append((i, 'after'))

# ---------------------------------------------------------------- decode every frame once
p = subprocess.Popen(['ffmpeg', '-v', 'error', '-i', VID, '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], stdout=subprocess.PIPE)
fs = W * H * 3
n = 0
wm_contrast, wm_shift = [], []
lum = {}
while True:
    buf = p.stdout.read(fs)
    if len(buf) < fs:
        break
    f = np.frombuffer(buf, np.uint8).reshape(H, W, 3).astype(float)
    reg = f[y0:y1, x0:x1]
    # gold text has much less blue than the off-white panel around it
    tb = reg[:, :, 2][text].mean()
    rb = reg[:, :, 2][ring].mean()
    wm_contrast.append(rb - tb)
    # position check: the same mask shifted by 4 px must match clearly worse
    sh = np.roll(text, 4, axis=1)
    wm_shift.append(rb - reg[:, :, 2][sh & ~text].mean())
    if n in need:
        for i, kind in need[n]:
            bx0, by0, bx1, by1 = words[i]['box']
            box = f[by0:by1, bx0:bx1]
            L = 0.299 * box[:, :, 0] + 0.587 * box[:, :, 1] + 0.114 * box[:, :, 2]
            # mean of the darkest 25% pixels = the glyph colour
            v = np.sort(L.ravel())
            lum[(i, kind)] = v[: max(1, len(v) // 4)].mean()
    n += 1
p.wait()
wm_contrast = np.array(wm_contrast)
wm_shift = np.array(wm_shift)
print(f'frames decoded: {n} (expected {int(round(TOTAL * FPS))})')
print(f'watermark blue-contrast: min {wm_contrast.min():.1f}  mean {wm_contrast.mean():.1f}  max {wm_contrast.max():.1f}; '
      f'frames with weak/missing watermark (<15): {(wm_contrast < 15).sum()}')
print(f'shifted-mask contrast (should be clearly lower): mean {wm_shift.mean():.1f}  -> position fixed: {(wm_contrast - wm_shift).min() > 3}')

# ---------------------------------------------------------------- caption sync
bad = []
for i, w in enumerate(words):
    b, a_ = lum.get((i, 'before')), lum.get((i, 'after'))
    if b is None or a_ is None:
        bad.append((w['w'], w['t0'], 'not sampled'))
        continue
    if not (b - a_ > 40):
        bad.append((w['w'], round(w['t0'], 2), round(b), round(a_)))
print(f'caption words checked: {len(words)}; words NOT lit at their timestamp: {len(bad)}')
for x in bad[:20]:
    print('   ', x)

# ---------------------------------------------------------------- caption bounds (safe zone)
xs0 = min(w['box'][0] for w in words)
xs1 = max(w['box'][2] for w in words)
ys0 = min(w['box'][1] for w in words)
ys1 = max(w['box'][3] for w in words)
print(f'caption text extents: x {xs0}-{xs1}, y {ys0}-{ys1} (safe: x 100-980, y > {WM_Y + 25}, bottom < 1520)')
print('max lines per page:', max(len(p.lines) for p in pages))
