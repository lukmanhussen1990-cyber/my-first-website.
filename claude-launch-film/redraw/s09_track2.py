"""S09: track the window FRAME (sidebar, anatomy panel, composer, border) separately from the
scrolling chat content. Canonical coordinates = frame 880 pixels. H_win(f): canonical -> frame.
Content homography (from s09_track.py, text-dominated) gives the scroll offset:
H_win^-1 H_content ~ translate(0, -scroll)."""
import sys, os, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *
sift = cv2.SIFT_create(8000, contrastThreshold=0.015)
Hc = {int(k): np.array(v) for k, v in json.load(open(f'{S}/rd/data/s09_H.json'))['H'].items()}
def gray(f): return cv2.createCLAHE(2.0, (8, 8)).apply(cv2.cvtColor(cv2.imread(f'{S}/png/f{f:04d}.png'), cv2.COLOR_BGR2GRAY))
canon_mask = np.zeros((1080, 1920), np.uint8)
canon_mask[207:875, 452:552] = 255          # sidebar strip incl. left border
canon_mask[252:832, 1032:1442] = 255        # anatomy panel
canon_mask[745:828, 552:1032] = 255         # composer row + bottom border
canon_mask[200:222, 452:1462] = 255         # top border
canon_mask[860:882, 452:1462] = 255         # bottom border
def fmask(H):
    m = cv2.warpPerspective(canon_mask, H, (1920, 1080), flags=cv2.INTER_NEAREST)
    return cv2.dilate(m, np.ones((9, 9), np.uint8))
def match(ga, ma, gb, mb, thr=2.5):
    ka, da = sift.detectAndCompute(ga, ma); kb, db = sift.detectAndCompute(gb, mb)
    if da is None or db is None: return None, 0
    m = cv2.BFMatcher().knnMatch(da, db, k=2)
    good = [x for x, y in (p for p in m if len(p) == 2) if x.distance < 0.8 * y.distance]
    if len(good) < 10: return None, 0
    pa = np.float32([ka[x.queryIdx].pt for x in good]); pb = np.float32([kb[x.trainIdx].pt for x in good])
    H, inl = cv2.findHomography(pa, pb, cv2.USAC_MAGSAC, thr, maxIters=20000, confidence=0.999)
    return H, int(inl.sum()) if inl is not None else 0
Hw = {f: Hc[f] for f in range(863, 898)}
Hw[920] = Hc[920]
info = {}
for rng, step in ((range(921, 973), -1), (range(919, 897, -1), 1)):
    for f in rng:
        p = f + step
        gp, gf = gray(p), gray(f)
        mp = fmask(Hw[p]); mf = fmask(Hw[p])   # previous estimate as the search region
        mf = cv2.dilate(mf, np.ones((61, 61), np.uint8))
        H, n = match(gp, mp, gf, mf)
        if H is None: H = np.eye(3); n = 0
        Hw[f] = H @ Hw[p]; info[f] = n
scroll = {}
for f in sorted(Hw):
    D = np.linalg.inv(Hw[f]) @ Hc[f]; D /= D[2, 2]
    scroll[f] = [float(D[0, 2]), float(D[1, 2]), float(D[0, 0]), float(D[1, 1]), float(D[0, 1]), float(D[1, 0])]
json.dump({'Hwin': {f: (Hw[f] / Hw[f][2, 2]).tolist() for f in Hw}, 'D': scroll, 'inliers': info}, open(f'{S}/rd/data/s09_Hwin.json', 'w'))
for f in sorted(scroll):
    if f % 3 == 0 or f > 935: print(f, info.get(f), [round(v, 3) for v in scroll[f]])
