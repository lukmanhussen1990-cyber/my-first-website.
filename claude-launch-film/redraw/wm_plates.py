"""Clean plates for the two 'Claude' wordmark moments: the reference frames with the old wordmark (and, at f350,
the next scene's first headline letters) filled from the surrounding light field."""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *
from bgplate import fill_fast
def textmask(im, rect, thr=7, grow=17):
    x0, y0, x1, y1 = rect
    g = cv2.cvtColor(im.astype(np.uint8), cv2.COLOR_RGB2GRAY).astype(np.float32)
    bg = cv2.GaussianBlur(g, (0, 0), 25)
    m = np.zeros(g.shape, bool); sub = (g - bg)[y0:y1, x0:x1]
    m[y0:y1, x0:x1] = np.abs(sub) > thr
    ys, xs = np.nonzero(m)
    out = np.zeros(g.shape, bool)
    if len(xs) > 30:                                  # the word's padded bounding box: soft edges and halo go too
        out[max(y0, ys.min() - 34):min(y1, ys.max() + 34), max(x0, xs.min() - 40):min(x1, xs.max() + 40)] = True
    return out
for scene, a, b, rect in (('S03_dark_titles', 306, 350, (560, 340, 1370, 720)), ('S13_final_wordmark', 1268, 1348, (600, 360, 1330, 700))):
    od = f'{S}/rd/plates/{scene}'; os.makedirs(od, exist_ok=True)
    for f in range(a, b + 1):
        im = load(f)
        m = textmask(im, rect)
        if f >= 349 and f <= 350: m |= textmask(im, (90, 100, 360, 300))          # first letters of the next headline
        if 340 <= f <= 350: m[450:615, 690:1240] = True                             # faint word over the rising light
        out = fill_fast(im, m) if m.any() else im
        save(f'{od}/bg_{f:04d}.jpg', out)
    print(scene, 'done')
