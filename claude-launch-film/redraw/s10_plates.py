"""S10 plates (f973-1090): the reference light field with the cards, titles and 'right one' removed.
Mask = footprint of the redrawn content (rendered alone, unioned over nearby frames so timing
differences are covered) + any remaining fine detail, grown a little; harmonic fill."""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *
from bgplate import fill_fast
a, b = int(sys.argv[1]), int(sys.argv[2])
AD = f'{S}/rd/work/S10_doctor_cards_alpha'
od = f'{S}/rd/plates/S10_doctor_cards/bg'; os.makedirs(od, exist_ok=True)
def alpha(g):
    im = cv2.imread(f'{AD}/f{g:04d}.png', cv2.IMREAD_UNCHANGED)
    return None if im is None else im[..., 3]
def row_fill(im, m, pad=4):
    """Fill masked runs row by row between their left/right neighbours (keeps horizontal bands such
    as the rising mist straight), then soften the filled area vertically."""
    out = im.copy(); H, W = m.shape
    for y in range(H):
        row = m[y]
        if not row.any(): continue
        xs = np.nonzero(row)[0]; runs = np.split(xs, np.nonzero(np.diff(xs) > 1)[0] + 1)
        for r in runs:
            x0, x1 = r[0], r[-1]
            lv = im[y, max(0, x0 - pad):x0].mean(0) if x0 > 0 else None
            rv = im[y, x1 + 1:min(W, x1 + 1 + pad)].mean(0) if x1 < W - 1 else None
            if lv is None: lv = rv
            if rv is None: rv = lv
            t = np.linspace(0, 1, x1 - x0 + 1)[:, None]
            out[y, x0:x1 + 1] = lv * (1 - t) + rv * t
    sm = cv2.GaussianBlur(out, (0, 0), sigmaX=1.0, sigmaY=6.0)
    w = cv2.GaussianBlur(m.astype(np.float32), (0, 0), 3)[..., None]
    out = np.where(m[..., None], sm, out); return out
for f in range(a, b + 1):
    im = load(f); L = im.mean(2)
    al = np.zeros(L.shape, np.uint8)
    for g in range(max(973, f - 4), min(1090, f + 6) + 1, 2):
        ag = alpha(g)
        if ag is not None: al = np.maximum(al, ag)
    g = 37 if f < 1056 else 121    # the zoomed card casts a wide soft violet glow
    m = cv2.dilate((al > 4).astype(np.uint8), cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (g, g)))
    # close the narrow gaps between cards / words so no thin strip of the original survives between them
    m = cv2.morphologyEx(m, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (91, 91)))
    hf = np.abs(L - cv2.GaussianBlur(L, (0, 0), 16))
    det = np.zeros_like(m); det[40:1040, 300:1620] = hf[40:1040, 300:1620] > 5
    det = cv2.dilate(cv2.morphologyEx(det, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8)), np.ones((25, 25), np.uint8))
    if f >= 1075:   # keep the outro's real window bevel and edges: detail only near the content
        near = cv2.dilate(m, np.ones((61, 61), np.uint8)); det &= near
    m = (m | det) > 0
    out = row_fill(im, m) if f >= 1086 else fill_fast(im, m)
    if f >= 1056:   # smooth away faint ridges inside the large fill (feathered into the untouched field)
        w = cv2.GaussianBlur(cv2.erode(m.astype(np.uint8), np.ones((31, 31), np.uint8)).astype(np.float32), (0, 0), 14)[..., None]
        out = out * (1 - w) + cv2.GaussianBlur(out, (0, 0), 22) * w
    cv2.imwrite(f'{od}/bg_{f:04d}.jpg', cv2.cvtColor(np.clip(out + 0.5, 0, 255).astype(np.uint8), cv2.COLOR_RGB2BGR), [cv2.IMWRITE_JPEG_QUALITY, 95])
print('plates', a, b)
