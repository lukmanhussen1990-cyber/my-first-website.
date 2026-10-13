"""S07 compositor: warp the flat window-UI layer (canonical x2, RGBA) into each frame with the
tracked window homography and lay it over the cleaned plate (no overlay on the transition frame)."""
import sys, os, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *
a, b = int(sys.argv[1]), int(sys.argv[2])
Hw = {int(k): np.array(v) for k, v in json.load(open(f'{S}/rd/data/s07_Hwin.json'))['Hwin'].items()}
K, OX, OY = 2.0, 260, 60
Si = np.linalg.inv(np.array([[K, 0, -K * OX], [0, K, -K * OY], [0, 0, 1.0]]))
od = f'{S}/rd/out/S07_anatomy_viewer'; os.makedirs(od, exist_ok=True)
BLUR = {606: 1.6, 607: 1.0, 608: 0.6, 714: 0.5, 715: 0.9, 716: 1.4, 717: 2.0}
for f in range(a, b + 1):
    plate = cv2.imread(f'{S}/rd/plates/S07_anatomy_viewer/bg_{f:04d}.jpg').astype(np.float32)
    if f >= 718:
        cv2.imwrite(f'{od}/f{f:04d}.png', np.clip(plate + 0.5, 0, 255).astype(np.uint8)); continue
    fl = cv2.imread(f'{S}/rd/work/s07_flat/f{f:04d}.png', cv2.IMREAD_UNCHANGED).astype(np.float32)
    al = fl[..., 3:4] / 255.0; pm = np.concatenate([fl[..., :3] * al, al * 255], 2)
    G = Hw[f] @ Si
    c = np.array([pm.shape[1] / 2, pm.shape[0] / 2, 1.0]); J = np.zeros((2, 2))
    for i, d in enumerate(([1, 0], [0, 1])):
        p0 = G @ c; p1 = G @ (c + np.array([d[0], d[1], 0])); J[:, i] = p1[:2] / p1[2] - p0[:2] / p0[2]
    sc = np.sqrt(abs(np.linalg.det(J))); pre = 1.0
    if sc < 0.75:
        pre = min(1.0, sc * 1.5); pm = cv2.resize(pm, None, fx=pre, fy=pre, interpolation=cv2.INTER_AREA)
    M = Hw[f] @ Si @ np.diag([1 / pre, 1 / pre, 1.0])
    acc = cv2.warpPerspective(pm, M, (1920, 1080), flags=cv2.INTER_LINEAR, borderValue=(0, 0, 0, 0))
    if f in BLUR: acc = cv2.GaussianBlur(acc, (0, 0), BLUR[f])
    A = acc[..., 3:4] / 255.0
    out = plate * (1 - A) + acc[..., :3]
    cv2.imwrite(f'{od}/f{f:04d}.png', np.clip(out + 0.5, 0, 255).astype(np.uint8))
print('composited', a, b)
