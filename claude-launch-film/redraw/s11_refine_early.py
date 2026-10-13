"""S11 early frames (1093-1106): masked ECC on static content only (title, photo, About block, chips,
Education heading), template pre-blurred to the frame's softness. Starts from the SIFT estimate."""
import sys, os, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *
J = json.load(open(f'{S}/rd/data/s11_track.json')); HS = {int(k): np.array(v) for k, v in J['Hcon'].items()}
def gray(f): return cv2.cvtColor(cv2.imread(f'{S}/png/f{f:04d}.png'), cv2.COLOR_BGR2GRAY).astype(np.float32)
T0 = gray(1110)
cm = np.zeros((1080, 1920), np.uint8)
for x0, y0, x1, y1 in ((705, 328, 902, 362), (722, 392, 868, 606), (705, 640, 1365, 722), (705, 741, 850, 770), (705, 788, 960, 814)):
    cm[y0:y1, x0:x1] = 1
out = {}
for f in range(1106, 1092, -1):
    I = gray(f); Hi = out.get(f + 1, HS[f]) @ np.linalg.inv(HS[f + 1]) @ HS[f] if f + 1 in out else HS[f]
    Wi = cv2.warpPerspective(I, np.linalg.inv(Hi), (1920, 1080), flags=cv2.INTER_LINEAR)
    vm = cv2.warpPerspective(np.ones_like(I), np.linalg.inv(Hi), (1920, 1080)) > 0.99
    msk = ((cm > 0) & vm).astype(np.uint8)
    best = None
    for sg in ((0, 0.8) if f >= 1100 else (0.8, 1.6, 2.6)):
        T = cv2.GaussianBlur(T0, (0, 0), sg) if sg else T0
        try:
            c, R = cv2.findTransformECC(T, Wi, np.eye(3, dtype=np.float32), cv2.MOTION_HOMOGRAPHY,
                                        (cv2.TERM_CRITERIA_EPS | cv2.TERM_CRITERIA_COUNT, 200, 1e-6), msk, 5)
        except cv2.error:
            continue
        if best is None or c > best[0]: best = (c, R, sg)
    c, R, sg = best
    Hn = Hi @ R.astype(np.float64); out[f] = Hn / Hn[2, 2]
    d = cv2.perspectiveTransform(np.float32([[[790, 500]], [[780, 690]], [[1200, 690]]]), out[f]).reshape(-1, 2) - \
        cv2.perspectiveTransform(np.float32([[[790, 500]], [[780, 690]], [[1200, 690]]]), HS[f]).reshape(-1, 2)
    json.dump({k: v.tolist() for k, v in out.items()}, open(f'{S}/rd/data/s11_Hcon_early.json', 'w'))
    print(f, 'cc %.3f sg %.1f' % (c, sg), 'shift vs sift (photo, about-left, about-right)', np.round(d, 1).tolist(), flush=True)
json.dump({f: out[f].tolist() for f in out}, open(f'{S}/rd/data/s11_Hcon_early.json', 'w'))
