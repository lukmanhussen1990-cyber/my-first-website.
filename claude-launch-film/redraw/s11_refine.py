"""S11: refine the content homographies (canonical = frame 1110) with masked ECC.
The template is the canonical content blurred to match each frame (vertical box for the scroll smear).
Frames are processed outward from 1110; each starts from its neighbour's refined result plus velocity."""
import sys, os, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *
J = json.load(open(f'{S}/rd/data/s11_track.json'))
Hc = {int(k): np.array(v) for k, v in J['Hcon'].items()}
def gray(f): return cv2.cvtColor(cv2.imread(f'{S}/png/f{f:04d}.png'), cv2.COLOR_BGR2GRAY).astype(np.float32)
T0 = gray(1110)
cm = np.zeros((1080, 1920), np.uint8); cm[278:815, 700:1395] = 1   # content column at 1110
def vbox(img, L):
    if L < 1.5: return img
    k = np.ones((int(round(L)) | 1, 1), np.float32); k /= k.sum()
    return cv2.filter2D(img, -1, k, borderType=cv2.BORDER_REPLICATE)
def ecc(f, Hinit, L):
    I = gray(f)
    Wi = cv2.warpPerspective(I, np.linalg.inv(Hinit), (1920, 1080), flags=cv2.INTER_LINEAR)
    vm = cv2.warpPerspective(np.ones_like(I), np.linalg.inv(Hinit), (1920, 1080)) > 0.99
    msk = ((cm > 0) & vm).astype(np.uint8)
    T = vbox(T0, L)
    R = np.eye(3, dtype=np.float32)
    try:
        cc, R = cv2.findTransformECC(T, Wi, R, cv2.MOTION_HOMOGRAPHY,
                                     (cv2.TERM_CRITERIA_EPS | cv2.TERM_CRITERIA_COUNT, 300, 1e-7), msk, 5)
    except cv2.error:
        return Hinit, -1
    Hn = Hinit @ R.astype(np.float64); return Hn / Hn[2, 2], cc
def pt(H, p=(1000, 500)):
    return cv2.perspectiveTransform(np.float32([[p]]), H)[0, 0]
out = {1110: np.eye(3)}; cc = {1110: 1.0}; blurL = {1110: 0}
for rng, step in ((range(1111, 1131), -1), (range(1109, 1092, -1), 1)):
    for f in rng:
        p = f + step; q = p + step
        Hi = Hc[f] if (f <= 1123 and f >= 1093) else out[p] @ np.linalg.inv(out[q]) @ out[p] if q in out else out[p]
        # vertical speed in frame px (content point displacement) sets the smear length
        v = abs(pt(Hi)[1] - pt(out[p])[1]) if f > 1110 else 0
        best = None
        for L in sorted({0, round(v * 0.5), round(v * 0.8), round(v * 1.1)}):
            H, c = ecc(f, Hi, L)
            if best is None or c > best[1]: best = (H, c, L)
        out[f], cc[f], blurL[f] = best
        d = pt(out[f]) - pt(Hc[f])
        print(f, 'cc %.3f' % cc[f], 'L', blurL[f], 'shift vs sift', np.round(d, 1), flush=True)
json.dump({'Hcon': {f: out[f].tolist() for f in out}, 'cc': cc, 'L': blurL}, open(f'{S}/rd/data/s11_Hcon_ecc.json', 'w'))
