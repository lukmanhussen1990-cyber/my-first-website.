"""Fit per-frame geometry (uniform scale about an anchor + translation) and gain of the
'Jensei' wordmark in the reference, using the settled wordmark of frame 1340 as template."""
import sys, json
sys.path.insert(0, '/tmp/claude-0/-home-user-my-first-website-/4f2370d4-b0d4-589b-a9a6-5a27c4fb85e7/scratchpad/tools')
from common import *
from scipy.optimize import minimize

TEMPLATE_FRAME = 1340

def text_support(D, thr=3.0):
    return D.mean(2) > thr

def template():
    im = load(TEMPLATE_FRAME)
    sup = cv2.dilate((im.mean(2) > 2).astype(np.uint8), np.ones((15, 15), np.uint8)).astype(bool)
    sup[:, :700] = False; sup[:, 1250:] = False; sup[:380] = False; sup[680:] = False
    bg = harmonic_fill(im, sup)
    T = np.clip(im - bg, 0, None)
    T[~sup] = 0
    ys, xs = np.nonzero(T.mean(2) > 10)
    anchor = ((xs.min() + xs.max()) / 2.0, (ys.min() + ys.max()) / 2.0)
    return T, anchor, (xs.min(), xs.max(), ys.min(), ys.max())

def M_of(s, tx, ty, anchor):
    ax, ay = anchor
    return np.float32([[s, 0, (1 - s) * ax + tx], [0, s, (1 - s) * ay + ty]])

def warp(img, s, tx, ty, anchor):
    return cv2.warpAffine(img, M_of(s, tx, ty, anchor), (1920, 1080), flags=cv2.INTER_LINEAR, borderValue=0)

def bg_for(im, box, margin=34):
    x0, x1, y0, y1 = box
    m = np.zeros(im.shape[:2], bool)
    m[max(int(y0 - margin), 0):int(y1 + margin), max(int(x0 - margin), 0):int(x1 + margin)] = True
    return harmonic_fill(im, m), m

def fit_frame(i, T, anchor, tbox, init):
    im = load(i)
    s0, tx0, ty0 = init
    ax, ay = anchor
    x0, x1, y0, y1 = tbox
    box = (ax + s0 * (x0 - ax) + tx0, ax + s0 * (x1 - ax) + tx0, ay + s0 * (y0 - ay) + ty0, ay + s0 * (y1 - ay) + ty0)
    bg, m = bg_for(im, box)
    D = (im - bg).mean(2)
    Tl = T.mean(2)
    Db = gblur(D, 3.0)
    ys, xs = np.nonzero(m)
    sl = (slice(ys.min(), ys.max() + 1), slice(xs.min(), xs.max() + 1))
    def err(p):
        W = gblur(warp(Tl, p[0], p[1], p[2], anchor), 3.0)
        a, b = W[sl].ravel(), Db[sl].ravel()
        g = max((a @ b) / (a @ a + 1e-9), 0)
        return float(((b - g * a) ** 2).mean())
    r = minimize(err, [s0, tx0, ty0], method='Powell', options={'xtol': 1e-4, 'ftol': 1e-6, 'maxfev': 600})
    s, tx, ty = r.x
    W = warp(Tl, s, tx, ty, anchor)
    a, b = gblur(W, 3.0)[sl].ravel(), Db[sl].ravel()
    g = max((a @ b) / (a @ a + 1e-9), 0)
    return dict(frame=i, s=float(s), tx=float(tx), ty=float(ty), gain=float(g), err=float(r.fun))

if __name__ == '__main__':
    frames = [int(a) for a in sys.argv[2:]]
    out = sys.argv[1]
    T, anchor, tbox = template()
    print('anchor', anchor, 'tbox', tbox, flush=True)
    res = []
    init = None
    for i in frames:
        if init is None:
            im = load(i); g = im.mean(2)
            roi = g[380:720, 560:1360]; ys, xs = np.nonzero(roi > np.median(roi) + 25)
            bw = xs.max() - xs.min(); tw = tbox[1] - tbox[0]
            s0 = bw / tw
            cx = (xs.min() + xs.max()) / 2 + 560; cy = (ys.min() + ys.max()) / 2 + 380
            init = (s0, cx - anchor[0], cy - anchor[1])
        r = fit_frame(i, T, anchor, tbox, init)
        res.append(r)
        init = (r['s'], r['tx'], r['ty'])
        print(json.dumps(r), flush=True)
    json.dump(dict(anchor=anchor, tbox=[int(v) for v in tbox], fits=res), open(out, 'w'), indent=1)

CRISP_FRAME = 1276
def template_crisp():
    """Crisp wordmark template in the frame-1340 template space, taken from frame 1276
    (where every letter is in focus) and mapped back through its fitted geometry."""
    import os
    cache = f'{S}/wm/T_crisp.npy'
    T, anchor, tbox = template()
    if os.path.exists(cache):
        return np.load(cache), anchor, tbox
    G = json.load(open(f'{S}/wm/geom_s2.json'))
    g = [f for f in G['fits'] if f['frame'] == CRISP_FRAME][0]
    im = load(CRISP_FRAME)
    W = warp(T, g['s'], g['tx'], g['ty'], anchor)
    sup = cv2.dilate((W.mean(2) > 0.8).astype(np.uint8), cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (61, 61))).astype(bool)
    bg = harmonic_fill(im, sup)
    D = np.clip(im - bg, 0, None); D[~sup] = 0
    Minv = cv2.invertAffineTransform(M_of(g['s'], g['tx'], g['ty'], anchor))
    Tc = cv2.warpAffine(D, Minv, (1920, 1080), flags=cv2.INTER_AREA, borderValue=0)
    np.save(cache, Tc.astype(np.float32))
    return Tc, anchor, tbox
