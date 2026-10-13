"""S11: put Dr. Imran Hussain onto the profile-page footage (frames 1093-1128).
Per frame: content homography (SIFT <=1106, ECC after), blur fit (Gaussian sigma + vertical smear L) on static
content, per-element gain (and slide offset while elements animate in), then either
  sharp frames:  harmonic-fill each old element from its surroundings, add the new element layer
  smeared frames: add the blurred difference (new - old) layer
everything clipped below the window's top edge. Writes rd/plates/S11_profile_outcome/bgi_NNNN.jpg."""
import sys, os, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *
Z = np.load(f'{S}/rd/data/s11_edit.npz')
O, E, F = Z['O'], Z['E'], Z['F']; X0, Y0, X1, Y1, K = [int(v) for v in Z['roi']]; RECTS = json.loads(str(Z['rects']))
HS = {int(k): np.array(v) for k, v in json.load(open(f'{S}/rd/data/s11_track.json'))['Hcon'].items()}
HE = {int(k): np.array(v) for k, v in json.load(open(f'{S}/rd/data/s11_Hcon_ecc.json'))['Hcon'].items()}
def Hc(f):
    try: HEA = {int(k): np.array(v) for k, v in json.load(open(f'{S}/rd/data/s11_Hcon_early.json')).items()}
    except Exception: HEA = {}
    if f in HEA: return HEA[f]
    if HEA and f < min(HEA):                               # washed-out mist frames: carry the first solve back with SIFT motion
        f0 = min(HEA); return HEA[f0] @ np.linalg.inv(HS[f0]) @ HS[f]
    return HS[f] if f <= 1106 else HE[f]
CLIP = {1116: 260, 1117: 262, 1118: 264, 1119: 267, 1120: 270, 1121: 274, 1122: 279, 1123: 284, 1124: 291,
        1125: 300, 1126: 310, 1127: 321, 1128: 335}
def clip_y(f): return CLIP.get(f, 258)
Hh, Ww = O.shape[:2]
def rmask(r, grow=0):
    m = np.zeros((Hh, Ww), np.float32); x0, y0, x1, y1 = r
    m[int((y0 - grow - Y0) * K):int((y1 + grow - Y0) * K), int((x0 - grow - X0) * K):int((x1 + grow - X0) * K)] = 1; return m
LO = {k: (O - F) * rmask(r)[..., None] for k, r in RECTS.items()}
LE = {k: (E - F) * rmask(r)[..., None] for k, r in RECTS.items()}
def inkmask(k):
    m = ((np.abs(LO[k]).sum(2) + np.abs(LE[k]).sum(2)) > 4).astype(np.uint8)
    return cv2.dilate(m, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * K + 1, 2 * K + 1))).astype(np.float32)
MR = {k: inkmask(k) for k in RECTS}
# static content used for the blur fit (title, About heading + line 2 start, fee, photo)
FIT = np.zeros((Hh, Ww), np.float32)
for x0, y0, x1, y1 in ((707, 330, 900, 360), (707, 642, 790, 666), (726, 396, 864, 602), (1000, 674, 1362, 691)):
    FIT[(y0 - Y0) * K:(y1 - Y0) * K, (x0 - X0) * K:(x1 - X0) * K] = 1
OG = O.mean(2)
def setup(f):
    M = Hc(f) @ np.array([[1 / K, 0, X0], [0, 1 / K, Y0], [0, 0, 1.]])
    c = cv2.perspectiveTransform(np.float32([[0, 0], [Ww, 0], [Ww, Hh], [0, Hh]]).reshape(-1, 1, 2), M).reshape(-1, 2)
    bx0, by0 = np.maximum(np.floor(c.min(0)) - 40, 0).astype(int); bx1, by1 = np.minimum(np.ceil(c.max(0)) + 40, [1920, 1080]).astype(int)
    Mb = np.array([[1, 0, -bx0], [0, 1, -by0], [0, 0, 1.]]) @ M
    J = np.linalg.det(Mb[:2, :2] / (Mb[2] @ [Ww / 2, Hh / 2, 1]))
    scale = np.sqrt(abs(J))                                 # frame px per ROI px
    return Mb, (bx0, by0, bx1, by1), scale
def warp(X, Mb, box, scale):
    pre = 0.42 / scale if scale < 1 else 0
    if pre > 0.3: X = cv2.GaussianBlur(X, (0, 0), pre)
    return cv2.warpPerspective(X, Mb, (box[2] - box[0], box[3] - box[1]), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_CONSTANT)
def blur(X, sg, L):
    if sg > 0.2: X = cv2.GaussianBlur(X, (0, 0), sg)
    if L >= 2:
        k = np.ones((int(L), 1), np.float32) / int(L); X = cv2.filter2D(X, -1, k, borderType=cv2.BORDER_REPLICATE)
    return X
def hp(X): return X - cv2.GaussianBlur(X, (0, 0), 5)
def shiftY(X, dy):
    if dy == 0: return X
    return cv2.warpAffine(X, np.float32([[1, 0, 0], [0, 1, dy * K]]), (Ww, Hh), flags=cv2.INTER_LINEAR)
ALLOW = {'crumb': 14, 'name': 7, 'mail': 10, 'about': 3, 'photo': 40}
ECC = json.load(open(f'{S}/rd/data/s11_Hcon_ecc.json'))['L']
log = {}
def do(f):
    base = cv2.imread(f'{S}/rd/plates/S11_profile_outcome/bg_{f:04d}.jpg').astype(np.float32)
    Mb, box, scale = setup(f); bx0, by0, bx1, by1 = box
    B = base[by0:by1, bx0:bx1].copy(); bg = hp(B.mean(2))
    wO = warp(OG, Mb, box, scale); wfit = warp(FIT, Mb, box, scale) > 0.5
    vis = (np.arange(by0, by1)[:, None] > clip_y(f)).astype(np.float32) * np.ones((1, bx1 - bx0), np.float32)
    vis = cv2.GaussianBlur(vis, (0, 0), 0.6)
    wfit &= vis > 0.99
    # blur fit
    Le = float(ECC.get(str(f), 0))
    Ls = sorted({0, *range(max(2, int(Le) - 8), int(Le) + 9, 2)}) if f > 1110 else [0]
    best = None
    for sg in (0.0, 0.4, 0.7, 1.0, 1.4, 1.9, 2.5, 3.3):
        for L in Ls:
            t = hp(blur(wO, sg, L))[wfit]; b = bg[wfit]
            c = float((t * b).sum() / (np.sqrt((t * t).sum() * (b * b).sum()) + 1e-6))
            if best is None or c > best[0]: best = (c, sg, L)
    cc, sg, L = best
    rec = {'cc': round(cc, 3), 'sg': sg, 'L': L, 'scale': round(float(scale) * K, 3)}
    sharp = L <= 6
    adds = np.zeros_like(B)
    def fshift(X, dx, dy):
        if dx == 0 and dy == 0: return X
        return cv2.warpAffine(X, np.float32([[1, 0, dx], [0, 1, dy]]), (X.shape[1], X.shape[0]), flags=cv2.INTER_LINEAR)
    fits = {}
    for k in RECTS:
        wm = warp(MR[k], Mb, box, scale) > 0.5
        wm &= vis > 0.99
        if wm.sum() < 30: continue
        t = hp(blur(warp(LO[k].mean(2), Mb, box, scale), sg, L))
        R = 30 if (f <= 1106 and k in ('crumb', 'name', 'mail')) else 0
        dx = dy = 0.0
        if R:
            ys, xs = np.nonzero(wm); y0, y1, x0, x1 = ys.min() - 3, ys.max() + 4, xs.min() - 3, xs.max() + 4
            tpl = t[y0:y1, x0:x1].astype(np.float32)
            sy0, sx0 = max(0, y0 - 3), max(0, x0 - 4)
            srch = bg[sy0:min(bg.shape[0], y1 + R), sx0:min(bg.shape[1], x1 + 4)].astype(np.float32)
            if srch.shape[0] > tpl.shape[0] and srch.shape[1] > tpl.shape[1] and tpl.std() > 0.5:
                mm = cv2.matchTemplate(srch, tpl, cv2.TM_CCOEFF_NORMED); _, v, _, loc = cv2.minMaxLoc(mm)
                if v > (0.15 if k == 'mail' else 0.3):
                    px, py = loc
                    # sub-pixel by parabola
                    def sub(a, b, c): d = a - 2 * b + c; return 0.0 if abs(d) < 1e-6 else 0.5 * (a - c) / d
                    ox = sub(mm[py, px - 1], mm[py, px], mm[py, px + 1]) if 0 < px < mm.shape[1] - 1 else 0
                    oy = sub(mm[py - 1, px], mm[py, px], mm[py + 1, px]) if 0 < py < mm.shape[0] - 1 else 0
                    dx = sx0 + px + ox - x0; dy = sy0 + py + oy - y0
        ts = fshift(t, dx, dy); m = cv2.dilate(fshift(wm.astype(np.float32), dx, dy), np.ones((5, 5), np.uint8)) > 0.5
        num = float((ts[m] * bg[m]).sum()); den = float((ts[m] ** 2).sum()) + 1e-6
        fits[k] = [float(np.clip(num / den, 0, 1.12)), dx, dy, wm]
    if f >= 1107:
        gs = [fits[k][0] for k in ('photo', 'name', 'mail') if k in fits]
        gcom = float(np.clip(np.median(gs), 0.9, 1.1)) if gs else 1.0
        for k in fits: fits[k][0] = gcom
    for k, (a, dx, dy, wm) in fits.items():
        if a < 0.05: continue                              # not on screen yet: leave the footage alone
        rec[k] = (round(a, 3), round(dx, 1), round(dy, 1))
        newL = fshift(blur(warp(LE[k], Mb, box, scale), sg, L), dx, dy)
        gx = int(np.ceil(1.5 + 2 * sg)); gy = int(np.ceil(1.5 + 2 * sg + L / 2))
        if gy <= ALLOW[k] or sharp:
            ker = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * gx + 1, 2 * gy + 1))
            fm = cv2.dilate(fshift(wm.astype(np.float32), dx, dy), ker) > 0.5
            fm &= vis > 0.5
            if fm.any(): B = harmonic_fill(B, fm)
            adds += a * newL
        else:
            oldL = fshift(blur(warp(LO[k], Mb, box, scale), sg, L), dx, dy)
            adds += a * (newL - oldL)
    B = B + adds * vis[..., None]
    base[by0:by1, bx0:bx1] = B
    cv2.imwrite(f'{S}/rd/plates/S11_profile_outcome/bgi_{f:04d}.jpg', np.clip(base + 0.5, 0, 255).astype(np.uint8), [cv2.IMWRITE_JPEG_QUALITY, 97])
    print(f, rec, flush=True); log[f] = rec
fr = [int(x) for x in sys.argv[1].split(',')] if len(sys.argv) > 1 else range(1093, 1129)
for f in fr: do(f)
p = f'{S}/rd/data/s11_comp_log.json'
old = json.load(open(p)) if os.path.exists(p) else {}
old.update({str(k): v for k, v in log.items()}); json.dump(old, open(p, 'w'), default=float)
