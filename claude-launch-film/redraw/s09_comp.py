"""S09 compositor: warp the flat window-UI layer (canonical x3, RGBA) into each frame with the
tracked window homography, averaging sub-frame homographies over a half-frame shutter (motion
blur like the reference), blur the scrolling chat content along its scroll speed, and lay it
over the cleaned plate. -> rd/out/S09_anatomy_reply/fNNNN.png"""
import sys, os, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *
a, b = int(sys.argv[1]), int(sys.argv[2])
Hw = {int(k): np.array(v) for k, v in json.load(open(f'{S}/rd/data/s09_Hwin.json'))['Hwin'].items()}
SC = {int(k): v for k, v in json.load(open(f'{S}/rd/data/s09_scroll.json')).items()}
SCK = json.load(open(f'{S}/rd/work/s09_flat/meta.json'))['SC_K']
K, OX, OY = 3.0, 440, 195
Sm = np.array([[K, 0, -K * OX], [0, K, -K * OY], [0, 0, 1.0]]); Si = np.linalg.inv(Sm)
CLIP = (549, 214, 1031, 740)          # chat content clip rect (canonical)
od = f'{S}/rd/out/S09_anatomy_reply'; os.makedirs(od, exist_ok=True)
def seg(f): return 0 if f <= 897 else 1
def Hat(t, f):
    f0 = int(np.floor(t)); f1 = f0 + 1
    if f0 not in Hw or seg(f0) != seg(f): return Hw[f]
    if f1 not in Hw or seg(f1) != seg(f): return Hw[f0]
    w = t - f0; A = Hw[f0] / Hw[f0][2, 2]; B = Hw[f1] / Hw[f1][2, 2]
    return (1 - w) * A + w * B
def scroll_at(t):
    ks = sorted(SC); t = min(max(t, 898), ks[-1])
    if t < ks[0]: return 0.0
    f0 = int(np.floor(t)); f1 = min(f0 + 1, ks[-1]); w = t - f0
    return ((1 - w) * SC.get(f0, 0.0) + w * SC.get(f1, 0.0)) * SCK
for f in range(a, b + 1):
    plate = cv2.imread(f'{od}/../../plates/S09_anatomy_reply/bg_{f:04d}.jpg').astype(np.float32)
    fl = cv2.imread(f'{S}/rd/work/s09_flat/f{f:04d}.png', cv2.IMREAD_UNCHANGED).astype(np.float32)
    al = fl[..., 3:4] / 255.0; pm = np.concatenate([fl[..., :3] * al, al * 255], 2)   # premultiplied
    # pre-shrink the layer close to its on-screen scale (avoids aliasing in the warp)
    G = Hw[f] @ Si
    c = np.array([1035 * K / 2, 695 * K / 2, 1.0]); J = np.zeros((2, 2))
    for i, d in enumerate(([1, 0], [0, 1])):
        p0 = G @ c; p1 = G @ (c + np.array([d[0], d[1], 0]))
        J[:, i] = p1[:2] / p1[2] - p0[:2] / p0[2]
    sc = np.sqrt(abs(np.linalg.det(J)))
    pre = 1.0
    if sc < 0.75:
        pre = min(1.0, sc * 1.5)
        pm = cv2.resize(pm, None, fx=pre, fy=pre, interpolation=cv2.INTER_AREA)
    P = np.diag([1 / pre, 1 / pre, 1.0])
    acc = np.zeros((1080, 1920, 4), np.float32); N = 1
    cx0, cy0, cx1, cy1 = [int(K * pre * v) for v in (CLIP[0] - OX, CLIP[1] - OY, CLIP[2] - OX, CLIP[3] - OY)]
    base = pm[cy0:cy1, cx0:cx1].copy()
    for t in [float(f)]:   # the reference UI animation has no motion blur
        # the chat content moves with the window AND with its own scroll during the shutter
        dy = int(round((scroll_at(t) - scroll_at(f)) * K * pre)) if seg(f) else 0
        if dy:
            sh = np.zeros_like(base)
            if dy > 0: sh[dy:] = base[:-dy]
            else: sh[:dy] = base[-dy:]
            pm[cy0:cy1, cx0:cx1] = sh
        else: pm[cy0:cy1, cx0:cx1] = base
        M = Hat(t, f) @ Si @ P
        acc += cv2.warpPerspective(pm, M, (1920, 1080), flags=cv2.INTER_LINEAR, borderValue=(0, 0, 0, 0))
    acc /= N
    # defocus of the quick push-in after the cut (measured visually on the reference)
    sg = {897: 2.5, 898: 5.0, 899: 4.0, 900: 3.0, 901: 2.0, 902: 1.2, 903: 0.6}.get(f, 0)
    if sg: acc = cv2.GaussianBlur(acc, (0, 0), sg)
    A = acc[..., 3:4] / 255.0
    out = plate * (1 - A) + acc[..., :3]
    cv2.imwrite(f'{od}/f{f:04d}.png', np.clip(out + 0.5, 0, 255).astype(np.uint8))
print('composited', a, b)
