"""Track a rigid keyframe mask of the original Chor through a frame range (masked TM_CCOEFF_NORMED).
usage: track_chor.py S key n0 n1 out.json [--ds 0.03] [--rad 40] [--prior house_T.json]"""
import cv2, numpy as np, json, argparse

ap = argparse.ArgumentParser()
ap.add_argument('S'); ap.add_argument('key', type=int); ap.add_argument('n0', type=int); ap.add_argument('n1', type=int)
ap.add_argument('out')
ap.add_argument('--ds', type=float, default=0.03)
ap.add_argument('--rad', type=int, default=40)
ap.add_argument('--method', default='ccorr', choices=['ccorr', 'ccoeff'])
ap.add_argument('--prior', default=None, help='json with per-frame scale prior (house track): scale follows its ratio')
a = ap.parse_args()
S = a.S
PAD = 420
cap = cv2.VideoCapture(S + '/src/A_original.mp4')


def frame(n):
    cap.set(cv2.CAP_PROP_POS_FRAMES, n)
    return cap.read()[1]


def prep(f):
    f = f.astype(np.float32)
    g = f.mean(axis=2)
    if a.method == 'ccorr':
        feat = 0.6 * g + 0.4 * np.clip(f[..., 0] - f[..., 2], 0, 255)
    else:
        feat = 0.5 * g + 0.75 * np.clip(f[..., 0] - f[..., 2], 0, 255)
    feat[:92] = 0
    feat[628:] = 0
    return cv2.copyMakeBorder(feat, PAD, PAD, PAD, PAD, cv2.BORDER_CONSTANT, value=0)


km = cv2.imread(S + f'/assets/keymask/km_{a.key}.png', 0) > 127
ys, xs = np.where(km)
bx0, by0, bx1, by1 = xs.min() - 6, ys.min() - 6, xs.max() + 7, ys.max() + 7
kf = prep(frame(a.key))
tmpl = kf[by0 + PAD:by1 + PAD, bx0 + PAD:bx1 + PAD]
tmask = cv2.dilate(km.astype(np.uint8), np.ones((7, 7) if a.method == 'ccorr' else (9, 9), np.uint8))[by0:by1, bx0:bx1]
tmask = tmask.astype(np.float32) if a.method == 'ccorr' else tmask.astype(np.uint8)
METH = cv2.TM_CCORR_NORMED if a.method == 'ccorr' else cv2.TM_CCOEFF_NORMED
prior = None
if a.prior:
    prior = {int(k): v['s'] for k, v in json.load(open(a.prior)).items()}


def search(f, s_c, x_c, y_c, ds, rad):
    best = None
    for s in np.arange(s_c - ds, s_c + ds + 1e-9, max(0.004, ds / 5)):
        if s < 0.2:
            continue
        t = cv2.resize(tmpl, None, fx=s, fy=s, interpolation=cv2.INTER_AREA)
        m = cv2.resize(tmask, (t.shape[1], t.shape[0]), interpolation=cv2.INTER_NEAREST)
        ex, ey = x_c + s * bx0 + PAD, y_c + s * by0 + PAD
        X0, Y0 = int(max(0, ex - rad)), int(max(0, ey - rad))
        X1, Y1 = int(min(f.shape[1], ex + rad + t.shape[1])), int(min(f.shape[0], ey + rad + t.shape[0]))
        win = f[Y0:Y1, X0:X1]
        if win.shape[0] < t.shape[0] or win.shape[1] < t.shape[1]:
            continue
        r = np.nan_to_num(cv2.matchTemplate(win, t, METH, mask=m), nan=-1, posinf=-1, neginf=-1)
        _, mv, _, ml = cv2.minMaxLoc(r)
        if best is None or mv > best[0]:
            best = (mv, s, X0 + ml[0] - PAD - s * bx0, Y0 + ml[1] - PAD - s * by0)
    return best


res = {a.key: dict(score=1.0, s=1.0, ox=0.0, oy=0.0)}
for direction in (1, -1):
    s_c, x_c, y_c, vx, vy = 1.0, 0.0, 0.0, 0.0, 0.0
    prev = a.key
    rng = range(a.key + 1, a.n1 + 1) if direction == 1 else range(a.key - 1, a.n0 - 1, -1)
    for n in rng:
        f = prep(frame(n))
        if prior and n in prior and prev in prior:
            s_c = s_c * prior[n] / prior[prev]
        b = search(f, s_c, x_c + vx, y_c + vy, a.ds, a.rad)
        if b is None or b[0] < 0.45:
            b2 = search(f, s_c, x_c + vx, y_c + vy, a.ds * 2.5, a.rad * 3)
            if b2 and (b is None or b2[0] > b[0]):
                b = b2
        mv, s_n, x_n, y_n = b
        vx, vy = 0.6 * vx + 0.4 * (x_n - x_c), 0.6 * vy + 0.4 * (y_n - y_c)
        s_c, x_c, y_c = s_n, x_n, y_n
        res[n] = dict(score=round(float(mv), 4), s=round(float(s_c), 5), ox=round(float(x_c), 2), oy=round(float(y_c), 2))
        prev = n
json.dump({str(k): v for k, v in sorted(res.items())}, open(a.out, 'w'))
ks = sorted(res)
print(' | '.join('%d:s%.3f x%.0f y%.0f %.2f' % (k, res[k]['s'], res[k]['ox'], res[k]['oy'], res[k]['score'])
                 for k in ks[::max(1, len(ks) // 16)]))
print('min score', min(v['score'] for v in res.values()))
