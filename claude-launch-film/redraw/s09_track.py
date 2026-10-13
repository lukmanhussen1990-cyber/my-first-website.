"""Track the S09 anatomy-chat window: homography from canonical window coordinates (frame 880,
full-res pixels) to every frame 863-972. Segment A (863-897) matches each frame to 880 directly;
segment B (898-972) chains frame-to-frame SIFT homographies anchored to 920, and 920 is linked to
880 by direct matching. Output rd/data/s09_H.json {f: 3x3 (canonical -> frame)}."""
import sys, os, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *
sift = cv2.SIFT_create(6000, contrastThreshold=0.02)
def gray(f): return cv2.cvtColor(cv2.imread(f'{S}/png/f{f:04d}.png'), cv2.COLOR_BGR2GRAY)
cache = {}
def feats(f):
    if f not in cache:
        g = gray(f); cl = cv2.createCLAHE(2.0, (8, 8)).apply(g)
        cache[f] = sift.detectAndCompute(cl, None)
    return cache[f]
def match(a, b, thr=3.0):
    """homography mapping frame a pixels -> frame b pixels"""
    ka, da = feats(a); kb, db = feats(b)
    m = cv2.BFMatcher().knnMatch(da, db, k=2)
    good = [x for x, y in (p for p in m if len(p) == 2) if x.distance < 0.78 * y.distance]
    if len(good) < 12: return None, 0
    pa = np.float32([ka[x.queryIdx].pt for x in good]); pb = np.float32([kb[x.trainIdx].pt for x in good])
    H, inl = cv2.findHomography(pa, pb, cv2.USAC_MAGSAC, thr, maxIters=20000, confidence=0.999)
    return H, int(inl.sum()) if inl is not None else 0
out, info = {}, {}
CAN = 880
for f in range(863, 898):
    H, n = (np.eye(3), 9999) if f == CAN else match(CAN, f)
    out[f] = H; info[f] = n
H880_920, n = match(CAN, 920); print('880->920 inliers', n)
out[920] = H880_920; info[920] = n
for f in range(921, 973):
    H, n = match(f - 1, f); out[f] = H @ out[f - 1]; info[f] = n
for f in range(919, 897, -1):
    H, n = match(f + 1, f); out[f] = H @ out[f + 1]; info[f] = n
for f in sorted(out): out[f] = (out[f] / out[f][2, 2]).tolist()
json.dump({'H': out, 'inliers': info}, open(f'{S}/rd/data/s09_H.json', 'w'))
print({f: info[f] for f in sorted(info)})
