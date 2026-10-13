"""Refine the S07 window homographies with masked ECC against the canonical frame (665): only the
window frame, sidebar, zoom buttons and Done button take part (the rotating model is excluded).
Reports the Done-button misalignment before/after (black pill centre vs projected canonical centre)."""
import sys, os, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *
J = json.load(open(f'{S}/rd/data/s07_Hwin.json')); Hw = {int(k): np.array(v) for k, v in J['Hwin'].items()}
def gray(f): return cv2.cvtColor(cv2.imread(f'{S}/png/f{f:04d}.png'), cv2.COLOR_BGR2GRAY).astype(np.float32)
cm = np.zeros((1080, 1920), np.uint8)
cm[80:1000, 280:410] = 1; cm[170:400, 1490:1650] = 1; cm[860:1000, 1380:1650] = 1; cm[70:110, 280:1650] = 1; cm[975:1005, 280:1650] = 1
T = gray(665)
def done_err(f, H):
    im = cv2.imread(f'{S}/png/f{f:04d}.png').astype(np.float32).mean(2)
    q = cv2.perspectiveTransform(np.float32([[[1503, 918]]]), H)[0, 0]
    x, y = int(q[0]), int(q[1]); r = im[max(0, y - 80):y + 80, max(0, x - 160):x + 160]
    ys, xs = np.nonzero(r < 22)
    if len(xs) < 50: return None
    return (xs.mean() + max(0, x - 160) - q[0], ys.mean() + max(0, y - 80) - q[1])
out = {}
for f in sorted(Hw):
    if f >= 718: out[f] = Hw[f]; continue
    I = gray(f); H0 = Hw[f].astype(np.float32)
    # bring the input into canonical space with the current estimate, then solve the residual warp
    Wi = cv2.warpPerspective(I, np.linalg.inv(Hw[f]), (1920, 1080), flags=cv2.INTER_LINEAR)
    vm = cv2.warpPerspective(np.ones_like(I), np.linalg.inv(Hw[f]), (1920, 1080)) > 0.99
    msk = ((cm > 0) & vm).astype(np.uint8)
    R = np.eye(3, dtype=np.float32)
    try:
        _, R = cv2.findTransformECC(T, Wi, R, cv2.MOTION_HOMOGRAPHY,
                                    (cv2.TERM_CRITERIA_EPS | cv2.TERM_CRITERIA_COUNT, 200, 1e-6), msk, 5)
        Hn = Hw[f] @ R.astype(np.float64)
    except cv2.error:
        Hn = Hw[f]
    out[f] = Hn / Hn[2, 2]
    if f % 6 == 0 or f < 612:
        print(f, 'before', done_err(f, Hw[f]), 'after', done_err(f, out[f]))
json.dump({'Hwin': {f: out[f].tolist() for f in out}, 'inliers': J['inliers']}, open(f'{S}/rd/data/s07_Hwin_ecc.json', 'w'))
