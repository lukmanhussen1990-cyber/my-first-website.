"""S04 plates: reference frames with the dashboard window content and the headline removed
(harmonic fill), keeping the reference's real background glow, window glass and window border.
Window: rounded rect in frame-384 space mapped by the per-frame homography (scenes/S04 win_H.json);
headline: its animated box (head_xform.json, rises included), outside the window."""
import sys, os, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *
from bgplate import fill_fast
a, b = int(sys.argv[1]), int(sys.argv[2])
SD = f'{S}/rd/scenes/S04_dashboard'
HW = json.load(open(f'{SD}/win_H.json')); HX = json.load(open(f'{SD}/head_xform.json'))
WIN = dict(x0=158.5, y0=452, x1=1761, y1=1349, r=56)
od = f'{S}/rd/plates/S04_dashboard'; os.makedirs(od, exist_ok=True)
def outline(H, grow):
    x0, y0, x1, y1, r = WIN['x0'] - grow, WIN['y0'] - grow, WIN['x1'] + grow, WIN['y1'] + grow, WIN['r'] + grow
    pts = []
    for cx, cy, a0 in ((x1 - r, y0 + r, -90), (x1 - r, y1 - r, 0), (x0 + r, y1 - r, 90), (x0 + r, y0 + r, 180)):
        for k in range(15):
            t = np.radians(a0 + 90 * k / 14); pts.append([cx + r * np.cos(t), cy + r * np.sin(t)])
    P = np.float32(pts).reshape(-1, 1, 2)
    return cv2.perspectiveTransform(P, np.array(H, np.float64).reshape(3, 3)).reshape(-1, 2)
RISE = {351: 0, 355: 62, 359: 115, 364: 92, 372: 20, 382: 0}
def grow_for(f):
    # how far the original UI is smeared by defocus / motion in this frame
    for (f0, f1, k) in ((351, 362, 19), (363, 372, 11), (373, 393, 7), (394, 412, 15), (413, 436, 7), (437, 444, 10)):
        if f0 <= f <= f1: return k
    return 9
for f in range(a, b + 1):
    im = load(f)
    H = HW[str(f)]
    m = np.zeros(im.shape[:2], np.uint8)
    # window interior: fill only where the original UI sat (alpha of the redrawn UI, which is laid
    # out on top of it) plus any leftover fine detail, so the real glass gradient is kept
    inner = np.zeros_like(m); cv2.fillPoly(inner, [np.round(outline(H, -13)).astype(np.int32)], 255)
    # union of the UI footprint over the next frames, carried back through the window homography
    # (some redrawn elements fade in a little later than the originals they replace)
    Hf = np.array(H, np.float64).reshape(3, 3); al = np.zeros(m.shape, np.uint8)
    for g in range(f, min(444, f + 24) + 1, 4):
        ag = cv2.imread(f'{S}/rd/work/s04_alpha/f{g:04d}.png', cv2.IMREAD_UNCHANGED)[..., 3]
        Hg = np.array(HW[str(g)], np.float64).reshape(3, 3)
        al = np.maximum(al, ag if g == f else cv2.warpPerspective(ag, Hf @ np.linalg.inv(Hg), (1920, 1080)))
    k = grow_for(f)
    ui = cv2.dilate((al > 6).astype(np.uint8) * 255, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * k + 1, 2 * k + 1)))
    L = im.mean(2); hf = np.abs(L - cv2.GaussianBlur(L, (0, 0), 14))
    det = cv2.dilate(((hf > 14) & (inner > 0)).astype(np.uint8) * 255, np.ones((9, 9), np.uint8))
    m |= (ui | det) & inner
    if f <= 404:
        s, px, py = HX[str(max(351, min(404, f)))]
        rise = np.interp(f, sorted(RISE), [RISE[k] for k in sorted(RISE)])
        X0, X1, Y0, Y1 = 270, 1760, 262 - rise, 402
        q = np.float32([[s * X0 + px - s * 285, s * Y0 + py - s * 285], [s * X1 + px - s * 285, s * Y1 + py - s * 285]])
        hm = np.zeros_like(m)
        cv2.rectangle(hm, tuple(np.int32(q[0] - 16)), tuple(np.int32(q[1] + 16)), 255, -1)
        win_out = np.zeros_like(m); cv2.fillPoly(win_out, [np.round(outline(H, 22)).astype(np.int32)], 255)
        m |= hm if 392 <= f <= 404 else (hm & ~win_out)
    out = fill_fast(im, m > 0)
    cv2.imwrite(f'{od}/bg_{f:04d}.jpg', cv2.cvtColor(np.clip(out + 0.5, 0, 255).astype(np.uint8), cv2.COLOR_RGB2BGR), [cv2.IMWRITE_JPEG_QUALITY, 95])
print('plates', a, b)
