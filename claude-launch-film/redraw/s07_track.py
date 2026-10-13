"""S07: track the anatomy-viewer window (canonical = frame 665 pixels) with SIFT features from the
sidebar strip, the zoom buttons, the Done button and the window border (the rotating model is
excluded), chained frame to frame from 665. Output rd/data/s07_Hwin.json."""
import sys, os, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *
sift = cv2.SIFT_create(6000, contrastThreshold=0.015)
def gray(f): return cv2.createCLAHE(2.0, (8, 8)).apply(cv2.cvtColor(cv2.imread(f'{S}/png/f{f:04d}.png'), cv2.COLOR_BGR2GRAY))
cm = np.zeros((1080, 1920), np.uint8)
cm[80:1000, 280:410] = 255      # sidebar strip + left border
cm[170:400, 1490:1650] = 255    # zoom buttons + right border
cm[860:1000, 1380:1650] = 255   # Done + bottom-right
cm[70:110, 280:1650] = 255      # top border
cm[975:1005, 280:1650] = 255    # bottom border
def fmask(H, grow=9):
    return cv2.dilate(cv2.warpPerspective(cm, H, (1920, 1080), flags=cv2.INTER_NEAREST), np.ones((grow, grow), np.uint8))
def match(ga, ma, gb, mb, thr=2.5):
    ka, da = sift.detectAndCompute(ga, ma); kb, db = sift.detectAndCompute(gb, mb)
    if da is None or db is None or len(ka) < 8 or len(kb) < 8: return None, 0
    m = cv2.BFMatcher().knnMatch(da, db, k=2)
    good = [x for x, y in (p for p in m if len(p) == 2) if x.distance < 0.8 * y.distance]
    if len(good) < 10: return None, 0
    pa = np.float32([ka[x.queryIdx].pt for x in good]); pb = np.float32([kb[x.trainIdx].pt for x in good])
    H, inl = cv2.findHomography(pa, pb, cv2.USAC_MAGSAC, thr, maxIters=20000, confidence=0.999)
    return H, int(inl.sum()) if inl is not None else 0
Hw = {665: np.eye(3)}; info = {665: 9999}
for rng, step in ((range(666, 719), -1), (range(664, 605, -1), 1)):
    for f in rng:
        p = f + step
        H, n = match(gray(p), fmask(Hw[p]), gray(f), fmask(Hw[p], 81))
        if H is None or n < 25:
            # fall back: extrapolate the previous motion
            q = p + step
            H = Hw[p] @ np.linalg.inv(Hw[q]) if q in Hw else np.eye(3)
            Hw[f] = H @ Hw[p]; info[f] = -n
        else:
            Hw[f] = H @ Hw[p]; info[f] = n
json.dump({'Hwin': {f: (Hw[f] / Hw[f][2, 2]).tolist() for f in Hw}, 'inliers': info}, open(f'{S}/rd/data/s07_Hwin.json', 'w'))
print({f: info[f] for f in sorted(info)})
