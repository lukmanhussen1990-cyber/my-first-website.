"""Measure the reference's blur in S09 per frame: the sidebar strip (window-fixed) and the chat text
(content-fixed) are compared with a sharp frame mapped into place (window or content homography),
fitting an anisotropic Gaussian (sx, sy) that best explains the reference."""
import sys, os, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *
Hw = {int(k): np.array(v) for k, v in json.load(open(f'{S}/rd/data/s09_Hwin.json'))['Hwin'].items()}
Hc = {int(k): np.array(v) for k, v in json.load(open(f'{S}/rd/data/s09_H.json'))['H'].items()}
def G(f): return cv2.cvtColor(cv2.imread(f'{S}/png/f{f:04d}.png'), cv2.COLOR_BGR2GRAY).astype(np.float32)
SX = [0, 1, 2, 3, 4, 6, 8, 11]; SY = [0, 1, 2, 3, 4, 6, 8, 11, 15, 20, 26]
def fit(fa, fb, H_a, H_b, rect):
    """blur that turns sharp frame fb into frame fa inside canonical rect"""
    A = G(fa); B = G(fb)
    M = H_a @ np.linalg.inv(H_b)
    Bw = cv2.warpPerspective(B, M, (1920, 1080), flags=cv2.INTER_CUBIC)
    x0, y0, x1, y1 = rect
    q = cv2.perspectiveTransform(np.float32([[[x0, y0]], [[x1, y0]], [[x1, y1]], [[x0, y1]]]), H_a).reshape(-1, 2)
    m = np.zeros(A.shape, np.uint8); cv2.fillPoly(m, [np.round(q).astype(np.int32)], 1)
    v = cv2.warpPerspective(np.ones_like(B), M, (1920, 1080)) > 0.99
    m = (m > 0) & v
    m = cv2.erode(m.astype(np.uint8), np.ones((25, 25), np.uint8)) > 0
    if m.sum() < 3000: return None
    best = None
    for sx in SX:
        for sy in SY:
            Bb = cv2.GaussianBlur(Bw, (0, 0), sigmaX=max(sx, 0.01), sigmaY=max(sy, 0.01)) if (sx or sy) else Bw
            d = (Bb - A)[m]; d = d - d.mean()
            e = float((d * d).mean())
            if best is None or e < best[0]: best = (e, sx, sy)
    return best
res = {}
for f in range(898, 973):
    side_ref = 925 if f < 945 else 966
    cont_ref = 935 if f < 950 else 966
    s = fit(f, side_ref, Hw[f], Hw[side_ref], (462, 240, 540, 850)) if f != side_ref else (0, 0, 0)
    # content: older lines that exist in both frames (canonical rows of the first paragraphs)
    c = fit(f, cont_ref, Hc[f], Hc[cont_ref], (556, 330, 1020, 560)) if f != cont_ref else (0, 0, 0)
    res[f] = {'side': s and [s[1], s[2]], 'cont': c and [c[1], c[2]]}
    print(f, 'side', s and s[1:], 'content', c and c[1:])
json.dump(res, open(f'{S}/rd/data/s09_blurfit.json', 'w'))
