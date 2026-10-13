"""Fast planar tracking of a UI window (key frame -> each frame homography).
ECC on a cropped key-frame template (cost ~ template size), initialised from a
constant-velocity prediction; SIFT+RANSAC at half resolution as a fallback / sanity check."""
import sys, json
sys.path.insert(0, '/tmp/claude-0/-home-user-my-first-website-/4f2370d4-b0d4-589b-a9a6-5a27c4fb85e7/scratchpad/tools')
from common import *

sift = cv2.SIFT_create(nfeatures=3000, contrastThreshold=0.02)

def g32(i):
    return load(i).mean(2).astype(np.float32)

def Tr(x, y):
    return np.array([[1, 0, x], [0, 1, y], [0, 0, 1]], np.float64)

def ecc_crop(tmpl_full, rect, img, H0, blurs=(0, 1.5, 3.5)):
    x0, y0, x1, y1 = rect
    best = (H0, -1.0, 0)
    for b in blurs:
        t = tmpl_full[y0:y1, x0:x1]
        if b > 0: t = cv2.GaussianBlur(t, (0, 0), b)
        Hc = (H0 @ Tr(x0, y0)).astype(np.float32)
        try:
            cc, Hc = cv2.findTransformECC(t, img, Hc, cv2.MOTION_HOMOGRAPHY,
                                          (cv2.TERM_CRITERIA_EPS | cv2.TERM_CRITERIA_COUNT, 150, 1e-7), None, 3)
            H = Hc.astype(np.float64) @ Tr(-x0, -y0)
            if cc > best[1]: best = (H, float(cc), b)
        except cv2.error:
            pass
    return best

def sift_half(kpK, desK, img):
    small = cv2.resize(np.clip(img, 0, 255).astype(np.uint8), None, fx=0.5, fy=0.5, interpolation=cv2.INTER_AREA)
    kp, des = sift.detectAndCompute(small, None)
    if des is None or len(kp) < 10: return None, 0
    m = cv2.BFMatcher(cv2.NORM_L2).knnMatch(desK, des, k=2)
    good = [a for a, b in (p for p in m if len(p) == 2) if a.distance < 0.78 * b.distance]
    if len(good) < 10: return None, len(good)
    src = np.float32([kpK[g.queryIdx].pt for g in good]) * 2; dst = np.float32([kp[g.trainIdx].pt for g in good]) * 2
    H, inl = cv2.findHomography(src, dst, cv2.RANSAC, 3.0, maxIters=5000, confidence=0.999)
    n = int(inl.sum()) if inl is not None else 0
    return (H if n >= 12 else None), n

def run(K, panel_rect, rect, frames, out):
    gK = g32(K)
    pm = np.zeros(gK.shape, np.uint8); x0, y0, x1, y1 = panel_rect; pm[y0:y1, x0:x1] = 255
    smallK = cv2.resize(np.clip(gK, 0, 255).astype(np.uint8), None, fx=0.5, fy=0.5, interpolation=cv2.INTER_AREA)
    kpK, desK = sift.detectAndCompute(smallK, cv2.resize(pm, None, fx=0.5, fy=0.5, interpolation=cv2.INTER_NEAREST))
    hist = {K: np.eye(3)}; res = {}
    ctr = np.array([(rect[0] + rect[2]) / 2, (rect[1] + rect[3]) / 2, 1.0])
    for seq in (sorted(f for f in frames if f >= K), sorted((f for f in frames if f < K), reverse=True)):
        prev = K
        for i in seq:
            img = g32(i)
            if i == K:
                res[i] = dict(H=np.eye(3).tolist(), cc=1.0, src='key'); prev = K; continue
            Hn = hist[prev]
            # constant velocity prediction using the two previous frames on this side
            pp = [f for f in hist if (f - K) * (i - K) >= 0 and abs(f - K) < abs(i - K)]
            pp.sort(key=lambda f: abs(f - K))
            Hpred = hist[pp[-1]] @ np.linalg.inv(hist[pp[-2]]) @ hist[pp[-1]] if len(pp) >= 2 else Hn
            H, cc, b = ecc_crop(gK, rect, img, Hpred)
            src = 'pred'
            if cc < 0.97:
                H2, cc2, b2 = ecc_crop(gK, rect, img, Hn)
                if cc2 > cc: H, cc, b, src = H2, cc2, b2, 'prev'
            if cc < 0.95:
                Hs, n = sift_half(kpK, desK, img)
                if Hs is not None:
                    H3, cc3, b3 = ecc_crop(gK, rect, img, Hs)
                    if cc3 > cc: H, cc, b, src = H3, cc3, b3, f'sift{n}'
            hist[i] = H; prev = i
            res[i] = dict(H=H.tolist(), cc=cc, tmpl_blur=b, src=src)
            c = H @ ctr; c = c[:2] / c[2]
            print(i, 'cc', round(cc, 4), 'src', src, 'blur', b, 'ctr', np.round(c, 1).tolist(), flush=True)
    json.dump({str(k): v for k, v in sorted(res.items())}, open(out, 'w'), indent=1)
    print('DONE', out, flush=True)

if __name__ == '__main__':
    K = int(sys.argv[1]); pr = [int(v) for v in sys.argv[2].split(',')]; r = [int(v) for v in sys.argv[3].split(',')]
    run(K, pr, r, list(range(int(sys.argv[4]), int(sys.argv[5]) + 1)), sys.argv[6])
