"""S11: track the profile window. Canonical = frame 1110 pixels.
Hwin: window frame (sidebar strip + border) by masked SIFT, chained from 1110 both ways.
Hcon: content (text column) by masked SIFT, chained the same way; scroll = Hwin^-1 Hcon."""
import sys, os, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *
sift = cv2.SIFT_create(8000, contrastThreshold=0.012)
def gray(f): return cv2.createCLAHE(2.0, (8, 8)).apply(cv2.cvtColor(cv2.imread(f'{S}/png/f{f:04d}.png'), cv2.COLOR_BGR2GRAY))
win = np.zeros((1080, 1920), np.uint8)
win[300:830, 455:668] = 255        # sidebar strip (logo, items, private mode, avatar, logout)
win[245:275, 455:1490] = 255       # top border
win[805:835, 455:1490] = 255       # bottom border
win[250:830, 1460:1495] = 255      # right border
con = np.zeros((1080, 1920), np.uint8); con[270:820, 690:1400] = 255
def fmask(m, H, grow):
    return cv2.dilate(cv2.warpPerspective(m, H, (1920, 1080), flags=cv2.INTER_NEAREST), np.ones((grow, grow), np.uint8))
def match(ga, ma, gb, mb, thr=2.5):
    ka, da = sift.detectAndCompute(ga, ma); kb, db = sift.detectAndCompute(gb, mb)
    if da is None or db is None or len(ka) < 8 or len(kb) < 8: return None, 0
    mm = cv2.BFMatcher().knnMatch(da, db, k=2)
    good = [x for x, y in (p for p in mm if len(p) == 2) if x.distance < 0.8 * y.distance]
    if len(good) < 10: return None, 0
    pa = np.float32([ka[x.queryIdx].pt for x in good]); pb = np.float32([kb[x.trainIdx].pt for x in good])
    H, inl = cv2.findHomography(pa, pb, cv2.USAC_MAGSAC, thr, maxIters=20000, confidence=0.999)
    return H, int(inl.sum()) if inl is not None else 0
def chain(mask, lo, hi, minin=20):
    Hs = {1110: np.eye(3)}; info = {1110: 9999}
    for rng, step in ((range(1111, hi + 1), -1), (range(1109, lo - 1, -1), 1)):
        for f in rng:
            p = f + step
            H, n = match(gray(p), fmask(mask, Hs[p], 9), gray(f), fmask(mask, Hs[p], 91))
            if H is None or n < minin:
                q = p + step
                H = Hs[p] @ np.linalg.inv(Hs[q]) if q in Hs else np.eye(3); n = -n
            Hs[f] = H @ Hs[p]; Hs[f] /= Hs[f][2, 2]; info[f] = n
    return Hs, info
Hw, iw = chain(win, 1092, 1167)
Hc, ic = chain(con, 1092, 1167)
scroll = {}
for f in sorted(Hw):
    D = np.linalg.inv(Hw[f]) @ Hc[f]; D /= D[2, 2]; scroll[f] = [float(D[0, 2]), float(D[1, 2])]
json.dump({'Hwin': {f: Hw[f].tolist() for f in Hw}, 'Hcon': {f: Hc[f].tolist() for f in Hc}, 'iw': iw, 'ic': ic, 'scroll': scroll}, open(f'{S}/rd/data/s11_track.json', 'w'))
for f in sorted(Hw):
    print(f, iw[f], ic[f], [round(v, 1) for v in scroll[f]])
